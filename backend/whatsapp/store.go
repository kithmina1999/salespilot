package whatsapp

import "github.com/kithmina1999/salespilot/cache"

// AppStore is the package-level StateStore injected at startup.
// All bot subsystems (BehaviorScorer, PromptShield token budgets,
// first-message-of-day checks) consume this single instance.
//
// Using an interface here means the entire pipeline is agnostic
// to whether the backend is in-memory or Redis.
var AppStore cache.StateStore

// SetStateStore wires the server-bootstrapped store into the whatsapp pipeline.
// Called once from main.go before any webhook arrives.
func SetStateStore(s cache.StateStore) {
	AppStore = s
}
