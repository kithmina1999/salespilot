package observability

import (
	"context"
	"sync"
)

type ErrorEvent struct {
	Message    string
	Err        error
	Attributes map[string]any
}

type ErrorReporter interface {
	Capture(context.Context, ErrorEvent)
}

type noopReporter struct{}

func (noopReporter) Capture(context.Context, ErrorEvent) {}

var reporterState = struct {
	sync.RWMutex
	reporter ErrorReporter
}{reporter: noopReporter{}}

func SetErrorReporter(reporter ErrorReporter) {
	if reporter == nil {
		reporter = noopReporter{}
	}
	reporterState.Lock()
	reporterState.reporter = reporter
	reporterState.Unlock()
}

func CaptureError(ctx context.Context, message string, err error, attributes map[string]any) {
	reporterState.RLock()
	reporter := reporterState.reporter
	reporterState.RUnlock()
	reporter.Capture(ctx, ErrorEvent{Message: message, Err: err, Attributes: attributes})
}
