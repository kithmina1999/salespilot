package whatsapp

import (
	"testing"
)

// ─── Tier 1: Strong purchase-intent signals ───────────────────────────────────

func TestIntentScorer_StrongSinglish_High(t *testing.T) {
	// "mata meka ganna one" — classic Singlish buy phrase
	result := ScoreOrderIntent("mata meka ganna one")
	if result.Confidence != "high" {
		t.Errorf("expected high confidence for 'mata meka ganna one', got %q (score=%d)", result.Confidence, result.Score)
	}
}

func TestIntentScorer_ShortenedGanna_High(t *testing.T) {
	// "meka ona" — shortened "ganna ona" (vowel dropping pattern)
	result := ScoreOrderIntent("meka ona")
	if result.Confidence != "high" {
		t.Errorf("expected high confidence for 'meka ona', got %q (score=%d)", result.Confidence, result.Score)
	}
}

func TestIntentScorer_OrderKaranna_High(t *testing.T) {
	result := ScoreOrderIntent("order karanna one")
	if result.Confidence != "high" {
		t.Errorf("expected high confidence for 'order karanna one', got %q (score=%d)", result.Confidence, result.Score)
	}
}

func TestIntentScorer_SinhalaUnicode_High(t *testing.T) {
	// Sinhala script "mata meka ganna one"
	result := ScoreOrderIntent("මට මේක ගන්න ඕන")
	if result.Confidence != "high" {
		t.Errorf("expected high confidence for Sinhala 'මට මේක ගන්න ඕන', got %q (score=%d)", result.Confidence, result.Score)
	}
}

func TestIntentScorer_WantToBuy_High(t *testing.T) {
	result := ScoreOrderIntent("i want to buy this")
	if result.Confidence != "high" {
		t.Errorf("expected high confidence for 'i want to buy this', got %q (score=%d)", result.Confidence, result.Score)
	}
}

// ─── Tier 2: Fuzzy matching (vowel dropping, typos) ──────────────────────────

func TestIntentScorer_FuzzyGanna_Detected(t *testing.T) {
	// "gnn" should fuzzy-match to "ganna" via Jaro-Winkler >= 0.80
	result := ScoreOrderIntent("meka gnn")
	if result.Score < 1 {
		t.Errorf("expected fuzzy match for 'gnn' to score >= 1, got %d", result.Score)
	}
}

func TestIntentScorer_FuzzyOnna_Detected(t *testing.T) {
	// "oni" should fuzzy-match to "onna" (want/need)
	result := ScoreOrderIntent("meka oni")
	if result.Score < 1 {
		t.Errorf("expected fuzzy match for 'oni' to score >= 1, got %d", result.Score)
	}
}

// ─── Tier 3: Context-only signals (no order intent) ──────────────────────────

func TestIntentScorer_DeliveryQuery_NotOrder(t *testing.T) {
	// "delivery charge kiyada" is a context-only signal, not a purchase
	result := ScoreOrderIntent("delivery charge kiyada")
	if result.Confidence == "high" {
		t.Errorf("delivery query should not be high confidence order intent, got %q", result.Confidence)
	}
}

func TestIntentScorer_ReturnPolicy_NoMatch(t *testing.T) {
	// FAQ question — must NOT trigger order intent
	result := ScoreOrderIntent("what is your return policy?")
	if result.Confidence == "high" {
		t.Errorf("return policy question must not be flagged as order intent")
	}
	if result.Score > 0 {
		t.Errorf("return policy question should score 0, got %d", result.Score)
	}
}

func TestIntentScorer_OrderStatus_NegativeFilter(t *testing.T) {
	// Tracking query — negative filter must suppress intent
	result := ScoreOrderIntent("where is my order?")
	if result.Confidence == "high" {
		t.Errorf("order status query must not trigger purchase intent")
	}
}

func TestIntentScorer_GeneralChat_NoMatch(t *testing.T) {
	inputs := []string{
		"hi",
		"hello",
		"how are you",
		"thanks",
		"ok",
	}
	for _, input := range inputs {
		result := ScoreOrderIntent(input)
		if result.Confidence == "high" {
			t.Errorf("general chat %q should not trigger order intent", input)
		}
	}
}

// ─── Medium confidence (browse/context intent) ───────────────────────────────

func TestIntentScorer_BrowseSignal_Medium(t *testing.T) {
	// "size L thiyenawada" — context signal only (checking availability)
	result := ScoreOrderIntent("size L thiyenawada")
	// Should be medium or lower — not high (they haven't committed to buy)
	if result.Confidence == "high" {
		t.Errorf("availability check should not be high confidence order intent")
	}
}

// ─── Hybrid Sinhala-English messages ─────────────────────────────────────────

func TestIntentScorer_HybridMessage_High(t *testing.T) {
	// "meka order karanna one" — mixed Singlish-English
	result := ScoreOrderIntent("meka order karanna one")
	if result.Confidence != "high" {
		t.Errorf("expected high confidence for hybrid 'meka order karanna one', got %q (score=%d)", result.Confidence, result.Score)
	}
}

func TestIntentScorer_MekaEkakEwwanna_High(t *testing.T) {
	// Singlish "meka ekak ewwanna" (send me one of these)
	result := ScoreOrderIntent("meka ekak ewwanna")
	if result.Confidence != "high" {
		t.Errorf("expected high confidence for 'meka ekak ewwanna', got %q (score=%d)", result.Confidence, result.Score)
	}
}

// ─── Backward compat: detectOrderIntent wrapper ───────────────────────────────

func TestIntentScorer_BackwardCompat_DetectOrderIntent(t *testing.T) {
	// The existing detectOrderIntent must still work as a bool wrapper
	trueCases := []string{
		"mata meka ganna one",
		"order karanna one",
		"i want to buy this",
		"meka ekak ewwanna",
	}
	for _, tc := range trueCases {
		if !detectOrderIntent(tc) {
			t.Errorf("detectOrderIntent(%q) should return true", tc)
		}
	}

	falseCases := []string{
		"where is my order?",
		"what is your return policy?",
		"delivery charge?",
	}
	for _, tc := range falseCases {
		if detectOrderIntent(tc) {
			t.Errorf("detectOrderIntent(%q) should return false", tc)
		}
	}
}
