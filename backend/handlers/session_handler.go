package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ── GET /api/v1/settings/sessions ────────────────────────────────────────────
// Returns all non-revoked, non-expired sessions for the current user.
// The current session (matching JWT session_id) is flagged with is_current=true.

func GetActiveSessions(c *gin.Context) {
	userID := c.GetUint("user_id")
	currentSessionID := c.GetString("session_id")

	var sessions []models.UserSession
	if err := database.DB.
		Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, time.Now()).
		Order("last_active_at DESC").
		Find(&sessions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sessions"})
		return
	}

	type SessionResponse struct {
		ID           uint      `json:"id"`
		DeviceType   string    `json:"device_type"`
		Browser      string    `json:"browser"`
		OS           string    `json:"os"`
		IPAddress    string    `json:"ip_address"`
		LastActiveAt time.Time `json:"last_active_at"`
		CreatedAt    time.Time `json:"created_at"`
		IsCurrent    bool      `json:"is_current"`
	}

	result := make([]SessionResponse, 0, len(sessions))
	for _, s := range sessions {
		result = append(result, SessionResponse{
			ID:           s.ID,
			DeviceType:   s.DeviceType,
			Browser:      s.Browser,
			OS:           s.OS,
			IPAddress:    s.IPAddress,
			LastActiveAt: s.LastActiveAt,
			CreatedAt:    s.CreatedAt,
			IsCurrent:    s.SessionToken == currentSessionID,
		})
	}

	c.JSON(http.StatusOK, gin.H{"sessions": result})
}

// ── DELETE /api/v1/settings/sessions/:id ─────────────────────────────────────
// Revokes a specific session by ID. Cannot revoke the current session.

func RevokeSession(c *gin.Context) {
	userID := c.GetUint("user_id")
	currentSessionID := c.GetString("session_id")
	sessionID := c.Param("id")

	var session models.UserSession
	if err := database.DB.
		Where("id = ? AND user_id = ? AND revoked_at IS NULL", sessionID, userID).
		First(&session).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}

	// Prevent revoking the current session through this endpoint
	if session.SessionToken == currentSessionID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot revoke your current session. Sign out instead."})
		return
	}

	now := time.Now()
	database.DB.Model(&session).Update("revoked_at", &now)
	c.JSON(http.StatusOK, gin.H{"message": "Session revoked successfully."})
}

// ── DELETE /api/v1/settings/sessions ─────────────────────────────────────────
// Revokes ALL sessions for the current user EXCEPT the currently active one.

func RevokeAllOtherSessions(c *gin.Context) {
	userID := c.GetUint("user_id")
	currentSessionID := c.GetString("session_id")

	now := time.Now()
	result := database.DB.Model(&models.UserSession{}).
		Where("user_id = ? AND session_token != ? AND revoked_at IS NULL AND expires_at > ?",
			userID, currentSessionID, time.Now()).
		Update("revoked_at", &now)

	c.JSON(http.StatusOK, gin.H{
		"message": "All other sessions have been revoked.",
		"revoked": result.RowsAffected,
	})
}

// ── GET /api/v1/settings/login-history ───────────────────────────────────────
// Returns the last 50 login attempts (both success and failed) for the user.

func GetLoginHistory(c *gin.Context) {
	userID := c.GetUint("user_id")

	var sessions []models.UserSession
	if err := database.DB.
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(50).
		Find(&sessions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch login history"})
		return
	}

	type HistoryEntry struct {
		DeviceType  string    `json:"device_type"`
		Browser     string    `json:"browser"`
		OS          string    `json:"os"`
		IPAddress   string    `json:"ip_address"`
		LoginStatus string    `json:"login_status"`
		FailReason  string    `json:"fail_reason,omitempty"`
		CreatedAt   time.Time `json:"created_at"`
	}

	result := make([]HistoryEntry, 0, len(sessions))
	for _, s := range sessions {
		entry := HistoryEntry{
			DeviceType:  s.DeviceType,
			Browser:     s.Browser,
			OS:          s.OS,
			IPAddress:   s.IPAddress,
			LoginStatus: s.LoginStatus,
			CreatedAt:   s.CreatedAt,
		}
		if s.LoginStatus == "failed" {
			entry.FailReason = s.FailReason
		}
		result = append(result, entry)
	}

	c.JSON(http.StatusOK, gin.H{"history": result})
}
