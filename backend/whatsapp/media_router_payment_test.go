package whatsapp

// media_router_payment_test.go — TDD for Slice 3: "The Proof Capture"
//
// Tests that when Gemini Vision identifies an image as a "payment_proof",
// the media router creates an OrderPaymentProof record and updates the
// customer's pending order status to "awaiting_verification".
//
// Uses real PostgreSQL (via TestMain in pipeline_test.go).
// Run: go test -v ./whatsapp -run TestPaymentProof

import (
	"testing"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ─── helpers ────────────────────────────────────────────────────────────────

func makePendingTransferOrder(t *testing.T, biz models.Business) models.Order {
	t.Helper()

	order := models.Order{
		BusinessOrderNum: 1001,
		BusinessID:       biz.ID,
		CartID:           0,
		CustomerPhone:    "94770000002",
		CustomerName:     "Test User",
		Items:            "[]",
		TotalPrice:       5000,
		Status:           models.OrderStatusNew,
		Address:          "Colombo",
		Notes:            "",
		PaymentMethod:    "bank_transfer",
		PaymentStatus:    "pending",
		CreatedAt:        time.Now(),
	}
	if err := database.DB.Create(&order).Error; err != nil {
		t.Fatalf("failed to create pending order: %v", err)
	}

	t.Cleanup(func() {
		database.DB.Unscoped().Delete(&models.OrderPaymentProof{}, "order_id = ?", order.ID)
		database.DB.Unscoped().Delete(&models.Order{}, order.ID)
	})

	return order
}

// ─── Test 1 (Tracer Bullet): Payment proof creates record and updates order ──

func TestPaymentProof_CreatesRecordAndUpdateOrder(t *testing.T) {
	// AutoMigrate the new OrderPaymentProof model since we added it
	if err := database.DB.AutoMigrate(&models.OrderPaymentProof{}); err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}

	biz := makeBizWithPayment(t, true, true, "Sampath Bank")
	order := makePendingTransferOrder(t, biz)

	// Simulate HandleImageWebhook routing to handlePaymentProofImage
	// (we pass an empty URL for the test since Cloudinary isn't mocked here)
	handlePaymentProofImage(&biz, order.CustomerPhone, order.CustomerPhone, "Screenshot of Sampath Bank transfer for Rs 5000")

	// 1. Verify OrderPaymentProof record was created
	var proof models.OrderPaymentProof
	if err := database.DB.Where("order_id = ?", order.ID).First(&proof).Error; err != nil {
		t.Fatalf("expected OrderPaymentProof to be created, got error: %v", err)
	}

	if proof.Status != "pending" {
		t.Errorf("expected proof status to be pending, got %q", proof.Status)
	}
	if proof.Amount != order.TotalPrice {
		t.Errorf("expected proof amount to be %.2f, got %.2f", order.TotalPrice, proof.Amount)
	}

	// 2. Verify Order.PaymentStatus was updated
	var updatedOrder models.Order
	if err := database.DB.First(&updatedOrder, order.ID).Error; err != nil {
		t.Fatalf("failed to reload order: %v", err)
	}

	if updatedOrder.PaymentStatus != "awaiting_verification" {
		t.Errorf("expected order payment status to be 'awaiting_verification', got %q", updatedOrder.PaymentStatus)
	}

	t.Logf("✅ Payment proof processed: Proof ID=%d, Order PaymentStatus=%q", proof.ID, updatedOrder.PaymentStatus)
}
