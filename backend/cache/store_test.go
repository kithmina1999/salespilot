package cache

import (
	"sync"
	"testing"
	"time"
)

// ─── Test 1: Basic Set / Get round-trip ───────────────────────────────────────

func TestStore_SetAndGet(t *testing.T) {
	store := NewInMemoryStore(DefaultConfig())

	store.Set("user:123:budget", 500, 1*time.Hour)
	val, err := store.Get("user:123:budget")
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if val != 500 {
		t.Fatalf("expected 500, got %d", val)
	}
}

// ─── Test 2: Get on missing key returns ErrKeyNotFound ────────────────────────

func TestStore_GetMissing(t *testing.T) {
	store := NewInMemoryStore(DefaultConfig())

	_, err := store.Get("nonexistent")
	if err != ErrKeyNotFound {
		t.Fatalf("expected ErrKeyNotFound, got %v", err)
	}
}

// ─── Test 3: TTL expiration — key vanishes after its TTL ──────────────────────

func TestStore_TTLExpiry(t *testing.T) {
	store := NewInMemoryStore(DefaultConfig())

	store.Set("temp:abc", 42, 50*time.Millisecond)

	// Should exist immediately
	val, err := store.Get("temp:abc")
	if err != nil || val != 42 {
		t.Fatalf("expected 42 before expiry, got val=%d err=%v", val, err)
	}

	// Wait for TTL + buffer
	time.Sleep(100 * time.Millisecond)

	_, err = store.Get("temp:abc")
	if err != ErrKeyNotFound {
		t.Fatalf("expected ErrKeyNotFound after TTL, got %v", err)
	}
}

// ─── Test 4: Increment creates key if missing, then increments ────────────────

func TestStore_Increment(t *testing.T) {
	store := NewInMemoryStore(DefaultConfig())

	// First call should create with value 1
	val, err := store.Increment("counter:user1", 1, 1*time.Hour)
	if err != nil {
		t.Fatalf("Increment returned error: %v", err)
	}
	if val != 1 {
		t.Fatalf("expected 1 on first increment, got %d", val)
	}

	// Second call should bump to 2
	val, err = store.Increment("counter:user1", 1, 1*time.Hour)
	if err != nil {
		t.Fatalf("Increment returned error: %v", err)
	}
	if val != 2 {
		t.Fatalf("expected 2 on second increment, got %d", val)
	}

	// Increment by 5
	val, err = store.Increment("counter:user1", 5, 1*time.Hour)
	if err != nil {
		t.Fatalf("Increment returned error: %v", err)
	}
	if val != 7 {
		t.Fatalf("expected 7 after +5 increment, got %d", val)
	}
}

// ─── Test 5: Concurrent increments are atomic ─────────────────────────────────

func TestStore_ConcurrentIncrement(t *testing.T) {
	store := NewInMemoryStore(DefaultConfig())

	const goroutines = 100
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			store.Increment("race:key", 1, 1*time.Hour)
		}()
	}
	wg.Wait()

	val, err := store.Get("race:key")
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if val != goroutines {
		t.Fatalf("expected %d after concurrent increments, got %d", goroutines, val)
	}
}

// ─── Test 6: Set overwrites existing value ────────────────────────────────────

func TestStore_SetOverwrites(t *testing.T) {
	store := NewInMemoryStore(DefaultConfig())

	store.Set("key1", 10, 1*time.Hour)
	store.Set("key1", 99, 1*time.Hour)

	val, err := store.Get("key1")
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if val != 99 {
		t.Fatalf("expected 99 after overwrite, got %d", val)
	}
}

// ─── Test 7: Time-bucketed key pattern works correctly ────────────────────────

func TestStore_TimeBucketedKeys(t *testing.T) {
	store := NewInMemoryStore(DefaultConfig())

	// Simulate time-bucketed keys like Redis would use
	hourBucket := time.Now().Truncate(time.Hour).Format("2006010215")
	key := "user:94771234567:budget:" + hourBucket

	store.Increment(key, 100, 1*time.Hour)
	store.Increment(key, 50, 1*time.Hour)

	val, err := store.Get(key)
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if val != 150 {
		t.Fatalf("expected 150 for bucketed key, got %d", val)
	}
}
