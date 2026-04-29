package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
	"gorm.io/gorm"
)

// ListRules fetches all Global (Common) rules and all Custom rules for the tenant
func ListRules(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var commonRules []models.Rule
	var customRules []models.Rule

	// Fetch Common Rules (BusinessID is NULL)
	if err := database.DB.Where("business_id IS NULL").Find(&commonRules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch common rules"})
		return
	}

	// Fetch Custom Rules for this tenant
	if err := database.DB.Where("business_id = ?", businessID).Find(&customRules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch custom rules"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"common_rules": commonRules,
		"custom_rules": customRules,
	})
}

// CreateRule creates a new Custom rule for the tenant
func CreateRule(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var req struct {
		Keywords        string            `json:"keywords" binding:"required"`
		Response        string            `json:"response"`         // legacy English field
		SinhalaResponse string            `json:"sinhala_response"` // legacy Sinhala field
		Responses       map[string]string `json:"responses"`        // new: {"en": "...", "si": "...", "ta": "..."}
		IsActive        bool              `json:"is_active"`
		ResolvedMessage string            `json:"resolved_message"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keywords are required: " + err.Error()})
		return
	}

	// Require at least one response (via new map OR legacy fields)
	if len(req.Responses) == 0 && req.Response == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one language response is required"})
		return
	}

	// Matrix Limits Enforcement
	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify business plan"})
		return
	}

	var ruleCount int64
	database.DB.Model(&models.Rule{}).Where("business_id = ?", businessID).Count(&ruleCount)

	if biz.Plan == models.PlanFree && !biz.IsInActiveTrial() && ruleCount >= 5 {
		c.JSON(http.StatusForbidden, gin.H{
			"error":            "Free plan allows a maximum of 5 FAQ rules. Start a trial or subscribe to add more.",
			"upgrade_required": true,
			"rule_count":       ruleCount,
			"rule_limit":       5,
		})
		return
	}

	rule := models.Rule{
		BusinessID:      &businessID,
		Keywords:        req.Keywords,
		Response:        req.Response,
		SinhalaResponse: req.SinhalaResponse,
		IsActive:        req.IsActive,
	}

	// Build the Responses JSON map
	// Priority: explicit responses map > individual language fields
	if len(req.Responses) > 0 {
		for lang, text := range req.Responses {
			rule.SetResponse(lang, text)
		}
	} else {
		// Migrate legacy fields into the new map
		if req.Response != "" {
			rule.SetResponse("en", req.Response)
		}
		if req.SinhalaResponse != "" {
			rule.SetResponse("si", req.SinhalaResponse)
		}
	}

	if err := database.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rule"})
		return
	}

	// Auto-resolve any Unmatched Messages that exactly match the seed
	if req.ResolvedMessage != "" {
		database.DB.Model(&models.UnmatchedMessage{}).
			Where("business_id = ? AND message = ?", businessID, req.ResolvedMessage).
			Update("resolved", true)
	}

	// Embed in background — non-blocking so API responds immediately
	go whatsapp.EmbedAndStoreRule(&rule)

	LogActivity(businessID, "user", c.GetUint("user_id"), "rule_created", "rule", strconv.FormatUint(uint64(rule.ID), 10), map[string]interface{}{
		"keywords": rule.Keywords,
	}, c.ClientIP(), "low", biz.Name, biz.Plan)

	c.JSON(http.StatusCreated, gin.H{"message": "Custom rule created ✅", "rule": rule})
}

// UpdateRule updates a Custom rule only if it belongs to the tenant
func UpdateRule(c *gin.Context) {
	businessID := c.GetUint("business_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	var rule models.Rule
	if err := database.DB.Where("business_id = ? AND id = ?", businessID, id).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found or you don't have permission to edit global rules"})
		return
	}

	// Use a typed struct so we can handle responses map properly
	var req struct {
		Keywords        *string           `json:"keywords"`
		Response        *string           `json:"response"`
		SinhalaResponse *string           `json:"sinhala_response"`
		Responses       map[string]string `json:"responses"` // new multi-lang map
		IsActive        *bool             `json:"is_active"`
		IsDropRule      *bool             `json:"is_drop_rule"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Apply scalar fields
	if req.Keywords != nil        { rule.Keywords = *req.Keywords }
	if req.Response != nil        { rule.Response = *req.Response; rule.SetResponse("en", *req.Response) }
	if req.SinhalaResponse != nil { rule.SinhalaResponse = *req.SinhalaResponse; rule.SetResponse("si", *req.SinhalaResponse) }
	if req.IsActive != nil        { rule.IsActive = *req.IsActive }
	if req.IsDropRule != nil      { rule.IsDropRule = *req.IsDropRule }

	// Apply multi-language responses map (highest priority)
	if len(req.Responses) > 0 {
		for lang, text := range req.Responses {
			rule.SetResponse(lang, text)
			// Keep legacy scalar fields in sync for backward compat
			if lang == "en" { rule.Response = text }
			if lang == "si" { rule.SinhalaResponse = text }
		}
	}

	if err := database.DB.Save(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update rule"})
		return
	}

	// Re-embed in background since content changed
	go whatsapp.EmbedAndStoreRule(&rule)

	bizName, bizPlan := GetBusinessContext(businessID)
	LogActivity(businessID, "user", c.GetUint("user_id"), "rule_updated", "rule", strconv.FormatUint(uint64(id), 10), map[string]interface{}{
		"languages_updated": func() []string {
			langs := []string{}
			for l := range req.Responses { langs = append(langs, l) }
			return langs
		}(),
	}, c.ClientIP(), "low", bizName, bizPlan)

	c.JSON(http.StatusOK, gin.H{"message": "Rule updated ✅", "rule": rule})
}

// DeleteRule deletes a Custom rule
func DeleteRule(c *gin.Context) {
	businessID := c.GetUint("business_id")
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	// Note: GORM uses soft delete by default if the model has DeletedAt (gorm.Model has it).
	// Ensure it belongs to the tenant
	result := database.DB.Where("business_id = ? AND id = ?", businessID, id).Delete(&models.Rule{})
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found or you don't have permission"})
		return
	}

	bizName, bizPlan := GetBusinessContext(businessID)
	LogActivity(businessID, "user", c.GetUint("user_id"), "rule_deleted", "rule", strconv.FormatUint(uint64(id), 10), map[string]interface{}{}, c.ClientIP(), "low", bizName, bizPlan)

	c.JSON(http.StatusOK, gin.H{"message": "Rule deleted ✅", "rule_id": id})
}

