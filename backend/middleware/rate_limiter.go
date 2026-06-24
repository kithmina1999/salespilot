package middleware

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/cache"
)

const (
	defaultRateLimitWindow   = time.Minute
	defaultRateLimitBodySize = 64 * 1024
)

var (
	rateLimitStoreMu sync.RWMutex
	rateLimitStore   cache.StateStore = cache.NewInMemoryStore(cache.DefaultConfig())
)

// RateLimitOptions configures a shared-store fixed-window rate limiter.
type RateLimitOptions struct {
	Name             string
	MaxRequests      int
	Window           time.Duration
	IdentifierFields []string
	LimitByIP        bool
	MaxBodyBytes     int64
}

// SetRateLimitStore wires the middleware to the app's shared StateStore. In
// production this should be Redis-backed so limits apply across all instances.
func SetRateLimitStore(store cache.StateStore) {
	if store == nil {
		return
	}
	rateLimitStoreMu.Lock()
	defer rateLimitStoreMu.Unlock()
	rateLimitStore = store
}

// RateLimit creates a per-IP limiter that allows maxRequests per minute.
func RateLimit(maxRequests int) gin.HandlerFunc {
	return RateLimitWithOptions(RateLimitOptions{
		MaxRequests: maxRequests,
		Window:      defaultRateLimitWindow,
		LimitByIP:   true,
	})
}

// RateLimitAuth protects auth endpoints with both IP and request-identifier
// limits. Identifier values are hashed before they become StateStore keys.
func RateLimitAuth(maxRequests int, identifierFields ...string) gin.HandlerFunc {
	return RateLimitWithOptions(RateLimitOptions{
		Name:             "auth",
		MaxRequests:      maxRequests,
		Window:           defaultRateLimitWindow,
		IdentifierFields: identifierFields,
		LimitByIP:        true,
	})
}

// RateLimitAdminLogin protects the super-admin login from distributed brute
// force attempts.
func RateLimitAdminLogin() gin.HandlerFunc {
	return RateLimitWithOptions(RateLimitOptions{
		Name:             "system_auth_login",
		MaxRequests:      10,
		Window:           15 * time.Minute,
		IdentifierFields: []string{"email"},
		LimitByIP:        true,
	})
}

func RateLimitWithOptions(opts RateLimitOptions) gin.HandlerFunc {
	if opts.Window <= 0 {
		opts.Window = defaultRateLimitWindow
	}
	if opts.MaxBodyBytes <= 0 {
		opts.MaxBodyBytes = defaultRateLimitBodySize
	}
	if opts.MaxRequests <= 0 {
		return func(c *gin.Context) { c.Next() }
	}

	return func(c *gin.Context) {
		keys, ok := rateLimitKeys(c, opts)
		if !ok {
			return
		}

		store := currentRateLimitStore()
		minRemaining := opts.MaxRequests
		for _, key := range keys {
			count, err := store.Increment(key, 1, opts.Window)
			if err != nil {
				log.Printf("rate limiter store error: %v", err)
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
					"error": "Rate limiter unavailable. Try again shortly.",
				})
				return
			}
			remaining := opts.MaxRequests - count
			if remaining < minRemaining {
				minRemaining = remaining
			}
			if count > opts.MaxRequests {
				c.Header("Retry-After", strconv.Itoa(int(opts.Window.Seconds())))
				c.Header("X-RateLimit-Limit", strconv.Itoa(opts.MaxRequests))
				c.Header("X-RateLimit-Remaining", "0")
				c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
					"error": "Rate limit exceeded. Try again later.",
				})
				return
			}
		}

		if minRemaining < 0 {
			minRemaining = 0
		}
		c.Header("X-RateLimit-Limit", strconv.Itoa(opts.MaxRequests))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(minRemaining))
		c.Next()
	}
}

func currentRateLimitStore() cache.StateStore {
	rateLimitStoreMu.RLock()
	defer rateLimitStoreMu.RUnlock()
	return rateLimitStore
}

func rateLimitKeys(c *gin.Context, opts RateLimitOptions) ([]string, bool) {
	scope := rateLimitScope(c, opts.Name)
	keys := make([]string, 0, 1+len(opts.IdentifierFields))

	if opts.LimitByIP {
		keys = append(keys, rateLimitKey(scope, "ip", normalizeIP(c.ClientIP())))
	}

	values, ok := requestIdentifierValues(c, opts.IdentifierFields, opts.MaxBodyBytes)
	if !ok {
		return nil, false
	}
	for _, field := range opts.IdentifierFields {
		if value := values[field]; value != "" {
			keys = append(keys, rateLimitKey(scope, "id:"+field, value))
		}
	}

	if len(keys) == 0 {
		keys = append(keys, rateLimitKey(scope, "ip", normalizeIP(c.ClientIP())))
	}
	return keys, true
}

func rateLimitScope(c *gin.Context, name string) string {
	route := c.FullPath()
	if route == "" && c.Request != nil && c.Request.URL != nil {
		route = c.Request.URL.Path
	}
	scope := strings.TrimSpace(name)
	if scope == "" {
		scope = route
	} else if route != "" {
		scope += ":" + route
	}
	if c.Request != nil {
		scope = c.Request.Method + ":" + scope
	}
	return hashKeyPart(scope)
}

func rateLimitKey(scope, kind, value string) string {
	return fmt.Sprintf("rate_limit:%s:%s:%s", scope, kind, hashKeyPart(value))
}

func normalizeIP(raw string) string {
	host := strings.TrimSpace(raw)
	if parsed := net.ParseIP(host); parsed != nil {
		return parsed.String()
	}
	return strings.ToLower(host)
}

func requestIdentifierValues(c *gin.Context, fields []string, maxBytes int64) (map[string]string, bool) {
	values := make(map[string]string, len(fields))
	if len(fields) == 0 || c.Request == nil || c.Request.Body == nil {
		return values, true
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxBytes+1))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return nil, false
	}
	if int64(len(body)) > maxBytes {
		c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Request body too large"})
		return nil, false
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	if len(bytes.TrimSpace(body)) == 0 {
		return values, true
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return values, true
	}
	for _, field := range fields {
		raw, ok := payload[field]
		if !ok || raw == nil {
			continue
		}
		if value := normalizeIdentifier(fmt.Sprint(raw)); value != "" {
			values[field] = value
		}
	}
	return values, true
}

func normalizeIdentifier(raw string) string {
	return strings.ToLower(strings.Join(strings.Fields(raw), ""))
}

func hashKeyPart(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
