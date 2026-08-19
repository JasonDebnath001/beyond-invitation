# Beyond Invitation

Production e-commerce storefront for **Beyond Invitation / Bharat Agency Wedding Cards Pvt. Ltd.**, built for premium Indian wedding invitations, wedding cards, shagun envelopes, boxes, celebration stationery, and related products.

The storefront is built with **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS**, **Clerk**, **Razorpay**, and **ERPNext**.

ERPNext acts as the primary commerce backend for products, pricing, customers, wishlists, reseller data, Sales Orders, order history, and optional payment accounting.

---

## Features

### Storefront

- Next.js App Router storefront
- Server-rendered and SEO-friendly product pages
- Live product catalogue from ERPNext
- Product categories and collections
- Product search
- Product image galleries
- Product video support
- Website-specific ERPNext product titles and descriptions
- Related products
- Cart persisted in `localStorage`
- Responsive navigation and layouts
- Wedding card and wedding box editorial pages
- About, contact, visit-us, and policy pages
- Instagram reels integration
- Sitemap and robots metadata
- Open Graph and structured SEO support

### Authentication

Authentication is handled with **Clerk**.

Protected areas include:

- `/account`
- `/wishlist`
- `/my-orders`
- `/checkout`
- `/api/razorpay/order`
- `/api/razorpay/verify`

Public storefront browsing does not require authentication.

The Razorpay webhook is intentionally public because it is called server-to-server by Razorpay and performs its own signature validation.

### ERPNext integration

ERPNext currently powers:

- Product catalogue
- Product pricing
- Product custom fields
- Product images
- Product videos
- Website visibility
- Contact leads
- Customers
- Customer addresses
- Customer contacts
- Sales Orders
- Razorpay payment metadata
- Order history
- Wishlists
- Reseller accounts
- Referral pricing
- Optional Payment Entries

### Wishlist

Signed-in users can add products to a wishlist.

Wishlist records are stored in ERPNext using the configurable doctype:

```text
Website Wishlist
```

The wishlist is associated with the user's Clerk user ID.

### My Orders

Signed-in users can view their ERPNext Sales Order history under:

```text
/my-orders
```

Orders are matched using the email address associated with the signed-in Clerk account.

Displayed order information can include:

- ERPNext Sales Order ID
- Order date
- Delivery date
- Order status
- Payment status
- Grand total
- Products
- Quantities
- Customer contact details
- Shipping address
- Razorpay Order ID
- Razorpay Payment ID

### Reseller / referral pricing

The application includes a reseller system backed by the ERPNext doctype:

```text
Website Reseller
```

Each reseller can have:

- Clerk user ID
- Reseller code
- Business/reseller name
- Email
- Phone
- Margin percentage
- Active status

Referral URLs use:

```text
?via=CODE
```

The active referral code is associated with the cookie:

```text
bi_pref
```

The reseller margin is applied to storefront pricing using the same centralized pricing logic.

The default referral-cookie lifetime is:

```text
30 days
```

---

# Tech Stack

| Technology | Purpose |
| --- | --- |
| Next.js 15 | Application framework |
| React 19 | UI |
| TypeScript | Type safety |
| Tailwind CSS 3 | Styling |
| Clerk | Authentication |
| ERPNext / Frappe | Commerce and operational backend |
| Razorpay | Payments |
| GSAP | Animations |
| Lucide React | Icons |
| isomorphic-dompurify | HTML sanitization |
| Instagram Graph API | Instagram reel content |
| Vercel | Recommended deployment platform |

---

# Project Structure

