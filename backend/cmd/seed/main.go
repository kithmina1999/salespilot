package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/kithmina1999/salespilot/config"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

func main() {
	cfg := config.Load()
	database.Init(cfg.DatabaseURL)

	products := []models.Product{
		{
			Name:        "Classic Black T-Shirt",
			Description: "සරල සහ අලංකාර කළු ටී-ෂර්ට් එක. සෑම අවස්ථාවකටම ගැලපෙනවා.",
			Price:       1200,
			Stock:       50,
			Category:    "T-Shirts",
			Sizes:       toJSON([]string{"S", "M", "L", "XL"}),
			Colors:      toJSON([]string{"Black", "White"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Floral Summer Dress",
			Description: "ලස්සන මල් පැටර්න් එකක් සහිත ගිම්හාන ඇඳුම. සැහැල්ලු සහ සුවපහසුයි.",
			Price:       3500,
			Stock:       30,
			Category:    "Dresses",
			Sizes:       toJSON([]string{"S", "M", "L"}),
			Colors:      toJSON([]string{"Pink", "Blue", "White"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Slim Fit Chinos",
			Description: "ප්‍රමාණයට හොඳින් ගැලපෙන චිනෝස් කලිසම. කාර්යාලයට සහ අනියම් අවස්ථාවලට සුදුසුයි.",
			Price:       2800,
			Stock:       40,
			Category:    "Pants",
			Sizes:       toJSON([]string{"30", "32", "34", "36"}),
			Colors:      toJSON([]string{"Khaki", "Navy", "Black"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Denim Jacket",
			Description: "ක්ලැසික් ඩෙනිම් ජැකට් එක. සීතල කාලගුණයට සහ ස්ටයිල් එකට හොඳයි.",
			Price:       4500,
			Stock:       20,
			Category:    "Jackets",
			Sizes:       toJSON([]string{"M", "L", "XL"}),
			Colors:      toJSON([]string{"Blue", "Black"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Cotton Polo Shirt",
			Description: "උසස් තත්ත්වයේ කපු පෝලෝ ෂර්ට් එක. සුවපහසු සහ අලංකාර.",
			Price:       1800,
			Stock:       45,
			Category:    "T-Shirts",
			Sizes:       toJSON([]string{"S", "M", "L", "XL"}),
			Colors:      toJSON([]string{"White", "Green", "Navy"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Casual Linen Shirt",
			Description: "සැහැල්ලු ලිනන් ෂර්ට් එක. උණුසුම් දිනවලට සුදුසුයි.",
			Price:       2200,
			Stock:       35,
			Category:    "Shirts",
			Sizes:       toJSON([]string{"S", "M", "L", "XL"}),
			Colors:      toJSON([]string{"White", "Beige", "Light Blue"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Sports Jogger Pants",
			Description: "ක්‍රීඩා සහ දෛනික භාවිතය සඳහා සුවපහසු ජොගර් කලිසම.",
			Price:       1500,
			Stock:       60,
			Category:    "Pants",
			Sizes:       toJSON([]string{"S", "M", "L", "XL"}),
			Colors:      toJSON([]string{"Black", "Grey", "Navy"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Elegant Evening Gown",
			Description: "විශේෂ අවස්ථාවලට සුදුසු අලංකාර සවස ඇඳුම.",
			Price:       8500,
			Stock:       10,
			Category:    "Dresses",
			Sizes:       toJSON([]string{"S", "M", "L"}),
			Colors:      toJSON([]string{"Red", "Black", "Navy"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Leather Belt",
			Description: "සැබෑ හම් බෙල්ට් එක. ඕනෑම ඇඳුමකට ගැලපෙනවා.",
			Price:       950,
			Stock:       80,
			Category:    "Accessories",
			Sizes:       toJSON([]string{"Free Size"}),
			Colors:      toJSON([]string{"Brown", "Black"}),
			ImageURL:    "",
			Active:      true,
		},
		{
			Name:        "Canvas Tote Bag",
			Description: "විශාල කැන්වස් ටෝට් බෑග් එක. සාප්පු යාමට සහ දෛනික භාවිතයට.",
			Price:       1100,
			Stock:       55,
			Category:    "Accessories",
			Sizes:       toJSON([]string{"Free Size"}),
			Colors:      toJSON([]string{"Natural", "Black", "Navy"}),
			ImageURL:    "",
			Active:      true,
		},
	}

	for _, p := range products {
		var existing models.Product
		result := database.DB.Where("name = ?", p.Name).First(&existing)
		if result.RowsAffected == 0 {
			database.DB.Create(&p)
			fmt.Printf("✅ Added: %s (Rs.%.0f)\n", p.Name, p.Price)
		} else {
			fmt.Printf("⏭️  Skipped (exists): %s\n", p.Name)
		}
	}

	fmt.Println("\n🎉 Seed data complete!")

	// Show summary
	var count int64
	database.DB.Model(&models.Product{}).Where("active = ?", true).Count(&count)
	fmt.Printf("📦 Total active products: %d\n", count)
}

func toJSON(arr []string) string {
	b, err := json.Marshal(arr)
	if err != nil {
		log.Printf("JSON marshal error: %v", err)
		return "[]"
	}
	return string(b)
}
