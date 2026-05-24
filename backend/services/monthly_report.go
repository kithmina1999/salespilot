package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
)

// ── Model Selection by Plan ────────────────────────────────────────────────────
// Pro   → Gemini 3.1 Pro  → "Advanced Business Intelligence Report"
// Starter → Gemini 3.1 Flash Lite → "Business Summary Report"
const (
	geminiProModel     = "gemini-3.1-pro"        // Pro tier: deep strategic analysis
	geminiStarterModel = "gemini-3.1-flash-lite" // Starter tier: concise smart summary
)

// ── Monthly Report Stats ───────────────────────────────────────────────────────

type reportStats struct {
	BusinessName     string
	Month            string // "March 2026"
	MonthKey         string // "2026-03"
	Plan             string
	Language         string // "sinhala_first" | "english_first"
	RevenueThisMonth float64
	RevenuePrevMonth float64
	OrdersTotal      int
	OrdersDelivered  int
	OrdersShipped    int
	OrdersCancelled  int
	OrdersPending    int
	AvgOrderValue    float64
	NewCustomers     int
	TotalCustomers   int
	AIResolutionRate float64
	BotAutomation    float64
	AIUsed           int
	AILimit          int
	TopGaps          []string
	// Previous month report text (for contextual comparison — Pro only)
	PrevReportText string
}

// ── Entry Point ───────────────────────────────────────────────────────────────

// SendMonthlyReports generates and delivers reports to all opted-in businesses.
// Call this on the 1st of every month.
func SendMonthlyReports() {
	log.Println("📊 Monthly Report Cron: Starting report generation...")

	var businesses []models.Business
	database.DB.Where("monthly_report_enabled = ? AND wa_phone_number_id != ''", true).Find(&businesses)

	log.Printf("📊 Monthly Report: Found %d businesses opted in", len(businesses))

	now := time.Now()
	lastMonth := now.AddDate(0, -1, 0)
	monthKey := lastMonth.Format("2006-01")

	for _, biz := range businesses {
		// Skip Free plan — no report
		if biz.Plan == models.PlanFree && !biz.IsInActiveTrial() {
			continue
		}

		go func(b models.Business) {
			if err := generateAndSendReport(b, monthKey, lastMonth); err != nil {
				log.Printf("❌ Monthly Report failed for business %d (%s): %v", b.ID, b.Name, err)
			}
		}(biz)
	}
}

// GenerateAndSendTestReport generates a report for the current month on-demand.
// Used by the "Send Test Report" button in settings.
func GenerateAndSendTestReport(businessID uint) error {
	var biz models.Business
	if err := database.DB.First(&biz, businessID).Error; err != nil {
		return fmt.Errorf("business not found: %v", err)
	}
	now := time.Now()
	monthKey := now.Format("2006-01")
	return generateAndSendReport(biz, monthKey, now)
}

// ── Core Report Generator ─────────────────────────────────────────────────────

func generateAndSendReport(biz models.Business, monthKey string, refDate time.Time) error {
	stats, err := collectStats(biz, monthKey, refDate)
	if err != nil {
		return fmt.Errorf("stats collection failed: %v", err)
	}

	// Pick model based on plan
	model := geminiStarterModel
	reportType := "basic"
	if biz.Plan == models.PlanPro {
		model = geminiProModel
		reportType = "advanced"

		// Fetch previous month's report for Pro contextual analysis
		prevMonthKey := refDate.AddDate(0, -1, 0).Format("2006-01")
		var prevReport models.MonthlyReport
		if err := database.DB.Where("business_id = ? AND month = ?", biz.ID, prevMonthKey).First(&prevReport).Error; err == nil {
			stats.PrevReportText = prevReport.ReportText
		}
	}

	// Build the full WhatsApp message
	reportText, err := buildFullReport(stats, model)
	if err != nil {
		return fmt.Errorf("AI generation failed: %v", err)
	}

	// Determine delivery number
	deliverTo := biz.ReportPhone
	if deliverTo == "" {
		deliverTo = biz.Phone
	}
	// Strip leading +
	cleanPhone := strings.TrimPrefix(deliverTo, "+")

	// Send via WhatsApp
	if biz.WAPhoneNumberID != "" && biz.WAAccessToken != "" {
		if err := whatsapp.SendText(biz.WAPhoneNumberID, biz.WAAccessToken, cleanPhone, reportText); err != nil {
			log.Printf("⚠️ Failed to send WhatsApp report to %s: %v", cleanPhone, err)
		}
	}

	// Persist to DB for history
	record := models.MonthlyReport{
		BusinessID: biz.ID,
		Month:      monthKey,
		ReportType: reportType,
		ReportText: reportText,
		SentTo:     deliverTo,
		SentAt:     time.Now(),
	}
	database.DB.Create(&record)

	log.Printf("✅ Monthly Report sent to business %d (%s) for %s [%s]", biz.ID, biz.Name, monthKey, reportType)
	return nil
}

