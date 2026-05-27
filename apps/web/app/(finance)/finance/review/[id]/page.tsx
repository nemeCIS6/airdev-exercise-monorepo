"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ArrowLeft,
  CheckCircle2,
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
  formatDate,
  formatDateTime,
  formatMoney,
  timeAgo,
} from "@/lib/format";

export default function FinanceExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ErrorBoundary
      fallback={(error) => <UnauthorizedView error={error} />}
    >
      <FinanceDetailInner expenseId={id as Id<"expenses">} />
    </ErrorBoundary>
  );
}

function UnauthorizedView({ error }: { error: Error }) {
  const router = useRouter();
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load this expense"
        body={
          error.message.toLowerCase().includes("forbidden")
            ? "You don't have access to this expense."
            : "Try again in a moment."
        }
        action={
          <Button
            variant="outline"
            onClick={() => router.push("/finance/review")}
          >
            <ArrowLeft size={14} /> Back to Review
          </Button>
        }
      />
    </div>
  );
}

function FinanceDetailInner({ expenseId }: { expenseId: Id<"expenses"> }) {
  const router = useRouter();
  const expense = useQuery(api.expenses.getExpense, { expenseId });
  const events = useQuery(api.events.listEventsForExpense, { expenseId });
  const financeApprove = useMutation(api.expenses.financeApprove);
  const financeReject = useMutation(api.expenses.financeReject);

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
        await financeApprove({ expenseId: expense._id, note });
        toast.success("Approved. Cleared for reimbursement.");
      } catch (err) {
        const msg =
          err instanceof ConvexError ? String(err.data) : "Could not approve.";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [expense, financeApprove],
  );

  const handleReject = useCallback(
    async (reason: string) => {
      if (!expense) return;
      setSubmitting(true);
      try {
        await financeReject({ expenseId: expense._id, reason });
        toast.success("Expense rejected. The employee will see your reason.");
      } catch (err) {
        const msg =
          err instanceof ConvexError ? String(err.data) : "Could not reject.";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [expense, financeReject],
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
            <Button
              variant="outline"
              onClick={() => router.push("/finance/review")}
            >
              <ArrowLeft size={14} /> Back to Review
            </Button>
          }
        />
      </div>
    );
  }

  const canAct = expense.status === "pending_finance";
  const showManagerSummary =
    expense.status === "pending_finance" ||
    expense.status === "approved" ||
    (expense.status === "rejected" && expense.rejectedByRole === "finance");

  // Find the manager_approved event to pull actor displayName + note.
  const managerApprovedEvent = events?.find(
    (e) => e.eventType === "manager_approved",
  );

  const displayAmount = formatMoney(expenseTotal(expense), expense.currency);
  const lineCount = expense.lines.length;

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
        <button
          onClick={() => router.push("/finance/review")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={14} /> Back to Review
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
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
                    Submitted {timeAgo(expense.submittedAt)}
                  </span>
                </>
              )}
              {expense.managerDecidedAt && (
                <>
                  {" · "}
                  <span title={formatDateTime(expense.managerDecidedAt)}>
                    Manager approved {timeAgo(expense.managerDecidedAt)}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-semibold tabular-nums leading-none">
              {displayAmount}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </div>
          </div>
        </div>

        {showManagerSummary && managerApprovedEvent && (
          <div className="mt-4 rounded-md border border-green-200 bg-green-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-green-900">
                  Manager review
                </div>
                <div className="text-sm text-green-900/80 mt-0.5">
                  Approved by{" "}
                  <span className="font-medium text-green-900">
                    {managerApprovedEvent.actor?.displayName ?? "their manager"}
                  </span>{" "}
                  on{" "}
                  <span title={formatDateTime(managerApprovedEvent.timestamp)}>
                    {formatDate(managerApprovedEvent.timestamp)}
                  </span>
                </div>
                {managerApprovedEvent.note && (
                  <blockquote className="mt-2 rounded-md border-l-2 border-green-300/60 bg-white/60 px-3 py-2 text-sm text-green-950">
                    {managerApprovedEvent.note}
                  </blockquote>
                )}
              </div>
            </div>
          </div>
        )}

        {expense.status === "rejected" &&
          expense.rejectedByRole === "finance" && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
                <XCircle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-destructive">
                  Rejected at finance review
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
        role="finance"
        canAct={canAct}
        hint={
          expense.status === "approved"
            ? "Already approved."
            : expense.status === "rejected"
              ? "This expense was rejected."
              : expense.status === "pending_manager"
                ? "Waiting on manager review first."
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
