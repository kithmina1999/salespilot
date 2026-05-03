package whatsapp

import "github.com/kithmina1999/salespilot/cache"

// AppStore is the package-level StateStore injected at startup.
// All bot subsystems (BehaviorScorer, PromptShield token budgets,
// first-message-of-day checks) consume this single instance.
//
// Using an interface here means the entire pipeline is agnostic
// to whether the backend is in-memory or Redis.
var AppStore cache.StateStore

// appScorer is the package-level BehaviorScorer backed by AppStore.
var appScorer *BehaviorScorer

// SetStateStore wires the server-bootstrapped store into the whatsapp pipeline.
// Called once from main.go before any webhook arrives.
func SetStateStore(s cache.StateStore) {
	AppStore = s
	appScorer = NewBehaviorScorer(s)
	appGreeter = NewFirstOfDayGreeter(s)
}

// GetScorer returns the package-level BehaviorScorer.
// Falls back to an ephemeral in-memory scorer if SetStateStore was never called
// (e.g. in isolated unit tests or cold-start scenarios).
func GetScorer() *BehaviorScorer {
	if appScorer == nil {
		appScorer = NewBehaviorScorer(cache.NewInMemoryStore(cache.DefaultConfig()))
	}
	return appScorer
}
