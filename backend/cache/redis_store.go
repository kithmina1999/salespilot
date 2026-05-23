package cache

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

const redisIncrementScript = `
local exists = redis.call("EXISTS", KEYS[1])
local value = redis.call("INCRBY", KEYS[1], ARGV[1])
if exists == 0 then
  local ttl = tonumber(ARGV[2])
  if ttl > 0 then
    redis.call("PEXPIRE", KEYS[1], ttl)
  else
    redis.call("DEL", KEYS[1])
  end
end
return value
`

// RedisStoreOptions controls the shared Redis-backed StateStore.
type RedisStoreOptions struct {
	URL          string
	Addr         string
	Password     string
	DB           int
	KeyPrefix    string
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	PoolSize     int
}

// RedisStore is a shared, TTL-aware StateStore for horizontally scaled app
// instances.
type RedisStore struct {
	client    *redis.Client
	keyPrefix string
}

// NewRedisStore creates a Redis-backed StateStore and verifies connectivity.
func NewRedisStore(opts RedisStoreOptions) (*RedisStore, error) {
	clientOpts, err := redisClientOptions(opts)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(clientOpts)
	store := &RedisStore{
		client:    client,
		keyPrefix: normalizeRedisKeyPrefix(opts.KeyPrefix),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("cache: redis state store ping failed: %w", err)
	}

	return store, nil
}

// Set stores a value with the given TTL.
func (s *RedisStore) Set(key string, value int, ttl time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	namespacedKey := s.namespacedKey(key)
	if ttl <= 0 {
		return s.client.Del(ctx, namespacedKey).Err()
	}
	return s.client.Set(ctx, namespacedKey, value, ttl).Err()
}

// Get retrieves a value. Returns ErrKeyNotFound if missing or expired.
func (s *RedisStore) Get(key string) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	value, err := s.client.Get(ctx, s.namespacedKey(key)).Int()
	if errors.Is(err, redis.Nil) {
		return 0, ErrKeyNotFound
	}
	if err != nil {
		return 0, err
	}
	return value, nil
}

// Increment atomically adds delta to a key. The TTL is set only when the key is
// first created, matching InMemoryStore semantics.
func (s *RedisStore) Increment(key string, delta int, ttl time.Duration) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	result, err := s.client.Eval(
		ctx,
		redisIncrementScript,
		[]string{s.namespacedKey(key)},
		delta,
		ttl.Milliseconds(),
	).Int()
	if err != nil {
		return 0, err
	}
	return result, nil
}

// Close releases Redis client resources.
func (s *RedisStore) Close() error {
	return s.client.Close()
}

func redisClientOptions(opts RedisStoreOptions) (*redis.Options, error) {
	var clientOpts *redis.Options
	var err error

	if strings.TrimSpace(opts.URL) != "" {
		clientOpts, err = redis.ParseURL(opts.URL)
		if err != nil {
			return nil, fmt.Errorf("cache: invalid REDIS_URL: %w", err)
		}
	} else {
		clientOpts = &redis.Options{
			Addr:     strings.TrimSpace(opts.Addr),
			Password: opts.Password,
			DB:       opts.DB,
		}
	}

	if strings.TrimSpace(clientOpts.Addr) == "" {
		clientOpts.Addr = "localhost:6379"
	}
	if opts.DialTimeout > 0 {
		clientOpts.DialTimeout = opts.DialTimeout
	}
	if opts.ReadTimeout > 0 {
		clientOpts.ReadTimeout = opts.ReadTimeout
	}
	if opts.WriteTimeout > 0 {
		clientOpts.WriteTimeout = opts.WriteTimeout
	}
	if opts.PoolSize > 0 {
		clientOpts.PoolSize = opts.PoolSize
	}

	return clientOpts, nil
}

func normalizeRedisKeyPrefix(prefix string) string {
	return strings.Trim(strings.TrimSpace(prefix), ":")
}

func (s *RedisStore) namespacedKey(key string) string {
	if s.keyPrefix == "" {
		return key
	}
	return s.keyPrefix + ":" + key
}
