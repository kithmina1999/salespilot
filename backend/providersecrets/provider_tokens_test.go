package providersecrets

import (
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

const testKeyring = "test-key:MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="

func TestEncryptDecryptProviderToken(t *testing.T) {
	t.Setenv(ProviderTokenEnvVar, testKeyring)

	encrypted, err := EncryptProviderToken("EAA_test_token")
	if err != nil {
		t.Fatalf("EncryptProviderToken returned error: %v", err)
	}
	if !IsEncryptedProviderToken(encrypted) {
		t.Fatalf("expected encrypted provider token prefix, got %q", encrypted)
	}
	if strings.Contains(encrypted, "EAA_test_token") {
		t.Fatalf("encrypted provider token contains plaintext")
	}

	decrypted, err := DecryptProviderToken(encrypted)
	if err != nil {
		t.Fatalf("DecryptProviderToken returned error: %v", err)
	}
	if decrypted != "EAA_test_token" {
		t.Fatalf("decrypted token = %q, want original", decrypted)
	}
}

func TestDecryptProviderTokenAllowsLegacyPlaintext(t *testing.T) {
	decrypted, err := DecryptProviderToken("legacy-token")
	if err != nil {
		t.Fatalf("DecryptProviderToken returned error: %v", err)
	}
	if decrypted != "legacy-token" {
		t.Fatalf("decrypted token = %q, want legacy-token", decrypted)
	}
}

func TestBackfillBusinessWAAccessTokensEncryptsPlaintext(t *testing.T) {
	t.Setenv(ProviderTokenEnvVar, testKeyring)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Business{}); err != nil {
		t.Fatalf("migrate business: %v", err)
	}
	business := models.Business{Name: "Backfill Test", Phone: "+94770000001", APIKey: "api", WAAccessToken: "EAA_plain"}
	if err := db.Create(&business).Error; err != nil {
		t.Fatalf("create business: %v", err)
	}

	count, err := BackfillBusinessWAAccessTokens(db)
	if err != nil {
		t.Fatalf("BackfillBusinessWAAccessTokens returned error: %v", err)
	}
	if count != 1 {
		t.Fatalf("encrypted count = %d, want 1", count)
	}

	var updated models.Business
	if err := db.First(&updated, business.ID).Error; err != nil {
		t.Fatalf("load business: %v", err)
	}
	if !IsEncryptedProviderToken(updated.WAAccessToken) {
		t.Fatalf("WAAccessToken was not encrypted: %q", updated.WAAccessToken)
	}
	decrypted, err := DecryptProviderToken(updated.WAAccessToken)
	if err != nil {
		t.Fatalf("decrypt updated token: %v", err)
	}
	if decrypted != "EAA_plain" {
		t.Fatalf("decrypted token = %q, want EAA_plain", decrypted)
	}
}

func TestBackfillBusinessWAAccessTokensRequiresKeyForPlaintext(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Business{}); err != nil {
		t.Fatalf("migrate business: %v", err)
	}
	business := models.Business{Name: "Backfill Test", Phone: "+94770000002", APIKey: "api", WAAccessToken: "EAA_plain"}
	if err := db.Create(&business).Error; err != nil {
		t.Fatalf("create business: %v", err)
	}

	if _, err := BackfillBusinessWAAccessTokens(db); err == nil {
		t.Fatal("expected missing key error")
	}
}
