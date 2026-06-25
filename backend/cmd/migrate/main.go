package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/kithmina1999/salespilot/database"
)

func main() {
	_ = godotenv.Load()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	db, err := database.Open(dsn)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}

	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	switch command {
	case "up":
		if err := database.RunPendingMigrations(db); err != nil {
			log.Fatalf("run migrations: %v", err)
		}
	case "status":
		pending, err := database.PendingMigrations(db)
		if err != nil {
			log.Fatalf("check migration status: %v", err)
		}
		if len(pending) == 0 {
			fmt.Println("database migrations are up to date")
			return
		}
		fmt.Println("pending database migrations:")
		for _, migration := range pending {
			fmt.Printf("- %s %s\n", migration.Version, migration.Name)
		}
	default:
		log.Fatalf("unknown command %q; use up or status", command)
	}
}
