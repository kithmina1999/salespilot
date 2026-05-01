package whatsapp

// behavior_scorer.go — rhythm-aware spam detection replacing static rate limits.
//
// Design principle: "Protect revenue, not just servers."
// Blocking a real buyer = lost sale. This scorer distinguishes human
// burst-pause-burst patterns from bot constant-rate spam using weighted signals.
//
// Scoring signals:
//   +3  Same message repeated (text hash match)
//   +2  Message contains a URL/link
//   +2  >12 messages in 20 seconds (extreme burst)
//   +2  No pause >60 seconds over a long session (constant-rate bot pattern)
//   -3  Varied message content (natural human conversation)
//
// Action thresholds:
//   score < 3   → Normal    (full response)
//   score 3–5   → Delay     (1–2s artificial delay, then respond)
//   score 6–7   → Warn      (send soft warning, then respond)
//   score >= 8  → Block     (reject message, return)
//
// Checkout messages are always ActionNormal regardless of score.

import (
	"crypto/md5"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/cache"
)

// ─── Types ────────────────────────────────────────────────────────────────────

// BehaviorAction is the recommended action based on the spam score.
type BehaviorAction string

const (
	ActionNormal BehaviorAction = "normal"
	ActionDelay  BehaviorAction = "delay"
	ActionWarn   BehaviorAction = "warn"
	ActionBlock  BehaviorAction = "block"
)

// BehaviorScore is returned by RecordMessage.
type BehaviorScore struct {
	Score  int
	Action BehaviorAction
}

// ─── Scorer ───────────────────────────────────────────────────────────────────

// BehaviorScorer tracks per-user message rhythm and calculates spam scores.
// It consumes StateStore so it's compatible with the pluggable cache layer.
type BehaviorScorer struct {
	store cache.StateStore
}

// NewBehaviorScorer creates a scorer backed by the given state store.
func NewBehaviorScorer(store cache.StateStore) *BehaviorScorer {
	return &BehaviorScorer{store: store}
}

// ─── URL detection ───────────────────────────────────────────────────────────

var urlRe = regexp.MustCompile(`https?://\S+|www\.\S+`)

func containsLink(text string) bool {
	return urlRe.MatchString(text)
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

// msgHashKey returns the StateStore key for a phone's last-message hash.
func msgHashKey(scopeKey string) string {
	return fmt.Sprintf("%s:lasthash", scopeKey)
}

// burstCountKey returns the key for the 30-second burst counter.
func burstCountKey(scopeKey string) string {
	bucket := time.Now().Unix() / 30 // 30-second bucket
	return fmt.Sprintf("%s:burst:%d", scopeKey, bucket)
}

// repeatCountKey returns the key for consecutive repeated-message counter.
func repeatCountKey(scopeKey string) string {
	return fmt.Sprintf("%s:repeat", scopeKey)
}

// linkCountKey returns the key for consecutive link-message counter.
func linkCountKey(scopeKey string) string {
	return fmt.Sprintf("%s:links", scopeKey)
}

// spamScoreKey returns the key for the running spam score.
func spamScoreKey(scopeKey string) string {
	return fmt.Sprintf("%s:score", scopeKey)
}

// ─── Core scoring logic ───────────────────────────────────────────────────────

// RecordMessage records a message for a phone number and returns the current score.
// Phone is used directly as the scope — suitable for single-tenant use.
// For multi-tenant use, prefer RecordMessageForKey with a "biz:{id}:{phone}" key.
func (s *BehaviorScorer) RecordMessage(phone string, _ time.Time, text string) BehaviorScore {
	return s.RecordMessageForKey(fmt.Sprintf("scorer:%s", phone), time.Now(), text)
}

// RecordMessageInCheckout always returns ActionNormal regardless of score.
// Use this for messages received while the customer is in an active checkout state.
func (s *BehaviorScorer) RecordMessageInCheckout(_ string, _ time.Time, _ string) BehaviorScore {
	return BehaviorScore{Score: 0, Action: ActionNormal}
}

// RecordMessageForKey records a message for an arbitrary scope key (e.g. "biz:1:94771234567").
// This is the primary method for multi-tenant spam detection.
//
// All signals are computed independently and accumulated into a running score:
//   +3  Same message repeated >= 2 consecutive times
//   +2  Message contains a URL/link
//   +2  Extreme burst: >15 messages in 30 seconds
//   The running score decays by 2 per varied (non-repeated) message.
func (s *BehaviorScorer) RecordMessageForKey(scopeKey string, _ time.Time, text string) BehaviorScore {
	scoreDelta := 0

	// ── Signal 1: Repeated message ────────────────────────────────────────────
	hash := fmt.Sprintf("%x", md5.Sum([]byte(strings.TrimSpace(strings.ToLower(text)))))
	currentHashInt := int(hash[0])<<8 | int(hash[1])

	lastHashVal, _ := s.store.Get(msgHashKey(scopeKey))
	s.store.Set(msgHashKey(scopeKey), currentHashInt, 10*time.Minute)

	isRepeated := lastHashVal != 0 && lastHashVal == currentHashInt
	if isRepeated {
		repeats, _ := s.store.Increment(repeatCountKey(scopeKey), 1, 5*time.Minute)
		if repeats >= 2 {
			scoreDelta += 3
		}
	} else {
		s.store.Set(repeatCountKey(scopeKey), 0, 5*time.Minute)
		// Decay is applied later only if no spam signals fired
	}

	// ── Signal 2: Link in message ─────────────────────────────────────────────
	hasLink := false
	if containsLink(text) {
		hasLink = true
		links, _ := s.store.Increment(linkCountKey(scopeKey), 1, 10*time.Minute)
		if links >= 1 {
			scoreDelta += 2
		}
	} else {
		s.store.Set(linkCountKey(scopeKey), 0, 10*time.Minute)
	}

	// ── Signal 3: Extreme burst >12 msgs/30s ─────────────────────────────────
	isBurst := false
	burstCount, _ := s.store.Increment(burstCountKey(scopeKey), 1, 30*time.Second)
	if burstCount > 12 {
		isBurst = true
		scoreDelta += 2
	}

	// ── Apply decay only when message is clean (no spam signals) ─────────────
	if !isRepeated && !hasLink && !isBurst {
		scoreDelta -= 2
	}

	// ── Accumulate into running score (floor at 0) ───────────────────────────
	rawScore, _ := s.store.Increment(spamScoreKey(scopeKey), scoreDelta, 30*time.Minute)
	if rawScore < 0 {
		s.store.Set(spamScoreKey(scopeKey), 0, 30*time.Minute)
		rawScore = 0
	}

	return BehaviorScore{
		Score:  rawScore,
		Action: actionFromScore(rawScore),
	}
}

// actionFromScore maps a numeric score to a BehaviorAction.
// This is exported so tests can verify thresholds in isolation.
func actionFromScore(score int) BehaviorAction {
	switch {
	case score >= 8:
		return ActionBlock
	case score >= 6:
		return ActionWarn
	case score >= 3:
		return ActionDelay
	default:
		return ActionNormal
	}
}