// ── Stats Collection ──────────────────────────────────────────────────────────

func collectStats(biz models.Business, monthKey string, refDate time.Time) (*reportStats, error) {
	// Parse month boundaries
	monthStart, err := time.ParseInLocation("2006-01", monthKey, refDate.Location())
	if err != nil {
		return nil, err
	}
	monthEnd := monthStart.AddDate(0, 1, 0)

	prevMonthStart := monthStart.AddDate(0, -1, 0)

	stats := &reportStats{
		BusinessName: biz.Name,
		Month:        refDate.Format("January 2006"),
		MonthKey:     monthKey,
		Plan:         biz.Plan,
		Language:     biz.ResponseLanguage,
		AIUsed:       biz.AIMessageCount,
		AILimit:      biz.AIMessageLimit,
	}

	// Revenue
	database.DB.Model(&models.Order{}).
		Select("COALESCE(SUM(total_price), 0)").
		Where("business_id = ? AND created_at >= ? AND created_at < ? AND status != ?",
			biz.ID, monthStart, monthEnd, models.OrderStatusCancelled).
		Scan(&stats.RevenueThisMonth)
	database.DB.Model(&models.Order{}).
		Select("COALESCE(SUM(total_price), 0)").
		Where("business_id = ? AND created_at >= ? AND created_at < ? AND status != ?",
			biz.ID, prevMonthStart, monthStart, models.OrderStatusCancelled).
		Scan(&stats.RevenuePrevMonth)

	// Order breakdown
	var orderRows []struct {
		Status string
		Count  int
	}
	database.DB.Model(&models.Order{}).
		Select("status, COUNT(*) as count").
		Where("business_id = ? AND created_at >= ? AND created_at < ?", biz.ID, monthStart, monthEnd).
		Group("status").
		Scan(&orderRows)

	for _, row := range orderRows {
		stats.OrdersTotal += row.Count
		switch row.Status {
		case models.OrderStatusDelivered:
			stats.OrdersDelivered = row.Count
		case models.OrderStatusShipped:
			stats.OrdersShipped = row.Count
		case models.OrderStatusCancelled:
			stats.OrdersCancelled = row.Count
		case models.OrderStatusNew:
			stats.OrdersPending = row.Count
		}
	}

	// Avg order value
	database.DB.Model(&models.Order{}).
		Select("COALESCE(AVG(total_price), 0)").
		Where("business_id = ? AND created_at >= ? AND created_at < ? AND status != ?",
			biz.ID, monthStart, monthEnd, models.OrderStatusCancelled).
		Scan(&stats.AvgOrderValue)

	// Customers
	var newCust, totalCust int64
	database.DB.Model(&models.Message{}).
		Select("COUNT(DISTINCT phone)").
		Where("business_id = ? AND role = 'user' AND created_at >= ? AND created_at < ?", biz.ID, monthStart, monthEnd).
		Where("phone NOT IN (SELECT DISTINCT phone FROM messages WHERE business_id = ? AND role = 'user' AND created_at < ?)", biz.ID, monthStart).
		Scan(&newCust)
	database.DB.Model(&models.Message{}).
		Where("business_id = ?", biz.ID).
		Distinct("phone").Count(&totalCust)

	stats.NewCustomers = int(newCust)
	stats.TotalCustomers = int(totalCust)

	// Bot performance
	var totalUserMsgs, unmatchedMsgs, aiMsgs, allMsgs int64
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND role = 'user' AND created_at >= ? AND created_at < ?", biz.ID, monthStart, monthEnd).
		Count(&totalUserMsgs)
	database.DB.Model(&models.KnowledgeGap{}).
		Where("business_id = ? AND created_at >= ? AND created_at < ?", biz.ID, monthStart, monthEnd).
		Count(&unmatchedMsgs)
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND role = 'model' AND created_at >= ? AND created_at < ?", biz.ID, monthStart, monthEnd).
		Count(&aiMsgs)
	database.DB.Model(&models.Message{}).
		Where("business_id = ? AND created_at >= ? AND created_at < ?", biz.ID, monthStart, monthEnd).
		Count(&allMsgs)

	if totalUserMsgs > 0 {
		stats.AIResolutionRate = float64(totalUserMsgs-unmatchedMsgs) / float64(totalUserMsgs) * 100
	}
	if allMsgs > 0 {
		stats.BotAutomation = float64(aiMsgs) / float64(allMsgs) * 100
	}

	// Top knowledge gaps
	var topGaps []struct {
		Message string
		Count   int
	}
	database.DB.Model(&models.KnowledgeGap{}).
		Select("MAX(message) as message, count(*) as count").
		Where("business_id = ? AND created_at >= ? AND created_at < ? AND resolved = ?", biz.ID, monthStart, monthEnd, false).
		Group("intent_cluster").
		Order("count DESC").
		Limit(5).
		Scan(&topGaps)

	for _, g := range topGaps {
		stats.TopGaps = append(stats.TopGaps, fmt.Sprintf("\"%s\" (%dx)", g.Message, g.Count))
	}

	return stats, nil
}

