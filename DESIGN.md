---
version: alpha
name: Beyond Invitation
description: >-
  A premium Indian wedding stationery brand specializing in bespoke invitation cards, designer wedding boxes, and
  celebration stationery with pan-India delivery.
logo:
  src: https://www.beyondinvitation.co.in/logo.png
colors:
  surface: "#ffffff"
  surface-dim: "#f8ead0"
  surface-bright: "#fffaf2"
  surface-container-lowest: "#fbf7f0"
  surface-container-low: "#f7ead6"
  surface-container: "#f0d99b"
  surface-container-high: "#e6c97a"
  surface-container-highest: "#d9b875"
  on-surface: "#2a1810"
  on-surface-variant: "#6f5847"
  inverse-surface: "#2a1810"
  inverse-on-surface: "#fffaf2"
  outline: "#8b6f47"
  outline-variant: "#d6b36a"
  surface-tint: "#c9a84c"
  primary: "#7b1c2e"
  on-primary: "#ffffff"
  primary-container: "#85172b"
  on-primary-container: "#ffd8e7"
  inverse-primary: "#f3d99b"
  secondary: "#c9a84c"
  on-secondary: "#2a1810"
  secondary-container: "#e6c97a"
  on-secondary-container: "#2a1810"
  tertiary: "#d6b36a"
  on-tertiary: "#2a1810"
  tertiary-container: "#f0d99b"
  on-tertiary-container: "#6f5847"
  error: "#8b1e2d"
  on-error: "#ffffff"
  error-container: "#a7772d"
  on-error-container: "#fffaf2"
  primary-fixed: "#85172b"
  primary-fixed-dim: "#7b1c2e"
  on-primary-fixed: "#ffffff"
  on-primary-fixed-variant: "#ffd8e7"
  secondary-fixed: "#e6c97a"
  secondary-fixed-dim: "#c9a84c"
  on-secondary-fixed: "#2a1810"
  on-secondary-fixed-variant: "#6f5847"
  tertiary-fixed: "#f0d99b"
  tertiary-fixed-dim: "#d6b36a"
  on-tertiary-fixed: "#2a1810"
  on-tertiary-fixed-variant: "#6f5847"
  background: "#ffffff"
  on-background: "#2a1810"
  surface-variant: "#e6c27a"
typography:
  display:
    fontFamily: Assistant
    fontSize: 60px
    fontWeight: "800"
    lineHeight: 68px
    letterSpacing: "-0.04em"
  headline-lg:
    fontFamily: Assistant
    fontSize: 40px
    fontWeight: "700"
    lineHeight: 48px
    letterSpacing: "-0.02em"
  headline-md:
    fontFamily: Assistant
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 36px
    letterSpacing: "-0.01em"
  title-lg:
    fontFamily: Assistant
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: 0em
  body-lg:
    fontFamily: Assistant
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Assistant
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Assistant
    fontSize: 14px
    fontWeight: "700"
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Assistant
    fontSize: 12px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  container-max: 1500px
elevation:
  sm: 0 1px 2px rgba(0, 0, 0, 0.06)
  md: 0 3px 8px rgba(0, 0, 0, 0.15)
  lg: 0 8px 24px rgba(0, 0, 0, 0.12)
layout:
  containerMaxWidth: 1500px
  gridColumns: 12
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px 24px
    height: 44px
    transition: background-color 240ms ease, box-shadow 240ms ease
  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
    boxShadow: 0 3px 8px rgba(123, 28, 46, 0.2)
  button-primary-active:
    backgroundColor: "{colors.primary-fixed-dim}"
    boxShadow: 0 1px 3px rgba(123, 28, 46, 0.3)
  button-secondary:
    backgroundColor: rgba(123, 28, 46, 0.1)
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
    height: 48px
    border: 1px solid rgba(123, 28, 46, 0.2)
  button-secondary-hover:
    backgroundColor: rgba(123, 28, 46, 0.15)
    borderColor: rgba(123, 28, 46, 0.3)
  card-standard:
    backgroundColor: rgba(255, 255, 255, 0.45)
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
    boxShadow: "{elevation.md}"
    backdropFilter: blur(8px)
    border: 1px solid rgba(255, 255, 255, 0.6)
  card-elevated:
    backgroundColor: rgba(255, 255, 255, 0.7)
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
    boxShadow: "{elevation.lg}"
    backdropFilter: blur(12px)
    border: 1px solid rgba(255, 255, 255, 0.8)
  card-hover:
    backgroundColor: rgba(255, 255, 255, 0.55)
    boxShadow: 0 8px 24px rgba(0, 0, 0, 0.15)
    transform: translateY(-2px)
    transition: all 240ms ease
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 10px 16px
    height: 40px
    border: 1px solid rgba(123, 28, 46, 0.15)
    boxShadow: 0 1px 3px rgba(0, 0, 0, 0.08)
  input-field-focus:
    borderColor: "{colors.primary}"
    boxShadow: 0 0 0 3px rgba(123, 28, 46, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)
    outline: none
  badge-primary:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 4px 12px
    display: inline-block
  badge-secondary:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 4px 12px
  list-item:
    backgroundColor: transparent
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
    transition: background-color 200ms ease
  list-item-hover:
    backgroundColor: rgba(123, 28, 46, 0.08)
    textColor: "{colors.primary}"
