package whatsapp

import (
	"regexp"
	"strings"
	"unicode"
)

// ─── Precompiled Regex Patterns ────────────────────────────────────────────────

var (
	emojiRe       = regexp.MustCompile(`[\x{1F000}-\x{1FFFF}]|[\x{2600}-\x{27FF}]|[\x{FE00}-\x{FE0F}]|[\x{1F300}-\x{1F9FF}]`)
	punctCleanRe  = regexp.MustCompile(`[!?.,:;""''()\[\]{}<>*_~]`)
	multiSpaceRe  = regexp.MustCompile(`\s+`)
	normRules     []*normRule
)

type normRule struct {
	re          *regexp.Regexp
	replacement string
}

// fillerWords are stripped from the beginning of messages (Sri Lankan greeting fillers)
var fillerWords = []string{
	"umm", "umm,", "um,", "um ", "aney", "aiyo", "ado", "malli", "akka", "aiyya",
	"bro,", "bro ", "sir,", "sir ", "madam,", "madam ", "boss,", "boss ",
	"hello,", "hello ", "hi,", "hi ", "hey,", "hey ", "oya", "api", "machan,", "machan ",
}

func init() {
	// All rules: pattern → canonical English term
	// Built for Sri Lankan "Singlish" — a mix of romanized Sinhala + colloquial English
	rawRules := []struct{ pattern, replacement string }{

		// ── PRICE / COST ───────────────────────────────────────────
		{`\b(praice|prize|kiyamuda|keeyada|kiyada|kiyadha|kiyadhaa|keyada|gaane|gaanak|ganak|gana|mila|milak|milagana|ganang|ganai|mudalak|mudal|mudalakata)\b`, "price"},
		{`\b(price eka|keeya ek)\b`, "price"},
		{`\b(costly|cheap|afford|salli|salliyak|salli neda|salli thiyanwada)\b`, "price"},

		// ── DELIVERY / SHIPPING ────────────────────────────────────
		{`\b(deliary|deliveri|delivary|deliery|deliver|dlivery|dlvry|courier|parcal|parsal|parcel|speed post|registered post|yamu|yanwada|yanawa|enna puluwanda|ennakola|enne|deliver karanawada|deliver wewida|deliver weida)\b`, "delivery"},
		{`\b(delivery eka|deliver eka|ship ek|ship karanawa)\b`, "delivery"},
		{`\b(island.?wide|colombo|kandy|galle|matara|kurunegala|anuradhapura|ratnapura)\b`, "delivery"},

		// ── AVAILABILITY / STOCK ────────────────────────────────────
		{`\b(thiyanwada|thiyanawa|thiyenawada|tiyenawa|tiyewida|stock ekak|stock thiyanawada|available wewida|available da|available wida|stock wida|innawada|innawadays|dang thiyenawa|ekai inna|ahanna|aluth|new stock)\b`, "availability"},
		{`\b(available|in stock|out of stock|out.of.stock|wadakarannada|wada karanawa)\b`, "availability"},

		// ── ORDER PLACEMENT ────────────────────────────────────────
		{`\b(order ekak|buy|ganna|ganne|gannekola|gannakola|danna|dannakola|purcashe|purchas|purches|order denna|ekak denna|order wela|order karanawa|kenakata|kennakata|kiyannekola|apply karanawa)\b`, "order"},
		{`\b(how to order|order karanne kohomada|ganne kohomada|danne kohomada|bayy|buy karanawa|order place)\b`, "order"},

		// ── PAYMENT ────────────────────────────────────────────────
		{`\b(paymant|payement|pay karanawa|pay karanna|pay wenawa|paynawa|bank transfer|cash on delivery|cod|eft|online pay|card pay|card|visa|mastercard|bank eka|bank account|account number|account no)\b`, "payment"},
		{`\b(genu ganna|genu gannakola|genu)|ගෙවනවා|ගෙවිම\b`, "payment"},
		{`\b(installment|deposit|advance|balanace|balance|pending pmt)\b`, "payment"},

		// ── RETURN / REFUND / EXCHANGE ─────────────────────────────
		{`\b(refund|Return|reta|retur|give back|pita ganna|exchange|swap|change karanawa|wapas|wapis|wapas ganna|nathuwata|broken|damage|damanged|defect|faulty|wadak ne|wadak nethi)\b`, "refund"},

		// ── PRODUCT DETAILS / SIZE / COLOUR ───────────────────────
		{`\b(size eka|size ekak|pata|kapima|kapiym|kapan|ek size|siz|sizé)\b`, "size"},
		{`\b(colour|colr|clour|varnat|variant|colour eka|ranga|rangu|rana)\b`, "colour"},
		{`\b(material|matrial|fabric|quality|qquality|qlty|texture|feel)\b`, "quality"},
		{`\b(photo|pic|picture|image|imagek|view|dakkanda|dakanna|photo ekkak|photo danna)\b`, "photo"},

		// ── LOCATION / ADDRESS ─────────────────────────────────────
		{`\b(koheda|location eka|place eka|address|addrees|adres|addrss|show room|showroom|shop|kata ganna|koheda inne)\b`, "location"},

		// ── CONTACT ────────────────────────────────────────────────
		{`\b(call karanawa|call karanna|number eka|call number|contact number|phone karanawa|reach karanawa|watasi|wasapi|whatsapp karanawa|dm karanawa)\b`, "contact"},

		// ── HOURS / OPEN / TIMING  ─────────────────────────────────
		{`\b(open wenawada|open da|open wida|weda karanawada|weda karanawa|operating hours|open time|close time|weda|weda da|business hours|timings|holiday)\b`, "hours"},

		// ── GUARANTEE / WARRANTY ────────────────────────────────────
		{`\b(guarantee|garanty|warantee|warenti|warranty|guruntee)\b`, "warranty"},

		// ── GREETING / OPENER ──────────────────────────────────────
		{`\b(ayubowan|kohomada|kohoma|kolomada|oyata kohomada|suba dawasak|subha dawasak|kohomad)\b`, "greeting"},

		// ── DISCOUNT / OFFERS ──────────────────────────────────────
		{`\b(discnt|discout|disount|offr|spl offer|special offer|promoshon|promotion|sale|wade ganna|sale eka|reduce|kudu|salli kota|salli kodi|cheap karanawa)\b`, "discount"},

		// ── BULK / WHOLESALE ────────────────────────────────────────
		{`\b(bulk order|wholesale|thika ganna|godak ganna|agent deal|reseller|patta ganna|hari ganna)\b`, "bulk"},
	}

	for _, r := range rawRules {
		normRules = append(normRules, &normRule{
			re:          regexp.MustCompile(`(?i)` + r.pattern),
			replacement: r.replacement,
		})
	}
}

