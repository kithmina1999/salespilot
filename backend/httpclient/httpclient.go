package httpclient

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kithmina1999/salespilot/observability"
)

const ExternalAPITimeout = 30 * time.Second

type Dependency string

const (
	DependencyUnknown    Dependency = "unknown"
	DependencyGemini     Dependency = "gemini"
	DependencyMeta       Dependency = "meta"
	DependencyCloudinary Dependency = "cloudinary"
	DependencyResend     Dependency = "resend"
	DependencyDiscord    Dependency = "discord"
)

type RetrySafety uint8

const (
	NoRetry RetrySafety = iota
	RetryTransient
)

var ErrCircuitOpen = errors.New("dependency circuit is open")

type DependencyError struct {
	Dependency Dependency
	Operation  string
	Kind       string
	Retryable  bool
	Err        error
}

func (e *DependencyError) Error() string {
	return fmt.Sprintf("%s %s failed (%s)", e.Dependency, e.Operation, e.Kind)
}

func (e *DependencyError) Unwrap() error {
	return e.Err
}

type policy struct {
	timeout          time.Duration
	maxAttempts      int
	baseDelay        time.Duration
	maxDelay         time.Duration
	failureThreshold int
	openDuration     time.Duration
}

type Client struct {
	httpClient *http.Client
	policies   map[Dependency]policy
	breakers   map[Dependency]*circuitBreaker
	mu         sync.Mutex
	now        func() time.Time
	sleep      func(context.Context, time.Duration) error
}

type cancelOnCloseBody struct {
	io.ReadCloser
	cancel context.CancelFunc
}

func (b *cancelOnCloseBody) Close() error {
	defer b.cancel()
	return b.ReadCloser.Close()
}

var defaultClient = NewClient(newTransport())

func NewClient(transport http.RoundTripper) *Client {
	if transport == nil {
		transport = newTransport()
	}
	return &Client{
		httpClient: &http.Client{Transport: transport},
		policies:   defaultPolicies(),
		breakers:   make(map[Dependency]*circuitBreaker),
		now:        time.Now,
		sleep:      sleepContext,
	}
}

func Default() *http.Client {
	return defaultClient.httpClient
}

// Do preserves the legacy interface while applying inferred dependency
// deadlines and circuit protection. Only safe read methods retry implicitly.
func Do(req *http.Request) (*http.Response, error) {
	return defaultClient.Do(req.Context(), inferDependency(req.URL.Host), req.Method, req, retrySafetyForMethod(req.Method))
}

// Post preserves the legacy interface. POST retries remain disabled because
// callers must explicitly prove the operation is safe to repeat.
func Post(url, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", contentType)
	return defaultClient.Do(req.Context(), inferDependency(req.URL.Host), "POST", req, NoRetry)
}

func DoContext(ctx context.Context, dependency Dependency, operation string, req *http.Request, retrySafety RetrySafety) (*http.Response, error) {
	return defaultClient.Do(ctx, dependency, operation, req, retrySafety)
}

func PostJSONContext(ctx context.Context, dependency Dependency, operation, url string, body []byte, retrySafety RetrySafety) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return defaultClient.Do(ctx, dependency, operation, req, retrySafety)
}

