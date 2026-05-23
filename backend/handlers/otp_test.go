package handlers

import (
	"regexp"
	"testing"
)

func TestGenerateSixDigitOTPFormat(t *testing.T) {
	code, err := generateSixDigitOTP()
	if err != nil {
		t.Fatalf("generateSixDigitOTP returned error: %v", err)
	}

	if !regexp.MustCompile(`^\d{6}$`).MatchString(code) {
		t.Fatalf("OTP = %q, want exactly six digits", code)
	}
}
