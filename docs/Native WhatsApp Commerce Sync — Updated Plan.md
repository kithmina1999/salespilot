# Native WhatsApp Commerce Sync — Updated Plan

## What You Actually Need (No App Review Required)

The MVP approach avoids the Catalog Batch API entirely.
Instead we use the **WhatsApp Interactive Product Messages** API which uses your 
existing `whatsapp_business_messaging` permission — **already approved**.

```
Meta Commerce Manager (you manage products there)
        ↑ Synced via Meta's own system
        ↓
SalesPilot stores only: Catalog ID + per-product Retailer ID
        ↓
AI pipeline sends native product card messages using those IDs
        ↓
Customer sees native WhatsApp shopping UI
```

## One-Time Merchant Setup (via our new dialog)
1. Go to Meta Commerce Manager → Create a Catalog
2. Add products there (name, image, price, link) — get each product's Retailer ID
3. In WhatsApp Manager → link that catalog to your phone number
4. Back in SalesPilot → paste the Catalog ID on the Products page
5. For each product → paste its Retailer ID from Commerce Manager

## New Fields Required

### Product model (`product.go`)
- `RetailerID string` — the Meta catalog's unique ID for this product (e.g. `shirt-001`)

### Business model (`business.go`) 
- `MetaCatalogID string` — the Commerce Manager Catalog ID

## Files to Change

### Backend
- `models/product.go` — add `RetailerID`
- `models/business.go` — add `MetaCatalogID`
- `handlers/settings_handler.go` — expose/save `meta_catalog_id`
- `handlers/product_handler.go` — expose/save `retailer_id`
- `whatsapp/commerce.go` [NEW] — `SendProductCard()`, `SendCatalogMessage()`
- `whatsapp/pipeline.go` — detect product intent, send native card instead of text URL

### Frontend
- `products/page.tsx` — "Sync with WhatsApp" header button + setup dialog + retailer_id field per product + sync status badge
- `connect/page.tsx` — add Catalog ID field in settings
- `lib/store.ts` — add `meta_catalog_id` to AppBusiness

## Status: APPROVED — executing now
