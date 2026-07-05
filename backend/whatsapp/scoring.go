package whatsapp

import (
	"log"
	"regexp"
	"strings"

	"github.com/adrg/strutil"
	"github.com/adrg/strutil/metrics"
	"github.com/kithmina1999/salespilot/models"
)

type KeywordStrength string

const (
	KeywordStrong        KeywordStrength = "strong"
	KeywordStopGeneric   KeywordStrength = "stop_generic"
	KeywordDomainGeneric KeywordStrength = "domain_generic"
)

var stopGenericKeywords = map[string]bool{
	"have": true, "has": true, "want": true, "need": true,
	"get": true, "give": true, "send": true, "do": true,
	"can": true, "please": true, "tell": true,
}

var domainGenericKeywords = map[string]bool{
	"order": true, "buy": true, "price": true, "delivery": true,
	"payment": true, "available": true, "stock": true,
	"contact": true, "location": true,
}

func ClassifyKeywordStrength(entry string) KeywordStrength {
	entry = strings.ToLower(strings.TrimSpace(entry))

	// Combo and multi-word phrases are strong by default
	if strings.Contains(entry, "+") || len(strings.Fields(entry)) >= 2 {
		return KeywordStrong
	}

	if stopGenericKeywords[entry] {
		return KeywordStopGeneric
	}

	if domainGenericKeywords[entry] {
		return KeywordDomainGeneric
	}

	return KeywordStrong
}

type MatchSignal struct {
	Rule            *models.Rule
	MatchType       string  // "exact" | "combo" | "fuzzy" | "semantic"
	Confidence      float64 // 0.0–1.0 (final score)
	RawConfidence   float64 // 0.0–1.0 (before modifiers)
	MatchedTokens   int     // number of DISTINCT input tokens contributing to the match
	MatchedEntry    string
	KeywordStrength KeywordStrength
	MsgWordCount    int
	Density         float64
	Debug           ScoreDebug
}

// ScoreDebug holds the intermediate scoring values for observability
type ScoreDebug struct {
	RawConfidence  float64
	AfterWeight    float64
	AfterModifiers float64
	AfterCaps      float64
}

// ComputeFinalScore calculates the final confidence for a given signal based on the spec.
// Returns the final score and a ScoreDebug struct for observability.
func ComputeFinalScore(rawScore float64, matchType string, matchedTokens int, isPhraseMatch bool, ruleTier string, msgWordCount int, keywordStrength KeywordStrength) (float64, ScoreDebug) {
	var baseWeight float64
	switch matchType {
	case "exact":
		baseWeight = 1.0
	case "combo":
		baseWeight = 1.05
	case "semantic":
		baseWeight = 0.65
	case "fuzzy":
		baseWeight = 0.60
	default:
		baseWeight = 0.50
	}

	debug := ScoreDebug{RawConfidence: rawScore}

	// 1. Base score calculation
	score := baseWeight * rawScore
	debug.AfterWeight = score

	// 2. Multiplicative modifiers
	if matchType == "fuzzy" && matchedTokens == 1 {
		score *= 0.8
	}

	// 3. Additive modifiers
	if isPhraseMatch && (matchType == "exact" || matchType == "semantic") {
		score += 0.1
	}
	debug.AfterModifiers = score

	// 4. Clamp to [0.0, 1.0]
	if score > 1.0 {
		score = 1.0
	} else if score < 0.0 {
		score = 0.0
	}

	// 5. Hard caps
	// Fuzzy max cap
	if matchType == "fuzzy" && score > 0.85 {
		score = 0.85
	}

	// Single-signal cap
	if matchedTokens == 1 && matchType != "exact" {
		if score > 0.88 {
			score = 0.88
		}
	}

	// Exact Keyword Strength / Density Caps
	if matchType == "exact" && matchedTokens == 1 && msgWordCount >= 3 {
		density := 1.0
		if msgWordCount > 0 {
			density = float64(matchedTokens) / float64(msgWordCount)
		}

		switch keywordStrength {
		case KeywordStopGeneric:
			if score > 0.74 {
				score = 0.74
			}
		case KeywordDomainGeneric:
			if density < 0.35 && score > 0.74 {
				score = 0.74
			}
		}
	}

	// Casual tier cap (must not reach HIGH)
	if ruleTier == models.TierCasual && score > 0.89 { // HIGH is >= 0.90, so cap at 0.89
		score = 0.89
	}

	debug.AfterCaps = score
	return score, debug
}

