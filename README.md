# Beyond Invitation

Professional wedding invitation card storefront built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **Clerk** authentication.

This repository is a production-ready e-commerce shell for Indian wedding cards and invitation stationery. It integrates with **ERPNext** as the live product catalog backend, with `lib/erpnext.ts` fetching product and pricing data from ERPNext Item and Item Price APIs. Local JSON fixtures remain available for optional development and fallback.

---

## Key features

- Server-rendered, SEO-friendly storefront using **Next.js App Router**
- Responsive homepage with hero carousel, product sections, category browsing, testimonials, and milestones
- Product detail pages with image gallery, related items, and cart actions
- Category pages generated from `data/categories.json`
- Search endpoint and search results page
- Clerk-powered authentication for `/account` routes
- Cart state managed with a shared provider
- Clean separation between UI components and data access

---

## Tech stack

- **Next.js 15**
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **Clerk** for customer authentication
- **ERPNext** for for product related data
- **isomorphic-dompurify** for safe HTML sanitization

---

## Repository layout

```text
shahi-cards/
├── app/
│   ├── account/page.tsx             Account page protected by Clerk
│   ├── api/search/route.ts          Search API route
│   ├── cart/page.tsx                Cart page
│   ├── collections/[category]/page.tsx  Category listing pages
│   ├── erp-products/page.tsx        ERP product showcase page
│   ├── products/[slug]/page.tsx     Product detail pages
│   ├── search/page.tsx              Search results page
│   ├── layout.tsx                   Root layout with ClerkProvider, CartProvider, navbar, footer
│   └── page.tsx                     Homepage
├── components/                      Reusable UI components
│   ├── CartButton.tsx
│   ├── CartProvider.tsx
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
├── data/                            Local product and category fixtures
│   ├── categories.json
│   └── products.json
├── lib/                             Data access and integration helpers
│   ├── erpnext.ts
│   └── products.ts
├── public/products/                 Product image assets
├── types/                           Shared TypeScript definitions
│   └── index.ts
├── middleware.ts                    Clerk route protection
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## Prerequisites

- Node.js **18.17+**
- npm (or your preferred package manager)

---

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Production build

```bash
npm run build
npm run start
```

For a production build and preview:

```bash
npm run build
npm run start
```

---

## Product data model

Products are sourced from **ERPNext Item** and **Item Price** records. The live storefront maps ERPNext fields into the app's product model and renders them on the homepage, collection pages, and product detail pages.

The ERPNext product mapping includes:

- `slug`: normalized URL slug derived from Item code or name
- `name`: Item name
- `price`: price list rate from ERPNext Item Price
- `mrp`: same price value by default
- `images`: image URLs from the Item image field and gallery child tables
- `emoji`: not used for ERPNext-sourced products
- `category`: derived from Item group and normalized to storefront categories
- `description`: sanitized ERPNext Item description
- `onSale` / `isPremium`: available as storefront flags if configured
- `customisation`, `material`, `includes`: mapped from ERPNext custom fields

### Managing products in ERPNext

1. Create or update an Item record in ERPNext.
2. Enable website visibility (the configured `Show on Website` checkbox).
3. Add one or more Item Price records for the configured price list.
4. Add the primary Item image and optional Item Image gallery rows.
5. Refresh the storefront or let the configured cache revalidate.

Local JSON files under `data/` are kept as optional fixtures and fallback data, but ERPNext is the active catalog source.

---

## Customization guide

### Changing branding and styles

- Update Tailwind tokens in `tailwind.config.ts`
- Change global styles in `app/globals.css`
- Adjust fonts and layout in `app/layout.tsx`

### Updating navigation

- Modify the nav menu inside `components/Navbar.tsx`
- Add or remove links for new sections and pages

### Homepage content

- Edit `app/page.tsx` to change hero sections, featured collections, and layout order
- Use the shared components in `components/Sections.tsx` for page content blocks

### Component updates

- `components/ProductCard.tsx` controls product listing cards
- `components/ProductGallery.tsx` and `components/ImageSlider.tsx` control product media
- `components/CartProvider.tsx` manages cart state across the app

---

## Authentication and account pages

- Clerk is integrated via `@clerk/nextjs`
- `app/account/page.tsx` is protected by middleware in `middleware.ts`
- Public browsing is available for storefront and search

If you want to disable authentication for local testing, remove or modify the `middleware.ts` route matcher.

---

## ERPNext integration

ERPNext is already integrated and is the live product catalog source for the storefront. The `lib/erpnext.ts` module fetches Item and Item Price records directly from ERPNext and converts them into the app's product model.

### Current behavior

- The storefront can fetch live products from ERPNext via `lib/erpnext.ts`
- `lib/products.ts` remains available as a legacy local fixture helper and fallback layer
- Components are designed to support a data-access abstraction so backends can be swapped with minimal change

### ERPNext data source

1. `lib/erpnext.ts` calls ERPNext REST APIs with `ERPNEXT_URL`, `ERPNEXT_API_KEY`, and `ERPNEXT_API_SECRET`
2. Product catalog pages use ERPNext data directly
3. Local JSON fixtures in `data/` are only for optional local/testing use

---

## Deployment

Recommended host:

- **Vercel**: connect the Git repository and deploy directly

Other options:

- Netlify
- Any Node.js hosting provider supporting `next start`

For Vercel, the standard build command is:

```bash
npm run build
```

---

## Notes

- The app uses `next dev`, `next build`, and `next start` from Next.js.
- Product images should live in `public/products/` or be served from ERPNext image URLs.
- ERPNext is configured as the live backend when valid environment variables are present; `data/` fixtures remain available for offline or fallback development.
