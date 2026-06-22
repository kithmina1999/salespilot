package whatsapp

// intent_classifier.go — Two-Tier Message Intent Classifier
//
// NormalizeMessage() is applied FIRST so Sinhala script and Singlish variants
// (e.g. "ගන්නවා" → "order", "ganna" → "order", "kiyada" → "price") become
// canonical English tokens before any matching occurs.
//
// Tier 1 (short ≤3 words): keyword matching — zero latency, no API call.
//                           Covers greetings, single-word queries, short commands.
// Tier 2 (long >3 words) : embed message → cosine similarity against cached
//                          category centroids — handles typos, Singlish,
//                          full Sinhala sentences, paraphrasing.
//
// Returns one of: "shopping" | "browse" | "general" | "escape"
//
// shopping → start/continue order flow
// browse   → show product list (customer explicitly wants to browse)
// general  → bypass cart, let FAQ+Gemini answer
// escape   → abandon cart, show main menu

import (
	"log"
	"strings"
	"sync"

	"github.com/kithmina1999/salespilot/database"
)

// ─── Anchor Phrases ─────────────────────────────────────────────────────────────
// Representative sentences per intent class.
// More diverse phrases → better centroid embedding.
// Their centroids are persisted and reused across server restarts.

var intentAnchorPhrases = map[string][]string{
	"shopping": {
		// English
		"I want to order a product",
		"I want to buy something",
		"place an order for me",
		"add this to my cart",
		"I would like to purchase this",
		"can I order this item please",
		"I want to get one of these",
		"how do I buy this",
		"I want to order one",
		"take my order",
		// Singlish (these are the post-normalize canonical forms)
		"mata eka ganna onna",
		"meka ganna kiyala hithuwe",
		"order ekak danna puluwanda",
		"buy karanna puluwanda",
		"ganne kohomada",
		"eka add karanna",
		// Sinhala script — embedding model handles natively
		"මට මේක ගන්න ඕනෑ",
		"ඕඩර් එකක් දාන්න ඕනෑ",
		"මේක ගන්නේ කොහොමද",
		"මේක buy කරන්නේ කොහොමද",
	},
	"browse": {
		// English
		"show me your products",
		"what products do you have available",
		"can I see the product list",
		"what items do you sell",
		"show me what is available",
		"I want to browse your catalog",
		"what else is available",
		"can I get a product list",
		"what do you have in stock",
		"show me everything you have",
		// Singlish
		"mokakda thiyanawa products",
		"monawada thiyanawa",
		"product list eka denna",
		"items thiyanawa mokakda",
		"mokakda sell karanawa",
		// Sinhala script
		"මොනවද තියෙන්නේ",
		"ඔයාලා මොනවද විකුණන්නේ",
		"මිල ලැයිස්තුව දෙන්න",
	},
	"general": {
		// English
		"tell me about this service",
		"what is salespilot",
		"how does this work",
		"I want to know about your company",
		"what are the benefits of using this",
		"hello how are you",
		"I need help with something",
		"explain how this works",
		"where are you located",
		"what is your return policy",
		"do you have a warranty",
		"how long does delivery take",
		"track my order status",
		"where is my order",
		"can I cancel my order",
		// Singlish
		"kohomada meka wadakaranawa",
		"mage order eka koheda",
		"delivery keeyak yanawa",
		"return policy mokakda",
		"warrant thiyanawada",
		// Sinhala script
		"මේක කොහොමද වැඩ කරන්නේ",
		"ඔයාලගේ return policy මොකද්ද",
		"delivery වලට කොච්චර දවස් යයිද",
		"මගේ ඕඩර් එක කොහේද",
		"ඕඩර් එක කවද්ද ඒන්නේ?",
	},
}

// ─── Cached Centroids ────────────────────────────────────────────────────────────

type anchorEntry struct {
	category  string
	embedding []float64
}

var (
	classifierMu    sync.RWMutex
	anchorEmbeds    []anchorEntry
	classifierReady bool
)

