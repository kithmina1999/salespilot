package whatsapp

import "fmt"

// ─── Interactive Message Types ─────────────────────────────────────────────────

// Button represents a WhatsApp quick-reply button (up to 3 per message).
type Button struct {
	ID    string // unique ID, max 256 chars — returned in webhook on tap
	Title string // button label, max 20 chars
}

// ListRow is a single row inside a ListSection.
type ListRow struct {
	ID          string // unique ID returned on selection
	Title       string // main label, max 24 chars
	Description string // optional subtitle, max 72 chars
}

// ListSection groups rows in a List Message.
type ListSection struct {
	Title string    // section header (optional but recommended)
	Rows  []ListRow // up to 10 rows per section
}

// ─── Send Functions ────────────────────────────────────────────────────────────

// SendButtons sends a WhatsApp Interactive message with up to 3 quick-reply buttons.
// phoneNumberID — sender's Meta Phone Number ID
// accessToken   — system user / permanent access token
// to            — recipient E.164 phone (e.g. "94771234567")
// bodyText      — the message body (max 1024 chars)
// buttons       — 1–3 tap buttons; extra buttons beyond 3 are silently trimmed
func SendButtons(phoneNumberID, accessToken, to, bodyText string, buttons []Button) error {
	if len(buttons) == 0 {
		return fmt.Errorf("SendButtons: at least one button is required")
	}
	if len(buttons) > 3 {
		buttons = buttons[:3] // Meta hard limit
	}

	metaButtons := make([]map[string]interface{}, len(buttons))
	for i, b := range buttons {
		metaButtons[i] = map[string]interface{}{
			"type": "reply",
			"reply": map[string]string{
				"id":    b.ID,
				"title": b.Title,
			},
		}
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                to,
		"type":              "interactive",
		"interactive": map[string]interface{}{
			"type": "button",
			"body": map[string]string{
				"text": bodyText,
			},
			"action": map[string]interface{}{
				"buttons": metaButtons,
			},
		},
	}

	return sendInteractive(phoneNumberID, accessToken, payload)
}

// SendList sends a WhatsApp Interactive List Message.
// phoneNumberID — sender's Meta Phone Number ID
// accessToken   — system user / permanent access token
// to            — recipient E.164 phone
// bodyText      — the message body shown above the list button
// buttonLabel   — text on the button that opens the list (max 20 chars)
// sections      — grouped list items; total rows across all sections max 10
func SendList(phoneNumberID, accessToken, to, bodyText, buttonLabel string, sections []ListSection) error {
	if len(sections) == 0 {
		return fmt.Errorf("SendList: at least one section with rows is required")
	}

	metaSections := make([]map[string]interface{}, len(sections))
	for i, s := range sections {
		rows := make([]map[string]interface{}, len(s.Rows))
		for j, r := range s.Rows {
			rows[j] = map[string]interface{}{
				"id":          r.ID,
				"title":       r.Title,
				"description": r.Description,
			}
		}
		metaSections[i] = map[string]interface{}{
			"title": s.Title,
			"rows":  rows,
		}
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                to,
		"type":              "interactive",
		"interactive": map[string]interface{}{
			"type": "list",
			"body": map[string]string{
				"text": bodyText,
			},
			"action": map[string]interface{}{
				"button":   buttonLabel,
				"sections": metaSections,
			},
		},
	}

	return sendInteractive(phoneNumberID, accessToken, payload)
}
