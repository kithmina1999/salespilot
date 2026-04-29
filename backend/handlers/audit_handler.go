package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

// categoryForAction deterministically maps an action string to an audit category.
// Callers never need to think about category — it's always derived from the action.
func categoryForAction(action string) string {
	switch action {
	case "plan_overridden", "plan_activated", "plan_upgraded", "plan_downgraded",
		"trial_started", "renewal_reminder_sent":
		return "billing"
	case "phone_blacklisted", "phone_unblacklisted", "whatsapp_disconnected":
		return "security"
	case "order_status_updated", "monthly_report_sent":
		return "bot"
	case "product_created", "product_updated", "product_deleted",
		"rule_created", "rule_updated", "rule_deleted":
		return "catalog"
	default:
		// activation_code_created/revoked, business_created, global_rule_*, settings_updated, etc.
		return "system"
	}
}

// LogActivity is a global helper to record events to the append-only ledger.
// Category is auto-derived from the action — callers only provide risk, businessName, businessPlan.
func LogActivity(
	businessID uint,
	actorType string,
	actorID uint,
	action string,
	entityType string,
	entityID string,
	meta map[string]interface{},
	ipAddress string,
	risk string,
	businessName string,
	businessPlan string,
) {
	metaJSON, _ := json.Marshal(meta)
	logEntry := models.AuditLog{
		BusinessID:   businessID,
		ActorType:    actorType,
		ActorID:      actorID,
		Action:       action,
		EntityType:   entityType,
		EntityID:     entityID,
		Metadata:     string(metaJSON),
		IPAddress:    ipAddress,
		Risk:         risk,
		BusinessName: businessName,
		Category:     categoryForAction(action),
		BusinessPlan: businessPlan,
	}
	// Fire and forget
	go database.DB.Create(&logEntry)
}

// GetBusinessContext fetches business name and plan for audit log enrichment.
// Returns empty strings if not found — audit log will still be written.
func GetBusinessContext(businessID uint) (name, plan string) {
	var biz models.Business
	if err := database.DB.Select("name, plan").First(&biz, businessID).Error; err != nil {
		return "", ""
	}
	return biz.Name, biz.Plan
}

// ── Tenant Endpoints ─────────────────────────────────────────────────────────

// GetAuditLogs returns the 100 most recent events for the authenticated tenant.
func GetAuditLogs(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	var logs []models.AuditLog
	if err := db.Order("created_at DESC").Limit(100).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	c.JSON(http.StatusOK, logs)
}

// DownloadAuditLogs exports all audit logs for the tenant as a CSV file.
func DownloadAuditLogs(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)

	var logs []models.AuditLog
	if err := db.Order("created_at DESC").Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	filename := fmt.Sprintf("audit_logs_%v.csv", time.Now().Format("2006-01-02"))
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Type", "text/csv")

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"ID", "Timestamp", "Actor Type", "Actor ID", "Action", "Entity Type", "Entity ID", "IP Address", "Risk", "Metadata"})

	for _, l := range logs {
		writer.Write([]string{
			fmt.Sprintf("%d", l.ID),
			l.CreatedAt.Format(time.RFC3339),
			l.ActorType,
			fmt.Sprintf("%d", l.ActorID),
			l.Action,
			l.EntityType,
			l.EntityID,
			l.IPAddress,
			l.Risk,
			l.Metadata,
		})
	}
}

// ── Super Admin System Endpoints ─────────────────────────────────────────────

// buildSystemAuditQuery constructs a filtered GORM query from the request's query params.
// Supported filters:
//
//	?business_id=5          — filter by tenant
//	?risk=high              — filter by severity (low | medium | high)
//	?category=billing       — filter by event category
//	?action=plan_overridden — filter by exact action name
//	?actor_type=super_admin — filter by actor type
//	?search=ahmed           — text search across business_name and action
//	?from=2026-03-01        — start of date range (inclusive)
//	?to=2026-03-31          — end of date range (inclusive, rounded to end of day)
//	Defaults to today's logs when no date range is provided.
func buildSystemAuditQuery(c *gin.Context) *gorm.DB {
	q := database.DB.Model(&models.AuditLog{})

	if bid := c.Query("business_id"); bid != "" {
		q = q.Where("business_id = ?", bid)
	}
	if risk := c.Query("risk"); risk != "" {
		q = q.Where("risk = ?", risk)
	}
	if cat := c.Query("category"); cat != "" {
		q = q.Where("category = ?", cat)
	}
	if action := c.Query("action"); action != "" {
		q = q.Where("action = ?", action)
	}
	if actorType := c.Query("actor_type"); actorType != "" {
		q = q.Where("actor_type = ?", actorType)
	}
	if search := c.Query("search"); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		q = q.Where(
			"LOWER(business_name) LIKE ? OR LOWER(action) LIKE ? OR LOWER(entity_type) LIKE ?",
			like, like, like,
		)
	}

	// Date range — defaults to today when neither from nor to is provided
	fromStr := c.Query("from")
	toStr := c.Query("to")

	if fromStr == "" && toStr == "" {
		// Default view: only today's logs
		todayStart := time.Now().Truncate(24 * time.Hour)
		todayEnd := todayStart.Add(24 * time.Hour)
		q = q.Where("created_at >= ? AND created_at < ?", todayStart, todayEnd)
	} else {
		if fromStr != "" {
			if from, err := time.Parse("2006-01-02", fromStr); err == nil {
				q = q.Where("created_at >= ?", from)
			}
		}
		if toStr != "" {
			if to, err := time.Parse("2006-01-02", toStr); err == nil {
				q = q.Where("created_at < ?", to.Add(24*time.Hour))
			}
		}
	}

	return q.Order("created_at DESC")
}

// GetSystemAuditLogs returns platform-wide audit logs for Super Admin.
// Defaults to today's logs; use ?from=&to= for historical date navigation.
func GetSystemAuditLogs(c *gin.Context) {
	var logs []models.AuditLog
	if err := buildSystemAuditQuery(c).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch system audit logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":  logs,
		"count": len(logs),
		"stats": map[string]int{
			"high":   countByRisk(logs, "high"),
			"medium": countByRisk(logs, "medium"),
			"low":    countByRisk(logs, "low"),
		},
	})
}

// DownloadSystemAuditLogs exports filtered platform-wide audit logs as CSV.
func DownloadSystemAuditLogs(c *gin.Context) {
	var logs []models.AuditLog
	if err := buildSystemAuditQuery(c).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch system audit logs"})
		return
	}

	filename := fmt.Sprintf("platform_audit_%v.csv", time.Now().Format("2006-01-02"))
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Type", "text/csv")

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{
		"ID", "Timestamp", "Business", "Plan", "Actor Type", "Actor ID",
		"Category", "Action", "Entity Type", "Entity ID", "Risk", "IP Address", "Metadata",
	})

	for _, l := range logs {
		writer.Write([]string{
			fmt.Sprintf("%d", l.ID),
			l.CreatedAt.Format(time.RFC3339),
			l.BusinessName,
			l.BusinessPlan,
			l.ActorType,
			fmt.Sprintf("%d", l.ActorID),
			l.Category,
			l.Action,
			l.EntityType,
			l.EntityID,
			l.Risk,
			l.IPAddress,
			l.Metadata,
		})
	}
}

func countByRisk(logs []models.AuditLog, risk string) int {
	n := 0
	for _, l := range logs {
		if l.Risk == risk {
			n++
		}
	}
	return n
}
