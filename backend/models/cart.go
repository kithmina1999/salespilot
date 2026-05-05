package models

import "time"

// Cart states — the customer's order session progress
const (
	CartStateBrowsing             = "browsing"               // initial: showing product list
	CartStateItemSelected         = "item_selected"          // product chosen, showing details
	CartStatePendingSize          = "pending_size"           // awaiting size/variant selection
	CartStatePendingQty           = "pending_qty"            // awaiting quantity
	CartStateAddMore              = "add_more"               // item added, offer to add more or checkout
	CartStatePendingAddress       = "pending_address"        // awaiting delivery address
	CartStatePendingNotes         = "pending_notes"          // awaiting optional order note
	CartStatePendingPaymentMethod = "pending_payment_method" // awaiting payment method selection
	CartStatePendingConfirm       = "pending_confirm"        // showing summary, awaiting CONFIRM
	CartStatePlaced               = "placed"                 // order created in DB
	CartStateAbandoned            = "abandoned"              // expired / customer left
)

// Cart holds an in-progress order session for one customer.
// Persists for 24 hours. Abandoned carts trigger reminder messages (Pro).
type Cart struct {
	ID         uint   `json:"id"         gorm:"primaryKey"`
	BusinessID uint   `json:"business_id" gorm:"index;not null"`
	Phone      string `json:"phone"      gorm:"index;not null"`

	// Conversation state
	State string `json:"state" gorm:"default:'browsing'"`

	// Current item being added (pending)
	PendingProductID   uint    `json:"pending_product_id"`
	PendingProductName string  `json:"pending_product_name"`
	PendingPrice       float64 `json:"pending_price"`
	PendingSize        string  `json:"pending_size"`
	PendingColor       string  `json:"pending_color"`
	PendingQty         int     `json:"pending_qty"`

	// Cart contents — JSON array of CartItem
	// e.g. [{"product_id":1,"name":"Blue Shirt","qty":2,"size":"M","price":2500}]
	Items string `json:"items" gorm:"type:text;default:'[]'"`

	// Totals
	TotalPrice float64 `json:"total_price"`

	// Checkout details
	SavedAddressID uint   `json:"saved_address_id"` // 0 = custom typed address
	Address        string `json:"address"`
	Notes          string `json:"notes"`
	PaymentMethod  string `json:"payment_method" gorm:"default:'cod'"`

	// Lifecycle
	AbandonReminderSent bool      `json:"abandon_reminder_sent" gorm:"default:false"`
	ExpiresAt           time.Time `json:"expires_at"` // 24h from last UpdatedAt
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// CartItem is the JSON structure stored in Cart.Items
type CartItem struct {
	ProductID uint    `json:"product_id"`
	Name      string  `json:"name"`
	Qty       int     `json:"qty"`
	Size      string  `json:"size,omitempty"`
	Color     string  `json:"color,omitempty"`
	Price     float64 `json:"price"` // unit price at time of adding
	Subtotal  float64 `json:"subtotal"`
}

// SavedAddress stores a customer's pre-saved delivery addresses.
// Lets returning customers pick from a list via WhatsApp buttons.
type SavedAddress struct {
	ID         uint   `json:"id"          gorm:"primaryKey"`
	BusinessID uint   `json:"business_id" gorm:"index;not null"`
	Phone      string `json:"phone"       gorm:"index;not null"`

	Label     string `json:"label"`   // "🏠 Home", "🏢 Office"
	Address   string `json:"address"` // full address text
	IsDefault bool   `json:"is_default" gorm:"default:false"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
