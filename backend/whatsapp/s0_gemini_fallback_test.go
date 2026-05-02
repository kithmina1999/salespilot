package whatsapp

// s0_gemini_fallback_test.go — TDD for S0: Gemini Failure Fallback Enhancement
//
// Acceptance criteria (from launch_readiness_plan.md S0):
//   - Gemini timeout WITH faqHint   → serves hint, NOT generic error
//   - Gemini timeout WITHOUT faqHint → serves generic error (existing behaviour)
//   - AlertGeminiFailure still fires in both cases (verified in callGemini, not here)
//
// Strategy: extract the "which reply on Gemini failure?" decision into
// geminiErrorReply(faqHint) — a pure function with zero side-effects.
// callGemini calls it instead of the hard-coded string. Tests are immune
// to HTTP/DB details and will survive any refactor of callGemini internals.

import "testing"

const genericGeminiError = "Sorry, I'm having trouble right now. Please try again!"

func TestGeminiErrorReply_WithFAQHint_ReturnsFAQHint(t *testing.T) {
	hint := "Our delivery takes 2–3 business days island-wide."
	got := geminiErrorReply(hint)
	if got != hint {
		t.Errorf("geminiErrorReply(%q) = %q, want the FAQ hint", hint, got)
	}
}

func TestGeminiErrorReply_EmptyHint_ReturnsGenericError(t *testing.T) {
	got := geminiErrorReply("")
	if got != genericGeminiError {
		t.Errorf("geminiErrorReply(\"\") = %q, want generic error message", got)
	}
}

func TestGeminiErrorReply_WhitespaceHint_ReturnsGenericError(t *testing.T) {
	// A hint that is only whitespace is useless — fall back to generic error
	got := geminiErrorReply("   ")
	if got != genericGeminiError {
		t.Errorf("geminiErrorReply(\"   \") = %q, want generic error message", got)
	}
}

func TestGeminiErrorReply_MultiLineHint_PreservedExactly(t *testing.T) {
	// Multi-line FAQ answers (e.g. with embedded newlines) must be sent as-is
	hint := "Delivery Areas:\n- Colombo: 1 day\n- Other: 2-3 days"
	got := geminiErrorReply(hint)
	if got != hint {
		t.Errorf("geminiErrorReply with multi-line hint: got %q, want %q", got, hint)
	}
}