```text
beyond-invitation/
├── app/
│   ├── about/
│   ├── account/
│   ├── api/
│   │   ├── contact-lead/
│   │   ├── instagram-reels/
│   │   ├── locations/
│   │   ├── razorpay/
│   │   │   ├── order/
│   │   │   ├── verify/
│   │   │   └── webhook/
│   │   ├── refresh-instagram-token/
│   │   ├── reseller/
│   │   ├── search/
│   │   └── wishlist/
│   ├── cart/
│   ├── checkout/
│   ├── collections/
│   │   └── [category]/
│   ├── contact/
│   ├── erp-products/
│   ├── my-orders/
│   ├── privacy-policy/
│   ├── products/
│   │   └── [slug]/
│   ├── refund-policy/
│   ├── reseller/
│   ├── search/
│   ├── shipping-policy/
│   ├── terms-and-conditions/
│   ├── visit-us/
│   ├── wedding-boxes/
│   ├── wedding-cards/
│   ├── wishlist/
│   ├── globals.css
│   ├── layout.tsx
│   ├── not-found.tsx
│   ├── page.tsx
│   ├── robots.ts
│   └── sitemap.ts
│
├── components/
│   └── Reusable storefront and UI components
│
├── data/
│   ├── categories.json
│   └── products.json
│
├── lib/
│   ├── checkout.ts
│   ├── erp-wishlist.ts
│   ├── erpnext.ts
│   ├── instagram.ts
│   ├── product-quantity.ts
│   ├── products.ts
│   ├── razorpay.ts
│   ├── reseller.ts
│   ├── seo.ts
│   └── site-config.ts
│
├── public/
├── types/
├── middleware.ts
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

# Requirements

Recommended:

```text
Node.js 18.18+
npm
```

Install dependencies with:

```bash
npm install
```

---

# Local Development

Clone the repository:

```bash
git clone https://github.com/JasonDebnath001/beyond-invitation.git
cd beyond-invitation
```

Install dependencies:

```bash
npm install
```

Create:

```text
.env.local
```

Add the required environment variables described below.

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

# Available Scripts

```bash
npm run dev
```

Starts the Next.js development server.

```bash
npm run build
```

Creates a production build.

```bash
npm run start
```

Starts the production Next.js server.

```bash
npm run lint
```

Runs the configured Next.js lint command.

---

# Environment Variables

## Example `.env.local`

Do **not** commit this file.

```env
# --------------------------------------------------
# Site
# --------------------------------------------------

NEXT_PUBLIC_SITE_URL=http://localhost:3000


# --------------------------------------------------
# Clerk
# --------------------------------------------------

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=


# --------------------------------------------------
# ERPNext - required
# --------------------------------------------------

ERPNEXT_URL=https://your-erpnext-domain.com
ERPNEXT_API_KEY=
ERPNEXT_API_SECRET=


# --------------------------------------------------
# ERPNext product catalogue
# --------------------------------------------------

ERPNEXT_PRICE_LIST=Standard Selling
ERPNEXT_PRODUCT_PRICE_FIELD=custom_price

ERPNEXT_WEBSITE_FIELD=custom_show_on_website
ERPNEXT_SUBJECT_FIELD=custom_subject

ERPNEXT_CUSTOMISATION_FIELD=custom_customisation
ERPNEXT_MATERIAL_FIELD=custom_material
ERPNEXT_INCLUDES_FIELD=custom_includes

ERPNEXT_WEBSITE_TITLE_FIELD=
ERPNEXT_WEBSITE_SHORT_DESCRIPTION_FIELD=

ERPNEXT_REVALIDATE_SECONDS=60


# --------------------------------------------------
# ERPNext product images
# --------------------------------------------------

ERPNEXT_IMAGE_TABLE_FIELD=
ERPNEXT_IMAGE_ROW_FIELD=image
ERPNEXT_IMAGE_ORDER_FIELD=
ERPNEXT_FILE_PHOTO_ORDER_FIELD=custom_photo_order


# --------------------------------------------------
# ERPNext product videos
# --------------------------------------------------

ERPNEXT_VIDEO_FIELD=custom_video_link
ERPNEXT_VIDEO_TABLE_FIELD=
ERPNEXT_VIDEO_ROW_FIELD=video
ERPNEXT_VIDEO_ORDER_FIELD=


# --------------------------------------------------
# ERPNext wishlist
# --------------------------------------------------

ERPNEXT_WISHLIST_DOCTYPE=Website Wishlist


# --------------------------------------------------
# ERPNext reseller system
# --------------------------------------------------

ERPNEXT_RESELLER_DOCTYPE=Website Reseller
RESELLER_MAX_MARGIN_PERCENT=100


# --------------------------------------------------
# ERPNext Sales Orders / Razorpay metadata
# --------------------------------------------------

ERPNEXT_DEFAULT_CUSTOMER=

ERPNEXT_RZP_ORDER_FIELD=custom_razorpay_order_id
ERPNEXT_RZP_PAYMENT_FIELD=custom_razorpay_payment_id
ERPNEXT_PAYMENT_STATUS_FIELD=custom_payment_status

ERPNEXT_RESELLER_CODE_FIELD=custom_reseller_code
ERPNEXT_RESELLER_COMMISSION_FIELD=custom_reseller_commission


