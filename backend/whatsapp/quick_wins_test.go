package whatsapp

// quick_wins_test.go — TDD for S7: Gibberish Hardening + add_more Intent Escalation
//
// Part A: isLikelyGibberish hardening
//   The existing vowel-check misses:
//   - Single-char repeated spam: "aaaaaaa", "kkkkkkk"
//   - Pure digits that aren't addresses: "12345678"
//   - High consonant-to-vowel ratio: "strngth", "brzzzk"
//
// Part B: add_more intent escalation
//   resolveAddMoreIntent should detect purchase-intent messages in add_more state
//   and return a routing signal so the caller can invoke the order flow.

import "testing"

// ─── Part A: Gibberish Hardening ─────────────────────────────────────────────

func TestGibberish_NoVowels_IsGibberish(t *testing.T) {
	// Already handled by existing code — regression test
	cases := []string{"dfgzsfr", "brthmqz", "strngths"}
	for _, c := range cases {
		if !isLikelyGibberish(c) {
			t.Errorf("expected %q to be gibberish (no vowels)", c)
		}
	}
}

func TestGibberish_SingleCharRepeated_IsGibberish(t *testing.T) {
	// "aaaaaaa" — spam key-hold, same char repeated >= 5 times
	cases := []string{"aaaaaaa", "kkkkkk", "1111111", "!!!!!!!"}
	for _, c := range cases {
		if !isLikelyGibberish(c) {
			t.Errorf("expected %q to be gibberish (single char repeated)", c)
		}
	}
}

func TestGibberish_HighConsonantDensity_IsGibberish(t *testing.T) {
	// More than 4 consecutive consonants in a short word → gibberish
	cases := []string{"brzzzkl", "strthpq"}
	for _, c := range cases {
		if !isLikelyGibberish(c) {
			t.Errorf("expected %q to be gibberish (high consonant density)", c)
		}
	}
}

func TestGibberish_ValidWords_NotGibberish(t *testing.T) {
	// Real words and Singlish must never be flagged
	cases := []string{
		"hello", "ganna", "koheda", "price", "delivery",
		"ok", "hi", "yes", "one", "ekak",
		"order", "a",
	}
	for _, c := range cases {
		if isLikelyGibberish(c) {
			t.Errorf("expected %q to NOT be gibberish", c)
		}
	}
}

func TestGibberish_SinhalaRomanized_NotGibberish(t *testing.T) {
	// NormalizeMessage converts Sinhala → romanized — must not be flagged
	cases := []string{"kohomada", "mata", "meka", "thiyenawa", "puluwanda"}
	for _, c := range cases {
		if isLikelyGibberish(c) {
			t.Errorf("expected Singlish %q to NOT be gibberish", c)
		}
	}
}

func TestGibberish_ShortInput_NotGibberish(t *testing.T) {
	// Short inputs (≤2 chars) should never be flagged — handled by Context Bridge rules
	cases := []string{"a", "ok", "hi", "1", "no"}
	for _, c := range cases {
		if isLikelyGibberish(c) {
			t.Errorf("short input %q should NOT be flagged as gibberish", c)
		}
	}
}

// ─── Part B: add_more Intent Escalation ──────────────────────────────────────

func TestAddMore_PurchaseIntent_EscalatesOrderBot(t *testing.T) {
	// When in add_more state and customer sends a new buy-intent message,
	// resolveAddMoreIntent should return true (escalate to order flow)
	purchaseMessages := []string{
		"mata meka ganna one",
		"order karanna one",
		"i want to buy this",
		"meka ekak ewwanna",
	}
	for _, msg := range purchaseMessages {
		if !resolveAddMoreIntent(msg) {
			t.Errorf("purchase message %q should escalate out of add_more state", msg)
		}
	}
}

func TestAddMore_BrowseIntent_DoesNotEscalate(t *testing.T) {
	// Browse signals should NOT escalate to order flow — stay in add_more
	browseMessages := []string{
		"browse_more",
		"checkout",
		"what else do you have",
	}
	for _, msg := range browseMessages {
		if resolveAddMoreIntent(msg) {
			t.Errorf("browse/button message %q should NOT escalate out of add_more", msg)
		}
	}
}

func TestAddMore_GeneralChat_DoesNotEscalate(t *testing.T) {
	// General chat should not trigger escalation
	generalMessages := []string{
		"hi", "ok", "thanks", "how are you",
	}
	for _, msg := range generalMessages {
		if resolveAddMoreIntent(msg) {
			t.Errorf("general message %q should NOT escalate from add_more", msg)
		}
	}
}
