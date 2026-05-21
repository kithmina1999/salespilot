package handlers

// settings_payment_test.go — TDD for Slice 1: "The Merchant's Setup"
//
// Tests that the settings handler correctly exposes and persists the three
// new payment configuration fields: allow_cod, allow_transfer, bank_details.
//
// Uses real PostgreSQL (loaded from .env) — same as production.
// Run: go test -v ./handlers -run "TestPaymentSettings"

import (
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testPaymentBizID is the ID of the isolated test business created in setup.
var testPaymentBizID uint

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)

	// Load .env so DATABASE_URL is available (same approach as main.go)
	if err := godotenv.Load("../.env"); err != nil {
		log.Println("⚠️  No .env found, relying on environment variables")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set — cannot run handler integration tests")
	}

	var err error
	database.DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // keep test output clean
	})
	if err != nil {
		log.Fatalf("failed to connect to test DB: %v", err)
	}

	// Run migrations to ensure the new payment columns exist
	if err := database.DB.AutoMigrate(&models.Business{}, &models.AuditLog{}); err != nil {
		log.Fatalf("AutoMigrate failed: %v", err)
	}

	// Seed an isolated test business with a unique API key
	biz := models.Business{
		Name:     "__test_payment_settings__",
		Phone:    "00000000001", // unlikely to collide
		APIKey:   "test-payment-settings-key",
		Plan:     models.PlanFree,
		AllowCOD: true,
	}
	// Upsert: if a previous test run left this row, reuse it
	database.DB.Where("api_key = ?", biz.APIKey).FirstOrCreate(&biz)
	database.DB.Model(&biz).Updates(map[string]interface{}{
		"name":           "__test_payment_settings__",
		"phone":          "00000000001",
		"plan":           models.PlanFree,
		"allow_cod":      true,
		"allow_transfer": false,
		"bank_details":   "",
	})
	testPaymentBizID = biz.ID

	code := m.Run()

	// Cleanup: remove the test business row
	database.DB.Unscoped().Delete(&models.Business{}, testPaymentBizID)

	os.Exit(code)
}

// ─── helpers ────────────────────────────────────────────────────────────────

func newGETContext(bizID uint) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("business_id", bizID)
	c.Set("user_id", uint(0))
	c.Request, _ = http.NewRequest("GET", "/api/v1/settings", nil)
	return c, w
}

func newPUTContext(bizID uint, body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("business_id", bizID)
	c.Set("user_id", uint(0))
	c.Request, _ = http.NewRequest("PUT", "/api/v1/settings", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var out map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("cannot decode response body: %v\nbody=%s", err, w.Body.String())
	}
	return out
}

// ─── Test 1 (Tracer Bullet): GET /settings includes payment config ───────────

// TestPaymentSettings_GetIncludesPaymentConfig verifies that the GET /settings
// response includes the three payment configuration keys.
func TestPaymentSettings_GetIncludesPaymentConfig(t *testing.T) {
	c, w := newGETContext(testPaymentBizID)

	GetBusinessSettings(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	body := decodeBody(t, w)

	for _, key := range []string{"allow_cod", "allow_transfer", "bank_details"} {
		if _, ok := body[key]; !ok {
			t.Errorf("response missing key %q", key)
		}
	}

	// Seeded with AllowCOD=true
	if body["allow_cod"] != true {
		t.Errorf("expected allow_cod=true, got %v", body["allow_cod"])
	}
	if body["allow_transfer"] != false {
		t.Errorf("expected allow_transfer=false, got %v", body["allow_transfer"])
	}

	t.Logf("✅ GET /settings — allow_cod=%v allow_transfer=%v bank_details=%q",
		body["allow_cod"], body["allow_transfer"], body["bank_details"])
}

// ─── Test 2: PUT /settings saves payment fields ──────────────────────────────

// TestPaymentSettings_PutSavesFields verifies that bank transfer settings
// are persisted in the DB when a merchant updates their payment config.
func TestPaymentSettings_PutSavesFields(t *testing.T) {
	payload := `{
		"name": "__test_payment_settings__",
		"allow_cod": true,
		"allow_transfer": true,
		"bank_details": "Bank: Sampath Bank\nAccount: 123456789\nName: Test Shop"
	}`
	c, w := newPUTContext(testPaymentBizID, payload)

	UpdateBusinessSettings(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	// Read straight from DB to confirm persistence (not trusting the response)
	var biz models.Business
	if err := database.DB.First(&biz, testPaymentBizID).Error; err != nil {
		t.Fatalf("failed to reload business: %v", err)
	}

	if !biz.AllowTransfer {
		t.Errorf("expected AllowTransfer=true, got false")
	}
	if !biz.AllowCOD {
		t.Errorf("expected AllowCOD=true, got false")
	}
	if !strings.Contains(biz.BankDetails, "Sampath Bank") {
		t.Errorf("expected bank_details to contain 'Sampath Bank', got: %q", biz.BankDetails)
	}

	t.Logf("✅ PUT /settings persisted — allow_cod=%v allow_transfer=%v bank_details=%q",
		biz.AllowCOD, biz.AllowTransfer, biz.BankDetails)
}

// ─── Test 3: Business model defaults ─────────────────────────────────────────

// TestPaymentSettings_DefaultsAllowCODTrue verifies that a new business
// has AllowCOD=true (safe default) and AllowTransfer=false (opt-in only).
func TestPaymentSettings_DefaultsAllowCODTrue(t *testing.T) {
	biz := models.Business{
		Name:   "__test_defaults__",
		Phone:  "00000000002",
		APIKey: "test-defaults-key",
	}
	if err := database.DB.Create(&biz).Error; err != nil {
		t.Fatalf("failed to create business: %v", err)
	}
	defer database.DB.Unscoped().Delete(&biz)

	// Reload to pick up DB-applied defaults
	var loaded models.Business
	database.DB.First(&loaded, biz.ID)

	if !loaded.AllowCOD {
		t.Errorf("expected AllowCOD=true by default, got false")
	}
	if loaded.AllowTransfer {
		t.Errorf("expected AllowTransfer=false by default, got true")
	}

	t.Logf("✅ New business defaults — allow_cod=%v allow_transfer=%v", loaded.AllowCOD, loaded.AllowTransfer)
}
