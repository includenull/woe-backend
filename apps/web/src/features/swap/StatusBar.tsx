import { Link } from "react-router";
import { SWAP } from "../../lib/mock.js";
import { StatusDot } from "../../ui/index.js";

export function StatusBar() {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-2.5 text-[0.7rem]">
      <div className="flex items-center gap-2 font-bold tracking-[0.2em] text-white">
        <span className="grid h-5 w-5 place-items-center rounded-sm bg-brand text-[0.7rem] text-black">
          ◆
        </span>
        WAXONEDGE
      </div>
      <span className="flex items-center gap-1.5 text-muted">
        <StatusDot tone="up" />
        MAINNET · block 412,889,201
      </span>
      <span className="text-muted">latency 38ms</span>
      <span className="text-muted">
        WAX <span className="text-ink">${SWAP.waxPriceUsd.toFixed(4)}</span>
        <span className="text-up"> +1.24%</span>
      </span>
      <div className="ml-auto flex items-center gap-3">
        <span className="rounded-sm border border-line px-2 py-1 text-[0.65rem] tracking-widest text-muted uppercase">
          ⌘K route search
        </span>
        <Link
          to="/design-system"
          className="text-muted transition-colors duration-150 hover:text-ink"
        >
          Design system →
        </Link>
      </div>
    </header>
  );
}
