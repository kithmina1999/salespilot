package handlers

// order_proof_handler_test.go — TDD for Slice 4: "The Merchant's Review"
//
// Tests that merchants can approve/reject a payment proof, which updates
// both the OrderPaymentProof and Order records, then notifies the customer.
//
// Run: go test -v ./handlers -run TestProofReview

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ─── test data setup ─────────────────────────────────────────────────────────

func makeProofTestOrder(t *testing.T, bizID uint, paymentStatus string) models.Order {
	t.Helper()
	order := models.Order{
		BusinessOrderNum: 2001,
		BusinessID:       bizID,
		CustomerPhone:    "94770000099",
		CustomerName:     "Review Test Customer",
		Items:            "[]",
		TotalPrice:       3500,
		Status:           models.OrderStatusNew,
		Address:          "Colombo",
		PaymentMethod:    "bank_transfer",
		PaymentStatus:    paymentStatus,
		CreatedAt:        time.Now(),
	}
	database.DB.Create(&order)
	t.Cleanup(func() {
		database.DB.Unscoped().Delete(&models.OrderPaymentProof{}, "order_id = ?", order.ID)
		database.DB.Unscoped().Delete(&models.Order{}, order.ID)
	})
	return order
}

func makeProofRecord(t *testing.T, bizID, orderID uint) models.OrderPaymentProof {
	t.Helper()
	proof := models.OrderPaymentProof{
		BusinessID:    bizID,
		OrderID:       orderID,
		CustomerPhone: "94770000099",
		Amount:        3500,
		Description:   "Bank transfer screenshot",
		Status:        "pending",
	}
	database.DB.Create(&proof)
	t.Cleanup(func() {
		database.DB.Unscoped().Delete(&models.OrderPaymentProof{}, proof.ID)
	})
	return proof
}

func proofPUTContext(bizID uint, proofID uint, body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("business_id", bizID)
	c.Set("user_id", uint(1))
	c.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", proofID)}}
	c.Request, _ = http.NewRequest("POST", "/", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

// ─── Test 1 (Tracer Bullet): Approve proof updates both records ───────────────

// TestProofReview_ApproveUpdatesOrderAndProof verifies that approving a proof:
// 1. Sets OrderPaymentProof.Status = "approved"
// 2. Sets Order.PaymentStatus = "approved"
// 3. Sets Order.Status = "confirmed"
func TestProofReview_ApproveUpdatesOrderAndProof(t *testing.T) {
	order := makeProofTestOrder(t, testPaymentBizID, "awaiting_verification")
	proof := makeProofRecord(t, testPaymentBizID, order.ID)

	c, w := proofPUTContext(testPaymentBizID, proof.ID, `{}`)
	ApproveOrderProof(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	// Reload from DB
	var updatedProof models.OrderPaymentProof
	database.DB.First(&updatedProof, proof.ID)
	if updatedProof.Status != "approved" {
		t.Errorf("expected proof.Status=approved, got %q", updatedProof.Status)
	}

	var updatedOrder models.Order
	database.DB.First(&updatedOrder, order.ID)
	if updatedOrder.PaymentStatus != "approved" {
		t.Errorf("expected order.PaymentStatus=approved, got %q", updatedOrder.PaymentStatus)
	}
	if updatedOrder.Status != models.OrderStatusConfirmed {
		t.Errorf("expected order.Status=confirmed, got %q", updatedOrder.Status)
	}

	t.Logf("✅ ApproveProof: proof.Status=%q order.PaymentStatus=%q order.Status=%q",
		updatedProof.Status, updatedOrder.PaymentStatus, updatedOrder.Status)
}

// ─── Test 2: Reject proof updates records with merchant note ─────────────────

// TestProofReview_RejectUpdatesOrderAndProof verifies that rejecting a proof:
// 1. Sets OrderPaymentProof.Status = "rejected" with MerchantNote
// 2. Sets Order.PaymentStatus = "rejected"
// 3. Order.Status stays as "new" (not cancelled — customer can retry)
func TestProofReview_RejectUpdatesOrderAndProof(t *testing.T) {
	order := makeProofTestOrder(t, testPaymentBizID, "awaiting_verification")
	proof := makeProofRecord(t, testPaymentBizID, order.ID)

	c, w := proofPUTContext(testPaymentBizID, proof.ID, `{"note": "Amount doesn't match our records"}`)
	RejectOrderProof(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	var updatedProof models.OrderPaymentProof
	database.DB.First(&updatedProof, proof.ID)
	if updatedProof.Status != "rejected" {
		t.Errorf("expected proof.Status=rejected, got %q", updatedProof.Status)
	}
	if !strings.Contains(updatedProof.MerchantNote, "Amount") {
		t.Errorf("expected proof.MerchantNote to contain rejection reason, got %q", updatedProof.MerchantNote)
	}

	var updatedOrder models.Order
	database.DB.First(&updatedOrder, order.ID)
	if updatedOrder.PaymentStatus != "rejected" {
		t.Errorf("expected order.PaymentStatus=rejected, got %q", updatedOrder.PaymentStatus)
	}
	// Order status stays "new" — customer can re-upload proof
	if updatedOrder.Status != models.OrderStatusNew {
		t.Errorf("expected order.Status to remain 'new' after rejection, got %q", updatedOrder.Status)
	}

	t.Logf("✅ RejectProof: proof.Status=%q note=%q order.PaymentStatus=%q",
		updatedProof.Status, updatedProof.MerchantNote, updatedOrder.PaymentStatus)
}

// ─── Test 3: List proofs endpoint returns awaiting orders ─────────────────────

// TestProofReview_ListProofsReturnsPending verifies GET /api/v1/orders/proofs
// returns proof records that need merchant review.
func TestProofReview_ListProofsReturnsPending(t *testing.T) {
	order := makeProofTestOrder(t, testPaymentBizID, "awaiting_verification")
	makeProofRecord(t, testPaymentBizID, order.ID)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("business_id", testPaymentBizID)
	c.Request, _ = http.NewRequest("GET", "/api/v1/orders/proofs", nil)

	ListOrderProofs(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)

	proofs, ok := resp["proofs"].([]interface{})
	if !ok || len(proofs) == 0 {
		t.Errorf("expected at least 1 pending proof in response, got: %v", resp)
	}

	t.Logf("✅ ListProofs returned %d pending proofs", len(proofs))
}
