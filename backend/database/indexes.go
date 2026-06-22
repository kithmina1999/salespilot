package database

import (
	"fmt"
	"log"

	"gorm.io/gorm"
)

type productionIndex struct {
	Name string
	SQL  string
}

var productionIndexes = []productionIndex{
	{
		Name: "idx_msg_biz_phone_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_msg_biz_phone_created ON messages (business_id, phone, created_at DESC) WHERE deleted_at IS NULL`,
	},
	{
		Name: "idx_msg_biz_role_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_msg_biz_role_created ON messages (business_id, role, created_at DESC) WHERE deleted_at IS NULL`,
	},
	{
		Name: "idx_msg_unread_attention",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_msg_unread_attention ON messages (business_id, phone, created_at DESC) WHERE deleted_at IS NULL AND role = 'user' AND is_read = false`,
	},
	{
		Name: "idx_customers_attention",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_customers_attention ON customers (business_id, bot_paused, phone, bot_paused_until)`,
	},
	{
		Name: "idx_orders_biz_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_orders_biz_created ON orders (business_id, created_at DESC)`,
	},
	{
		Name: "idx_orders_biz_status_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_orders_biz_status_created ON orders (business_id, status, created_at DESC)`,
	},
	{
		Name: "idx_orders_biz_customer_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_orders_biz_customer_created ON orders (business_id, customer_phone, created_at DESC)`,
	},
	{
		Name: "idx_orders_biz_payment_queue",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_orders_biz_payment_queue ON orders (business_id, payment_method, payment_status, updated_at DESC)`,
	},
	{
		Name: "idx_orders_late_alert",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_orders_late_alert ON orders (updated_at) WHERE status = 'shipped' AND late_alert_sent = false`,
	},
	{
		Name: "idx_orders_stale_transfer",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_orders_stale_transfer ON orders (created_at) WHERE payment_method = 'bank_transfer' AND payment_status IN ('pending', 'rejected') AND status NOT IN ('cancelled', 'delivered')`,
	},
	{
		Name: "idx_products_biz_active_category",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_products_biz_active_category ON products (business_id, active, category)`,
	},
	{
		Name: "idx_products_biz_active_name",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_products_biz_active_name ON products (business_id, active, name)`,
	},
	{
		Name: "idx_products_biz_active_retailer",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_products_biz_active_retailer ON products (business_id, retailer_id) WHERE active = true AND retailer_id <> ''`,
	},
	{
		Name: "idx_rules_biz_active_system",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_rules_biz_active_system ON rules (business_id, is_active, system_managed) WHERE deleted_at IS NULL`,
	},
	{
		Name: "idx_rules_active_source",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_rules_active_source ON rules (is_active, source_type) WHERE deleted_at IS NULL`,
	},
	{
		Name: "idx_kg_biz_open_rank",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_kg_biz_open_rank ON knowledge_gaps (business_id, resolved, hit_count DESC, last_seen_at DESC) WHERE deleted_at IS NULL`,
	},
	{
		Name: "idx_kg_biz_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_kg_biz_created ON knowledge_gaps (business_id, created_at DESC) WHERE deleted_at IS NULL`,
	},
	{
		Name: "idx_plog_biz_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_plog_biz_created ON pipeline_logs (business_id, created_at DESC)`,
	},
	{
		Name: "idx_plog_biz_route_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_plog_biz_route_created ON pipeline_logs (business_id, route_taken, created_at DESC)`,
	},
	{
		Name: "idx_audit_biz_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_audit_biz_created ON audit_logs (business_id, created_at DESC)`,
	},
	{
		Name: "idx_audit_biz_filters_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_audit_biz_filters_created ON audit_logs (business_id, risk, category, created_at DESC)`,
	},
	{
		Name: "idx_audit_action_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_audit_action_created ON audit_logs (action, created_at DESC)`,
	},
	{
		Name: "idx_payproof_biz_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_payproof_biz_created ON payment_proofs (business_id, created_at DESC)`,
	},
	{
		Name: "idx_payproof_status_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_payproof_status_created ON payment_proofs (status, created_at DESC)`,
	},
	{
		Name: "idx_oproof_biz_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_oproof_biz_created ON order_payment_proofs (business_id, created_at DESC)`,
	},
	{
		Name: "idx_oproof_biz_order_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_oproof_biz_order_created ON order_payment_proofs (business_id, order_id, created_at DESC)`,
	},
	{
		Name: "idx_oproof_biz_status_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_oproof_biz_status_created ON order_payment_proofs (business_id, status, created_at DESC)`,
	},
	{
		Name: "idx_carts_biz_phone_active",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_carts_biz_phone_active ON carts (business_id, phone, expires_at) WHERE state NOT IN ('placed', 'abandoned')`,
	},
	{
		Name: "idx_carts_abandoned_scan",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_carts_abandoned_scan ON carts (updated_at, expires_at) WHERE abandon_reminder_sent = false AND state NOT IN ('placed', 'abandoned')`,
	},
	{
		Name: "idx_saved_addr_biz_phone_recent",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_saved_addr_biz_phone_recent ON saved_addresses (business_id, phone, is_default, updated_at DESC)`,
	},
	{
		Name: "idx_user_sessions_active_user",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_user_sessions_active_user ON user_sessions (user_id, last_active_at DESC) WHERE revoked_at IS NULL`,
	},
	{
		Name: "idx_user_sessions_user_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_user_sessions_user_created ON user_sessions (user_id, created_at DESC)`,
	},
	{
		Name: "idx_biz_plan_expiry",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_biz_plan_expiry ON businesses (plan_expires_at) WHERE plan <> 'free' AND plan_expires_at IS NOT NULL`,
	},
	{
		Name: "idx_biz_trial_expiry",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_biz_trial_expiry ON businesses (trial_expires_at) WHERE trial_expires_at IS NOT NULL`,
	},
	{
		Name: "idx_biz_monthly_report",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_biz_monthly_report ON businesses (id) WHERE monthly_report_enabled = true AND wa_phone_number_id <> ''`,
	},
	{
		Name: "idx_biz_suspended",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_biz_suspended ON businesses (suspended_at) WHERE suspended_at IS NOT NULL`,
	},
	{
		Name: "idx_activation_used_created",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_activation_used_created ON activation_codes (is_used, created_at DESC)`,
	},
	{
		Name: "idx_activation_used_by",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_activation_used_by ON activation_codes (used_by_id, used_at DESC) WHERE used_by_id IS NOT NULL`,
	},
	{
		Name: "idx_billing_addons_public",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_billing_addons_public ON billing_addons (is_active, visibility, sort_order)`,
	},
	{
		Name: "idx_bsp_biz_addon_status",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_bsp_biz_addon_status ON billing_service_purchases (business_id, addon_key, status)`,
	},
	{
		Name: "idx_platform_notices_active",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_platform_notices_active ON platform_notices (is_active, expires_at)`,
	},
	{
		Name: "idx_email_tokens_open_lookup",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_email_tokens_open_lookup ON email_verification_tokens (email, otp, expires_at) WHERE used_at IS NULL`,
	},
	{
		Name: "idx_email_tokens_email_recent",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_email_tokens_email_recent ON email_verification_tokens (email, created_at DESC)`,
	},
	{
		Name: "idx_reset_tokens_open_phone",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_reset_tokens_open_phone ON password_reset_tokens (phone, created_at DESC) WHERE used_at IS NULL`,
	},
	{
		Name: "idx_change_tokens_open_user",
		SQL:  `CREATE INDEX IF NOT EXISTS idx_change_tokens_open_user ON password_change_tokens (user_id, created_at DESC) WHERE used_at IS NULL`,
	},
}

// EnsureProductionIndexes creates composite and partial indexes that GORM model
// tags cannot express cleanly.
func EnsureProductionIndexes(db *gorm.DB) error {
	for _, idx := range productionIndexes {
		if err := db.Exec(idx.SQL).Error; err != nil {
			return fmt.Errorf("create index %s: %w", idx.Name, err)
		}
	}

	log.Printf("ensured %d production database indexes", len(productionIndexes))
	return nil
}
