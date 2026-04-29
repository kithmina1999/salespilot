package whatsapp

import (
	"fmt"
	"sync"
)

// customerMutexes serializes concurrent webhook requests from the same customer.
// Key: "<businessID>:<phone>" — isolated per business to prevent cross-tenant interference.
var customerMutexes sync.Map

// lockCustomer acquires a per-customer mutex and returns an unlock function.
// Usage:
//
//	unlock := lockCustomer(business.ID, phone)
//	defer unlock()
func lockCustomer(businessID uint, phone string) func() {
	key := fmt.Sprintf("%d:%s", businessID, phone)
	val, _ := customerMutexes.LoadOrStore(key, &sync.Mutex{})
	mu := val.(*sync.Mutex)
	mu.Lock()
	return mu.Unlock
}
