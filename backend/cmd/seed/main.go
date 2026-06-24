package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/config"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/knowledge"
	"github.com/kithmina1999/salespilot/models"
	"github.com/kithmina1999/salespilot/providersecrets"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const demoPassword = "Demo@123"

var seedAPIKeys = []string{
	"demo_api_key_ceylon_glow_busy",
	"demo_api_key_colombo_threads_light",
	"demo_api_key_techhub_light",
	"demo_api_key_serenity_light",
	"demo_api_key_1",
	"demo_api_key_2",
	"demo_api_key_3",
	"demo_api_key_4",
	"demo_api_key_5",
}

type seedProduct struct {
	Name        string
	Description string
	Price       float64
	Stock       int
	MaxStock    int
	Category    string
	Sizes       []string
	Colors      []string
	Aliases     []string
}

type seedCustomer struct {
	Name    string
	Phone   string
	Address string
	Tags    string
}

type createdCustomer struct {
	Model seedCustomer
	DB    models.Customer
}

func main() {
	cfg := config.Load()
	database.Init(cfg.DatabaseURL)
	db := database.DB

	rng := rand.New(rand.NewSource(20260525))
	passwordHash, _ := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)

	log.Println("Starting rich SalesPilot demo seed...")
	cleanupSeedBusinesses(db)

	richBiz := seedBusyBusiness(db, rng, string(passwordHash))
	seedLightBusiness(db, string(passwordHash), "Colombo Threads", "admin@colombothreads.lk", "+94771000001", "demo_api_key_colombo_threads_light", "connected")
	seedLightBusiness(db, string(passwordHash), "TechHub Sri Lanka", "admin@techhub.lk", "+94771000003", "demo_api_key_techhub_light", "disconnected")
	seedLightBusiness(db, string(passwordHash), "Serenity Spa & Salon", "admin@serenityspa.lk", "+94771000005", "demo_api_key_serenity_light", "not_connected")

	if err := knowledge.SyncAllSystemKnowledge(db); err != nil {
		log.Printf("warning: system knowledge sync failed: %v", err)
	}

	log.Println("Demo seed complete.")
	log.Printf("Busy tenant seeded (business ID %d); credentials are not written to logs", richBiz.ID)
}

func cleanupSeedBusinesses(db *gorm.DB) {
	var businesses []models.Business
	if err := db.Where("api_key IN ?", seedAPIKeys).Find(&businesses).Error; err != nil {
		log.Printf("warning: failed to query previous seed businesses: %v", err)
		return
	}
	for _, biz := range businesses {
		deleteBusinessData(db, biz.ID)
	}
}

func encryptedSeedWAAccessToken(token string) (string, bool) {
	encrypted, err := providersecrets.EncryptProviderToken(token)
	if err != nil {
		log.Printf("warning: demo WhatsApp credentials skipped because %s is not configured: %v", providersecrets.ProviderTokenEnvVar, err)
		return "", false
	}
	return encrypted, true
}

