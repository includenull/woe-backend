import { useState } from "react";
import { CandleChart } from "../../components/CandleChart.js";
import { fmt, fmtPrice } from "../../lib/format.js";
import { ROUTE_OPTIONS, SWAP, TIMEFRAMES } from "../../lib/mock.js";
import { Badge, Chip, Panel, SectionLabel } from "../../ui/index.js";

const FLOW = ["LSWAX", "WaxFusion", "WAX", "NeftyBlocks", "WUF"];

export function MarketPanel() {
  const [tf, setTf] = useState<string>("4H");
  const total = SWAP.swapFee + SWAP.platformFee;

  return (
    <section className="flex flex-col gap-px bg-line">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 bg-bg px-4 py-3">
        <span className="text-sm font-bold text-white">
          {SWAP.sell.ticker}/{SWAP.buy.ticker}
        </span>
        <span className="text-[0.7rem] text-muted">4H · alcor v2</span>
        <span className="text-[0.7rem] tabular-nums text-muted">
          O <span className="text-ink">0.00000849</span> H{" "}
          <span className="text-ink">0.00000852</span> L{" "}
          <span className="text-ink">0.00000841</span> C{" "}
          <span className="text-down">0.00000848</span>
        </span>
        <span className="text-[0.7rem] tabular-nums text-down">-1.23%</span>
        <div className="ml-auto flex gap-1">
          {TIMEFRAMES.map((t) => (
            <Chip key={t} active={tf === t} onClick={() => setTf(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className="bg-bg px-2 py-2">
        <div className="h-[300px]">
          <CandleChart />
        </div>
      </div>

      <div className="flex-1 bg-bg px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel as="h3">Route ledger</SectionLabel>
          <span className="text-[0.65rem] text-muted">
            3 paths · 1 special pool
          </span>
        </div>

        <Panel className="mb-3 flex flex-wrap items-center gap-2 text-[0.7rem]">
          {FLOW.map((node, i) => (
            <span key={node} className="flex items-center gap-2">
              <span
                className={
                  i % 2 === 0
                    ? "font-bold text-white"
                    : "rounded-sm border border-line px-1.5 py-0.5 text-muted"
                }
              >
                {node}
              </span>
              {i < FLOW.length - 1 && <span className="text-brand">──▸</span>}
            </span>
          ))}
        </Panel>

        <table className="w-full text-left text-[0.72rem] tabular-nums">
          <thead>
            <tr className="text-[0.6rem] tracking-widest text-muted uppercase">
              <th className="pb-2 font-normal">Source</th>
              <th className="pb-2 font-normal">Type</th>
              <th className="pb-2 text-right font-normal">Price</th>
              <th className="pb-2 text-right font-normal">You receive</th>
              <th className="pb-2 text-right font-normal"> </th>
            </tr>
          </thead>
          <tbody>
            {ROUTE_OPTIONS.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2.5 font-medium text-white">
                  {r.exchanges.join(" + ")}
                </td>
                <td className="py-2.5 text-muted">{r.kind}</td>
                <td className="py-2.5 text-right text-ink">
                  {fmtPrice(r.pricePerUnit)}
                </td>
                <td
                  className={`py-2.5 text-right ${r.selected ? "text-brand" : "text-ink"}`}
                >
                  {fmt(r.youReceive)}
                </td>
                <td className="py-2.5 text-right">
                  {r.selected ? (
                    <Badge tone="brand">Routed</Badge>
                  ) : (
                    <span className="text-muted">
                      -{fmt(SWAP.buyAmount - r.youReceive, 0)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-[0.65rem] text-muted">
          Best path saves {fmt(SWAP.buyAmount - ROUTE_OPTIONS[1].youReceive, 0)}{" "}
          {SWAP.buy.ticker} vs. next source · total fees {total.toFixed(2)}%
        </p>
      </div>
    </section>
  );
}
