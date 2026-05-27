"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { Filter, Plus, Receipt } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ExpenseList, TableSkeleton } from "@/components/expense-list";
import {
  ExpenseFilters,
  StatusCountChips,
  getStatusCounts,
  type FilterState,
} from "@/components/expense-filters";
import { dayStringToTs } from "@/lib/format";

export default function MyExpensesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>({
    statuses: [],
    from: "",
    to: "",
  });

  const all = useQuery(api.expenses.listMyExpenses, {});
  const dateFrom = dayStringToTs(filters.from, false);
  const dateTo = dayStringToTs(filters.to, true);
  const filtered = useQuery(api.expenses.listMyExpenses, {
    statuses: filters.statuses.length ? filters.statuses : undefined,
    dateFrom,
    dateTo,
  });

  const goNew = () => router.push("/expenses/new");
  const goDetail = (id: string) => router.push(`/expenses/${id}`);

  const headerNew = (
    <Button onClick={goNew}>
      <Plus size={14} /> New expense
    </Button>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            My Expenses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track your submissions, drafts, and reimbursements.
          </p>
        </div>
        {headerNew}
      </div>

      <div className="mb-3">
        {all ? (
          <StatusCountChips counts={getStatusCounts(all)} />
        ) : (
          <div className="skel h-4 w-80" />
        )}
      </div>

      <div className="mb-5">
        <ExpenseFilters filters={filters} onChange={setFilters} />
      </div>

      {filtered === undefined ? (
        <TableSkeleton rows={5} cols={6} />
      ) : filtered.length === 0 ? (
        all && all.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            body="Start your first expense report. We'll save it as a draft until you submit."
            action={headerNew}
          />
        ) : (
          <EmptyState
            icon={Filter}
            title="No expenses match these filters"
            body="Try clearing filters or expanding your date range."
            action={
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({ statuses: [], from: "", to: "" })
                }
              >
                Clear filters
              </Button>
            }
          />
        )
      ) : (
        <ExpenseList
          expenses={filtered}
          viewerRole="employee"
          onRowClick={goDetail}
        />
      )}
    </div>
  );
}
