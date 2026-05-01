package services

// payment_cleanup_test.go — TDD for Slice 5: "The Automated Cleanup"
//
// Tests that CancelStaleTransferOrders() correctly:
// 1. Cancels orders that are >72h old with payment_method=bank_transfer and payment_status=pending/rejected
// 2. Does NOT cancel orders that are <72h old
// 3. Does NOT cancel COD orders
// 4. Does NOT cancel orders already awaiting_verification or approved
//
// Run: go test -v ./services -run TestPaymentCleanup

import (
	"os"
	"testing"
	"time"

	"github.com/joho/godotenv"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestMain(m *testing.M) {
	godotenv.Load("../.env")
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		panic("DATABASE_URL not set")
	}
	var err error
	database.DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		panic(err)
	}
	database.DB.AutoMigrate(&models.Order{}, &models.Business{})
	os.Exit(m.Run())
}

// makeStaleOrder creates an order with a backdated created_at.
func makeStaleOrder(t *testing.T, method, payStatus string, ageHours int) models.Order {
	t.Helper()
	order := models.Order{
		BusinessOrderNum: 9001,
		BusinessID:       1,
		CustomerPhone:    "94770000199",
		Items:            "[]",
		TotalPrice:       2500,
		Status:           models.OrderStatusNew,
		PaymentMethod:    method,
		PaymentStatus:    payStatus,
	}
	if err := database.DB.Create(&order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	// Backdate created_at so the cron sees it as stale
	backdate := time.Now().Add(-time.Duration(ageHours) * time.Hour)
	database.DB.Model(&order).UpdateColumn("created_at", backdate)

	t.Cleanup(func() { database.DB.Unscoped().Delete(&models.Order{}, order.ID) })
	return order
}

func reloadOrder(t *testing.T, id uint) models.Order {
	t.Helper()
	var o models.Order
	database.DB.First(&o, id)
	return o
}

// ─── Test 1 (Tracer Bullet): stale transfer orders are cancelled ─────────────

func TestPaymentCleanup_CancelsStaleTransferOrders(t *testing.T) {
	// 75h old — over the 72h threshold
	stale := makeStaleOrder(t, "bank_transfer", "pending", 75)

	CancelStaleTransferOrders()

	updated := reloadOrder(t, stale.ID)
	if updated.Status != models.OrderStatusCancelled {
		t.Errorf("expected status=cancelled, got %q", updated.Status)
	}
	if updated.PaymentStatus != "cancelled" {
		t.Errorf("expected payment_status=cancelled, got %q", updated.PaymentStatus)
	}
	t.Logf("✅ Stale transfer order #%d cancelled — status=%q", stale.ID, updated.Status)
}

// ─── Test 2: fresh orders are not touched ───────────────────────────────────

func TestPaymentCleanup_SkipsFreshOrders(t *testing.T) {
	// Only 10h old — well within 72h window
	fresh := makeStaleOrder(t, "bank_transfer", "pending", 10)

	CancelStaleTransferOrders()

	updated := reloadOrder(t, fresh.ID)
	if updated.Status == models.OrderStatusCancelled {
		t.Errorf("fresh order should NOT be cancelled, but got status=%q", updated.Status)
	}
	t.Logf("✅ Fresh order #%d untouched — status=%q", fresh.ID, updated.Status)
}

// ─── Test 3: COD orders are never auto-cancelled ────────────────────────────

func TestPaymentCleanup_SkipsCODOrders(t *testing.T) {
	cod := makeStaleOrder(t, "cod", "pending", 80)

	CancelStaleTransferOrders()

	updated := reloadOrder(t, cod.ID)
	if updated.Status == models.OrderStatusCancelled {
		t.Errorf("COD order should NOT be auto-cancelled, got status=%q", updated.Status)
	}
	t.Logf("✅ COD order #%d untouched — status=%q", cod.ID, updated.Status)
}

// ─── Test 4: awaiting_verification orders are not cancelled ─────────────────

func TestPaymentCleanup_SkipsAwaitingVerification(t *testing.T) {
	// Proof already submitted — merchant is reviewing, don't cancel
	reviewing := makeStaleOrder(t, "bank_transfer", "awaiting_verification", 80)

	CancelStaleTransferOrders()

	updated := reloadOrder(t, reviewing.ID)
	if updated.Status == models.OrderStatusCancelled {
		t.Errorf("awaiting_verification order should NOT be cancelled, got status=%q", updated.Status)
	}
	t.Logf("✅ Awaiting-verification order #%d protected — status=%q", reviewing.ID, updated.Status)
}

// ─── Test 5: rejected proof orders ARE re-cancelled after 72h ───────────────

func TestPaymentCleanup_CancelsRejectedProofOrders(t *testing.T) {
	// Proof was rejected, customer never resubmitted, 75h passed
	rejected := makeStaleOrder(t, "bank_transfer", "rejected", 75)

	CancelStaleTransferOrders()

	updated := reloadOrder(t, rejected.ID)
	if updated.Status != models.OrderStatusCancelled {
		t.Errorf("rejected+stale order should be cancelled, got status=%q", updated.Status)
	}
	t.Logf("✅ Rejected+stale order #%d cancelled — status=%q", rejected.ID, updated.Status)
}
