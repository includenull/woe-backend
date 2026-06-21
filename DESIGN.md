# Design System — Terminal

The visual system behind the WaxOnEdge web app (`apps/web`). Browse it live at
`/design-system`. This document is the written reference; the running catalog is
the source of truth for appearance.

## Principles

1. **Tokens, not values.** Every color, font, and radius is defined once in
   `apps/web/src/styles.css` (`@theme`) and consumed as a Tailwind utility
   (`bg-surface`, `text-brand`, `border-line`). Markup never carries raw hex.
2. **Density is a feature.** Hairline-divided zones over floating cards. Tabular
   numerals everywhere figures live.
3. **Color reinforced by text.** Trading state is never carried by color alone.
4. **Restrained accent.** The lime brand marks one thing at a time: the primary
   action, the active control, or the selected route.

## Tokens

Defined in `apps/web/src/styles.css`. Mirrored for the catalog in
`apps/web/src/ui/tokens.ts` (keep in sync).

### Color (semantic)

| Token       | Utility key  | Value     | Usage                                  |
| ----------- | ------------ | --------- | -------------------------------------- |
| Background  | `bg`         | `#0a0b0d` | Page canvas                            |
| Surface     | `surface`    | `#101216` | Panels, inputs                         |
| Surface 2   | `surface-2`  | `#15181d` | Raised / hover layer                   |
| Line        | `line`       | `#1d2127` | Borders, hairline dividers             |
| Ink         | `ink`        | `#e6e9ed` | Primary text & values                  |
| Muted       | `muted`      | `#7b828c` | Labels, secondary text                 |
| Brand       | `brand`      | `#c8fa54` | Primary action, active, selected route |
| Up          | `up`         | `#26d07c` | Positive / gains                       |
| Down        | `down`       | `#ff5470` | Negative / losses                      |

`#ffffff` is used directly (`text-white`) for the few headline values that
outrank `ink`.

### Type

- `--font-mono`: **JetBrains Mono** — data, tables, controls, the app shell.
- `--font-sans`: **Inter** — long-form reading fallback.

Hierarchy is size + weight; see the type scale in the catalog. No third family.

### Radii

`--radius-xs: 2px`, `--radius-sm: 4px`, `--radius-md: 6px`. The Terminal runs on
tight corners (`rounded-sm` / `rounded-md`).

### Motion

- `woe-pulse-dot` (1.6s): live-data indicator.
- `woe-flow-dash` (1s): animated route lines.
- State transitions: 150ms.
- All animation collapses under `@media (prefers-reduced-motion: reduce)`.

## Primitives (`apps/web/src/ui`)

Import from the barrel: `import { Button, Panel, ... } from "../ui/index.js"`.

| Component           | Purpose                                              | Key props                          |
| ------------------- | ---------------------------------------------------- | ---------------------------------- |
| `Panel`             | Bordered surface container, the base building block  | `inset`                            |
| `Button`            | Actions                                              | `intent` (primary/secondary/ghost), `size` (sm/md/block) |
| `Chip`              | Segmented toggle (quick-amount, timeframe)           | `active`                           |
| `Badge`             | Compact state marker                                 | `tone` (brand/neutral/up/down)     |
| `StatusDot`         | Live/idle indicator                                  | `tone`, `pulse`                    |
| `Stat`              | Labelled data point (label over tabular value)       | `label`, `value`, `tone`           |
| `SectionLabel`      | Uppercase tracked panel/section heading              | `as`                               |
| `TokenSelectButton` | Coin chip + ticker + chevron picker control          | `token`                            |
| `AmountField`       | Sell input / buy display field                       | `readOnly`, `emphasis`, `hint`     |

`cn()` (clsx + tailwind-merge) is the class-composition helper.

## Structure

```
apps/web/src/
  styles.css                 design tokens (@theme) + keyframes
  ui/                        design-system primitives + tokens mirror
  components/CandleChart.tsx  shared chart (themed via tokens by default)
  lib/                       mock data (mock.ts) + formatters (format.ts)
  features/swap/             the swap surface: SwapPage, StatusBar, OrderTicket, MarketPanel
  pages/DesignSystemPage.tsx  the /design-system catalog
```

## Conventions

- Use token utilities (`bg-surface`, `text-muted`), never inline hex. The only
  inline `style` colors permitted are per-token-instance values like a coin
  chip's `tint` (data, not theme).
- New repeated UI (used 3+ times with one intent) is extracted into `ui/` and
  added to the catalog page.
- Numbers use `tabular-nums`; money/route data flows through `lib/format.ts`.
- Data shown today is mocked (`lib/mock.ts`, LSWAX → WUF) pending the live
  `/swapRoutes` and `/candles` wiring.
