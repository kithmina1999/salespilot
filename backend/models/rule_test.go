package models

import "testing"

func TestGetExactResponseDoesNotFallbackToEnglish(t *testing.T) {
	rule := Rule{}
	rule.SetResponse("en", "hello")

	if got := rule.GetResponse("si"); got != "hello" {
		t.Fatalf("GetResponse fallback = %q, want English fallback", got)
	}
	if got := rule.GetExactResponse("si"); got != "" {
		t.Fatalf("GetExactResponse(si) = %q, want no fallback", got)
	}
}
