package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// ── Discord Alerting ──────────────────────────────────────────────────────────

// AlertLevel controls the embed colour in Discord.
type AlertLevel string

const (
	AlertCritical AlertLevel = "critical" // red  — service broken, needs immediate action
	AlertWarning  AlertLevel = "warning"  // amber — degraded, monitor closely
	AlertInfo     AlertLevel = "info"     // blue  — informational, no action needed
)

// SendDiscordAlert posts a rich embed to the appropriate Discord channel based on severity.
// Critical → DISCORD_CRITICAL_ISSUES_WEBHOOK_URL  (#critical-issues)
// Warning/Info → DISCORD_GENERAL_ISSUES_WEBHOOK_URL  (#general-issues)
// If the relevant URL is unset the call is silently skipped.
func SendDiscordAlert(level AlertLevel, title, message string) {
	webhookURL := discordWebhookURL(level)
	if webhookURL == "" {
		return
	}

	payload := map[string]interface{}{
		"embeds": []map[string]interface{}{
			{
				"title":       fmt.Sprintf("%s %s", levelEmoji(level), title),
				"description": message,
				"color":       discordColor(level),
				"footer": map[string]string{
					"text": "SalesPilot Alerting · " + time.Now().UTC().Format("2006-01-02 15:04:05 UTC"),
				},
			},
		},
	}

	b, err := json.Marshal(payload)
	if err != nil {
		log.Printf("⚠️  [Alert] Failed to marshal Discord payload: %v", err)
		return
	}

	resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(b))
	if err != nil {
		log.Printf("⚠️  [Alert] Discord webhook call failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("⚠️  [Alert] Discord returned non-2xx status: %d", resp.StatusCode)
	}
}

// discordWebhookURL returns the correct channel URL for the given severity level.
func discordWebhookURL(level AlertLevel) string {
	switch level {
	case AlertCritical:
		return os.Getenv("DISCORD_CRITICAL_ISSUES_WEBHOOK_URL")
	default: // AlertWarning, AlertInfo
		return os.Getenv("DISCORD_GENERAL_ISSUES_WEBHOOK_URL")
	}
}


// ── Convenience helpers ───────────────────────────────────────────────────────

// AlertGeminiFailure fires a critical alert when the Gemini API call fails for a tenant.
func AlertGeminiFailure(businessName string, err error) {
	SendDiscordAlert(AlertCritical,
		"Gemini API Failure",
		fmt.Sprintf("**Business:** %s\n**Error:** `%v`\n\nCustomers are receiving fallback replies. Check GEMINI_API_KEY and quota.", businessName, err),
	)
}

// AlertMetaTokenExpired fires a critical alert when a tenant's Meta access token is detected as expired.
func AlertMetaTokenExpired(businessName, phoneNumberID string) {
	SendDiscordAlert(AlertCritical,
		"Meta Access Token Expired",
		fmt.Sprintf("**Business:** %s\n**Phone Number ID:** `%s`\n\nThe WhatsApp bot is silent for this tenant. The merchant must reconnect via Settings → WhatsApp.", businessName, phoneNumberID),
	)
}

// AlertWorkerPoolFull fires a warning when the webhook worker pool queue is saturated.
func AlertWorkerPoolFull() {
	SendDiscordAlert(AlertWarning,
		"Worker Pool Queue Full",
		"The webhook worker pool buffer (5000 jobs) is full. Incoming messages are being dropped.\n\nThis indicates an abnormal traffic spike or a processing bottleneck.",
	)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

func discordColor(level AlertLevel) int {
	switch level {
	case AlertCritical:
		return 0xED4245 // Discord red
	case AlertWarning:
		return 0xFEE75C // Discord yellow
	default:
		return 0x5865F2 // Discord blurple (info)
	}
}

func levelEmoji(level AlertLevel) string {
	switch level {
	case AlertCritical:
		return "🚨"
	case AlertWarning:
		return "⚠️"
	default:
		return "ℹ️"
	}
}
