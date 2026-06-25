package database

import "testing"

func TestMigrationListIsValid(t *testing.T) {
	if err := validateMigrationList(); err != nil {
		t.Fatalf("migration list is invalid: %v", err)
	}
}
