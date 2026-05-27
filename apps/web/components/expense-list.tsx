"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import {
  categoriesColText,
  expenseTotal,
  formatDate,
  formatMoney,
  getInitials,
  type Status,
} from "@/lib/format";

interface ExpenseRow {
  _id: string;
  status: Status;
  summary: string;
  currency: string;
  expenseDate: number;
  merchant?: string;
  submittedAt?: number;
  rejectedByRole?: "manager" | "finance";
  lines: Array<{
    description: string;
    category?: string;
    quantity: number;
    unitAmount: number;
  }>;
  submitter?: { displayName: string };
}

interface ExpenseListProps<T extends ExpenseRow> {
  expenses: T[];
  viewerRole: "employee" | "manager" | "finance";
  onRowClick: (id: string) => void;
}

export function ExpenseList<T extends ExpenseRow>({
  expenses,
  viewerRole,
  onRowClick,
}: ExpenseListProps<T>) {
  const showEmployeeColumn = viewerRole !== "employee";

  return (
    <>
      {/* Mobile: card list (visible <md). Each row collapses into a
          self-contained card so no horizontal scrolling is needed. */}
      <div className="md:hidden rounded-md border border-border overflow-hidden divide-y divide-border">
        {expenses.map((e) => {
          const total = formatMoney(expenseTotal(e), e.currency);
          const dateLabel =
            viewerRole === "employee"
              ? formatDate(e.expenseDate)
              : formatDate(e.submittedAt);
          const cats = categoriesColText(e);
          return (
            <button
              key={e._id}
              type="button"
              onClick={() => onRowClick(e._id)}
              className="flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
            >
              {/* Top: status + total. The two pieces of info you'd
                  scan for first on a queue/inbox. */}
              <div className="flex items-start justify-between gap-3">
                <StatusBadge
                  status={e.status}
                  rejectedByRole={e.rejectedByRole}
                />
                <div className="shrink-0 text-base font-semibold tabular-nums">
                  {total}
                </div>
              </div>

              {/* Summary */}
              <div className="font-medium leading-snug">
                {e.summary || (
                  <span className="italic text-muted-foreground">
                    Untitled draft
                  </span>
                )}
              </div>

              {/* Meta row: employee (if applicable) · date · merchant */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {showEmployeeColumn && e.submitter && (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-medium text-foreground">
                        {getInitials(e.submitter.displayName)}
                      </span>
                      <span className="text-foreground">
                        {e.submitter.displayName}
                      </span>
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                  </>
                )}
                <span className="whitespace-nowrap">{dateLabel}</span>
                {e.merchant && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="truncate">{e.merchant}</span>
                  </>
                )}
              </div>

              {/* Categories breakdown — soft separator since this is
                  derived/secondary info. Hidden when there are no lines. */}
              {cats && (
                <div className="mt-0.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  {cats}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop: original table (visible ≥md). */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {viewerRole === "employee" ? (
                <TableHead>Date</TableHead>
              ) : (
                <TableHead>Submitted</TableHead>
              )}
              {showEmployeeColumn && <TableHead>Employee</TableHead>}
              <TableHead>Summary</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e._id} onClick={() => onRowClick(e._id)}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {viewerRole === "employee"
                    ? formatDate(e.expenseDate)
                    : formatDate(e.submittedAt)}
                </TableCell>
                {showEmployeeColumn && (
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">
                        {getInitials(e.submitter?.displayName ?? "Unknown")}
                      </span>
                      <span>{e.submitter?.displayName ?? "Unknown"}</span>
                    </div>
                  </TableCell>
                )}
                <TableCell className="max-w-[280px]">
                  <div className="truncate font-medium">
                    {e.summary || (
                      <span className="text-muted-foreground italic">
                        Untitled draft
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {e.merchant || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[280px]">
                  <div className="truncate">{categoriesColText(e)}</div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(expenseTotal(e), e.currency)}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={e.status}
                    rejectedByRole={e.rejectedByRole}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 5, cols = 6 }: TableSkeletonProps) {
  return (
    <>
      {/* Mobile skeleton: card-shaped placeholders matching the
          mobile card layout. */}
      <div className="md:hidden rounded-md border border-border overflow-hidden divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="skel h-5 w-28 rounded-md" />
              <div className="skel h-5 w-20" />
            </div>
            <div className="skel h-4 w-3/4" />
            <div className="skel h-3 w-1/2" />
          </div>
        ))}
      </div>

      {/* Desktop skeleton: original grid placeholders. */}
      <div className="hidden md:block rounded-md border border-border overflow-hidden">
        <div className="bg-muted/40 h-10 border-b border-border" />
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="grid items-center px-4 py-3 gap-4"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {Array.from({ length: cols }).map((__, j) => (
                <div
                  key={j}
                  className={`skel h-4 ${j === cols - 1 ? "w-16" : "w-3/4"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
