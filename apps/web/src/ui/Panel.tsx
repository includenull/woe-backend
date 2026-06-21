import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** apply the standard inner padding (default true) */
  inset?: boolean;
}

/** Bordered surface container. The base building block of the Terminal layout. */
export function Panel({ className, inset = true, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-line bg-surface",
        inset && "p-3",
        className,
      )}
      {...props}
    />
  );
}
