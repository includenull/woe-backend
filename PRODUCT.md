# Product

## Register

product

## Users

WaxOnEdge is used by WAX blockchain traders who compare and execute swaps through a DEX aggregator. They work in a data-heavy trading context where clarity, speed, and trust matter more than decorative presentation. Many are repeat users who keep the interface open for long sessions and scan it dozens of times an hour.

## Product Purpose

WaxOnEdge aggregates swap routes across WAX liquidity sources so users can find reliable execution paths. Success means routes and market data are fast, correct, and easy to act on: the best path, its price, its liquidity, and its risk are legible at a glance, and execution is one confident action.

## Brand Personality

Precise, resilient, direct. The product should feel operational and trustworthy, like a professional trading terminal rather than a consumer crypto app. Visual decisions support repeated use over first impressions.

## Visual Direction

The committed direction is **Terminal**: a dense, monospace, dark trading desk.

- **Theme:** dark. Traders run long sessions; the near-black canvas keeps signal colors (gains, losses, the selected route) loud and reduces glare.
- **Color strategy:** Restrained. Tinted-neutral surfaces carry the structure; a single lime brand accent marks the primary action, the active control, and the selected route. Up/down green/red are reserved for market direction.
- **Type:** one family does the work (JetBrains Mono for data and UI, Inter as the reading fallback). Hierarchy comes from size and weight, not extra typefaces.
- **Layout:** hairline-divided zones (order ticket, chart, route ledger) rather than floating cards. Density is a feature.

The full token and component spec lives in `DESIGN.md` and is browsable at `/design-system` in the web app.

## Anti-references

Avoid marketing-page composition, decorative dashboards, noisy crypto hype visuals, glassmorphism, gradient text, and any pattern that obscures trade state or route quality. No floating-card grids where a dense table serves better.

## Design Principles

- Performance is visible in the interface: keep surfaces fast to scan and quick to operate.
- Correctness outranks flourish: make important states, data, and failures explicit.
- Use compact hierarchy: prioritize route, price, liquidity, and status information over decoration.
- Preserve confidence: use restrained copy and predictable controls.
- One source of truth for style: every visual value is a design token (see `DESIGN.md`); components consume token utilities, never hard-coded hex.

## Accessibility & Inclusion

Target WCAG AA contrast for text and controls (body text ≥4.5:1, large/bold ≥3:1). Respect `prefers-reduced-motion`. Never rely on color alone for trading states; pair every up/down and routed/unrouted signal with text or shape. All interactive controls expose a visible focus ring.
