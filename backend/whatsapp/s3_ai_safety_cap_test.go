package whatsapp

// s3_ai_safety_cap_test.go — TDD for S3: AI Daily Safety Cap + 80% Warning
//
// Acceptance criteria (from launch_readiness_plan.md S3):
//   3A: isDailyCapped(dailyCount, cap) → true when dailyCount >= cap
//   3B: shouldWarn80Percent(count, max) → true when 80% <= usage < 100%
//
// Strategy: pure functions with zero side-effects.
// The StateStore interactions (Get/Increment/Set) live in pipeline.go wiring;
// these tests cover only the decision logic so they survive any store refactor.

import "testing"

// ─── 3A: Daily Safety Cap ─────────────────────────────────────────────────────

func TestDailyCap_AtCap_IsCapped(t *testing.T) {
	if !isDailyCapped(100, 100) {
		t.Error("isDailyCapped(100, 100) should be true — at the cap")
	}
}

func TestDailyCap_ExceedsCap_IsCapped(t *testing.T) {
	if !isDailyCapped(101, 100) {
		t.Error("isDailyCapped(101, 100) should be true — exceeds cap")
	}
}

func TestDailyCap_BelowCap_NotCapped(t *testing.T) {
	if isDailyCapped(99, 100) {
		t.Error("isDailyCapped(99, 100) should be false — under cap")
	}
}

func TestDailyCap_Zero_NotCapped(t *testing.T) {
	if isDailyCapped(0, 100) {
		t.Error("isDailyCapped(0, 100) should be false — first call of the day")
	}
}

func TestDailyCap_ZeroCap_NeverCapped(t *testing.T) {
	// cap=0 means "disabled" — never block
	if isDailyCapped(999, 0) {
		t.Error("isDailyCapped with cap=0 should never be capped (feature disabled)")
	}
}

// ─── 3B: 80% Monthly Warning ──────────────────────────────────────────────────

func TestWarn80_ExactlyAt80_ShouldWarn(t *testing.T) {
	// 800 / 1000 = 80.0% → warn
	if !shouldWarn80Percent(800, 1000) {
		t.Error("shouldWarn80Percent(800, 1000) should be true — exactly at 80%")
	}
}

func TestWarn80_Between80And100_ShouldWarn(t *testing.T) {
	cases := [][2]int{{850, 1000}, {900, 1000}, {999, 1000}}
	for _, c := range cases {
		if !shouldWarn80Percent(c[0], c[1]) {
			t.Errorf("shouldWarn80Percent(%d, %d) should be true — usage between 80%% and 100%%", c[0], c[1])
		}
	}
}

func TestWarn80_Below80_NoWarn(t *testing.T) {
	cases := [][2]int{{0, 1000}, {500, 1000}, {799, 1000}}
	for _, c := range cases {
		if shouldWarn80Percent(c[0], c[1]) {
			t.Errorf("shouldWarn80Percent(%d, %d) should be false — usage below 80%%", c[0], c[1])
		}
	}
}

func TestWarn80_AtOrOver100_NoWarn(t *testing.T) {
	// At 100% the hard monthly cap fires, not the 80% warning
	cases := [][2]int{{1000, 1000}, {1001, 1000}}
	for _, c := range cases {
		if shouldWarn80Percent(c[0], c[1]) {
			t.Errorf("shouldWarn80Percent(%d, %d) should be false — at or over 100%%", c[0], c[1])
		}
	}
}

func TestWarn80_ZeroMax_NoWarn(t *testing.T) {
	// max=0 means unlimited (Pro plan) — never warn
	if shouldWarn80Percent(999, 0) {
		t.Error("shouldWarn80Percent with max=0 should never warn (unlimited plan)")
	}
}

func TestWarn80_NegativeMax_NoWarn(t *testing.T) {
	// max=-1 is the Pro plan sentinel — never warn
	if shouldWarn80Percent(999, -1) {
		t.Error("shouldWarn80Percent with max=-1 should never warn (Pro plan)")
	}
}
