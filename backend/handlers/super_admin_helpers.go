package handlers

import (
	"errors"
	"fmt"
	"strings"
)

// ValidateHighRiskAction ensures a high risk action is correctly confirmed.
func ValidateHighRiskAction(reason, confirmText, expected string) error {
	reason = strings.TrimSpace(reason)
	confirmText = strings.TrimSpace(confirmText)

	if reason == "" {
		return errors.New("reason is required for this action")
	}

	if confirmText != expected {
		return fmt.Errorf("type %q to confirm", expected)
	}

	return nil
}
