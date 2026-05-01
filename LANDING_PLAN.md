# SalesPilot Landing, Resources, and Legal Site

## Summary
Build the `landing/` app as a modern bilingual public site with a product-led homepage, a Resources hub, launch articles, and required policy pages. The page should sell SalesPilot as a Sri Lankan WhatsApp commerce operating system, while Resources reduce setup/support friction.

## Key Changes
- Rebuild homepage as a single-page landing site with anchors: Features, Workflow, Pricing, FAQ, Resources.
- Add bilingual homepage and resource content: English + Sinhala toggle.
- Add `/resources` index with category filters: Setup, Payments, Growth.
- Add MDX-powered article routes at `/resources/[slug]`, with separate English/Sinhala MDX files.
- Launch with 3 resources:
  - `How to get your Phone Number ID, WABA ID, and System User Access Token`
  - `How SalesPilot payment and activation works`
  - `Why CEOs should treat WhatsApp as a revenue operations channel`
- Add English-only legal pages:
  - `/privacy-policy`
  - `/terms-and-conditions`
  - `/refund-policy`
  - `/cookie-policy`
- Add footer links to Resources and all legal pages.

## Implementation Details
- Add MDX support to the `landing/` Next app.
- Store article metadata in a typed registry: slug, title, description, category, language, updated date, reading time, SEO fields.
- Use the existing dashboard truth for setup/payment docs:
  - WhatsApp connection needs `phone_number_id`, `waba_id`, `access_token`.
  - Payment article leads with bank transfer proof, screenshot upload, admin verification, activation code, and plan activation.
- Cite or link official external references in resource articles:
  - Meta WhatsApp Cloud API docs
  - Meta Business Manager / WhatsApp Manager
  - PayHere policy/payment docs
- Avoid fake testimonials and unsupported claims.
- Legal pages should be practical templates with placeholders for company name, address, email, support phone, refund windows, and governing details.

## Test Plan
- Run `npm run lint` and `npm run build` in `landing/`.
- Verify homepage anchors, mobile nav, language toggle, pricing toggle, FAQ, and resource cards.
- Verify MDX rendering for English and Sinhala resources.
- Verify all legal routes load and are linked from footer.
- Check mobile text overflow for Sinhala resource pages.
- Check SEO metadata for homepage, resources index, article pages, and policy pages.

## Assumptions
- Resource hub nav label is `Resources`.
- Legal pages use English as the authoritative version.
- Resource pages are bilingual; policy pages are not.
- Bank transfer proof is the primary payment flow for now.
- Policy drafts are not final legal advice and should be reviewed before production launch.
