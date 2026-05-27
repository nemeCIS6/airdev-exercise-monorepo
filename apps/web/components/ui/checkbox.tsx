"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  label?: React.ReactNode;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  id,
  label,
  className,
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2 text-sm",
        className,
      )}
    >
      <span
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow",
          checked ? "bg-primary text-primary-foreground" : "bg-background",
        )}
      >
        {checked && <Check size={12} />}
      </span>
      {label && <span className="select-none">{label}</span>}
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
    </label>
  );
}