// ─── Sinhala Script → Canonical English ──────────────────────────────────────

// sinhalaMap maps native Sinhala script words to canonical English terms.
// These cannot use \b (ASCII word-boundary), so we use exact string replacement.
var sinhalaMap = map[string]string{
	// Price
	"මිල":       "price",
	"කීයද":      "price",
	"ගාණ":       "price",
	"ගාණ කීයද":  "price",
	"මිලක්":     "price",
	"ගෙවිය":     "price",

	// Delivery
	"ඩිලිවරි":   "delivery",
	"ගෙනෙනවා":   "delivery",
	"යවනවා":     "delivery",

	// Order
	"ඕඩර්":      "order",
	"ගන්නවා":    "order",
	"ගන්නකොල":   "order",
	"ගන්නේ":     "order",

	// Payment
	"ගෙවනවා":    "payment",
	"ගෙවිම":     "payment",
	"ගෙවල":      "payment",
	"බැංකු":     "payment",

	// Location
	"ස්ථානය":    "location",
	"කොහෙද":     "location",
	"ලිපිනය":    "location",

	// Availability
	"තියෙනවාද":  "availability",
	"ස්ටොක්":    "availability",
	"ඇද්ද":      "availability",

	// Size/Colour
	"ප්‍රමාණය": "size",
	"රඟ":        "colour",
	"වර්ණය":     "colour",

	// Greeting
	"ආයුබෝවන්":  "greeting",
	"කොහොමද":    "greeting",
}

// ─── Public API ───────────────────────────────────────────────────────────────

