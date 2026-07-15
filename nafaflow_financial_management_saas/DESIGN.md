---
name: NafaFlow Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4a3d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7b6c'
  outline-variant: '#bdcaba'
  surface-tint: '#006e2d'
  primary: '#006b2c'
  on-primary: '#ffffff'
  primary-container: '#00873a'
  on-primary-container: '#f7fff2'
  inverse-primary: '#62df7d'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#535f58'
  on-tertiary: '#ffffff'
  tertiary-container: '#6b7770'
  on-tertiary-container: '#f5fff7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7ffc97'
  primary-fixed-dim: '#62df7d'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d9e6dd'
  tertiary-fixed-dim: '#bdcac1'
  on-tertiary-fixed: '#131e19'
  on-tertiary-fixed-variant: '#3e4943'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-numeric:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is engineered to project a sophisticated, reliable, and hyper-modern financial personality tailored for the West African SME market. The brand narrative centers on "Nafa" (benefit/value), translated visually through a high-efficiency interface that mirrors the precision of tools like Stripe and Linear.

The style is **Corporate / Modern** with a **Minimalist** foundation. It prioritizes clarity and speed of comprehension, using generous white space to reduce cognitive load during complex financial tasks. The aesthetic is professional yet warm, avoiding cold institutional vibes in favor of an approachable, tech-forward partner for business growth.

**Emotional Response:**
- **Confidence:** Stability and security in financial data handling.
- **Clarity:** Transparent reporting and easy navigation.
- **Momentum:** A sense of moving the business forward through modern tools.

## Colors
The palette is dominated by a crisp "Growth Green" that signals prosperity and action. This is balanced by a deep "Midnight Navy" for authoritative typography and navigation elements.

- **Primary (#16A34A):** Used for primary actions, success states, and positive financial trends.
- **Secondary (#0F172A):** Used for main headings and sidebar backgrounds to provide high-contrast grounding.
- **Tertiary (#F0FDF4):** A soft mint tint used for large background sections or highlight containers to maintain the green brand thread without overwhelming the eye.
- **Neutral (#64748B):** A slate grey for secondary text and UI borders.
- **Background:** Strictly off-white (#F8FAFC) to differentiate from the pure white (#FFFFFF) of elevation cards.

## Typography
The typography system uses a functional pairing designed for a SaaS environment. **Hanken Grotesk** provides a sharp, contemporary edge for brand-facing headers. **Inter** handles the heavy lifting of data-dense tables and forms with its exceptional legibility. 

**Special Handling for FCFA:**
All currency amounts must be rendered using **JetBrains Mono** to ensure tabular alignment (monospacing). The "F" suffix or "FCFA" prefix should be weighted slightly lighter than the numeric value to maintain visual hierarchy.

## Layout & Spacing
This design system utilizes a **Fixed Grid** philosophy for the main content area to ensure financial reports maintain a consistent, readable width on ultra-wide monitors.

- **Desktop:** 12-column grid with 24px gutters. A side-navigation bar (280px) is fixed to the left.
- **Tablet:** 8-column grid. The sidebar collapses into a hamburger menu.
- **Mobile:** 4-column grid with 16px margins. 
- **Density:** Use "Comfortable" spacing for dashboards (16px - 24px gaps) and "Compact" spacing for data tables (8px - 12px vertical padding) to maximize information density where it matters most.

## Elevation & Depth
Depth is achieved through **Tonal Layers** and **Ambient Shadows**. We avoid heavy skueomorphism in favor of a "Layered Flat" look.

- **Surface Level (0):** The app background (#F8FAFC).
- **Surface Level (1):** Primary content cards. These use a pure white background (#FFFFFF) with a very soft, diffused shadow: `0px 4px 12px rgba(15, 23, 42, 0.03)`.
- **Surface Level (2):** Modals and dropdowns. These use a slightly more pronounced shadow: `0px 8px 24px rgba(15, 23, 42, 0.08)` to indicate they are "floating" above the workspace.
- **Interaction:** On hover, cards may lift slightly (increase shadow spread) to provide tactile feedback.

## Shapes
The shape language is **Rounded**, striking a balance between the clinical sharpness of legacy banking software and the overly "bubbly" nature of consumer apps. 

- **Standard Buttons & Inputs:** 8px (0.5rem) corner radius.
- **Cards & Containers:** 16px (1rem) corner radius to create a soft, modern frame for data.
- **Status Chips:** Full-pill (999px) for quick identification.
- **Focus States:** A 2px solid stroke in Primary Green with a 4px offset to ensure accessibility and professional polish.

## Components

### Buttons
- **Primary:** Solid Primary Green with White text. Bold weight.
- **Secondary:** Ghost style with a Slate Grey border (#E2E8F0) and Navy text.
- **Tertiary:** Transparent background with Green text for low-priority actions.

### Input Fields
Inputs must have a clear label above the field. Use a 1px border (#E2E8F0) that transitions to Primary Green on focus. Error states use a soft red (#EF4444) border and a sub-text hint.

### Financial Cards
Summary cards (e.g., "Total Revenue") should feature a small sparkline chart (1:4 aspect ratio) in the bottom right corner and a percentage change indicator (Pill-shaped chip).

### Data Tables
Tables are the heart of the system. 
- **Header:** Light grey background (#F1F5F9), uppercase bold text, 12px size.
- **Rows:** 1px bottom border only (#F1F5F9). No vertical lines.
- **Alignment:** Text to the left, currency (FCFA) to the right.

### Navigation Sidebar
Dark theme (#0F172A). Active links should be highlighted with a Primary Green left-border "indicator" and a subtle background tint change. Icons should be stroke-based (2px weight) for a clean, Linear-inspired look.