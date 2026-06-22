package middleware

import (
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kithmina1999/salespilot/observability"
)

const requestIDHeader = "X-Request-ID"

var validRequestID = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)

func RequestContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := normalizeRequestID(c.GetHeader(requestIDHeader))
		ctx := observability.WithRequestID(c.Request.Context(), requestID)
		c.Request = c.Request.WithContext(ctx)
		c.Set("request_id", requestID)
		c.Header(requestIDHeader, requestID)

		started := time.Now()
		c.Next()

		attrs := []any{
			"method", c.Request.Method,
			"route", routeName(c),
			"status", c.Writer.Status(),
			"duration_ms", time.Since(started).Milliseconds(),
		}
		if businessID, exists := c.Get("business_id"); exists {
			attrs = append(attrs, "business_id", businessID)
		}
		if userID, exists := c.Get("user_id"); exists {
			attrs = append(attrs, "user_id", userID)
		}
		if len(c.Errors) > 0 {
			attrs = append(attrs, "gin_error_count", len(c.Errors))
		}

		logger := observability.Logger(ctx)
		level := slog.LevelInfo
		switch {
		case c.Writer.Status() >= http.StatusInternalServerError:
			level = slog.LevelError
		case c.Writer.Status() >= http.StatusBadRequest:
			level = slog.LevelWarn
		}
		logger.Log(ctx, level, "http request completed", attrs...)
		if c.Writer.Status() >= http.StatusInternalServerError {
			if _, recovered := c.Get("panic_recovered"); !recovered {
				errorAttrs := map[string]any{
					"request_id": requestID,
					"route":      routeName(c),
					"status":     c.Writer.Status(),
				}
				if businessID, exists := c.Get("business_id"); exists {
					errorAttrs["business_id"] = businessID
				}
				observability.CaptureError(ctx, "HTTP request returned 5xx", fmt.Errorf("HTTP status %d", c.Writer.Status()), errorAttrs)
			}
		}
	}
}

func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				ctx := c.Request.Context()
				c.Set("panic_recovered", true)
				observability.Logger(ctx).ErrorContext(ctx, "panic recovered",
					"panic_type", fmt.Sprintf("%T", recovered),
					"stack", string(debug.Stack()),
				)
				observability.CaptureError(ctx, "Backend panic recovered", fmt.Errorf("panic type %T", recovered), map[string]any{
					"request_id": observability.RequestID(ctx),
					"route":      routeName(c),
					"error_code": "panic_recovered",
				})
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error":      "internal_server_error",
					"request_id": observability.RequestID(ctx),
				})
			}
		}()
		c.Next()
	}
}

func normalizeRequestID(candidate string) string {
	if validRequestID.MatchString(candidate) {
		return candidate
	}
	return uuid.NewString()
}

func routeName(c *gin.Context) string {
	if route := c.FullPath(); route != "" {
		return route
	}
	return "unmatched"
}
