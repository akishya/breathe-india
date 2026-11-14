---
name: Atmospheric Intelligence Engine
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
  on-surface-variant: '#3e4943'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7a73'
  outline-variant: '#bdc9c1'
  surface-tint: '#006c4e'
  primary: '#005d42'
  on-primary: '#ffffff'
  primary-container: '#047857'
  on-primary-container: '#9ffdd3'
  inverse-primary: '#7bd8b1'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#495167'
  on-tertiary: '#ffffff'
  tertiary-container: '#616980'
  on-tertiary-container: '#e4e9ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#97f5cc'
  primary-fixed-dim: '#7bd8b1'
  on-primary-fixed: '#002115'
  on-primary-fixed-variant: '#00513a'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-metric-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-metric-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-tabular-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
  data-tabular-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-xs:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.25rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers an authoritative, high-integrity environmental intelligence interface engineered for public citizens, environmental researchers, municipal administrators, and policy officials across India. The aesthetic blends the systematic precision of institutional analytics suites with the cognitive clarity of public-service digital infrastructure.

The core visual style is **Corporate / Modern Scientific Analytical**:
- **Clarity Over Embellishment:** High information density without visual noise. Data density is structured through strict tabular grids, scannable typographic hierarchy, and unambiguous metric badging.
- **Institutional Authority:** Grounded in national environmental standards (CPCB guidelines), visual elements project empirical accuracy, scientific reliability, and national scale.
- **Accessible Civic Compassion:** Environmental metrics translate directly into concrete human impact and health recommendations. Complex air dispersion physics and multi-pollutant metrics (PM2.5, PM10, NO2, SO2, CO, O3) are rendered into intuitive semantic tiers.

## Colors

The palette balances clean environmental greens, civic oceanic blues, neutral technical slates, and the calibrated 6-tier India Central Pollution Control Board (CPCB) AQI standard.

### Core Architecture
- **Primary (`#047857` / `#065F46`):** Deep Forest Green. Anchors primary calls to action, active navigation states, certified institutional stamps, and high-level platform status.
- **Secondary (`#0284C7` / `#0369A1`):** Oceanic Tech Blue. Used for telemetry feeds, weather overlays, geospatial layers, multi-pollutant slicers, and interactive chart trends.
- **Tertiary (`#0F172A`):** Deep Midnight Slate. Serves as high-contrast body typography, critical metric readouts, and map overlay chrome.
- **Neutral Canvas (`#F8FAFC`, `#F1F5F9`, `#E2E8F0`):** Crisp, multi-tiered cool slate backgrounds providing high contrast for dense data sets and card groupings.

### CPCB Standard AQI Semantic Tiers
These semantic colors must maintain absolute fidelity to national regulatory standards and must not be used for generic decorative UI states:
- **Good (0–50):** `#16A34A` (Background tint: `#F0FDF4`, Border: `#BBF7D0`)
- **Satisfactory (51–100):** `#65A30D` (Background tint: `#F7FEE7`, Border: `#D9F99D`)
- **Moderate (101–200):** `#CA8A04` (Background tint: `#FEFCE8`, Border: `#FEF08A`)
- **Poor (201–300):** `#EA580C` (Background tint: `#FFF7ED`, Border: `#FED7AA`)
- **Very Poor (301–400):** `#DC2626` (Background tint: `#FEF2F2`, Border: `#FECACA`)
- **Severe (401–500+):** `#7F1D1D` (Background tint: `#450A0A`, Text: `#FFFFFF`, Border: `#991B1B`)

## Typography

The type system pairs **Plus Jakarta Sans** for prominent headers, metric banners, and high-impact values with **Inter** for dense tabular analytics, data slicers, and technical telemetry.

- **Tabular Figures:** Always apply `font-feature-settings: "tnum" 1` across all numerical displays, sensor feeds, timestamps, and geographic coordinates to eliminate jitter during real-time telemetry updates.
- **Bilingual Typographic Harmony (EN/HI):** When toggled to Hindi (Devanagari), use native system fallbacks (Noto Sans Devanagari) matched at proportional scale. Increase line heights by 10-15% for Devanagari script legibility across body and label tokens.
- **Metric Proportions:** Main numerical readouts (AQI index values) are always paired with subordinate unit indicators (`µg/m³`, `ppm`) set in `label-md` or `label-xs` using uppercase styling and subdued slate coloring.

## Layout & Spacing

The layout is built around a structured 12-column analytical dashboard grid optimized for flexible dashboard panel arrangements, spatial heatmaps, and side-by-side KPI monitoring.

### Breakpoint Architecture
- **Mobile (< 640px):** Single-column vertical stream. Global AQI status card anchors the top, followed by horizontal scrollable metric chips and stacked regional stations. Margins are locked to `margin` (`1rem`).
- **Tablet (640px – 1023px):** 6-column grid. KPI metrics split into 2-up or 3-up cards. Sensor maps collapse into a 50vh viewport with modular cards sliding over or stacked below.
- **Desktop (1024px – 1440px):** 12-column grid. Left-hand multi-metric slicers and station lists occupy 3 columns; primary interactive geospatial visualization and longitudinal trends occupy 9 columns.
- **Ultra-Wide (> 1440px):** Max container width capped at `1600px` centered, preserving density and preventing scan lines from stretching excessively.