func (c *Client) Do(ctx context.Context, dependency Dependency, operation string, req *http.Request, retrySafety RetrySafety) (*http.Response, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if dependency == "" {
		dependency = inferDependency(req.URL.Host)
	}
	if operation == "" {
		operation = req.Method
	}

	policy := c.policyFor(dependency)
	operationCtx, cancel := context.WithTimeout(ctx, policy.timeout)

	breaker := c.breakerFor(dependency, policy)
	if !breaker.Allow(c.now()) {
		cancel()
		err := &DependencyError{
			Dependency: dependency,
			Operation:  operation,
			Kind:       "circuit_open",
			Retryable:  true,
			Err:        ErrCircuitOpen,
		}
		observability.Logger(ctx).WarnContext(ctx, "dependency request rejected by circuit breaker",
			"dependency", dependency,
			"operation", operation,
			"error_code", err.Kind,
		)
		return nil, err
	}

	maxAttempts := 1
	if retrySafety == RetryTransient {
		maxAttempts = policy.maxAttempts
	}

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		attemptReq, err := requestForAttempt(req, operationCtx, attempt)
		if err != nil {
			cancel()
			breaker.RecordSuccess()
			return nil, &DependencyError{Dependency: dependency, Operation: operation, Kind: "request_build", Err: err}
		}

		started := c.now()
		resp, requestErr := c.httpClient.Do(attemptReq)
		duration := c.now().Sub(started)
		if requestErr != nil && errors.Is(requestErr, context.Canceled) {
			drainAndClose(resp)
			cancel()
			breaker.RecordIgnored(c.now())
			return nil, dependencyError(dependency, operation, operationCtx, requestErr, false)
		}
		transient := isTransient(requestErr, resp)

		if !transient {
			breaker.RecordSuccess()
			logDependencyResult(operationCtx, dependency, operation, attempt, duration, resp, requestErr)
			if requestErr != nil {
				drainAndClose(resp)
				cancel()
				return nil, dependencyError(dependency, operation, operationCtx, requestErr, false)
			}
			return responseWithCancel(resp, cancel), nil
		}

		if attempt == maxAttempts || !canReplay(req, attempt) {
			opened := breaker.RecordFailure(c.now())
			logDependencyFailure(operationCtx, dependency, operation, attempt, duration, resp, requestErr, opened)
			if requestErr != nil {
				drainAndClose(resp)
				cancel()
				return nil, dependencyError(dependency, operation, operationCtx, requestErr, true)
			}
			return responseWithCancel(resp, cancel), nil
		}

		delay := retryDelay(policy, attempt, resp, c.now())
		logRetry(operationCtx, dependency, operation, attempt, delay, resp, requestErr)
		drainAndClose(resp)
		if err := c.sleep(operationCtx, delay); err != nil {
			opened := breaker.RecordFailure(c.now())
			if opened {
				logCircuitOpened(operationCtx, dependency, operation)
			}
			cancel()
			return nil, dependencyError(dependency, operation, operationCtx, err, true)
		}
	}

	cancel()
	return nil, &DependencyError{Dependency: dependency, Operation: operation, Kind: "unknown", Err: errors.New("request attempts exhausted")}
}

func responseWithCancel(resp *http.Response, cancel context.CancelFunc) *http.Response {
	if resp == nil || resp.Body == nil {
		cancel()
		return resp
	}
	resp.Body = &cancelOnCloseBody{ReadCloser: resp.Body, cancel: cancel}
	return resp
}

func (c *Client) policyFor(dependency Dependency) policy {
	if configured, ok := c.policies[dependency]; ok {
		return configured
	}
	return c.policies[DependencyUnknown]
}

func (c *Client) breakerFor(dependency Dependency, configured policy) *circuitBreaker {
	c.mu.Lock()
	defer c.mu.Unlock()
	breaker := c.breakers[dependency]
	if breaker == nil {
		breaker = newCircuitBreaker(configured.failureThreshold, configured.openDuration)
		c.breakers[dependency] = breaker
	}
	return breaker
}

func defaultPolicies() map[Dependency]policy {
	base := policy{
		timeout:          ExternalAPITimeout,
		maxAttempts:      3,
		baseDelay:        250 * time.Millisecond,
		maxDelay:         2 * time.Second,
		failureThreshold: 5,
		openDuration:     30 * time.Second,
	}
	return map[Dependency]policy{
		DependencyUnknown:    base,
		DependencyGemini:     base,
		DependencyMeta:       withTimeout(base, 15*time.Second),
		DependencyCloudinary: base,
		DependencyResend:     withTimeout(base, 10*time.Second),
		DependencyDiscord:    withTimeout(base, 5*time.Second),
	}
}

func withTimeout(configured policy, timeout time.Duration) policy {
	configured.timeout = timeout
	return configured
}

func requestForAttempt(req *http.Request, ctx context.Context, attempt int) (*http.Request, error) {
	clone := req.Clone(ctx)
	if req.Body == nil {
		return clone, nil
	}
	if req.GetBody != nil {
		body, err := req.GetBody()
		if err != nil {
			return nil, err
		}
		clone.Body = body
		return clone, nil
	}
	if attempt == 1 {
		clone.Body = req.Body
		return clone, nil
	}
	return nil, errors.New("request body cannot be replayed")
}

