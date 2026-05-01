package whatsapp

// intent_scorer.go — 3-tier weighted intent scoring for Sinhala/Singlish purchase detection.
//
// Replaces the brittle multi-word keyword list in detectOrderIntent() with a
// scored, fuzzy-matching system that handles:
//   - Vowel dropping: "gnn" → "ganna", "oni" → "onna"
//   - Sinhala Unicode: "ගන්න" → matched directly
//   - Hybrid messages: "meka order karanna one"
//   - False-positive suppression: tracking/status queries score 0
//
// Tier structure:
//   Tier 1 (Strong   +3): Unambiguous purchase verbs
//   Tier 2 (Medium   +2): Singlish possession/desire expressions
//   Tier 3 (Context  +1): Supporting context signals (size, price, delivery)
//
// Confidence gates:
//   score >= 3  → "high"   (trigger order flow)
//   score >= 2  → "medium" (pre-purchase inquiry, ask if they want to order)
//   score <  2  → ""       (no order intent detected)

import (
	"strings"

	"github.com/adrg/strutil"
	"github.com/adrg/strutil/metrics"
)

// ─── Result Type ──────────────────────────────────────────────────────────────

// IntentResult holds the weighted score and confidence tier for a message.
type IntentResult struct {
	Score      int    // raw weighted score
	Confidence string // "high", "medium", or ""
}

// ─── Signal Banks ─────────────────────────────────────────────────────────────

// Tier 1: Strong purchase verbs — unambiguous buy/order intent (+3 each)
// A single Tier 1 match = "high" confidence on its own.
var tier1Strong = []string{
	// English
	"want to buy", "want to order", "place order", "place an order",
	"add to cart", "i want to purchase", "i need to buy",
	"i'd like to order", "i would like to order",
	// Singlish — core buy verbs
	"ganna", "gannakola", "ganna ona", "ganna one",
	"meka ona", "meka one",		// "want this" — unambiguous purchase shorthand
	"mata ona", "mata one",		// "I want" — equally unambiguous
	"order karanna", "order denna", "order ekak",
	"ewwanna", "ewwanawa",		// "send me" / "give me"
	"katta ganna", "kenna",		// "to buy" forms
	"danna ona", "danna one",	// "want to give/take"
	"buy karanna", "buy karanawa",
	// Sinhala Unicode — direct script matches
	"ගන්න", "ගන්නකොල", "ගන්නවා",
	"ඕඩර්", "ඕනෑ",
}

// Tier 2: Medium desire/possession expressions (+2 each)
// Combined with Tier 3 context signals, these reach "high".
var tier2Medium = []string{
	// Singlish desire expressions
	"ona", "one",       // "want/need" suffix
	"eka onna", "eka one",
	"ekak onna", "ekak one",
	"mata eka", "mata meka",
	"meka eka", "meke",
	// "Can I get" / "is it possible"
	"puluwanda", "ganna puluwanda",
	"labaganna", "labaganna puluwanda",
	// Sinhala Unicode medium
	"ඕන", "ඕනෑ",
}

// Tier 3: Context signals (+1 each) — only accumulate AFTER Tier1/2 fires.
// Delivery/shipping excluded: they appear in FAQ questions, not just purchase messages.
var tier3Context = []string{
	"size", "size l", "size m", "size s", "size xl",
	"price", "how much", "kiyada", "kiyadha",
	"stock", "thiyenawada", "thiyanawa",
	"in stock", "available",
}

// negatives: if any of these match, score → 0 (tracking/status queries)
var intentNegatives = []string{
	"my order", "order status", "track order", "cancel order",
	"where is my order", "order confirmation", "order not received",
	"mage order", "order eka koheda", "order cancel", "order track",
	"return policy", "refund", "complaint",
}

// fuzzyTargets are the canonical forms used for Jaro-Winkler fuzzy matching.
// These cover the most commonly vowel-dropped or typo'd Singlish buy words.
var fuzzyTargets = []string{
	"ganna", "onna", "one", "ekak", "order", "kenna",
	"ewwanna", "labaganna", "puluwanda",
}

// ─── Core Scorer ─────────────────────────────────────────────────────────────

// ScoreOrderIntent runs the 3-tier weighted intent analysis on a raw message.
// It checks both the original and normalized forms to catch Sinhala Unicode.
func ScoreOrderIntent(msg string) IntentResult {
	lower := strings.ToLower(strings.TrimSpace(msg))
	normalized := strings.ToLower(NormalizeMessage(msg))
	jw := metrics.NewJaroWinkler()

	// ── Negative filter: tracking/status queries score 0 ─────────────────────
	for _, neg := range intentNegatives {
		if strings.Contains(lower, neg) || strings.Contains(normalized, neg) {
			return IntentResult{Score: 0, Confidence: ""}
		}
	}

	score := 0

	// ── Tier 1: Strong signals (+3) ───────────────────────────────────────────
	for _, kw := range tier1Strong {
		if strings.Contains(lower, kw) || strings.Contains(normalized, kw) {
			score += 3
			break // one strong hit is enough; avoid double-counting same message
		}
	}

	// ── Tier 2: Medium signals (+2) ───────────────────────────────────────────
	if score == 0 { // only evaluate if Tier 1 didn't fire (prevents over-scoring)
		for _, kw := range tier2Medium {
			if strings.Contains(lower, kw) || strings.Contains(normalized, kw) {
				score += 2
				break
			}
		}
	}

	// ── Tier 3: Context signals (+1 each) — only if Tier 1 or 2 already fired ───
	// Alone, these words appear in FAQ questions ("what is the delivery charge?").
	// They're only meaningful as purchase-intent signals alongside a buy verb.
	if score > 0 {
		for _, kw := range tier3Context {
			if strings.Contains(lower, kw) || strings.Contains(normalized, kw) {
				score++
			}
		}
	}

	// ── Fuzzy matching: Jaro-Winkler >= 0.82 on individual words ─────────────
	// Catches vowel-dropping variants ("gnn" → "ganna", "oni" → "onna")
	if score == 0 {
		words := strings.Fields(normalized)
		for _, word := range words {
			if len(word) < 2 {
				continue
			}
			for _, target := range fuzzyTargets {
				sim := strutil.Similarity(word, target, jw)
				if sim >= 0.82 {
					score++ // fuzzy hit adds 1 — requires supporting signals for "high"
					break
				}
			}
		}
	}

	return IntentResult{
		Score:      score,
		Confidence: confidenceFromScore(score),
	}
}

// confidenceFromScore maps a raw score to a confidence tier string.
func confidenceFromScore(score int) string {
	switch {
	case score >= 3:
		return "high"
	case score >= 2:
		return "medium"
	default:
		return ""
	}
}
