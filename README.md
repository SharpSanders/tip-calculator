# Tip Calculator

A modern, fully responsive tip calculator built with **HTML, CSS, and vanilla JavaScript**.  
Handles real-world scenarios: tax, service charges, rounding, and per-person splits.

## Live Demo
- https://sharpsanders.github.io/tip-calculator/

![Tip Calculator Screenshot](./img/Screenshot-tip-calculator.png)

---

## Features

### Bill & Tip Management
- Auto-formatted bill input
- Quick-select tip buttons (10%, 15%, 18%, 20%, 22%)
- Custom tip percentage input
- Accurate calculations with rounding options

### Splitting & Rounding Options
- Split totals among **1–20 people**
- Rounding modes:
  - None
  - Round tip
  - Round total
  - Round per person

### Tax & Service Charge Controls
- Add a **sales tax %**
- Option to **include tax in tip calculation**
- Optional **service charge %** (calculated before tip)

### Clean Breakdown Output
- Tip amount, tax amount, service charge, total bill
- Per-person total + full summary that updates live

### Copyable Summary
- “Copy breakdown” button for quickly sharing totals
- Visual feedback on successful copy

### Responsive Dark UI
- Modern dashboard-style interface
- Mobile-first, accessible form controls

---

## Tech Stack
- HTML5
- CSS3
- JavaScript (ES6+)

---

## What I Learned
- Managing UI state updates cleanly with vanilla JS
- Handling rounding modes without drifting totals
- Building reusable calculation helpers and keeping logic separate from DOM updates
- Using the Clipboard API for a smooth “copy summary” UX
- Defensive input handling (empty values, bounds for splits, formatting)

---

## Project Structure
```txt
tip-calculator/
  index.html
  styles.css
  script.js
  img/
    Screenshot-tip-calculator.png
  favicon.ico
  favicon.svg
  logo.svg