import { MarketPanel } from "./MarketPanel.js";
import { OrderTicket } from "./OrderTicket.js";
import { StatusBar } from "./StatusBar.js";

export function SwapPage() {
  return (
    <div className="min-h-screen">
      <StatusBar />
      {/* gap-px over a line-colored surface paints hairline dividers between zones */}
      <div className="grid gap-px bg-line lg:grid-cols-[360px_1fr]">
        <OrderTicket />
        <MarketPanel />
      </div>
    </div>
  );
}