// InitIntentClassifier loads persisted centroids or computes missing/stale
// ones in a background goroutine, then caches them in memory.
func InitIntentClassifier() {
	go func() {
		log.Println("🧠 [IntentClassifier] Loading intent anchor embeddings...")

		var entries []anchorEntry
		for category, phrases := range intentAnchorPhrases {
			centroid, err := loadOrComputeCentroid(
				database.DB,
				embeddingArtifactIntentPrefix+category,
				embeddingModel,
				phrases,
				EmbedText,
			)
			if err != nil {
				log.Printf("⚠️ [IntentClassifier] Failed to embed %s anchors: %v", category, err)
				continue
			}
			entries = append(entries, anchorEntry{category: category, embedding: centroid})
			log.Printf("✅ [IntentClassifier] %s anchor ready (%d reference phrases)", category, len(phrases))
		}

		classifierMu.Lock()
		anchorEmbeds = entries
		ready := len(entries) == len(intentAnchorPhrases) // all 3 ready
		classifierReady = ready
		classifierMu.Unlock()

		if ready {
			log.Printf("🎯 [IntentClassifier] Ready — %d intent categories loaded", len(entries))
		} else {
			log.Printf("⚠️ [IntentClassifier] Partial init — only %d/%d categories ready", len(entries), len(intentAnchorPhrases))
		}

		// Also initialise the address validator using the same goroutine.
		initAddressValidator()
	}()
}

// computeIntentCentroid embeds all phrases and returns their mean embedding vector.
func computeIntentCentroid(phrases []string) ([]float64, error) {
	return computeCentroid(phrases, EmbedText)
}

// ─── Public Classification Entry Point ──────────────────────────────────────────

// ClassifyMessageIntent classifies a customer message using a two-tier approach.
//
// Tier 1 — Short messages (≤5 words): keyword matching, zero latency.
// Tier 2 — Long messages (>5 words) : cosine similarity against cached centroids.
//
// Returns: "shopping" | "browse" | "general" | "escape"
func ClassifyMessageIntent(msg string) string {
	// Always normalize first — maps Sinhala script + Singlish → canonical English
	// e.g. "ගන්නවා" → "order", "kiyada" → "price", "kohomada" → "greeting"
	normalized := NormalizeMessage(msg)
	lower := strings.ToLower(strings.TrimSpace(normalized))
	words := strings.Fields(normalized)

	// ── Tier 1: Short message (≤3 words) → keyword matching ──────────────────────
	// Most Sri Lankan WhatsApp messages are short single-intent phrases.
	// After normalization, Sinhala/Singlish become canonical English tokens.
	if len(words) <= 3 {
		// Hard exits always take priority
		if isGlobalEscapeIntent(msg) {
			return "escape"
		}
		// Greeting detection — prefix match so "hello there", "hi!", "ayubowan madam" work.
		// NormalizeMessage maps Sinhala greetings → "greeting" token.
		for _, g := range []string{
			// English
			"hello", "hi", "hey", "hola", "good morning", "good evening", "good night",
			// Singlish / Sinhala (normalize maps these → "greeting" but keep raw too)
			"ayubowan", "kohomada", "kohoma", "subha dawasak", "suba dawasak",
			"greeting", // canonical form after NormalizeMessage
		} {
			if lower == g ||
				strings.HasPrefix(lower, g+" ") ||
				strings.HasPrefix(lower, g+"!") ||
				strings.HasPrefix(lower, g+",") {
				return "general"
			}
		}
		// Browse / catalog signals (explicit browse requests only)
		if isBrowseSignal(msg) {
			return "browse"
		}
		// Order intent
		if detectOrderIntent(msg) {
			return "shopping"
		}
		// Short ambiguous → let FAQ/Gemini handle it naturally
		return "general"
	}

	// ── Tier 2: Long message → embedding cosine similarity ───────────────────────
	classifierMu.RLock()
	ready := classifierReady
	anchors := anchorEmbeds
	classifierMu.RUnlock()

	if ready {
		vec, err := EmbedText(msg)
		if err == nil {
			bestCat := "general"
			bestScore := -1.0
			for _, anchor := range anchors {
				score := CosineSimilarity(vec, anchor.embedding)
				if score > bestScore {
					bestScore = score
					bestCat = anchor.category
				}
			}
			log.Printf("[IntentClassifier] intent=%s score=%.3f", bestCat, bestScore)

			// Confident classification
			if bestScore >= 0.70 {
				return bestCat
			}
			log.Printf("⚠️ [IntentClassifier] Low confidence (%.3f) — falling back to keywords", bestScore)
		} else {
			log.Printf("⚠️ [IntentClassifier] Embed failed: %v — falling back to keywords", err)
		}
	}

	// ── Keyword fallback (classifier not ready or low confidence) ────────────────
	if isGlobalEscapeIntent(msg) {
		return "escape"
	}
	if detectOrderIntent(msg) {
		return "shopping"
	}
	if isBrowseSignal(msg) {
		return "browse"
	}
	for _, p := range []string{
		"i want to know", "tell me about", "what is ", "what are ",
		"how does", "how do", "explain", "who are", "where are",
		"about salespilot", "about your",
		// Singlish informational openers (post-normalize)
		"kohomada", "mokakda", "warrant", "refund", "location", "hours", "contact",
	} {
		if strings.Contains(lower, p) {
			return "general"
		}
	}
	return "general" // unknown long message → let FAQ/Gemini handle it
}

