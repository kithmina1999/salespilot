package whatsapp

import (
	"strings"
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

func TestBuildPaymentInfoReply(t *testing.T) {
	tests := []struct {
		name     string
		business *models.Business
		text     string
		want     []string
		notWant  []string
	}{
		{
			name: "bank transfer available with details",
			business: &models.Business{
				AllowCOD:      true,
				AllowTransfer: true,
				BankDetails:   "Bank: Test Bank\nAccount: 123",
			},
			text: "i want to pay using bank transfer",
			want: []string{"Bank transfer is available", "Bank: Test Bank", "72 hours"},
		},
		{
			name: "bank transfer unavailable but cod available",
			business: &models.Business{
				AllowCOD:      true,
				AllowTransfer: false,
			},
			text:    "can i pay bank transfer?",
			want:    []string{"Bank transfer is not available", "Cash on Delivery is available"},
			notWant: []string{"Bank details"},
		},
		{
			name: "generic methods list",
			business: &models.Business{
				AllowCOD:      true,
				AllowTransfer: true,
			},
			text: "how can i pay?",
			want: []string{"Available methods", "Cash on Delivery", "Bank Transfer"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reply := buildPaymentInfoReply(tt.business, tt.text)
			for _, want := range tt.want {
				if !strings.Contains(reply, want) {
					t.Fatalf("reply = %q, want substring %q", reply, want)
				}
			}
			for _, notWant := range tt.notWant {
				if strings.Contains(reply, notWant) {
					t.Fatalf("reply = %q, did not expect substring %q", reply, notWant)
				}
			}
		})
	}
}

func TestBuildDeliveryInfoReply(t *testing.T) {
	reply := buildDeliveryInfoReply(&models.Business{
		DeliveryPolicy: "Colombo delivery takes 1-2 days.",
		OperatingHours: "9 AM - 6 PM",
	})
	for _, want := range []string{"Colombo delivery takes 1-2 days.", "Operating hours: 9 AM - 6 PM"} {
		if !strings.Contains(reply, want) {
			t.Fatalf("reply = %q, want substring %q", reply, want)
		}
	}
}
