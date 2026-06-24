package observability

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"
)

func TestLoggerRedactsSensitiveAttributes(t *testing.T) {
	var output bytes.Buffer
	logger := NewLogger(Config{
		Service:     "test",
		Environment: "test",
		Release:     "test-release",
		Format:      "json",
		Level:       "debug",
		Output:      &output,
	})

	logger.Info("dependency request", "token", "secret-value", "business_id", 42)
	line := output.String()
	if strings.Contains(line, "secret-value") {
		t.Fatal("sensitive token was written to the log")
	}
	if !strings.Contains(line, `"token":"[REDACTED]"`) {
		t.Fatalf("expected redacted token attribute, got %s", line)
	}
	if !strings.Contains(line, `"business_id":42`) {
		t.Fatalf("expected safe structured field, got %s", line)
	}
}

func TestLoggerAddsRequestIDFromContext(t *testing.T) {
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(NewLogger(Config{Format: "json", Output: &output}))
	t.Cleanup(func() { slog.SetDefault(previous) })

	ctx := WithRequestID(context.Background(), "req-123")
	Logger(ctx).Info("handled")
	if !strings.Contains(output.String(), `"request_id":"req-123"`) {
		t.Fatalf("expected request_id in log, got %s", output.String())
	}
}

func TestDefaultLogFormat(t *testing.T) {
	if got := defaultLogFormat("release"); got != "json" {
		t.Fatalf("release format = %q, want json", got)
	}
	if got := defaultLogFormat("debug"); got != "text" {
		t.Fatalf("debug format = %q, want text", got)
	}
}

func TestLegacyLogSanitization(t *testing.T) {
	message := "send to owner@example.com phone +94771234567 Bearer secret-token"
	sanitized := sanitizeLegacyMessage(message)
	for _, secret := range []string{"owner@example.com", "+94771234567", "secret-token"} {
		if strings.Contains(sanitized, secret) {
			t.Fatalf("legacy message still contains %q: %s", secret, sanitized)
		}
	}
}

func TestLegacyLogLevel(t *testing.T) {
	if got := legacyLevel("dependency request failed"); got != slog.LevelError {
		t.Fatalf("failed log level=%s, want error", got)
	}
	if got := legacyLevel("warning: retrying"); got != slog.LevelWarn {
		t.Fatalf("warning log level=%s, want warn", got)
	}
}
