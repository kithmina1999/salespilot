package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequestContextPreservesValidRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestContext())
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set(requestIDHeader, "deploy-123")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if got := recorder.Header().Get(requestIDHeader); got != "deploy-123" {
		t.Fatalf("request id = %q, want deploy-123", got)
	}
}

func TestRequestContextReplacesUnsafeRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestContext())
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set(requestIDHeader, "bad id\nforged")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	got := recorder.Header().Get(requestIDHeader)
	if got == "" || got == "bad id\nforged" || !validRequestID.MatchString(got) {
		t.Fatalf("unsafe request id was not replaced: %q", got)
	}
}

func TestRecoveryReturnsCorrelationID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestContext(), Recovery())
	router.GET("/panic", func(c *gin.Context) {
		panic("boom")
	})

	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
	req.Header.Set(requestIDHeader, "panic-123")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", recorder.Code)
	}
	if got := recorder.Header().Get(requestIDHeader); got != "panic-123" {
		t.Fatalf("request id = %q, want panic-123", got)
	}
}
