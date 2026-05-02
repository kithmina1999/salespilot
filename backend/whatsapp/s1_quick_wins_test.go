package whatsapp

// s1_quick_wins_test.go — TDD for S1: Bot Quick Wins
//
// 1A: Notes Filler Filter
//   "ok", "continue", "next" at pending_notes → saved as empty string
//
// 1B: Safe Abbreviation Allowlist
//   "nxt", "btw", "pls" must NOT be flagged by isLikelyGibberish
//
// 1C: Greeting Merge
//   First-of-day greeting prepends business.GreetingMessage when configured

import (
	"testing"
	"time"
)

// ─── 1B: Safe Abbreviation Allowlist ─────────────────────────────────────────
// Common Sri Lankan commerce abbreviations should never be silenced by the
// gibberish detector.

func TestGibberish_SafeAbbreviations_NotGibberish(t *testing.T) {
	// These vowel-free tokens are legitimate abbreviations used by customers
	// e.g. "pls send nxt week" or "qty 2 blk xl"
	cases := []string{
		"nxt", "btw", "pls", "plz",
		"thx", "tnx", "brb", "omw",
		"qty", "pcs", "lkr",
		"msg", "blk", "wht", "grn",
		"sm", "md", "lg", "xl", "xxl", "xs",
	}
	for _, c := range cases {
		if isLikelyGibberish(c) {
			t.Errorf("safe abbreviation %q should NOT be flagged as gibberish", c)
		}
	}
}

func TestGibberish_AbbreviationsInSentence_NotGibberish(t *testing.T) {
	// Abbreviations in context — entire message should pass through
	cases := []string{
		"pls send nxt week",
		"qty 2 blk xl",
		"thx for the info",
		"omw now",
	}
	for _, c := range cases {
		if isLikelyGibberish(c) {
			t.Errorf("message with abbreviation %q should NOT be flagged as gibberish", c)
		}
	}
}

// ─── 1A: Notes Filler Filter ──────────────────────────────────────────────────
// filterFillerNotes should return "" for filler words, and the original string
// for real notes.

func TestNotesFilter_FillerWords_ReturnEmpty(t *testing.T) {
	fillers := []string{
		"ok", "okay", "k", "continue",
		"next", "yes", "yep", "sure",
		"no", "nope", "none", "nothing",
		"no notes", "nah", "na",
		// case-insensitive
		"OK", "Continue", "NEXT", "Sure",
	}
	for _, f := range fillers {
		got := filterFillerNotes(f)
		if got != "" {
			t.Errorf("filterFillerNotes(%q) = %q, want empty string", f, got)
		}
	}
}

func TestNotesFilter_RealNotes_Preserved(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"leave at gate", "leave at gate"},
		{"no bell", "no bell"},                         // "no" alone = filler, but "no bell" = real note
		{"handle with care", "handle with care"},
		{"call before delivery", "call before delivery"},
		{"landmark: near the mosque", "landmark: near the mosque"},
		{"  extra space  ", "extra space"}, // TrimSpace applied
	}
	for _, tc := range cases {
		got := filterFillerNotes(tc.input)
		if got != tc.expected {
			t.Errorf("filterFillerNotes(%q) = %q, want %q", tc.input, got, tc.expected)
		}
	}
}

// ─── 1C: Greeting Merge ───────────────────────────────────────────────────────
// When business.GreetingMessage is set, the first-of-day greeting should be
// prepended with the merchant's message.

func TestGreetingMerge_WithGreetingMessage_Prepended(t *testing.T) {
	// buildMergedGreeting(merchantMsg, timeGreeting) should produce:
	// "<merchantMsg>\n\n<timeGreeting>"
	merchant := "Welcome to Aura Clothing! 👗"
	timeGreeting := buildGreeting("en", "Kasun", time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC))

	got := buildMergedGreeting(merchant, timeGreeting)

	if got != merchant+"\n\n"+timeGreeting {
		t.Errorf("buildMergedGreeting produced wrong output:\ngot:  %q\nwant: %q",
			got, merchant+"\n\n"+timeGreeting)
	}
}

func TestGreetingMerge_EmptyGreetingMessage_JustTimeGreeting(t *testing.T) {
	// When merchant greeting is empty, return the time-based greeting unchanged
	timeGreeting := buildGreeting("en", "Kasun", time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC))

	got := buildMergedGreeting("", timeGreeting)

	if got != timeGreeting {
		t.Errorf("buildMergedGreeting with empty merchant greeting should return time greeting unchanged:\ngot:  %q\nwant: %q",
			got, timeGreeting)
	}
}

func TestGreetingMerge_WhitespaceGreetingMessage_JustTimeGreeting(t *testing.T) {
	// Whitespace-only merchant greeting should behave like empty
	timeGreeting := buildGreeting("en", "", time.Date(2026, 1, 1, 14, 0, 0, 0, time.UTC))

	got := buildMergedGreeting("   ", timeGreeting)

	if got != timeGreeting {
		t.Errorf("buildMergedGreeting with whitespace merchant greeting should return time greeting unchanged:\ngot:  %q\nwant: %q",
			got, timeGreeting)
	}
}
