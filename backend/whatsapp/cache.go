package whatsapp

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// CachedRule holds a rule together with its pre-decoded embedding vector.
// The embedding is decoded once at cache load time so the hot path (message handling)
// never needs to do JSON parsing — it just reads []float64 directly.
type CachedRule struct {
	Rule      models.Rule
	Embedding []float64 // nil if rule has no embedding yet
}

type FAQCache struct {
	mu            sync.RWMutex
	globalRules   []CachedRule
	businessRules map[uint][]CachedRule
	lastUpdated   time.Time
}

var Cache *FAQCache

func init() {
	Cache = &FAQCache{
		businessRules: make(map[uint][]CachedRule),
	}
}

// LoadRules fetches active rules from the database and updates the cache,
// decoding embedding blobs into []float64 at load time.
func (c *FAQCache) LoadRules() {
	c.mu.Lock()
	defer c.mu.Unlock()

	var rules []models.Rule
	if err := database.DB.Where(
		"is_active = ? AND (source_type IS NULL OR source_type = ? OR source_type NOT IN ?)",
		true,
		"",
		[]string{models.SourceTypePaymentSettings, models.SourceTypeDeliverySettings},
	).Find(&rules).Error; err != nil {
		log.Printf("❌ Failed to load FAQ rules: %v", err)
		return
	}

	globals := make([]CachedRule, 0)
	business := make(map[uint][]CachedRule)

	embedded := 0
	for _, r := range rules {
		cr := CachedRule{Rule: r}

		// Decode the stored embedding blob into []float64 once at load time
		if len(r.Embedding) > 0 {
			var vec []float64
			if err := json.Unmarshal(r.Embedding, &vec); err == nil && len(vec) > 0 {
				cr.Embedding = vec
				embedded++
			}
		}

		if r.BusinessID == nil {
			globals = append(globals, cr)
		} else {
			business[*r.BusinessID] = append(business[*r.BusinessID], cr)
		}
	}

	c.globalRules = globals
	c.businessRules = business
	c.lastUpdated = time.Now()
	log.Printf("✅ FAQ cache: %d global rules + %d businesses | %d/%d rules have embeddings",
		len(globals), len(business), embedded, len(rules))
}

// GetRules returns global rules and rules for a specific business as CachedRule slices.
func (c *FAQCache) GetRules(businessID uint) []CachedRule {
	c.mu.RLock()
	defer c.mu.RUnlock()

	rules := make([]CachedRule, 0, len(c.globalRules)+len(c.businessRules[businessID]))
	rules = append(rules, c.globalRules...)
	rules = append(rules, c.businessRules[businessID]...)
	return rules
}