// ─── Embedding-Based Address Validator ──────────────────────────────────────────
//
// Cost: ~$0.000001 per validation (1 embedding call vs ~$0.000075 for Gemini Flash).
// Fallback: looksLikeAddress() heuristic if embeddings aren't ready yet.
//
// Pre-computed centroids (persisted and reused across restarts):
//   addrValidCentroid   — average embedding of valid delivery address examples
//   addrInvalidCentroid — average embedding of garbage/inability input examples

var (
	addrValidCentroid   []float64
	addrInvalidCentroid []float64
	addrValidatorReady  bool
)

// Representative valid Sri Lankan delivery addresses
var validAddressExamples = []string{
	"12/A Galle Road, Colombo 03",
	"No 5 Kandy Road, Negombo",
	"45 Temple Street, Kandy",
	"25/1, Baseline Road, Colombo 09",
	"56 Mahinda Mawatha, Gampaha",
	"Near the police station, Matara town",
	"15 Marine Drive, Wattala",
	"Flat 3B Crescat Residencies Colombo",
	"House 7 Peradeniya Road Kandy",
	"23 Duplication Road Colombo 3",
}

// Representative garbage / inability inputs that are NOT addresses
var invalidAddressExamples = []string{
	"dawdawdawd",
	"asdfasdfasdf",
	"qwertyuiop",
	"xxxxxxxxxxx",
	"i cannot provide my address",
	"i don't know my address",
	"random stuff here blah",
	"continue yes ok whatever",
	"aaaaabbbbcccc",
	"i have no idea where i live",
}

// initAddressValidator is called from InitIntentClassifier.
// Runs in the same background goroutine — no extra startup overhead.
func initAddressValidator() {
	validCentroid, err := loadOrComputeCentroid(
		database.DB,
		embeddingArtifactAddressValid,
		embeddingModel,
		validAddressExamples,
		EmbedText,
	)
	if err != nil {
		log.Printf("⚠️ [AddrValidator] Failed to embed valid address anchors: %v", err)
		return
	}
	invalidCentroid, err := loadOrComputeCentroid(
		database.DB,
		embeddingArtifactAddressInvalid,
		embeddingModel,
		invalidAddressExamples,
		EmbedText,
	)
	if err != nil {
		log.Printf("⚠️ [AddrValidator] Failed to embed invalid address anchors: %v", err)
		return
	}

	classifierMu.Lock()
	addrValidCentroid = validCentroid
	addrInvalidCentroid = invalidCentroid
	addrValidatorReady = true
	classifierMu.Unlock()

	log.Printf("✅ [AddrValidator] Ready — address embedding validator active")
}

// IsLikelyAddress returns (isValid, confidence) for a customer-typed delivery address.
//
// Uses embedding cosine similarity when the validator is ready (cost: ~$0.000001).
// Falls back to the keyword/entropy looksLikeAddress() heuristic otherwise.
//
//	isValid     = true if the input looks like a real address
//	confidence  = score difference between valid and invalid centroids (0.0–1.0)
func IsLikelyAddress(addr string) (bool, float64) {
	classifierMu.RLock()
	ready := addrValidatorReady
	validC := addrValidCentroid
	invalidC := addrInvalidCentroid
	classifierMu.RUnlock()

	if ready {
		vec, err := EmbedText(addr)
		if err == nil {
			validScore := CosineSimilarity(vec, validC)
			invalidScore := CosineSimilarity(vec, invalidC)
			confidence := validScore - invalidScore

			log.Printf("[AddrValidator] valid=%.3f invalid=%.3f diff=%.3f",
				validScore, invalidScore, confidence)

			// If the input is more similar to valid addresses → accept
			// Threshold: diff < -0.02 means clearly more similar to garbage
			if confidence < -0.02 {
				return false, confidence
			}
			return true, confidence
		}
		log.Printf("⚠️ [AddrValidator] Embed failed: %v — falling back to heuristic", err)
	}

	// Fallback: keyword + entropy heuristic (zero cost)
	return looksLikeAddress(addr), 0.5
}
