package handlers

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

func TestPaymentReceiptResponsesMaskStoredLocations(t *testing.T) {
	paymentProof := paymentProofResponse(models.PaymentProof{
		ID:            42,
		ScreenshotURL: "private_uploads/receipts/proof.jpg",
	})
	if paymentProof.ScreenshotURL != "/system/payments/42/receipt" {
		t.Fatalf("payment proof screenshot_url=%q", paymentProof.ScreenshotURL)
	}

	orderProof := orderPaymentProofResponse(models.OrderPaymentProof{
		ID:            99,
		ScreenshotURL: "https://res.cloudinary.com/demo/image/upload/proof.jpg",
	})
	if orderProof.ScreenshotURL != "/api/v1/order-proofs/99/receipt" {
		t.Fatalf("order proof screenshot_url=%q", orderProof.ScreenshotURL)
	}
}

func TestLocalReceiptFilesystemPathStaysInsideReceiptDirs(t *testing.T) {
	localPath, ok := localReceiptFilesystemPath("private_uploads/receipts/proof.jpg")
	if !ok {
		t.Fatal("expected private receipt path to be accepted")
	}
	if !strings.HasSuffix(filepath.ToSlash(localPath), "private_uploads/receipts/proof.jpg") {
		t.Fatalf("unexpected local path %q", localPath)
	}

	blocked := []string{
		"private_uploads/receipts/../../.env",
		"/uploads/products/public.jpg",
		"https://res.cloudinary.com/demo/image/upload/proof.jpg",
	}
	for _, raw := range blocked {
		if path, ok := localReceiptFilesystemPath(raw); ok {
			t.Fatalf("expected %q to be blocked, got %q", raw, path)
		}
	}
}

func TestAllowedRemoteReceiptURLRequiresHTTPSCloudinary(t *testing.T) {
	allowed := "https://res.cloudinary.com/demo/image/upload/proof.jpg"
	if !isAllowedRemoteReceiptURL(allowed) {
		t.Fatalf("expected %q to be allowed", allowed)
	}

	blocked := []string{
		"http://res.cloudinary.com/demo/image/upload/proof.jpg",
		"https://example.com/proof.jpg",
		"javascript:alert(1)",
	}
	for _, raw := range blocked {
		if isAllowedRemoteReceiptURL(raw) {
			t.Fatalf("expected %q to be blocked", raw)
		}
	}
}
