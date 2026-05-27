"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ArrowLeft,
  Info,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  ExpenseForm,
  formValueFromServer,
  type FormValue,
} from "@/components/expense-form";
import { ApproverActionBar } from "@/components/approver-action-bar";
import { HistoryTimeline } from "@/components/history-timeline";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  expenseTotal,
  formatDateTime,
  formatMoney,
  timeAgo,
} from "@/lib/format";

export default function ManagerExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <UnauthorizedView error={error} reset={reset} />
      )}
    >
      <ManagerDetailInner expenseId={id as Id<"expenses">} />
    </ErrorBoundary>
  );
}

function UnauthorizedView({ error }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <EmptyState
        icon={TriangleAlert}
        title="Not authorized"
        body={
          error.message.toLowerCase().includes("forbidden")
            ? "This expense isn't from one of your direct reports."
            : "Couldn't load this expense."
        }
        action={
          <Button variant="outline" onClick={() => router.push("/review")}>
            <ArrowLeft size={14} /> Back to Review
          </Button>
        }
      />
    </div>
  );
}

function ManagerDetailInner({ expenseId }: { expenseId: Id<"expenses"> }) {
  const router = useRouter();
  const expense = useQuery(api.expenses.getExpense, { expenseId });
  const managerApprove = useMutation(api.expenses.managerApprove);
  const managerReject = useMutation(api.expenses.managerReject);

  const [form, setForm] = useState<FormValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  useEffect(() => {
    if (!expense) return;
    if (seededFor === expense._id) return;
    setForm(formValueFromServer(expense));
    setSeededFor(expense._id);
  }, [expense, seededFor]);

  const handleApprove = useCallback(
    async (note: string | undefined) => {
      if (!expense) return;
      setSubmitting(true);
      try {
        await managerApprove({ expenseId: expense._id, note });
        toast.success(
          "Approved at the manager step. Now awaiting finance review.",
        );
      } catch (err) {
        const msg =
          err instanceof ConvexError ? String(err.data) : "Could not approve.";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [expense, managerApprove],
  );

  const handleReject = useCallback(
    async (reason: string) => {
      if (!expense) return;
      setSubmitting(true);
      try {
        await managerReject({ expenseId: expense._id, reason });
        toast.success("Expense rejected. The employee will see your reason.");
      } catch (err) {
        const msg =
          err instanceof ConvexError ? String(err.data) : "Could not reject.";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [expense, managerReject],
  );

  if (expense === undefined || form === null) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="skel h-8 w-40 mb-4" />
        <div className="skel h-48 w-full mb-4" />
        <div className="skel h-24 w-full" />
      </div>
    );
  }

  if (expense === null) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <EmptyState
          icon={TriangleAlert}
          title="Expense not found"
          body="It may have been discarded."
          action={
            <Button variant="outline" onClick={() => router.push("/review")}>
              <ArrowLeft size={14} /> Back to Review
            </Button>
          }
        />
      </div>
    );
  }

  const canAct = expense.status === "pending_manager";
  const movedPast =
    expense.status === "pending_finance" ||
    expense.status === "approved" ||
    (expense.status === "rejected" &&
      expense.rejectedByRole === "finance");

  const displayAmount = formatMoney(expenseTotal(expense), expense.currency);
  const lineCount = expense.lines.length;

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
        <button
          onClick={() => router.push("/review")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={14} /> Back to Review
        </button>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-y-3 sm:gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight md:truncate">
                {expense.summary || (
                  <span className="text-muted-foreground italic">
                    Untitled draft
                  </span>
                )}
              </h1>
              <StatusBadge
                status={expense.status}
                rejectedByRole={expense.rejectedByRole}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Submitted by{" "}
              <span className="font-medium text-foreground">
                {expense.submitter.displayName}
              </span>
              {expense.submittedAt && (
                <>
                  {" · "}
                  <span title={formatDateTime(expense.submittedAt)}>
                    {timeAgo(expense.submittedAt)}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="sm:text-right shrink-0">
            <div className="text-2xl font-semibold tabular-nums leading-none">
              {displayAmount}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </div>
          </div>
        </div>

        {movedPast && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 shrink-0">
              <Info size={16} />
            </div>
            <div className="text-sm">
              <div className="font-semibold text-blue-900">
                This expense has moved past your review stage.
              </div>
              <div className="text-blue-800/80 mt-0.5">
                {expense.status === "pending_finance" &&
                  "It's now awaiting finance review."}
                {expense.status === "approved" &&
                  "It was approved by finance."}
                {expense.status === "rejected" &&
                  expense.rejectedByRole === "finance" &&
                  "It was rejected by finance."}
              </div>
            </div>
          </div>
        )}

        {expense.status === "rejected" &&
          expense.rejectedByRole === "manager" && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
                <XCircle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-destructive">
                  Rejected at manager review
                </div>
                {expense.rejectionReason && (
                  <blockquote className="mt-1 text-sm text-foreground border-l-2 border-destructive/40 pl-3">
                    {expense.rejectionReason}
                  </blockquote>
                )}
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-6">
          <div className="space-y-6">
            <ExpenseForm
              expenseId={expense._id}
              value={form}
              onChange={setForm}
              disabled
              serverParent={{
                summary: expense.summary,
                currency: expense.currency,
                expenseDate: expense.expenseDate,
                merchant: expense.merchant,
                receiptStorageId: expense.receiptStorageId,
              }}
            />
          </div>
          <aside>
            <Card>
              <CardContent className="pt-6">
                <HistoryTimeline expenseId={expense._id} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <ApproverActionBar
        role="manager"
        canAct={canAct}
        hint={
          movedPast
            ? "Already past your review stage."
            : expense.status === "rejected"
              ? "This expense was rejected."
              : expense.status === "draft"
                ? "Not yet submitted."
                : undefined
        }
        displayAmount={displayAmount}
        lineCount={lineCount}
        onApprove={handleApprove}
        onReject={handleReject}
        submitting={submitting}
      />
    </>
  );
}

