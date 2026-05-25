package handlers

import (
	"strings"

	"github.com/kithmina1999/salespilot/models"
)

const (
	waStatusConnected    = "connected"
	waStatusDisconnected = "disconnected"
	waStatusNotConnected = "not_connected"
)

func hasWhatsAppCredentials(biz models.Business) bool {
	return strings.TrimSpace(biz.WAPhoneNumberID) != "" &&
		strings.TrimSpace(biz.WAAccessToken) != ""
}

func effectiveWAStatus(biz models.Business) string {
	if !hasWhatsAppCredentials(biz) {
		return waStatusNotConnected
	}

	switch strings.TrimSpace(biz.WAStatus) {
	case waStatusConnected:
		return waStatusConnected
	case waStatusDisconnected:
		return waStatusDisconnected
	case waStatusNotConnected, "":
		return waStatusNotConnected
	default:
		return waStatusDisconnected
	}
}
