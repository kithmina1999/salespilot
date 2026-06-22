package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/cache"
	"github.com/kithmina1999/salespilot/config"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/errorreporting"
	"github.com/kithmina1999/salespilot/handlers"
	"github.com/kithmina1999/salespilot/knowledge"
	"github.com/kithmina1999/salespilot/middleware"
	"github.com/kithmina1999/salespilot/observability"
	"github.com/kithmina1999/salespilot/services"
	"github.com/kithmina1999/salespilot/utils"
	"github.com/kithmina1999/salespilot/whatsapp"
)

func main() {
	observability.ConfigureFromEnv("salespilot-backend")
	reporter := errorreporting.NewDiscordReporter(100)
	observability.SetErrorReporter(reporter)
	defer reporter.Close()

	// Load config
	cfg := config.Load()

	// Set Gin mode before creating the engine
	gin.SetMode(cfg.GinMode)

	// Init database (PostgreSQL)
	database.Init(cfg.DatabaseURL)

	// Shared pipeline state backs BehaviorScorer, PromptShield budgets, and
	// first-message-of-day checks.
	appStore, err := newAppStateStore(cfg)
	if err != nil {
		log.Fatalf("failed to initialize pipeline state store: %v", err)
	}
	whatsapp.SetStateStore(appStore)

	// 10 concurrent workers
	utils.InitWorkerPool(10)

	// Run one-time data migrations (idempotent — safe to run on every deploy)
	database.MigrateRuleResponses()
	if err := knowledge.SyncAllSystemKnowledge(database.DB); err != nil {
		log.Printf("knowledge sync failed: %v", err)
	}

	// Load FAQ Cache & embed missing rules
	whatsapp.Cache.LoadRules()
	whatsapp.EmbedAllMissingRules()

	// Two-tier intent classifier: computes centroid embeddings for
	// shopping / browse / general intent in a background goroutine.
	whatsapp.InitIntentClassifier()

	// Init WhatsApp websocket

	// Create uploads directory
	os.MkdirAll("uploads/products", 0755)
	os.MkdirAll("uploads/receipts", 0755)

	// Setup Gin
	r := gin.New()
	r.Use(middleware.RequestContext(), middleware.Recovery())

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

	// System API Auth (Super Admin)
	systemAuth := r.Group("/system/auth")
	{
		systemAuth.POST("/login", middleware.RateLimitAdminLogin(), handlers.SuperAdminLogin)
		systemAuth.POST("/logout", middleware.RequireSuperAdmin(), handlers.SuperAdminLogout)
		systemAuth.GET("/me", middleware.RequireSuperAdmin(), handlers.SuperAdminMe)
	}

	// System API (Super Admin access only)
	system := r.Group("/system")
	system.Use(middleware.RequireSuperAdmin())
	{
		// Global metrics
		system.GET("/metrics", middleware.RequireSuperPermission(middleware.PermUsageView), handlers.GetSystemMetrics)

		// Business management
		system.POST("/businesses", middleware.RequireSuperPermission(middleware.PermBusinessManage), handlers.SystemCreateBusiness)
		system.GET("/businesses", middleware.RequireSuperPermission(middleware.PermBusinessView), handlers.ListSystemBusinesses)
		system.GET("/businesses/:id", middleware.RequireSuperPermission(middleware.PermBusinessView), handlers.GetSystemBusiness)
		system.PATCH("/businesses/:id/plan", middleware.RequireSuperPermission(middleware.PermPlanManage), middleware.HighRiskRoute("force_plan"), handlers.OverrideBusinessPlan)
		system.PATCH("/businesses/:id/quotas", middleware.RequireSuperPermission(middleware.PermPlanManage), middleware.HighRiskRoute("override_quotas"), handlers.OverrideBusinessQuotas)
		system.POST("/businesses/:id/reset-usage", middleware.RequireSuperPermission(middleware.PermPlanManage), middleware.HighRiskRoute("reset_usage"), handlers.ResetBusinessUsage)
		system.POST("/businesses/:id/suspend", middleware.RequireSuperPermission(middleware.PermBusinessManage), middleware.HighRiskRoute("suspend_business"), handlers.SuspendBusiness)
		system.POST("/businesses/:id/unsuspend", middleware.RequireSuperPermission(middleware.PermBusinessManage), middleware.HighRiskRoute("unsuspend_business"), handlers.UnsuspendBusiness)
		system.POST("/businesses/:id/debug-mode", middleware.RequireSuperPermission(middleware.PermBusinessManage), handlers.ToggleDebugMode)
		system.GET("/businesses/:id/pipeline-logs", middleware.RequireSuperPermission(middleware.PermBusinessView), handlers.ListPipelineLogs)
		system.GET("/pipeline-logs/:log_id", middleware.RequireSuperPermission(middleware.PermBusinessView), handlers.GetPipelineLogDetails)

		// Activation code management
		system.POST("/activation-codes", middleware.RequireSuperPermission(middleware.PermActivationCreate), middleware.HighRiskRoute("generate_code"), handlers.CreateActivationCode)
		system.GET("/activation-codes", middleware.RequireSuperPermission(middleware.PermActivationView), handlers.ListActivationCodes)
		system.DELETE("/activation-codes/:code", middleware.RequireSuperPermission(middleware.PermActivationDelete), middleware.HighRiskRoute("revoke_code"), handlers.RevokeActivationCode)

		// Payment proof verification queue
		system.GET("/payments", middleware.RequireSuperPermission(middleware.PermBillingView), handlers.ListPaymentProofs)
		system.POST("/payments/:id/approve", middleware.RequireSuperPermission(middleware.PermBillingManage), middleware.HighRiskRoute("approve_payment"), handlers.ApprovePayment)
		system.POST("/payments/:id/reject", middleware.RequireSuperPermission(middleware.PermBillingManage), middleware.HighRiskRoute("reject_payment"), handlers.RejectPayment)

		// Billing settings and plan catalog
		system.GET("/settings/billing", middleware.RequireSuperPermission(middleware.PermBillingView), handlers.GetSystemBillingSettings)
		system.PUT("/settings/billing", middleware.RequireSuperPermission(middleware.PermBillingManage), middleware.HighRiskRoute("update_billing_settings"), handlers.UpdateSystemBillingSettings)

		// Billing Addons
		system.GET("/billing/addons", middleware.RequireSuperPermission(middleware.PermBillingView), handlers.ListSystemBillingAddons)
		system.POST("/billing/addons", middleware.RequireSuperPermission(middleware.PermBillingManage), middleware.HighRiskRoute("create_addon"), handlers.CreateSystemBillingAddon)
		system.PUT("/billing/addons/:key", middleware.RequireSuperPermission(middleware.PermBillingManage), middleware.HighRiskRoute("update_addon"), handlers.UpdateSystemBillingAddon)
		system.POST("/billing/addons/:key/archive", middleware.RequireSuperPermission(middleware.PermBillingManage), middleware.HighRiskRoute("archive_addon"), handlers.ArchiveSystemBillingAddon)

		// Platform Notices
		system.GET("/notices", middleware.RequireSuperPermission(middleware.PermBusinessView), handlers.ListPlatformNotices)
		system.POST("/notices", middleware.RequireSuperPermission(middleware.PermBusinessManage), handlers.CreatePlatformNotice)
		system.DELETE("/notices/:id", middleware.RequireSuperPermission(middleware.PermBusinessManage), handlers.DeactivatePlatformNotice)

		// Global Rule management (DROP + Context Bridge + FAQ defaults)
		system.GET("/global-rules", middleware.RequireSuperPermission(middleware.PermBusinessView), handlers.ListGlobalRules)
		system.POST("/global-rules", middleware.RequireSuperPermission(middleware.PermBusinessManage), handlers.CreateGlobalRule)
		system.PUT("/global-rules/:id", middleware.RequireSuperPermission(middleware.PermBusinessManage), handlers.UpdateGlobalRule)
		system.DELETE("/global-rules/:id", middleware.RequireSuperPermission(middleware.PermBusinessManage), middleware.HighRiskRoute("delete_global_rule"), handlers.DeleteGlobalRule)

		// Platform-wide audit log (Super Admin only)
		system.GET("/audit-logs", middleware.RequireSuperPermission(middleware.PermAuditView), handlers.GetSystemAuditLogs)
		system.GET("/audit-logs/download", middleware.RequireSuperPermission(middleware.PermAuditView), handlers.DownloadSystemAuditLogs)
	}

	// Dashboard Authentication
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/login", middleware.RateLimit(20), handlers.Login)
		auth.POST("/register", middleware.RateLimit(20), handlers.Register)
		auth.POST("/verify-email", middleware.RateLimit(30), handlers.VerifyEmailOTP)
		auth.POST("/resend-verification", middleware.RateLimit(10), handlers.ResendEmailOTP)
		// Password reset via WhatsApp OTP — 3-step flow
		auth.POST("/forgot-password", middleware.RateLimit(10), handlers.ForgotPassword) // Step 1: send OTP
		auth.POST("/verify-otp", middleware.RateLimit(30), handlers.VerifyOTP)           // Step 2: verify OTP → get reset token
		auth.POST("/reset-password", middleware.RateLimit(20), handlers.ResetPassword)   // Step 3: set new password
	}

	// Dashboard Secured API (JWT)
	dash := r.Group("/api/v1", middleware.AuthRequired())
	{
		// Billing
		dash.GET("/billing/status", handlers.BillingStatus)
		dash.GET("/billing/bank-details", handlers.GetBillingBankDetails)
		dash.GET("/billing/options", handlers.GetBillingOptions)
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
		dash.POST("/products", middleware.RequireBusinessActive(), handlers.AdminCreateProduct)
		dash.PUT("/products/:id", middleware.RequireBusinessActive(), handlers.AdminUpdateProduct)
		dash.DELETE("/products/:id", middleware.RequireBusinessActive(), handlers.AdminDeleteProduct)
		dash.POST("/products/:id/image", middleware.RequireBusinessActive(), handlers.AdminUploadImage(cfg.ServerURL))

		// Dashboard Rule (FAQ) Management
		dash.GET("/rules", handlers.ListRules)
		dash.POST("/rules", middleware.RequireBusinessActive(), handlers.CreateRule)
		dash.POST("/rules/clone-template", middleware.RequireBusinessActive(), handlers.CloneTemplate)
		dash.PUT("/rules/:id", middleware.RequireBusinessActive(), handlers.UpdateRule)
		dash.DELETE("/rules/:id", middleware.RequireBusinessActive(), handlers.DeleteRule)
		dash.POST("/faqs/draft", middleware.RequireBusinessActive(), handlers.DraftFAQ)
		dash.POST("/rules/generate", middleware.RequireBusinessActive(), handlers.GenerateRule)   // Pro: AI-generates keywords + EN + SIN from intent
		dash.POST("/rules/translate", middleware.RequireBusinessActive(), handlers.TranslateRule) // Single field auto-translate

		// Dashboard Chats (CRM) Management
		dash.GET("/chats", handlers.ListChats)
		dash.GET("/chats/:phone", handlers.GetChatProfile)
		dash.POST("/chats/:phone/send", middleware.RequireBusinessActive(), handlers.SendManualReply)
		dash.PUT("/customers/:phone", middleware.RequireBusinessActive(), handlers.UpsertCustomer) // Allow updating notes/tags from dashboard
		dash.PATCH("/customers/:phone/bot-status", middleware.RequireBusinessActive(), handlers.ToggleBotPause)

		// Dashboard Orders Management
		dash.GET("/orders", handlers.ListOrders)
		dash.PATCH("/orders/:id/status", middleware.RequireBusinessActive(), handlers.UpdateOrderStatus)
		dash.PATCH("/orders/:id/late-alert", middleware.RequireBusinessActive(), handlers.ToggleLateAlert)
		// Slice 4: Payment proof review
		dash.GET("/orders/:id/proofs", handlers.GetOrderProofs)
		dash.GET("/order-proofs", handlers.ListOrderProofs)
		dash.POST("/order-proofs/:id/approve", middleware.RequireBusinessActive(), handlers.ApproveOrderProof)
		dash.POST("/order-proofs/:id/reject", middleware.RequireBusinessActive(), handlers.RejectOrderProof)

		// Dashboard Finance Analytics
		dash.GET("/finance/stats", handlers.FinanceStats)
		dash.GET("/finance/chart", handlers.FinanceChart)
		dash.GET("/finance/top-products", handlers.FinanceTopProducts)

		// Dashboard Core Analytics
		dash.GET("/dashboard/stats", handlers.GetDashboardStats)
		dash.GET("/dashboard/notifications", handlers.GetNotifications)
		dash.POST("/dashboard/notifications/mark-read", handlers.MarkAllNotificationsRead)

		// Dashboard Knowledge Gap Endpoints
		dash.GET("/knowledge-gaps", handlers.ListKnowledgeGaps)
		dash.POST("/knowledge-gaps/:id/resolve", handlers.ResolveKnowledgeGap)
		dash.POST("/knowledge-gaps/:id/mark-not-needed", handlers.MarkGapNotNeeded)

		// Dashboard Settings & Audit
		dash.GET("/settings/business", handlers.GetBusinessSettings)
		dash.PUT("/settings/business", middleware.RequireBusinessActive(), handlers.UpdateBusinessSettings)
		dash.POST("/business/simulate", middleware.RequireBusinessActive(), handlers.SimulateMessage)       // Sandbox simulator
		dash.DELETE("/business/simulate", middleware.RequireBusinessActive(), handlers.ClearSimulation)     // Clear Sandbox
		dash.PUT("/settings/language", middleware.RequireBusinessActive(), handlers.UpdateLanguageSettings) // ← independent dashboard + bot language
		dash.GET("/settings/usage", handlers.GetUsageStats)

		// Monthly Intelligence Report Settings
		dash.GET("/settings/report", handlers.GetReportSettings)
		dash.PUT("/settings/report", middleware.RequireBusinessActive(), handlers.UpdateReportSettings)
		dash.POST("/settings/report/test", middleware.RequireBusinessActive(), handlers.SendTestReport)
		dash.GET("/settings/report/history", handlers.GetReportHistory)
		dash.GET("/settings/logs", handlers.GetAuditLogs)
		dash.GET("/settings/logs/download", handlers.DownloadAuditLogs)
		dash.GET("/settings/blacklist", handlers.GetBlacklist)
		dash.POST("/settings/blacklist", middleware.RequireBusinessActive(), handlers.AddToBlacklist)
		dash.DELETE("/settings/blacklist/:id", middleware.RequireBusinessActive(), handlers.RemoveFromBlacklist)

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
		api.GET("/products/:id", func(c *gin.Context) {
			switch c.Param("id") {
			case "search":
				handlers.SearchProducts(c)
			case "categories":
				handlers.ListCategories(c)
			default:
				handlers.GetProduct(c)
			}
		})

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

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      180 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		log.Printf("🚀 SalesPilot API starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server failed: %v", err)
		}
	}()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutdown signal received — shutting down HTTP server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("❌ Server forced to shutdown: %v", err)
	}

	log.Println("🛑 HTTP server stopped — draining worker pool...")
	utils.DrainAndWait()
	closeStateStore(appStore)
	log.Println("✅ All workers finished — exiting cleanly")
}

func newAppStateStore(cfg *config.Config) (cache.StateStore, error) {
	backend := cache.NormalizeStateStoreBackend(cfg.StateStoreBackend)
	store, err := cache.NewStateStore(cache.StateStoreOptions{
		Backend: backend,
		Memory:  cache.DefaultConfig(),
		Redis: cache.RedisStoreOptions{
			URL:       cfg.RedisURL,
			Addr:      cfg.RedisAddr,
			Password:  cfg.RedisPassword,
			DB:        cfg.RedisDB,
			KeyPrefix: cfg.RedisKeyPrefix,
		},
	})
	if err != nil {
		return nil, err
	}

	if cfg.GinMode == gin.ReleaseMode && backend != "redis" {
		log.Println("WARNING: STATE_STORE=memory in release mode. Use STATE_STORE=redis for multi-instance deployments.")
	}
	log.Printf("Pipeline state store initialized: %s", backend)

	return store, nil
}

func closeStateStore(store cache.StateStore) {
	if stopper, ok := store.(interface{ Stop() }); ok {
		stopper.Stop()
	}
	if closer, ok := store.(interface{ Close() error }); ok {
		if err := closer.Close(); err != nil {
			log.Printf("state store close warning: %v", err)
		}
	}
}