func canReplay(req *http.Request, attempt int) bool {
	return req.Body == nil || req.GetBody != nil || attempt == 0
}

func isTransient(err error, resp *http.Response) bool {
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return false
		}
		if errors.Is(err, context.DeadlineExceeded) {
			return true
		}
		var networkErr net.Error
		return errors.As(err, &networkErr)
	}
	if resp == nil {
		return false
	}
	switch resp.StatusCode {
	case http.StatusRequestTimeout,
		http.StatusTooManyRequests,
		http.StatusInternalServerError,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
		http.StatusGatewayTimeout:
		return true
	default:
		return false
	}
}

func retryDelay(configured policy, attempt int, resp *http.Response, now time.Time) time.Duration {
	if fromHeader, ok := retryAfter(resp, now); ok {
		return fromHeader
	}
	delay := configured.baseDelay * time.Duration(1<<(attempt-1))
	if delay > configured.maxDelay {
		delay = configured.maxDelay
	}
	jitterRange := delay / 4
	if jitterRange <= 0 {
		return delay
	}
	return delay - jitterRange + time.Duration(rand.Int63n(int64(2*jitterRange)+1))
}

func retryAfter(resp *http.Response, now time.Time) (time.Duration, bool) {
	if resp == nil {
		return 0, false
	}
	raw := strings.TrimSpace(resp.Header.Get("Retry-After"))
	if raw == "" {
		return 0, false
	}
	if seconds, err := strconv.Atoi(raw); err == nil && seconds >= 0 {
		return time.Duration(seconds) * time.Second, true
	}
	when, err := http.ParseTime(raw)
	if err != nil || !when.After(now) {
		return 0, false
	}
	return when.Sub(now), true
}

func dependencyError(dependency Dependency, operation string, ctx context.Context, err error, retryable bool) error {
	kind := "transport"
	switch {
	case errors.Is(ctx.Err(), context.DeadlineExceeded), errors.Is(err, context.DeadlineExceeded):
		kind = "timeout"
	case errors.Is(ctx.Err(), context.Canceled), errors.Is(err, context.Canceled):
		kind = "canceled"
		retryable = false
	}
	return &DependencyError{Dependency: dependency, Operation: operation, Kind: kind, Retryable: retryable, Err: err}
}

func drainAndClose(resp *http.Response) {
	if resp == nil || resp.Body == nil {
		return
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	_ = resp.Body.Close()
}

func retrySafetyForMethod(method string) RetrySafety {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return RetryTransient
	default:
		return NoRetry
	}
}

func inferDependency(host string) Dependency {
	host = strings.ToLower(host)
	switch {
	case strings.Contains(host, "generativelanguage.googleapis.com"):
		return DependencyGemini
	case strings.Contains(host, "graph.facebook.com"):
		return DependencyMeta
	case strings.Contains(host, "cloudinary.com"):
		return DependencyCloudinary
	case strings.Contains(host, "api.resend.com"):
		return DependencyResend
	case strings.Contains(host, "discord.com") || strings.Contains(host, "discordapp.com"):
		return DependencyDiscord
	default:
		return DependencyUnknown
	}
}

func newTransport() *http.Transport {
	return &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           (&net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   20,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: ExternalAPITimeout,
		ExpectContinueTimeout: time.Second,
	}
}

