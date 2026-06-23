package handlers

import (
	"errors"
	"strings"

	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/providersecrets"
)

var errWhatsAppCredentialsUnavailable = errors.New("WhatsApp credentials unavailable")

func whatsappAccessTokenForBusiness(biz models.Business) (string, error) {
	if strings.TrimSpace(biz.WAPhoneNumberID) == "" || !providersecrets.HasProviderToken(biz.WAAccessToken) {
		return "", errWhatsAppCredentialsUnavailable
	}
	token, err := providersecrets.DecryptProviderToken(biz.WAAccessToken)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(token) == "" {
		return "", errWhatsAppCredentialsUnavailable
	}
	return token, nil
}
