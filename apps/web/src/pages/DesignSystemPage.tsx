import { useState } from "react";
import { Link } from "react-router";
import { fmt } from "../lib/format.js";
import { SWAP, TOKENS } from "../lib/mock.js";
import {
  AmountField,
  Badge,
  Button,
  Chip,
  Panel,
  SectionLabel,
  Stat,
  StatusDot,
  TokenSelectButton,
} from "../ui/index.js";
import { colorTokens, typeScale } from "../ui/tokens.js";

function Block({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-line py-8 first:border-t-0">
      <div>
        <SectionLabel>{title}</SectionLabel>
        {caption && (
          <p className="mt-1 max-w-prose text-[0.75rem] text-muted">
            {caption}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Specimen({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.6rem] tracking-[0.18em] text-muted uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function DesignSystemPage() {
  const [chip, setChip] = useState("4H");

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-2.5 text-[0.7rem]">
        <div className="flex items-center gap-2 font-bold tracking-[0.2em] text-white">
          <span className="grid h-5 w-5 place-items-center rounded-sm bg-brand text-[0.7rem] text-black">
            ◆
          </span>
          WAXONEDGE
        </div>
        <span className="text-muted">design system · terminal v0.1</span>
        <Link
          to="/"
          className="ml-auto text-muted transition-colors duration-150 hover:text-ink"
        >
          ← Swap
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <div className="border-b border-line py-10">
          <h1 className="text-2xl font-bold text-white">
            Terminal design system
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Tokens and primitives behind the WaxOnEdge swap interface. Every
            value here is defined once in{" "}
            <span className="text-ink">styles.css</span> and consumed as a
            Tailwind utility, so a single edit re-themes the app.
          </p>
        </div>

        {/* COLOR */}
        <Block
          title="Color tokens"
          caption="Semantic, not literal. Components reference roles (surface, line, brand) so the palette can move without touching markup."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {colorTokens.map((t) => (
              <Panel key={t.key} className="flex items-center gap-3">
                <span
                  className="h-10 w-10 shrink-0 rounded-sm border border-line"
                  style={{ background: t.value }}
                />
                <div className="min-w-0">
                  <div className="text-[0.8125rem] font-medium text-ink">
                    {t.name}
                  </div>
                  <div className="truncate text-[0.65rem] text-muted">
                    {t.value} · {t.usage}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </Block>

        {/* TYPE */}
        <Block
          title="Typography"
          caption="One family does the work: JetBrains Mono for data and UI, Inter as the reading fallback. Hierarchy comes from size and weight, not extra typefaces."
        >
          <Panel className="flex flex-col divide-y divide-line">
            {typeScale.map((t) => (
              <div
                key={t.name}
                className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <span className={t.className}>118,208.7174</span>
                <span className="shrink-0 text-right text-[0.65rem] text-muted">
                  {t.name} · {t.note}
                </span>
              </div>
            ))}
          </Panel>
        </Block>

        {/* BUTTONS */}
        <Block
          title="Buttons"
          caption="Verb + object labels. Primary carries the brand; secondary and ghost recede."
        >
          <Specimen label="Intent">
            <Button intent="primary">Execute swap</Button>
            <Button intent="secondary">Adjust slippage</Button>
            <Button intent="ghost">Reset</Button>
            <Button intent="primary" disabled>
              Disabled
            </Button>
          </Specimen>
          <Specimen label="Size">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
          </Specimen>
          <div className="max-w-xs">
            <Button size="block">Execute swap</Button>
          </div>
        </Block>

        {/* CHIPS */}
        <Block
          title="Chips"
          caption="Segmented toggles for quick-amount and timeframe selection."
        >
          <Specimen label="Timeframe">
            {["15m", "1H", "4H", "1D", "1W"].map((t) => (
              <Chip key={t} active={chip === t} onClick={() => setChip(t)}>
                {t}
              </Chip>
            ))}
          </Specimen>
        </Block>

        {/* BADGES + STATUS */}
        <Block
          title="Badges & status"
          caption="Compact state markers. Color is reinforced by text, never carried alone."
        >
          <Specimen label="Badge">
            <Badge tone="brand">Routed</Badge>
            <Badge tone="neutral">Direct</Badge>
            <Badge tone="up">+1.24%</Badge>
            <Badge tone="down">-1.23%</Badge>
          </Specimen>
          <Specimen label="Status dot">
            <span className="flex items-center gap-1.5 text-[0.7rem] text-muted">
              <StatusDot tone="up" /> Live
            </span>
            <span className="flex items-center gap-1.5 text-[0.7rem] text-muted">
              <StatusDot tone="down" pulse={false} /> Stalled
            </span>
            <span className="flex items-center gap-1.5 text-[0.7rem] text-muted">
              <StatusDot tone="muted" pulse={false} /> Idle
            </span>
          </Specimen>
        </Block>

        {/* DATA */}
        <Block
          title="Data display"
          caption="Stat pairs and token controls, the atoms of the order ticket."
        >
          <Specimen label="Stat">
            <Panel className="grid grid-cols-3 gap-3">
              <Stat label="Min received" value={fmt(SWAP.minimumReceived)} />
              <Stat label="Price impact" value="0.00%" tone="up" />
              <Stat label="Slippage" value="0.50%" />
            </Panel>
          </Specimen>
          <Specimen label="Token select">
            <TokenSelectButton token={TOKENS.LSWAX} />
            <TokenSelectButton token={TOKENS.WUF} />
            <TokenSelectButton token={TOKENS.WAX} />
          </Specimen>
          <Specimen label="Amount field">
            <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
              <AmountField
                label="Sell"
                inputId="ds-sell"
                token={SWAP.sell}
                balance={`bal ${fmt(SWAP.sellBalance, 4)} ${SWAP.sell.ticker}`}
                defaultValue="1.00"
                hint={`≈ $${SWAP.sellUsd}`}
              />
              <AmountField
                label="Buy"
                token={SWAP.buy}
                balance={`bal ${fmt(SWAP.buyBalance, 2)} ${SWAP.buy.ticker}`}
                readOnly
                emphasis
                value={fmt(SWAP.buyAmount)}
              />
            </div>
          </Specimen>
        </Block>

        {/* MOTION */}
        <Block
          title="Motion"
          caption="150ms ease transitions on state changes; a 1.6s pulse marks live data. All of it collapses under prefers-reduced-motion."
        >
          <div className="flex flex-wrap items-center gap-6">
            <span className="flex items-center gap-2 text-[0.75rem] text-muted">
              <StatusDot tone="up" /> pulse-dot · 1.6s
            </span>
            <svg width="120" height="12" aria-hidden>
              <line
                x1="0"
                y1="6"
                x2="120"
                y2="6"
                stroke="var(--color-brand)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                style={{ animation: "woe-flow-dash 1s linear infinite" }}
              />
            </svg>
            <span className="text-[0.75rem] text-muted">
              flow-dash · route lines
            </span>
          </div>
        </Block>
      </main>
    </div>
  );
}