func deleteBusinessData(db *gorm.DB, businessID uint) {
	var proofIDs []uint
	db.Model(&models.PaymentProof{}).Where("business_id = ?", businessID).Pluck("id", &proofIDs)
	if len(proofIDs) > 0 {
		db.Unscoped().Where("payment_proof_id IN ?", proofIDs).Delete(&models.PaymentProofLineItem{})
	}

	var pipelineIDs []uint
	db.Model(&models.PipelineLog{}).Where("business_id = ?", businessID).Pluck("id", &pipelineIDs)
	if len(pipelineIDs) > 0 {
		db.Unscoped().Where("pipeline_log_id IN ?", pipelineIDs).Delete(&models.PipelineSignalLog{})
	}

	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.Product{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.Order{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.Customer{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.Rule{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.Message{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.KnowledgeGap{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.AuditLog{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.BlacklistedNumber{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.Cart{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.SavedAddress{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.MonthlyReport{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.PaymentProof{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.OrderPaymentProof{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.BillingPaymentAttempt{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.BillingServicePurchase{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.PipelineLog{})
	db.Unscoped().Where("business_id = ?", businessID).Delete(&models.User{})
	db.Unscoped().Where("id = ?", businessID).Delete(&models.Business{})
}

func seedBusyBusiness(db *gorm.DB, rng *rand.Rand, passwordHash string) models.Business {
	now := time.Now()
	createdAt := now.AddDate(0, -3, -12)
	planExpires := now.AddDate(1, 0, 0)
	connectedAt := createdAt.Add(12 * time.Hour)
	waAccessToken, waConnected := encryptedSeedWAAccessToken("EAA_demo_ceylon_glow_permanent_token")
	waStatus := "not_connected"
	var connectedAtPtr *time.Time
	if waConnected {
		waStatus = "connected"
		connectedAtPtr = &connectedAt
	}

	biz := models.Business{
		Name:                 "Ceylon Glow Boutique",
		Phone:                "+94771112222",
		APIKey:               "demo_api_key_ceylon_glow_busy",
		WAPhoneNumberID:      "109876543210001",
		WABAID:               "223344556677889",
		WAAccessToken:        waAccessToken,
		BotName:              "Glow Assistant",
		BotPersonality:       "You are a warm, concise WhatsApp sales assistant for Ceylon Glow Boutique. Help customers choose skincare and beauty products, answer delivery and payment questions, and guide checkout without sounding robotic.",
		OperatingHours:       "Mon-Sat 9:00 AM-7:30 PM. Sunday WhatsApp support only.",
		DeliveryPolicy:       "Island-wide delivery in 1-3 working days. Colombo same-day delivery before 2 PM. Standard delivery fee starts from Rs. 350. Free delivery above Rs. 8,000.",
		ConnectedAt:          connectedAtPtr,
		WAStatus:             waStatus,
		MetaCatalogID:        "catalog_ceylon_glow_demo",
		Plan:                 models.PlanPro,
		BillingCycle:         models.BillingAnnual,
		PlanExpiresAt:        &planExpires,
		CurrentUsageMonth:    now.Format("2006-01"),
		AIMessageLimit:       models.ProAILimit,
		SystemMessageLimit:   -1,
		RuleGenerationLimit:  models.ProRuleGenLimit,
		SimulationLimit:      models.ProSimulationLimit,
		OnboardingComplete:   true,
		BotReplyLanguage:     "en",
		BotSupportedLangs:    "en,si,ta",
		ResponseLanguage:     "english_first",
		AllowCOD:             true,
		AllowTransfer:        true,
		BankDetails:          "Bank: Commercial Bank\nAccount Name: Ceylon Glow Boutique\nAccount No: 7620184451\nBranch: Bambalapitiya\nPlease send the slip here after transfer.",
		MonthlyReportEnabled: true,
		ReportPhone:          "+94771112222",
		CreatedAt:            createdAt,
		UpdatedAt:            now.Add(-18 * time.Minute),
	}
	mustCreate(db, &biz)

	mustCreate(db, &models.User{
		BusinessID:      biz.ID,
		Email:           "owner@ceylonglow.lk",
		Phone:           biz.Phone,
		DisplayName:     "Anjali Perera",
		PasswordHash:    passwordHash,
		Role:            "admin",
		IsEmailVerified: true,
		IsActive:        true,
	})

	products := seedProducts(db, biz.ID)
	customers := seedCustomers(db, biz.ID, rng)
	seedSavedAddresses(db, biz.ID, customers)
	seedRules(db, biz.ID, rng)
	seedOrders(db, biz.ID, products, customers, rng)
	seedChatsAndPipeline(db, biz.ID, products, customers, rng)
	seedKnowledgeGaps(db, biz.ID, products, now)
	seedCarts(db, biz.ID, products, customers, rng)
	seedReportsAndAdminData(db, biz, rng)
	refreshUsageCounters(db, biz.ID)

	return biz
}

func seedProducts(db *gorm.DB, businessID uint) []models.Product {
	inputs := []seedProduct{
		{"Vitamin C Radiance Serum 30ml", "Brightening daily serum with vitamin C and niacinamide.", 4850, 42, 90, "Skincare", []string{"30ml"}, []string{}, []string{"vit c serum", "glow serum", "dark spot serum"}},
		{"Hydra Cloud Gel Moisturizer", "Lightweight moisturizer for humid weather.", 3950, 55, 100, "Skincare", []string{"50ml"}, []string{}, []string{"gel cream", "hydrating cream"}},
		{"SPF 50 Mineral Sunscreen", "No white cast sunscreen for daily use.", 3250, 78, 140, "Skincare", []string{"50ml"}, []string{}, []string{"sun cream", "spf", "sunscreen"}},
		{"Tea Tree Clarifying Cleanser", "Gentle cleanser for oily and acne-prone skin.", 2650, 61, 120, "Skincare", []string{"100ml"}, []string{}, []string{"face wash", "tea tree wash"}},
		{"Rose Water Toner Mist", "Alcohol-free toner mist for daily hydration.", 2100, 88, 150, "Skincare", []string{"100ml"}, []string{}, []string{"toner", "face mist"}},
		{"Velvet Matte Lipstick - Rose Nude", "Long-wear matte lipstick with a soft rose nude shade.", 2850, 34, 80, "Makeup", []string{}, []string{"Rose Nude"}, []string{"nude lipstick", "matte lipstick"}},
		{"Velvet Matte Lipstick - Berry Muse", "Long-wear berry shade for evenings.", 2850, 28, 80, "Makeup", []string{}, []string{"Berry Muse"}, []string{"berry lipstick", "dark lipstick"}},
		{"Soft Brow Definer Pencil", "Dual-ended brow pencil with spoolie.", 1950, 46, 90, "Makeup", []string{}, []string{"Dark Brown", "Ash Brown"}, []string{"eyebrow pencil", "brow pencil"}},
		{"Volume Lift Mascara", "Water-resistant mascara with lift and length.", 3100, 37, 90, "Makeup", []string{}, []string{"Black"}, []string{"mascara", "lash mascara"}},
		{"Glow Base Primer", "Pore smoothing primer for a soft glow finish.", 3600, 25, 70, "Makeup", []string{"30ml"}, []string{}, []string{"primer", "makeup base"}},
		{"Aloe Repair Sheet Mask Pack", "Pack of 5 soothing aloe masks.", 2450, 120, 180, "Masks", []string{"5 pack"}, []string{}, []string{"sheet mask", "aloe mask"}},
		{"Charcoal Detox Clay Mask", "Weekly clay mask for congestion and oil control.", 3400, 31, 70, "Masks", []string{"75ml"}, []string{}, []string{"clay mask", "charcoal mask"}},
		{"Glow Starter Gift Set", "Cleanser, toner, moisturizer and sunscreen mini set.", 8900, 19, 45, "Gift Sets", []string{"Mini Set"}, []string{}, []string{"starter kit", "gift pack", "skincare set"}},
		{"Bridal Prep Premium Box", "Four-week prep box for brides and events.", 18500, 7, 20, "Gift Sets", []string{"Premium"}, []string{}, []string{"bridal box", "wedding skincare"}},
		{"Coconut Vanilla Body Butter", "Rich body butter for dry skin.", 4200, 41, 80, "Body Care", []string{"200ml"}, []string{}, []string{"body cream", "body butter"}},
		{"Jasmine Hair Repair Oil", "Lightweight hair oil for frizz and shine.", 3750, 53, 100, "Hair Care", []string{"100ml"}, []string{}, []string{"hair oil", "jasmine oil"}},
		{"Travel Beauty Pouch", "Waterproof pouch for skincare and makeup.", 1750, 64, 120, "Accessories", []string{}, []string{"Blush", "Sage", "Black"}, []string{"makeup pouch", "travel pouch"}},
		{"Reusable Cotton Pads Set", "Set of 10 washable cotton pads.", 1250, 92, 160, "Accessories", []string{"10 pack"}, []string{}, []string{"cotton pads", "reusable pads"}},
	}

	products := make([]models.Product, 0, len(inputs))
	for i, in := range inputs {
		product := models.Product{
			BusinessID:  businessID,
			Name:        in.Name,
			Description: in.Description,
			Price:       in.Price,
			Stock:       in.Stock,
			MaxStock:    in.MaxStock,
			Category:    in.Category,
			Sizes:       mustJSON(in.Sizes),
			VariantType: variantType(in.Sizes),
			Colors:      mustJSON(in.Colors),
			Aliases:     mustJSON(in.Aliases),
			ImageURL:    fmt.Sprintf("/demo/products/ceylon-glow-%02d.jpg", i+1),
			RetailerID:  fmt.Sprintf("CG-%03d", i+1),
			Active:      true,
			CreatedAt:   time.Now().AddDate(0, -3, i%20),
			UpdatedAt:   time.Now().AddDate(0, 0, -i%9),
		}
		mustCreate(db, &product)
		if err := knowledge.SyncProductKnowledge(db, product); err != nil {
			log.Printf("warning: product knowledge sync failed for %s: %v", product.Name, err)
		}
		products = append(products, product)
	}
	return products
}

func seedCustomers(db *gorm.DB, businessID uint, rng *rand.Rand) []createdCustomer {
	names := []string{
		"Dinithi Jayasinghe", "Kavindu Perera", "Nadeesha Fernando", "Shanika Silva", "Ameesha Rathnayake",
		"Tharushi Wijesinghe", "Malki De Silva", "Rashmi Gunawardena", "Hiruni Samarakoon", "Sachini Peiris",
		"Ishara Madushani", "Nipuni Herath", "Sajini Wickramasinghe", "Dilani Kumari", "Yasara Abeysekara",
		"Chamodi Nanayakkara", "Piumi Dissanayake", "Imalka Perera", "Tania Rodrigo", "Fathima Azeema",
		"Ruwini Pathirana", "Gayan Lakmal", "Harini Alwis", "Nethmi Senanayake", "Buddhika Ekanayake",
		"Roshani Mendis", "Sithumi Karunaratne", "Anushka Fernando", "Malsha Amarasinghe", "Keshani Silva",
		"Dulani Jayawardena", "Vimukthi Perera", "Anjali Weerasinghe", "Nimasha Cooray", "Praveena Rajapaksha",
		"Sanduni Liyanage", "Yuki Tanaka", "Aisha Khan", "Meena Subramaniam", "Kavya Nair",
	}
	cities := []string{"Colombo 05", "Nugegoda", "Maharagama", "Kottawa", "Kandy", "Galle", "Negombo", "Kurunegala", "Matara", "Wattala", "Battaramulla", "Dehiwala"}
	tags := []string{"repeat", "vip", "skincare", "gift buyer", "cod", "bank transfer", "high intent", "bridal"}

	customers := make([]createdCustomer, 0, len(names))
	for i, name := range names {
		phone := fmt.Sprintf("+9477%06d", 310000+i*17)
		customer := models.Customer{
			BusinessID:  businessID,
			Phone:       phone,
			WhatsappJid: strings.TrimPrefix(phone, "+") + "@s.whatsapp.net",
			Name:        name,
			Address:     fmt.Sprintf("No. %d, %s Road, %s", 12+i*3, []string{"Temple", "Lake", "Park", "Station", "Flower"}[i%5], cities[i%len(cities)]),
			Notes:       []string{"Prefers quick replies", "Asks for ingredients", "Usually buys gifts", "Likes COD", "Sensitive skin"}[i%5],
			Tags:        strings.Join([]string{tags[i%len(tags)], tags[(i+3)%len(tags)]}, ", "),
			CreatedAt:   time.Now().AddDate(0, -2, -rng.Intn(24)),
			UpdatedAt:   time.Now().AddDate(0, 0, -rng.Intn(12)),
		}
		if i == 2 || i == 8 || i == 19 {
			until := time.Now().Add(6 * time.Hour)
			customer.BotPaused = true
			customer.BotPausedUntil = &until
		}
		mustCreate(db, &customer)
		customers = append(customers, createdCustomer{
			Model: seedCustomer{Name: name, Phone: phone, Address: customer.Address, Tags: customer.Tags},
			DB:    customer,
		})
	}
	return customers
}

func seedSavedAddresses(db *gorm.DB, businessID uint, customers []createdCustomer) {
	for i, customer := range customers {
		mustCreate(db, &models.SavedAddress{
			BusinessID: businessID,
			Phone:      customer.Model.Phone,
			Label:      "Home",
			Address:    customer.Model.Address,
			IsDefault:  true,
			CreatedAt:  time.Now().AddDate(0, -2, -i%20),
			UpdatedAt:  time.Now().AddDate(0, 0, -i%10),
		})
		if i%5 == 0 {
			mustCreate(db, &models.SavedAddress{
				BusinessID: businessID,
				Phone:      customer.Model.Phone,
				Label:      "Office",
				Address:    fmt.Sprintf("Level %d, Orion Tower, Colombo 02", 2+i%8),
				CreatedAt:  time.Now().AddDate(0, -1, -i%12),
				UpdatedAt:  time.Now().AddDate(0, 0, -i%6),
			})
		}
	}
}

func seedRules(db *gorm.DB, businessID uint, rng *rand.Rand) {
	rules := []models.Rule{
		faqRule(businessID, "Delivery", "delivery,shipping,courier,how long,delivery fee,same day,outstation", "Delivery is available island-wide. Colombo same-day delivery is available for orders confirmed before 2 PM. Outstation delivery usually takes 1-3 working days."),
		faqRule(businessID, "Payments", "payment,pay,cod,bank transfer,slip,account details,card", "We accept COD and bank transfer. For bank transfer, please send the payment slip here so we can approve the order quickly."),
		faqRule(businessID, "Returns", "return,exchange,refund,damaged,wrong item,broken", "Returns or exchanges are accepted within 7 days for unused products. Damaged or wrong items are replaced free after photo verification."),
		faqRule(businessID, "Ingredients", "ingredients,paraben,alcohol,vegan,cruelty free,sensitive skin", "Most Ceylon Glow products are cruelty-free. For sensitive skin, please tell us your concern and we will recommend the safest option."),
		faqRule(businessID, "Offers", "discount,offer,promo,bundle,free delivery,coupon", "Current offers: free delivery above Rs. 8,000, 10% off on Glow Starter Gift Set, and bundle pricing for cleanser + moisturizer + sunscreen."),
		faqRule(businessID, "Wholesale", "wholesale,bulk,reseller,salon price,corporate gift", "Bulk and salon orders are welcome. Send the product list and quantity, and our team will share wholesale pricing."),
		faqRule(businessID, "Warranty", "expiry,expiration,warranty,manufacture date,valid", "Skincare expiry dates are printed on each product. We only dispatch items with a healthy shelf life and sealed packaging."),
		faqRule(businessID, "Order Flow", "order,buy,checkout,confirm,address,quantity", "To order, send the product name, quantity, delivery address and payment method. We will confirm the summary before dispatch."),
		faqRule(businessID, "Support", "human,agent,call,complaint,speak to owner", "I can pass this to our team. Please share the issue and your order number if you have one."),
		faqRule(businessID, "Skin Type", "oily skin,dry skin,acne,dark spots,pigmentation,sunscreen", "Tell us your skin type and main concern. We can suggest a simple routine without overloading your skin."),
	}
	for i := range rules {
		rules[i].UsageCount = uint(18 + rng.Intn(180))
		mustCreate(db, &rules[i])
	}

	if err := knowledge.EnsureDynamicSettingKnowledge(db, models.Business{ID: businessID, AllowCOD: true, AllowTransfer: true}); err != nil {
		log.Printf("warning: dynamic knowledge sync failed: %v", err)
	}
}

func seedOrders(db *gorm.DB, businessID uint, products []models.Product, customers []createdCustomer, rng *rand.Rand) {
	orderNum := uint(1)
	now := time.Now()
	totalOrders := 165

	for i := 0; i < totalOrders; i++ {
		ageDays := rng.Intn(76)
		if i < 6 {
			ageDays = 0
		} else if i < 13 {
			ageDays = 1
		} else if i < 35 {
			ageDays = rng.Intn(7)
		}
		createdAt := dayTime(now.AddDate(0, 0, -ageDays), rng)
		customer := customers[rng.Intn(len(customers))]
		items, total := randomCartItems(products, rng)
		status := orderStatusForAge(ageDays, rng)
		paymentMethod := "cod"
		if rng.Intn(100) < 58 {
			paymentMethod = "bank_transfer"
		}
		paymentStatus := paymentStatusFor(status, paymentMethod, rng)
		updatedAt := createdAt.Add(time.Duration(2+rng.Intn(96)) * time.Hour)
		est := createdAt.AddDate(0, 0, 2+rng.Intn(3))
		tracking := ""
		if status == models.OrderStatusShipped || status == models.OrderStatusDelivered {
			tracking = fmt.Sprintf("DOMEX-CG-%05d", orderNum)
		}

		order := models.Order{
			BusinessID:        businessID,
			BusinessOrderNum:  orderNum,
			CustomerPhone:     customer.Model.Phone,
			CustomerName:      customer.Model.Name,
			Items:             mustJSON(items),
			TotalPrice:        total,
			Status:            status,
			Address:           customer.Model.Address,
			Notes:             orderNote(rng),
			PaymentMethod:     paymentMethod,
			PaymentStatus:     paymentStatus,
			TrackingNumber:    tracking,
			EstDeliveryDate:   &est,
			LateAlertSent:     ageDays > 5 && status == models.OrderStatusShipped && rng.Intn(100) < 25,
			DeliveryCheckSent: status == models.OrderStatusDelivered && rng.Intn(100) < 45,
			CreatedAt:         createdAt,
			UpdatedAt:         updatedAt,
		}
		if status == models.OrderStatusCancelled {
			order.CancelReason = []string{"Customer changed mind", "Payment not received", "Requested different shade", "Duplicate order"}[rng.Intn(4)]
		}
		mustCreate(db, &order)

		if paymentMethod == "bank_transfer" {
			proofStatus := models.PaymentStatusPending
			var reviewed *time.Time
			if paymentStatus == "paid" {
				proofStatus = models.PaymentStatusApproved
				reviewedAt := createdAt.Add(time.Duration(1+rng.Intn(8)) * time.Hour)
				reviewed = &reviewedAt
			}
			mustCreate(db, &models.OrderPaymentProof{
				BusinessID:    businessID,
				OrderID:       order.ID,
				CustomerPhone: customer.Model.Phone,
				Amount:        total,
				ScreenshotURL: fmt.Sprintf("/demo/receipts/cg-order-%04d.jpg", order.BusinessOrderNum),
				Description:   "Bank transfer slip detected with matching amount and reference.",
				Status:        proofStatus,
				ReviewedAt:    reviewed,
				CreatedAt:     createdAt.Add(35 * time.Minute),
				UpdatedAt:     updatedAt,
			})
		}

		orderNum++
	}
}

func seedChatsAndPipeline(db *gorm.DB, businessID uint, products []models.Product, customers []createdCustomer, rng *rand.Rand) {
	now := time.Now()
	scenarios := []struct {
		user  []string
		model []string
	}{
		{
			[]string{"Hi, vitamin c serum price?", "Can I use it for dark spots?", "Ok add one serum and sunscreen."},
			[]string{"Vitamin C Radiance Serum is Rs. 4,850 and SPF 50 Mineral Sunscreen is Rs. 3,250.", "Yes, it helps with dullness and dark spots. Use sunscreen daily with it.", "Sure. Please send your delivery address and payment method."},
		},
		{
			[]string{"Delivery to Kandy how many days?", "Can I pay COD?", "Great, send me the starter set."},
			[]string{"Kandy delivery usually takes 1-2 working days.", "Yes, COD is available for most locations.", "Glow Starter Gift Set is Rs. 8,900. Please confirm quantity and address."},
		},
		{
			[]string{"me sunscreen eka thiyenawada?", "white cast enawada?", "hari ekak denna"},
			[]string{"Ow, SPF 50 Mineral Sunscreen stock thiyenawa. Price Rs. 3,250.", "White cast adui. Daily use walata hondai.", "Hari. Address eka ewanna, COD da bank transfer da?"},
		},
		{
			[]string{"I need a gift for my sister birthday", "Budget around 10k", "Can you wrap it?"},
			[]string{"Glow Starter Gift Set is a good birthday option at Rs. 8,900.", "That fits your budget and we can add a small note card.", "Yes, gift wrapping is available. Send the message you want on the card."},
		},
		{
			[]string{"Do you have lipstick berry shade?", "Is it long lasting?", "I want 2"},
			[]string{"Yes, Velvet Matte Lipstick - Berry Muse is in stock at Rs. 2,850.", "It is long-wear matte and comfortable for daily use.", "Noted. Total for 2 is Rs. 5,700 before delivery."},
		},
		{
			[]string{"My order arrived but one mask leaked", "Order 118", "I can send photo"},
			[]string{"Sorry about that. Please send a clear photo of the leaked mask.", "Thanks. I will flag this for replacement review.", "Our team will update you shortly."},
		},
	}

	for i, customer := range customers {
		sc := scenarios[i%len(scenarios)]
		threadStart := now.AddDate(0, 0, -(rng.Intn(42))).Add(time.Duration(8+rng.Intn(10)) * time.Hour)
		status := "resolved"
		isRead := true
		if customer.DB.BotPaused {
			status = "needs_attention"
			isRead = false
			threadStart = now.Add(-time.Duration(10+i) * time.Minute)
		}

		for j := range sc.user {
			userAt := threadStart.Add(time.Duration(j*9) * time.Minute)
			userMsg := createMessage(db, businessID, customer.Model.Phone, "user", sc.user[j], status, isRead, false, userAt)
			seedPipelineLog(db, businessID, customer.Model.Phone, sc.user[j], botRouteFor(sc.user[j], rng), userAt, rng)
			if j < len(sc.model) && !(customer.DB.BotPaused && j == len(sc.user)-1) {
				modelAt := userAt.Add(time.Duration(25+rng.Intn(80)) * time.Second)
				createMessage(db, businessID, customer.Model.Phone, "model", sc.model[j], "resolved", true, false, modelAt)
			}
			if customer.DB.BotPaused && j == len(sc.user)-1 {
				db.Model(&userMsg).Update("is_unmatched", true)
			}
		}

		if i%6 == 0 {
			product := products[rng.Intn(len(products))]
			askAt := now.AddDate(0, 0, -rng.Intn(30)).Add(time.Duration(rng.Intn(500)) * time.Minute)
			createMessage(db, businessID, customer.Model.Phone, "user", fmt.Sprintf("Can you show %s?", product.Name), "resolved", true, false, askAt)
			createMessage(db, businessID, customer.Model.Phone, "model", fmt.Sprintf("%s is available at Rs. %.0f. Would you like to add it to your order?", product.Name, product.Price), "resolved", true, false, askAt.Add(45*time.Second))
		}
	}
}

func seedKnowledgeGaps(db *gorm.DB, businessID uint, products []models.Product, now time.Time) {
	gaps := []models.KnowledgeGap{
		gap(businessID, "Is this safe during pregnancy?", "is this safe during pregnancy", "en", "general_faq", "gemini_raw", "", nil, "static_faq", models.ActionCreateStaticFAQ, 11, now.Add(-2*time.Hour), "We recommend checking with your doctor before using active ingredients during pregnancy."),
		gap(businessID, "can i use vitamin c with retinol?", "can i use vitamin c with retinol", "en", "product_detail", "semantic_hint", "", &products[0].ID, "product_catalog", models.ActionUpdateProductCatalog, 8, now.Add(-5*time.Hour), "Use vitamin C in the morning and retinol at night if your skin tolerates it."),
		gap(businessID, "Do you deliver to Jaffna by Friday?", "do you deliver to jaffna by friday", "en", "delivery_question", "gemini_raw", "", nil, "dynamic_setting", models.ActionUpdateDeliverySettings, 7, now.Add(-9*time.Hour), "Jaffna delivery usually takes 2-4 working days."),
		gap(businessID, "salon wholesale price list eka denna", "salon wholesale price list eka denna", "si", "general_faq", "gemini_raw", "", nil, "static_faq", models.ActionCreateStaticFAQ, 6, now.Add(-18*time.Hour), "Wholesale pricing depends on quantity. A team member can share the list."),
		gap(businessID, "Can I reserve bridal box for next month?", "can i reserve bridal box for next month", "en", "product_detail", "semantic_hint", "", &products[13].ID, "product_catalog", models.ActionUpdateProductCatalog, 5, now.Add(-26*time.Hour), "Yes, we can reserve limited stock with a deposit."),
		gap(businessID, "Frimi payment thiyenawada?", "frimi payment thiyenawada", "si", "payment_question", "gemini_raw", "", nil, "dynamic_setting", models.ActionUpdatePaymentSettings, 4, now.Add(-33*time.Hour), "Currently COD and bank transfer are enabled."),
	}
	for i := range gaps {
		gaps[i].CreatedAt = now.AddDate(0, 0, -(i + 1))
		gaps[i].UpdatedAt = gaps[i].LastSeenAt
		mustCreate(db, &gaps[i])
	}

	resolvedAt := now.AddDate(0, 0, -4)
	resolved := gap(businessID, "Does sunscreen have fragrance?", "does sunscreen have fragrance", "en", "product_detail", "faq_high", "", &products[2].ID, "product_catalog", models.ActionUpdateProductCatalog, 9, now.AddDate(0, 0, -4), "It has a very light fragrance.")
	resolved.Resolved = true
	resolved.ResolvedAction = models.ActionUpdateProductCatalog
	resolved.ResolvedAt = &resolvedAt
	mustCreate(db, &resolved)
}

func seedCarts(db *gorm.DB, businessID uint, products []models.Product, customers []createdCustomer, rng *rand.Rand) {
	now := time.Now()
	states := []string{models.CartStatePendingAddress, models.CartStatePendingPaymentMethod, models.CartStateAddMore, models.CartStatePendingConfirm, models.CartStateAbandoned}
	for i := 0; i < 10; i++ {
		customer := customers[(i*3)%len(customers)]
		items, total := randomCartItems(products, rng)
		state := states[i%len(states)]
		updated := now.Add(-time.Duration(30+i*70) * time.Minute)
		if state == models.CartStateAbandoned {
			updated = now.Add(-time.Duration(26+i) * time.Hour)
		}
		cart := models.Cart{
			BusinessID:          businessID,
			Phone:               customer.Model.Phone,
			State:               state,
			PendingProductID:    items[0].ProductID,
			PendingProductName:  items[0].Name,
			PendingPrice:        items[0].Price,
			PendingQty:          items[0].Qty,
			Items:               mustJSON(items),
			TotalPrice:          total,
			Address:             customer.Model.Address,
			PaymentMethod:       []string{"cod", "bank_transfer"}[i%2],
			AbandonReminderSent: state == models.CartStateAbandoned && i%2 == 0,
			ExpiresAt:           updated.Add(24 * time.Hour),
			CreatedAt:           updated.Add(-35 * time.Minute),
			UpdatedAt:           updated,
		}
		mustCreate(db, &cart)
	}
}

func seedReportsAndAdminData(db *gorm.DB, biz models.Business, rng *rand.Rand) {
	now := time.Now()
	for i := 0; i < 4; i++ {
		month := now.AddDate(0, -i, 0).Format("2006-01")
		sentAt := time.Date(now.Year(), now.Month(), 2, 9, 15, 0, 0, now.Location()).AddDate(0, -i, 0)
		mustCreate(db, &models.MonthlyReport{
			BusinessID: biz.ID,
			Month:      month,
			ReportType: "advanced",
			ReportText: fmt.Sprintf("Monthly summary for %s: revenue grew from repeat customers, sunscreen and gift sets were the strongest categories, and response automation stayed above 80%%.", month),
			SentTo:     biz.ReportPhone,
			SentAt:     sentAt,
			CreatedAt:  sentAt,
		})
	}

	paidAt := now.AddDate(0, -1, -3)
	reviewedAt := paidAt.Add(2 * time.Hour)
	mustCreate(db, &models.PaymentProof{
		BusinessID:          biz.ID,
		BusinessName:        biz.Name,
		BusinessPhone:       biz.Phone,
		BusinessEmail:       "owner@ceylonglow.lk",
		CheckoutType:        "subscription",
		BillingCycle:        models.BillingAnnual,
		Plan:                models.PlanPro,
		Amount:              34900,
		PlanAmount:          34900,
		TotalAmount:         34900,
		ScreenshotURL:       "/demo/receipts/tenant-pro-annual.jpg",
		Status:              models.PaymentStatusApproved,
		DeclaredAmount:      34900,
		PaidAt:              &paidAt,
		PaymentReference:    "CG-PRO-ANNUAL-2026",
		ScanStatus:          "success",
		ScanExtractedAmount: 34900,
		ScanExtractedDate:   &paidAt,
		ScanExtractedRef:    "CG-PRO-ANNUAL-2026",
		ScanExtractedBank:   "Commercial Bank",
		ScanExtractedPayer:  "A Perera",
		ScanConfidence:      0.96,
		ScanReason:          "Amount, date and reference matched.",
		ActivationCode:      "CG-PRO-DEMO-2026",
		AdminNote:           "Demo payment approved by seed data.",
		ReviewedAt:          &reviewedAt,
		CreatedAt:           paidAt,
		UpdatedAt:           reviewedAt,
	})

	actions := []string{"product_created", "order_status_updated", "business_settings_updated", "manual_reply_sent", "payment_proof_approved", "knowledge_gap_resolved", "product_stock_updated"}
	categories := []string{"catalog", "order", "business", "bot", "billing", "knowledge", "catalog"}
	for i := 0; i < 38; i++ {
		actionIndex := i % len(actions)
		mustCreate(db, &models.AuditLog{
			BusinessID:   biz.ID,
			ActorType:    []string{"user", "system", "user"}[i%3],
			ActorID:      1,
			Action:       actions[actionIndex],
			EntityType:   strings.Split(actions[actionIndex], "_")[0],
			EntityID:     fmt.Sprintf("%d", 1000+i),
			Metadata:     mustJSON(map[string]interface{}{"seeded": true, "sequence": i + 1}),
			Risk:         []string{"low", "low", "medium"}[rng.Intn(3)],
			BusinessName: biz.Name,
			Category:     categories[actionIndex],
			BusinessPlan: biz.Plan,
			IPAddress:    "127.0.0.1",
			CreatedAt:    now.Add(-time.Duration(i*7) * time.Hour),
		})
	}
}

func refreshUsageCounters(db *gorm.DB, businessID uint) {
	now := time.Now()
	thisMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var aiMessages, userMessages, faqReplies, ruleGens, simulations int64
	db.Model(&models.Message{}).Where("business_id = ? AND role = ? AND created_at >= ?", businessID, "model", thisMonthStart).Count(&aiMessages)
	db.Model(&models.Message{}).Where("business_id = ? AND role = ? AND created_at >= ?", businessID, "user", thisMonthStart).Count(&userMessages)
	db.Model(&models.PipelineLog{}).Where("business_id = ? AND faq_hint_used = ? AND created_at >= ?", businessID, true, thisMonthStart).Count(&faqReplies)
	db.Model(&models.Rule{}).Where("business_id = ? AND system_managed = ?", businessID, false).Count(&ruleGens)
	db.Model(&models.PipelineLog{}).Where("business_id = ? AND is_sandbox = ? AND created_at >= ?", businessID, true, thisMonthStart).Count(&simulations)

	db.Model(&models.Business{}).Where("id = ?", businessID).Updates(map[string]interface{}{
		"current_usage_month":   now.Format("2006-01"),
		"ai_message_count":      int(aiMessages),
		"system_message_count":  int(userMessages),
		"faq_reply_count":       int(faqReplies),
		"rule_generation_count": int(ruleGens / 2),
		"simulation_count":      int(simulations),
		"total_storage_used":    int64(380 * 1024 * 1024),
		"ai_message_limit":      models.ProAILimit,
		"system_message_limit":  -1,
		"rule_generation_limit": models.ProRuleGenLimit,
		"simulation_limit":      models.ProSimulationLimit,
	})
}

func seedLightBusiness(db *gorm.DB, passwordHash, name, email, phone, apiKey, waStatus string) {
	now := time.Now()
	connectedAt := now.AddDate(0, -1, -8)
	biz := models.Business{
		Name:                 name,
		Phone:                phone,
		APIKey:               apiKey,
		Plan:                 models.PlanStarter,
		BillingCycle:         models.BillingMonthly,
		CurrentUsageMonth:    now.Format("2006-01"),
		AIMessageCount:       86,
		AIMessageLimit:       models.StarterAILimit,
		SystemMessageCount:   210,
		SystemMessageLimit:   -1,
		RuleGenerationLimit:  models.StarterRuleGenLimit,
		SimulationLimit:      models.StarterSimulationLimit,
		OnboardingComplete:   true,
		WAStatus:             waStatus,
		BotName:              "AI Assistant",
		AllowCOD:             true,
		AllowTransfer:        true,
		MonthlyReportEnabled: true,
		CreatedAt:            now.AddDate(0, -1, -12),
		UpdatedAt:            now.Add(-3 * time.Hour),
	}
	if waStatus != "not_connected" {
		if encryptedToken, ok := encryptedSeedWAAccessToken("EAA_light_demo_token"); ok {
			biz.WAPhoneNumberID = "wa_" + strings.ReplaceAll(apiKey, "demo_api_key_", "")
			biz.WABAID = "waba_" + strings.ReplaceAll(apiKey, "demo_api_key_", "")
			biz.WAAccessToken = encryptedToken
			biz.ConnectedAt = &connectedAt
		} else {
			biz.WAStatus = "not_connected"
		}
	}
	mustCreate(db, &biz)

	mustCreate(db, &models.User{
		BusinessID:      biz.ID,
		Email:           email,
		Phone:           phone,
		DisplayName:     "Admin",
		PasswordHash:    passwordHash,
		Role:            "admin",
		IsEmailVerified: true,
		IsActive:        true,
	})

	for i := 0; i < 4; i++ {
		product := models.Product{
			BusinessID: biz.ID,
			Name:       fmt.Sprintf("%s Demo Product %d", strings.Split(name, " ")[0], i+1),
			Price:      float64(2500 + i*1100),
			Stock:      20 + i*8,
			MaxStock:   60,
			Category:   "Demo",
			Aliases:    mustJSON([]string{fmt.Sprintf("demo item %d", i+1)}),
			Active:     true,
			CreatedAt:  now.AddDate(0, -1, -i),
			UpdatedAt:  now.AddDate(0, 0, -i),
		}
		mustCreate(db, &product)
		knowledge.SyncProductKnowledge(db, product) //nolint:errcheck
	}
	for i := 0; i < 16; i++ {
		customerPhone := fmt.Sprintf("+94775%05d", 10000+i)
		mustCreate(db, &models.Customer{
			BusinessID: biz.ID,
			Phone:      customerPhone,
			Name:       fmt.Sprintf("Demo Customer %d", i+1),
			Address:    "Colombo",
			CreatedAt:  now.AddDate(0, 0, -i),
			UpdatedAt:  now.AddDate(0, 0, -i/2),
		})
		createMessage(db, biz.ID, customerPhone, "user", "Hi, product details please", "resolved", true, false, now.AddDate(0, 0, -i))
		createMessage(db, biz.ID, customerPhone, "model", "Sure, I can help. Which product are you looking for?", "resolved", true, false, now.AddDate(0, 0, -i).Add(time.Minute))
	}
}

func faqRule(businessID uint, category, keywords, response string) models.Rule {
	return models.Rule{
		Model:         gorm.Model{CreatedAt: time.Now().AddDate(0, -2, 0), UpdatedAt: time.Now().AddDate(0, 0, -1)},
		BusinessID:    &businessID,
		Category:      category,
		Keywords:      keywords,
		Responses:     responses(response, "Singlish: "+response, "Tamil: "+response),
		Response:      response,
		IsActive:      true,
		ActionTier:    models.TierIntent,
		KnowledgeType: models.KnowledgeTypeStaticFAQ,
		SourceType:    models.SourceTypeManual,
		SystemManaged: false,
	}
}

func randomCartItems(products []models.Product, rng *rand.Rand) ([]models.CartItem, float64) {
	count := 1 + rng.Intn(3)
	items := make([]models.CartItem, 0, count)
	total := 0.0
	used := map[uint]bool{}
	for len(items) < count {
		product := products[rng.Intn(len(products))]
		if used[product.ID] {
			continue
		}
		used[product.ID] = true
		qty := 1
		if product.Price < 3500 && rng.Intn(100) < 35 {
			qty = 2
		}
		subtotal := product.Price * float64(qty)
		item := models.CartItem{
			ProductID: product.ID,
			Name:      product.Name,
			Qty:       qty,
			Price:     product.Price,
			Subtotal:  subtotal,
		}
		if strings.Contains(product.Sizes, "30ml") {
			item.Size = "30ml"
		}
		items = append(items, item)
		total += subtotal
	}
	return items, total
}

func orderStatusForAge(ageDays int, rng *rand.Rand) string {
	if ageDays == 0 {
		return []string{models.OrderStatusNew, models.OrderStatusConfirmed, models.OrderStatusConfirmed, models.OrderStatusShipped}[rng.Intn(4)]
	}
	if ageDays <= 3 {
		return []string{models.OrderStatusNew, models.OrderStatusConfirmed, models.OrderStatusShipped, models.OrderStatusDelivered}[rng.Intn(4)]
	}
	if ageDays <= 8 {
		return []string{models.OrderStatusConfirmed, models.OrderStatusShipped, models.OrderStatusDelivered, models.OrderStatusDelivered, models.OrderStatusCancelled}[rng.Intn(5)]
	}
	return []string{models.OrderStatusDelivered, models.OrderStatusDelivered, models.OrderStatusDelivered, models.OrderStatusCancelled}[rng.Intn(4)]
}

func paymentStatusFor(orderStatus, method string, rng *rand.Rand) string {
	if orderStatus == models.OrderStatusCancelled {
		return "cancelled"
	}
	if method == "cod" {
		if orderStatus == models.OrderStatusDelivered {
			return "paid"
		}
		return "pending"
	}
	if orderStatus == models.OrderStatusNew && rng.Intn(100) < 50 {
		return "pending"
	}
	return "paid"
}

func orderNote(rng *rand.Rand) string {
	notes := []string{
		"Please call before delivery.",
		"Gift wrap if possible.",
		"Leave with security if not home.",
		"Customer prefers evening delivery.",
		"Sensitive skin customer; include routine card.",
		"",
	}
	return notes[rng.Intn(len(notes))]
}

func createMessage(db *gorm.DB, businessID uint, phone, role, content, status string, isRead bool, unmatched bool, createdAt time.Time) models.Message {
	msg := models.Message{
		BusinessID:  businessID,
		Phone:       phone,
		Role:        role,
		Content:     content,
		Status:      status,
		IsUnmatched: unmatched,
		IsRead:      isRead,
	}
	msg.CreatedAt = createdAt
	msg.UpdatedAt = createdAt.Add(12 * time.Second)
	mustCreate(db, &msg)
	return msg
}

func seedPipelineLog(db *gorm.DB, businessID uint, phone, text, route string, createdAt time.Time, rng *rand.Rand) {
	intent := intentForText(text)
	aiUsed := route == "gemini_raw" || route == "semantic_hint"
	logEntry := models.PipelineLog{
		BusinessID:            businessID,
		Phone:                 phone,
		RawMessage:            text,
		CleanMessage:          strings.ToLower(text),
		ReducedMessage:        strings.ToLower(text),
		RouteTaken:            route,
		ActionTaken:           "replied",
		SelectedMatchType:     []string{"exact", "partial", "semantic"}[rng.Intn(3)],
		SelectedConfidence:    0.72 + rng.Float64()*0.26,
		SelectedRawConfidence: 0.65 + rng.Float64()*0.25,
		AIUsed:                aiUsed,
		FAQHintUsed:           route == "faq_high" || route == "faq_medium",
		BotReplyText:          "Seeded demo bot reply.",
		StateBefore:           []string{models.CartStateBrowsing, models.CartStateItemSelected, models.CartStatePendingAddress}[rng.Intn(3)],
		StateAfter:            []string{models.CartStateBrowsing, models.CartStateAddMore, models.CartStatePendingPaymentMethod}[rng.Intn(3)],
		ExecutionTimeMs:       int64(180 + rng.Intn(1400)),
		IntentClassified:      intent,
		LegacyIntent:          intent,
		RouterIntent:          intent,
		RouterRoute:           route,
		RouterConfidence:      0.74 + rng.Float64()*0.24,
		RouterCartPolicy:      "allow",
		RouterUsageClass:      []string{"faq", "catalog", "commerce", "support"}[rng.Intn(4)],
		RouterReasons:         mustJSON([]string{"seeded realistic traffic", "matched tenant knowledge"}),
		ModelUsed:             []string{"faq-cache", "gemini-2.0-flash", "router"}[rng.Intn(3)],
		IsSandbox:             false,
		DebugMode:             rng.Intn(100) < 12,
		CreatedAt:             createdAt,
	}
	mustCreate(db, &logEntry)
}

func gap(businessID uint, raw, normalized, lang, intent, route, cartState string, productID *uint, knowledgeType, action string, hits int, lastSeen time.Time, aiReply string) models.KnowledgeGap {
	return models.KnowledgeGap{
		BusinessID:             businessID,
		RawMessage:             raw,
		NormalizedMessage:      normalized,
		DetectedLanguage:       lang,
		RouterIntent:           intent,
		RouterRoute:            route,
		CartState:              cartState,
		SelectedProductID:      productID,
		AIReplyText:            aiReply,
		SuggestedKnowledgeType: knowledgeType,
		SuggestedAction:        action,
		ClusterKey:             models.BuildClusterKey(intent, normalized, productID),
		HitCount:               hits,
		LastSeenAt:             lastSeen,
		ResolvedMeta:           "{}",
	}
}

func intentForText(text string) string {
	lower := strings.ToLower(text)
	switch {
	case strings.Contains(lower, "delivery") || strings.Contains(lower, "kandy") || strings.Contains(lower, "jaffna"):
		return "delivery_question"
	case strings.Contains(lower, "pay") || strings.Contains(lower, "cod") || strings.Contains(lower, "bank"):
		return "payment_question"
	case strings.Contains(lower, "order") || strings.Contains(lower, "add one") || strings.Contains(lower, "want"):
		return "add_to_cart"
	case strings.Contains(lower, "complaint") || strings.Contains(lower, "leaked") || strings.Contains(lower, "broken"):
		return "support_or_complaint"
	default:
		return "product_detail"
	}
}

func botRouteFor(text string, rng *rand.Rand) string {
	intent := intentForText(text)
	if intent == "delivery_question" || intent == "payment_question" {
		return []string{"faq_high", "faq_medium"}[rng.Intn(2)]
	}
	if intent == "product_detail" {
		return []string{"faq_high", "semantic_hint", "gemini_raw"}[rng.Intn(3)]
	}
	return []string{"commerce_router", "gemini_raw", "faq_medium"}[rng.Intn(3)]
}

func dayTime(day time.Time, rng *rand.Rand) time.Time {
	return time.Date(day.Year(), day.Month(), day.Day(), 8+rng.Intn(13), rng.Intn(60), rng.Intn(60), 0, day.Location())
}

func variantType(sizes []string) string {
	if len(sizes) == 0 {
		return "none"
	}
	if strings.Contains(strings.Join(sizes, ","), "ml") || strings.Contains(strings.Join(sizes, ","), "pack") {
		return "volume"
	}
	return "none"
}

func responses(en, si, ta string) string {
	return mustJSON(map[string]string{"en": en, "si": si, "ta": ta})
}

func mustJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}

func mustCreate(db *gorm.DB, value interface{}) {
	if err := db.Create(value).Error; err != nil {
		log.Fatalf("seed create failed: %v", err)
	}
}
