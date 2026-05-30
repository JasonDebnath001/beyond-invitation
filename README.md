# Beyond Invitation

Professional wedding invitation card storefront built with **Next.js 15**, **TypeScript**, **Tailwind CSS**, and **Clerk** authentication.

This repository is a production-ready e-commerce shell for Indian wedding cards and invitation stationery. It uses a data-access layer to keep the UI decoupled from the backend, so you can start with local JSON-driven content and migrate to ERPNext or another catalog service later.

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

Products are defined in `data/products.json`. Each product object includes:

- `slug`: URL-safe identifier for the product page
- `name`: Product title
- `price`: Selling price
- `mrp`: Original or list price
- `images`: Array of image filenames stored under `public/products/`
- `emoji`: Fallback icon if an image cannot be displayed
- `category`: Category slug used by collection pages
- `description`: Product description shown on the product page
- `onSale`: Boolean flag for the homepage sale section
- `isPremium`: Boolean flag for the premium collection section

### Adding a new product

1. Add a new product object to `data/products.json`.
2. Place matching image files in `public/products/`.
3. Visit `/products/<slug>` to verify the detail page.

Example product entry:

```json
{
  "slug": "pink-floral-wedding-card",
  "name": "Pink Floral Wedding Card",
  "price": 99,
  "mrp": 150,
  "images": ["pink1.jpg", "pink2.jpg"],
  "emoji": "🌸",
  "category": "wedding",
  "description": "A graceful pink floral invitation card.",
  "onSale": true,
  "isPremium": false
}
```

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

The project is intentionally structured so backend integration is isolated to `lib/products.ts`.

### Current behavior

- The storefront reads from local JSON files in `data/`
- `lib/products.ts` exposes async product and category accessors
- Components never import raw JSON directly

### To migrate to ERPNext

1. Implement ERPNext API calls in `lib/erpnext.ts`
2. Update `lib/products.ts` functions to call the new ERPNext layer
3. Keep component code unchanged

This design makes it easy to switch from static fixtures to a real product catalog.

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
- Product images should live in `public/products/`.
- There is no database or backend API enabled by default; the app is powered by local JSON fixtures.
