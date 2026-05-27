"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "convex/react";
import { CheckCheck, Filter } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ExpenseList, TableSkeleton } from "@/components/expense-list";
import {
  ExpenseFilters,
  type FilterState,
} from "@/components/expense-filters";
import { dayStringToTs } from "@/lib/format";

export default function FinanceReviewPage() {
  const router = useRouter();
  // Default scope: items awaiting finance sign-off. Clearing the filter
  // widens to the broader finance history (approved + rejected at finance).
  const [filters, setFilters] = useState<FilterState>({
    statuses: ["pending_finance"],
    from: "",
    to: "",
  });

  const dateFrom = dayStringToTs(filters.from, false);
  const dateTo = dayStringToTs(filters.to, true);
  const expenses = useQuery(api.expenses.listExpensesForReview, {
    statuses: filters.statuses.length ? filters.statuses : undefined,
    dateFrom,
    dateTo,
  });

  const goDetail = (id: string) => router.push(`/finance/review/${id}`);

  const pendingCount = (expenses ?? []).filter(
    (e) => e.status === "pending_finance",
  ).length;
  const isDefaultFilter =
    filters.statuses.length === 1 &&
    filters.statuses[0] === "pending_finance" &&
    !filters.from &&
    !filters.to;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Step 2 of approval. Final sign-off on expenses already cleared by
            a manager.
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{pendingCount}</span>{" "}
            awaiting your review
          </div>
        )}
      </div>

      <div className="mb-5">
        <ExpenseFilters
          filters={filters}
          onChange={setFilters}
          statusDefault={["pending_finance"]}
        />
      </div>

      {expenses === undefined ? (
        <TableSkeleton rows={5} cols={7} />
      ) : expenses.length === 0 ? (
        isDefaultFilter ? (
          <EmptyState
            icon={CheckCheck}
            title="Inbox zero"
            body="No expenses are awaiting finance sign-off. New submissions appear here after a manager approves them."
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
                  setFilters({
                    statuses: ["pending_finance"],
                    from: "",
                    to: "",
                  })
                }
              >
                Reset to pending
              </Button>
            }
          />
        )
      ) : (
        <ExpenseList
          expenses={expenses}
          viewerRole="finance"
          onRowClick={goDetail}
        />
      )}
    </div>
  );
}
