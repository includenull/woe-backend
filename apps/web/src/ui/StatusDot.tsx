import { cn } from "./cn.js";

const toneMap = {
  up: "bg-up",
  down: "bg-down",
  brand: "bg-brand",
  muted: "bg-muted",
} as const;

export interface StatusDotProps {
  tone?: keyof typeof toneMap;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({
  tone = "up",
  pulse = true,
  className,
}: StatusDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        toneMap[tone],
        className,
      )}
      style={pulse ? { animation: "woe-pulse-dot 1.6s infinite" } : undefined}
    />
  );
}
