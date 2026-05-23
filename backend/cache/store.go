// Package cache provides a pluggable state storage layer for high-frequency,
// short-lived counters (rate-limit scores, token budgets, first-message flags).
//
// The StateStore interface is designed so the app can use an in-memory store
// for local development and Redis for horizontally scaled production.
// Keys should follow time-bucketed patterns (e.g. "user:{phone}:budget:{hour}")
// so they map directly to Redis key conventions.
package cache

import (
	"errors"
	"sync"
	"time"
)

// ErrKeyNotFound is returned by Get when a key does not exist or has expired.
var ErrKeyNotFound = errors.New("cache: key not found")

// ─── Interface ────────────────────────────────────────────────────────────────

// StateStore is the pluggable cache abstraction consumed by BehaviorScorer,
// PromptShield token budgets, and first-message-of-day checks.
//
// Implementations:
//   - InMemoryStore for local/dev and single-instance deployments
//   - RedisStore for shared state across horizontally scaled instances
type StateStore interface {
	// Set stores a value with a TTL. Overwrites if the key already exists.
	Set(key string, value int, ttl time.Duration) error

	// Get retrieves a value. Returns ErrKeyNotFound if missing or expired.
	Get(key string) (int, error)

	// Increment atomically adds delta to a key's value and returns the new total.
	// If the key does not exist, it is created with value=delta and the given TTL.
	// If the key already exists, only the value is updated (TTL is NOT reset).
	Increment(key string, delta int, ttl time.Duration) (int, error)
}

// ─── Config ───────────────────────────────────────────────────────────────────

// StoreConfig controls the behavior of InMemoryStore.
type StoreConfig struct {
	// CleanupInterval is how often expired entries are swept. Lower values
	// use slightly more CPU but free memory faster.
	CleanupInterval time.Duration

	// MaxEntries is the hard cap on total entries. When exceeded, the oldest
	// entries are evicted regardless of TTL. Set to 0 for unlimited (not
	// recommended in production).
	MaxEntries int
}

// DefaultConfig returns a production-safe configuration.
func DefaultConfig() StoreConfig {
	return StoreConfig{
		CleanupInterval: 30 * time.Second,
		MaxEntries:      50_000, // ~50k active users max
	}
}

// ─── In-Memory Implementation ─────────────────────────────────────────────────

type entry struct {
	value     int
	expiresAt time.Time
}

// InMemoryStore is a thread-safe, TTL-aware cache backed by a Go map.
// It satisfies the StateStore interface and is the default implementation
// for single-instance deployments.
type InMemoryStore struct {
	mu     sync.RWMutex
	data   map[string]entry
	config StoreConfig
	stopGC chan struct{}
}

// NewInMemoryStore creates a ready-to-use cache with background cleanup.
func NewInMemoryStore(cfg StoreConfig) *InMemoryStore {
	s := &InMemoryStore{
		data:   make(map[string]entry),
		config: cfg,
		stopGC: make(chan struct{}),
	}
	go s.gcLoop()
	return s
}

// Set stores a value with the given TTL.
func (s *InMemoryStore) Set(key string, value int, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.data[key] = entry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}

	// Evict oldest if we've exceeded MaxEntries
	if s.config.MaxEntries > 0 && len(s.data) > s.config.MaxEntries {
		s.evictOldestLocked()
	}
	return nil
}

// Get retrieves a value. Returns ErrKeyNotFound if missing or expired.
func (s *InMemoryStore) Get(key string) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	e, ok := s.data[key]
	if !ok {
		return 0, ErrKeyNotFound
	}
	if time.Now().After(e.expiresAt) {
		return 0, ErrKeyNotFound
	}
	return e.value, nil
}

// Increment atomically adds delta to a key. Creates the key if it doesn't exist.
func (s *InMemoryStore) Increment(key string, delta int, ttl time.Duration) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	e, ok := s.data[key]
	if !ok || time.Now().After(e.expiresAt) {
		// Key missing or expired — create fresh
		s.data[key] = entry{
			value:     delta,
			expiresAt: time.Now().Add(ttl),
		}
		return delta, nil
	}

	// Key exists and is valid — increment without resetting TTL
	e.value += delta
	s.data[key] = e
	return e.value, nil
}

// Stop terminates the background cleanup goroutine. Call on shutdown.
func (s *InMemoryStore) Stop() {
	close(s.stopGC)
}

// ─── Background Cleanup ──────────────────────────────────────────────────────

// gcLoop periodically sweeps expired entries to prevent memory leaks.
func (s *InMemoryStore) gcLoop() {
	ticker := time.NewTicker(s.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.mu.Lock()
			now := time.Now()
			for k, e := range s.data {
				if now.After(e.expiresAt) {
					delete(s.data, k)
				}
			}
			s.mu.Unlock()
		case <-s.stopGC:
			return
		}
	}
}

// evictOldestLocked removes the entry with the earliest expiry.
// Caller MUST hold s.mu.Lock().
func (s *InMemoryStore) evictOldestLocked() {
	var oldestKey string
	var oldestTime time.Time
	first := true

	for k, e := range s.data {
		if first || e.expiresAt.Before(oldestTime) {
			oldestKey = k
			oldestTime = e.expiresAt
			first = false
		}
	}
	if !first {
		delete(s.data, oldestKey)
	}
}
