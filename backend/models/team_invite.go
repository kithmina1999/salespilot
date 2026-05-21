package models

import "time"

// TeamInvite represents a pending invitation for a new user to join a business team.
//
// Security design:
//   - The raw token is generated with crypto/rand (48 bytes → base64url) and sent ONLY via email.
//   - The DB stores only SHA-256(raw_token) — a full DB dump cannot be used to accept an invite.
//   - Tokens expire after 72 hours.
//   - Tokens are single-use: AcceptedAt is set on first use and any subsequent attempt is rejected.
type TeamInvite struct {
	ID          uint       `json:"id" gorm:"primaryKey"`
	BusinessID  uint       `json:"business_id" gorm:"index;not null"`
	InvitedBy   uint       `json:"invited_by"`   // User.ID of the admin who sent it
	InviterName string     `json:"inviter_name"` // Snapshot of admin's display name for the email
	Email       string     `json:"email" gorm:"index;not null"`
	DisplayName string     `json:"display_name"`         // Admin sets this; used as the invitee's name
	Role        string     `json:"role" gorm:"not null"` // "staff" | "viewer"
	TokenHash   string     `json:"-" gorm:"not null"`    // SHA-256 of raw token — never exposed
	ExpiresAt   time.Time  `json:"expires_at"`           // 72 hours from creation
	AcceptedAt  *time.Time `json:"accepted_at"`          // nil = pending; non-nil = already accepted
	CreatedAt   time.Time  `json:"created_at"`
}
