package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/cache"
)

func useRateLimitTestStore(t *testing.T) {
	t.Helper()
	previous := currentRateLimitStore()
	store := cache.NewInMemoryStore(cache.StoreConfig{
		CleanupInterval: time.Second,
		MaxEntries:      100,
	})
	SetRateLimitStore(store)
	t.Cleanup(func() {
		SetRateLimitStore(previous)
		store.Stop()
	})
}

func TestRateLimitBlocksAfterSharedStoreLimit(t *testing.T) {
	useRateLimitTestStore(t)

	router := gin.New()
	router.GET("/limited", RateLimit(2), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/limited", nil)
		req.RemoteAddr = "203.0.113.10:1234"
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("request %d status=%d body=%s", i+1, rec.Code, rec.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/limited", nil)
	req.RemoteAddr = "203.0.113.10:1234"
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("third request status=%d, want 429 body=%s", rec.Code, rec.Body.String())
	}
}

func TestRateLimitAuthUsesIdentifierAcrossChangingIPs(t *testing.T) {
	useRateLimitTestStore(t)

	router := gin.New()
	router.POST("/login", RateLimitAuth(2, "email"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	for i, remoteAddr := range []string{"203.0.113.10:1234", "203.0.113.11:1234"} {
		req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"Admin@Example.test","password":"x"}`))
		req.RemoteAddr = remoteAddr
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("request %d status=%d body=%s", i+1, rec.Code, rec.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"email":"admin@example.test","password":"x"}`))
	req.RemoteAddr = "203.0.113.12:1234"
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("third identifier request status=%d, want 429 body=%s", rec.Code, rec.Body.String())
	}
}

func TestRateLimitAuthRestoresRequestBody(t *testing.T) {
	useRateLimitTestStore(t)

	router := gin.New()
	router.POST("/login", RateLimitAuth(5, "identifier"), func(c *gin.Context) {
		var payload struct {
			Identifier string `json:"identifier"`
			Password   string `json:"password"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			t.Fatalf("body was not restored: %v", err)
		}
		if payload.Identifier != "owner@example.test" || payload.Password != "secret" {
			t.Fatalf("payload=%+v", payload)
		}
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader(`{"identifier":"owner@example.test","password":"secret"}`))
	req.RemoteAddr = "203.0.113.10:1234"
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}