// AggregateSignals processes a list of signals, groups them by RuleID (taking the max),
// and returns a sorted list of final signals.
func AggregateSignals(signals []MatchSignal) []MatchSignal {
	if len(signals) == 0 {
		return nil
	}

	// Group by RuleID (max confidence)
	ruleBest := make(map[uint]MatchSignal)
	for _, sig := range signals {
		existing, ok := ruleBest[sig.Rule.ID]
		if !ok {
			ruleBest[sig.Rule.ID] = sig
			continue
		}

		// Max logic
		diff := sig.Confidence - existing.Confidence
		if diff > 0.02 {
			ruleBest[sig.Rule.ID] = sig
		} else if diff >= -0.02 && diff <= 0.02 {
			if getPriority(sig.MatchType) > getPriority(existing.MatchType) {
				ruleBest[sig.Rule.ID] = sig
			}
		}
	}

	var finalSignals []MatchSignal
	for _, sig := range ruleBest {
		finalSignals = append(finalSignals, sig)
	}

	// Sort descending by Confidence, then Priority
	for i := 0; i < len(finalSignals)-1; i++ {
		for j := i + 1; j < len(finalSignals); j++ {
			diff := finalSignals[j].Confidence - finalSignals[i].Confidence
			swap := false
			if diff > 0.02 {
				swap = true
			} else if diff >= -0.02 && diff <= 0.02 {
				if getPriority(finalSignals[j].MatchType) > getPriority(finalSignals[i].MatchType) {
					swap = true
				}
			}
			if swap {
				finalSignals[i], finalSignals[j] = finalSignals[j], finalSignals[i]
			}
		}
	}

	return finalSignals
}

// getPriority returns a higher number for higher priority match types
func getPriority(matchType string) int {
	switch matchType {
	case "exact":
		return 4
	case "combo":
		return 3
	case "semantic":
		return 2
	case "fuzzy":
		return 1
	default:
		return 0
	}
}

// EvaluateRule determines if the signal clears the decision thresholds.
func EvaluateRule(businessName string, from string, signal MatchSignal) (bool, string, bool) {
	score := signal.Confidence
	rule := signal.Rule

	// Semantic MEDIUM threshold is 0.60, Deterministic is 0.75
	mediumThreshold := 0.75
	if signal.MatchType == "semantic" {
		mediumThreshold = 0.60
	}

	if score < mediumThreshold {
		// Logged in caller
		return false, "low", false
	}

	confidence := "medium"
	if score >= 0.90 && signal.MatchType != "semantic" {
		// Only deterministic matches can be high via standard EvaluateRule
		confidence = "high"
	}

	// Action gating
	canDrop := false
	if rule.IsDropRule {
		if rule.ActionTier == models.TierCritical && confidence == "high" {
			canDrop = true
		} else {
			log.Printf("🛡️ [%s] Safety Gate: Prevented Hard Drop (Tier=%s, Confidence=%s) for %s", businessName, rule.ActionTier, confidence, from)
		}
	}

	// TIER_CASUAL never allows destructive actions
	return true, confidence, canDrop
}

// EvaluateSemanticDirectCandidate evaluates a list of semantic signals to determine
// if a "semantic direct" reply shortcut is mathematically safe, bypassing Gemini.
// The signals slice does not need to be pre-sorted; this function sorts semantic candidates by RawConfidence internally.
func EvaluateSemanticDirectCandidate(signals []MatchSignal, reducedMsg string) (*MatchSignal, bool) {
	if len(signals) == 0 {
		return nil, false
	}

	// Semantic direct is only safe for short, single-intent queries
	if len(strings.Fields(reducedMsg)) > 8 {
		return nil, false
	}

	var semSignals []MatchSignal
	for _, s := range signals {
		if s.MatchType == "semantic" {
			semSignals = append(semSignals, s)
		}
	}

	if len(semSignals) == 0 {
		return nil, false
	}

	// Sort by RawConfidence descending
	for i := 0; i < len(semSignals)-1; i++ {
		for j := i + 1; j < len(semSignals); j++ {
			if semSignals[j].RawConfidence > semSignals[i].RawConfidence {
				semSignals[i], semSignals[j] = semSignals[j], semSignals[i]
			}
		}
	}

	top := semSignals[0]
	// 1. Top semantic RawConfidence >= 0.90
	if top.RawConfidence < 0.90 {
		return nil, false
	}

	// 2. Rule must be reply-only (safe). No casual tier direct replies, no drop, no context bridge.
	if top.Rule.ActionTier == models.TierCasual || top.Rule.IsDropRule || top.Rule.IsContextBridge {
		return nil, false
	}

	// 3. Margin check (topRaw - secondRaw >= 0.08)
	if len(semSignals) > 1 {
		second := semSignals[1]
		if second.RawConfidence >= 0.90 {
			return nil, false // Not exactly one winner
		}

		margin := top.RawConfidence - second.RawConfidence
		if margin < 0.08 {
			return nil, false
		}
	}

	return &top, true
}

