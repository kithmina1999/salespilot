package whatsapp

import (
	"strings"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

const SandboxSimulatorPhone = "99900000000"

func isSandboxPhone(phone string) bool {
	return strings.TrimSpace(phone) == SandboxSimulatorPhone
}

func persistSandboxBotMessage(business *models.Business, phone, content string) error {
	if business == nil || !isSandboxPhone(phone) {
		return nil
	}

	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}

	return database.DB.Create(&models.Message{
		BusinessID: business.ID,
		Phone:      SandboxSimulatorPhone,
		Role:       "model",
		Content:    content,
	}).Error
}
