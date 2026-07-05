package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/kithmina1999/salespilot/httpclient"
)

const metaGraphAPIVersion = "v20.0"

// SendText sends a WhatsApp text message via the Meta Cloud API.
// phoneNumberID: the sender's Phone Number ID from Meta Business Manager.
// accessToken:   the system user's permanent access token.
// to:            recipient phone in E.164 (e.g. "94771234567").
// text:          the message body.
func SendText(phoneNumberID, accessToken, to, text string) error {
	return SendTextContext(context.Background(), phoneNumberID, accessToken, to, text)
}

func SendTextContext(ctx context.Context, phoneNumberID, accessToken, to, text string) error {
	if isSandboxPhone(to) {
		log.Println("[SANDBOX] SendText skipped")
		return nil
	}

	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", metaGraphAPIVersion, phoneNumberID)

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                to,
		"type":              "text",
		"text": map[string]string{
			"preview_url": "false",
			"body":        text,
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("SendText: marshal error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("SendText: create request error: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpclient.DoContext(ctx, httpclient.DependencyMeta, "send_text", req, httpclient.NoRetry)
	if err != nil {
		return fmt.Errorf("SendText: HTTP error: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return metaAPIError("SendText", resp.StatusCode, respBody)
	}

	log.Println("SendText: message accepted by Meta")
	return nil
}

// SendAuthTemplate sends a WhatsApp authentication template via the Meta Cloud API.
// Required to reliably deliver OTPs when a user has not messaged the bot in the last 24 hours.
func SendAuthTemplate(phoneNumberID, accessToken, to, templateName, otp string) error {
	return SendAuthTemplateContext(context.Background(), phoneNumberID, accessToken, to, templateName, otp)
}

func SendAuthTemplateContext(ctx context.Context, phoneNumberID, accessToken, to, templateName, otp string) error {
	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", metaGraphAPIVersion, phoneNumberID)

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"recipient_type":    "individual",
		"to":                to,
		"type":              "template",
		"template": map[string]interface{}{
			"name": templateName,
			"language": map[string]string{
				"code": "en_US", // Make sure this matches your template language in Meta
			},
			"components": []map[string]interface{}{
				{
					"type": "body",
					"parameters": []map[string]interface{}{
						{
							"type": "text",
							"text": otp, // Injects into {{1}}
						},
					},
				},
				{
					"type":     "button",
					"sub_type": "url",
					"index":    "0",
					"parameters": []map[string]interface{}{
						{
							"type": "text",
							"text": otp, // Injects into the copy-code button
						},
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("SendAuthTemplate: marshal error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("SendAuthTemplate: create request error: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpclient.DoContext(ctx, httpclient.DependencyMeta, "send_auth_template", req, httpclient.NoRetry)
	if err != nil {
		return fmt.Errorf("SendAuthTemplate: HTTP error: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return metaAPIError("SendAuthTemplate", resp.StatusCode, respBody)
	}

	log.Println("SendAuthTemplate: message accepted by Meta")
	return nil
}

// TestCredentials verifies that the given Phone Number ID and Access Token are
// valid for BOTH reading (whatsapp_business_management) and sending
// (whatsapp_business_messaging) by checking the token's granted scopes.
//
// Previously only a GET on the phone number endpoint was made, which passes
// even for tokens without send permission — causing silent 401s when the bot
// tries to reply to customers.
func TestCredentials(phoneNumberID, accessToken string) error {
	return TestCredentialsContext(context.Background(), phoneNumberID, accessToken)
}

func TestCredentialsContext(ctx context.Context, phoneNumberID, accessToken string) error {
	// Step 1: verify the phone number ID resolves correctly
	phoneURL := fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=display_phone_number,verified_name", metaGraphAPIVersion, phoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, phoneURL, nil)
	if err != nil {
		return fmt.Errorf("TestCredentials: create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := httpclient.DoContext(ctx, httpclient.DependencyMeta, "test_phone_credentials", req, httpclient.RetryTransient)
	if err != nil {
		return fmt.Errorf("TestCredentials: HTTP error: %w", err)
	}
	respBody, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return metaAPIError("TestCredentials", resp.StatusCode, respBody)
	}

	// Step 2: check token scopes — ensure whatsapp_business_messaging is granted.
	// Without this scope the bot can READ but cannot SEND messages (401 on POST /messages).
	debugURL := fmt.Sprintf("https://graph.facebook.com/%s/debug_token?input_token=%s&access_token=%s",
		metaGraphAPIVersion, accessToken, accessToken)
	req2, err := http.NewRequestWithContext(ctx, http.MethodGet, debugURL, nil)
	if err == nil {
		resp2, err2 := httpclient.DoContext(ctx, httpclient.DependencyMeta, "inspect_token_scopes", req2, httpclient.RetryTransient)
		if err2 == nil {
			var debugBody struct {
				Data struct {
					Scopes []string `json:"scopes"`
				} `json:"data"`
			}
			body2, _ := io.ReadAll(resp2.Body)
			resp2.Body.Close()
			if err := json.Unmarshal(body2, &debugBody); err == nil && len(debugBody.Data.Scopes) > 0 {
				hasMessaging := false
				for _, s := range debugBody.Data.Scopes {
					if s == "whatsapp_business_messaging" {
						hasMessaging = true
						break
					}
				}
				if !hasMessaging {
					return fmt.Errorf(
						"token is missing 'whatsapp_business_messaging' permission — " +
							"the bot can read but CANNOT send messages. " +
							"Re-generate your token with this scope enabled in Meta Graph Explorer")
				}
			}
		}
	}

	log.Println("TestCredentials: Meta credentials verified with messaging scope")
	return nil
}

// PhoneInfo holds the human-readable details returned from Meta for a phone number ID.
type PhoneInfo struct {
	DisplayPhone string
	VerifiedName string
}

// TestCredentialsWithInfo verifies credentials AND returns display info from Meta.
// Also validates whatsapp_business_messaging scope so tokens that can READ but
// cannot SEND are rejected at connect-time (not silently at message-send time).
func TestCredentialsWithInfo(phoneNumberID, accessToken string) (*PhoneInfo, error) {
	return TestCredentialsWithInfoContext(context.Background(), phoneNumberID, accessToken)
}

func TestCredentialsWithInfoContext(ctx context.Context, phoneNumberID, accessToken string) (*PhoneInfo, error) {
	// Step 1: resolve the phone number ID
	phoneURL := fmt.Sprintf("https://graph.facebook.com/%s/%s?fields=display_phone_number,verified_name", metaGraphAPIVersion, phoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, phoneURL, nil)
	if err != nil {
		return nil, fmt.Errorf("TestCredentialsWithInfo: create request error: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := httpclient.DoContext(ctx, httpclient.DependencyMeta, "connect_phone_credentials", req, httpclient.RetryTransient)
	if err != nil {
		return nil, fmt.Errorf("TestCredentialsWithInfo: HTTP error: %w", err)
	}
	respBody, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, metaAPIError("TestCredentialsWithInfo", resp.StatusCode, respBody)
	}
	var result struct {
		DisplayPhoneNumber string `json:"display_phone_number"`
		VerifiedName       string `json:"verified_name"`
	}
	json.Unmarshal(respBody, &result) //nolint — best-effort parse

	// Step 2: check token scopes — whatsapp_business_messaging is required to send.
	// Without this scope the connect test passes (GET) but every bot reply returns 401 (POST).
	debugURL := fmt.Sprintf("https://graph.facebook.com/%s/debug_token?input_token=%s&access_token=%s",
		metaGraphAPIVersion, accessToken, accessToken)
	if req2, err2 := http.NewRequestWithContext(ctx, http.MethodGet, debugURL, nil); err2 == nil {
		if resp2, err3 := httpclient.DoContext(ctx, httpclient.DependencyMeta, "connect_token_scopes", req2, httpclient.RetryTransient); err3 == nil {
			var debugBody struct {
				Data struct {
					Scopes []string `json:"scopes"`
				} `json:"data"`
			}
			body2, _ := io.ReadAll(resp2.Body)
			resp2.Body.Close()
			if json.Unmarshal(body2, &debugBody) == nil && len(debugBody.Data.Scopes) > 0 {
				hasMessaging := false
				for _, s := range debugBody.Data.Scopes {
					if s == "whatsapp_business_messaging" {
						hasMessaging = true
						break
					}
				}
				if !hasMessaging {
					return nil, fmt.Errorf(
						"token is missing 'whatsapp_business_messaging' permission — " +
							"the bot can read but cannot send messages. " +
							"Re-generate your token with this scope in Meta Graph Explorer")
				}
			}
		}
	}

	log.Println("TestCredentialsWithInfo: Meta credentials verified with messaging scope")
	return &PhoneInfo{
		DisplayPhone: result.DisplayPhoneNumber,
		VerifiedName: result.VerifiedName,
	}, nil
}

// SubscribeWABAWebhook subscribes a WhatsApp Business Account (WABA) to this
// Meta App's webhook, so Meta will send message events to our registered
// callback URL for this tenant's WABA.
// wabaID:      the business's WhatsApp Business Account ID
// accessToken: the business's permanent access token (must have whatsapp_business_management scope)
func SubscribeWABAWebhook(wabaID, accessToken string) error {
	return SubscribeWABAWebhookContext(context.Background(), wabaID, accessToken)
}

func SubscribeWABAWebhookContext(ctx context.Context, wabaID, accessToken string) error {
	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/subscribed_apps", metaGraphAPIVersion, wabaID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return fmt.Errorf("SubscribeWABAWebhook: create request error: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpclient.DoContext(ctx, httpclient.DependencyMeta, "subscribe_waba_webhook", req, httpclient.NoRetry)
	if err != nil {
		return fmt.Errorf("SubscribeWABAWebhook: HTTP error: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return metaAPIError("SubscribeWABAWebhook", resp.StatusCode, respBody)
	}

	log.Println("SubscribeWABAWebhook: subscription accepted by Meta")
	return nil
}

func metaAPIError(operation string, status int, body []byte) error {
	var response struct {
		Error struct {
			Code int    `json:"code"`
			Type string `json:"type"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &response)
	if response.Error.Code != 0 {
		return fmt.Errorf("%s: Meta API rejected request (HTTP %d, code %d, type %s)", operation, status, response.Error.Code, response.Error.Type)
	}
	return fmt.Errorf("%s: Meta API rejected request (HTTP %d)", operation, status)
}
