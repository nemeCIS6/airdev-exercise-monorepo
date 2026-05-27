"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CURRENCY_SYMBOL,
  formatMoney,
  lineTotal,
  type Category,
  type Currency,
} from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";

export interface LineLocal {
  clientId: string;
  _id?: Id<"expense_lines">;
  description: string;
  category: Category;
  quantity: number;
  unitAmount: number;
}

export interface LineErrors {
  description?: string;
  category?: string;
  quantity?: string;
  unitAmount?: string;
}

interface LineItemsSectionProps {
  lines: LineLocal[];
  currency: Currency;
  onChange: (next: LineLocal[]) => void;
  errors?: Record<string, LineErrors>;
  disabled?: boolean;
}

export function makeLine(partial: Partial<LineLocal> = {}): LineLocal {
  return {
    clientId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    description: "",
    category: "other",
    quantity: 1,
    unitAmount: 0,
    ...partial,
  };
}

export function LineItemsSection({
  lines,
  currency,
  onChange,
  errors = {},
  disabled,
}: LineItemsSectionProps) {
  const updateLine = (clientId: string, patch: Partial<LineLocal>) =>
    onChange(
      lines.map((l) => (l.clientId === clientId ? { ...l, ...patch } : l)),
    );

  const addLine = () => onChange([...lines, makeLine()]);

  const removeLine = (clientId: string) =>
    onChange(lines.filter((l) => l.clientId !== clientId));

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const canRemove = lines.length > 1;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_140px_80px_120px_110px_36px] gap-2 px-3 py-2 bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border">
        <div>Description</div>
        <div>Category</div>
        <div className="text-right">Qty</div>
        <div className="text-right">Unit</div>
        <div className="text-right">Total</div>
        <div></div>
      </div>

      <div className="divide-y divide-border">
        {lines.map((line) => {
          const err = errors[line.clientId] ?? {};
          return (
            <div
              key={line.clientId}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_80px_120px_110px_36px] gap-2 p-3 items-start"
            >
              <div className="space-y-1">
                <Input
                  placeholder="What was this line for?"
                  value={line.description}
                  onChange={(e) =>
                    updateLine(line.clientId, { description: e.target.value })
                  }
                  disabled={disabled}
                  className={cn(
                    err.description &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {err.description && (
                  <div className="text-xs text-destructive">
                    {err.description}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Select
                  value={line.category}
                  onChange={(v) =>
                    updateLine(line.clientId, { category: v as Category })
                  }
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  placeholder="Category"
                  disabled={disabled}
                />
                {err.category && (
                  <div className="text-xs text-destructive">{err.category}</div>
                )}
              </div>
              <div className="space-y-1">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={Number.isFinite(line.quantity) ? line.quantity : ""}
                  onChange={(e) =>
                    updateLine(line.clientId, {
                      quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={disabled}
                  className={cn(
                    "text-right tabular-nums",
                    err.quantity &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {err.quantity && (
                  <div className="text-xs text-destructive">{err.quantity}</div>
                )}
              </div>
              <div className="space-y-1">
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {CURRENCY_SYMBOL[currency] || ""}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={
                      Number.isFinite(line.unitAmount) ? line.unitAmount : ""
                    }
                    onChange={(e) =>
                      updateLine(line.clientId, {
                        unitAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={disabled}
                    className={cn(
                      "text-right tabular-nums pl-6",
                      err.unitAmount &&
                        "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                </div>
                {err.unitAmount && (
                  <div className="text-xs text-destructive">
                    {err.unitAmount}
                  </div>
                )}
              </div>
              <div className="font-mono tabular-nums text-right text-sm h-9 flex items-center justify-end px-2 text-foreground">
                {formatMoney(lineTotal(line), currency)}
              </div>
              <div className="flex items-center justify-center md:pt-0 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(line.clientId)}
                  disabled={disabled || !canRemove}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                  title={canRemove ? "Remove line" : "At least one line is required"}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-3 border-t border-border bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addLine}
          disabled={disabled}
          className="text-foreground"
        >
          <Plus size={14} /> Add line
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="text-xl font-semibold tabular-nums">
            {formatMoney(grandTotal, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
