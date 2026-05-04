package handlers

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

type AISeedRequest struct {
	Industry     string `json:"industry"`
	MainProduct  string `json:"main_product"`
	DeliveryTime string `json:"delivery_time"`
	BotName      string `json:"bot_name"`
}

type GeneratedSeedData struct {
	Products []struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		Price       float64 `json:"price"`
	} `json:"products"`
	Rules []struct {
		Keywords        string `json:"keywords"`
		Response        string `json:"response"`
		SinhalaResponse string `json:"sinhala_response"`
	} `json:"rules"`
	BotPersonality string `json:"bot_personality"`
}

func OnboardingSeed(c *gin.Context) {
	businessID, exists := c.Get("business_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req AISeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request parameters"})
		return
	}

	var business models.Business
	if err := database.DB.First(&business, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		// Fallback to empty if no API key is set
		business.BotName = req.BotName
		database.DB.Save(&business)
		c.JSON(http.StatusOK, gin.H{"message": "Bot name updated. No Gemini API key for AI generation."})
		return
	}

	sysPrompt := `You are an expert onboarding assistant for a WhatsApp Business SaaS in Sri Lanka. Generate 3 highly converting demo products (use realistic prices in LKR) and 3 highly specific FAQ rules for a business named "` + business.Name + `".
Industry: ` + req.Industry + `
Main Product Line: ` + req.MainProduct + `
Typical Delivery Time: ` + req.DeliveryTime + `

Your output MUST be a valid JSON object matching exactly this schema and nothing else:
{
  "products": [
    {"name": "string", "description": "string", "price": number}
  ],
  "rules": [
    {"keywords": "comma,separated,keywords", "response": "English response string", "sinhala_response": "Refined, natural Sinhala translation of the response."}
  ],
  "bot_personality": "A short, helpful persona instruction for the AI (e.g. You are a friendly sales assistant for ` + req.BotName + `). Keep it concise."
}`

	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{"text": sysPrompt},
				},
			},
		},
	}

	jsonValue, _ := json.Marshal(requestBody)
	resp, err := http.Post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+apiKey, "application/json", bytes.NewBuffer(jsonValue))
	if err != nil {
		log.Printf("Gemini call failed during seeding: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI seeding failed"})
		return
	}
	defer resp.Body.Close()

	bodyBytes, _ := ioutil.ReadAll(resp.Body)
	var geminiResponse struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.Unmarshal(bodyBytes, &geminiResponse); err != nil || len(geminiResponse.Candidates) == 0 {
		log.Printf("Failed to unmarshal Gemini payload: %v | Raw: %s", err, string(bodyBytes))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI response was invalid"})
		return
	}

	jsonText := geminiResponse.Candidates[0].Content.Parts[0].Text
	var seedData GeneratedSeedData
	if err := json.Unmarshal([]byte(jsonText), &seedData); err != nil {
		// Sometimes Gemini wraps JSON in markdown block even with responseMimeType
		jsonText = strings.TrimPrefix(jsonText, "```json\n")
		jsonText = strings.TrimSuffix(jsonText, "\n```")
		jsonText = strings.TrimSpace(jsonText)
		if err2 := json.Unmarshal([]byte(jsonText), &seedData); err2 != nil {
			log.Printf("Failed to parse Gemini generated JSON: %v", err2)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extract AI data"})
			return
		}
	}

	// Begin DB Transaction for seating the data
	tx := database.DB.Begin()

	business.BotName = req.BotName
	if seedData.BotPersonality != "" {
		business.BotPersonality = seedData.BotPersonality
	}
	tx.Save(&business)

	for _, p := range seedData.Products {
		product := models.Product{
			BusinessID:  business.ID,
			Name:        p.Name,
			Description: p.Description,
			Price:       p.Price,
			Active:      true,
			Stock:       100,
		}
		tx.Create(&product)
	}

	for _, r := range seedData.Rules {
		rule := models.Rule{
			BusinessID:      &business.ID,
			Keywords:        r.Keywords,
			Response:        r.Response,
			SinhalaResponse: r.SinhalaResponse,
		}
		tx.Create(&rule)
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "AI successfully generated business data",
		"data":    seedData,
	})
}

// Handle GET /api/v1/onboarding/templates?industry=clothing
func GetOnboardingTemplates(c *gin.Context) {
	industry := c.Query("industry")
	if industry == "" {
		industry = "other"
	}

	templates, ok := IndustryTemplates[industry]
	if !ok {
		templates = IndustryTemplates["other"]
	}

	c.JSON(http.StatusOK, templates)
}

// Request payload for seeding templates
type SeedTemplatesRequest struct {
	Industry        string   `json:"industry"`
	SelectedRuleIDs []string `json:"selected_rule_ids"`
	BotName         string   `json:"bot_name"`
	BotPersonality  string   `json:"bot_personality"`
	OperatingHours  string   `json:"operating_hours"`
	DeliveryPolicy  string   `json:"delivery_policy"`
}

// Handle POST /api/v1/onboarding/seed-templates
func SeedOnboardingTemplates(c *gin.Context) {
	businessID, exists := c.Get("business_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req SeedTemplatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request schema"})
		return
	}

	var business models.Business
	if err := database.DB.First(&business, businessID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Business not found"})
		return
	}

	templatesMap := make(map[string]TemplateRule)
	allTemplates, ok := IndustryTemplates[req.Industry]
	if !ok {
		allTemplates = IndustryTemplates["other"] // fallback
	}

	for _, t := range allTemplates {
		templatesMap[t.ID] = t
	}

	tx := database.DB.Begin()

	business.BotName = req.BotName
	business.BotPersonality = req.BotPersonality
	business.OperatingHours = req.OperatingHours
	business.DeliveryPolicy = req.DeliveryPolicy
	business.OnboardingComplete = true

	// Auto-start 14-day Starter trial on onboarding completion
	if business.TrialExpiresAt == nil {
		now := time.Now()
		trialExpiry := now.AddDate(0, 0, models.TrialDurationDays)
		business.TrialExpiresAt = &trialExpiry
		business.AIMessageLimit = models.TrialAILimit // 150 AI replies during trial
		log.Printf("✨ 14-Day Starter Trial started for Business %d — Expires %s (AI limit: %d)", business.ID, trialExpiry.Format("2006-01-02"), models.TrialAILimit)
	}

	if err := tx.Save(&business).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update business profile"})
		return
	}

	rulesAdded := 0
	for _, rid := range req.SelectedRuleIDs {
		if tData, exists := templatesMap[rid]; exists {
			rule := models.Rule{
				BusinessID:      &business.ID,
				Keywords:        tData.Keywords,
				Response:        tData.Response,
				SinhalaResponse: tData.SinhalaResponse,
			}
			if err := tx.Create(&rule).Error; err == nil {
				rulesAdded++
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error during save"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Onboarding complete! Your 14-day Starter trial has begun. 🚀",
		"rules_seeded":     rulesAdded,
		"trial_started":    business.TrialExpiresAt != nil,
		"trial_expires_at": business.TrialExpiresAt,
		"redirect":         "/dashboard",
	})
}
