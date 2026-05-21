package models

import "time"

// AuditLog represents an append-only ledger of user and system actions.
// The 4 denormalized fields (Risk, BusinessName, Category, BusinessPlan)
// are snapshots taken at the time of the event — they power both the
// Super Admin audit page and the future platform insights/analytics page.
type AuditLog struct {
	ID         uint   `json:"id" gorm:"primaryKey"`
	BusinessID uint   `json:"business_id" gorm:"index;not null"`
	ActorType  string `json:"actor_type"`                // "user", "system", or "super_admin"
	ActorID    uint   `json:"actor_id"`                  // User ID if actor is "user"
	Action     string `json:"action"`                    // e.g., "order_status_updated", "product_created"
	EntityType string `json:"entity_type"`               // e.g., "order", "product", "rule"
	EntityID   string `json:"entity_id"`                 // The ID of the entity that changed
	Metadata   string `json:"metadata" gorm:"type:text"` // JSON payload of what changed

	// ── Audit Page Fields ────────────────────────────────────────────────────
	Risk         string `json:"risk" gorm:"default:'low';index"` // "low" | "medium" | "high"
	BusinessName string `json:"business_name"`                   // Snapshot for badge display

	// ── Insights / Analytics Fields ─────────────────────────────────────────
	// These snapshot the tenant's state at event time for accurate historical analysis.
	Category     string `json:"category" gorm:"index"` // "billing" | "security" | "bot" | "catalog" | "system"
	BusinessPlan string `json:"business_plan"`         // Tenant plan at time of event ("free" | "starter" | "pro")

	IPAddress string    `json:"ip_address"` // IP of the actor
	CreatedAt time.Time `json:"created_at" gorm:"index"`
}
