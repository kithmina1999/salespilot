package models

import (
	"time"
)

// Order statuses
const (
	OrderStatusNew       = "new"
	OrderStatusConfirmed = "confirmed"
	OrderStatusShipped   = "shipped"
	OrderStatusDelivered = "delivered"
	OrderStatusCancelled = "cancelled"
)


type Order struct {
	ID             uint      `json:"id"             gorm:"primaryKey"`
	BusinessOrderNum uint    `json:"order_num"      gorm:"index"` // per-business sequential: #1, #2... (shown to customers)
	BusinessID     uint      `json:"business_id"    gorm:"index;not null"`
	CartID         uint      `json:"cart_id"`        // originating cart session
	CustomerPhone  string    `json:"customer_phone" gorm:"not null;index"`
	CustomerName   string    `json:"customer_name"`
	Items          string    `json:"items"`          // JSON array of CartItem
	TotalPrice     float64   `json:"total_price"`
	Status         string    `json:"status"         gorm:"default:new"`
	Address        string    `json:"address"`
	Notes          string    `json:"notes"`

	// Payment
	PaymentMethod  string    `json:"payment_method" gorm:"default:'cod'"`
	PaymentStatus  string    `json:"payment_status" gorm:"default:'pending'"`

	// Logistics
	TrackingNumber   string     `json:"tracking_number"`
	EstDeliveryDate  *time.Time `json:"est_delivery_date"`

	// Cancellation
	CancelReason string `json:"cancel_reason"`

	// Cron guards
	LateAlertSent    bool `json:"late_alert_sent"    gorm:"default:false"`
	DeliveryCheckSent bool `json:"delivery_check_sent" gorm:"default:false"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
