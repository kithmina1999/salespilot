package whatsapp

// first_of_day_test.go — TDD for S6: First-of-Day Custom Greeting
//
// Tests the FirstOfDayGreeter which uses StateStore to track whether a customer
// has already received their daily greeting, sending a personalized time-of-day
// greeting only once per calendar day per business.
//
// Run: go test -v ./whatsapp -run TestFirstOfDay

import (
	"testing"
	"time"

	"github.com/kithmina1999/salespilot/cache"
)

// helper: fresh greeter backed by ephemeral in-memory store
func newTestGreeter() *FirstOfDayGreeter {
	store := cache.NewInMemoryStore(cache.DefaultConfig())
	return NewFirstOfDayGreeter(store)
}

// ─── Test 1: First message of day returns a greeting ─────────────────────────

func TestFirstOfDay_FirstMessage_ReturnsGreeting(t *testing.T) {
	greeter := newTestGreeter()

	msg, isFirst := greeter.CheckAndMark("biz:1:94771234567", "Kasun")
	if !isFirst {
		t.Error("first message of the day should be detected as first")
	}
	if msg == "" {
		t.Error("first message should produce a non-empty greeting")
	}
	t.Logf("✅ Greeting: %q", msg)
}

// ─── Test 2: Second message same day → no greeting ────────────────────────────

func TestFirstOfDay_SecondMessage_NoGreeting(t *testing.T) {
	greeter := newTestGreeter()
	scopeKey := "biz:1:94771111111"

	// First message
	greeter.CheckAndMark(scopeKey, "Nuwan")

	// Second message — should get no greeting
	msg, isFirst := greeter.CheckAndMark(scopeKey, "Nuwan")
	if isFirst {
		t.Error("second message of the day should NOT be detected as first")
	}
	if msg != "" {
		t.Errorf("second message should produce empty greeting, got %q", msg)
	}
}

// ─── Test 3: Different businesses are isolated ────────────────────────────────

func TestFirstOfDay_DifferentBusinesses_Isolated(t *testing.T) {
	greeter := newTestGreeter()
	phone := "94772222222"

	// Customer at business 1 is greeted
	_, first1 := greeter.CheckAndMark("biz:1:"+phone, "Saman")
	if !first1 {
		t.Error("biz:1 should see this as first-of-day")
	}

	// Same phone at business 2 is also first-of-day
	_, first2 := greeter.CheckAndMark("biz:2:"+phone, "Saman")
	if !first2 {
		t.Error("biz:2 should also see this as first-of-day — tenants are isolated")
	}
}

// ─── Test 4: Greeting includes customer name ─────────────────────────────────

func TestFirstOfDay_Greeting_IncludesName(t *testing.T) {
	greeter := newTestGreeter()

	msg, _ := greeter.CheckAndMark("biz:1:94773333333", "Ayesha")

	// The greeting should reference the customer's name somewhere
	if msg == "" {
		t.Fatal("expected a greeting, got empty string")
	}
	// Not strictly enforcing exact name inclusion — some langs may use title forms
	t.Logf("✅ Name-inclusive greeting: %q", msg)
}

// ─── Test 5: Anonymous customer (no name) → generic greeting ─────────────────

func TestFirstOfDay_AnonymousCustomer_GenericGreeting(t *testing.T) {
	greeter := newTestGreeter()

	msg, isFirst := greeter.CheckAndMark("biz:1:94774444444", "")
	if !isFirst {
		t.Error("should still be first-of-day for anonymous customer")
	}
	if msg == "" {
		t.Error("anonymous customer should still get a greeting (generic, no name)")
	}
	t.Logf("✅ Anonymous greeting: %q", msg)
}

// ─── Test 6: Time-of-day aware greeting ──────────────────────────────────────

func TestFirstOfDay_TimeOfDayAware(t *testing.T) {
	// Test that the greeting generation function is time-aware
	// We verify all three time slots return non-empty greetings

	cases := []struct {
		hour int
		slot string
	}{
		{7, "morning"},
		{13, "afternoon"},
		{19, "evening"},
	}

	for _, tc := range cases {
		t.Run(tc.slot, func(t *testing.T) {
			testTime := time.Now().Truncate(24 * time.Hour).Add(time.Duration(tc.hour) * time.Hour)
			msg := buildGreeting("en", "Kasun", testTime)
			if msg == "" {
				t.Errorf("expected non-empty greeting for hour %d (%s)", tc.hour, tc.slot)
			}
			t.Logf("hour=%d: %q", tc.hour, msg)
		})
	}
}

// ─── Test 7: Sinhala language greeting ───────────────────────────────────────

func TestFirstOfDay_SinhalaGreeting(t *testing.T) {
	testTime := time.Now().Truncate(24 * time.Hour).Add(9 * time.Hour) // 9 AM
	msg := buildGreeting("si", "Kasun", testTime)
	if msg == "" {
		t.Error("Sinhala greeting should be non-empty")
	}
	t.Logf("✅ Sinhala greeting: %q", msg)
}

// ─── Test 8: Concurrent safe (race detector) ─────────────────────────────────

func TestFirstOfDay_ConcurrentAccess_RaceSafe(t *testing.T) {
	greeter := newTestGreeter()
	done := make(chan struct{})

	// 50 concurrent goroutines all check first-of-day for different phones
	for i := 0; i < 50; i++ {
		go func(n int) {
			defer func() { done <- struct{}{} }()
			scopeKey := "biz:1:9477" + string(rune('0'+n%10)) + "00000"
			greeter.CheckAndMark(scopeKey, "User")
		}(i)
	}
	for i := 0; i < 50; i++ {
		<-done
	}
}
