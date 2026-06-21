import type { ReactNode } from "react";
import { cn } from "./cn.js";

const toneMap = {
  ink: "text-ink",
  up: "text-up",
  down: "text-down",
  brand: "text-brand",
  muted: "text-muted",
} as const;

export interface StatProps {
  label: string;
  value: ReactNode;
  tone?: keyof typeof toneMap;
  className?: string;
}

/** A labelled data point: small uppercase label over a tabular value. */
export function Stat({ label, value, tone = "ink", className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[0.625rem] tracking-[0.18em] text-muted uppercase">
        {label}
      </span>
      <span className={cn("text-[0.8125rem] tabular-nums", toneMap[tone])}>
        {value}
      </span>
    </div>
  );
}
