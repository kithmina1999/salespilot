package errorreporting

import (
	"context"
	"crypto/sha256"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kithmina1999/salespilot/observability"
	"github.com/kithmina1999/salespilot/utils"
)

const defaultCooldown = 5 * time.Minute

var allowedAttributes = map[string]struct{}{
	"business_id": {},
	"dependency":  {},
	"error_code":  {},
	"operation":   {},
	"request_id":  {},
	"route":       {},
	"status":      {},
}

type DiscordReporter struct {
	queue    chan observability.ErrorEvent
	cooldown time.Duration
	mu       sync.Mutex
	seen     map[string]time.Time
	closed   chan struct{}
	once     sync.Once
}

func NewDiscordReporter(queueSize int) *DiscordReporter {
	if queueSize <= 0 {
		queueSize = 100
	}
	reporter := &DiscordReporter{
		queue:    make(chan observability.ErrorEvent, queueSize),
		cooldown: defaultCooldown,
		seen:     make(map[string]time.Time),
		closed:   make(chan struct{}),
	}
	go reporter.run()
	return reporter
}

func (r *DiscordReporter) Capture(ctx context.Context, event observability.ErrorEvent) {
	select {
	case r.queue <- event:
	default:
		observability.Logger(ctx).WarnContext(ctx, "error reporter queue full",
			"error_code", "error_reporter_queue_full",
		)
	}
}

func (r *DiscordReporter) Close() {
	r.once.Do(func() { close(r.closed) })
}

func (r *DiscordReporter) run() {
	for {
		select {
		case event := <-r.queue:
			r.report(event)
		case <-r.closed:
			return
		}
	}
}

func (r *DiscordReporter) report(event observability.ErrorEvent) {
	fields := safeFields(event.Attributes)
	fingerprint := eventFingerprint(event.Message, fields)
	now := time.Now()
	if r.suppressed(fingerprint, now) {
		return
	}

	var body strings.Builder
	body.WriteString("**Event:** ")
	body.WriteString(event.Message)
	for _, key := range sortedKeys(fields) {
		body.WriteString("\n**")
		body.WriteString(key)
		body.WriteString(":** `")
		body.WriteString(fields[key])
		body.WriteString("`")
	}
	if event.Err != nil {
		body.WriteString("\n**Error type:** `")
		body.WriteString(fmt.Sprintf("%T", event.Err))
		body.WriteString("`")
	}

	utils.SendDiscordAlert(utils.AlertCritical, "Backend Error", body.String())
}

func (r *DiscordReporter) suppressed(fingerprint string, now time.Time) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if last, exists := r.seen[fingerprint]; exists && now.Sub(last) < r.cooldown {
		return true
	}
	r.seen[fingerprint] = now
	for key, last := range r.seen {
		if now.Sub(last) > 2*r.cooldown {
			delete(r.seen, key)
		}
	}
	return false
}

func safeFields(attributes map[string]any) map[string]string {
	fields := make(map[string]string)
	for key, value := range attributes {
		if _, allowed := allowedAttributes[key]; allowed {
			fields[key] = fmt.Sprint(value)
		}
	}
	return fields
}

func eventFingerprint(message string, fields map[string]string) string {
	parts := []string{message, fields["dependency"], fields["operation"], fields["error_code"], fields["route"], fields["status"]}
	sum := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return fmt.Sprintf("%x", sum[:8])
}

func sortedKeys(fields map[string]string) []string {
	keys := make([]string, 0, len(fields))
	for key := range fields {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

var _ observability.ErrorReporter = (*DiscordReporter)(nil)
