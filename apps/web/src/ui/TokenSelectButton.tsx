import type { Token } from "../lib/mock.js";
import { cn } from "./cn.js";

export interface TokenSelectButtonProps {
  token: Token;
  onClick?: () => void;
  className?: string;
}

/** The coin chip + ticker + chevron control that opens the token picker. */
export function TokenSelectButton({
  token,
  onClick,
  className,
}: TokenSelectButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-sm font-bold text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-4 w-4 rounded-full"
        style={{ background: token.tint }}
      />
      {token.ticker}
      <span className="text-muted">▾</span>
    </button>
  );
}