// ── Report Building with Gemini AI ───────────────────────────────────────────

func buildFullReport(stats *reportStats, model string) (string, error) {
	// 1. Build raw stats section (always included, plain text)
	revPct := ""
	if stats.RevenuePrevMonth > 0 {
		pct := (stats.RevenueThisMonth - stats.RevenuePrevMonth) / stats.RevenuePrevMonth * 100
		if pct >= 0 {
			revPct = fmt.Sprintf(" (+%.1f%% vs prev)", pct)
		} else {
			revPct = fmt.Sprintf(" (%.1f%% vs prev)", pct)
		}
	}

	gapsSection := ""
	if len(stats.TopGaps) > 0 {
		gapsSection = "\n🔍 *TOP KNOWLEDGE GAPS*\n─────────────────────\n"
		for i, g := range stats.TopGaps {
			gapsSection += fmt.Sprintf("%d. %s → Add FAQ\n", i+1, g)
		}
	}

	rawStats := fmt.Sprintf(`Business: %s | Plan: %s | Month: %s

REVENUE:
- Total: Rs. %.0f%s
- Orders: %d | Avg value: Rs. %.0f
- Delivered: %d | Shipped: %d | Cancelled: %d | Pending: %d

CUSTOMERS:
- New this month: %d
- Total engaged: %d

BOT PERFORMANCE:
- AI Resolution Rate: %.1f%%
- Bot Automation: %.1f%%
- AI replies used: %d / %d

TOP KNOWLEDGE GAPS (unanswered questions):
%s`,
		stats.BusinessName, stats.Plan, stats.Month,
		stats.RevenueThisMonth, revPct,
		stats.OrdersTotal, stats.AvgOrderValue,
		stats.OrdersDelivered, stats.OrdersShipped, stats.OrdersCancelled, stats.OrdersPending,
		stats.NewCustomers, stats.TotalCustomers,
		stats.AIResolutionRate, stats.BotAutomation,
		stats.AIUsed, stats.AILimit,
		strings.Join(stats.TopGaps, "\n"),
	)

	// 2. Build AI analysis via Gemini
	aiAnalysis, err := callGeminiForAnalysis(stats, rawStats, model)
	if err != nil {
		log.Printf("⚠️ Gemini analysis failed, using raw stats only: %v", err)
		aiAnalysis = "AI analysis unavailable this month. Please check your Gemini API key."
	}

	// 3. Determine report type label
	reportLabel := "Business Summary Report"
	if stats.Plan == models.PlanPro {
		reportLabel = "Advanced Business Intelligence Report"
	}

	// 4. Assemble final WhatsApp message
	report := fmt.Sprintf(`📊 *SalesPilot %s*
*%s — %s*

─────────────────────
💰 *REVENUE SNAPSHOT*
─────────────────────
Total: Rs. %.0f%s
Orders: %d | Avg: Rs. %.0f
✅ Delivered: %d  🚚 Shipped: %d
❌ Cancelled: %d  🆕 Pending: %d

─────────────────────
👥 *CUSTOMERS*
─────────────────────
New this month: %d
Total engaged: %d

─────────────────────
🤖 *BOT PERFORMANCE*
─────────────────────
Resolution: %.1f%% | Automation: %.1f%%
AI replies: %d / %d
%s
─────────────────────
🧠 *AI BUSINESS ANALYSIS*
─────────────────────
%s

─────────────────────
— SalesPilot AI 🧠
salespilot.lk`,
		reportLabel,
		stats.BusinessName, stats.Month,
		stats.RevenueThisMonth, revPct,
		stats.OrdersTotal, stats.AvgOrderValue,
		stats.OrdersDelivered, stats.OrdersShipped,
		stats.OrdersCancelled, stats.OrdersPending,
		stats.NewCustomers, stats.TotalCustomers,
		stats.AIResolutionRate, stats.BotAutomation,
		stats.AIUsed, stats.AILimit,
		gapsSection,
		aiAnalysis,
	)

	return report, nil
}

