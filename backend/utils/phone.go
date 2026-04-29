package utils

import (
	"regexp"
)

// NormalizePhone aggressively cleans a phone number string:
// 1. Removes all non-digit characters (spaces, +, -, (), @lid, etc.)
// 2. Assumes leading 0 is a local Sri Lankan number and replaces it with 94
func NormalizePhone(phone string) string {
	// First extract just the core user ID if formatted as a WhatsApp JID (user:device@server)
	if parts := regexp.MustCompile(`@`).Split(phone, 2); len(parts) > 0 {
		phone = parts[0]
	}
	if parts := regexp.MustCompile(`:`).Split(phone, 2); len(parts) > 0 {
		phone = parts[0]
	}

	// Strip all remaining non-digits
	re := regexp.MustCompile(`\D`)
	digitsOnly := re.ReplaceAllString(phone, "")

	// Handle local Sri Lankan numbers (starts with 0, usually 10 digits)
	if len(digitsOnly) > 0 && digitsOnly[0] == '0' {
		return "94" + digitsOnly[1:]
	}

	return digitsOnly
}
