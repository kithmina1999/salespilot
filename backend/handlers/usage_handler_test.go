package handlers

import (
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/platform"
	"gorm.io/gorm"
)

func setupUsageCatalog(t *testing.T) {
	t.Helper()
	previousDB := database.DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:usage_catalog_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.PlatformBillingSettings{}, &models.SubscriptionPlan{}); err != nil {
		t.Fatalf("migrate billing catalog: %v", err)
	}
	if err := platform.EnsureBillingDefaults(db); err != nil {
		t.Fatalf("seed billing catalog: %v", err)
	}
	database.DB = db
	t.Cleanup(func() {
		database.DB = previousDB
	})
}

func TestGetUsageEntitlementsPaidPlanOverridesActiveTrial(t *testing.T) {
	setupUsageCatalog(t)
	now := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	trialExpiresAt := now.Add(48 * time.Hour)

	tests := []struct {
		name        string
		plan        string
		wantAI      int
		wantProduct int
		wantStorage int64
		wantVision  bool
	}{
		{
			name:        "starter uses starter limits while trial timestamp remains",
			plan:        models.PlanStarter,
			wantAI:      models.StarterAILimit,
			wantProduct: 100,
			wantStorage: 100 * 1024 * 1024,
		},
		{
			name:        "pro uses pro limits while trial timestamp remains",
			plan:        models.PlanPro,
			wantAI:      models.ProAILimit,
			wantProduct: -1,
			wantStorage: 500 * 1024 * 1024,
			wantVision:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ent, err := GetUsageEntitlements(models.Business{
				Plan:           tt.plan,
				TrialExpiresAt: &trialExpiresAt,
			}, now)
			if err != nil {
				t.Fatalf("GetUsageEntitlements: %v", err)
			}

			if ent.ActiveTrial {
				t.Fatalf("paid plan should not be reported as active trial")
			}
			if ent.MaxAIMessages != tt.wantAI {
				t.Fatalf("MaxAIMessages = %d, want %d", ent.MaxAIMessages, tt.wantAI)
			}
			if ent.MaxProducts != tt.wantProduct {
				t.Fatalf("MaxProducts = %d, want %d", ent.MaxProducts, tt.wantProduct)
			}
			if ent.MaxStorageBytes != tt.wantStorage {
				t.Fatalf("MaxStorageBytes = %d, want %d", ent.MaxStorageBytes, tt.wantStorage)
			}
			if ent.CanUseGeminiVision != tt.wantVision {
				t.Fatalf("CanUseGeminiVision = %v, want %v", ent.CanUseGeminiVision, tt.wantVision)
			}
		})
	}
}

func TestGetUsageEntitlementsFreeTrialUsesTrialLimits(t *testing.T) {
	setupUsageCatalog(t)
	now := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	trialExpiresAt := now.Add(48 * time.Hour)

	ent, err := GetUsageEntitlements(models.Business{
		Plan:           models.PlanFree,
		TrialExpiresAt: &trialExpiresAt,
	}, now)
	if err != nil {
		t.Fatalf("GetUsageEntitlements: %v", err)
	}

	if !ent.ActiveTrial {
		t.Fatalf("free plan with future trial expiry should be reported as active trial")
	}
	if ent.MaxAIMessages != models.TrialAILimit {
		t.Fatalf("MaxAIMessages = %d, want %d", ent.MaxAIMessages, models.TrialAILimit)
	}
	if ent.MaxProducts != 50 {
		t.Fatalf("MaxProducts = %d, want %d", ent.MaxProducts, 50)
	}
	if ent.MaxStorageBytes != 10*1024*1024 {
		t.Fatalf("MaxStorageBytes = %d, want 10MB", ent.MaxStorageBytes)
	}
	if !ent.CanUploadCloudinary {
		t.Fatalf("free trial should allow cloudinary uploads")
	}
}

func TestGetUsageEntitlementsExpiredPaidPlanFallsBackToFreeLimits(t *testing.T) {
	setupUsageCatalog(t)
	now := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	expiredAt := now.Add(-time.Minute)

	ent, err := GetUsageEntitlements(models.Business{
		Plan:          models.PlanPro,
		PlanExpiresAt: &expiredAt,
	}, now)
	if err != nil {
		t.Fatalf("GetUsageEntitlements: %v", err)
	}

	if ent.ActiveTrial {
		t.Fatalf("expired paid plan should not be treated as active trial")
	}
	if ent.MaxAIMessages != models.FreeAILimit {
		t.Fatalf("MaxAIMessages = %d, want free limit %d", ent.MaxAIMessages, models.FreeAILimit)
	}
	if ent.MaxProducts != models.FreeProductLimit {
		t.Fatalf("MaxProducts = %d, want free limit %d", ent.MaxProducts, models.FreeProductLimit)
	}
	if ent.CanUploadCloudinary {
		t.Fatalf("expired paid plan should not keep paid upload access")
	}
}
