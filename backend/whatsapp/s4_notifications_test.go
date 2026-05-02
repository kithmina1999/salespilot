package whatsapp

// s4_notifications_test.go — TDD for S4: Notification Enhancement
//
// Testable unit: the pure builder functions that construct Notification payloads.
// DB writes and HTTP side-effects are in createNotification() which is
// NOT tested here — the builder purity is what matters for regression safety.

import (
	"strings"
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

// ─── buildOrderNotification ───────────────────────────────────────────────────

func TestBuildOrderNotification_TypeIsNewOrder(t *testing.T) {
	n := buildOrderNotification(1, 42, "Kasun Silva", "94771234567", 1500.0)
	if n.Type != "new_order" {
		t.Errorf("Type = %q, want \"new_order\"", n.Type)
	}
}

func TestBuildOrderNotification_TitleContainsOrderNum(t *testing.T) {
	n := buildOrderNotification(1, 42, "Kasun Silva", "94771234567", 1500.0)
	if !strings.Contains(n.Title, "42") {
		t.Errorf("Title %q should contain order number 42", n.Title)
	}
}

func TestBuildOrderNotification_BodyContainsCustomerAndAmount(t *testing.T) {
	n := buildOrderNotification(1, 42, "Kasun Silva", "94771234567", 1500.0)
	if !strings.Contains(n.Body, "Kasun Silva") {
		t.Errorf("Body %q should contain customer name", n.Body)
	}
	if !strings.Contains(n.Body, "1500") {
		t.Errorf("Body %q should contain order amount", n.Body)
	}
}

func TestBuildOrderNotification_BusinessIDPropagated(t *testing.T) {
	n := buildOrderNotification(7, 1, "Name", "phone", 100)
	if n.BusinessID != 7 {
		t.Errorf("BusinessID = %d, want 7", n.BusinessID)
	}
}

func TestBuildOrderNotification_FallsBackToPhoneWhenNoName(t *testing.T) {
	n := buildOrderNotification(1, 1, "", "94771234567", 500)
	if !strings.Contains(n.Body, "94771234567") {
		t.Errorf("Body %q should contain phone when name is empty", n.Body)
	}
}

// ─── buildProofNotification ───────────────────────────────────────────────────

func TestBuildProofNotification_TypeIsPaymentProof(t *testing.T) {
	n := buildProofNotification(1, 99, 7, "94770000000", 2500.0)
	if n.Type != "payment_proof" {
		t.Errorf("Type = %q, want \"payment_proof\"", n.Type)
	}
}

func TestBuildProofNotification_TitleContainsOrderNum(t *testing.T) {
	n := buildProofNotification(1, 99, 7, "94770000000", 2500.0)
	if !strings.Contains(n.Title, "7") {
		t.Errorf("Title %q should contain order number 7", n.Title)
	}
}

func TestBuildProofNotification_BodyContainsAmount(t *testing.T) {
	n := buildProofNotification(1, 99, 7, "94770000000", 2500.0)
	if !strings.Contains(n.Body, "2500") {
		t.Errorf("Body %q should contain amount 2500", n.Body)
	}
}

func TestBuildProofNotification_RefIDIsProofID(t *testing.T) {
	n := buildProofNotification(5, 99, 7, "phone", 100)
	if n.RefID != 99 {
		t.Errorf("RefID = %d, want 99 (proof ID)", n.RefID)
	}
}

func TestBuildNotification_IsReadDefaultsFalse(t *testing.T) {
	// Both builders produce unread notifications by default
	order := buildOrderNotification(1, 1, "Name", "phone", 100)
	proof := buildProofNotification(1, 1, 1, "phone", 100)
	for _, n := range []models.Notification{order, proof} {
		if n.IsRead {
			t.Errorf("new notification for type=%q should have IsRead=false", n.Type)
		}
	}
}
