package cache

import (
	"strings"
	"testing"
)

func TestNormalizeStateStoreBackend(t *testing.T) {
	tests := map[string]string{
		"":          "memory",
		"memory":    "memory",
		"in-memory": "memory",
		"inmemory":  "memory",
		"REDIS":     "redis",
		"unknown":   "unknown",
	}

	for input, want := range tests {
		if got := NormalizeStateStoreBackend(input); got != want {
			t.Fatalf("NormalizeStateStoreBackend(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestNewStateStoreDefaultsToMemory(t *testing.T) {
	store, err := NewStateStore(StateStoreOptions{})
	if err != nil {
		t.Fatalf("NewStateStore returned error: %v", err)
	}

	inMemory, ok := store.(*InMemoryStore)
	if !ok {
		t.Fatalf("expected InMemoryStore, got %T", store)
	}
	defer inMemory.Stop()
}

func TestNewStateStoreRejectsUnknownBackend(t *testing.T) {
	_, err := NewStateStore(StateStoreOptions{Backend: "postgres"})
	if err == nil {
		t.Fatal("expected error for unsupported backend")
	}
	if !strings.Contains(err.Error(), "unsupported state store backend") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRedisStoreNamespacedKey(t *testing.T) {
	store := &RedisStore{keyPrefix: normalizeRedisKeyPrefix(" salespilot:prod: ")}
	if got := store.namespacedKey("pipeline:budget"); got != "salespilot:prod:pipeline:budget" {
		t.Fatalf("namespacedKey returned %q", got)
	}
}

func TestRedisClientOptionsURL(t *testing.T) {
	opts, err := redisClientOptions(RedisStoreOptions{
		URL:       "redis://:secret@redis.internal:6380/2",
		KeyPrefix: "salespilot",
	})
	if err != nil {
		t.Fatalf("redisClientOptions returned error: %v", err)
	}
	if opts.Addr != "redis.internal:6380" {
		t.Fatalf("Addr = %q", opts.Addr)
	}
	if opts.Password != "secret" {
		t.Fatalf("Password = %q", opts.Password)
	}
	if opts.DB != 2 {
		t.Fatalf("DB = %d", opts.DB)
	}
}
