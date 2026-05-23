package handlers

import (
	"fmt"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

const (
	checkoutTypeSubscription = "subscription"
	checkoutTypeMixed        = "mixed"
	checkoutTypeAddonOnly    = "addon_only"
)

type addonPurchaseState struct {
	Key                string
	ServiceInstanceKey string
}

func normalizeCheckoutType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case checkoutTypeSubscription, checkoutTypeMixed, checkoutTypeAddonOnly:
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return ""
	}
}

func addonServiceInstanceKey(biz models.Business) string {
	if phoneID := strings.TrimSpace(biz.WAPhoneNumberID); phoneID != "" {
		return "wa_phone:" + phoneID
	}
	if wabaID := strings.TrimSpace(biz.WABAID); wabaID != "" {
		return "waba:" + wabaID
	}
	if biz.ConnectedAt != nil {
		return "connected_at:" + biz.ConnectedAt.UTC().Format(time.RFC3339Nano)
	}
	if biz.ID > 0 {
		return fmt.Sprintf("business:%d:no_connection", biz.ID)
	}
	return "no_connection"
}

func loadAddonPurchaseStates(db *gorm.DB, businessID uint) ([]addonPurchaseState, error) {
	var states []addonPurchaseState
	err := db.Raw(`
		SELECT l.key, COALESCE(l.service_instance_key, '') AS service_instance_key
		FROM payment_proof_line_items l
		JOIN payment_proofs p ON p.id = l.payment_proof_id
		WHERE p.business_id = ? AND p.status IN (?, ?) AND l.item_type = ?
		UNION ALL
		SELECT addon_key AS key, COALESCE(service_instance_key, '') AS service_instance_key
		FROM billing_service_purchases
		WHERE business_id = ? AND status IN (?, ?)
	`, businessID, models.PaymentStatusPending, models.PaymentStatusApproved, models.ItemTypeAddon,
		businessID, models.ServiceStatusPaid, models.ServiceStatusFulfilled).Scan(&states).Error
	return states, err
}

func uniquePurchasedAddonKeys(states []addonPurchaseState) []string {
	seen := map[string]bool{}
	keys := make([]string, 0, len(states))
	for _, state := range states {
		if state.Key == "" || seen[state.Key] {
			continue
		}
		seen[state.Key] = true
		keys = append(keys, state.Key)
	}
	return keys
}

func addonWasPurchasedForBusiness(states []addonPurchaseState, key string) bool {
	for _, state := range states {
		if state.Key == key {
			return true
		}
	}
	return false
}

func addonWasPurchasedForConnection(states []addonPurchaseState, key string, serviceInstanceKey string) bool {
	for _, state := range states {
		if state.Key != key {
			continue
		}
		if state.ServiceInstanceKey == "" || state.ServiceInstanceKey == serviceInstanceKey {
			return true
		}
	}
	return false
}

func billingAddonDisabledReason(addon models.BillingAddon, biz models.Business, checkoutType string, states []addonPurchaseState) string {
	serviceInstanceKey := addonServiceInstanceKey(biz)
	switch addon.PurchasePolicy {
	case models.PurchasePolicyOncePerBusiness:
		if addonWasPurchasedForBusiness(states, addon.Key) {
			return "Already purchased"
		}
	case models.PurchasePolicyOncePerConnection:
		if addonWasPurchasedForConnection(states, addon.Key, serviceInstanceKey) {
			return "Already purchased for this WhatsApp connection"
		}
	}

	if addon.RequiresWAStatus == models.AddonWAStatusConnected && biz.WAStatus != "connected" {
		return "Requires WhatsApp to be connected"
	}
	if addon.RequiresWAStatus == models.AddonWAStatusNotConnected && biz.WAStatus == "connected" {
		return "WhatsApp is already connected"
	}

	switch normalizeCheckoutType(checkoutType) {
	case checkoutTypeSubscription, checkoutTypeMixed:
		if addon.CheckoutAvailability == models.AddonCheckoutStandaloneOnly {
			return "Only available as a standalone service"
		}
	case checkoutTypeAddonOnly:
		if addon.CheckoutAvailability == models.AddonCheckoutSubOnly {
			return "Must be purchased with a subscription"
		}
	}

	return ""
}
