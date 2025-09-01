# Better Endeavors — Tip Calculator

A fast, accessible, and brand-consistent tip calculator for **Better Endeavors LLC** (co-founders: Trevyn Sanders & Anthony “Tony” Dries Jr.). Built with plain HTML, CSS, and JavaScript — zero dependencies. Mobile-first, keyboard-friendly, and tuned for Lighthouse 95+/100+.

---

## Features

- **Bill input** with locale-aware currency formatting (graceful fallback).
- **Tip selection**: 10%, 15%, 18%, 20%, 22% presets + **Custom**.
- **Split** by 1–20 people with stepper buttons and keyboard support.
- **Tax**: optional % (default `0`), with **Include tax in tip?** toggle.
- **Service charge**: optional % with **Apply service charge?** toggle.
- **Rounding modes**:  
  - **No rounding** (raw)  
  - **Round tip** (tip to nearest cent; totals updated)  
  - **Round total/person** (per-person to nearest cent; group total adjusted; shows **rounding delta**)
- **Live results**: tip amount, total, per-person tip, per-person total.
- **Effective tip %** label (educational: vs bill-only and vs chosen base).
- **Real-time validation** + inline helper text + screen reader announcements.
- **Quick Reset** and **Copy breakdown** (clipboard).
- **Persistence**: keeps your last settings in `localStorage`; bill clears on reload.
- **Light/Dark** auto theme via `prefers-color-scheme`.

---

## Screenshots (paths)
- App UI (light): `assets/og-image.png`
- Logo mark: `assets/logo.svg`
- Favicons: `icons/favicon.svg`, `icons/favicon.ico`

> `assets/og-image.png` is a small placeholder you can swap for a real 1200×630 Open Graph image later.

---

## Brand Palette

| Token                    | HEX      | HSL (approx)      | Usage                                   | AA Contrast (examples) |
|--------------------------|----------|-------------------|-----------------------------------------|-------------------------|
| `--color-primary`        | `#162B51`| `hsl(216,56%,20%)`| Headers, primary buttons, focus outline? | On `#E9EEF7` ≈ **9.5:1** |
| `--color-secondary`      | `#2E6EBE`| `hsl(213,61%,46%)`| Links, secondary accents                 | On `#E9EEF7` ≈ **5.7:1** |
| `--color-accent`         | `#00BFA6`| `hsl(171,100%,37%)`| CTAs/success, focus ring                 | On `#0E1420` ≈ **4.9:1** |
| `--color-text`           | `#0E1420`| `hsl(219,39%,9%)` | Body text                                | On `#FFFFFF` ≈ **14:1**  |
| `--color-bg`             | `#FFFFFF`| `hsl(0,0%,100%)`  | Page background                          | —                       |
| `--color-surface`        | `#E9EEF7`| `hsl(219,58%,93%)`| Panels, inputs                           | On text `#162B51` **9.5:1** |
| `--color-neutral-700`    | `#1B2433`| `hsl(219,30%,16%)`| Dark UI elements                         | On `#E9EEF7` **11+:1**  |
| `--color-neutral-500`    | `#3D4A61`| `hsl(219,23%,31%)`| Muted text, borders                      | On `#FFFFFF` **7+:1**   |
| `--color-neutral-300`    | `#8EA0BF`| `hsl(218,26%,65%)`| Subtle borders, meta text                | On `#0E1420` **5+:1**   |
| `--color-error`          | `#C0392B`| `hsl(6,63%,47%)`  | Validation errors                        | On `#FFFFFF` **5+:1**   |

**Focus ring**: 2px outline `#00BFA6` with `outline-offset: 2px`.

> Ratios are approximate; all body text and controls meet or exceed WCAG **AA (≥4.5:1)**.

---

## Quick Start

1. Copy files into a folder named `tip-calculator/` (see repo tree below).
2. Open `index.html` in a browser **or** run a tiny server:
   ```bash
   # Python 3
   python -m http.server
   # then visit http://localhost:8000
