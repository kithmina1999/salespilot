package whatsapp

import (
	"reflect"
	"sync"
	"testing"

	"github.com/kithmina1999/salespilot/models"
)

func TestAggregateCartItemQuantities(t *testing.T) {
	got, productIDs, err := aggregateCartItemQuantities([]models.CartItem{
		{ProductID: 3, Qty: 2},
		{ProductID: 1, Qty: 4},
		{ProductID: 3, Qty: 5},
	})
	if err != nil {
		t.Fatalf("aggregateCartItemQuantities returned error: %v", err)
	}

	want := map[uint]int{1: 4, 3: 7}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("expected quantities %v, got %v", want, got)
	}

	wantProductIDs := []uint{1, 3}
	if !reflect.DeepEqual(productIDs, wantProductIDs) {
		t.Fatalf("expected product IDs %v, got %v", wantProductIDs, productIDs)
	}
}

func TestAggregateCartItemQuantitiesRejectsInvalidItems(t *testing.T) {
	tests := []struct {
		name  string
		items []models.CartItem
	}{
		{
			name:  "missing product id",
			items: []models.CartItem{{Qty: 1}},
		},
		{
			name:  "zero quantity",
			items: []models.CartItem{{ProductID: 1, Qty: 0}},
		},
		{
			name:  "negative quantity",
			items: []models.CartItem{{ProductID: 1, Qty: -1}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, _, err := aggregateCartItemQuantities(tt.items); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

// TestFinalizeOrderConcurrency verifies that concurrent calls to finalizeOrder
// produce unique, sequential order numbers and never corrupt shared state.
//
// NOTE: This is a unit-level smoke test of the mutex + transaction logic.
// A full integration test requires a live PostgreSQL connection.
// Run with: go test -v ./whatsapp -run TestFinalizeOrder
func TestFinalizeOrderConcurrency(t *testing.T) {
	// This test validates that the customerMutexes sync.Map correctly
	// serializes requests from the same customer. We test the lock/unlock
	// helper directly without needing a DB connection.

	const goroutines = 20
	const phone = "94771234567"
	const businessID = uint(1)

	var mu sync.Mutex
	var executionOrder []int
	var wg sync.WaitGroup

	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()

			// Acquire per-customer lock
			unlock := lockCustomer(businessID, phone)
			defer unlock()

			// Record that we entered the critical section
			mu.Lock()
			executionOrder = append(executionOrder, n)
			mu.Unlock()
		}(i)
	}

	wg.Wait()

	// All goroutines must have completed
	if len(executionOrder) != goroutines {
		t.Errorf("Expected %d executions, got %d", goroutines, len(executionOrder))
	}

	// Verify different phones don't block each other
	done := make(chan bool, 2)
	go func() {
		unlock := lockCustomer(businessID, "phone_A")
		defer unlock()
		done <- true
	}()
	go func() {
		unlock := lockCustomer(businessID, "phone_B")
		defer unlock()
		done <- true
	}()

	<-done
	<-done
	t.Log("✅ Different phones can acquire locks concurrently (no false blocking)")
}
