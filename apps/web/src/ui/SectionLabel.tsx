import type { ReactNode } from "react";
import { cn } from "./cn.js";

/** Uppercase, wide-tracked heading used as the title of a panel or section. */
export function SectionLabel({
  as: Tag = "h2",
  children,
  className,
}: {
  as?: "h2" | "h3" | "span";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "text-[0.7rem] tracking-[0.22em] text-muted uppercase",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
