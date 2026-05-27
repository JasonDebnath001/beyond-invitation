# Shahi Cards — Next.js E-commerce Website

A scalable wedding invitation card store built with **Next.js 14 (App Router)**,
**TypeScript**, and **Tailwind CSS**. Designed so that adding products and
connecting ERPNext later is simple.

---

## Quick start

You need **Node.js 18.17+** installed ([nodejs.org](https://nodejs.org)).

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev
```

Open **http://localhost:3000** in your browser.

```bash
# Build for production
npm run build
npm run start
```

---

## Project structure

```
shahi-cards/
├── app/                          Pages (App Router)
│   ├── layout.tsx                Navbar + Footer on every page
│   ├── page.tsx                  Homepage
│   ├── products/[slug]/page.tsx  Product detail — one page per product, auto
│   └── collections/[category]/   Category listing — one page per category, auto
│
├── components/                   Reusable UI — change once, updates everywhere
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── Sections.tsx              Hero, CelebrationGrid, WhyUs, Testimonials...
│   ├── ProductCard.tsx           A single product card
│   ├── ProductGrid.tsx           Grid + section wrapper
│   ├── ImageSlider.tsx           Multi-image carousel (self-contained state)
│   └── AddToCartButton.tsx
│
├── data/                         Product data lives here (not in code)
│   ├── products.json
│   └── categories.json
│
├── lib/                          Data access layer
│   ├── products.ts               All components fetch data through this
│   └── erpnext.ts                ERPNext API template (not active yet)
│
├── types/index.ts                TypeScript types — single source of truth
└── public/products/              Product images go here
```

---

## How to add a product

1. Open `data/products.json`.
2. Add one object:

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
  "onSale": true
}
```

3. Put the images (`pink1.jpg`, `pink2.jpg`) into `public/products/`.

That's it. The product card, image slider, detail page (`/products/pink-floral-wedding-card`),
and category listing all update automatically. No HTML to write.

> If an image is missing, the card falls back to the `emoji` — no broken images.

---

## How to change the design

| Want to change... | Edit this file |
| --- | --- |
| Brand colors | `tailwind.config.ts` (the `colors` block) |
| Product card look | `components/ProductCard.tsx` (one file → all cards) |
| Navigation menu | `components/Navbar.tsx` (the `navMenu` array) |
| Homepage sections | `app/page.tsx` |
| Footer links | `components/Footer.tsx` |

---

## Connecting ERPNext (later)

The app currently uses dummy data from `data/products.json`. To go live with
ERPNext:

1. Copy `.env.example` to `.env.local` and fill in your ERPNext URL + API keys.
2. Implement the functions in `lib/erpnext.ts` (skeletons are provided).
3. In `lib/products.ts`, replace the JSON lookups with calls to those functions.

Because every component fetches data through `lib/products.ts`, **no component
needs to change** — only that one file. That is the whole point of the
data-access-layer design.

---

## Deploying

The easiest host is **Vercel** (made by the Next.js team):

1. Push this folder to a GitHub repository.
2. Import the repository at [vercel.com](https://vercel.com).
3. Vercel builds and deploys automatically.

Other options: Netlify, or any Node.js host via `npm run build && npm run start`.
