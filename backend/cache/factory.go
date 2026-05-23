package cache

import (
	"fmt"
	"strings"
)

// StateStoreOptions selects the pipeline state backend.
type StateStoreOptions struct {
	Backend string
	Memory  StoreConfig
	Redis   RedisStoreOptions
}

// NewStateStore creates the configured state store.
func NewStateStore(opts StateStoreOptions) (StateStore, error) {
	backend := NormalizeStateStoreBackend(opts.Backend)
	switch backend {
	case "", "memory":
		if opts.Memory.CleanupInterval == 0 && opts.Memory.MaxEntries == 0 {
			opts.Memory = DefaultConfig()
		}
		return NewInMemoryStore(opts.Memory), nil
	case "redis":
		return NewRedisStore(opts.Redis)
	default:
		return nil, fmt.Errorf("cache: unsupported state store backend %q", opts.Backend)
	}
}

// NormalizeStateStoreBackend canonicalizes accepted backend aliases.
func NormalizeStateStoreBackend(backend string) string {
	switch strings.ToLower(strings.TrimSpace(backend)) {
	case "", "memory", "in-memory", "inmemory":
		return "memory"
	case "redis":
		return "redis"
	default:
		return strings.ToLower(strings.TrimSpace(backend))
	}
}