### Grid Rhythm & Dense Layouts
- Components sit on an 8px base rhythm with 4px sub-increments for tighter metric clusters.
- KPI cards utilize compact vertical paddings (`space-sm` to `space-md`) to ensure critical health advisories and multi-sensor grids fit above the default laptop fold (768px height).

## Elevation & Depth

This system avoids heavy theatrical drop shadows in favor of a low-elevation, high-clarity analytical hierarchy similar to enterprise business intelligence platforms.

### Layering Rules
- **Base Canvas (Level 0):** Pure `#F8FAFC`. Houses background canvas textures and structural section containers.
- **Surface Panels & KPI Tiles (Level 1):** Solid white `#FFFFFF` surface bounded by a crisp 1px neutral border (`#E2E8F0`). Flat elevation with a subtle ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.05)`.
- **Active / Interactive Hover Cards (Level 2):** Subtle elevation shift on interactive hover or selection: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`. Border shifts from `#E2E8F0` to `#CBD5E1`.
- **Floating Overlays & Geospatial Tooltips (Level 3):** Used for live map station inspection overlays, pollutant picker popovers, and sticky advisory ribbons: `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`.
- **Hazard Alerts & Critical Action Triggers (Level 4):** Severe AQI alerts and critical emergency state overlays float above all spatial viewports with a high-contrast 1px border colored by the AQI status tier (e.g., `#991B1B` for Severe).

## Shapes

The interface utilizes a disciplined, structured geometric shape language (`roundedness: 1` — Soft, 0.25rem / 4px base radius) to reflect technical precision, data-density, and institutional credibility.

- **KPI Cards, Analytical Panels, and Map Modals:** Fixed at `0.375rem` (6px) or `0.5rem` (8px). Keeps cards structured without appearing playful or excessively rounded.
- **Metric Badges, Station Status Flags, and Chips:** Set to `0.25rem` (4px) corner radii for a crisp, laboratory-tag appearance.
- **Segmented Controls and Tab Slicers:** Contained in a outer shell with `0.375rem` radius; interior active pills use matching snug radius contours with 2px inner padding.
- **Bilingual Toggles & Verified CPCB Seals:** Circular or softly squared outlines with defined 1px borders to signify certified authenticity.

## Components

### 1. Power BI-Style KPI Cards
- **Structure:** 1px `#E2E8F0` border, white fill, 16px internal padding.
- **Header:** Upper-left metric label in `label-md` Slate-500, top-right telemetry delta (e.g., `+12.4% vs 24h avg` in green or red tabular text).
- **Core Value:** Massive primary readout in `headline-metric-xl`, colored according to the active CPCB AQI status tier or neutral slate.
- **Footer:** Sub-pollutant breakdown bar (PM2.5, PM10, NO2) showing individual health threshold contributions using colored micro-progress bars.

### 2. AQI Category Badges & Color Pointers
- **Style:** Available in solid and tinted variants. Tinted variant pairs a 10% opacity background of the semantic tier with an 800-grade colored text and 1px border.
- **Severe Warning Indicator:** High-contrast maroon background (`#7F1D1D`) with white bold text and an accompanying pulsing dot indicator.

### 3. Multi-Metric Slicers & Time-Series Controls
- **Structure:** Horizontal segmented control strips.
- **Active State:** Clean white card drop-in with soft shadow against a `#F1F5F9` tray, highlighted with a 2px bottom accent in `#0284C7` (Oceanic Tech Blue).
- **Metric Slicers:** Allow rapid toggling between AQI composite, PM2.5, PM10, SO2, Ozone, and Wind Dispersion vectors.

### 4. Bilingual Language Switcher (EN / HI)
- **Visuals:** Dual-segment bordered pill button fixed in the top global utility header.
- **Styling:** Monospaced, high-legibility font representation: `English` | `हिंदी`. The active locale is highlighted with `#047857` primary text and a 1px `#047857` border outline.

### 5. CPCB Verified Data Stamp
- **Visuals:** An institutional certification badge featuring an emblem-style check icon, the "CPCB / SPCB Validated" text mark, and the latest sensor calibration timestamp.
- **Colorway:** Muted Forest Green background (`#F0FDF4`), `#065F46` typography, and `#A7F3D0` bounding border.

### 6. Critical Alert Banners (Air Emergency & Stubble Burning Spikes)
- **Visuals:** Full-width or inline card warning systems that snap to the top viewport when AQI breaches "Very Poor" (>300) or "Severe" (>400).
- **Details:** Bold maroon/red alert badge, bold actionable health warnings (e.g., "N95 Respirators Recommended", "Avoid Morning Outdoor Exertion"), and a direct link to health mitigation protocols.

### 7. Form Controls & Station Search Inputs
- **Inputs:** Minimal slate border (`#CBD5E1`), 8px vertical padding, 12px horizontal padding, with focus rings using a 2px semi-transparent oceanic blue glow (`rgba(2, 132, 199, 0.2)`).
- **Checkboxes & Radios:** Sharp, high-contrast inputs with forest green active fill and crisp white checkmark vectors.