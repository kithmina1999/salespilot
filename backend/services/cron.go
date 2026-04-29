package services

import (
	"log"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// StartCronJobs starts all background automated tasks for the platform
func StartCronJobs() {
	log.Println("🚀 Starting background Cron Jobs...")

	// ── Hourly: Check expired plans + trials ──────────────────────────────────
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		for range ticker.C {
			checkExpiredPlans()
			checkExpiredTrials()
		}
	}()

	// ── Every 2h: Abandoned cart reminders ───────────────────────────────────
	go func() {
		ticker := time.NewTicker(2 * time.Hour)
		for range ticker.C {
			RunAbandonedCartReminders()
		}
	}()

	// ── Every 6h: Late delivery alerts ───────────────────────────────────────
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		for range ticker.C {
			RunLateDeliveryAlerts()
		}
	}()

	// ── Daily 6 AM: Monthly report dispatch ───────────────────────────────────
	go func() {
		for {
			now := time.Now()
			next6AM := time.Date(now.Year(), now.Month(), now.Day(), 6, 0, 0, 0, now.Location())
			if now.After(next6AM) {
				next6AM = next6AM.Add(24 * time.Hour)
			}
			log.Printf("📅 Monthly report cron: next check in %v", next6AM.Sub(now).Round(time.Minute))
			time.Sleep(next6AM.Sub(now))
			if time.Now().Day() == 1 {
				log.Println("📊 It's the 1st — triggering monthly business intelligence reports...")
				SendMonthlyReports()
			}
		}
	}()

	// Run once on startup just in case
	go checkExpiredPlans()
	go checkExpiredTrials()
}

func checkExpiredPlans() {
	now := time.Now()
	var businesses []models.Business
	
	// Find businesses where the plan has expired
	database.DB.Where("plan_expires_at IS NOT NULL AND plan_expires_at < ? AND plan != ?", now, models.PlanFree).Find(&businesses)
	
	for _, biz := range businesses {
		log.Printf("⚠️ Plan expired for business %d (%s) — Downgrading to Free", biz.ID, biz.Name)
		database.DB.Model(&biz).Updates(map[string]interface{}{
			"plan":            models.PlanFree,
			"plan_expires_at": nil,
		})
	}
}

func checkExpiredTrials() {
	now := time.Now()
	var businesses []models.Business
	
	// The trial sets an ai_message_limit during the trial. When it expires, AI limit goes to 0 (since they are Free plan)
	database.DB.Where("trial_expires_at IS NOT NULL AND trial_expires_at < ? AND ai_message_limit > 0", now).Find(&businesses)
	
	for _, biz := range businesses {
		log.Printf("⏱ Trial expired for business %d (%s) — Reverting AI limit", biz.ID, biz.Name)
		database.DB.Model(&biz).Updates(map[string]interface{}{
			"ai_message_limit": 0,
		})
	}
}
