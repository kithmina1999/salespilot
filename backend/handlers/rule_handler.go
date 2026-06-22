package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/httpclient"
	"github.com/kithmina1999/salespilot/knowledge"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
	"gorm.io/gorm"
)

// ListRules fetches all RuleTemplates and all Custom rules for the tenant
func ListRules(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	var commonRules []models.RuleTemplate
	var customRules []models.Rule

	// Fetch Rule Templates
	if err := database.DB.Find(&commonRules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rule templates"})
		return
	}

	// Fetch Custom Rules for this tenant
	if err := db.Find(&customRules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch custom rules"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"common_rules": commonRules, // Keeping key as common_rules for backwards compatibility with frontend initially
		"custom_rules": customRules,
	})
}

// CloneTemplate copies a RuleTemplate into the business's custom rules
func CloneTemplate(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var req struct {
		TemplateID uint `json:"template_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Template ID is required"})
		return
	}

	var template models.RuleTemplate
	if err := database.DB.First(&template, req.TemplateID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Template not found"})
		return
	}

	// Create new rule from template
	rule := models.Rule{
		BusinessID:      &businessID,
		Category:        template.Category,
		Keywords:        template.Keywords,
		Responses:       template.Responses,
		IsActive:        true,
		IsDropRule:      template.IsDropRule,
		IsContextBridge: template.IsContextBridge,
		KnowledgeType:   models.KnowledgeTypeStaticFAQ,
		SourceType:      models.SourceTypeManual,
		SystemManaged:   false,
	}

	if err := database.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone template"})
		return
	}

	// Background embed
	go whatsapp.EmbedAndStoreRule(&rule)

	c.JSON(http.StatusCreated, gin.H{"message": "Template cloned successfully", "rule": rule})
}

// TranslateRule handles single-field auto-translation
func TranslateRule(c *gin.Context) {
	businessID := c.GetUint("business_id")
	if businessID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Text       string `json:"text" binding:"required"`
		TargetLang string `json:"target_lang" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	prompt := fmt.Sprintf(`Translate the following text into natural, conversational %s suitable for a WhatsApp business bot.
Focus on translating the MEANING and INTENT naturally, rather than doing a strict word-for-word translation. Preserve the natural essence of the language.
Preserve any formatting like *bold* or emojis. Do not add any introductory text, just return the translated string.

Text:
%s`, req.TargetLang, req.Text)

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
	resp, err := httpclient.PostJSONContext(c.Request.Context(), httpclient.DependencyGemini, "translate_rule", url, importBytes, httpclient.RetryTransient)
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

	c.JSON(http.StatusOK, gin.H{"translated_text": strings.TrimSpace(reply)})
}

// CreateRule creates a new Custom rule for the tenant
func CreateRule(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var req struct {
		Category        string            `json:"category"`
		Keywords        string            `json:"keywords" binding:"required"`
		Response        string            `json:"response"`         // legacy English field
		SinhalaResponse string            `json:"sinhala_response"` // legacy Sinhala field
		Responses       map[string]string `json:"responses"`        // new: {"en": "...", "si": "...", "ta": "..."}
		IsActive        bool              `json:"is_active"`
		ResolvedMessage string            `json:"resolved_message"`
		GapID           uint              `json:"gap_id"`
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

	// Exclude system_managed from quota check
	var ruleCount int64
	db := c.MustGet("db").(*gorm.DB)
	db.Model(&models.Rule{}).Where("business_id = ? AND system_managed = ?", businessID, false).Count(&ruleCount)

	ent, err := GetUsageEntitlements(biz, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load rule limits"})
		return
	}
	if ent.MaxRules >= 0 && ruleCount >= int64(ent.MaxRules) {
		c.JSON(http.StatusForbidden, gin.H{
			"error":            fmt.Sprintf("Your current plan allows a maximum of %d FAQ rules. Upgrade to add more.", ent.MaxRules),
			"upgrade_required": true,
			"rule_count":       ruleCount,
			"rule_limit":       ent.MaxRules,
		})
		return
	}

	rule := models.Rule{
		BusinessID:      &businessID,
		Category:        req.Category,
		Keywords:        req.Keywords,
		Response:        req.Response,
		SinhalaResponse: req.SinhalaResponse,
		IsActive:        req.IsActive,
		KnowledgeType:   models.KnowledgeTypeStaticFAQ,
		SourceType:      models.SourceTypeManual,
		SystemManaged:   false,
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

	// Validation: if active, must have responses for all bot supported languages
	if rule.IsActive {
		supportedLangs := strings.Split(biz.BotSupportedLangs, ",")
		for _, lang := range supportedLangs {
			lang = strings.TrimSpace(lang)
			if lang == "" {
				continue
			}
			resp := rule.GetExactResponse(lang)
			if strings.TrimSpace(resp) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Response for supported language '%s' is required to activate the rule", lang)})
				return
			}
		}
	}

	if err := database.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rule"})
		return
	}

	// Auto-resolve gap if gap_id is provided
	if req.GapID > 0 {
		go func() {
			knowledge.AutoResolveGapByID(database.DB, req.GapID, "create_static_faq", &rule.ID)
		}()
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
	db := c.MustGet("db").(*gorm.DB)
	if err := db.Where("id = ?", id).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found or you don't have permission to edit global rules"})
		return
	}

	// Block updates to system-managed rules
	if rule.SystemManaged {
		c.JSON(http.StatusForbidden, gin.H{"error": "System-managed rules cannot be edited directly"})
		return
	}

	// Use a typed struct so we can handle responses map properly
	var req struct {
		Category        *string           `json:"category"`
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
	if req.Category != nil {
		rule.Category = *req.Category
	}
	if req.Keywords != nil {
		rule.Keywords = *req.Keywords
	}
	if req.Response != nil {
		rule.Response = *req.Response
		rule.SetResponse("en", *req.Response)
	}
	if req.SinhalaResponse != nil {
		rule.SinhalaResponse = *req.SinhalaResponse
		rule.SetResponse("si", *req.SinhalaResponse)
	}
	if req.IsActive != nil {
		rule.IsActive = *req.IsActive
	}
	if req.IsDropRule != nil {
		rule.IsDropRule = *req.IsDropRule
	}

	// Apply multi-language responses map (highest priority)
	if len(req.Responses) > 0 {
		for lang, text := range req.Responses {
			rule.SetResponse(lang, text)
			// Keep legacy scalar fields in sync for backward compat
			if lang == "en" {
				rule.Response = text
			}
			if lang == "si" {
				rule.SinhalaResponse = text
			}
		}
	}

	// Active language validation
	if rule.IsActive {
		var biz models.Business
		if err := database.DB.First(&biz, businessID).Error; err == nil {
			supportedLangs := strings.Split(biz.BotSupportedLangs, ",")
			for _, lang := range supportedLangs {
				lang = strings.TrimSpace(lang)
				if lang == "" {
					continue
				}
				resp := rule.GetExactResponse(lang)
				if strings.TrimSpace(resp) == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Response for supported language '%s' is required to activate the rule", lang)})
					return
				}
			}
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
			for l := range req.Responses {
				langs = append(langs, l)
			}
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

	db := c.MustGet("db").(*gorm.DB)
	var rule models.Rule
	if err := db.Where("id = ?", id).First(&rule).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
		return
	}

	if rule.SystemManaged {
		c.JSON(http.StatusForbidden, gin.H{"error": "System-managed rules cannot be deleted"})
		return
	}

	result := db.Delete(&rule)
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule could not be deleted"})
		return
	}

	bizName, bizPlan := GetBusinessContext(businessID)
	LogActivity(businessID, "user", c.GetUint("user_id"), "rule_deleted", "rule", strconv.FormatUint(uint64(id), 10), map[string]interface{}{}, c.ClientIP(), "low", bizName, bizPlan)

	c.JSON(http.StatusOK, gin.H{"message": "Rule deleted ✅", "rule_id": id})
}

// DraftFAQ asks Gemini to draft an FAQ answer in all languages configured for the business.
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
	ent, err := GetUsageEntitlements(biz, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load AI generation limits"})
		return
	}

	// Plan-based quota check (trial users get Starter-level access)
	switch {
	case ent.MaxRuleGens == 0:
		c.JSON(http.StatusForbidden, gin.H{
			"error":            "AI Draft requires Starter or Pro plan. Start your free trial to unlock this feature.",
			"upgrade_required": true,
		})
		return
	case ent.MaxRuleGens > 0 && biz.RuleGenerationCount >= ent.MaxRuleGens:
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":         fmt.Sprintf("Monthly AI generation limit reached (%d). Upgrade for more drafts.", ent.MaxRuleGens),
			"limit_reached": true,
		})
		return
	case biz.Plan == models.PlanPro:
		// Unlimited — no quota check
	}

	// Build language instructions based on business settings
	supportedLangs := strings.Split(biz.BotSupportedLangs, ",")
	var langList []string
	var jsonResponsesFormat string
	for _, l := range supportedLangs {
		l = strings.TrimSpace(l)
		if l == "" {
			continue
		}
		langList = append(langList, l)
		jsonResponsesFormat += fmt.Sprintf(`"%s": "*Bold Header* emoji\nShort %s response body here.", `, l, l)
	}
	if jsonResponsesFormat != "" {
		jsonResponsesFormat = jsonResponsesFormat[:len(jsonResponsesFormat)-2] // strip last comma
	}

	var prompt string

	if req.FromInbox {
		// ── Inbox Generalization Mode ────────────────────────────────────────────
		prompt = `You are an AI assistant helping a Sri Lankan eCommerce business owner build a WhatsApp FAQ knowledge base.
Business Name: ` + biz.Name + `
Bot Personality: ` + biz.BotPersonality + `
Delivery Policy: ` + biz.DeliveryPolicy + `
Operating Hours: ` + biz.OperatingHours + `

A customer sent this message that the bot failed to answer:
"` + req.Message + `"

Your job is to:
1. GENERALIZE this specific question into a BROAD FAQ topic that would cover many similar questions from different customers.
   e.g. "when will my order arrive bro" → generalized intent: "Delivery timeline and order status"

2. Generate TRIGGER KEYWORDS for this generalized topic:
   - At least 8 CORE meaningful keywords (English + Singlish romanized Sinhala/Tamil variants depending on context)
   - These 8 must be real words/phrases, NOT typos
   - After the 8 core keywords, add 2-3 AND-combo entries using '+' syntax (e.g. "when+arrive", "order+status") for precision matching
   - Cover the full range of ways a Sri Lankan customer might ask this: English phrases, romanized Sinhala (Singlish), common short forms
   - Format: comma-separated list

3. Write WhatsApp-style replies for exactly these language codes: ` + strings.Join(langList, ", ") + `.
   - Start each reply with a *bold topic header* using WhatsApp bold syntax: *Header Text* (asterisks, no spaces inside)
   - Add ONE relevant emoji after the header
   - Keep the body short: 1-2 warm, friendly sentences
   - For English: conversational tone
   - For Sinhala: write NATURAL conversational WhatsApp Sinhala, using English loanwords freely (delivery, order, COD, stock, price). Never use formal academic Sinhala or formal pronouns (like Oba, Obata, Oyage).
   - For Tamil: natural WhatsApp Tamil, conversational not bookish.

Return ONLY a raw JSON object (no markdown, no code fences):
{
  "generalized_intent": "Short description of the broad FAQ topic",
  "keywords": "keyword1, keyword2, keyword3, keyword4, keyword5, keyword6, keyword7, keyword8, combo1+combo2, combo3+combo4",
  "responses": {
    ` + jsonResponsesFormat + `
  }
}`
	} else {
		// ── Plain Response-Only Draft Mode ────────────────────────────────────────
		prompt = `You are an AI assistant helping a Sri Lankan eCommerce business owner create a WhatsApp FAQ.
Business Name: ` + biz.Name + `
Bot Personality: ` + biz.BotPersonality + `
Delivery Policy: ` + biz.DeliveryPolicy + `
Operating Hours: ` + biz.OperatingHours + `

The merchant wants to create an FAQ rule for this topic/keywords: "` + req.Message + `"

Draft warm, natural WhatsApp replies for this FAQ topic for exactly these language codes: ` + strings.Join(langList, ", ") + `.

FORMATTING RULES (strictly follow):
- Start each reply with a *bold topic header* using WhatsApp bold: *Header Text* (asterisks, no spaces inside)
- Add ONE relevant emoji right after the bold header
- For English: friendly Sri Lankan business owner tone. If the topic involves steps/a process, use short numbered steps (1. 2. 3.) inside the body.
- For Sinhala: Write NATURAL Sinhala as Sri Lankans actually type on WhatsApp. Use English loanwords freely. STRICTLY FORBIDDEN: NEVER use 'Oyage', 'Oba', 'Obata', 'Apith', or any formal Sinhala possessive pronouns.
- For Tamil: Natural conversational WhatsApp Tamil.

Return ONLY a raw JSON object (no markdown, no code fences):
{
  "responses": {
    ` + jsonResponsesFormat + `
  }
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
	resp, err := httpclient.PostJSONContext(c.Request.Context(), httpclient.DependencyGemini, "draft_faq", apiURL, importBytes, httpclient.RetryTransient)
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

	// Parse full response including generalized_intent + keywords + responses map
	var drafted struct {
		GeneralizedIntent string            `json:"generalized_intent"`
		Keywords          string            `json:"keywords"`
		Responses         map[string]string `json:"responses"`
	}
	if err := json.Unmarshal([]byte(reply), &drafted); err != nil {
		// Fallback parse if Gemini omitted the nested structure and returned flat fields
		var flatDrafted struct {
			GeneralizedIntent string `json:"generalized_intent"`
			Keywords          string `json:"keywords"`
			Response          string `json:"response"`
			SinhalaResponse   string `json:"sinhala_response"`
		}
		if err2 := json.Unmarshal([]byte(reply), &flatDrafted); err2 == nil {
			drafted.GeneralizedIntent = flatDrafted.GeneralizedIntent
			drafted.Keywords = flatDrafted.Keywords
			drafted.Responses = map[string]string{}
			if flatDrafted.Response != "" {
				drafted.Responses["en"] = flatDrafted.Response
			}
			if flatDrafted.SinhalaResponse != "" {
				drafted.Responses["si"] = flatDrafted.SinhalaResponse
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse drafted JSON", "raw": reply})
			return
		}
	}

	// Double check nil map
	if drafted.Responses == nil {
		drafted.Responses = map[string]string{}
	}

	// Determine missing languages and activation readiness
	var missingLanguages []string
	for _, l := range langList {
		if text, ok := drafted.Responses[l]; text == "" || !ok {
			missingLanguages = append(missingLanguages, l)
		}
	}
	activationReady := len(missingLanguages) == 0

	c.JSON(http.StatusOK, gin.H{
		"generalized_intent": drafted.GeneralizedIntent,
		"keywords":           drafted.Keywords,
		"response":           drafted.Responses["en"], // backward compat
		"sinhala_response":   drafted.Responses["si"], // backward compat
		"responses":          drafted.Responses,
		"missing_languages":  missingLanguages,
		"activation_ready":   activationReady,
	})
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
	ent, err := GetUsageEntitlements(biz, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load AI generation limits"})
		return
	}

	// Plan-based quota check (trial users get Starter-level access)
	switch {
	case ent.MaxRuleGens == 0:
		c.JSON(http.StatusForbidden, gin.H{"error": "AI Rule Generation requires Starter or Pro plan. Start your free trial to unlock this feature.", "upgrade_required": true})
		return
	case ent.MaxRuleGens > 0 && biz.RuleGenerationCount >= ent.MaxRuleGens:
		c.JSON(http.StatusTooManyRequests, gin.H{"error": fmt.Sprintf("Monthly AI generation limit reached (%d). Upgrade for more.", ent.MaxRuleGens), "limit_reached": true})
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
Bot Personality: ` + biz.BotPersonality + `
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
	resp, err := httpclient.PostJSONContext(c.Request.Context(), httpclient.DependencyGemini, "generate_rule", url, importBytes, httpclient.RetryTransient)
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
