package handlers

import (
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

func TestPlanUpdateMapUsesGormColumnNameForWhatsAppImages(t *testing.T) {
	update := planUpdateMap(models.SubscriptionPlan{
		CanSendWhatsAppImages: true,
	})

	if _, ok := update["can_send_whatsapp_images"]; ok {
		t.Fatalf("planUpdateMap used non-existent column can_send_whatsapp_images")
	}
	if got, ok := update["can_send_whats_app_images"]; !ok || got != true {
		t.Fatalf("planUpdateMap can_send_whats_app_images = %v, %v; want true, true", got, ok)
	}
}
