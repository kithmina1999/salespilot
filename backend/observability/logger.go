package observability

import (
	"context"
	"io"
	"log"
	"log/slog"
	"os"
	"regexp"
	"strings"
)

type contextKey string

const requestIDKey contextKey = "request_id"

var sensitiveKeys = map[string]struct{}{
	"access_token":  {},
	"api_key":       {},
	"authorization": {},
	"cookie":        {},
	"jwt":           {},
	"otp":           {},
	"password":      {},
	"secret":        {},
	"token":         {},
}

var legacyRedactions = []struct {
	pattern     *regexp.Regexp
	replacement string
}{
	{regexp.MustCompile(`(?i)Bearer\s+[A-Za-z0-9._~+/=-]+`), "Bearer [REDACTED]"},
	{regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{20,}\b`), "[REDACTED_GEMINI_KEY]"},
	{regexp.MustCompile(`\bEAA[0-9A-Za-z_-]{20,}\b`), "[REDACTED_META_TOKEN]"},
	{regexp.MustCompile(`\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b`), "[REDACTED_JWT]"},
	{regexp.MustCompile(`(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b`), "[REDACTED_EMAIL]"},
	{regexp.MustCompile(`\+?[0-9][0-9 -]{7,}[0-9]`), "[REDACTED_PHONE]"},
}

type Config struct {
	Service     string
	Environment string
	Release     string
	Format      string
	Level       string
	Output      io.Writer
}

func ConfigureFromEnv(service string) *slog.Logger {
	format := firstNonEmpty(os.Getenv("LOG_FORMAT"), defaultLogFormat(os.Getenv("GIN_MODE")))
	cfg := Config{
		Service:     service,
		Environment: firstNonEmpty(os.Getenv("APP_ENV"), os.Getenv("SENTRY_ENVIRONMENT"), os.Getenv("GIN_MODE"), "development"),
		Release:     firstNonEmpty(os.Getenv("APP_RELEASE"), os.Getenv("SENTRY_RELEASE"), os.Getenv("IMAGE_TAG"), "unknown"),
		Format:      format,
		Level:       firstNonEmpty(os.Getenv("LOG_LEVEL"), "info"),
		Output:      os.Stdout,
	}

	logger := NewLogger(cfg)
	slog.SetDefault(logger)
	log.SetFlags(0)
	log.SetOutput(legacyWriter{logger: logger})
	return logger
}

func NewLogger(cfg Config) *slog.Logger {
	if cfg.Output == nil {
		cfg.Output = os.Stdout
	}

	options := &slog.HandlerOptions{
		Level:       parseLevel(cfg.Level),
		ReplaceAttr: redactSensitiveAttr,
	}

	var handler slog.Handler
	if strings.EqualFold(cfg.Format, "text") {
		handler = slog.NewTextHandler(cfg.Output, options)
	} else {
		handler = slog.NewJSONHandler(cfg.Output, options)
	}

	return slog.New(handler).With(
		"service", firstNonEmpty(cfg.Service, "salespilot-backend"),
		"environment", firstNonEmpty(cfg.Environment, "development"),
		"release", firstNonEmpty(cfg.Release, "unknown"),
	)
}

func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

func RequestID(ctx context.Context) string {
	requestID, _ := ctx.Value(requestIDKey).(string)
	return requestID
}

func Logger(ctx context.Context) *slog.Logger {
	logger := slog.Default()
	if requestID := RequestID(ctx); requestID != "" {
		logger = logger.With("request_id", requestID)
	}
	return logger
}

func redactSensitiveAttr(_ []string, attr slog.Attr) slog.Attr {
	if _, sensitive := sensitiveKeys[strings.ToLower(attr.Key)]; sensitive {
		attr.Value = slog.StringValue("[REDACTED]")
	}
	return attr
}

func parseLevel(raw string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func defaultLogFormat(ginMode string) string {
	if strings.EqualFold(ginMode, "release") {
		return "json"
	}
	return "text"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}

type legacyWriter struct {
	logger *slog.Logger
}

func (w legacyWriter) Write(p []byte) (int, error) {
	message := sanitizeLegacyMessage(strings.TrimSpace(string(p)))
	if message != "" {
		w.logger.Log(context.Background(), legacyLevel(message), message, "legacy_log", true)
	}
	return len(p), nil
}

func sanitizeLegacyMessage(message string) string {
	for _, redaction := range legacyRedactions {
		message = redaction.pattern.ReplaceAllString(message, redaction.replacement)
	}
	return message
}

func legacyLevel(message string) slog.Level {
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "fatal"), strings.Contains(lower, "panic"), strings.Contains(lower, "failed"), strings.Contains(lower, "error"), strings.Contains(message, "❌"):
		return slog.LevelError
	case strings.Contains(lower, "warn"), strings.Contains(lower, "retry"), strings.Contains(message, "⚠"):
		return slog.LevelWarn
	default:
		return slog.LevelInfo
	}
}
