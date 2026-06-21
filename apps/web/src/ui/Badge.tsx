import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

const badge = cva(
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[0.6rem] tracking-wider uppercase",
  {
    variants: {
      tone: {
        brand: "bg-brand font-medium text-black",
        neutral: "border border-line text-muted",
        up: "text-up",
        down: "text-down",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
