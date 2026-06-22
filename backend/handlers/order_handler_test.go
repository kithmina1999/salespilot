package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/kithmina1999/salespilot/models"
	"gorm.io/gorm"
)

func setupOrderListTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:order_list_%d?mode=memory&cache=shared", time.Now().UnixNano())), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.Order{}); err != nil {
		t.Fatalf("migrate orders: %v", err)
	}
	return db
}

func listOrdersContext(t *testing.T, db *gorm.DB, target string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, target, nil)
	c.Set("db", db.Where("business_id = ?", 7))
	c.Set("business_id", uint(7))
	return c, w
}

func TestListOrdersReturnsSummaryCountsOnInitialQueueRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupOrderListTestDB(t)
	now := time.Now()

	orders := []models.Order{
		{BusinessID: 7, BusinessOrderNum: 1, CustomerPhone: "94770000001", Items: "[]", Status: models.OrderStatusNew, PaymentMethod: "cod", PaymentStatus: "pending", CreatedAt: now, UpdatedAt: now},
		{BusinessID: 7, BusinessOrderNum: 2, CustomerPhone: "94770000002", Items: "[]", Status: models.OrderStatusConfirmed, PaymentMethod: "cod", PaymentStatus: "pending", CreatedAt: now, UpdatedAt: now},
		{BusinessID: 7, BusinessOrderNum: 3, CustomerPhone: "94770000003", Items: "[]", Status: models.OrderStatusShipped, PaymentMethod: "cod", PaymentStatus: "pending", CreatedAt: now.AddDate(0, 0, -6), UpdatedAt: now.AddDate(0, 0, -6)},
		{BusinessID: 7, BusinessOrderNum: 4, CustomerPhone: "94770000004", Items: "[]", Status: models.OrderStatusDelivered, PaymentMethod: "cod", PaymentStatus: "pending", CreatedAt: now, UpdatedAt: now},
		{BusinessID: 7, BusinessOrderNum: 5, CustomerPhone: "94770000005", Items: "[]", Status: models.OrderStatusCancelled, PaymentMethod: "cod", PaymentStatus: "pending", CreatedAt: now, UpdatedAt: now},
		{BusinessID: 7, BusinessOrderNum: 6, CustomerPhone: "94770000006", Items: "[]", Status: models.OrderStatusNew, PaymentMethod: "bank_transfer", PaymentStatus: "awaiting_verification", CreatedAt: now, UpdatedAt: now},
		{BusinessID: 8, BusinessOrderNum: 1, CustomerPhone: "94771111111", Items: "[]", Status: models.OrderStatusDelivered, PaymentMethod: "cod", PaymentStatus: "pending", CreatedAt: now, UpdatedAt: now},
	}
	if err := db.Create(&orders).Error; err != nil {
		t.Fatalf("seed orders: %v", err)
	}

	c, w := listOrdersContext(t, db, "/orders?queue=needs_attention&page=1&limit=25")
	ListOrders(c)

	if w.Code != http.StatusOK {
		t.Fatalf("ListOrders status = %d, body=%s", w.Code, w.Body.String())
	}

	var got struct {
		Pagination orderPagination `json:"pagination"`
		Summary    orderSummary    `json:"summary"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if got.Pagination.Total != 2 {
		t.Fatalf("pagination.total = %d, want needs-attention total 2", got.Pagination.Total)
	}
	if got.Summary.NeedsAttention != 2 {
		t.Fatalf("summary.needs_attention = %d, want 2", got.Summary.NeedsAttention)
	}
	if got.Summary.Active != 4 {
		t.Fatalf("summary.active = %d, want 4", got.Summary.Active)
	}
	if got.Summary.Completed != 1 {
		t.Fatalf("summary.completed = %d, want 1", got.Summary.Completed)
	}
	if got.Summary.Cancelled != 1 {
		t.Fatalf("summary.cancelled = %d, want 1", got.Summary.Cancelled)
	}
	if got.Summary.All != 6 {
		t.Fatalf("summary.all = %d, want 6", got.Summary.All)
	}
}