// DraftFAQ asks Gemini to draft an FAQ answer in English and Sinhala.
//
// Dual-mode:
//   - from_inbox=true  → Generalizes the raw customer message into a broader intent,
//     generates ≥8 core keywords, and drafts WhatsApp-bold responses.
//   - from_inbox=false → Plain response-only draft based on keywords the tenant typed.
func DraftFAQ(c *gin.Context) {
	businessID := c.GetUint("business_id")
	var req struct {
		Message   string `json:"message" binding:"required"`
		FromInbox bool   `json:"from_inbox"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
		return
	}

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify business context"})
		return
	}

	// Plan-based quota check (trial users get Starter-level access)
	switch {
	case biz.Plan == models.PlanFree && !biz.IsInActiveTrial():
		c.JSON(http.StatusForbidden, gin.H{
			"error":            "AI Draft requires Starter or Pro plan. Start your free trial to unlock this feature.",
			"upgrade_required": true,
		})
		return
	case (biz.Plan == models.PlanStarter || biz.IsInActiveTrial()) && biz.RuleGenerationCount >= 30:
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":         "Monthly AI generation limit reached (30). Upgrade to Pro for unlimited drafts.",
			"limit_reached": true,
		})
		return
	case biz.Plan == models.PlanPro:
		// Unlimited — no quota check
	}

	var prompt string

	if req.FromInbox {
		// ── Inbox Generalization Mode ────────────────────────────────────────────
		// Transforms a specific raw customer message into a broadly-scoped FAQ rule.
		prompt = `You are an AI assistant helping a Sri Lankan eCommerce business owner build a WhatsApp FAQ knowledge base.
Business Name: ` + biz.Name + `
Business Context: ` + biz.GreetingMessage + `
Delivery Policy: ` + biz.DeliveryPolicy + `
Operating Hours: ` + biz.OperatingHours + `

A customer sent this message that the bot failed to answer:
"` + req.Message + `"

Your job is to:
1. GENERALIZE this specific question into a BROAD FAQ topic that would cover many similar questions from different customers.
   e.g. "when will my order arrive bro" → generalized intent: "Delivery timeline and order status"
   Think: what is the CATEGORY of question being asked, not the exact phrasing.

2. Generate TRIGGER KEYWORDS for this generalized topic:
   - At least 8 CORE meaningful keywords (English + Singlish romanized Sinhala variants)
   - These 8 must be real words/phrases, NOT typos
   - After the 8 core keywords, add 2-3 AND-combo entries using '+' syntax (e.g. "when+arrive", "order+status") for precision matching
   - Cover the full range of ways a Sri Lankan customer might ask this: English phrases, romanized Sinhala (Singlish), common short forms
   - Format: comma-separated list

3. Write a WhatsApp-style ENGLISH reply:
   - Start with a *bold topic header* using WhatsApp bold syntax: *Header Text* (asterisks, no spaces inside)
   - Add ONE relevant emoji after the header
   - Keep the body short: 1-2 warm, friendly sentences
   - Sound like a Sri Lankan business owner texting, not a formal email

4. Write a WhatsApp-style SINHALA reply:
   - Start with the same *bold header* in Sinhala or simple English
   - ONE emoji (same as English)
   - Write NATURAL Sinhala as Sri Lankans actually type on WhatsApp
   - Use English loanwords freely: 'delivery', 'order', 'free', 'COD', 'stock', 'price', 'available'
   - Do NOT use formal academic Sinhala translations
   - Keep it short and warm

Return ONLY a raw JSON object (no markdown, no code fences):
{
  "generalized_intent": "Short description of the broad FAQ topic",
  "keywords": "keyword1, keyword2, keyword3, keyword4, keyword5, keyword6, keyword7, keyword8, combo1+combo2, combo3+combo4",
  "response": "*Bold Header* emoji\nShort English reply here.",
  "sinhala_response": "*Bold Header* emoji\nShort Sinhala reply here."
}`
	} else {
		// ── Plain Response-Only Draft Mode ────────────────────────────────────────
		// Tenant has typed their own keywords; just draft the responses.
		prompt = `You are an AI assistant helping a Sri Lankan eCommerce business owner create a WhatsApp FAQ.
Business Name: ` + biz.Name + `
Business Context: ` + biz.GreetingMessage + `
Delivery Policy: ` + biz.DeliveryPolicy + `
Operating Hours: ` + biz.OperatingHours + `

The merchant wants to create an FAQ rule for this topic/keywords: "` + req.Message + `"

Draft warm, natural WhatsApp replies for this FAQ topic.

FORMATTING RULES (strictly follow):
- Start BOTH replies with a *bold topic header* using WhatsApp bold: *Header Text* (asterisks, no spaces inside)
- Add ONE relevant emoji right after the bold header
- English: friendly Sri Lankan business owner tone. If the topic involves steps/a process, use short numbered steps (1. 2. 3.) inside the body.
- Sinhala: Write NATURAL Sinhala as Sri Lankans actually type on WhatsApp — like texting a friend on the phone, never like writing a formal letter.
  * Use English loanwords freely: 'delivery', 'order', 'connect', 'scan', 'QR', 'COD', 'stock', 'price'
  * STRICTLY FORBIDDEN: NEVER use 'Oyage', 'Oba', 'Obata', 'Apith', or any formal Sinhala possessive pronouns. They sound robotic.
  * INSTEAD: drop pronouns entirely or use direct imperative form. Good: "Connect karanna gihilla...". Bad: "Oyage phone eke..."
  * If steps are needed, use short numbered steps in Sinhala too

Return ONLY a raw JSON object (no markdown, no code fences):
{
  "response": "*Bold Header* emoji\nEnglish reply (use 1.\n2.\n3. for steps if needed).",
  "sinhala_response": "*Bold Header* emoji\nSinhala reply (use 1.\n2.\n3. for steps if needed)."
}`
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	apiURL := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
	}

	importBytes, _ := json.Marshal(body)
	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(importBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call Gemini API"})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse API response"})
		return
	}

	// Extract the text response
	var reply string
	if candidates, ok := result["candidates"].([]interface{}); ok && len(candidates) > 0 {
		if content, ok := candidates[0].(map[string]interface{})["content"].(map[string]interface{}); ok {
			if parts, ok := content["parts"].([]interface{}); ok && len(parts) > 0 {
				if text, ok := parts[0].(map[string]interface{})["text"].(string); ok {
					reply = text
				}
			}
		}
	}

	if reply == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gemini returned empty response"})
		return
	}

	// Clean up markdown code fences if Gemini wrapped the JSON
	reply = strings.TrimSpace(reply)
	reply = strings.TrimPrefix(reply, "```json")
	reply = strings.TrimPrefix(reply, "```")
	reply = strings.TrimSuffix(reply, "```")
	reply = strings.TrimSpace(reply)

	// Increment AI generation count
	database.DB.Model(&biz).Update("rule_generation_count", gorm.Expr("rule_generation_count + ?", 1))

	if req.FromInbox {
		// Inbox mode: parse full response including generalized_intent + keywords
		var drafted struct {
			GeneralizedIntent string `json:"generalized_intent"`
			Keywords          string `json:"keywords"`
			Response          string `json:"response"`
			SinhalaResponse   string `json:"sinhala_response"`
		}
		if err := json.Unmarshal([]byte(reply), &drafted); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse drafted JSON", "raw": reply})
			return
		}
		// Build responses map for new multi-lang rule editor
		responsesMap := map[string]string{}
		if drafted.Response != "" { responsesMap["en"] = drafted.Response }
		if drafted.SinhalaResponse != "" { responsesMap["si"] = drafted.SinhalaResponse }
		c.JSON(http.StatusOK, gin.H{
			"generalized_intent": drafted.GeneralizedIntent,
			"keywords":           drafted.Keywords,
			"response":           drafted.Response,
			"sinhala_response":   drafted.SinhalaResponse,
			"responses":          responsesMap,
		})
	} else {
		// Plain mode: response + sinhala_response only
		var drafted struct {
			Response        string `json:"response"`
			SinhalaResponse string `json:"sinhala_response"`
		}
		if err := json.Unmarshal([]byte(reply), &drafted); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse drafted JSON", "raw": reply})
			return
		}
		// Build responses map for new multi-lang rule editor
		responsesMap := map[string]string{}
		if drafted.Response != "" { responsesMap["en"] = drafted.Response }
		if drafted.SinhalaResponse != "" { responsesMap["si"] = drafted.SinhalaResponse }
		c.JSON(http.StatusOK, gin.H{
			"response":         drafted.Response,
			"sinhala_response": drafted.SinhalaResponse,
			"responses":        responsesMap,
		})
	}
}

