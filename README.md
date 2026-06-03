# Beyond Invitation

Professional wedding invitation storefront built with **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS**, **Clerk**, **Razorpay**, and **ERPNext**.

This repository is a production-ready e-commerce shell for Indian wedding invitations, shagun envelopes, celebration stationery, and related gift accessories. It supports live product catalog integration with ERPNext while preserving local JSON fixtures for development fallback.

---

## Key features

- Server-rendered, SEO-friendly storefront using **Next.js App Router**
- Live ERPNext product catalog integration with item and pricing mapping
- Responsive homepage with hero carousel, category/promotional sections, testimonials, and trust blocks
- Product detail pages with image gallery, related items, and cart actions
- Category browsing under `app/collections/[category]`
- Search page and live navbar search powered by the same data layer
- Cart state persisted to `localStorage`
- Checkout flow with Razorpay order creation, payment verification, and ERPNext sales order fulfilment
- Contact enquiry form integrated with ERPNext lead creation
- Clerk authentication protecting account, checkout, and payment verification routes
- Clean separation between UI components and data access logic

---

## Tech stack

- **Next.js 15**
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **@clerk/nextjs**
- **Razorpay** payment integration
- **ERPNext** product/catalog/order backend integration
- **isomorphic-dompurify** for sanitized HTML

---

## Repository layout