// GetDeterministicSignals runs the exact, combo, and fuzzy matchers against the cleanMsg.
func GetDeterministicSignals(businessID uint, cleanMsg string) []MatchSignal {
	rules := Cache.GetRules(businessID)
	jw := metrics.NewJaroWinkler()
	msgWords := strings.Fields(cleanMsg)

	wbMatch := func(text, term string) bool {
		if !strings.Contains(text, term) {
			return false
		}
		pat := `(?i)(?:^|[^\pL\pN])` + regexp.QuoteMeta(term) + `(?:[^\pL\pN]|$)`
		ok, _ := regexp.MatchString(pat, text)
		return ok
	}

	var signals []MatchSignal

	for _, cr := range rules {
		rule := cr.Rule
		bestRaw := 0.0
		bestType := ""
		bestTokens := 0
		bestMatchedEntry := ""

		for _, entry := range strings.Split(rule.Keywords, ",") {
			entry = strings.TrimSpace(entry)
			if entry == "" {
				continue
			}

			if strings.Contains(entry, "+") {
				// Combo
				parts := strings.Split(entry, "+")
				allOk := true
				for _, p := range parts {
					if !wbMatch(cleanMsg, strings.TrimSpace(p)) {
						allOk = false
						break
					}
				}
				if allOk {
					if 1.0 > bestRaw || (1.0 == bestRaw && getPriority("combo") > getPriority(bestType)) {
						bestRaw = 1.0
						bestType = "combo"
						bestTokens = len(parts)
						bestMatchedEntry = entry
					}
				}
			} else {
				// Exact
				if wbMatch(cleanMsg, entry) {
					if 1.0 > bestRaw || (1.0 == bestRaw && getPriority("exact") > getPriority(bestType)) {
						bestRaw = 1.0
						bestType = "exact"
						bestTokens = len(strings.Fields(entry))
						bestMatchedEntry = entry
					}
				} else {
					// Fuzzy
					if len(entry) < 5 {
						continue // Invariant 1: Skip entirely
					}
					for _, word := range msgWords {
						if len(word) < 5 {
							continue // Invariant 1
						}
						lenDiff := len(word) - len(entry)
						if lenDiff < -1 || lenDiff > 1 {
							continue // Invariant 1
						}
						score := strutil.Similarity(word, entry, jw)
						if score > 0.85 {
							if score > bestRaw || (score == bestRaw && getPriority("fuzzy") > getPriority(bestType)) {
								bestRaw = score
								bestType = "fuzzy"
								bestTokens = 1
								bestMatchedEntry = entry
							}
						}
					}
				}
			}
		}

		if bestRaw > 0 {
			// Compute final score
			isPhraseMatch := bestTokens > 1 && (bestType == "exact")
			msgWordCount := len(msgWords)
			if msgWordCount == 0 {
				msgWordCount = 1
			}
			density := float64(bestTokens) / float64(msgWordCount)
			kwStrength := ClassifyKeywordStrength(bestMatchedEntry)

			finalScore, debug := ComputeFinalScore(bestRaw, bestType, bestTokens, isPhraseMatch, rule.ActionTier, msgWordCount, kwStrength)

			// Invariant 2: At most one MatchSignal per rule
			signals = append(signals, MatchSignal{
				Rule:            &rule,
				MatchType:       bestType,
				Confidence:      finalScore,
				RawConfidence:   bestRaw,
				MatchedTokens:   bestTokens,
				MatchedEntry:    bestMatchedEntry,
				KeywordStrength: kwStrength,
				MsgWordCount:    msgWordCount,
				Density:         density,
				Debug:           debug,
			})
		}
	}
	return signals
}

// GetSemanticSignals runs the semantic embedding matcher against the reducedMsg.
func GetSemanticSignals(businessID uint, reducedMsg string) []MatchSignal {
	if strings.TrimSpace(reducedMsg) == "" {
		return nil
	}

	rules := Cache.GetRules(businessID)
	embedded := make([]CachedRule, 0, len(rules))
	for _, cr := range rules {
		if len(cr.Embedding) > 0 {
			embedded = append(embedded, cr)
		}
	}

	if len(embedded) == 0 {
		return nil
	}

	msgVec, err := EmbedText(reducedMsg)
	if err != nil {
		log.Printf("⚠️ semanticMatch: embed failed: %v — skipping semantic layer", err)
		return nil
	}

	var signals []MatchSignal
	msgTokens := len(strings.Fields(reducedMsg))
	if msgTokens == 0 {
		msgTokens = 1
	}

	for _, cr := range embedded {
		score := CosineSimilarity(msgVec, cr.Embedding)
		// Send a wider net to the scoring engine since caps/modifiers will handle the rest
		if score >= 0.60 {
			rule := cr.Rule
			isPhraseMatch := msgTokens > 1
			finalScore, debug := ComputeFinalScore(score, "semantic", msgTokens, isPhraseMatch, rule.ActionTier, msgTokens, KeywordStrong)
			signals = append(signals, MatchSignal{
				Rule:            &rule,
				MatchType:       "semantic",
				Confidence:      finalScore,
				RawConfidence:   score,
				MatchedTokens:   msgTokens,
				MatchedEntry:    "",
				KeywordStrength: KeywordStrong,
				MsgWordCount:    msgTokens,
				Density:         1.0,
				Debug:           debug,
			})
		}
	}
	return signals
}