# --------------------------------------------------
# ERPNext customer creation
# --------------------------------------------------

ERPNEXT_AUTO_CREATE_CUSTOMER=false
ERPNEXT_CUSTOMER_GROUP=Individual
ERPNEXT_TERRITORY=All Territories
ERPNEXT_CUSTOMER_EMAIL_FIELD=custom_email


# --------------------------------------------------
# Optional ERPNext Payment Entry
# --------------------------------------------------

ERPNEXT_CREATE_PAYMENT_ENTRY=false
ERPNEXT_COMPANY=
ERPNEXT_PAID_TO_ACCOUNT=
ERPNEXT_MODE_OF_PAYMENT=Wire Transfer


# --------------------------------------------------
# Razorpay
# --------------------------------------------------

NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=


# --------------------------------------------------
# Instagram
# --------------------------------------------------

INSTAGRAM_USER_ID=
INSTAGRAM_ACCESS_TOKEN=

# Protects the Instagram token refresh route
CRON_SECRET=
```

---

# ERPNext Authentication

ERPNext REST requests use API token authentication.

The application sends:

```http
Authorization: token API_KEY:API_SECRET
```

The following variables must therefore contain a matching API credential pair:

```env
ERPNEXT_API_KEY=
ERPNEXT_API_SECRET=
```

The API user must have permission to read or write the ERPNext doctypes used by the application.

Never expose the ERPNext API key or API secret to client-side code.

---

# ERPNext Product Catalogue

The primary ERPNext integration lives in:

```text
lib/erpnext.ts
```

Products are loaded from ERPNext `Item` records.

Only products intended for the website are loaded according to the configured website checkbox field:

```env
ERPNEXT_WEBSITE_FIELD=custom_show_on_website
```

The product integration supports:

- Item code
- Item name
- Item group
- Product description
- Website title
- Website short description
- Subject
- Customisation information
- Material information
- Included items
- Price
- MRP
- Images
- File attachments
- Video URLs
- Website visibility

The frontend maps ERPNext item groups into application categories.

---

# Product Pricing

The product price field defaults to:

```env
ERPNEXT_PRODUCT_PRICE_FIELD=custom_price
```

The configured selling price list defaults to:

```env
ERPNEXT_PRICE_LIST=Standard Selling
```

Referral/reseller pricing can modify the price shown to a visitor when an active reseller referral is present.

Prices used during checkout are resolved server-side instead of accepting a price supplied by the browser.

This is important because cart data stored in the browser must never be trusted as the source of truth for payment amounts.

---

# Product Quantity Rules

Quantity rules are centralized in:

```text
lib/product-quantity.ts
```

Current minimum order quantity:

```text
50
```

Default quantity increment:

```text
25
```

For Shagun/Sagun Envelope products:

```text
50
```

The Shagun rule is determined primarily from the ERPNext item group, with a product-name/slug fallback for older cart data.

---

# Product Images and Videos

ERPNext products can use:

- Primary `Item.image`
- Child-table image galleries
- Attached ERPNext `File` records
- Configurable image-order fields
- Direct product video fields
- Video child tables
- YouTube URLs
- Vimeo URLs
- Direct video files

Private ERPNext files are not intentionally exposed as public product images.

Remote HTTPS images are allowed by the Next.js image configuration.

---

# Cart

Cart state is managed on the client and persisted using:

```text
localStorage
```

Cart contents contain product identity and quantity information.

The browser's stored price must not be treated as authoritative during payment creation.

---

# Checkout Architecture

The checkout flow is designed around ERPNext and Razorpay.

```text
Cart
  ↓
Checkout
  ↓
POST /api/razorpay/order
  ↓
Resolve products and prices from ERPNext
  ↓
Create Razorpay Order
  ↓
Create ERPNext Draft Sales Order
  ↓
Open Razorpay Checkout
  ↓
Payment succeeds
  ↓
POST /api/razorpay/verify
  ↓
Verify Razorpay signature
  ↓
Mark ERPNext Sales Order paid
  ↓
Submit Sales Order
```

The Razorpay webhook provides a second fulfilment path:

```text
Razorpay
  ↓
POST /api/razorpay/webhook
  ↓
Verify webhook signature
  ↓
Locate ERPNext Sales Order
  ↓
