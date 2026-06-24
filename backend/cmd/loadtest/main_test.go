package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestRunLoadTestSupports100ConcurrentUsers(t *testing.T) {
	const vus = 100

	var firstWave int32
	var inFlight int32
	var maxInFlight int32
	release := make(chan struct{})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		current := atomic.AddInt32(&inFlight, 1)
		defer atomic.AddInt32(&inFlight, -1)

		for {
			maxSeen := atomic.LoadInt32(&maxInFlight)
			if current <= maxSeen || atomic.CompareAndSwapInt32(&maxInFlight, maxSeen, current) {
				break
			}
		}

		if atomic.AddInt32(&firstWave, 1) == vus {
			close(release)
		}

		select {
		case <-release:
		case <-time.After(2 * time.Second):
			t.Error("timed out waiting for 100 concurrent requests")
		}

		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	result := runLoadTest(context.Background(), config{
		URL:          server.URL,
		Method:       http.MethodGet,
		VUs:          vus,
		Duration:     500 * time.Millisecond,
		Timeout:      5 * time.Second,
		ExpectStatus: http.StatusOK,
		MaxErrorRate: 0,
		MaxP95:       5 * time.Second,
	})

	if result.Total < vus {
		t.Fatalf("expected at least %d requests, got %d", vus, result.Total)
	}
	if result.Failed != 0 {
		t.Fatalf("expected no failed requests, got %d: %#v", result.Failed, result.Errors)
	}
	if got := atomic.LoadInt32(&maxInFlight); got < vus {
		t.Fatalf("expected %d concurrent requests, saw %d", vus, got)
	}
}

func TestEvaluateFailsWhenThresholdsAreExceeded(t *testing.T) {
	err := evaluate(summary{
		Total:     100,
		Failed:    2,
		ErrorRate: 0.02,
		P95:       250 * time.Millisecond,
	}, config{
		MaxErrorRate: 0.01,
		MaxP95:       time.Second,
	})
	if err == nil {
		t.Fatal("expected error-rate threshold failure")
	}

	err = evaluate(summary{
		Total:     100,
		Failed:    0,
		ErrorRate: 0,
		P95:       2 * time.Second,
	}, config{
		MaxErrorRate: 0.01,
		MaxP95:       time.Second,
	})
	if err == nil {
		t.Fatal("expected p95 threshold failure")
	}
}
