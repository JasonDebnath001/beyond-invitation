# Beyond Invitation

Production e-commerce storefront for **Beyond Invitation / Bharat Agency Wedding Cards Pvt. Ltd.**, built for premium Indian wedding invitations, wedding cards, shagun envelopes, boxes, celebration stationery, and related products.

The storefront is built with **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS**, **Razorpay**, **Supabase**, and **ERPNext**.

Supabase supplies the product catalogue and Selling prices through a public view shared with Samriddhi, along with authentication, wishlists and website orders. Razorpay handles payments. Legacy ERPNext integrations remain for contact leads and referral pricing; checkout no longer creates ERPNext Sales Orders or Payment Entries.

**Website order setup:** Apply [supabase/migrations/20260916_website_orders.sql](supabase/migrations/20260916_website_orders.sql), configure a server-only Supabase secret key and the Razorpay webhook, and restart the app. See [supabase/ORDERS_SETUP.md](supabase/ORDERS_SETUP.md). The migration is required even though the catalogue and authentication already work.

---

## Features

### Storefront

- Next.js App Router storefront
- Server-rendered and SEO-friendly product pages
- Live product catalogue from Supabase
- Product categories and collections
- Product search
- Product image galleries
- Product video support
- Website-specific product titles and descriptions
- Related products
- Cart persisted in `localStorage`
- Responsive navigation and layouts
- Wedding card and wedding box editorial pages
- About, contact, visit-us, and policy pages
- Instagram reels integration
- Sitemap and robots metadata
- Open Graph and structured SEO support

### Authentication and guest shopping

Supabase Auth supports Google sign-in and email/password registration, email password-reset links, optional profile names and sign-out. Registration asks only for email and password. Phone authentication is removed. See [supabase/AUTH_SETUP.md](supabase/AUTH_SETUP.md) for email confirmation, delivery and callback settings. Password changes require an authenticated session.

`/account` requires a server-verified Supabase user. Browsing, wishlist and checkout remain accessible to guests. The cart and guest wishlist save selections on this device; signed-in wishlists sync to the account through Supabase. `/my-orders` and `/reseller` provide contact options; private order-history retrieval and reseller self-service have not been reconnected to the new identities.

Payment verification and the Razorpay webhook continue to require valid payment signatures.

### ERPNext integration

Legacy ERPNext integrations still used outside order storage:

- Contact leads
- Referral pricing

Older customer, Sales Order, reseller-management and Payment Entry helpers remain in the repository, but the website order/payment routes use Supabase. ERPNext order environment variables in the legacy examples below no longer configure checkout.

### Wishlist

Signed-in wishlists are stored in Supabase `public.wishlist_items`, protected by per-user row-level security. Guest selections remain in localStorage and merge into the account after sign-in. Product details and current prices are loaded through `POST /api/wishlist/products`. Apply the new table migration before deploying; see [supabase/WISHLIST_SETUP.md](supabase/WISHLIST_SETUP.md).

### Order help

`/my-orders` provides a contact link for order enquiries. Customer order history is not publicly accessible.

### Reseller / referral pricing

The application includes a reseller system backed by the ERPNext doctype:

```text
Website Reseller
```

Each reseller can have:

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
| Supabase Postgres | Product catalogue, account wishlists and website orders |
| ERPNext / Frappe | Legacy referral and contact integrations |
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
│   ├── catalog/
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
│   ├── wishlist.ts
│   ├── catalog.ts
│   ├── supabase/server.ts
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
# ERPNext - orders, customers, reseller and contact records
# --------------------------------------------------

ERPNEXT_URL=https://your-erpnext-domain.com
ERPNEXT_API_KEY=
ERPNEXT_API_SECRET=


# --------------------------------------------------
# Supabase product catalogue
# --------------------------------------------------

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key


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

# Product catalogue (Supabase)

`lib/catalog.ts` reads only `public.v_web_products` using the public anon/publishable key. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and your deployment environment. Never use a `service_role` or secret key in this storefront.

The SQL contract is in `supabase/migrations/20260914_web_catalog.sql`. It intentionally uses the database owner's privileges to bypass ERP user RLS for this restricted public view. Base-table policies are unchanged. Lists, details, search and sitemap use this view; data is cached for 60 seconds, and reseller margins are applied afterwards for each visitor.

To make an item appear on the site in Samriddhi:

