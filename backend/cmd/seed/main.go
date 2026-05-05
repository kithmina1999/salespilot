package main

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/kithmina1999/salespilot/config"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg := config.Load()
	database.Init(cfg.DatabaseURL)

	db := database.DB

	log.Println("🌱 Starting premium mock data seeding for 5 specialized businesses...")

	passwordHash, _ := bcrypt.GenerateFromPassword([]byte("Demo@123"), bcrypt.DefaultCost)

	businesses := []struct {
		Name         string
		Email        string
		Phone        string
		WAPhone      string
		Products     []models.Product
		ServicesMode bool
	}{
		{
			Name:    "Colombo Threads",
			Email:   "admin@colombothreads.lk",
			Phone:   "+94771000001",
			WAPhone: "94771000001",
			Products: []models.Product{
				{Name: "Linen Casual Shirt", Price: 3500, Stock: 50, Category: "Men"},
				{Name: "Floral Maxi Dress", Price: 4200, Stock: 30, Category: "Women"},
				{Name: "Denim Jacket", Price: 6500, Stock: 20, Category: "Unisex"},
				{Name: "Cotton Chinos", Price: 3800, Stock: 40, Category: "Men"},
				{Name: "Silk Scarf", Price: 1500, Stock: 100, Category: "Accessories"},
			},
		},
		{
			Name:    "Ceylon Hampers & Gifts",
			Email:   "admin@ceylonhampers.lk",
			Phone:   "+94771000002",
			WAPhone: "94771000002",
			Products: []models.Product{
				{Name: "Anniversary Premium Hamper", Price: 12500, Stock: 15, Category: "Hampers"},
				{Name: "Birthday Chocolate Bouquet", Price: 4500, Stock: 25, Category: "Gifts"},
				{Name: "Spa Relax Gift Box", Price: 8000, Stock: 10, Category: "Hampers"},
				{Name: "Corporate Premium Basket", Price: 15000, Stock: 5, Category: "Corporate"},
			},
		},
		{
			Name:    "TechHub Sri Lanka",
			Email:   "admin@techhub.lk",
			Phone:   "+94771000003",
			WAPhone: "94771000003",
			Products: []models.Product{
				{Name: "iPhone 15 Pro Max 256GB", Price: 450000, Stock: 10, Category: "Phones"},
				{Name: "AirPods Pro (2nd Gen)", Price: 85000, Stock: 30, Category: "Audio"},
				{Name: "Apple Watch Series 9", Price: 145000, Stock: 15, Category: "Wearables"},
				{Name: "MacBook Air M2", Price: 350000, Stock: 5, Category: "Laptops"},
				{Name: "Anker 20W Fast Charger", Price: 4500, Stock: 100, Category: "Accessories"},
			},
		},
		{
			Name:    "Luxe Beauty Colombo",
			Email:   "admin@luxebeauty.lk",
			Phone:   "+94771000004",
			WAPhone: "94771000004",
			Products: []models.Product{
				{Name: "Velvet Matte Lipstick", Price: 3200, Stock: 50, Category: "Makeup"},
				{Name: "Vitamin C Radiance Serum", Price: 4500, Stock: 40, Category: "Skincare"},
				{Name: "Hydrating Moisturizer", Price: 5500, Stock: 35, Category: "Skincare"},
				{Name: "Volume Mascara", Price: 2800, Stock: 60, Category: "Makeup"},
			},
		},
		{
			Name:         "Serenity Spa & Salon",
			Email:        "admin@serenityspa.lk",
			Phone:        "+94771000005",
			WAPhone:      "94771000005",
			ServicesMode: true,
			Products: []models.Product{
				{Name: "Aromatherapy Massage (60 mins)", Price: 6500, Stock: 999, Category: "Massage"},
				{Name: "Deep Cleansing Facial", Price: 5000, Stock: 999, Category: "Facial"},
				{Name: "Gel Manicure & Pedicure", Price: 4500, Stock: 999, Category: "Nails"},
				{Name: "Bridal Hair & Makeup Trial", Price: 15000, Stock: 999, Category: "Bridal"},
			},
		},
	}

	for i, b := range businesses {
		// 1. Create Business
		biz := models.Business{
			Name:                 b.Name,
			Phone:                b.Phone,
			APIKey:               fmt.Sprintf("demo_api_key_%d", i+1),
			Plan:                 models.PlanPro, // Pro plan for screenshots
			OnboardingComplete:   true,
			WAStatus:             "connected", // Looks fully active
			WAPhoneNumberID:      fmt.Sprintf("wa_phone_id_%d", i+1),
			WABAID:               fmt.Sprintf("waba_id_%d", i+1),
			WAAccessToken:        "EAA_dummy_token_for_screenshot",
			BotName:              "AI Assistant",
			BotPersonality:       fmt.Sprintf("You are a friendly and polite AI sales assistant for %s. Keep your answers short and helpful.", b.Name),
			AllowCOD:             !b.ServicesMode, // Services usually don't do COD
			AllowTransfer:        true,
			MonthlyReportEnabled: true,
		}
		db.Create(&biz)

		// 2. Create Admin User
		user := models.User{
			BusinessID:      biz.ID,
			Email:           b.Email,
			Phone:           b.Phone,
			DisplayName:     "Admin",
			PasswordHash:    string(passwordHash),
			Role:            "admin",
			IsEmailVerified: true,
			IsActive:        true,
		}
		db.Create(&user)

		// 3. Add Products/Services
		for _, p := range b.Products {
			p.BusinessID = biz.ID
			db.Create(&p)
		}

		// 4. Add Mock Customers
		customer1 := models.Customer{
			BusinessID:  biz.ID,
			Phone:       fmt.Sprintf("+947720000%d1", i+1),
			WhatsappJid: fmt.Sprintf("947720000%d1@s.whatsapp.net", i+1),
			Name:        "Kamal Perera",
			Address:     "123 Galle Road, Colombo 03",
			Tags:        "vip, repeat",
		}
		db.Create(&customer1)

		customer2 := models.Customer{
			BusinessID:  biz.ID,
			Phone:       fmt.Sprintf("+947730000%d2", i+1),
			WhatsappJid: fmt.Sprintf("947730000%d2@s.whatsapp.net", i+1),
			Name:        "Nipunika Silva",
			Address:     "45 Kandy Road, Kadawatha",
		}
		db.Create(&customer2)

		// 5. Add Orders
		statuses := []string{models.OrderStatusNew, models.OrderStatusConfirmed, models.OrderStatusShipped, models.OrderStatusDelivered}

		for j := 1; j <= 5; j++ {
			c := customer1
			if j%2 == 0 {
				c = customer2
			}

			status := statuses[rand.Intn(len(statuses))]
			paymentStatus := "pending"
			if status == models.OrderStatusDelivered || status == models.OrderStatusShipped {
				paymentStatus = "paid"
			}

			order := models.Order{
				BusinessID:       biz.ID,
				BusinessOrderNum: uint(j),
				CustomerPhone:    c.Phone,
				CustomerName:     c.Name,
				Address:          c.Address,
				TotalPrice:       b.Products[0].Price * float64(j),
				Status:           status,
				PaymentMethod:    "bank_transfer",
				PaymentStatus:    paymentStatus,
				CreatedAt:        time.Now().Add(-time.Duration(j*24) * time.Hour), // Past dates for charts
				UpdatedAt:        time.Now().Add(-time.Duration(j*12) * time.Hour),
			}
			db.Create(&order)

			// Mock Finance: Add a PaymentProof if paid
			if paymentStatus == "paid" {
				proof := models.OrderPaymentProof{
					OrderID:       order.ID,
					BusinessID:    biz.ID,
					CustomerPhone: c.Phone,
					Amount:        order.TotalPrice,
					ScreenshotURL: "/dummy-receipt.jpg",
					Status:        "approved",
				}
				db.Create(&proof)
			}
		}

		msg1 := models.Message{
			BusinessID: biz.ID,
			Phone:      customer1.Phone,
			Role:       "user",
			Content:    "Hi, I want to check the status of my order.",
			Status:     "resolved",
			IsRead:     true,
		}
		msg2 := models.Message{
			BusinessID: biz.ID,
			Phone:      customer1.Phone,
			Role:       "model",
			Content:    "Hello! Your order is currently being processed and will be dispatched tomorrow.",
			Status:     "resolved",
			IsRead:     true,
		}
		msg3 := models.Message{
			BusinessID: biz.ID,
			Phone:      customer2.Phone,
			Role:       "user",
			Content:    "Do you have this item in stock?",
			Status:     "needs_attention", // To show in inbox
			IsRead:     false,
		}
		db.Create(&msg1)
		db.Model(&msg1).Update("created_at", time.Now().Add(-2*time.Hour))
		db.Create(&msg2)
		db.Model(&msg2).Update("created_at", time.Now().Add(-1*time.Hour))
		db.Create(&msg3)
		db.Model(&msg3).Update("created_at", time.Now().Add(-15*time.Minute))

		log.Printf("✅ Seeded data for %s", b.Name)
	}

	log.Println("🎉 Seeding complete! You can now log in with the admin emails and password 'Demo@123'")
}