---

## Overview

Beyond Invitation is a premium Indian wedding stationery brand that transforms celebration moments into heirloom-quality keepsakes. The brand serves affluent Indian couples and families seeking bespoke, designer-led invitation experiences across Hindu, Muslim, Christian, and secular ceremonies. The aesthetic is "Opulent Minimalism"—a sophisticated fusion of rich jewel tones (deep burgundy #7b1c2e, warm gold #c9a84c) with refined cream and ivory surfaces, creating an impression of understated luxury and cultural reverence. The visual language evokes the tactile warmth of premium paper stocks, embossed details, and ceremonial craftsmanship, while maintaining a contemporary, digitally-native interface. The UI conveys calm confidence: every interaction feels intentional, every color choice deliberate, every transition smooth and respectful of the user's emotional investment in their celebration.

The brand voice is warm, knowledgeable, and celebratory without being breathless. Tone vocabulary: "bespoke," "heritage," "curated," "artisanal," "timeless." The copy avoids hyperbole and instead anchors itself in craft, cultural authenticity, and the permanence of the printed word. Example sentence in brand voice: "Your invitation is the first chapter of your story—we craft it with the reverence it deserves."

## Colors

The color system centers on a deep burgundy primary (#7b1c2e) paired with warm metallics and creams, evoking Indian wedding aesthetics while maintaining contemporary sophistication. Primary (#7b1c2e) is deployed on all call-to-action buttons, interactive states, and brand-critical elements—it commands attention without aggression, grounding the interface in cultural warmth. Secondary gold (#c9a84c) and tertiary champagne (#d6b36a) provide supporting accents for highlights, badges, and decorative elements, creating a cohesive warm palette. The surface stack ranges from pure white (#ffffff) at the brightest level to warm cream (#fbf7f0) and soft beige (#f7ead6) for container backgrounds, ensuring readability while maintaining the premium, paper-like aesthetic. On-surface text is a deep brown

## Typography

The type system uses Assistant (a geometric, humanist sans-serif) across all scales, creating visual consistency and a contemporary, approachable tone that contrasts beautifully with the opulent color palette. Display (60px, 800 weight, -0.04em tracking) anchors hero sections and major announcements with commanding presence; Headline-lg (40px, 700 weight) structures primary content sections; Headline-md (28px, 700 weight) organizes subsections and card titles. Body-lg (18px, 400 weight, 28px line-height) and Body-md (16px, 400 weight, 24px line-height) provide comfortable reading for product descriptions and long-form content, with generous line-height (1.5–1.75) to enhance legibility on screens. Label-md (14px, 700 weight) and Label-sm (12px, 600 weight, 0.05em tracking) handle UI labels,

## Layout

The layout employs a 12-column fluid grid with a max-width of 1500px, centered on viewport. The page rhythm uses lg spacing (40px) for major section separation, md spacing (24px) for card-to-card gutters and internal padding, and sm spacing (12px) for tighter component groupings. The hero section occupies full viewport height with a split-screen visual treatment: left side features the primary burgundy background with subtle radial grain texture (24px spacing, 1px circles at rgba(230, 201, 122, 0.28)), right side uses a darker carbon tone. A vertical dividing line (1px gradient from gold/50 to transparent) bisects the viewport, creating ceremonial symmetry. Content sections below the fold use 40px top/bottom margins and 24px horizontal gutters on mobile, scaling to 64px margins on desktop.

## Elevation & Depth

Depth is conveyed through a layered glassmorphic system combined with subtle shadows, creating visual hierarchy without harsh contrast. Level 1 (Base): Dynamic background gradient with radial grain texture (background-image: radial-gradient(circle, rgba(230, 201, 122, 0.28) 0 1px, transparent 1.5px), background-size: 24px 24px) and an overlay gradient (background: linear-gradient(to bottom-right, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.15))). Level 2 (Standard Card): backdrop-filter: blur(8px), background: rgba(255, 255, 255, 0.45), border: 1px solid rgba(255, 255, 255, 0.6), box-shadow: 0

## Shapes

The shape philosophy is "Ceremonial Softness"—a deliberate balance between sharp architectural precision and organic approachability. Buttons use full rounding (border-radius: 9999px) to create pill-shaped affordances that feel inviting and premium, echoing the rounded edges of luxury packaging. Cards and containers use xl rounding (1.5rem / 24px) to soften corners while maintaining structural clarity; this radius appears on product cards, modals, and input fields. Inputs and form elements use full rounding (9999px) for text fields and select dropdowns, creating a cohesive, touchable interface

## Components

### Product Cards

Product cards use a compact, Flipkart-inspired shopping layout within the brand's warm palette. Use the shared `ProductCard` for catalogue, collection, wedding-box, search, wishlist, and related-product listings. Preserve page animation hooks on a wrapper when needed.

Cards are an exception to the general glass container treatment: use a white surface, a fine warm border, 12px corners, and a subtle shadow on hover without moving the card. Square ivory image wells preserve the full product photograph. Keep the wishlist heart in the top-right corner; reserve the small gold ribbon for actual catalogue badges.

Keep the information order consistent: category, product name, selling price with valid MRP and discount, per-piece and minimum-order details, then a compact burgundy-accented cart or enquiry action. Use actual catalogue and cart quantity rules; do not invent ratings, delivery promises, or scarcity. Unpriced products show an enquiry action. Use two columns on mobile, 44px touch targets, visible keyboard focus, and reduced-motion support.

### Action Elements

Buttons are the primary interaction pattern. Button-primary uses background: {colors.primary} (#7b1c2e), text-color: {colors.on-primary} (white), typography: {typography.label-md}, rounded: {rounded.full}, padding: 12px 24px, height: 44px. On hover, background shifts to {colors.primary-container} (#85172b) with box-shadow: 0 3px 8px rgba(123, 28, 46, 0.2) and transition: background-color 240ms ease, box-shadow 240ms ease. On active/pressed, background becomes {colors.primary-fixed-dim} (#7b1c2e) with box-shadow: 0 1px 3px rgba(123, 28, 46, 0.3). Button-secondary uses background: rgba(123, 28, 46, 0.1), text-color: {colors.primary}, border: 1px solid rgba(123, 28, 46, 0.2), and on hover, background increases to rgba(123, 28, 46, 0.15) with border-color: rgba(123, 28, 46,

## Do's and Don'ts

**Do**

- Do use the primary burgundy (#7b1c2e) exclusively for CTAs, focus states, and brand-critical interactions—never dilute it with secondary colors on the same button.
- Do maintain at least 24px of white-space around premium product imagery and hero sections to preserve the luxury aesthetic and prevent visual clutter.
- Do apply the full rounding (9999px) consistently to all interactive elements (buttons, inputs, pills) so users intuitively recognize them as tappable.
- Do use the glassmorphic card treatment (backdrop-filter: blur(8px), rgba(255, 255, 255, 0.45)) for all content containers to create depth and visual separation without harsh shadows.
- Do pair warm metallics (gold #c9a84c, champagne #d6b36a) with the burgundy primary for accents and highlights—never use cool grays or blues, which break the warm, ceremonial tone.
- Do animate all state transitions (hover, focus, active) over 240ms using ease timing to create premium, intentional micro-interactions.

**Don't**

- Don't use pure black (#000000) or pure white (#ffffff) for text or backgrounds—always use the warm palette (deep brown #2a1810 for text, cream #fbf7f0 for surfaces) to maintain tonal warmth.
- Don't apply box-shadow values exceeding 0 8px 24px rgba(0, 0, 0, 0.15)—heavy shadows undermine the glassmorphic aesthetic and feel dated.
- Don't mix rounded and sharp corners on related components (e.g., a button with 9999px radius next to a card with 0px radius)—consistency in geometry is essential to brand coherence.
- Don't use the secondary or tertiary colors as primary CTAs—reserve burgundy (#7b1c2e) for all high-priority actions to maintain clear visual hierarchy.
- Don't reduce padding below {spacing.md} (24px) on cards or containers—the brand's luxury positioning demands generous internal breathing room.
- Don't animate transitions faster than 200ms or slower than 400ms—the sweet spot (240ms) feels premium; faster feels jarring, slower feels sluggish.
