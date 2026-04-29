package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port             string
	DatabaseURL      string // PostgreSQL connection string (main app DB)
	WASessionsDBPath string // SQLite path for whatsmeow sessions only
	APIKey           string
	OwnerPhone       string
	ServerURL        string
	MasterAPIKey     string
	GeminiAPIKey     string
	GinMode          string // "debug" | "release"
	FrontendURL      string
	R2AccountID      string
	R2AccessKey      string
	R2SecretKey      string
	R2Bucket            string
	ResendAPIKey        string
	ResendFromEmail     string // Sender address shown in transactional emails (RESEND_FROM_EMAIL)
	WhatsAppOTPTemplate string // To bypass the 24-hour service window limit
}

// dangerousWeakDefaults lists known unsafe placeholder values that must never
// reach a production environment. If any of these are found in a critical env
// var, the process exits immediately.
var dangerousWeakDefaults = map[string]bool{
	"your-very-long-random-secret-here":     true,
	"master_secret_2024":                    true,
	"super-secret-key-change-in-production": true,
	"demo_api_key_123":                      true,
	"":                                      true,
}

func Load() *Config {
	godotenv.Load()

	cfg := &Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		WASessionsDBPath: getEnv("WA_SESSIONS_DB_PATH", "whatsapp_sessions.db"),
		APIKey:           os.Getenv("API_KEY"),
		OwnerPhone:       getEnv("OWNER_PHONE", "+94771234567"),
		ServerURL:        getEnv("SERVER_URL", "http://localhost:8080"),
		MasterAPIKey:     os.Getenv("MASTER_API_KEY"),
		GeminiAPIKey:     os.Getenv("GEMINI_API_KEY"),
		GinMode:          getEnv("GIN_MODE", "debug"),
		FrontendURL:      getEnv("FRONTEND_URL", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"),
		R2AccountID:      os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKey:      os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretKey:         os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:            os.Getenv("R2_BUCKET_NAME"),
		ResendAPIKey:        os.Getenv("RESEND_API_KEY"),
		ResendFromEmail:     getEnv("RESEND_FROM_EMAIL", "SalesPilot <onboarding@resend.dev>"),
		WhatsAppOTPTemplate: getEnv("WHATSAPP_OTP_TEMPLATE", "salespilot_otp"),
	}

	// ── Critical key validation — crash fast, not silently ────────────────────
	if cfg.DatabaseURL == "" {
		log.Fatal("❌ FATAL: DATABASE_URL is not set. Set a PostgreSQL connection string in your .env file.")
	}
	if cfg.GeminiAPIKey == "" {
		log.Fatal("❌ FATAL: GEMINI_API_KEY is not set. The bot cannot function without it.")
	}
	if dangerousWeakDefaults[cfg.MasterAPIKey] {
		log.Fatal("❌ FATAL: MASTER_API_KEY is missing or using a known unsafe placeholder. Set a long random secret.")
	}
	if len(cfg.MasterAPIKey) < 32 {
		log.Fatal("❌ FATAL: MASTER_API_KEY is too short (minimum 32 characters required).")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