Mark paid / submit order
```

ERPNext fulfilment is written to be idempotent so the browser verification flow and webhook can safely reach the same order.

---

# Razorpay

Required variables:

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

## Payment order

Endpoint:

```text
POST /api/razorpay/order
```

Responsibilities include:

1. Validate customer information.
2. Resolve the cart against ERPNext.
3. Determine the payment amount server-side.
4. Create a Razorpay Order.
5. Create an ERPNext draft Sales Order.
6. Return the Razorpay Order ID to the client.

## Payment verification

Endpoint:

```text
POST /api/razorpay/verify
```

The route validates the Razorpay checkout signature before fulfilling the ERPNext Sales Order.

## Webhook

Endpoint:

```text
POST /api/razorpay/webhook
```

The webhook validates:

```text
x-razorpay-signature
```

against:

```env
RAZORPAY_WEBHOOK_SECRET
```

Supported fulfilment events include:

```text
order.paid
payment.captured
```

The webhook route must remain publicly reachable by Razorpay.

---

# ERPNext Sales Orders

A draft Sales Order is created before payment is completed.

The Sales Order can store:

```text
custom_razorpay_order_id
custom_razorpay_payment_id
custom_payment_status
custom_reseller_code
custom_reseller_commission
```

These fieldnames can be overridden using environment variables.

After successful payment verification:

1. The Razorpay Payment ID is written to the Sales Order.
2. Payment status is changed to `Paid`.
3. The Sales Order is submitted.
4. An optional ERPNext Payment Entry can be created.

---

# ERPNext Customer Handling

Two customer modes are supported.

## Default customer

Set:

```env
ERPNEXT_DEFAULT_CUSTOMER=
```

to use a shared ERPNext Customer.

## Automatic customer creation

Enable:

```env
ERPNEXT_AUTO_CREATE_CUSTOMER=true
```

When enabled, the application can:

1. Look for an ERPNext Customer by email.
2. Create a new Customer when necessary.
3. Create customer address/contact information.
4. Associate the customer with the Sales Order.

Supporting variables:

```env
ERPNEXT_CUSTOMER_GROUP=Individual
ERPNEXT_TERRITORY=All Territories
ERPNEXT_CUSTOMER_EMAIL_FIELD=custom_email
```

---

# Optional Payment Entry Creation

ERPNext Payment Entry creation is disabled by default.

Enable it with:

```env
ERPNEXT_CREATE_PAYMENT_ENTRY=true
```

Then configure:

```env
ERPNEXT_COMPANY=
ERPNEXT_PAID_TO_ACCOUNT=
ERPNEXT_MODE_OF_PAYMENT=Wire Transfer
```

A failure to create the optional Payment Entry does not undo an otherwise successfully paid order.

---

# Wishlist Integration

Default doctype:

```env
ERPNEXT_WISHLIST_DOCTYPE=Website Wishlist
```

Expected fields include:

```text
clerk_user_id
user_email
product_item_code
product_name
product_slug
item_group
product_image
added_on
active
```

Wishlist API endpoints support:

```text
GET    /api/wishlist
POST   /api/wishlist
DELETE /api/wishlist
GET    /api/wishlist/products
```

---

# Reseller Integration

Default doctype:

```env
ERPNEXT_RESELLER_DOCTYPE=Website Reseller
```

Expected fields include:

```text
reseller_code
clerk_user_id
reseller_name
email
phone
margin_percent
active
```

Authenticated reseller API:

```text
GET   /api/reseller
POST  /api/reseller
PATCH /api/reseller
```

Referral links use:

```text
https://www.beyondinvitation.co.in/?via=RESELLERCODE
```

The default maximum configurable margin is:

```env
RESELLER_MAX_MARGIN_PERCENT=100
```

---

# Contact Leads

The contact form sends enquiries to ERPNext through:

```text
POST /api/contact-lead
```

The integration creates an ERPNext Lead containing customer enquiry information.

---

# Instagram Integration

Instagram reel support uses the Instagram Graph API.

Required variables:

```env
INSTAGRAM_USER_ID=
INSTAGRAM_ACCESS_TOKEN=
```

The Instagram user ID must be the numeric account ID expected by the API, not the Instagram username/handle.

Reels can be requested through:

```text
GET /api/instagram-reels
```

Only suitable video posts are returned to the storefront.

---

# Instagram Token Refresh

A protected token-refresh endpoint exists at:

```text
GET /api/refresh-instagram-token
```

It requires:

```env
CRON_SECRET=
```

and expects:

```http
Authorization: Bearer YOUR_CRON_SECRET
```

The returned Instagram token still needs to be saved back into the deployment environment as:

```env
INSTAGRAM_ACCESS_TOKEN=
```

---

# SEO

SEO utilities are located in:

```text
lib/seo.ts
lib/site-config.ts
```

The application includes:

- Global metadata
- Page-specific metadata
- Product metadata
- Canonical site URL handling
- Open Graph metadata
- Twitter metadata
- `robots.ts`
- `sitemap.ts`
- Structured product/site information

Production site URL:

```text
https://www.beyondinvitation.co.in
```

To override the site URL:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

---

# API Routes

Important application API routes include:

| Route | Purpose |
| --- | --- |
| `GET /api/search?q=...` | Product search |
| `POST /api/contact-lead` | ERPNext contact/lead creation |
| `GET /api/instagram-reels` | Fetch Instagram reels |
| `GET /api/refresh-instagram-token` | Refresh Instagram access token |
| `GET /api/reseller` | Get reseller account |
| `POST /api/reseller` | Create reseller account |
| `PATCH /api/reseller` | Update reseller margin |
| `GET /api/wishlist` | Fetch wishlist records |
| `POST /api/wishlist` | Add wishlist item |
| `DELETE /api/wishlist` | Remove wishlist item |
| `GET /api/wishlist/products` | Fetch full wishlist products |
| `POST /api/razorpay/order` | Create Razorpay + ERPNext draft order |
| `POST /api/razorpay/verify` | Verify payment and fulfil order |
| `POST /api/razorpay/webhook` | Razorpay webhook fulfilment |

---

# Route Protection

Clerk middleware protects authenticated customer functionality.

Current protected route groups include:

```text
/account
/wishlist
/my-orders
/checkout
/api/razorpay/order
/api/razorpay/verify
```

Do **not** protect:

```text
/api/razorpay/webhook
```

with Clerk authentication.

Razorpay needs to call that endpoint directly.

---

# ERPNext API Permissions

The ERPNext API user needs appropriate permissions for the features enabled in the application.

Depending on configuration, this may include access to:

```text
Item
Item Price
File
Lead
Customer
Address
Contact
Sales Order
Payment Entry
Website Wishlist
Website Reseller
```

Grant only the permissions actually required by the storefront.

Avoid using an ERPNext Administrator account as the permanent website integration user.

---

# Testing ERPNext Authentication

You can verify an ERPNext API key and API secret independently of the Next.js application.

```bash
curl -i \
  -H "Authorization: token YOUR_API_KEY:YOUR_API_SECRET" \
  "https://YOUR-ERP-DOMAIN/api/method/frappe.auth.get_logged_user"
