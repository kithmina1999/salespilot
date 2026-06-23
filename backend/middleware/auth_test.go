package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newMiddlewareRouter(middleware gin.HandlerFunc, handler gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	r.GET("/protected", middleware, handler)
	return r
}

func performMiddlewareRequest(r http.Handler, target string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func useTenantAuthTestDB(t *testing.T, apiKey string) uint {
	t.Helper()

	previousDB := database.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite test DB: %v", err)
	}
	if err := db.AutoMigrate(&models.Business{}); err != nil {
		t.Fatalf("migrate business model: %v", err)
	}

	biz := models.Business{
		Name:   "Tenant Auth Test",
		Phone:  "+94770000000",
		APIKey: apiKey,
	}
	if err := db.Create(&biz).Error; err != nil {
		t.Fatalf("create business: %v", err)
	}

	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
	})
	return biz.ID
}

func TestAuthRequiredIgnoresQueryToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "12345678901234567890123456789012")
	r := newMiddlewareRouter(AuthRequired(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	w := performMiddlewareRequest(r, "/protected?token=not-a-header-token", nil)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected query token to be rejected with 401, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "Authorization token required") {
		t.Fatalf("expected missing-header error, got %s", w.Body.String())
	}
}

func TestTenantAuthRejectsQueryStringAPIKey(t *testing.T) {
	useTenantAuthTestDB(t, "tenant-secret")
	r := newMiddlewareRouter(TenantAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	w := performMiddlewareRequest(r, "/protected?api_key=tenant-secret", nil)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected query api_key to be rejected with 401, got %d", w.Code)
	}
}

func TestTenantAuthAcceptsHeaderAPIKey(t *testing.T) {
	businessID := useTenantAuthTestDB(t, "tenant-secret")
	r := newMiddlewareRouter(TenantAuth(), func(c *gin.Context) {
		if got := c.GetUint("business_id"); got != businessID {
			t.Fatalf("business_id = %d, want %d", got, businessID)
		}
		c.Status(http.StatusNoContent)
	})

	w := performMiddlewareRequest(r, "/protected", map[string]string{
		"X-API-Key": "tenant-secret",
	})

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected header api key to pass with 204, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestMasterAuthRejectsQueryStringMasterKey(t *testing.T) {
	r := newMiddlewareRouter(MasterAuth("master-secret"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	w := performMiddlewareRequest(r, "/protected?master_key=master-secret", nil)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected query master_key to be rejected with 401, got %d", w.Code)
	}
}

func TestMasterAuthAcceptsHeaderMasterKey(t *testing.T) {
	r := newMiddlewareRouter(MasterAuth("master-secret"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	w := performMiddlewareRequest(r, "/protected", map[string]string{
		"X-Master-Key": "master-secret",
	})

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected header master key to pass with 204, got %d body=%s", w.Code, w.Body.String())
	}
}
