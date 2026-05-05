package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/kithmina1999/salespilot/config"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	email := flag.String("email", "", "Super admin email")
	password := flag.String("password", "", "Super admin password")
	name := flag.String("name", "Super Admin", "Super admin name")
	role := flag.String("role", models.SuperRoleOwner, "Super admin role (owner or support)")
	flag.Parse()

	if *email == "" || *password == "" {
		fmt.Println("Usage: go run cmd/seed_admin.go --email=admin@example.com --password=securepassword")
		os.Exit(1)
	}

	err := godotenv.Load()
	if err != nil {
		log.Println("⚠️  No .env file found. Using environment variables.")
	}

	cfg := config.Load()
	database.Init(cfg.DatabaseURL)

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("❌ Failed to hash password: %v", err)
	}

	// Create user
	admin := models.SuperAdminUser{
		Name:         *name,
		Email:        *email,
		PasswordHash: string(hashed),
		Role:         *role,
		IsActive:     true,
	}

	if err := database.DB.Create(&admin).Error; err != nil {
		log.Fatalf("❌ Failed to create super admin: %v", err)
	}

	fmt.Printf("✅ Successfully created super admin!\n")
	fmt.Printf("   Email: %s\n", admin.Email)
	fmt.Printf("   Role:  %s\n", admin.Role)
}
