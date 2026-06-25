package database

import (
	"os"
	"strings"
)

func startupAutoMigrateEnabled() bool {
	if raw := os.Getenv("DB_AUTO_MIGRATE"); raw != "" {
		return isTruthy(raw)
	}
	return !isProductionRuntime()
}

func isProductionRuntime() bool {
	return strings.EqualFold(os.Getenv("APP_ENV"), "production") ||
		strings.EqualFold(os.Getenv("GIN_MODE"), "release")
}

func isTruthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