// ── Gemini AI Analysis Call ───────────────────────────────────────────────────

func callGeminiForAnalysis(stats *reportStats, rawStats string, model string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY not set")
	}

	apiURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		model, apiKey,
	)

	// Language instruction
	langInstruction := "Write ONLY in English. Professional business English."
	if stats.Language == "sinhala_first" {
		langInstruction = "Write ONLY in natural Sri Lankan Sinhala (as people actually type on WhatsApp). Use English loanwords for business terms like 'revenue', 'orders', 'customers', 'trend'. Do NOT use formal academic Sinhala."
	}

	// Previous report context (Pro only)
	prevContext := ""
	if stats.PrevReportText != "" {
		prevContext = fmt.Sprintf("\n\nPREVIOUS MONTH'S REPORT (for trend context):\n%s\n\n", stats.PrevReportText)
	}

	// Plan-specific depth instruction
	depthInstruction := ""
	if stats.Plan == models.PlanPro {
		depthInstruction = `
You are a SENIOR BUSINESS ANALYST writing an Advanced Business Intelligence Report for a Sri Lankan SME.
Your analysis must be PROFESSIONAL, DATA-DRIVEN, and ACTIONABLE. Cover ALL of:

1. 📈 PERFORMANCE ANALYSIS — Interpret the numbers. What is trending up/down? Why might this be happening?
2. 💡 MARKET CONTEXT — Reference relevant Sri Lanka economic conditions (consumer spending, inflation, festive season, import costs, banking environment). If international market factors apply (e.g., festive season demand, global supply chain), mention them.
3. ⚠️ CURRENT PROBLEMS — Identify 2-3 real problems in the data (e.g., high cancellation rate, low avg order value, unresolved customer questions, low AI resolution).
4. 🔮 UPCOMING RISKS — Predict 2 potential challenges for next month based on current trends and Sri Lanka's economic calendar.
5. 🎯 STRATEGIC RECOMMENDATIONS — Give 3 specific, actionable steps the owner can take THIS WEEK to improve results. Be specific (e.g., "Add a COD FAQ since 23 customers asked about it" not just "improve FAQs").

Write in a confident, expert tone. Think like McKinsey meets WhatsApp. Short paragraphs, clear structure.`
	} else {
		depthInstruction = `
You are a helpful business advisor writing a concise Business Summary Report for a Sri Lankan SME owner.
Cover briefly:
1. How was this month overall? (1-2 sentences)
2. One key thing going well
3. One area to improve
4. One specific action to take next month
Be warm, practical, and encouraging. Not too long.`
	}

	prompt := fmt.Sprintf(`%s

BUSINESS DATA FOR %s:
%s
%s
LANGUAGE REQUIREMENT: %s

Write the AI analysis section now. Do NOT repeat the raw statistics. Do NOT add section headers or bullet point labels — write in natural flowing paragraphs (but can use line breaks). Keep it focused and valuable.`,
		depthInstruction,
		stats.Month,
		rawStats,
		prevContext,
		langInstruction,
	)

	body := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]interface{}{
			"temperature":     0.7,
			"maxOutputTokens": 600,
		},
	}

	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return "", err
	}

	// Extract text
	if candidates, ok := result["candidates"].([]interface{}); ok && len(candidates) > 0 {
		if content, ok := candidates[0].(map[string]interface{})["content"].(map[string]interface{}); ok {
			if parts, ok := content["parts"].([]interface{}); ok && len(parts) > 0 {
				if text, ok := parts[0].(map[string]interface{})["text"].(string); ok {
					return strings.TrimSpace(text), nil
				}
			}
		}
	}

	return "", fmt.Errorf("empty Gemini response")
}