// NormalizeMessage performs a multi-stage cleanup pipeline for Sri Lankan customer
// WhatsApp conversations. It handles Sinhala script, romanised Sinhala (Singlish),
// emojis, punctuation noise, filler words and common typos.
//
// The output is a lowercase English string with canonical domain terms that the
// FAQ matching and Gemini prompt layers can rely on.
func NormalizeMessage(msg string) string {
	if msg == "" {
		return ""
	}

	// 1. Sinhala script replacement FIRST (before lowercasing breaks Unicode checks)
	for k, v := range sinhalaMap {
		msg = strings.ReplaceAll(msg, k, v)
	}

	// 2. Lowercase
	msg = strings.ToLower(strings.TrimSpace(msg))

	// 3. Strip emojis
	msg = emojiRe.ReplaceAllString(msg, " ")

	// 4. Strip punctuation noise  (keep alphanumerics, spaces, apostrophes in contractions)
	msg = punctCleanRe.ReplaceAllString(msg, " ")

	// 5. Strip leading filler words (greeting openers Sri Lankans use before the real question)
	for _, filler := range fillerWords {
		if strings.HasPrefix(msg, filler) {
			msg = strings.TrimSpace(msg[len(filler):])
		}
	}

	// 6. Apply Singlish regex rules (word-bounded, precompiled)
	for _, rule := range normRules {
		msg = rule.re.ReplaceAllString(msg, rule.replacement)
	}

	// 7. Collapse multi-whitespace
	msg = multiSpaceRe.ReplaceAllString(msg, " ")

	return strings.TrimSpace(msg)
}

// IsSinhala checks whether the text contains any native Sinhala Unicode characters.
func IsSinhala(text string) bool {
	for _, r := range text {
		if unicode.Is(unicode.Sinhala, r) {
			return true
		}
	}
	return false
}

// isTamil checks for Tamil Unicode script characters (U+0B80–U+0BFF).
func isTamil(text string) bool {
	for _, r := range text {
		if r >= 0x0B80 && r <= 0x0BFF {
			return true
		}
	}
	return false
}

// isTamilRomanized checks for common romanized Tamil words used on WhatsApp.
func isTamilRomanized(msg string) bool {
	low := strings.ToLower(msg)
	terms := []string{
		"vanakkam", "epdi", "sollunga", "evalavu", "kudukka", "parunga",
		"theriyuma", "solunga", "enna price", "evvulavu", "vilaiku",
		"vittukku", "kudungal", "podunga",
	}
	for _, t := range terms {
		if strings.Contains(low, t) {
			return true
		}
	}
	return false
}

// isMalay checks for common Malay/Bahasa Malaysia words used on WhatsApp.
func isMalay(msg string) bool {
	low := strings.ToLower(msg)
	terms := []string{
		"berapa harga", "boleh", "saya nak", "macam mana", "nak order",
		"hantar", "bayar", "stok ada", "ada tak", "terima kasih",
		"encik", "puan", "apa harga", "mcm mana", "brp harga",
	}
	for _, t := range terms {
		if strings.Contains(low, t) {
			return true
		}
	}
	return false
}

// isArabic checks for Arabic Unicode script characters.
func isArabic(text string) bool {
	for _, r := range text {
		if r >= 0x0600 && r <= 0x06FF {
			return true
		}
	}
	return false
}

// isThai checks for Thai Unicode script characters.
func isThai(text string) bool {
	for _, r := range text {
		if r >= 0x0E00 && r <= 0x0E7F {
			return true
		}
	}
	return false
}

// detectMessageLanguage returns an ISO 639-1 code for the dominant script/language
// in the incoming WhatsApp message. Used to select the correct Rule.GetResponse() variant
// and to instruct Gemini which language to reply in.
//
// Detection order (most specific first):
//
//	Tamil script → "ta"
//	Sinhala script → "si"
//	Arabic script → "ar"
//	Thai script → "th"
//	Romanized Tamil → "ta"
//	Singlish (romanized Sinhala) → "si"
//	Malay phrases → "ms"
//	Default → "en"
func DetectMessageLanguage(msg string) string {
	// Script-level detection (definitive)
	if isTamil(msg) {
		return "ta"
	}
	if IsSinhala(msg) {
		return "si"
	}
	if isArabic(msg) {
		return "ar"
	}
	if isThai(msg) {
		return "th"
	}
	// Romanized detection (phrase-level)
	if isTamilRomanized(msg) {
		return "ta"
	}
	if isSinglish(msg) {
		return "si"
	}
	if isMalay(msg) {
		return "ms"
	}
	return "en"
}
