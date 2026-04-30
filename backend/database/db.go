package database

import (
	"log"
	"os"

	"github.com/kithmina1999/salespilot/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dsn string) {
	var err error

	// Use minimal logging in release mode
	logLevel := logger.Info
	if os.Getenv("GIN_MODE") == "release" {
		logLevel = logger.Warn
	}

	DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // Required for Supabase PgBouncer (port 6543) — disables pgx prepared statements
	}), &gorm.Config{
		Logger:      logger.Default.LogMode(logLevel),
		PrepareStmt: false,
	})
	if err != nil {
		log.Fatalf("❌ Failed to connect to PostgreSQL: %v", err)
	}

	// Configure connection pool for production use
	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("❌ Failed to get underlying sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)

	if os.Getenv("SEED_DB") == "true" {
		log.Println("⚠️ SEED_DB is true. Dropping existing tables...")
		DB.Migrator().DropTable(
			&models.Product{}, &models.Order{}, &models.Customer{},
			&models.Business{}, &models.Rule{}, &models.Message{},
			&models.UnmatchedMessage{}, &models.User{}, &models.AuditLog{},
			&models.BlacklistedNumber{}, &models.ActivationCode{},
			&models.Cart{}, &models.SavedAddress{},
		)
	}

	// Auto-migrate all models (creates/updates tables in Postgres)
	err = DB.AutoMigrate(
		&models.Business{}, &models.User{}, &models.Product{}, &models.Order{},
		&models.Customer{}, &models.Rule{}, &models.Message{},
		&models.UnmatchedMessage{}, &models.AuditLog{},
		&models.BlacklistedNumber{}, &models.ActivationCode{},
		&models.PasswordResetToken{},        // WhatsApp OTP password reset
		&models.EmailVerificationToken{},
		&models.PaymentProof{},              // Bank transfer proof submissions
		&models.TeamInvite{},                // Multi-user RBAC invitations
		&models.MonthlyReport{},             // AI-generated monthly business intelligence reports
		&models.Cart{},                      // In-progress customer order sessions
		&models.SavedAddress{},              // Customer saved delivery addresses
		&models.PasswordChangeToken{},       // Authenticated email-OTP password change flow
		&models.UserSession{},               // Login session tracking (active sessions + login history)
		&models.OrderPaymentProof{},         // Customer bank-transfer receipt submissions (Slice 3)
	)
	if err != nil {
		log.Fatalf("❌ Failed to migrate database: %v", err)
	}

	log.Println("✅ PostgreSQL connected and migrated successfully")

	if os.Getenv("SEED_DB") == "true" {
		seedDemoData()
	}
}

