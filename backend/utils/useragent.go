package utils

import "strings"

// ParseUserAgent extracts device type, browser name, and OS from a raw
// User-Agent string. No external library needed — simple string matching
// covers the vast majority of real-world UAs.

type UAInfo struct {
	DeviceType string // desktop | mobile | tablet | unknown
	Browser    string // Chrome | Safari | Firefox | Edge | Opera | Unknown
	OS         string // Windows | macOS | Linux | iOS | Android | Unknown
}

func ParseUserAgent(ua string) UAInfo {
	lower := strings.ToLower(ua)
	info := UAInfo{DeviceType: "unknown", Browser: "Unknown", OS: "Unknown"}

	// ── OS detection ─────────────────────────────────────────────────────
	switch {
	case strings.Contains(lower, "iphone") || strings.Contains(lower, "ipod"):
		info.OS = "iOS"
	case strings.Contains(lower, "ipad"):
		info.OS = "iPadOS"
	case strings.Contains(lower, "android"):
		info.OS = "Android"
	case strings.Contains(lower, "macintosh") || strings.Contains(lower, "mac os"):
		info.OS = "macOS"
	case strings.Contains(lower, "windows"):
		info.OS = "Windows"
	case strings.Contains(lower, "linux"):
		info.OS = "Linux"
	case strings.Contains(lower, "cros"):
		info.OS = "ChromeOS"
	}

	// ── Device type ──────────────────────────────────────────────────────
	switch {
	case strings.Contains(lower, "ipad") || strings.Contains(lower, "tablet"):
		info.DeviceType = "tablet"
	case strings.Contains(lower, "mobile") || strings.Contains(lower, "iphone") ||
		(strings.Contains(lower, "android") && !strings.Contains(lower, "tablet")):
		info.DeviceType = "mobile"
	case info.OS == "Windows" || info.OS == "macOS" || info.OS == "Linux" || info.OS == "ChromeOS":
		info.DeviceType = "desktop"
	}

	// ── Browser (order matters — Edge/Opera use Chrome's engine) ─────────
	switch {
	case strings.Contains(lower, "edg/") || strings.Contains(lower, "edge/"):
		info.Browser = "Edge"
	case strings.Contains(lower, "opr/") || strings.Contains(lower, "opera"):
		info.Browser = "Opera"
	case strings.Contains(lower, "firefox/") || strings.Contains(lower, "fxios/"):
		info.Browser = "Firefox"
	case strings.Contains(lower, "crios/"):
		info.Browser = "Chrome"
	case strings.Contains(lower, "safari/") && !strings.Contains(lower, "chrome/"):
		info.Browser = "Safari"
	case strings.Contains(lower, "chrome/"):
		info.Browser = "Chrome"
	}

	return info
}
