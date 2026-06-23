package handlers

// order_proof_handler.go — Slice 4: "The Merchant's Review"
//
// Endpoints for merchants to list, approve, and reject customer payment proofs.
//
// Routes (registered in main.go):
//   GET    /api/v1/order-proofs             → ListOrderProofs
//   POST   /api/v1/order-proofs/:id/approve → ApproveOrderProof
//   POST   /api/v1/order-proofs/:id/reject  → RejectOrderProof

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/whatsapp"
)

// ListOrderProofs returns all pending/recent payment proofs for the merchant's orders.
// GET /api/v1/order-proofs
func ListOrderProofs(c *gin.Context) {
	businessID := c.GetUint("business_id")

	var proofs []models.OrderPaymentProof
	if err := database.DB.
		Where("business_id = ?", businessID).
		Order("created_at DESC").
		Limit(50).
		Find(&proofs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payment proofs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"proofs": proofs,
		"count":  len(proofs),
	})
}

// GetOrderProofs returns payment proofs for a specific order.
// GET /api/v1/orders/:id/proofs
func GetOrderProofs(c *gin.Context) {
	businessID := c.GetUint("business_id")
	orderID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var proofs []models.OrderPaymentProof
	if err := database.DB.
		Where("business_id = ? AND order_id = ?", businessID, orderID).
		Order("created_at DESC").
		Find(&proofs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch proofs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"proofs": proofs,
		"count":  len(proofs),
	})
}

// ApproveOrderProof approves a customer's payment proof:
// - Sets proof.Status = "approved"
// - Sets order.PaymentStatus = "approved"
// - Sets order.Status = "confirmed"
// - Notifies the customer via WhatsApp
//
// POST /api/v1/order-proofs/:id/approve
func ApproveOrderProof(c *gin.Context) {
	businessID := c.GetUint("business_id")
	proofID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid proof ID"})
		return
	}

	var proof models.OrderPaymentProof
	if err := database.DB.Where("id = ? AND business_id = ?", proofID, businessID).
		First(&proof).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment proof not found"})
		return
	}

	// Load the linked order
	var order models.Order
	if err := database.DB.Where("id = ? AND business_id = ?", proof.OrderID, businessID).
		First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	now := time.Now()

	// Update proof
	if err := database.DB.Model(&proof).Updates(map[string]interface{}{
		"status":      "approved",
		"reviewed_at": now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update proof"})
		return
	}

	// Update order — payment approved, auto-confirm the order
	if err := database.DB.Model(&order).Updates(map[string]interface{}{
		"payment_status": "approved",
		"status":         models.OrderStatusConfirmed,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order"})
		return
	}

	// WhatsApp notification to customer
	go func() {
		var business models.Business
		if err := database.DB.First(&business, businessID).Error; err != nil {
			return
		}
		if business.WAPhoneNumberID == "" || business.WAAccessToken == "" {
			return
		}
		accessToken, err := whatsappAccessTokenForBusiness(business)
		if err != nil {
			log.Printf("failed to decrypt customer approval token: %v", err)
			return
		}
		msg := fmt.Sprintf(
			"✅ *Payment Approved!*\n\n"+
				"Hi %s, your payment for *Order #%d* (Rs. %.0f) has been approved.\n\n"+
				"Your order is now *Confirmed* and will be processed shortly. Thank you! 🙏",
			order.CustomerName, order.BusinessOrderNum, order.TotalPrice,
		)
		customerPhone := order.CustomerPhone
		if len(customerPhone) > 0 && customerPhone[0] == '+' {
			customerPhone = customerPhone[1:]
		}
		if err := whatsapp.SendText(business.WAPhoneNumberID, accessToken, customerPhone, msg); err != nil {
			log.Printf("⚠️ [ProofHandler] Failed to notify customer of approval: %v", err)
		}
	}()

	log.Printf("✅ [ProofHandler] Proof #%d approved — Order #%d confirmed (biz=%d)",
		proof.ID, order.BusinessOrderNum, businessID)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Payment approved ✅",
		"proof_id": proof.ID,
		"order_id": order.ID,
	})
}

// RejectOrderProof rejects a customer's payment proof:
// - Sets proof.Status = "rejected" with optional merchant note
// - Sets order.PaymentStatus = "rejected" (order stays "new" so customer can retry)
// - Notifies the customer via WhatsApp with the rejection reason
//
// POST /api/v1/order-proofs/:id/reject
func RejectOrderProof(c *gin.Context) {
	businessID := c.GetUint("business_id")
	proofID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid proof ID"})
		return
	}

	var req struct {
		Note string `json:"note"` // optional rejection reason shown to customer
	}
	c.ShouldBindJSON(&req)

	var proof models.OrderPaymentProof
	if err := database.DB.Where("id = ? AND business_id = ?", proofID, businessID).
		First(&proof).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment proof not found"})
		return
	}

	var order models.Order
	if err := database.DB.Where("id = ? AND business_id = ?", proof.OrderID, businessID).
		First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	now := time.Now()

	// Update proof
	if err := database.DB.Model(&proof).Updates(map[string]interface{}{
		"status":        "rejected",
		"merchant_note": req.Note,
		"reviewed_at":   now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update proof"})
		return
	}

	// Update order payment status — keep order "new" so customer can re-submit proof
	if err := database.DB.Model(&order).UpdateColumn("payment_status", "rejected").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order"})
		return
	}

	// WhatsApp notification to customer
	go func() {
		var business models.Business
		if err := database.DB.First(&business, businessID).Error; err != nil {
			return
		}
		if business.WAPhoneNumberID == "" || business.WAAccessToken == "" {
			return
		}
		accessToken, err := whatsappAccessTokenForBusiness(business)
		if err != nil {
			log.Printf("failed to decrypt customer rejection token: %v", err)
			return
		}
		reasonLine := ""
		if req.Note != "" {
			reasonLine = fmt.Sprintf("\n\nReason: _%s_", req.Note)
		}
		msg := fmt.Sprintf(
			"❌ *Payment Not Verified*\n\n"+
				"Hi %s, we couldn't verify your payment for *Order #%d*.%s\n\n"+
				"Please send a clear screenshot of your bank transfer and we'll review it again. 🙏",
			order.CustomerName, order.BusinessOrderNum, reasonLine,
		)
		customerPhone := order.CustomerPhone
		if len(customerPhone) > 0 && customerPhone[0] == '+' {
			customerPhone = customerPhone[1:]
		}
		if err := whatsapp.SendText(business.WAPhoneNumberID, accessToken, customerPhone, msg); err != nil {
			log.Printf("⚠️ [ProofHandler] Failed to notify customer of rejection: %v", err)
		}
	}()

	log.Printf("✅ [ProofHandler] Proof #%d rejected — Order #%d payment_status=rejected (biz=%d)",
		proof.ID, order.BusinessOrderNum, businessID)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Payment rejected",
		"proof_id": proof.ID,
		"order_id": order.ID,
	})
}
