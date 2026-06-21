import { useState } from "react";
import { fmt } from "../../lib/format.js";
import { QUICK_AMOUNTS, SWAP } from "../../lib/mock.js";
import {
  AmountField,
  Button,
  Chip,
  Panel,
  SectionLabel,
  Stat,
} from "../../ui/index.js";

export function OrderTicket() {
  const [pct, setPct] = useState<string>("");

  return (
    <section className="flex flex-col gap-px bg-line">
      <div className="bg-bg px-4 py-3">
        <SectionLabel>Order ticket</SectionLabel>
      </div>

      <div className="flex flex-col gap-4 bg-bg px-4 py-5">
        <AmountField
          label="Sell"
          inputId="sell-amount"
          token={SWAP.sell}
          balance={`bal ${fmt(SWAP.sellBalance, 4)} ${SWAP.sell.ticker}`}
          defaultValue="1.00"
          hint={`≈ $${SWAP.sellUsd}`}
        />

        <div className="grid grid-cols-4 gap-1">
          {QUICK_AMOUNTS.map((q) => (
            <Chip key={q} active={pct === q} onClick={() => setPct(q)}>
              {q}
            </Chip>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            aria-label="Switch sell and buy tokens"
            className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-sm text-brand transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            ↓
          </button>
        </div>

        <AmountField
          label="Buy"
          token={SWAP.buy}
          balance={`bal ${fmt(SWAP.buyBalance, 2)} ${SWAP.buy.ticker}`}
          readOnly
          emphasis
          value={fmt(SWAP.buyAmount)}
        />

        <Button size="block" className="mt-1">
          Execute swap
        </Button>

        <Panel className="mt-1 grid grid-cols-2 gap-3">
          <Stat label="Min received" value={fmt(SWAP.minimumReceived)} />
          <Stat label="Rate" value={`${fmt(SWAP.rate)}/${SWAP.sell.ticker}`} />
          <Stat
            label="Price impact"
            value={`${SWAP.priceImpact.toFixed(2)}%`}
            tone="up"
          />
          <Stat label="Slippage" value={`${SWAP.slippage.toFixed(2)}%`} />
          <Stat label="Swap fee" value={`${SWAP.swapFee.toFixed(2)}%`} />
          <Stat
            label="Platform fee"
            value={`${SWAP.platformFee.toFixed(2)}%`}
          />
        </Panel>
      </div>
    </section>
  );
}
