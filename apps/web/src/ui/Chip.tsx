import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.js";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Small toggle used in segmented sets: quick-amount and timeframe selectors. */
export function Chip({ active, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-sm border px-2 py-1 text-[0.7rem] tracking-wider transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-line text-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
