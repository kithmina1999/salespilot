package errorreporting

import (
	"testing"
	"time"
)

func TestSafeFieldsDropsUnknownAndSensitiveAttributes(t *testing.T) {
	fields := safeFields(map[string]any{
		"request_id": "req-1",
		"dependency": "gemini",
		"token":      "secret",
		"phone":      "+94770000000",
	})
	if fields["request_id"] != "req-1" || fields["dependency"] != "gemini" {
		t.Fatalf("safe fields missing: %#v", fields)
	}
	if _, exists := fields["token"]; exists {
		t.Fatal("token was included in error report")
	}
	if _, exists := fields["phone"]; exists {
		t.Fatal("phone was included in error report")
	}
}

func TestReporterSuppressesDuplicateFingerprintDuringCooldown(t *testing.T) {
	reporter := NewDiscordReporter(1)
	reporter.Close()
	now := time.Date(2026, 6, 21, 0, 0, 0, 0, time.UTC)
	if reporter.suppressed("same", now) {
		t.Fatal("first event was suppressed")
	}
	if !reporter.suppressed("same", now.Add(time.Minute)) {
		t.Fatal("duplicate event was not suppressed")
	}
	if reporter.suppressed("same", now.Add(6*time.Minute)) {
		t.Fatal("event remained suppressed after cooldown")
	}
}
