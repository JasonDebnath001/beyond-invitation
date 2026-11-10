# Paid orders and Shiprocket

Open `/admin/orders` after signing in to the website. This page is separate from the existing catalogue/blog administration. It requires a verified Supabase user whose UUID is in the server-only `ADMIN_USER_IDS` comma-separated allowlist, or whose **server-managed** `app_metadata.role` is `admin`. Customer-editable `user_metadata` does not grant access. Configure the allowlist separately in every deployment; `.env.local` only configures this machine.

## Staff workflow

1. Select a paid **live** order. Its saved contact/address, line items and accepted shipping charge appear in the details.
2. Finish personalisation and packing. Enter the **actual packed weight in kilograms** and length, breadth and height in centimetres. There are no guessed box dimensions. Each dimension must exceed 0.5 cm. Packed weight must include the cards and packaging.
3. Select **Create Shiprocket Order**. The server checks the payment again with Razorpay and uses the saved order prices/address, never browser-supplied payment or product data.
4. The page saves the Shiprocket order and shipment IDs, reads the created order back, and checks its stored merchant reference, delivery pincode, total and shipment ID. Only a matching result is marked **Created in Shiprocket**. A delayed read or mismatch remains **Check Shiprocket** with its known IDs preserved. Open Shiprocket to select a courier, assign an AWB and schedule pickup when ready. Creating an order here does **not** perform those actions.

The cart's shipping price remains the amount accepted at checkout. Actual courier charges can change with the final packed weight, dimensions and courier selected in Shiprocket. Creating a shipment does not charge the customer again.

## Configuration

Keep these server settings in the deployment environment:

```dotenv
SHIPROCKET_EMAIL=your-api-user-email
SHIPROCKET_PASSWORD=your-api-user-password
SHIPROCKET_PICKUP_LOCATION=exact-saved-pickup-nickname
ADMIN_USER_IDS=verified-supabase-user-uuid
```

The Shiprocket API user needs permission to read pickup locations and orders and create orders. The selected pickup nickname must already exist in Shiprocket. This integration uses the live external API at `https://apiv2.shiprocket.in/v1/external`; it does not claim to be a Shiprocket sandbox. See the [official API documentation](https://apidocs.shiprocket.in/).

Existing Supabase order storage and server credentials remain required. **No new database migration is required.** The existing `website_orders.shipping_address` JSONB snapshot stores trusted `paymentMode`, `paymentKeyId` and a `fulfillment` record. Customer-facing RLS still only permits an authenticated customer to read their own orders; only the backend writes them.

## Test and live payment separation

New checkout snapshots record the Razorpay mode and public key ID on the server when the order is created. Test orders are visible to staff but cannot create live shipments. The server also requires the current Razorpay credentials to match the saved live payment key, then verifies captured status, payment/order IDs, amount, currency and absence of refunds with Razorpay before creating or reconciling a shipment.

Older snapshots without payment mode are shown as **Unknown** and blocked. Do not label them live merely because the current configuration uses live credentials. Verify each payment with the original account first. The specifically verified checkout test order from 10 November 2026 was labelled test; no other historical orders were reclassified.

Razorpay key rotation also requires reviewing the stored payment-key association before fulfilling older orders. Changing `.env.local` from test to live does not promote test orders to live.

## Duplicate prevention and recovery

The merchant reference is the website order UUID converted to a stable decimal string. Before any create request, an atomic Postgres update claims the exact saved JSONB snapshot. Concurrent clicks can produce only one successful claim. Only one Shiprocket create POST is sent, and payment/webhook retries do not create shipments.

- **Created:** the saved provider IDs are reused; creation is not repeated.
- **Failed:** Shiprocket explicitly rejected creation. Staff can fix the account/pickup issue and retry with measured package details.
- **Creating / Needs review:** the outcome may be unknown, including a timeout, process interruption, duplicate reference or failure saving a successful response. No automatic retries or lock expiry are used.

For an uncertain attempt, find the displayed merchant reference in Shiprocket. Enter the existing numeric **Shiprocket order ID** in the page's reconciliation form. The server reads that order and verifies its merchant reference, delivery pincode, total and single shipment before linking it. Cancelled or ambiguous shipments cannot be linked. If no matching order can be found, investigate with Shiprocket before clearing any attempt; the UI intentionally has no blind reset/retry action.

This feature does not yet sync tracking events, create invoices, decrement inventory, send email, or handle refunds/cancellations. The original Razorpay payment-confirmation and webhook flows still independently save paid status.

## Validation

`node --test tests/shiprocket.test.cjs tests/order-fulfillment.test.cjs tests/fulfillment-admin.test.cjs tests/shipping-payment.test.cjs` covers provider responses, payment/environment checks, payload totals, duplicate claims, ambiguous outcomes, reconciliation and administrator access. These tests mock provider writes; they do not create real shipments.
