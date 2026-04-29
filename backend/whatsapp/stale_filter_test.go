package whatsapp

import (
	"fmt"
	"strconv"
	"testing"
	"time"
)

func TestStaleMessageFilter(t *testing.T) {
	const staleThreshold = 5 * time.Minute

	tests := []struct {
		name      string
		tsOffset  time.Duration // negative = past
		wantStale bool
	}{
		{"fresh (10s ago)", -10 * time.Second, false},
		{"fresh (4m59s ago)", -(5*time.Minute - time.Second), false},
		{"exactly 5 minutes ago", -5 * time.Minute, true},
		{"stale (10 minutes ago)", -10 * time.Minute, true},
		{"stale (1 hour ago)", -1 * time.Hour, true},
		{"stale (24 hours ago — Meta retry storm)", -24 * time.Hour, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ts := time.Now().Add(tt.tsOffset).Unix()
			tsStr := strconv.FormatInt(ts, 10)

			parsedTs, err := strconv.ParseInt(tsStr, 10, 64)
			if err != nil {
				t.Fatalf("failed to parse timestamp: %v", err)
			}

			msgTime := time.Unix(parsedTs, 0)
			isStale := time.Since(msgTime) > staleThreshold

			if isStale != tt.wantStale {
				t.Errorf("%s: got stale=%v, want stale=%v (age=%v)",
					tt.name, isStale, tt.wantStale,
					time.Since(msgTime).Round(time.Second))
			} else {
				status := "✅ fresh"
				if isStale {
					status = "⏱️ stale"
				}
				fmt.Printf("  %s — %s (age=%v)\n", status, tt.name,
					time.Since(msgTime).Round(time.Second))
			}
		})
	}
}