```

A working credential pair should return HTTP `200`.

If this test succeeds while the deployed website returns `401`, check the deployment environment variables and redeploy the application.

---

# ERPNext `401 Unauthorized` Troubleshooting

A normal authentication failure looks similar to:

```text
ERPNext API failed: 401 UNAUTHORIZED
frappe.exceptions.AuthenticationError
```

Check:

```env
ERPNEXT_URL=
ERPNEXT_API_KEY=
ERPNEXT_API_SECRET=
```

Make sure:

1. The API key and API secret belong to the same ERPNext user.
2. The credentials belong to the ERPNext site referenced by `ERPNEXT_URL`.
3. No old secret remains in the production deployment.
4. The environment variable is enabled for the correct Vercel environment.
5. The application has been redeployed after changing environment variables.

If ERPNext instead reports:

```text
Failed to decrypt key
Encryption key is invalid
```

the problem is on the ERPNext/Frappe side and usually indicates encrypted credentials were created using a different site's encryption key.

Regenerating the API secret can restore API authentication, but after a site migration or database restore the proper long-term fix is to ensure the correct Frappe site encryption key has also been restored.

---

# Security

Never commit any of the following:

```env
ERPNEXT_API_KEY=
ERPNEXT_API_SECRET=
CLERK_SECRET_KEY=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
INSTAGRAM_ACCESS_TOKEN=
CRON_SECRET=
```

The repository already ignores:

```text
.env
.env.local
.clerk/
```

Only variables intentionally prefixed with:

```text
NEXT_PUBLIC_
```

should be treated as browser-visible.

Never prefix ERPNext, Razorpay secret, Clerk secret, cron secret, or Instagram access-token values with `NEXT_PUBLIC_`.

---

# Deployment

## Vercel

Vercel is the recommended deployment target.

Typical process:

1. Import the GitHub repository into Vercel.
2. Configure all production environment variables.
3. Build using:

```bash
npm run build
```

4. Deploy.
5. Configure the production domain.
6. Configure the Razorpay webhook.
7. Test Clerk authentication.
8. Test ERPNext authentication.
9. Perform a complete test order.

### Important environment-variable behavior

After changing server credentials such as:

```text
ERPNEXT_API_SECRET
RAZORPAY_KEY_SECRET
CLERK_SECRET_KEY
INSTAGRAM_ACCESS_TOKEN
```

create/redeploy a deployment so the application runs with the updated values.

---

# Razorpay Webhook Setup

Configure Razorpay to call:

```text
https://YOUR-DOMAIN/api/razorpay/webhook
```

Use the same webhook secret in both Razorpay and:

```env
RAZORPAY_WEBHOOK_SECRET=
```

Webhook signature verification uses the raw request body.

Do not parse or modify the webhook body before signature verification.

---

# Production Checklist

Before deploying production changes, verify:

- ERPNext API authentication works
- ERPNext API user has required permissions
- Products load correctly
- Product images load correctly
- Product prices are correct
- Website visibility rules work
- Quantity rules work
- Search works
- Clerk sign-in works
- Wishlist works
- Reseller account creation works
- Referral pricing works
- Cart persists correctly
- Checkout customer validation works
- Razorpay order creation works
- ERPNext draft Sales Order is created
- Razorpay checkout opens
- Payment verification succeeds
- ERPNext Sales Order becomes Paid
- ERPNext Sales Order is submitted
- Razorpay webhook succeeds
- My Orders displays completed orders
- Contact enquiries reach ERPNext
- Instagram reels load
- Sitemap and robots endpoints work

---

# Build Notes

`next.config.js` currently allows remote HTTPS images.

The project currently allows production builds to continue even when ESLint or TypeScript build errors exist.

Because of this, run code-quality and type checks before production deployment rather than depending exclusively on `npm run build`.

---

# Data Sources

The primary live product source is:

```text
ERPNext
```

Local data remains under:

```text
data/products.json
data/categories.json
```

and is used by parts of the local/fixture product layer.

The main live ERPNext data-access layer is:

```text
lib/erpnext.ts
```

UI components should generally consume application data helpers rather than implementing their own ERPNext authentication calls.

---

# Important Files

### `lib/erpnext.ts`

Main ERPNext integration.

Handles product catalogue, product media, customers, orders, payment metadata, fulfilment, and order history.

### `lib/checkout.ts`

Resolves cart products and authoritative prices before creating a payment.

### `lib/razorpay.ts`

Creates the Razorpay client and verifies checkout/webhook signatures.

### `lib/erp-wishlist.ts`

ERPNext-backed wishlist operations.

### `lib/reseller.ts`

Reseller accounts, referral-code lookup, cookie-based reseller detection, and margin pricing.

### `lib/product-quantity.ts`

Minimum quantity and quantity-step rules.

### `lib/instagram.ts`

Instagram Graph API integration.

### `lib/seo.ts`

SEO helpers.

### `lib/site-config.ts`

Site URL, brand information, business address, and global SEO configuration.

### `middleware.ts`

Clerk route protection.

### `components/CartProvider.tsx`

Shared client-side cart state.

---

# Brand / Site Configuration

Primary site:

```text
https://www.beyondinvitation.co.in
```

Brand:

```text
Beyond Invitation
```

Company:

```text
Bharat Agency Wedding Cards Pvt. Ltd.
```

The central site configuration lives in:

```text
lib/site-config.ts
```

---

# Contributing / Development Workflow

For application changes:

```bash
git checkout -b your-feature-branch
npm install
npm run dev
```

Before merging:

```bash
npm run build
```

Also review TypeScript and lint errors locally because the current Next.js configuration does not block production builds on those errors.

Keep secrets outside Git.

---

# License

This repository does not currently declare an open-source license.

Unless a license is added, treat the source code and business assets as proprietary to the repository owner / Beyond Invitation.

---

# Beyond Invitation

**Beyond Invitation**  
Bharat Agency Wedding Cards Pvt. Ltd.

Premium wedding invitation cards, shagun envelopes, boxes, and celebration stationery.

Production website:

```text
https://www.beyondinvitation.co.in
```