import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.js";

const button = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-sm font-bold transition-[transform,background-color,border-color,color,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.99]",
  {
    variants: {
      intent: {
        primary: "bg-brand text-black hover:brightness-110",
        secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
        ghost: "text-muted hover:text-ink",
      },
      size: {
        sm: "px-2 py-1 text-[0.7rem]",
        md: "px-3 py-2 text-sm",
        block: "w-full py-3 text-sm tracking-[0.18em] uppercase",
      },
    },
    defaultVariants: { intent: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export function Button({ className, intent, size, ...props }: ButtonProps) {
  return (
    <button className={cn(button({ intent, size }), className)} {...props} />
  );
}
