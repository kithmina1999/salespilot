package handlers

// TemplateRule represents a predefined bilingual AI rule for onboarding
type TemplateRule struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	Keywords        string `json:"keywords"`
	Response        string `json:"response"`
	SinhalaResponse string `json:"sinhala_response"`
}

var IndustryTemplates = map[string][]TemplateRule{
	"clothing": {
		{
			ID:              "cloth_1",
			Title:           "Delivery Time & Shipping",
			Keywords:        "delivery,shipping,how long,kiyadadak,deliver wenna,satiyak",
			Response:        "We deliver islandwide! Delivery usually takes 2-3 business days. Delivery charges apply based on your location.",
			SinhalaResponse: "අපි ලංකාවේ ඕනෑම තැනකට ඩිලිවරි කරනවා! දවස් 2-3 ක් ඇතුලත ඔබට පාර්සල් එක ලැබෙනවා. Delivery ගාස්තුව area එක අනුව වෙනස් වෙනවා.",
		},
		{
			ID:              "cloth_2",
			Title:           "Return & Exchange Policy",
			Keywords:        "return,exchange,refund,wrong size,maarukaranna,size eka aul,return puluwanda",
			Response:        "Unworn items can be exchanged within 7 days of delivery. Please note that we do not offer refunds, only size or item exchanges.",
			SinhalaResponse: "ඇඳුම ඇඳලා නැත්නම් දවස් 7ක් ඇතුලත මාරු කරගන්න පුළුවන් (Exchange only). සල්ලි ආපසු ලබා දිය නොහැක (No Refunds).",
		},
		{
			ID:              "cloth_3",
			Title:           "Available Sizes",
			Keywords:        "sizes,size chart,which size,mahata,kettu,measurements",
			Response:        "We stock sizes from XS to XXL. Please send us your measurements (chest/waist) and we can recommend the perfect fit!",
			SinhalaResponse: "අපිට XS ඉඳලා XXL වෙනකම් sizes තියෙනවා. ඔයාගේ chest/waist measurements එව්වොත් අපි ගැලපෙන size එක කියන්නම්!",
		},
		{
			ID:              "cloth_4",
			Title:           "Cash on Delivery",
			Keywords:        "cash on delivery,COD,pay on delivery,gedarata,genawama,hand to hand",
			Response:        "Yes! Cash on Delivery (COD) is available islandwide. You can inspect the package when it arrives and pay the courier.",
			SinhalaResponse: "ඔව්! ලංකාවේ ඕනෑම තැනකට Cash on Delivery (COD) තියෙනවා. පාර්සල් එක ගෙදරටම ආවට පස්සේ සල්ලි දෙන්න පුළුවන්.",
		},
		{
			ID:              "cloth_5",
			Title:           "How to Order",
			Keywords:        "how to order,place order,buy,ganne kohomada,order karanne,one",
			Response:        "To order, simply send us a screenshot of the item, your preferred size, your name, address, and two contact numbers.",
			SinhalaResponse: "Order එක දාන්න මේ විස්තර අපිට එවන්න: 1. ඇඳුමේ photo එක 2. Size එක 3. ඔයාගේ නම, ලිපිනය සහ ෆෝන් නම්බර් 2ක්.",
		},
	},
	"electronics": {
		{
			ID:              "elec_1",
			Title:           "Warranty Period",
			Keywords:        "warranty,guarantee,waranti,repair,warenti katiida,kadunot",
			Response:        "All our electronics come with a standard 1-year comprehensive warranty covering hardware defects. Physical damage and liquid damage are not covered.",
			SinhalaResponse: "අපේ හැම item එකකටම අවුරුදු 1ක comprehensive warranty එකක් ලැබෙනවා. Physical/water damage වලට වග කියනු නොලැබේ.",
		},
		{
			ID:              "elec_2",
			Title:           "Cash on Delivery",
			Keywords:        "cash on delivery,COD,pay on delivery,gedarata,genawama",
			Response:        "We offer islandwide Cash on Delivery. For orders above LKR 50,000, we require a 10% advance payment via bank transfer.",
			SinhalaResponse: "දිවයින පුරා Cash on Delivery (COD) තියෙනවා. රු. 50,000 ට වැඩි orders වලට විතරක් 10% ක advance එකක් bank transfer කරන්න ඕනේ.",
		},
		{
			ID:              "elec_3",
			Title:           "Delivery Tracking",
			Keywords:        "track,tracking,where is package,ko koheda,ewwada",
			Response:        "Once dispatched, delivery takes 1-3 days. We will share your tracking number via WhatsApp as soon as the courier picks it up.",
			SinhalaResponse: "පාර්සල් එක dispatch කරාට පස්සේ දවස් 1-3 න් ලැබෙනවා. Courier එකෙන් අරන් ගිය ගමන් අපි tracking number එක ඔයාට WhatsApp කරනවා.",
		},
		{
			ID:              "elec_4",
			Title:           "Authenticity Guarantee",
			Keywords:        "original,fake,genuine,auth,brand new,sealed",
			Response:        "Yes, we guarantee that all our products are 100% original, brand new, and come in company-sealed packaging.",
			SinhalaResponse: "ඔව් අනිවාර්යයෙන්ම. අපේ හැම item එකක්ම 100% original, brand new. එන්නේ company sealed packing එකෙන්මයි.",
		},
		{
			ID:              "elec_5",
			Title:           "Installment Plans",
			Keywords:        "installments,easy payment,kota,masen maseta,kredikkat",
			Response:        "Yes, we offer 0% installment plans up to 12 months for selected credit cards (ComBank, HNB, Sampath). Please let us know your bank.",
			SinhalaResponse: "ඔව්, ComBank, HNB, Sampath credit cards වලට මාස 12ක් දක්වා 0% installment (පොලී රහිතව ගෙවන්න) පුළුවන්.",
		},
	},
	"food": {
		{
			ID:              "food_1",
			Title:           "Menu & Prices",
			Keywords:        "menu,prices,what do you have,monawada tiyenne,gana kiyada,list eka",
			Response:        "Please let us know what you are craving! We have rice options, kottu, sides, and beverages. Should I send the full PDF menu?",
			SinhalaResponse: "අපේ කෑම menu එකේ rice, kottu, short-eats වගේ ගොඩක් දේවල් තියෙනවා. මම සම්පූර්ණ menu එක photo/PDF එකක් විදියට එවන්නද?",
		},
		{
			ID:              "food_2",
			Title:           "Delivery Areas",
			Keywords:        "delivery areas,where do you deliver,door delivery,ape pathtata,meheta,koheta",
			Response:        "We currently deliver within a 15km radius of our kitchen. Please share your exact location/Google map pin so we can confirm.",
			SinhalaResponse: "අපි මේ වෙනකොට අපේ කඩේ ඉඳන් 15km ඇතුලත delivery කරනවා. හරියටම ඔයාගේ location එක / map pin එක එවන්න පුළුවන්ද?",
		},
		{
			ID:              "food_3",
			Title:           "Order Lead Time",
			Keywords:        "how long,time,preparation,mona welawatada,kocchara wela",
			Response:        "Standard delivery orders take between 45 to 60 minutes depending on traffic and order volume.",
			SinhalaResponse: "Order එක දාලා සාමාන්‍යයෙන් විනාඩි 45-60 ක් ඇතුලත කෑම එක ඔයාගේ ගෙදරටම ගෙනත් දෙනවා. (Traffic එක අනුව පොඩි වෙනසක් වෙන්න පුළුවන්).",
		},
		{
			ID:              "food_4",
			Title:           "Pre-Orders & Party Orders",
			Keywords:        "party,bulk,pre order,dansal,godak,loku",
			Response:        "Yes, we accept party orders! Please place orders for more than 10 people at least 24 hours in advance.",
			SinhalaResponse: "ඔව් අපි party orders බාරගන්නවා! පුද්ගලයින් 10 කට වඩා වැඩි orders අනිවාර්යයෙන්ම දවසකට කලින් (24 hours in advance) දැනුම් දෙන්න ඕනේ.",
		},
		{
			ID:              "food_5",
			Title:           "Payment Methods",
			Keywords:        "pay,cash,card,bank transfer,salli,kahama,transfer",
			Response:        "You can pay via Cash on Delivery, Bank Transfer, or exact change to our delivery rider.",
			SinhalaResponse: "ඔයාට Cash on Delivery (කෑම ආවම සල්ලි දෙන එක) හරි Bank Transfer හරි පාවිච්චි කරන්න පුළුවන්.",
		},
	},
	"beauty": {
		{
			ID:              "beau_1",
			Title:           "Product Authenticity",
			Keywords:        "original,fake,copy,real,genuine,auth",
			Response:        "We strictly sell 100% authentic products sourced directly from authorized distributors. We do not sell fakes or replicas.",
			SinhalaResponse: "අපි විකුණන්නේ 100% original බඩු විතරයි. Authorized distributors ලගෙන් තමයි අපි බඩු ගන්නේ. ෆේක් මුකුත් නෑ.",
		},
		{
			ID:              "beau_2",
			Title:           "Skin Type Advice",
			Keywords:        "skin type,recommend,oily,dry,acne,kuru,kalu,pimples",
			Response:        "We're happy to help! Could you let us know your skin type (oily, dry, combination) and your main concern (acne, glow, etc.)?",
			SinhalaResponse: "ඔයාට හරිම දේ තෝරගන්න අපි උදව් කරන්නම්. ඔයාගේ skin type එක (oily/dry) සහ ප්‍රධාන ප්‍රශ්නය (කුරුලෑ/පැහැපත් වීම) අපිට කියන්න.",
		},
		{
			ID:              "beau_3",
			Title:           "Expiry Dates",
			Keywords:        "expiry,expire,date,kal igut,parana",
			Response:        "All our products have at least 1-2 years before expiry. Rest assured, we do not sell near-expiry items.",
			SinhalaResponse: "අපේ හැම product එකකම අවම වශයෙන් අවුරුදු 1-2 ක කල් ඉකුත් වීමේ දිනයක් (Expiry Date) තියෙනවා. Near-expiry බඩු අපි විකුණන්නේ නෑ.",
		},
		{
			ID:              "beau_4",
			Title:           "Islandwide Delivery",
			Keywords:        "delivery,shipping,how long,kiyadadak,deliver wenna,satiyak",
			Response:        "We deliver islandwide using trusted courier partners. Packages usually arrive within 2-4 business days safely packed.",
			SinhalaResponse: "අපි ලංකාවේ ඕනෑම තැනකට ඩිලිවරි කරනවා! දවස් 2-4 ක් ඇතුලත ඔබට පාර්සල් එක කිසිම ඩැමේජ් එකක් නැතුව ආරක්ෂිතව ලැබෙනවා.",
		},
	},
	"general": {
		{
			ID:              "gen_1",
			Title:           "Islandwide Delivery",
			Keywords:        "delivery,shipping,how long,kiyadadak,deliver wenna,satiyak",
			Response:        "Islandwide delivery is available! Usually takes 2-3 business days. Delivery rates vary by distance.",
			SinhalaResponse: "දිවයින පුරා ඩිලිවරි පහසුකම් තියෙනවා. දවස් 2-3ක් ඇතුලත ලැබෙනවා. Delivery ගාස්තුව area එක අනුව වෙනස් වෙනවා.",
		},
		{
			ID:              "gen_2",
			Title:           "Cash on Delivery",
			Keywords:        "cash on delivery,COD,pay on delivery,gedarata,genawama,hand to hand",
			Response:        "Yes, Cash on Delivery is supported islandwide. Alternatively, you can bank transfer before dispatch.",
			SinhalaResponse: "ඔව්! ලංකාවේ ඕනෑම තැනකට Cash on Delivery (COD) තියෙනවා. නැත්නම් order එක දානකොට bank transfer කරන්නත් පුළුවන්.",
		},
		{
			ID:              "gen_3",
			Title:           "Operating Hours",
			Keywords:        "open,close,hours,welawa,kade aralada,time",
			Response:        "Our store and customer service team is active from 9AM to 6PM, Monday to Saturday.",
			SinhalaResponse: "අපි උදේ 9 ඉඳන් හවස 6 වෙනකම් වැඩ කරනවා (සඳුදා සිට සෙනසුරාදා දක්වා).",
		},
		{
			ID:              "gen_4",
			Title:           "Shop Location",
			Keywords:        "location,where are you,address,koheda,kade koheda,thiyenne koheda",
			Response:        "We are primarily an online store, but you can arrange pickups from our warehouse in Colombo by appointment.",
			SinhalaResponse: "අපි ප්‍රධාන වශයෙන් online කරන්නෙ. ඒත් ඔයාට කොළඹ තියෙන අපේ warehouse එකෙන් ඇවිත් ගන්න පුලුවන් (කලින් කතා කරලා එන්න).",
		},
		{
			ID:              "gen_5",
			Title:           "How to Place an Order",
			Keywords:        "how to order,place order,buy,ganne kohomada,order karanne,one",
			Response:        "Send us a photo of the item, your name, full address, and two phone numbers. We will process your order immediately.",
			SinhalaResponse: "Order එක දාන්න මේ විස්තර අපිට එවන්න: 1. භාණ්ඩයේ photo එකක් 2. ඔයාගේ නම, ලිපිනය සහ ෆෝන් නම්බර් 2ක්.",
		},
	},
	"other": {
		{
			ID:              "oth_1",
			Title:           "Pricing & Quotations",
			Keywords:        "price,cost,how much,kiayada,gana,mudal",
			Response:        "Prices vary depending on the specific product or service requested. Please share exactly what you are looking for so we can give you an accurate quote.",
			SinhalaResponse: "මිල ගණන් ඔයාට අවශ්‍ය දේ අනුව වෙනස් වෙනවා. ඔයාට අවශ්‍ය දේ හරියටම කිව්වොත් අපිට නිවැරදි මිලක් දෙන්න පුළුවන්.",
		},
		{
			ID:              "oth_2",
			Title:           "Islandwide Delivery",
			Keywords:        "delivery,shipping,how long,kiyadadak,deliver wenna,satiyak",
			Response:        "Islandwide delivery is available! Usually takes 2-4 business days depending on your location.",
			SinhalaResponse: "දිවයින පුරා ඩිලිවරි පහසුකම් තියෙනවා. සාමාන්‍යයෙන් දවස් 2-4ක් ඇතුලත ලැබෙනවා.",
		},
		{
			ID:              "oth_3",
			Title:           "Cash on Delivery",
			Keywords:        "cash on delivery,COD,pay on delivery,gedarata,genawama,hand to hand",
			Response:        "Yes, Cash on Delivery is supported. Alternatively, you can choose to bank transfer.",
			SinhalaResponse: "ඔව්! Cash on Delivery (COD) පහසුකම තියෙනවා. නැත්නම් bank transfer කරන්නත් පුළුවන්.",
		},
		{
			ID:              "oth_4",
			Title:           "How to Order",
			Keywords:        "how to order,place order,buy,ganne kohomada,order karanne,one",
			Response:        "To proceed, please reply with your requirements, your name, delivery address, and contact number.",
			SinhalaResponse: "Order එක දාන්න මේ විස්තර අපිට එවන්න: ඔයාට අවශ්‍ය දේ, ඔයාගේ නම, ලිපිනය සහ ෆෝන් නම්බර් එකක්.",
		},
		{
			ID:              "oth_5",
			Title:           "Operating Hours",
			Keywords:        "open,close,hours,welawa,kade aralada,time",
			Response:        "We process queries and orders during standard business hours. Feel free to leave a message and we'll get back to you!",
			SinhalaResponse: "අපි සාමාන්‍ය කාර්යාල වේලාවන් වලදී වැඩ කරනවා. ඔයාගේ පණිවිඩය දාලා තියන්න, අපි හැකි ඉක්මනින් reply කරන්නම්!",
		},
	},
}
