package handlers

import (
	"testing"
	"time"

	"github.com/kithmina1999/salespilot/models"
)

func TestGetBillingTimeRemainingUsesHoursAndMinutesBeforeExpiry(t *testing.T) {
	now := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(90 * time.Minute)

	remaining := getBillingTimeRemaining(models.Business{
		Plan:          models.PlanStarter,
		PlanExpiresAt: &expiresAt,
	}, now)

	if remaining.Status != "paid_active" {
		t.Fatalf("Status = %q, want paid_active", remaining.Status)
	}
	if remaining.EffectivePlan != models.PlanStarter {
		t.Fatalf("EffectivePlan = %q, want starter", remaining.EffectivePlan)
	}
	if remaining.Days != 0 || remaining.Hours != 1 || remaining.Minutes != 30 {
		t.Fatalf("remaining = %dd %dh %dm, want 0d 1h 30m", remaining.Days, remaining.Hours, remaining.Minutes)
	}
}

func TestGetBillingTimeRemainingExpiredPaidPlanFallsBackToFree(t *testing.T) {
	now := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(-time.Minute)

	remaining := getBillingTimeRemaining(models.Business{
		Plan:          models.PlanPro,
		PlanExpiresAt: &expiresAt,
	}, now)

	if remaining.Status != "expired_to_free" {
		t.Fatalf("Status = %q, want expired_to_free", remaining.Status)
	}
	if remaining.EffectivePlan != models.PlanFree {
		t.Fatalf("EffectivePlan = %q, want free", remaining.EffectivePlan)
	}
	if remaining.TotalSeconds != 0 {
		t.Fatalf("TotalSeconds = %d, want 0", remaining.TotalSeconds)
	}
}

func TestGetBillingTimeRemainingExpiredTrialFallsBackToFree(t *testing.T) {
	now := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(-time.Minute)

	remaining := getBillingTimeRemaining(models.Business{
		Plan:           models.PlanFree,
		TrialExpiresAt: &expiresAt,
	}, now)

	if remaining.Status != "free" {
		t.Fatalf("Status = %q, want free", remaining.Status)
	}
	if remaining.ActiveTrial {
		t.Fatalf("expired trial should not be active")
	}
	if remaining.EffectivePlan != models.PlanFree {
		t.Fatalf("EffectivePlan = %q, want free", remaining.EffectivePlan)
	}
}