```text
shahi-cards/
├── app/
│   ├── account/page.tsx                 Account page protected by Clerk
│   ├── api/
│   │   ├── contact-lead/route.ts        ERPNext lead/contact enquiry endpoint
│   │   ├── erp-debug/route.ts           ERP debug endpoint
│   │   ├── razorpay/
│   │   │   ├── order/route.ts           Razorpay order creation
│   │   │   ├── verify/route.ts          Razorpay payment verification
│   │   │   └── webhook/route.ts         Razorpay webhook fulfilment
│   │   └── search/route.ts              Live search API route
│   ├── cart/page.tsx                    Cart page
│   ├── checkout/page.tsx                Checkout page
│   ├── collections/[category]/page.tsx  Category listing pages
│   ├── erp-products/page.tsx            ERP product showcase page
│   ├── products/[slug]/page.tsx         Product detail pages
│   ├── search/page.tsx                  Search results page
│   ├── layout.tsx                       Root layout with ClerkProvider, CartProvider, navbar, footer
│   └── page.tsx                         Homepage with dynamic ERPNext product sections
├── components/                          Reusable UI components
│   ├── AddToCartButton.tsx
│   ├── CartButton.tsx
│   ├── CartProvider.tsx
│   ├── ContactLeadForm.tsx
│   ├── FilterableProductGrid.tsx
│   ├── Footer.tsx
│   ├── HeroCarousel.tsx
│   ├── ImageSlider.tsx
│   ├── Navbar.tsx
│   ├── ProductBuyBox.tsx
│   ├── ProductCard.tsx
│   ├── ProductGallery.tsx
│   ├── ProductGrid.tsx
│   ├── SearchBar.tsx
│   └── Sections.tsx
├── data/                                Local product and category fixtures
│   ├── categories.json
│   └── products.json
├── lib/                                 Data access and integration helpers
│   ├── checkout.ts
│   ├── erpnext.ts
│   ├── products.ts
│   └── razorpay.ts
├── public/products/                     Product image assets
├── types/                               Shared TypeScript definitions
│   └── index.ts
├── middleware.ts                        Clerk route protection
├── next.config.js
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Prerequisites

- Node.js **18.17+**
- npm

---

## Scripts

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

---

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Production build

```bash
npm run build
npm run start
```

---

## Environment variables

### Required for ERPNext

- `ERPNEXT_URL`
- `ERPNEXT_API_KEY`
- `ERPNEXT_API_SECRET`

### Required for Razorpay

- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

### Optional ERPNext customization

- `ERPNEXT_PRICE_LIST` (default: `Standard Selling`)
- `ERPNEXT_WEBSITE_FIELD` (default: `custom_show_on_website`)
- `ERPNEXT_SUBJECT_FIELD` (default: `custom_subject`)
- `ERPNEXT_CUSTOMISATION_FIELD` (default: `custom_customisation`)
- `ERPNEXT_MATERIAL_FIELD` (default: `custom_material`)
- `ERPNEXT_INCLUDES_FIELD` (default: `custom_includes`)
- `ERPNEXT_REVALIDATE_SECONDS` (default: `60`)
- `ERPNEXT_IMAGE_TABLE_FIELD`
- `ERPNEXT_IMAGE_ROW_FIELD` (default: `image`)
- `ERPNEXT_IMAGE_ORDER_FIELD`
- `ERPNEXT_LEAD_DOCTYPE` (default: `Lead`)

### Optional ERPNext order fulfilment

- `ERPNEXT_DEFAULT_CUSTOMER`
- `ERPNEXT_RZP_ORDER_FIELD` (default: `custom_razorpay_order_id`)
- `ERPNEXT_RZP_PAYMENT_FIELD` (default: `custom_razorpay_payment_id`)
- `ERPNEXT_PAYMENT_STATUS_FIELD` (default: `custom_payment_status`)
- `ERPNEXT_AUTO_CREATE_CUSTOMER` (default: `false`)
- `ERPNEXT_CUSTOMER_GROUP` (default: `Individual`)
- `ERPNEXT_TERRITORY` (default: `All Territories`)
- `ERPNEXT_CUSTOMER_EMAIL_FIELD` (default: `custom_email`)
- `ERPNEXT_CREATE_PAYMENT_ENTRY` (default: `false`)
- `ERPNEXT_COMPANY`
- `ERPNEXT_PAID_TO_ACCOUNT`
- `ERPNEXT_MODE_OF_PAYMENT` (default: `Wire Transfer`)

### Clerk

Clerk is integrated through `@clerk/nextjs`. Configure your Clerk project with the standard Clerk environment variables for Next.js.

---

## Product data behavior

- `app/page.tsx` loads storefront categories from `data/categories.json` and ERPNext products from `lib/erpnext.ts`.
- `lib/products.ts` contains the local fixture-based product data layer and search logic.
- `lib/erpnext.ts` maps ERPNext Item and Item Price records into the storefront product shape.
- If ERPNext data is unavailable or the fetch fails, the homepage renders an error block with the failure details.

---

## Checkout & order flow

- `components/CartProvider.tsx` manages shared cart state across the site and persists it to `localStorage`.
- Checkout creates a Razorpay order via `app/api/razorpay/order/route.ts` and writes a draft sales order to ERPNext.
- Payment verification happens via `app/api/razorpay/verify/route.ts`.
- Razorpay webhook events are handled by `app/api/razorpay/webhook/route.ts` as a fallback fulfilment path.
- Protected routes include `/account`, `/checkout`, `/api/razorpay/order`, and `/api/razorpay/verify`.

---

## API routes

- `GET /api/search?q=...` — live product search
- `POST /api/contact-lead` — submit contact enquiries to ERPNext
- `POST /api/razorpay/order` — create payment order
- `POST /api/razorpay/verify` — verify payment signature and fulfil ERPNext order
- `POST /api/razorpay/webhook` — Razorpay webhook fulfilment

---

## Customization guide

### Changing branding and styles

- Update design tokens in `tailwind.config.ts`
- Edit global styles in `app/globals.css`
- Adjust root layout and fonts in `app/layout.tsx`

### Homepage content

- Modify `app/page.tsx` to update hero content, product sections, and layout order
- Reuse components from `components/Sections.tsx` for page blocks

### Data access

- Swap `lib/products.ts` to source from another backend if ERPNext is not used
- `lib/erpnext.ts` is the live integration layer; components do not import ERPNext directly

---

## Deployment

Recommended host:

- **Vercel**: connect the repository and deploy directly

Other options:

- Netlify
- Any Node.js host that supports `next start`

For Vercel, the standard command is:

```bash
npm run build
```

---

## Notes

- `next.config.js` allows remote image domains via `https://**`.
- The app disables build-time ESLint and TypeScript error blocking; use `npm run lint` and local type checks before deployment.
- Product images may be served from `public/products/` or ERPNext-hosted URLs.
- ERPNext is the intended live backend when valid environment variables are set.