func seedDemoData() {
	var count int64
	DB.Model(&models.Business{}).Count(&count)
	if count == 0 {
		log.Println("🌱 Seeding Byteshift demo business and global rules...")

		// ── BYTESHIFT DEMO BUSINESS ─────────────────────────────────────────────────
		defaultBiz := models.Business{
			Name:               "Byteshift Demo",
			Phone:              "+94771234567", // TODO: REPLACE BEFORE PRODUCTION
			APIKey:             "demo_api_key_byteshift",
			Plan:               models.PlanStarter,
			AIMessageLimit:     2000,
			SystemMessageLimit: -1,
			OnboardingComplete: true, // skip onboarding wizard on first login
		}
		DB.Create(&defaultBiz)

		const demoPassword = "admin123"
		hashed, _ := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
		DB.Create(&models.User{
			BusinessID:      defaultBiz.ID,
			Email:           "admin@byteshift.lk", // TODO: REPLACE BEFORE PRODUCTION
			Phone:           "+94771234567",        // TODO: REPLACE BEFORE PRODUCTION
			PasswordHash:    string(hashed),
			Role:            "admin",
			IsEmailVerified: true, // skip email verification for demo account
		})
		log.Println("🔑 Demo admin — email: admin@byteshift.lk | password: admin123")

		// ── 20 PRODUCTION GLOBAL FAQ RULES (BusinessID = NULL) ─────────────────────
		globalRules := []models.Rule{
			// 1. Greeting
			{
				Keywords:        "greeting,hi,hello,hey,good morning,good evening,good afternoon,ayubowan,namaskaram,vanakkam,வணக்கம்",
				Response:        "Hello! 👋 Welcome! How can I help you today?\n\nYou can ask about:\n• 💰 *price* — Pricing & plans\n• 🚚 *delivery* — Shipping info\n• 💳 *payment* — Payment methods\n• 📦 *order* — How to order\n• 📞 *contact* — Reach us",
				SinhalaResponse: "ආයුබෝවන්! 👋 ඔබව සාදරයෙන් පිළිගන්නවා 😊\n\nඅද මම ඔබට කෙසේ උදව් කරන්නද?\n\nඔබට මෙවැනි දේවල් ගැන අහන්න පුළුවන්:\n• 💰 *price* — මිල ගණන්\n• 🚚 *delivery* — ඩිලිවරි\n• 💳 *payment* — ගෙවීම් ක්‍රම\n• 📦 *order* — ඕඩර් කරන විදිහ\n• 📞 *contact* — සම්බන්ධ වීමට",
				IsActive:        true,
			},
			// 2. Business Hours
			{
				Keywords:        "hours,open,close,time,available,weda,business hours,when,working",
				Response:        "🕐 Our AI assistant is available *24/7* to help you instantly!\n\nFor calls and human support:\n📅 *Monday – Saturday: 9:00 AM – 6:00 PM*\n\nOutside hours? WhatsApp us and we'll reply as soon as we're back! 😊",
				SinhalaResponse: "🕐 මම *24/7* ඔබට උදව් කරන්න මෙතනම ඉන්නවා 😊\n\nමනුෂ්‍ය සහාය අවශ්‍ය නම්:\n📅 සදුදා – සෙනසුරාදා: 9:00 AM – 6:00 PM\n\nඒ වේලාවෙන් පස්සේත් message කරන්න පුළුවන් — අපි ඉක්මනින්ම reply කරනවා 👍",
				IsActive:        true,
			},
			// 3. Delivery
			{
				Keywords:        "delivery,shipping,courier,ship,parcel,island wide,deliver,postage,send",
				Response:        "🚚 *Delivery Information:*\n\n• Island-wide delivery available across Sri Lanka ✅\n• Standard delivery: *2–4 working days*\n• Delivery fee from *Rs. 350*\n• Free delivery on orders above *Rs. 5,000* 🎁\n\nWant to check if we deliver to your area? Just ask!",
				SinhalaResponse: "🚚 ඩිලිවරි විස්තර මෙන්න:\n\n• දිවයින පුරා delivery කරනවා 🇱🇰\n• සාමාන්‍යයෙන් *දින 2–4ක්* ඇතුළත ලැබෙනවා\n• ඩිලිවරි ගාස්තුව *රු. 350 සිට*\n• *රු. 5,000* ට වඩා වැඩි orders වලට free delivery 🎁\n\nඔබගේ area එකට delivery තියෙනවද කියලා බලන්න ඕනෙද? කියන්න 😊",
				IsActive:        true,
			},
			// 4. Payment
			{
				Keywords:        "payment,pay,bank,transfer,card,cod,cash,account,kasse,online pay,frimi,payhere,bank slip",
				Response:        "💳 *Payment Methods:*\n\n• 🏦 Bank Transfer (most common)\n• 💵 Cash on Delivery (COD)\n• 📱 Online — Frimi / PayHere\n• 📲 eZ Cash / mCash\n\nBank details will be sent after you confirm your order ✅",
				SinhalaResponse: "💳 ඔබට පහසු විදිහට ගෙවන්න පුළුවන්:\n\n• 🏦 බැංකු හුවමාරු\n• 💵 Cash on Delivery (COD)\n• 📱 Online — Frimi / PayHere\n• 📲 eZ Cash / mCash\n\nඔබ ඕඩර් confirm කළාම payment details මම share කරන්නම් 👍",
				IsActive:        true,
			},
			// 5. How to Order
			{
				Keywords:        "order,buy,purchase,how to order,place order,want to buy,i want,get one",
				Response:        "🛒 *How to Order — 3 Easy Steps:*\n\n1️⃣ Tell us the *product name* + *quantity*\n2️⃣ Share your *delivery address*\n3️⃣ Choose *payment method* (COD or Bank Transfer)\n\nWe'll confirm and send a summary! 😊\n\nWhat would you like to order?",
				SinhalaResponse: "🛒 ඕඩර් කරන එක ලේසි:\n\n1️⃣ Product එකේ නම සහ quantity කියන්න\n2️⃣ Delivery address එක දාන්න\n3️⃣ Payment method එක තෝරන්න (COD / Bank)\n\nඉතිරිය මම handle කරන්නම් 😊\n\nඔබට මොනවද ඕඩර් කරන්න ඕනේ?",
				IsActive:        true,
			},
			// 6. Price Inquiry
			{
				Keywords:        "price,cost,how much,rate,charge,fees,mila,eka kada,ethan",
				Response:        "💰 *Pricing:*\n\nOur prices vary by product. Please tell me which product you're interested in and I'll share the exact price!\n\nOr type *products* to see our full catalog 📦",
				SinhalaResponse: "💰 මිල product එකට අනුව වෙනස් වෙනවා 😊\n\nඔබට අවශ්‍ය product එක කියන්න — exact price එක මම කියන්නම් 👍\n\nනැත්නම් *products* කියලා type කරලා අපේ items බලන්නත් පුළුවන් 📦",
				IsActive:        true,
			},
			// 7. Return & Refund
			{
				Keywords:        "refund,return,exchange,broken,damaged,defect,replace,wrong item,not working",
				Response:        "↩️ *Return & Refund Policy:*\n\n• Returns accepted within *7 days* of delivery\n• Damaged or defective items → *free replacement* ✅\n• Wrong item sent → *free replacement or full refund*\n• Refunds processed in *3–5 business days*\n\nPlease send us clear photos + your order number to proceed.",
				SinhalaResponse: "↩️ කිසිම ප්‍රශ්නයක් නැහැ 👍\n\n• Delivery ලැබුණු දිනෙන් *දින 7ක් ඇතුළත* return කරන්න පුළුවන්\n• Damage/defect තියෙනවා නම් *free replacement* ✅\n• වැරදි item එකක් ලැබුණා නම් replace හෝ refund කරනවා\n• Refund *දින 3–5ක්* ඇතුළත complete වෙනවා\n\nPhoto එකක් සහ order number එක එවන්න — මම help කරන්නම් 😊",
				IsActive:        true,
			},
			// 8. Contact / Human Agent
			{
				Keywords:        "contact,call,phone,human,agent,support,talk,speak,help,manager,escalate",
				Response:        "📞 *Contact Us:*\n\n• 💬 WhatsApp: This number (you're here!)\n• 📞 Phone calls: Mon–Sat, 9AM–6PM\n• 📧 Email: support@yourcompany.lk\n\nFor urgent issues, reply *URGENT* and we'll prioritize your case! 🚨",
				SinhalaResponse: "📞 *Contact:*\n\n• 💬 WhatsApp: මෙම number\n• 📞 Call: සදු–සෙන, 9AM–6PM\n• 📧 Email: support@yourcompany.lk\n\nTime sensitive? *URGENT* type කරන්න 🚨",
				IsActive:        true,
			},
			// 9. Quality / Authenticity
			{
				Keywords:        "quality,guarantee,authentic,original,fake,real,genuine,trust,safe",
				Response:        "✅ *Quality Promise:*\n\nAll our products are *100% authentic* and quality-checked before dispatch.\n\n• No counterfeits, ever\n• Secure packaging\n• Money-back guarantee for quality issues 🙏\n\nYour trust is everything to us!",
				SinhalaResponse: "✅ අපි quality ගැන ගොඩක් සැලකිලිමත්.\n\n• සියලු products *100% original*\n• Dispatch කරනකොට හොඳට check කරනවා\n• Safe packaging\n• Quality issue එකක් තියෙනවා නම් money-back guarantee\n\nඔබ විශ්වාසයෙන් මිලදී ගන්න පුළුවන් 🙏",
				IsActive:        true,
			},
			// 10. Discount / Offers
			{
				Keywords:        "discount,offer,sale,promo,promotion,special,cheap,deal,coupon,voucher",
				Response:        "🎉 *Current Offers:*\n\n• 🚚 Free delivery on orders above *Rs. 5,000*\n• 📦 Bulk order discounts — ask us!\n• 🎁 First-time buyer discount available\n\nWhatsApp us to get the best deal! 😊",
				SinhalaResponse: "🎉 දැන් තියෙන offers මෙන්න:\n\n• *රු. 5,000* ට වැඩි orders වලට free delivery 🚚\n• Bulk orders වලට special discounts 📦\n• First-time customersට special deals 🎁\n\nහොඳම deal එකක් හොයා දෙන්නම් — කියන්න 😊",
				IsActive:        true,
			},
			// 11. Bulk / Wholesale
			{
				Keywords:        "bulk,wholesale,reseller,agent,large quantity,distributor,vendor",
				Response:        "📦 *Bulk & Wholesale Orders:*\n\nYes, we welcome bulk orders! 🙌\n\n• Special pricing for large quantities\n• Flexible payment terms available\n• Dedicated agent support\n\nTell us the *product* and *quantity* for a custom quote!",
				SinhalaResponse: "📦 Bulk orders දාන්න පුළුවන් 😊\n\n• ලොකු quantity වලට special prices\n• Payment options flexible\n• Dedicated support\n\nProduct එක සහ quantity එක කියන්න — custom quote එකක් දෙන්නම් 👍",
				IsActive:        true,
			},
			// 12. Warranty
			{
				Keywords:        "warranty,guarantee,how long,expire,expiry,validity",
				Response:        "🛡️ *Warranty & Validity:*\n\nWarranties vary by product type:\n\n• Electronics: *1 year manufacturer warranty*\n• Consumables: Check expiry on packaging\n• Custom orders: Case by case\n\nAsk about the specific product for exact warranty details!",
				SinhalaResponse: "🛡️ Warranty product එකට අනුව වෙනස් වෙනවා:\n\n• Electronics: සාමාන්‍යයෙන් *1 year warranty*\n• Consumables: Expiry date pack එකේ තියෙනවා\n• Custom items: වෙන වෙනම බලනවා\n\nSpecific product එකක් තියෙනවා නම් කියන්න — details දෙන්නම් 😊",
				IsActive:        true,
			},
			// 13. Stock Availability
			{
				Keywords:        "stock,available,in stock,out of stock,have,do you have,sold out",
				Response:        "📊 *Stock Availability:*\n\nPlease tell me which specific product you're looking for — I'll check if it's available!\n\nIf it's out of stock, I can notify you when it's back ✅",
				SinhalaResponse: "📊 ඒක check කරලා කියන්නම් 😊\n\nඔබට අවශ්‍ය product එක කියන්න — stock තියෙනවද කියලා confirm කරන්නම් 👍\n\nOut of stock නම්, නැවත ආවම notify කරන්නත් පුළුවන්",
				IsActive:        true,
			},
			// 14. Order Status / Tracking
			{
				Keywords:        "track,tracking,where is my order,order status,when will it arrive,dispatch",
				Response:        "📍 *Order Tracking:*\n\nTo track your order, please share:\n1. Your *order number* (e.g., ORD-001)\n2. Or your *phone number* used at checkout\n\nWe'll give you a live status update! 🚚",
				SinhalaResponse: "📍 Order එක track කරන්න:\n\nමේ දෙකෙන් එකක් එවන්න:\n• Order number (e.g., ORD-001)\n• Order දාපු phone number\n\nමම status එක check කරලා කියන්නම් 🚚",
				IsActive:        true,
			},
			// 15. Cancel Order
			{
				Keywords:        "cancel,cancel order,don't want,change mind,stop order",
				Response:        "❌ *Cancel Order:*\n\nOrders can be cancelled *before dispatch* for a full refund.\n\nOnce dispatched: cancellation is not possible, but returns are accepted within 7 days.\n\nPlease share your order number to proceed with cancellation.",
				SinhalaResponse: "❌ Order එක cancel කරන්න ඕනෙද?\n\n• Dispatch වෙන්න කලින් cancel කළාම full refund ලැබෙනවා ✅\n• Dispatch වෙලා තියෙනවා නම් cancel කරන්න බැහැ — හැබැයි 7 days ඇතුළත return පුළුවන්\n\nOrder number එක එවන්න — මම help කරන්නම් 👍",
				IsActive:        true,
			},
			// 16. Custom / Personalized Orders
			{
				Keywords:        "custom,personalize,custom order,special request,made to order,bespoke",
				Response:        "🎨 *Custom Orders:*\n\nYes, we accommodate custom orders! 🙌\n\n• Tell us your requirements\n• We'll provide a timeline and quote\n• Extra lead time may apply\n\nWhat would you like customized?",
				SinhalaResponse: "🎨 Custom orders කරන්න පුළුවන් 😊\n\nඔබට ඕන විදිහ explain කරන්න:\n• Requirements\n• Special details\n\nඊට පස්සේ timeline එකක් සහ price එකක් දෙන්නම් 👍",
				IsActive:        true,
			},
			// 17. Safe / Privacy
			{
				Keywords:        "safe,privacy,data,secure,information,personal details,trustworthy",
				Response:        "🔒 *Your Privacy & Safety:*\n\n• Your personal information is *never shared* with third parties\n• Payments are processed securely\n• Messages are confidential\n\nWe take your privacy very seriously. Shop with confidence! ✅",
				SinhalaResponse: "🔒 ඔබගේ privacy අපිට වැදගත්.\n\n• Personal information share කරන්නේ නැහැ\n• Payments secure\n• Messages confidential\n\nභය නැතුව order කරන්න පුළුවන් ✅",
				IsActive:        true,
			},
			// 18. Gift / Present
			{
				Keywords:        "gift,present,wrapping,gift wrap,birthday,anniversary,surprise",
				Response:        "🎁 *Gift Orders:*\n\nMaking someone's day special? We can help! 🎉\n\n• Gift wrapping available on request\n• Personal message cards included\n• Discreet packaging (no price tags)\n\nLet us know it's a gift when ordering!",
				SinhalaResponse: "🎁 Gift එකක් දාන්නද? Nice 😊\n\n• Gift wrapping available\n• Personal message card දාන්න පුළුවන්\n• Price tags remove කරනවා\n\nOrder කරනකොට gift එකක් කියන්න 👍",
				IsActive:        true,
			},
			// 19. Language / Sinhala support
			{
				Keywords:        "sinhala,sinhalese,sinhala support,tamil,language,භාෂාව,සිංහල",
				Response:        "🌐 *Language Support:*\n\nWe support both *English* and *සිංහල (Sinhala)*!\n\nYou can message us in Sinhala or English — we'll reply in the same language 😊",
				SinhalaResponse: "🌐 ඔබට *සිංහල* හෝ *English* දෙකෙන්ම කතා කරන්න පුළුවන් 😊\n\nඔබ යවන භාෂාවෙන්ම reply කරනවා 👍\n\nඕන දෙයක් අහන්න!",
				IsActive:        true,
			},
			// 20. Goodbye / Thank you
			{
				Keywords:        "thanks,thank you,bye,goodbye,ok done,finished,that's all,no thanks,thats it,sthanks",
				Response:        "😊 *You're welcome!*\n\nHappy to help anytime! If you have more questions later, just send a message.\n\nHave a wonderful day! 🌟\n\n*— SalesPilot AI Assistant*",
				SinhalaResponse: "😊 බොහොම ස්තූතියි!\n\nඕන වෙලාවක message කරන්න — මම ඉන්නවා උදව් කරන්න 👍\n\nඔබට සුභ දවසක් වේවා! 🌟",
				IsActive:        true,
			},
		}
		for i := range globalRules {
			globalRules[i].BusinessID = nil
			DB.Create(&globalRules[i])
		}
		log.Printf("✅ Seeded %d production global FAQ rules", len(globalRules))

		// ── TIER 1: Hard DROP Rules ────────────────────────────────────────────
		dropRules := []models.Rule{
			{Keywords: "👍,👌,🙏,😊,😂,❤️,✅,🔥,💯,🫡,😁,😅,🥲", IsDropRule: true, IsActive: true},
			{Keywords: "lol,lmao,haha,hehe,xd,nice,cool,wow,omg,bruh", IsDropRule: true, IsActive: true},
			{Keywords: "test,testing,1,2,3,asdf,qwerty,aaa,bbb,abc,xyz,hello test", IsDropRule: true, IsActive: true},
		}
		for i := range dropRules {
			dropRules[i].BusinessID = nil
			DB.Create(&dropRules[i])
		}
		log.Printf("🔇 Seeded %d global Tier 1 DROP rules", len(dropRules))

		// ── TIER 2: Context Bridge Rules ──────────────────────────────────────
		bridgeRules := []models.Rule{
			{Keywords: "ok,okay,k,fine,sure,noted,seen,received,got it,understood,alright", IsContextBridge: true, IsActive: true},
			{Keywords: "yes,no,yep,nope,maybe,definitely,of course", IsContextBridge: true, IsActive: true},
			{Keywords: "hm,hmm,right,exactly,correct,true,i see,makes sense", IsContextBridge: true, IsActive: true},
		}
		for i := range bridgeRules {
			bridgeRules[i].BusinessID = nil
			DB.Create(&bridgeRules[i])
		}
		log.Printf("🔄 Seeded %d global Tier 2 Context Bridge rules", len(bridgeRules))

		log.Println("🚀 Demo data seeding complete")
	}
}
