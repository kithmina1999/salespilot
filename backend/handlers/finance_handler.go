package handlers

// finance_handler.go — Finance/analytics API endpoints for the SalesPilot dashboard.
//
// GET /api/v1/finance/stats         — KPI summary
// GET /api/v1/finance/chart         — daily revenue time-series
// GET /api/v1/finance/top-products  — top 5 SKUs by revenue

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kithmina1999/salespilot/database"
	"github.com/kithmina1999/salespilot/models"
)

// ─── KPI Stats ────────────────────────────────────────────────────────────────

// FinanceStats returns aggregated KPIs for the requested date window.
func FinanceStats(c *gin.Context) {
	businessID := c.GetUint("business_id")
	from, to := parseDateRange(c)

	query := database.DB.Model(&models.Order{}).
		Where("business_id = ? AND created_at >= ? AND created_at <= ?", businessID, from, to)

	// Total delivered revenue
	var totalRevenue float64
	query.Where("status = ?", models.OrderStatusDelivered).
		Select("COALESCE(SUM(total_price), 0)").Scan(&totalRevenue)

	// Counts
	var delivered, totalOrders, cancelled int64
	query.Where("status = ?", models.OrderStatusDelivered).Count(&delivered)
	query.Count(&totalOrders)
	query.Where("status = ?", models.OrderStatusCancelled).Count(&cancelled)

	// Pending pipeline revenue (new + confirmed + shipped)
	var pendingRevenue float64
	query.Where("status IN ?", []string{
		models.OrderStatusNew, models.OrderStatusConfirmed, models.OrderStatusShipped,
	}).Select("COALESCE(SUM(total_price), 0)").Scan(&pendingRevenue)

	// AOV
	aov := 0.0
	if delivered > 0 {
		aov = totalRevenue / float64(delivered)
	}

	c.JSON(http.StatusOK, gin.H{
		"total_revenue":    totalRevenue,
		"orders_delivered": delivered,
		"orders_total":     totalOrders,
		"orders_cancelled": cancelled,
		"average_order":    aov,
		"pending_revenue":  pendingRevenue,
	})
}

// ─── Daily Chart ──────────────────────────────────────────────────────────────

// FinanceChart returns daily delivered-revenue for the requested window.
func FinanceChart(c *gin.Context) {
	businessID := c.GetUint("business_id")
	from, to := parseDateRange(c)

	type DayPoint struct {
		Day     string  `json:"day"`
		Revenue float64 `json:"revenue"`
		Orders  int64   `json:"orders"`
	}

	var rows []struct {
		Day     string  `gorm:"column:day"`
		Revenue float64 `gorm:"column:revenue"`
		Orders  int64   `gorm:"column:orders"`
	}

	database.DB.Raw(`
		SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
		       COALESCE(SUM(total_price), 0)                         AS revenue,
		       COUNT(*)                                               AS orders
		FROM   orders
		WHERE  business_id = ?
		  AND  status      = ?
		  AND  created_at >= ?
		  AND  created_at <= ?
		GROUP  BY day
		ORDER  BY day ASC
	`, businessID, models.OrderStatusDelivered, from, to).Scan(&rows)

	points := make([]DayPoint, len(rows))
	for i, r := range rows {
		points[i] = DayPoint{Day: r.Day, Revenue: r.Revenue, Orders: r.Orders}
	}
	c.JSON(http.StatusOK, gin.H{
		"chart": points,
		"from":  from.Format("2006-01-02"),
		"to":    to.Format("2006-01-02"),
	})
}

// ─── Top Products ─────────────────────────────────────────────────────────────

// FinanceTopProducts returns the top 5 products by revenue in the window.
func FinanceTopProducts(c *gin.Context) {
	businessID := c.GetUint("business_id")
	from, to := parseDateRange(c)

	var orders []models.Order
	database.DB.
		Where("business_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
			businessID, models.OrderStatusDelivered, from, to).
		Select("items").Find(&orders)

	type tally struct {
		Name    string
		Revenue float64
		Qty     int
	}
	m := map[string]*tally{}
	for _, o := range orders {
		var items []models.CartItem
		if json.Unmarshal([]byte(o.Items), &items) != nil {
			continue
		}
		for _, item := range items {
			if _, ok := m[item.Name]; !ok {
				m[item.Name] = &tally{Name: item.Name}
			}
			m[item.Name].Revenue += item.Subtotal
			m[item.Name].Qty += item.Qty
		}
	}

	type row struct {
		Name    string  `json:"name"`
		Revenue float64 `json:"revenue"`
		Qty     int     `json:"qty"`
	}
	results := make([]row, 0, len(m))
	for _, v := range m {
		results = append(results, row{Name: v.Name, Revenue: v.Revenue, Qty: v.Qty})
	}
	sort.Slice(results, func(i, j int) bool { return results[i].Revenue > results[j].Revenue })
	if len(results) > 5 {
		results = results[:5]
	}

	c.JSON(http.StatusOK, gin.H{"top_products": results})
}

// ─── Shared helper ────────────────────────────────────────────────────────────

func parseDateRange(c *gin.Context) (time.Time, time.Time) {
	now := time.Now()
	to := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
	from := to.AddDate(0, 0, -29) // default 30 days

	if f := c.Query("from"); f != "" {
		if t, err := time.Parse("2006-01-02", f); err == nil {
			from = t
		}
	}
	if t := c.Query("to"); t != "" {
		if parsed, err := time.Parse("2006-01-02", t); err == nil {
			to = time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 23, 59, 59, 0, parsed.Location())
		}
	}
	return from, to
}
