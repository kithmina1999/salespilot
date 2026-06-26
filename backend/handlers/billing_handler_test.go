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

func TestGetBillingTimeRemainingExpiredPaidPlanUsesGracePeriod(t *testing.T) {
	now := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(-time.Minute)

	remaining := getBillingTimeRemaining(models.Business{
		Plan:          models.PlanPro,
		PlanExpiresAt: &expiresAt,
	}, now)

	if remaining.Status != "paid_grace" {
		t.Fatalf("Status = %q, want paid_grace", remaining.Status)
	}
	if remaining.EffectivePlan != models.PlanPro {
		t.Fatalf("EffectivePlan = %q, want pro", remaining.EffectivePlan)
	}
	if remaining.TotalSeconds <= 0 {
		t.Fatalf("TotalSeconds = %d, want positive grace duration", remaining.TotalSeconds)
	}
	if remaining.Days != 2 || remaining.Hours != 23 {
		t.Fatalf("remaining = %dd %dh %dm, want 2d 23h remaining in grace", remaining.Days, remaining.Hours, remaining.Minutes)
	}
}

func TestGetBillingTimeRemainingExpiredPaidPlanFallsBackToFreeAfterGrace(t *testing.T) {
	now := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	expiresAt := now.Add(-(3*24*time.Hour + time.Minute))

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

func TestBillingFrontendURL(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "first allowed origin", raw: "https://app.example.com,https://admin.example.com", want: "https://app.example.com"},
		{name: "trims whitespace and slash", raw: "  https://app.example.com/ , https://admin.example.com", want: "https://app.example.com"},
		{name: "skips empty origin", raw: ", https://app.example.com", want: "https://app.example.com"},
		{name: "local fallback", raw: "", want: "http://localhost:3000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := billingFrontendURL(tt.raw); got != tt.want {
				t.Fatalf("billingFrontendURL(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}
