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
  );
}

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export function TableSkeleton({ rows = 5, cols = 6 }: TableSkeletonProps) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
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
  );
}
