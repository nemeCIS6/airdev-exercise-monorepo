"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  trigger: React.ReactNode;
  children:
    | React.ReactNode
    | ((props: { close: () => void }) => React.ReactNode);
  align?: "start" | "end";
  /** Which side of the trigger to open. Defaults to "bottom". */
  side?: "bottom" | "top";
  className?: string;
}

export function Popover({
  trigger,
  children,
  align = "start",
  side = "bottom",
  className,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-40 min-w-[14rem] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md",
            side === "top" ? "bottom-full mb-1" : "mt-1",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {typeof children === "function"
            ? children({ close: () => setOpen(false) })
            : children}
        </div>
      )}
    </div>
  );
}
