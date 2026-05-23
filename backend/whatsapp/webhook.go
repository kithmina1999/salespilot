package whatsapp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/utils"
)

// processedMsgs deduplicates Meta webhook retries.
// Meta re-delivers the same payload if we don't respond within ~20s OR if it
// suspects delivery failure. Each msg.ID is stored for 5 minutes so retries
// within that window are silently dropped.
var processedMsgs sync.Map

// isAlreadyProcessed returns true when the message ID has been seen before.
// On first call it stores the ID and schedules eviction after 5 minutes.
func isAlreadyProcessed(msgID string) bool {
	if _, loaded := processedMsgs.LoadOrStore(msgID, time.Now()); loaded {
		return true // duplicate — already being/been processed
	}
	go func() {
		time.Sleep(5 * time.Minute)
		processedMsgs.Delete(msgID)
	}()
	return false
}

// VerifyWebhook handles GET /api/whatsapp/webhook
// Meta calls this once when you register the webhook URL.
func VerifyWebhook(c *gin.Context) {
	verifyToken := os.Getenv("META_VERIFY_TOKEN")
	mode := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	challenge := c.Query("hub.challenge")

	if mode == "subscribe" && token == verifyToken {
		log.Println("✅ Meta webhook verified successfully")
		c.String(http.StatusOK, challenge)
		return
	}

	log.Printf("❌ Meta webhook verification failed: mode=%s token=%s", mode, token)
	c.JSON(http.StatusForbidden, gin.H{"error": "Verification failed"})
}

// HandleWebhook handles POST /api/whatsapp/webhook
// Meta sends all tenant messages here.
func HandleWebhook(c *gin.Context) {
	// Read raw body (needed for HMAC verification)
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot read body"})
		return
	}

	// Verify X-Hub-Signature-256 (security — reject forged requests)
	appSecret := os.Getenv("META_APP_SECRET")
	if appSecret != "" {
		sigHeader := c.GetHeader("X-Hub-Signature-256")
		if !verifyHMAC(rawBody, sigHeader, appSecret) {
			log.Println("❌ Meta webhook: invalid HMAC signature — rejecting")
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid signature"})
			return
		}
	}

	// Parse the Meta webhook payload
	var payload MetaWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	if ok := utils.EnqueueWebhook(func() {
		processWebhookPayload(payload)
	}); !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Webhook queue full"})
		return
	}

	// ACK Meta only after the payload is safely queued for processing.
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// MetaWebhookPayload is the top-level structure Meta sends.
type MetaWebhookPayload struct {
	Object string      `json:"object"`
	Entry  []MetaEntry `json:"entry"`
}

type MetaEntry struct {
	ID      string       `json:"id"`
	Changes []MetaChange `json:"changes"`
}

type MetaChange struct {
	Value MetaChangeValue `json:"value"`
	Field string          `json:"field"`
}

type MetaChangeValue struct {
	MessagingProduct string        `json:"messaging_product"`
	Metadata         MetaMetadata  `json:"metadata"`
	Contacts         []MetaContact `json:"contacts"`
	Messages         []MetaMessage `json:"messages"`
}

type MetaMetadata struct {
	DisplayPhoneNumber string `json:"display_phone_number"`
	PhoneNumberID      string `json:"phone_number_id"`
}

type MetaContact struct {
	Profile MetaProfile `json:"profile"`
	WaID    string      `json:"wa_id"`
}

type MetaProfile struct {
	Name string `json:"name"`
}

type MetaMessage struct {
	From        string           `json:"from"`
	ID          string           `json:"id"`
	Timestamp   string           `json:"timestamp"`
	Text        *MetaTextBody    `json:"text"`
	Type        string           `json:"type"`
	Interactive *MetaInteractive `json:"interactive"`
	Image       *MetaImage       `json:"image"`
}

type MetaImage struct {
	ID       string `json:"id"`
	MimeType string `json:"mime_type"`
	SHA256   string `json:"sha256"`
}

type MetaTextBody struct {
	Body string `json:"body"`
}

// MetaInteractive holds the payload when a customer taps a button or selects a list item.
type MetaInteractive struct {
	Type        string           `json:"type"`         // "button_reply" | "list_reply"
	ButtonReply *MetaButtonReply `json:"button_reply"` // set when type=button_reply
	ListReply   *MetaListReply   `json:"list_reply"`   // set when type=list_reply
}

