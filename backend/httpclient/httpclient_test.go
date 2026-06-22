package httpclient

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestClientRetriesSafeTransientResponse(t *testing.T) {
	var mu sync.Mutex
	attempts := 0
	client := newTestClient(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		mu.Lock()
		defer mu.Unlock()
		attempts++
		status := http.StatusServiceUnavailable
		if attempts == 3 {
			status = http.StatusOK
		}
		return response(status), nil
	}))

	req, err := http.NewRequest(http.MethodPost, "https://example.test/generate", bytes.NewReader([]byte(`{"prompt":"hello"}`)))
	if err != nil {
		t.Fatal(err)
	}
	resp, err := client.Do(context.Background(), DependencyGemini, "generate", req, RetryTransient)
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK || attempts != 3 {
		t.Fatalf("status=%d attempts=%d, want status=200 attempts=3", resp.StatusCode, attempts)
	}
}

func TestClientDoesNotRetryUnsafePost(t *testing.T) {
	attempts := 0
	client := newTestClient(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		attempts++
		return response(http.StatusServiceUnavailable), nil
	}))
	req, _ := http.NewRequest(http.MethodPost, "https://graph.facebook.com/messages", strings.NewReader("{}"))
	resp, err := client.Do(context.Background(), DependencyMeta, "send_message", req, NoRetry)
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}
	defer resp.Body.Close()
	if attempts != 1 {
		t.Fatalf("attempts=%d, want 1", attempts)
	}
}

func TestClientKeepsResponseContextAliveUntilBodyIsClosed(t *testing.T) {
	var responseCtx context.Context
	client := newTestClient(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		responseCtx = req.Context()
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body: &contextAwareBody{
				ctx:    responseCtx,
				reader: strings.NewReader(`{"ok":true}`),
			},
		}, nil
	}))

	req, _ := http.NewRequest(http.MethodGet, "https://example.test", nil)
	resp, err := client.Do(context.Background(), DependencyGemini, "read_body", req, NoRetry)
	if err != nil {
		t.Fatalf("Do() error = %v", err)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("body=%q, want JSON response", body)
	}
	select {
	case <-responseCtx.Done():
		t.Fatal("response context canceled before body was closed")
	default:
	}

	if err := resp.Body.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	select {
	case <-responseCtx.Done():
	case <-time.After(time.Second):
		t.Fatal("response context was not canceled after body was closed")
	}
}

func TestClientStopsRetryingWhenContextIsCanceled(t *testing.T) {
	client := newTestClient(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return nil, &temporaryError{}
	}))
	ctx, cancel := context.WithCancel(context.Background())
	client.sleep = func(context.Context, time.Duration) error {
		cancel()
		return context.Canceled
	}
	req, _ := http.NewRequest(http.MethodGet, "https://example.test", nil)
	_, err := client.Do(ctx, DependencyGemini, "read", req, RetryTransient)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("error=%v, want context canceled", err)
	}
}

func TestCircuitBreakerOpensAndHalfOpenProbeClosesIt(t *testing.T) {
	breaker := newCircuitBreaker(2, time.Minute)
	now := time.Date(2026, 6, 21, 0, 0, 0, 0, time.UTC)
	if !breaker.Allow(now) {
		t.Fatal("closed breaker rejected request")
	}
	if breaker.RecordFailure(now) {
		t.Fatal("breaker opened before threshold")
	}
	if !breaker.RecordFailure(now) {
		t.Fatal("breaker did not open at threshold")
	}
	if breaker.Allow(now.Add(30 * time.Second)) {
		t.Fatal("open breaker allowed request too early")
	}
	if !breaker.Allow(now.Add(time.Minute)) {
		t.Fatal("breaker did not allow half-open probe")
	}
	if breaker.Allow(now.Add(time.Minute)) {
		t.Fatal("breaker allowed a second half-open probe")
	}
	breaker.RecordSuccess()
	if !breaker.Allow(now.Add(time.Minute)) {
		t.Fatal("successful probe did not close breaker")
	}
}

func TestRetryAfterSeconds(t *testing.T) {
	resp := response(http.StatusTooManyRequests)
	resp.Header.Set("Retry-After", "3")
	delay, ok := retryAfter(resp, time.Now())
	if !ok || delay != 3*time.Second {
		t.Fatalf("delay=%s ok=%v, want 3s true", delay, ok)
	}
}

func TestDependencyTimeoutsAreBounded(t *testing.T) {
	policies := defaultPolicies()
	if policies[DependencyGemini].timeout != ExternalAPITimeout {
		t.Fatalf("Gemini timeout=%s, want %s", policies[DependencyGemini].timeout, ExternalAPITimeout)
	}
	for dependency, configured := range policies {
		if configured.timeout <= 0 || configured.timeout > ExternalAPITimeout {
			t.Fatalf("%s timeout=%s is outside production bound", dependency, configured.timeout)
		}
	}
}

func newTestClient(transport http.RoundTripper) *Client {
	client := NewClient(transport)
	client.sleep = func(context.Context, time.Duration) error { return nil }
	for dependency, configured := range client.policies {
		configured.failureThreshold = 2
		client.policies[dependency] = configured
	}
	return client
}

func response(status int) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader("response")),
	}
}

type temporaryError struct{}

func (temporaryError) Error() string   { return "temporary" }
func (temporaryError) Timeout() bool   { return true }
func (temporaryError) Temporary() bool { return true }

type contextAwareBody struct {
	ctx    context.Context
	reader io.Reader
}

func (b *contextAwareBody) Read(p []byte) (int, error) {
	select {
	case <-b.ctx.Done():
		return 0, b.ctx.Err()
	default:
		return b.reader.Read(p)
	}
}

func (b *contextAwareBody) Close() error { return nil }