1. Keep the item active and tick **Show on Website**.
2. Set **Subject** to Wedding Card, Hindu Wedding Card, Muslim Wedding Card, Christian Wedding Card, Shagun Envelopes, Wedding Box, or Rakhi. Language subjects and unassigned subjects appear only in all-product lists and search until re-tagged.
3. Add an active **Selling** price on **Standard Sales List** (`PL0001`), or fill `website_price` on a qualifying Selling row. An explicit item website price list has first priority, then a populated `website_price`, then `PL0001`. Rows must have `row_status = 'Active'` and not be expired. The latest `effective_from` breaks preference ties; it is not a start-date filter.

Price is `website_price` when set, otherwise rate minus discount, rounded to two decimals. Unpriced items remain visible as **Price on request**, link to `/contact?product=<slug>`, and cannot be checked out. Checkout looks up base prices again on the server before applying the unchanged reseller margin.

Product URLs retain the design number (`items.name`), such as `/products/535093`. Supplier/year item groups are searchable metadata only. Brand metadata comes from `BRAND_NAME` in `lib/site-config.ts`.

Browse all products at `/catalog`. Existing category definitions remain in `data/categories.json`; collection membership is based on Subject. Specific religious collections also include the shared Wedding Card subject.

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

Quantity rules retain the existing Subject-based behavior, with legacy cart fallbacks. Wedding boxes start at 25 in steps of 25; Shagun envelopes start at 50 in steps of 50; other items start at 50 in steps of 25. The catalogue also carries Samriddhi minimum and multiple fields for future quantity-rule changes.

---

# Product Images and Videos

Images from `items.image_url` and non-deleted `item_images` are combined, with duplicates and empty references removed. The storefront sorts photos numerically by the trailing filename number (`1234_1.png`, `1234_2.png`, …, `1234_10.png`); the first photo becomes the main product image in galleries and product cards. Photos without a numbered suffix follow numbered photos in their original order. Absolute URLs point to Supabase's public `item_images` storage bucket. Videos come from `items.video_url` and follow the images in the gallery.

Run `npm test` for catalogue mapping, caching, checkout price protection, and the retained legacy gallery tests.

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

Checkout uses Supabase for persistent website orders and Razorpay for payments. Before deploying, follow [supabase/ORDERS_SETUP.md](supabase/ORDERS_SETUP.md) to create the new table, configure the server-only Supabase key and enable the Razorpay webhook.

1. POST /api/razorpay/order validates customer details and resolves cart prices from the Supabase catalogue.
2. The server saves the cart, delivery details and verified account ID (or null for guests) in public.website_orders with pending payment status.
3. It creates the Razorpay order using the website order UUID as the receipt, then saves the gateway ID before returning checkout details.
4. POST /api/razorpay/verify validates the checkout signature and fetches the payment from Razorpay. Only a captured payment matching the stored order, amount and currency can mark it paid.
5. POST /api/razorpay/webhook independently verifies the raw-body signature and reconciles payment.captured and order.paid events through the same database function.

The payment update locks the stored row and is safe to repeat. A temporary confirmation failure shows a pending message with the payment reference instead of claiming the order is confirmed. Webhook failures return a non-2xx response so delivery can be retried.

A failed initial database write stops checkout before creating a gateway order. A failed gateway/link operation can leave an unpaid pending website order; it never opens checkout before storage is ready. Orders, customer snapshots and payment references no longer depend on ERPNext. Historical ERPNext orders are not imported.

## Payment environment

