"use client";

import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover } from "@/components/ui/popover";
import type { Status } from "@/lib/format";

export interface FilterState {
  statuses: Status[];
  from: string;
  to: string;
}

interface ExpenseFiltersProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  /** Defaults applied when "Clear filters" is clicked. */
  statusDefault?: Status[];
  /** Hide the status filter entirely (review queues are status-locked). */
  hideStatusFilter?: boolean;
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending_manager", label: "Pending Manager" },
  { value: "pending_finance", label: "Pending Finance" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function ExpenseFilters({
  filters,
  onChange,
  statusDefault,
  hideStatusFilter,
}: ExpenseFiltersProps) {
  const update = (patch: Partial<FilterState>) =>
    onChange({ ...filters, ...patch });
  const cleared =
    filters.statuses.length === 0 && !filters.from && !filters.to;

  return (
    <div className="flex flex-wrap items-end gap-2">
      {!hideStatusFilter && (
        <MultiCheckPopover
          label="Status"
          values={filters.statuses}
          options={STATUS_OPTIONS}
          onChange={(v) => update({ statuses: v })}
        />
      )}
      <div className="flex w-full sm:w-auto min-w-0 items-center gap-2">
        <Label className="text-muted-foreground text-xs whitespace-nowrap">
          From
        </Label>
        <Input
          type="date"
          value={filters.from || ""}
          onChange={(e) => update({ from: e.target.value })}
          className="h-9 min-w-0 flex-1 sm:flex-none sm:w-[150px]"
        />
        <Label className="text-muted-foreground text-xs">To</Label>
        <Input
          type="date"
          value={filters.to || ""}
          onChange={(e) => update({ to: e.target.value })}
          className="h-9 min-w-0 flex-1 sm:flex-none sm:w-[150px]"
        />
      </div>
      {!cleared && (
        <button
          type="button"
          onClick={() =>
            onChange({ statuses: statusDefault ?? [], from: "", to: "" })
          }
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

interface MultiCheckPopoverProps<T extends string> {
  label: string;
  values: T[];
  options: { value: T; label: string }[];
  onChange: (next: T[]) => void;
  allLabel?: string;
}

function MultiCheckPopover<T extends string>({
  label,
  values,
  options,
  onChange,
  allLabel = "All",
}: MultiCheckPopoverProps<T>) {
  const summary =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? values[0])
        : `${values.length} selected`;
  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <Popover
      trigger={
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-accent"
        >
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium">{summary}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      }
    >
      <div className="flex flex-col gap-2 min-w-[180px]">
        <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border mb-1">
          <span>{label}</span>
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        {options.map((o) => (
          <Checkbox
            key={o.value}
            id={`f_${label}_${o.value}`}
            checked={values.includes(o.value)}
            onChange={() => toggle(o.value)}
            label={o.label}
          />
        ))}
      </div>
    </Popover>
  );
}

interface StatusCountChipsProps {
  counts: Record<Status, number>;
}

const CHIP_STYLES: Record<Status, string> = {
  draft: "border-border bg-secondary text-secondary-foreground",
  pending_manager: "border-yellow-500/40 bg-yellow-50/60 text-yellow-800",
  pending_finance: "border-blue-400/50 bg-blue-50 text-blue-800",
  approved: "border-green-300 bg-green-100 text-green-800",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

const CHIP_LABEL: Record<Status, string> = {
  draft: "Drafts",
  pending_manager: "Pending Manager",
  pending_finance: "Pending Finance",
  approved: "Approved",
  rejected: "Rejected",
};

export function StatusCountChips({ counts }: StatusCountChipsProps) {
  const order: Status[] = [
    "draft",
    "pending_manager",
    "pending_finance",
    "approved",
    "rejected",
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {order.map((s) => {
        const n = counts[s];
        return (
          <span
            key={s}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${CHIP_STYLES[s]} ${n === 0 ? "opacity-50" : ""}`}
          >
            {CHIP_LABEL[s]}
            <span className="font-semibold tabular-nums">{n}</span>
          </span>
        );
      })}
    </div>
  );
}

export function getStatusCounts<T extends { status: Status }>(
  expenses: T[],
): Record<Status, number> {
  return {
    draft: expenses.filter((e) => e.status === "draft").length,
    pending_manager: expenses.filter((e) => e.status === "pending_manager")
      .length,
    pending_finance: expenses.filter((e) => e.status === "pending_finance")
      .length,
    approved: expenses.filter((e) => e.status === "approved").length,
    rejected: expenses.filter((e) => e.status === "rejected").length,
  };
}
