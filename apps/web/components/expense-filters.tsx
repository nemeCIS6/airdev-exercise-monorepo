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
      <div className="flex items-center gap-2">
        <Label className="text-muted-foreground text-xs whitespace-nowrap">
          From
        </Label>
        <Input
          type="date"
          value={filters.from || ""}
          onChange={(e) => update({ from: e.target.value })}
          className="h-9 w-[150px]"
        />
        <Label className="text-muted-foreground text-xs">To</Label>
        <Input
          type="date"
          value={filters.to || ""}
          onChange={(e) => update({ to: e.target.value })}
          className="h-9 w-[150px]"
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

export function StatusCountChips({ counts }: StatusCountChipsProps) {
  const items: { key: Status; label: string }[] = [
    { key: "draft", label: "Drafts" },
    { key: "pending_manager", label: "Pending Manager" },
    { key: "pending_finance", label: "Pending Finance" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {items.map((it, i) => (
        <span key={it.key} className="flex items-center gap-x-4">
          {i > 0 && <span className="text-muted-foreground/40">·</span>}
          <span className="text-muted-foreground">
            {it.label}:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {counts[it.key]}
            </span>
          </span>
        </span>
      ))}
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
