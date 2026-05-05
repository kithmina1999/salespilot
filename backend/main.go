package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/cache"
	"github.com/kithmina1999/salespilot/config"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/handlers"
	"github.com/kithmina1999/salespilot/middleware"
	"github.com/kithmina1999/salespilot/services"
	"github.com/kithmina1999/salespilot/utils"
	"github.com/kithmina1999/salespilot/whatsapp"
)

func main() {
	// Load config
	cfg := config.Load()

	// Set Gin mode before creating the engine
	gin.SetMode(cfg.GinMode)

	// Init database (PostgreSQL)
	database.Init(cfg.DatabaseURL)

	// Pluggable state store — backs BehaviorScorer, PromptShield token budgets,
	// and first-message-of-day checks. Swap NewInMemoryStore → NewRedisStore
	// in this single line when horizontal scaling requires shared state.
	appStore := cache.NewInMemoryStore(cache.DefaultConfig())
	whatsapp.SetStateStore(appStore)

	// 10 concurrent workers
	utils.InitWorkerPool(10)

	// Run one-time data migrations (idempotent — safe to run on every deploy)
	database.MigrateRuleResponses()

	// Load FAQ Cache & embed missing rules
	whatsapp.Cache.LoadRules()
	whatsapp.EmbedAllMissingRules()

	// Two-tier intent classifier: computes centroid embeddings for
	// shopping / browse / general intent in a background goroutine.
	whatsapp.InitIntentClassifier()

	// Init WhatsApp websocket

	// Create uploads directory
	os.MkdirAll("uploads/products", 0755)

	// Setup Gin
	r := gin.Default()

	// Fix: Only trust the local reverse proxy (nginx on same host), not all proxies
	if err := r.SetTrustedProxies([]string{"127.0.0.1", "::1"}); err != nil {
		log.Printf("⚠️ SetTrustedProxies warning: %v", err)
	}

	// CORS — allow the Next.js frontend (and any future domains)
	rawOrigins := strings.Split(cfg.FrontendURL, ",")
	var origins []string
	for _, o := range rawOrigins {
		origins = append(origins, strings.TrimSpace(o))
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-API-Key", "X-Master-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Serve uploaded images as static files
	r.Static("/uploads", "./uploads")

	// Health check with DB ping (no auth)
	r.GET("/health", func(c *gin.Context) {
		// Ping the database
		sqlDB, err := database.DB.DB()
		if err != nil || sqlDB.Ping() != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":  "error",
				"service": "SalesPilot API",
				"db":      "unreachable",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "SalesPilot API",
			"db":      "connected",
		})
	})

	// Meta Webhook (public — no JWT, Meta POSTs/GETs here)
	r.GET("/api/whatsapp/webhook", whatsapp.VerifyWebhook)
	r.POST("/api/whatsapp/webhook", whatsapp.HandleWebhook)

	// System API (Master Admin access only)
	system := r.Group("/system", middleware.MasterAuth(cfg.MasterAPIKey))
	{
		// Global metrics
		system.GET("/metrics", handlers.GetSystemMetrics)

		// Business management
		system.POST("/businesses", handlers.SystemCreateBusiness)
		system.GET("/businesses", handlers.ListSystemBusinesses)
		system.GET("/businesses/:id", handlers.GetSystemBusiness)
		system.PATCH("/businesses/:id/plan", handlers.OverrideBusinessPlan)

		// Activation code management
		system.POST("/activation-codes", handlers.CreateActivationCode)
		system.GET("/activation-codes", handlers.ListActivationCodes)
		system.DELETE("/activation-codes/:code", handlers.RevokeActivationCode)

		// Payment proof verification queue
		system.GET("/payments", handlers.ListPaymentProofs)
		system.POST("/payments/:id/approve", handlers.ApprovePayment)
		system.POST("/payments/:id/reject", handlers.RejectPayment)

		// Global Rule management (DROP + Context Bridge + FAQ defaults)
		system.GET("/global-rules", handlers.ListGlobalRules)
		system.POST("/global-rules", handlers.CreateGlobalRule)
		system.PUT("/global-rules/:id", handlers.UpdateGlobalRule)
		system.DELETE("/global-rules/:id", handlers.DeleteGlobalRule)

		// Platform-wide audit log (Super Admin only)
		system.GET("/audit-logs", handlers.GetSystemAuditLogs)
		system.GET("/audit-logs/download", handlers.DownloadSystemAuditLogs)
	}

	// Dashboard Authentication
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/login", handlers.Login)
		auth.POST("/register", handlers.Register)
		auth.POST("/verify-email", handlers.VerifyEmailOTP)
		auth.POST("/resend-verification", handlers.ResendEmailOTP)
		// Password reset via WhatsApp OTP — 3-step flow
		auth.POST("/forgot-password", handlers.ForgotPassword) // Step 1: send OTP
		auth.POST("/verify-otp", handlers.VerifyOTP)           // Step 2: verify OTP → get reset token
		auth.POST("/reset-password", handlers.ResetPassword)   // Step 3: set new password
	}

	// Dashboard Secured API (JWT)
	dash := r.Group("/api/v1", middleware.AuthRequired())
	{
		// Billing
		dash.GET("/billing/status", handlers.BillingStatus)
		dash.POST("/billing/activate", handlers.RedeemActivationCode)   // Activation code redemption
		dash.POST("/billing/submit-proof", handlers.SubmitPaymentProof) // Bank transfer proof upload
		dash.GET("/billing/payment-status", handlers.GetPaymentStatus)  // Check latest proof status
		// dash.POST("/billing/initiate", handlers.BillingInitiate) // PayHere — hidden for now

		dash.POST("/onboarding/seed", handlers.OnboardingSeed)
		dash.GET("/onboarding/templates", handlers.GetOnboardingTemplates)
		dash.POST("/onboarding/seed-templates", handlers.SeedOnboardingTemplates)
		dash.POST("/billing/trial/start", handlers.StartTrial)

		// Meta WhatsApp Credential Management
		dash.POST("/whatsapp/connect", handlers.SaveMetaCredentials)
		dash.GET("/whatsapp/status", handlers.GetWhatsAppStatus)
		dash.POST("/whatsapp/test", handlers.TestMetaConnection)
		dash.POST("/whatsapp/disconnect", handlers.DisconnectWhatsApp)

		// Dashboard Product Management
		dash.GET("/products", handlers.AdminListProducts)
		dash.POST("/products", handlers.AdminCreateProduct)
		dash.PUT("/products/:id", handlers.AdminUpdateProduct)
		dash.DELETE("/products/:id", handlers.AdminDeleteProduct)
		dash.POST("/products/:id/image", handlers.AdminUploadImage(cfg.ServerURL))

		// Dashboard Rule (FAQ) Management
		dash.GET("/rules", handlers.ListRules)
		dash.POST("/rules", handlers.CreateRule)
		dash.POST("/rules/clone-template", handlers.CloneTemplate)
		dash.PUT("/rules/:id", handlers.UpdateRule)
		dash.DELETE("/rules/:id", handlers.DeleteRule)
		dash.POST("/faqs/draft", handlers.DraftFAQ)
		dash.POST("/rules/generate", handlers.GenerateRule) // Pro: AI-generates keywords + EN + SIN from intent
		dash.POST("/rules/translate", handlers.TranslateRule) // Single field auto-translate

		// Dashboard Chats (CRM) Management
		dash.GET("/chats", handlers.ListChats)
		dash.GET("/chats/:phone", handlers.GetChatProfile)
		dash.POST("/chats/:phone/send", handlers.SendManualReply)
		dash.PUT("/customers/:phone", handlers.UpsertCustomer) // Allow updating notes/tags from dashboard
		dash.PATCH("/customers/:phone/bot-status", handlers.ToggleBotPause)

		// Dashboard Orders Management
		dash.GET("/orders", handlers.ListOrders)
		dash.PATCH("/orders/:id/status", handlers.UpdateOrderStatus)
		dash.PATCH("/orders/:id/late-alert", handlers.ToggleLateAlert)
		// Slice 4: Payment proof review
		dash.GET("/orders/proofs", handlers.ListOrderProofs)
		dash.GET("/orders/:id/proofs", handlers.GetOrderProofs)
		dash.POST("/orders/proofs/:id/approve", handlers.ApproveOrderProof)
		dash.POST("/orders/proofs/:id/reject", handlers.RejectOrderProof)

		// Dashboard Finance Analytics
		dash.GET("/finance/stats", handlers.FinanceStats)
		dash.GET("/finance/chart", handlers.FinanceChart)
		dash.GET("/finance/top-products", handlers.FinanceTopProducts)

		// Dashboard Core Analytics
		dash.GET("/dashboard/stats", handlers.GetDashboardStats)
		dash.GET("/dashboard/notifications", handlers.GetNotifications)
		dash.POST("/dashboard/notifications/mark-read", handlers.MarkAllNotificationsRead)

		// Dashboard Settings & Audit
		dash.GET("/settings/business", handlers.GetBusinessSettings)
		dash.PUT("/settings/business", handlers.UpdateBusinessSettings)
		dash.POST("/business/simulate", handlers.SimulateMessage) // Sandbox simulator
		dash.DELETE("/business/simulate", handlers.ClearSimulation) // Clear Sandbox
		dash.PUT("/settings/language", handlers.UpdateLanguageSettings) // ← independent dashboard + bot language
		dash.GET("/settings/usage", handlers.GetUsageStats)

		// Monthly Intelligence Report Settings
		dash.GET("/settings/report", handlers.GetReportSettings)
		dash.PUT("/settings/report", handlers.UpdateReportSettings)
		dash.POST("/settings/report/test", handlers.SendTestReport)
		dash.GET("/settings/report/history", handlers.GetReportHistory)
		dash.GET("/settings/logs", handlers.GetAuditLogs)
		dash.GET("/settings/logs/download", handlers.DownloadAuditLogs)
		dash.GET("/settings/blacklist", handlers.GetBlacklist)
		dash.POST("/settings/blacklist", handlers.AddToBlacklist)
		dash.DELETE("/settings/blacklist/:id", handlers.RemoveFromBlacklist)

		// Authenticated email-OTP password change (3-step flow)
		dash.POST("/settings/change-password/request", handlers.RequestPasswordChangeOTP)
		dash.POST("/settings/change-password/verify", handlers.VerifyPasswordChangeOTP)
		dash.POST("/settings/change-password/reset", handlers.ConfirmPasswordChange)

		// Session management & login history
		dash.GET("/settings/sessions", handlers.GetActiveSessions)
		dash.DELETE("/settings/sessions", handlers.RevokeAllOtherSessions)
		dash.DELETE("/settings/sessions/:id", handlers.RevokeSession)
		dash.GET("/settings/login-history", handlers.GetLoginHistory)
	}

	// PayHere webhook — PUBLIC (no JWT, PayHere POSTs here after payment)
	r.POST("/api/v1/billing/notify", handlers.BillingNotify)

	// All API routes - rate limited, TenantAuth enforced
	api := r.Group("/api", middleware.RateLimit(100), middleware.TenantAuth())
	{
		// Product routes (customer-facing)
		api.GET("/products", handlers.ListProducts)
		api.GET("/products/:id", handlers.GetProduct)
		api.GET("/products/search", handlers.SearchProducts)
		api.GET("/products/categories", handlers.ListCategories)

		// Order routes
		api.POST("/orders", handlers.CreateOrder)
		api.GET("/orders", handlers.ListOrders)
		api.GET("/orders/customer/:phone", handlers.GetOrdersByCustomer)
		api.PATCH("/orders/:id/status", handlers.UpdateOrderStatus)

		// Customer routes
		api.POST("/customers", handlers.UpsertCustomer)
		api.GET("/customers/:phone", handlers.GetCustomer)

		// Admin routes (product management)
		admin := api.Group("/admin")
		{
			admin.POST("/products", handlers.AdminCreateProduct)
			admin.PUT("/products/:id", handlers.AdminUpdateProduct)
			admin.PATCH("/products/:id/stock", handlers.AdminUpdateStock)
			admin.DELETE("/products/:id", handlers.AdminDeleteProduct)
			admin.POST("/products/:id/image", handlers.AdminUploadImage(cfg.ServerURL))
		}

	}

	// Start Background Cron Jobs (e.g., 7-day order follow-ups)
	services.StartCronJobs()

	log.Printf("📁 Uploads served at %s/uploads/", cfg.ServerURL)

	go func() {
		log.Printf("🚀 SalesPilot API starting on port %s", cfg.Port)
		if err := r.Run(":" + cfg.Port); err != nil {
			log.Fatalf("❌ Server failed: %v", err)
		}
	}()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutdown signal received — draining worker pool...")
	utils.DrainAndWait()
	appStore.Stop() // stop cache GC goroutine cleanly
	log.Println("✅ All workers finished — exiting cleanly")
}
