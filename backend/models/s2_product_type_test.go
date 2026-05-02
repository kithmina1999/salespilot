package models

// s2_product_type_test.go — TDD for S2: Product Type enum field
//
// These tests verify the model-level contract:
//   - The three ProductType constants exist and are distinct
//   - The default type is "product"
//   - JSON marshaling round-trips the Type field correctly
//
// DB migration is AutoMigrate — tested at integration time by the server
// startup, not here.

import (
	"encoding/json"
	"testing"
)

func TestProductType_ConstantsAreDefined(t *testing.T) {
	types := []string{ProductTypeProduct, ProductTypeService, ProductTypeDigital}
	for _, pt := range types {
		if pt == "" {
			t.Errorf("ProductType constant must not be empty string")
		}
	}
}

func TestProductType_ConstantsAreDistinct(t *testing.T) {
	if ProductTypeProduct == ProductTypeService {
		t.Error("ProductTypeProduct and ProductTypeService must be different")
	}
	if ProductTypeProduct == ProductTypeDigital {
		t.Error("ProductTypeProduct and ProductTypeDigital must be different")
	}
	if ProductTypeService == ProductTypeDigital {
		t.Error("ProductTypeService and ProductTypeDigital must be different")
	}
}

func TestProductType_DefaultIsProduct(t *testing.T) {
	// A zero-value Product should have the string "product" as its intent
	// (GORM default applies at DB level; at model level the zero-value is ""
	// but we check the constant itself matches what DB would store)
	if ProductTypeProduct != "product" {
		t.Errorf("ProductTypeProduct = %q, want \"product\" (must match GORM default)", ProductTypeProduct)
	}
}

func TestProductType_JSONRoundTrip(t *testing.T) {
	// Verify the Type field survives JSON marshal → unmarshal
	p := Product{
		ID:    1,
		Name:  "Test Serum",
		Price: 999.0,
		Type:  ProductTypeService,
	}

	data, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}

	var p2 Product
	if err := json.Unmarshal(data, &p2); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}

	if p2.Type != ProductTypeService {
		t.Errorf("after JSON round-trip: Type = %q, want %q", p2.Type, ProductTypeService)
	}
}

func TestProductType_JSONKey(t *testing.T) {
	// The JSON key must be "type" (lowercase) — confirmed by struct tag
	p := Product{Type: ProductTypeDigital}
	data, _ := json.Marshal(p)

	var m map[string]interface{}
	json.Unmarshal(data, &m)

	if _, ok := m["type"]; !ok {
		t.Error("JSON output missing \"type\" key — check struct tag `json:\"type\"`")
	}
	if m["type"] != ProductTypeDigital {
		t.Errorf("JSON \"type\" = %v, want %q", m["type"], ProductTypeDigital)
	}
}