type MetaButtonReply struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type MetaListReply struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func processWebhookPayload(payload MetaWebhookPayload) {
	pipeline := NewPipeline()

	for _, entry := range payload.Entry {
		for _, change := range entry.Changes {
			if change.Field != "messages" {
				continue
			}

			phoneNumberID := change.Value.Metadata.PhoneNumberID
			if phoneNumberID == "" {
				continue
			}

			// Look up the business by their Meta Phone Number ID
			var business models.Business
			if err := database.DB.
				Where("wa_phone_number_id = ?", phoneNumberID).
				First(&business).Error; err != nil {
				log.Printf("⚠️ Webhook: no business found for phone_number_id=%s", phoneNumberID)
				continue
			}

			// Build a name lookup map from contacts
			nameMap := make(map[string]string)
			for _, contact := range change.Value.Contacts {
				nameMap[contact.WaID] = contact.Profile.Name
			}

			for _, msg := range change.Value.Messages {
				const staleThreshold = 60 * time.Minute
				if ts, err := strconv.ParseInt(msg.Timestamp, 10, 64); err == nil {
					msgTime := time.Unix(ts, 0)
					if time.Since(msgTime) > staleThreshold {
						log.Printf("⏱️ [Webhook] Stale message from %s (age=%v) — dropping",
							msg.From, time.Since(msgTime).Round(time.Second))
						continue
					}
				}

				if msg.Type == "image" && isAlreadyProcessed(msg.ID) {
					log.Printf("⚡ [Webhook] Duplicate msg.ID=%s from %s — skipping", msg.ID, msg.From)
					continue
				}

				var text string

				switch msg.Type {
				case "text":
					if msg.Text != nil {
						text = msg.Text.Body
					}
				case "interactive":
					// Button tap or list selection — extract the ID as the message text
					// The order bot interprets these IDs as state machine commands.
					if msg.Interactive != nil {
						switch msg.Interactive.Type {
						case "button_reply":
							if msg.Interactive.ButtonReply != nil {
								text = msg.Interactive.ButtonReply.ID
								log.Printf("🔘 [%s] Button tap from %s: id=%q title=%q",
									business.Name, msg.From,
									msg.Interactive.ButtonReply.ID,
									msg.Interactive.ButtonReply.Title)
							}
						case "list_reply":
							if msg.Interactive.ListReply != nil {
								text = msg.Interactive.ListReply.ID
								log.Printf("📋 [%s] List selection from %s: id=%q title=%q",
									business.Name, msg.From,
									msg.Interactive.ListReply.ID,
									msg.Interactive.ListReply.Title)
							}
						}
					}
				case "image":
					// Images bypass the text pipeline entirely.
					// 1. ACK immediately with a localized "processing" message
					// 2. Enqueue Vision AI classification in the worker pool
					if msg.Image != nil {
						log.Printf("🖼️ [%s] Image received from %s (media_id=%s)", business.Name, msg.From, msg.Image.ID)
						normalizedFrom := utils.NormalizePhone(msg.From)
						pushName := nameMap[msg.From]
						bizCopy := business
						msgCopy := msg
						waitMsg := localizedWaitMessage(&bizCopy)
						SendText(bizCopy.WAPhoneNumberID, bizCopy.WAAccessToken, normalizedFrom, waitMsg)
						if ok := utils.EnqueueWebhook(func() {
							HandleImageWebhook(&bizCopy, normalizedFrom, msgCopy.From, msgCopy.Image.ID, pushName)
						}); !ok {
							log.Printf("⚠️ [Webhook] Worker queue full while routing image msg.ID=%s from %s", msg.ID, msg.From)
						}
					}
					continue
				default:
					log.Printf("📥 [%s] Unsupported message type=%s from %s — skipping", business.Name, msg.Type, msg.From)
					continue
				}

				if text == "" {
					continue
				}

				// ── Stale message filter ────────────────────────────────────
				// Meta retries failed deliveries for up to 72 hours. Messages
				// older than 60 minutes are almost certainly queued retries from
				// a previous connectivity issue — drop them silently so the bot
				// doesn't replay old conversations.
				const secondaryStaleThreshold = 60 * time.Minute
				if ts, err := strconv.ParseInt(msg.Timestamp, 10, 64); err == nil {
					msgTime := time.Unix(ts, 0)
					if time.Since(msgTime) > secondaryStaleThreshold {
						log.Printf("⏱️ [Webhook] Stale message from %s (age=%v) — dropping",
							msg.From, time.Since(msgTime).Round(time.Second))
						continue
					}
				}

				// Dedup guard: Meta retries the same payload when delivery is
				// uncertain. Drop duplicates within the 5-minute window.
				if isAlreadyProcessed(msg.ID) {
					log.Printf("⚡ [Webhook] Duplicate msg.ID=%s from %s — skipping", msg.ID, msg.From)
					continue
				}

				incoming := IncomingMessage{
					From:      utils.NormalizePhone(msg.From),
					Text:      text,
					PushName:  nameMap[msg.From],
					Timestamp: msg.Timestamp,
				}

				log.Printf("📥 [%s] Incoming from %s: %q", business.Name, incoming.From, incoming.Text)

				// Per-customer mutex: serialize concurrent requests from the same phone.
				// Rapid button taps (e.g. "M" and "L" size at once) are queued here so
				// the cart state machine always processes one message at a time per user.
				// Different customers never block each other (key = businessID:phone).
				unlock := lockCustomer(business.ID, incoming.From)
				pipeline.HandleIncomingMessage(&business, incoming)
				unlock()

			}
		}
	}
}

// verifyHMAC validates the X-Hub-Signature-256 header from Meta.
func verifyHMAC(body []byte, sigHeader, secret string) bool {
	expected := strings.TrimPrefix(sigHeader, "sha256=")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	actual := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(actual), []byte(expected))
}