// ─── Per-Business Rate Limiter for GenerateRule ────────────────────────────────

var (
	generateLastCall = make(map[uint]time.Time)
	generateMu       sync.Mutex
)

// GenerateRule is a Pro feature: merchant describes an intent in plain language,
// Gemini generates keywords + English + natural Sinhala FAQ responses.
//
// Rate limited to 1 request/minute per business.
// Quota: Free=0, Starter=30/month, Pro=unlimited.
func GenerateRule(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Business not found"})
		return
	}

	// Plan-based quota check (trial users get Starter-level access)
	switch {
	case biz.Plan == models.PlanFree && !biz.IsInActiveTrial():
		c.JSON(http.StatusForbidden, gin.H{"error": "AI Rule Generation requires Starter or Pro plan. Start your free trial to unlock this feature.", "upgrade_required": true})
		return
	case (biz.Plan == models.PlanStarter || biz.IsInActiveTrial()) && biz.RuleGenerationCount >= 30:
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Monthly AI generation limit reached (30). Upgrade to Pro for unlimited.", "limit_reached": true})
		return
	case biz.Plan == models.PlanPro:
		// Unlimited — no quota check
	}

	// RPM rate limit: 1 request per minute per business
	generateMu.Lock()
	last, exists := generateLastCall[businessID]
	if exists && time.Since(last) < time.Minute {
		generateMu.Unlock()
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Please wait 1 minute between AI generations", "retry_after_seconds": 60 - int(time.Since(last).Seconds())})
		return
	}
	generateLastCall[businessID] = time.Now()
	generateMu.Unlock()

	var req struct {
		Intent string `json:"intent" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Intent description is required"})
		return
	}

	prompt := `You are an AI assistant helping a Sri Lankan eCommerce business owner build WhatsApp FAQ rules.
Business Name: ` + biz.Name + `
Business Context: ` + biz.GreetingMessage + `
Delivery Policy: ` + biz.DeliveryPolicy + `
Operating Hours: ` + biz.OperatingHours + `

The merchant wants to create a FAQ rule for this topic:
"` + req.Intent + `"

Generate a complete FAQ rule with:

1. keywords: A comma-separated list of trigger keywords. Follow these rules STRICTLY:
   - Include AT LEAST 8 CORE meaningful keywords/phrases (English variants + romanized Sinhala/Singlish variants).
     These 8 must be real words or phrases, NOT typos.
     Think broadly: how would a Sri Lankan customer phrase this in English? In Singlish? In romanized Sinhala?
     Example core keywords for delivery: "delivery, deliver, shipping, ship, kada ganna, kadaganna, kiyada yanawa, gena enawa"
   - After the 8 core keywords, add 2-4 COMBO entries using '+' syntax for high-precision matching.
     Combo syntax: "word1+word2" means BOTH words must appear in the customer message.
     Example combos: "when+arrive, order+deliver, price+delivery"
   - Typos (optional): add a few common misspellings as bonus entries AFTER the combos.
   - Combine everything into ONE comma-separated list.

2. response: A warm WhatsApp English reply.
   - FIRST LINE: a *bold topic header* using WhatsApp bold syntax: *Header Text* (asterisks, no spaces inside the asterisks)
   - Add ONE relevant emoji immediately after the bold header on the same line
   - Then 1-2 short, warm sentences as the body. Friendly Sri Lankan business tone.
   - Example: "*Delivery Info* 🚚\nWe deliver island-wide within 2-3 business days. Cash on delivery available!"

3. sinhala_response: A natural Sinhala WhatsApp reply.
   - FIRST LINE: same *bold header* (in Sinhala or simple English) + same emoji
   - Write NATURAL Sinhala as Sri Lankans actually type on WhatsApp — think typing on phone to a friend, NOT writing a formal letter
   - Use English loanwords freely: 'delivery', 'order', 'free', 'COD', 'stock', 'price', 'available', 'connect', 'scan'
   - STRICTLY FORBIDDEN: NEVER use formal Sinhala pronouns 'Oyage', 'Oba', 'Obata', 'Apith' or any academic/book Sinhala. These sound unnatural and robotic on WhatsApp.
   - INSTEAD: use 'oya', drop pronouns entirely, or use direct imperative form (e.g. 'denne' not 'Obata diya yuththi')
   - If the topic involves steps/a process: use short numbered steps (1. 2. 3.) even in Sinhala
   - Good example: "*Delivery* 🚚\nIsland-wide deliver karanawa. 2-3 days. COD available!"
   - Bad example (NEVER DO THIS): "Oyage order eka deliver karanawa. Obata 2-3 days yayi."

Return ONLY a raw JSON object (no markdown, no code fences):
{
  "keywords": "kw1, kw2, kw3, kw4, kw5, kw6, kw7, kw8, combo1+combo2, combo3+combo4",
  "response": "*Bold Header* emoji\nEnglish reply body.",
  "sinhala_response": "*Bold Header* emoji\nSinhala reply body."
}`

	apiKey := os.Getenv("GEMINI_API_KEY")
	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role":  "user",
				"parts": []map[string]interface{}{{"text": prompt}},
			},
		},
	}

	importBytes, _ := json.Marshal(body)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(importBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to call Gemini API"})
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse API response"})
		return
	}

	var reply string
	if candidates, ok := result["candidates"].([]interface{}); ok && len(candidates) > 0 {
		if content, ok := candidates[0].(map[string]interface{})["content"].(map[string]interface{}); ok {
			if parts, ok := content["parts"].([]interface{}); ok && len(parts) > 0 {
				if text, ok := parts[0].(map[string]interface{})["text"].(string); ok {
					reply = text
				}
			}
		}
	}

	if reply == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gemini returned empty response"})
		return
	}

	reply = strings.TrimSpace(reply)
	reply = strings.TrimPrefix(reply, "```json")
	reply = strings.TrimPrefix(reply, "```")
	reply = strings.TrimSuffix(reply, "```")

	var generated struct {
		Keywords        string `json:"keywords"`
		Response        string `json:"response"`
		SinhalaResponse string `json:"sinhala_response"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(reply)), &generated); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse generated JSON", "raw": reply})
		return
	}

	// Increment generation count
	database.DB.Model(&biz).UpdateColumn("rule_generation_count", database.DB.Raw("rule_generation_count + 1"))

	c.JSON(http.StatusOK, gin.H{
		"keywords":         generated.Keywords,
		"response":         generated.Response,
		"sinhala_response": generated.SinhalaResponse,
		"generation_count": biz.RuleGenerationCount + 1,
	})
}
