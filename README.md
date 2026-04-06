# Exam Percentile Calculator

A fast, single-page web tool for calculating your percentile rank on any exam or test.

## Usage

Open `index.html` directly in a browser — no server or build step required.

Enter three values:

- **Your Score** — the raw score you received
- **Mean or Median** — use the toggle to choose which central statistic you have
- **Standard Deviation** — the spread of the score distribution

Hit **Calculate Percentile** to see your result.

## How It Works

The calculator assumes scores follow an approximately normal distribution and computes:

1. **Z-score** — how many standard deviations your score is from the center  
   `z = (score − mean) / stddev`
2. **Percentile** — the percentage of test-takers you scored above, derived from the standard normal CDF via an Abramowitz & Stegun `erf` approximation (error < 1.5 × 10⁻⁷)

## Features

- Mean/Median toggle — use whichever statistic you have available
- Inline validation with per-field error messages
- Animated percentile display with a human-readable interpretation
- SVG bell curve showing where your score falls, with shaded area and σ tick marks
- Works offline, no dependencies, ~15 KB total

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure and markup |
| `style.css` | All styles (CSS custom properties, transitions, responsive) |
| `script.js` | Calculator logic, validation, and SVG chart renderer |
