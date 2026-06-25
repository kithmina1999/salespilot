package database

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

type Migration struct {
	Version string
	Name    string
	Up      func(*gorm.DB) error
}

type SchemaMigration struct {
	Version   string    `gorm:"primaryKey;size:32"`
	Name      string    `gorm:"not null;size:255"`
	AppliedAt time.Time `gorm:"not null;autoCreateTime"`
}

func (SchemaMigration) TableName() string {
	return "schema_migrations"
}

var migrations = []Migration{
	{
		Version: "202606250001",
		Name:    "gorm_schema_sync_and_indexes",
		Up: func(db *gorm.DB) error {
			if err := autoMigrateApplicationModels(db); err != nil {
				return err
			}
			return EnsureProductionIndexes(db)
		},
	},
	{
		Version: "202606250002",
		Name:    "backfill_rule_responses_json",
		Up: func(db *gorm.DB) error {
			previous := DB
			DB = db
			defer func() { DB = previous }()
			MigrateRuleResponses()
			return nil
		},
	},
}

func RunPendingMigrations(db *gorm.DB) error {
	if err := validateMigrationList(); err != nil {
		return err
	}
	if err := db.AutoMigrate(&SchemaMigration{}); err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	pending, err := PendingMigrations(db)
	if err != nil {
		return err
	}
	if len(pending) == 0 {
		log.Println("database migrations already up to date")
		return nil
	}

	for _, migration := range pending {
		log.Printf("applying database migration %s %s", migration.Version, migration.Name)
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := migration.Up(tx); err != nil {
				return err
			}
			return tx.Create(&SchemaMigration{
				Version:   migration.Version,
				Name:      migration.Name,
				AppliedAt: time.Now().UTC(),
			}).Error
		}); err != nil {
			return fmt.Errorf("migration %s %s: %w", migration.Version, migration.Name, err)
		}
	}

	log.Printf("applied %d database migration(s)", len(pending))
	return nil
}

func VerifyNoPendingMigrations(db *gorm.DB) error {
	pending, err := PendingMigrations(db)
	if err != nil {
		return err
	}
	if len(pending) == 0 {
		return nil
	}

	versions := make([]string, 0, len(pending))
	for _, migration := range pending {
		versions = append(versions, migration.Version+" "+migration.Name)
	}
	return fmt.Errorf("pending migrations: %s; run salespilot-migrate up before starting the backend", strings.Join(versions, ", "))
}

func PendingMigrations(db *gorm.DB) ([]Migration, error) {
	if err := validateMigrationList(); err != nil {
		return nil, err
	}
	if !db.Migrator().HasTable(&SchemaMigration{}) {
		return append([]Migration(nil), migrations...), nil
	}

	var applied []SchemaMigration
	if err := db.Find(&applied).Error; err != nil {
		return nil, fmt.Errorf("load applied migrations: %w", err)
	}
	appliedVersions := make(map[string]bool, len(applied))
	for _, migration := range applied {
		appliedVersions[migration.Version] = true
	}

	pending := make([]Migration, 0)
	for _, migration := range migrations {
		if !appliedVersions[migration.Version] {
			pending = append(pending, migration)
		}
	}
	return pending, nil
}

func validateMigrationList() error {
	seen := map[string]bool{}
	previous := ""
	for _, migration := range migrations {
		if migration.Version == "" || migration.Name == "" || migration.Up == nil {
			return fmt.Errorf("invalid database migration entry: %+v", migration)
		}
		if seen[migration.Version] {
			return fmt.Errorf("duplicate database migration version %s", migration.Version)
		}
		if previous != "" && migration.Version <= previous {
			return fmt.Errorf("database migrations are not sorted: %s before %s", previous, migration.Version)
		}
		seen[migration.Version] = true
		previous = migration.Version
	}
	return nil
}

func autoMigrateApplicationModels(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.Business{}, &models.User{}, &models.Product{}, &models.Order{},
		&models.Customer{}, &models.Rule{}, &models.RuleTemplate{}, &models.Message{},
		&models.KnowledgeGap{}, &models.AuditLog{},
		&models.BlacklistedNumber{}, &models.ActivationCode{},
		&models.PasswordResetToken{},
		&models.EmailVerificationToken{},
		&models.PaymentProof{},
		&models.TeamInvite{},
		&models.MonthlyReport{},
		&models.Cart{},
		&models.SavedAddress{},
		&models.PasswordChangeToken{},
		&models.UserSession{},
		&models.OrderPaymentProof{},
		&models.SuperAdminUser{},
		&models.SuperAdminSession{},
		&models.PipelineLog{},
		&models.PipelineSignalLog{},
		&models.PlatformNotice{},
		&models.PlatformBillingSettings{},
		&models.SubscriptionPlan{},
		&models.BillingPaymentAttempt{},
		&models.BillingAddon{},
		&models.PaymentProofLineItem{},
		&models.BillingServicePurchase{},
		&models.EmbeddingArtifact{},
	)
}
