# PRD: Enhanced Payment System (Bank Transfers & Proof Verification)

## Problem Statement
The current system only supports Cash on Delivery (COD). Merchants cannot accept bank transfers, and there is no way for customers to submit payment proofs (receipts) via WhatsApp or for merchants to verify them. This leads to manual tracking outside the platform, increased friction for customers who prefer digital payments, and potential order abandonment.

## Solution
Introduce a comprehensive payment management system that allows merchants to enable Bank Transfers alongside COD. The system will:
1. Allow merchants to configure allowed payment methods and bank details.
2. Update the WhatsApp bot to guide customers through their chosen payment method.
3. Automatically capture and link payment receipts sent via WhatsApp to the corresponding order.
4. Provide a dashboard interface for merchants to review, approve, or reject payment proofs.
5. Automate the cleanup of unpaid bank transfer orders after a 72-hour window.

## User Stories
1. As a Merchant, I want to enable/disable COD and Bank Transfer in my settings, so I can control how I accept payments.
2. As a Merchant, I want to provide my bank details to customers, so they know where to send money for bank transfers.
3. As a Customer, I want to choose between COD and Bank Transfer during checkout, so I can use my preferred payment method.
4. As a Customer, I want to see the merchant's bank details immediately after choosing Bank Transfer, so I can complete the payment.
5. As a Customer, I want to be warned about the 72-hour payment window, so I know when my order might be cancelled.
6. As a Customer, I want to submit a screenshot of my bank receipt via WhatsApp, so the merchant can verify my payment.
7. As a Customer, I want to see a "Submit Payment Proof" button in the greeting menu if I have an unpaid order, so I can easily find where to send my receipt.
8. As a Merchant, I want to receive a WhatsApp notification when a customer submits a proof, so I can review it promptly.
9. As a Merchant, I want to see a "Proof Pending" badge on orders in my Kanban board, so I can identify orders needing attention.
10. As a Merchant, I want to view the submitted proof image, approve it, or reject it with a reason, so I can manage order fulfillment.
11. As a Customer, I want to be notified when my payment is approved or rejected, so I know the status of my order.
12. As a Merchant, I want the system to auto-cancel orders that haven't been paid for after 72 hours, so my inventory isn't tied up in "ghost" orders.

## Implementation Decisions

### 1. Data Model Changes
- **Business Model**: Add `allow_cod` (bool), `allow_transfer` (bool), and `bank_details` (text).
- **Order Model**: Refine `payment_method` (cod/bank_transfer) and `payment_status` (pending/paid/cancelled/awaiting_verification).
- **OrderPaymentProof Model**: New table to store `id`, `order_id`, `screenshot_url`, `status`, `admin_note`, `customer_phone`, and `created_at`.

### 2. WhatsApp Bot Evolution
- **Payment Selection**: Insert a new state `CartStatePendingPaymentMethod` after address/notes confirmation.
- **Dynamic Greeting**: Hook engine will check for `pending` orders and add a "📤 Submit Payment Proof" button if bank transfer is an option.
- **Media Routing**: `handlePaymentProofImage` will use Gemini Vision to identify receipt details and link them to the most recent unpaid order.

### 3. Merchant Dashboard
- **Settings UI**: Toggles for payment methods and a rich text area for bank info.
- **Order Kanban**: Visual indicators for orders in `awaiting_verification` status.
- **Review Workflow**: A dedicated modal in the order detail view to see proof history and take action (Approve/Reject).

### 4. Automation (Cron)
- **72h Cleanup**: A recurring background task that moves `bank_transfer` orders with `pending` payment status to `cancelled` after 72 hours, releasing stock and notifying the customer.

## Testing Decisions
- **Unit Tests**: Test the logic for choosing payment methods in the state machine.
- **Integration Tests**: Verify that sending an image on WhatsApp creates a record in `OrderPaymentProof` and updates the order status.
- **Manual Verification**: Ensure the 72h cron task correctly identifies and cancels expired orders.

## Out of Scope
- Integration with payment gateways like PayHere/Stripe for automatic digital payments (this PRD focus on manual bank transfers).
- Partial payments or split payments.
- Automatic verification of bank statements (Vision-only detection of receipt presence).

---

# Vertical Slice Implementation Plan (Kanban)

### Slice 1: "The Merchant's Setup" (Foundation)
*Goal: Allow merchants to configure their payment options.*
- [ ] **Backend**: Migration for `Business` model fields.
- [ ] **Backend**: Update `Settings` handlers to save/load new fields.
- [ ] **Frontend**: Add "Payments" section to Settings page with toggles and Bank Details input.
- [ ] **Validation**: Merchant can save bank details and it persists in the DB.

### Slice 2: "The Customer's Choice" (Ordering Flow)
*Goal: Support choosing payment methods in the bot.*
- [ ] **Backend**: Update `Cart` model to store chosen payment method.
- [ ] **Backend**: Update `order_bot.go` state machine to include payment selection.
- [ ] **Backend**: Show Bank Details + 72h warning if Transfer is picked.
- [ ] **Validation**: Order created via bot has correct `payment_method` and shows correct info.

### Slice 3: "The Proof Capture" (Vision & Linking)
*Goal: Capture receipts from WhatsApp and link to orders.*
- [ ] **Backend**: Create `OrderPaymentProof` model and migration.
- [ ] **Backend**: Update `media_router.go` to save proofs and update `Order.PaymentStatus` to `awaiting_verification`.
- [ ] **Backend**: Update `hook_engine.go` to show "Submit Proof" button in greeting for unpaid orders.
- [ ] **Validation**: Sending a receipt image updates the order and creates a proof record.

### Slice 4: "The Merchant's Review" (Dashboard Actions)
*Goal: Allow merchants to approve/reject payments.*
- [ ] **Backend**: Create endpoints for `ApproveProof` and `RejectProof`.
- [ ] **Frontend**: Add "Review Proof" UI to the Order detail modal.
- [ ] **Backend**: Send WhatsApp notifications on approval/rejection.
- [ ] **Validation**: Merchant can approve a proof, order status moves to "Confirmed", and customer is notified.

### Slice 5: "The Automated Cleanup" (Maintenance)
*Goal: Prevent stale orders from blocking inventory.*
- [ ] **Backend**: Implement the 72h cron task in `services/cron.go`.
- [ ] **Backend**: Send "Auto-cancelled" notification to customer.
- [ ] **Validation**: Orders older than 72h with `pending` status are correctly cancelled.
