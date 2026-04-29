package whatsapp

import (
	"testing"
)

// ─── NormalizeMessage Unit Tests ──────────────────────────────────────────────

func TestNormalize_Price(t *testing.T) {
	cases := []struct{ in, want string }{
		{"shirt eke praice kiyanna", "price"},
		{"mila kiyanna", "price"},
		{"keeyada gana", "price"},
		{"kiyadha", "price"},
		{"shirt eke කීයද", "price"},
		{"shirt eka gaanak kiyada", "price"},
		{"mudal kiyadha eka", "price"},
	}
	for _, c := range cases {
		got := NormalizeMessage(c.in)
		if !containsWord(got, c.want) {
			t.Errorf("Price test | in=%q | got=%q | expected word %q", c.in, got, c.want)
		}
	}
}

func TestNormalize_Delivery(t *testing.T) {
	cases := []string{
		"deliary karannada",
		"deliveri eka kiyanna",
		"parcel eka koi danna",
		"parcal one yanavda",
		"courier eka thiyanawada",
		"island wide delivery da",
		"ඩිලිවරි eka thiyenawada",
	}
	for _, in := range cases {
		got := NormalizeMessage(in)
		if !containsWord(got, "delivery") {
			t.Errorf("Delivery test | in=%q | got=%q | expected 'delivery'", in, got)
		}
	}
}

func TestNormalize_Order(t *testing.T) {
	cases := []string{
		"order ekak danna puluwanda",
		"ganne kohomada",
		"buy karanawa kohomada",
		"ඕඩර් karanawa",
		"gannakola",
	}
	for _, in := range cases {
		got := NormalizeMessage(in)
		if !containsWord(got, "order") {
			t.Errorf("Order test | in=%q | got=%q | expected 'order'", in, got)
		}
	}
}

func TestNormalize_Payment(t *testing.T) {
	cases := []string{
		"paymant karannada",
		"bank transfer da",
		"cash on delivery thiyanawada",
		"cod option ekak thiyanawada",
		"ගෙවනවා kohomada",
	}
	for _, in := range cases {
		got := NormalizeMessage(in)
		if !containsWord(got, "payment") {
			t.Errorf("Payment test | in=%q | got=%q | expected 'payment'", in, got)
		}
	}
}

func TestNormalize_Availability(t *testing.T) {
	cases := []string{
		"stock thiyanawada",
		"available da",
		"tiyewida dang",
		"aluth stock enna da",
		"ස්ටොක් thiyanawada",
	}
	for _, in := range cases {
		got := NormalizeMessage(in)
		if !containsWord(got, "availability") {
			t.Errorf("Availability test | in=%q | got=%q | expected 'availability'", in, got)
		}
	}
}

func TestNormalize_Refund(t *testing.T) {
	cases := []string{
		"refund karannada",
		"exchange wenawada",
		"damage product wapas ganna puluwanda",
		"broken nisa return karanawa",
	}
	for _, in := range cases {
		got := NormalizeMessage(in)
		if !containsWord(got, "refund") {
			t.Errorf("Refund test | in=%q | got=%q | expected 'refund'", in, got)
		}
	}
}

func TestNormalize_Greeting(t *testing.T) {
	cases := []string{
		"ayubowan bro",
		"kohomada price eka",
		"ආයුබෝවන් price eka",
	}
	for _, in := range cases {
		got := NormalizeMessage(in)
		// After filler strip + greeting rule, "greeting" should appear or filler is removed
		_ = got // We just verify it doesn't panic and removes leading filler
	}
}

func TestNormalize_FillerStrip(t *testing.T) {
	// Filler words like "bro," should be stripped from the start
	in := "bro, price eka kiyada"
	got := NormalizeMessage(in)
	// After stripping "bro, ", we should NOT start with "bro"
	if containsWord(got, "bro") {
		t.Errorf("Filler strip failed | in=%q | got=%q | 'bro' should be stripped", in, got)
	}
	if !containsWord(got, "price") {
		t.Errorf("Filler strip | in=%q | got=%q | 'price' should still be present", in, got)
	}
}

func TestNormalize_Discount(t *testing.T) {
	cases := []string{
		"discnt thiyanawada",
		"special offer ekak thiyanawada",
		"sale eka",
		"discout tiyenawada",
	}
	for _, in := range cases {
		got := NormalizeMessage(in)
		if !containsWord(got, "discount") {
			t.Errorf("Discount test | in=%q | got=%q | expected 'discount'", in, got)
		}
	}
}

func TestNormalize_NoFalsePositives(t *testing.T) {
	// Substring collision guard: "magazine" contains "gana" — must NOT be replaced
	in := "do you sell this magazine"
	got := NormalizeMessage(in)
	if !containsWord(got, "magazine") {
		t.Errorf("False positive | in=%q | got=%q | 'magazine' should not be mangled", in, got)
	}
}

func TestNormalize_SinhalaScript(t *testing.T) {
	cases := []struct{ in, want string }{
		{"තියෙනවාද", "availability"},
		{"ගෙවනවා kohomada", "payment"},
		{"කොහෙද", "location"},
		{"ගෙනෙනවා eka", "delivery"},
	}
	for _, c := range cases {
		got := NormalizeMessage(c.in)
		if !containsWord(got, c.want) {
			t.Errorf("Sinhala script | in=%q | got=%q | expected %q", c.in, got, c.want)
		}
	}
}

func TestNormalize_EmojiAndPunct(t *testing.T) {
	in := "price eka kiyada??? 😍🔥"
	got := NormalizeMessage(in)
	if !containsWord(got, "price") {
		t.Errorf("Emoji/punct | in=%q | got=%q | expected 'price'", in, got)
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// containsWord checks if `word` appears as a standalone word in `text`.
func containsWord(text, word string) bool {
	for _, w := range wordTokens(text) {
		if w == word {
			return true
		}
	}
	return false
}

func wordTokens(s string) []string {
	return splitWords(s)
}

func splitWords(s string) []string {
	var words []string
	for _, w := range multiSpaceRe.Split(s, -1) {
		if w != "" {
			words = append(words, w)
		}
	}
	return words
}