```env
SUPABASE_SECRET_KEY=
# Alternatively: SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Use the existing NEXT_PUBLIC_SUPABASE_URL and public Auth key for catalogue/account access. The additional secret key is for server-only order writes; never prefix it with NEXT_PUBLIC_. Configure payment.captured and order.paid on the public HTTPS /api/razorpay/webhook URL, using the same webhook secret in Razorpay and the hosting environment.

The legacy ERPNext customer, Sales Order and Payment Entry environment variables shown elsewhere in this README are not used by the new order/payment storage flow.

---

# Wishlist Integration

`components/WishlistProvider.tsx` shares saved state between product hearts, navigation counts and the wishlist page. Guests persist slugs under `beyond-invitation-wishlist-v1`; signed-in users load and mutate their Supabase wishlist through the authenticated `/api/wishlist` endpoint. Guest items merge on sign-in, changes refresh across tabs and on window focus, and failed saves roll back with an error message. When browser storage is unavailable, guest selections last for the current visit.

`POST /api/wishlist/products` accepts `{ "slugs": ["313082"] }` and returns `{ "products": [...] }` from the current Supabase catalogue, including applicable referral prices. Unavailable products can be removed from the saved list. `/api/wishlist` now uses Supabase Auth and RLS rather than ERPNext. Apply [supabase/migrations/20260916_wishlist.sql](supabase/migrations/20260916_wishlist.sql) to create its table and policies; setup and verification are in [supabase/WISHLIST_SETUP.md](supabase/WISHLIST_SETUP.md).

---

# Reseller Integration

Default doctype:

```env
ERPNEXT_RESELLER_DOCTYPE=Website Reseller
```

Expected fields include:

```text
reseller_code
reseller_name
email
phone
margin_percent
active
```

Online reseller registration and profile editing are unavailable while authentication is disabled. `GET`, `POST` and `PATCH /api/reseller` return HTTP 410 without reading or changing reseller records. Contact the team to manage an existing reseller arrangement.

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
| `GET /api/reseller` | Retired: HTTP 410 |
| `POST /api/reseller` | Retired: HTTP 410 |
| `PATCH /api/reseller` | Retired: HTTP 410 |
| `POST /api/wishlist/products` | Resolve saved slugs against Supabase products |
| `GET /api/wishlist` | Read the signed-in user's wishlist |
| `POST /api/wishlist` | Save a product or merge guest selections |
| `DELETE /api/wishlist` | Remove a product from the signed-in user's wishlist |
| `POST /api/razorpay/order` | Create Razorpay + ERPNext draft order |
| `POST /api/razorpay/verify` | Verify payment and fulfil order |
| `POST /api/razorpay/webhook` | Razorpay webhook fulfilment |

---

# Guest Routes and Payment Verification

The middleware refreshes Supabase Auth cookies and captures referral links. The account page verifies the session with Supabase before showing profile details. Browsing, wishlist and checkout remain public; private order-history retrieval and reseller account management are not exposed.

`POST /api/razorpay/verify` validates the Razorpay HMAC before fulfilment, and `/api/razorpay/webhook` verifies its independent webhook signature. Removing site authentication does not bypass these checks.

---

# ERPNext API Permissions

The ERPNext API user needs appropriate permissions for the features enabled in the application.

Depending on configuration, this may include access to:

```text
Item
Lead
Customer
Address
Contact
Sales Order
Payment Entry
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
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
INSTAGRAM_ACCESS_TOKEN=
CRON_SECRET=
```

The repository already ignores:

```text
.env
.env.local
```

Only variables intentionally prefixed with:

```text
NEXT_PUBLIC_
```

should be treated as browser-visible.

Never prefix ERPNext, Razorpay secret, cron secret, or Instagram access-token values with `NEXT_PUBLIC_`.

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
7. Configure and test Google and email/password sign-in, guest checkout and wishlist persistence.
8. Test ERPNext authentication.
9. Perform a complete test order.

### Important environment-variable behavior

After changing server credentials such as:

```text
ERPNEXT_API_SECRET
RAZORPAY_KEY_SECRET
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
- Google and email/password authentication work after provider setup
- Account page requires a verified session
- Guest browsing and checkout remain accessible
- Wishlist works
- Retired reseller account API returns HTTP 410
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

The live product source is Supabase `public.v_web_products`, accessed through `lib/catalog.ts`. `data/categories.json` supplies category definitions; `data/products.json` is retained as a legacy fixture and is not merged into the live catalogue.

ERPNext continues to handle orders, customers, reseller records and contact leads. Its existing integration remains in `lib/erpnext.ts`.

---

# Important Files

### `lib/catalog.ts` and `lib/supabase/server.ts`

Public catalogue mapper, cached lists, collection filters, product lookup, and lazy server-only Supabase client.

### `lib/erpnext.ts`

Retained ERPNext integration for customers, orders, payment metadata, fulfilment and order history. Legacy catalogue helpers remain for compatibility and gallery regression tests.

### `lib/checkout.ts`

Resolves cart products and authoritative prices before creating a payment.

### `lib/razorpay.ts`

Creates the Razorpay client and verifies checkout/webhook signatures.

### `lib/wishlist.ts`

Browser wishlist storage normalization. See `components/WishlistProvider.tsx` for shared state.

### `lib/reseller.ts`

Referral-code lookup, cookie-based reseller detection, and margin pricing.

### `lib/product-quantity.ts`

Minimum quantity and quantity-step rules.

### `lib/instagram.ts`

Instagram Graph API integration.

### `lib/seo.ts`

SEO helpers.

### `lib/site-config.ts`

Site URL, brand information, business address, and global SEO configuration.

### `middleware.ts`

Supabase session refresh and referral-code cookie handling.

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