func sleepContext(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func logDependencyResult(ctx context.Context, dependency Dependency, operation string, attempt int, duration time.Duration, resp *http.Response, err error) {
	attrs := dependencyAttrs(dependency, operation, attempt, duration, resp)
	logger := observability.Logger(ctx)
	if err != nil {
		attrs = append(attrs, "error_type", safeErrorType(err))
		logger.ErrorContext(ctx, "dependency request failed", attrs...)
		return
	}
	logger.DebugContext(ctx, "dependency request completed", attrs...)
}

func logDependencyFailure(ctx context.Context, dependency Dependency, operation string, attempt int, duration time.Duration, resp *http.Response, err error, opened bool) {
	attrs := dependencyAttrs(dependency, operation, attempt, duration, resp)
	attrs = append(attrs, "retry_exhausted", true)
	if err != nil {
		attrs = append(attrs, "error_type", safeErrorType(err))
	}
	observability.Logger(ctx).ErrorContext(ctx, "dependency request exhausted resilience policy", attrs...)
	if dependency != DependencyDiscord {
		status := 0
		if resp != nil {
			status = resp.StatusCode
		}
		observability.CaptureError(ctx, "Dependency request exhausted resilience policy", &DependencyError{
			Dependency: dependency,
			Operation:  operation,
			Kind:       "retry_exhausted",
			Retryable:  true,
			Err:        err,
		}, map[string]any{
			"request_id": observability.RequestID(ctx),
			"dependency": dependency,
			"operation":  operation,
			"error_code": "retry_exhausted",
			"status":     status,
		})
	}
	if opened {
		logCircuitOpened(ctx, dependency, operation)
	}
}

func logRetry(ctx context.Context, dependency Dependency, operation string, attempt int, delay time.Duration, resp *http.Response, err error) {
	attrs := []any{
		"dependency", dependency,
		"operation", operation,
		"attempt", attempt,
		"retry_delay_ms", delay.Milliseconds(),
	}
	if resp != nil {
		attrs = append(attrs, "status", resp.StatusCode)
	}
	if err != nil {
		attrs = append(attrs, "error_type", safeErrorType(err))
	}
	observability.Logger(ctx).WarnContext(ctx, "retrying transient dependency failure", attrs...)
}

func logCircuitOpened(ctx context.Context, dependency Dependency, operation string) {
	observability.Logger(ctx).ErrorContext(ctx, "dependency circuit opened",
		"dependency", dependency,
		"operation", operation,
		"error_code", "circuit_opened",
	)
	if dependency != DependencyDiscord {
		observability.CaptureError(ctx, "Dependency circuit opened", ErrCircuitOpen, map[string]any{
			"request_id": observability.RequestID(ctx),
			"dependency": dependency,
			"operation":  operation,
			"error_code": "circuit_opened",
		})
	}
}

func dependencyAttrs(dependency Dependency, operation string, attempt int, duration time.Duration, resp *http.Response) []any {
	attrs := []any{
		"dependency", dependency,
		"operation", operation,
		"attempt", attempt,
		"duration_ms", duration.Milliseconds(),
	}
	if resp != nil {
		attrs = append(attrs, "status", resp.StatusCode)
	}
	return attrs
}

func safeErrorType(err error) string {
	switch {
	case err == nil:
		return ""
	case errors.Is(err, context.DeadlineExceeded):
		return "deadline_exceeded"
	case errors.Is(err, context.Canceled):
		return "canceled"
	default:
		var networkErr net.Error
		if errors.As(err, &networkErr) {
			return "network_error"
		}
		return fmt.Sprintf("%T", err)
	}
}

type breakerState uint8

const (
	breakerClosed breakerState = iota
	breakerOpen
	breakerHalfOpen
)

type circuitBreaker struct {
	mu               sync.Mutex
	state            breakerState
	failures         int
	failureThreshold int
	openedAt         time.Time
	openDuration     time.Duration
	halfOpenInFlight bool
}

func newCircuitBreaker(failureThreshold int, openDuration time.Duration) *circuitBreaker {
	return &circuitBreaker{failureThreshold: failureThreshold, openDuration: openDuration}
}

func (b *circuitBreaker) Allow(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	switch b.state {
	case breakerClosed:
		return true
	case breakerOpen:
		if now.Sub(b.openedAt) < b.openDuration {
			return false
		}
		b.state = breakerHalfOpen
		b.halfOpenInFlight = true
		return true
	case breakerHalfOpen:
		if b.halfOpenInFlight {
			return false
		}
		b.halfOpenInFlight = true
		return true
	default:
		return false
	}
}

func (b *circuitBreaker) RecordSuccess() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.state = breakerClosed
	b.failures = 0
	b.halfOpenInFlight = false
}

func (b *circuitBreaker) RecordFailure(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.halfOpenInFlight = false
	if b.state == breakerHalfOpen {
		b.state = breakerOpen
		b.openedAt = now
		return true
	}
	b.failures++
	if b.failures < b.failureThreshold {
		return false
	}
	b.state = breakerOpen
	b.openedAt = now
	return true
}

func (b *circuitBreaker) RecordIgnored(now time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.state == breakerHalfOpen {
		b.state = breakerOpen
		b.openedAt = now
	}
	b.halfOpenInFlight = false
}
