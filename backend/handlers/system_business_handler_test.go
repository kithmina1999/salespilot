package handlers

import (
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

func TestBuildSystemBusinessResponseStripsTenantSecrets(t *testing.T) {
	resp := buildSystemBusinessResponse(models.Business{
		APIKey:        "biz_secret_key",
		WAAccessToken: "EAA_secret_token",
		WAStatus:      "connected",
	})

	if resp.APIKey != "" {
		t.Fatalf("expected APIKey to be stripped, got %q", resp.APIKey)
	}
	if resp.WAAccessToken != "" {
		t.Fatalf("expected WAAccessToken to be stripped, got %q", resp.WAAccessToken)
	}
	if !resp.HasAPIKey {
		t.Fatal("expected HasAPIKey to preserve key presence")
	}
	if !resp.HasWAAccessToken {
		t.Fatal("expected HasWAAccessToken to preserve token presence")
	}
}
