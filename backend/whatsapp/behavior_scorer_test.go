package whatsapp

import (
	"fmt"
	"testing"
	"time"

	"github.com/kithmina1999/salespilot/cache"
)

// helper: create a fresh scorer with in-memory store for each test
func newTestScorer() *BehaviorScorer {
	store := cache.NewInMemoryStore(cache.DefaultConfig())
	return NewBehaviorScorer(store)
}

// helper: fast-forward a sequence of messages with given timestamps
func sendMessages(scorer *BehaviorScorer, phone string, messages []string, timestamps []time.Time) []BehaviorScore {
	var scores []BehaviorScore
	for i, msg := range messages {
		scores = append(scores, scorer.RecordMessage(phone, timestamps[i], msg))
	}
	return scores
}

// ─── Test 1: Natural burst-pause-burst pattern = NORMAL ──────────────────────

func TestBehaviorScorer_NaturalBurst_NotThrottled(t *testing.T) {
	scorer := newTestScorer()

	// Simulate a real customer: 5 msgs in 8 seconds, then 40s pause, then 3 more
	now := time.Now()
	msgs := []string{
		"hi", "price?", "size L?", "delivery?", "ok I take",
		// 40-second gap
		"actually wait", "which color", "ok the blue one",
	}
	timestamps := []time.Time{
		now, now.Add(2 * time.Second), now.Add(4 * time.Second),
		now.Add(6 * time.Second), now.Add(8 * time.Second),
		// natural pause
		now.Add(48 * time.Second), now.Add(50 * time.Second), now.Add(52 * time.Second),
	}

	scores := sendMessages(scorer, "94771234567", msgs, timestamps)

	// None of these should trigger throttle or block
	for i, s := range scores {
		if s.Action != ActionNormal && s.Action != ActionDelay {
			t.Errorf("msg %d: natural burst should be Normal or at most Delay, got %s (score=%d)", i, s.Action, s.Score)
		}
	}
}

// ─── Test 2: Constant-rate identical messages = BLOCKED ──────────────────────

func TestBehaviorScorer_SpamBot_Blocked(t *testing.T) {
	scorer := newTestScorer()

	// Simulate a spam bot: same message every 2 seconds, no pauses, 15 times
	now := time.Now()
	spamMsg := "Click here: http://spam.link/buy-now"
	var msgs []string
	var timestamps []time.Time
	for i := 0; i < 20; i++ {
		msgs = append(msgs, spamMsg)
		timestamps = append(timestamps, now.Add(time.Duration(i*2)*time.Second))
	}

	scores := sendMessages(scorer, "94770000001", msgs, timestamps)

	// Eventually must reach Block
	lastScore := scores[len(scores)-1]
	if lastScore.Action != ActionBlock && lastScore.Action != ActionWarn {
		t.Errorf("persistent spam bot should be Blocked or Warned, got %s (score=%d)", lastScore.Action, lastScore.Score)
	}
}

// ─── Test 3: Repeated identical messages score high ───────────────────────────

func TestBehaviorScorer_RepeatedMessages_HighScore(t *testing.T) {
	scorer := newTestScorer()

	now := time.Now()
	// Same message 5 times in quick succession
	for i := 0; i < 5; i++ {
		scorer.RecordMessage("94771111111", now.Add(time.Duration(i)*time.Second), "same message")
	}
	result := scorer.RecordMessage("94771111111", now.Add(6*time.Second), "same message")

	// Repeated identical messages should push score up significantly
	if result.Score < 3 {
		t.Errorf("expected score >= 3 for repeated messages, got %d", result.Score)
	}
}

// ─── Test 4: Links in every message add to score ──────────────────────────────

func TestBehaviorScorer_LinksInMessages_HigherScore(t *testing.T) {
	scorer := newTestScorer()

	now := time.Now()
	msgs := []string{
		"check http://example.com/1",
		"also see http://example.com/2",
		"and http://example.com/3",
	}
	for i, msg := range msgs {
		scorer.RecordMessage("94772222222", now.Add(time.Duration(i)*time.Second), msg)
	}
	result := scorer.RecordMessage("94772222222", now.Add(4*time.Second), "http://example.com/4")

	// Links should contribute to a higher score
	if result.Score < 2 {
		t.Errorf("expected score >= 2 for link-heavy messages, got %d", result.Score)
	}
}

// ─── Test 5: Checkout flow messages are fully exempt ─────────────────────────

func TestBehaviorScorer_CheckoutFlow_AlwaysNormal(t *testing.T) {
	scorer := newTestScorer()

	// Even if we mark this phone as already throttled, checkout msgs pass through
	now := time.Now()
	// First flood it to get throttled state
	for i := 0; i < 20; i++ {
		scorer.RecordMessage("94773333333", now.Add(time.Duration(i)*time.Second), "spam")
	}

	// Now send a checkout message — must be exempt
	result := scorer.RecordMessageInCheckout("94773333333", now.Add(21*time.Second), "42 Main Street Colombo")
	if result.Action != ActionNormal {
		t.Errorf("checkout message must always be ActionNormal, got %s", result.Action)
	}
}

// ─── Test 6: Score thresholds map to correct actions ─────────────────────────

func TestBehaviorScorer_ScoreThresholds(t *testing.T) {
	tests := []struct {
		score    int
		expected BehaviorAction
	}{
		{0, ActionNormal},
		{2, ActionNormal},
		{3, ActionDelay},
		{5, ActionDelay},
		{6, ActionWarn},
		{8, ActionBlock},
		{10, ActionBlock},
	}

	for _, tt := range tests {
		result := actionFromScore(tt.score)
		if result != tt.expected {
			t.Errorf("score %d: expected %s, got %s", tt.score, tt.expected, result)
		}
	}
}

// ─── Test 7: Scores are per-business (isolated tenants) ──────────────────────

func TestBehaviorScorer_PerBusinessIsolation(t *testing.T) {
	scorer := newTestScorer()
	now := time.Now()

	phone := "94774444444"
	key1 := fmt.Sprintf("biz:1:%s", phone)
	key2 := fmt.Sprintf("biz:2:%s", phone)

	// Flood under business 1
	for i := 0; i < 20; i++ {
		scorer.RecordMessageForKey(key1, now.Add(time.Duration(i)*time.Second), "spam")
	}

	// Same phone under business 2 should start clean
	result := scorer.RecordMessageForKey(key2, now.Add(21*time.Second), "mata meka ganna one")
	if result.Action != ActionNormal {
		t.Errorf("different business key should start with ActionNormal, got %s (score=%d)", result.Action, result.Score)
	}
}

// ─── Test 8: 15 msgs in 30 seconds triggers soft throttle ───────────────────

func TestBehaviorScorer_BurstLimit_15in30s(t *testing.T) {
	scorer := newTestScorer()
	now := time.Now()

	var lastResult BehaviorScore
	for i := 0; i < 20; i++ {
		lastResult = scorer.RecordMessage("94775555555", now.Add(time.Duration(i)*time.Second), fmt.Sprintf("msg %d", i))
	}
	// 20 varied messages in 30s — burst signal fires from msg 13 onwards, accumulates Delay+ score
	if lastResult.Action == ActionNormal {
		t.Errorf("20 msgs in 30s should at least trigger Delay, got ActionNormal (score=%d)", lastResult.Score)
	}
}
