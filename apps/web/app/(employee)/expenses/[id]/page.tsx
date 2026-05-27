"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ArrowLeft,
  Pencil,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/empty-state";
import {
  ExpenseForm,
  formValueFromServer,
  isFormDirty,
  linesForServer,
  parentFieldsForServer,
  validateForm,
  type FormErrors,
  type FormValue,
} from "@/components/expense-form";
import type { LineErrors } from "@/components/line-items-section";
import { EmployeeActionBar } from "@/components/employee-action-bar";
import { HistoryTimeline } from "@/components/history-timeline";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  expenseTotal,
  formatDateTime,
  formatMoney,
  timeAgo,
} from "@/lib/format";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function EmployeeExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const expenseId = id as Id<"expenses">;
  const router = useRouter();
  const expense = useQuery(api.expenses.getExpense, { expenseId });

  const saveDraftWithLines = useMutation(api.expenses.saveDraftWithLines);
  const submitExpense = useMutation(api.expenses.submitExpense);
  const withdrawExpense = useMutation(api.expenses.withdrawExpense);
  const resubmitRejected = useMutation(api.expenses.resubmitRejected);
  const discardDraft = useMutation(api.expenses.discardDraft);

  const [form, setForm] = useState<FormValue | null>(null);
  const [editing, setEditing] = useState(false);
  const [errs, setErrs] = useState<FormErrors>({});
  const [lineErrs, setLineErrs] = useState<Record<string, LineErrors>>({});
  const [submitting, setSubmitting] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [askWithdraw, setAskWithdraw] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  useEffect(() => {
    if (!expense) return;
    if (seededFor === expense._id) return;
    setForm(formValueFromServer(expense));
    setEditing(expense.status === "draft");
    setErrs({});
    setLineErrs({});
    setSeededFor(expense._id);
  }, [expense, seededFor]);

  const isDirty = useMemo(() => {
    if (!form || !expense) return false;
    return isFormDirty(form, expense);
  }, [form, expense]);

  useUnsavedChanges(isDirty && editing);

  const handleSaveDraft = useCallback(async () => {
    if (!form || !expense) return;
    setSubmitting(true);
    try {
      await saveDraftWithLines({
        expenseId: expense._id,
        parentFields: parentFieldsForServer(form),
        lines: linesForServer(form),
      });
      setErrs({});
      setLineErrs({});
      toast.success("Draft saved.");
    } catch (err) {
      const msg =
        err instanceof ConvexError ? String(err.data) : "Could not save draft.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [form, expense, saveDraftWithLines]);

  const handleSubmitOrResubmit = useCallback(
    async (kind: "submit" | "resubmit") => {
      if (!form || !expense) return;
      const { errs: e, lineErrs: le } = validateForm(form, {
        hasReceipt: !!expense.receiptStorageId,
      });
      setErrs(e);
      setLineErrs(le);
      if (Object.keys(e).length > 0 || Object.keys(le).length > 0) {
        toast.error("Please fix the highlighted fields.");
        return;
      }
      setSubmitting(true);
      try {
        await saveDraftWithLines({
          expenseId: expense._id,
          parentFields: parentFieldsForServer(form),
          lines: linesForServer(form),
        });
        if (kind === "submit") {
          await submitExpense({ expenseId: expense._id });
          toast.success("Expense submitted for review.");
        } else {
          await resubmitRejected({ expenseId: expense._id });
          toast.success("Expense resubmitted.");
        }
        setEditing(false);
      } catch (err) {
        const msg =
          err instanceof ConvexError ? String(err.data) : "Could not submit.";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [form, expense, saveDraftWithLines, submitExpense, resubmitRejected],
  );

  const handleWithdraw = useCallback(async () => {
    if (!expense) return;
    setSubmitting(true);
    try {
      await withdrawExpense({ expenseId: expense._id });
      // Withdraw transitions the expense back to "draft"; the user
      // almost certainly wants to keep editing, so re-enter edit mode.
      // The seeding effect won't re-run (same expense._id), so we have
      // to flip this flag explicitly.
      setEditing(true);
      setErrs({});
      setLineErrs({});
      toast.info("Expense withdrawn to Draft.");
    } catch (err) {
      const msg =
        err instanceof ConvexError ? String(err.data) : "Could not withdraw.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [expense, withdrawExpense]);

  const handleDiscard = useCallback(async () => {
    if (!expense) return;
    setSubmitting(true);
    try {
      await discardDraft({ expenseId: expense._id });
      toast.info("Draft discarded.");
      router.replace("/expenses");
    } catch (err) {
      const msg =
        err instanceof ConvexError ? String(err.data) : "Could not discard.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [expense, discardDraft, router]);

  const handleStartEditRejected = useCallback(() => {
    setEditing(true);
    if (expense) {
      setForm(formValueFromServer(expense));
    }
    setErrs({});
    setLineErrs({});
  }, [expense]);

  const handleCancelEditRejected = useCallback(() => {
    setEditing(false);
    if (expense) {
      setForm(formValueFromServer(expense));
    }
    setErrs({});
    setLineErrs({});
  }, [expense]);

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
      <div className="max-w-6xl mx-auto px-6 py-8">
        <EmptyState
          icon={TriangleAlert}
          title="Expense not found"
          body="It may have been discarded or you don't have access."
          action={
            <Button
              variant="outline"
              onClick={() => router.push("/expenses")}
            >
              <ArrowLeft size={14} /> Back to My Expenses
            </Button>
          }
        />
      </div>
    );
  }

  const editable =
    expense.status === "draft" || expense.status === "rejected";
  const formDisabled = !(editable && editing);
  const errCount =
    Object.keys(errs).length +
    Object.values(lineErrs).reduce((s, le) => s + Object.keys(le).length, 0);

  const displayTotal =
    editable && editing
      ? form.lines.reduce(
          (s, l) =>
            s +
            (Number.isFinite(l.quantity * l.unitAmount)
              ? l.quantity * l.unitAmount
              : 0),
          0,
        )
      : expenseTotal(expense);
  const displayCurrency = editable && editing ? form.currency : expense.currency;
  const displayAmount = formatMoney(displayTotal, displayCurrency);
  const lineCount = editable && editing ? form.lines.length : expense.lines.length;

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
        <button
          onClick={() => router.push("/expenses")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={14} /> Back to My Expenses
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-tight md:truncate">
                {(editing ? form.summary : expense.summary) || (
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
              {expense.submittedAt ? (
                <>
                  Submitted{" "}
                  <span title={formatDateTime(expense.submittedAt)}>
                    {timeAgo(expense.submittedAt)}
                  </span>
                </>
              ) : (
                <>
                  Created{" "}
                  <span title={formatDateTime(expense._creationTime)}>
                    {timeAgo(expense._creationTime)}
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
              {expense.lines.length}{" "}
              {expense.lines.length === 1 ? "line" : "lines"}
            </div>
          </div>
        </div>

        {expense.status === "rejected" && !editing && (
          <div className="mt-4 mb-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
                <XCircle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-destructive">
                  {expense.rejectedByRole === "finance"
                    ? "Rejected at finance review"
                    : "Rejected by your manager"}
                </div>
                {expense.rejectionReason && (
                  <blockquote className="mt-1 text-sm text-foreground border-l-2 border-destructive/40 pl-3">
                    {expense.rejectionReason}
                  </blockquote>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={handleStartEditRejected}>
                    <Pencil size={13} /> Edit and fix
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editing && errCount > 0 && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">
                There{" "}
                {errCount === 1
                  ? "is 1 issue"
                  : `are ${errCount} issues`}{" "}
                to fix before submitting
              </div>
              <div className="text-xs mt-0.5 opacity-90">
                Required fields and line items are highlighted below.
              </div>
            </div>
          </div>
        )}

        {expense.status === "rejected" && editing && (
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelEditRejected}
            >
              Cancel edit
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-6">
          <div className="space-y-6">
            <ExpenseForm
              expenseId={expense._id}
              value={form}
              onChange={setForm}
              errors={errs}
              lineErrors={lineErrs}
              disabled={formDisabled}
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

      <EmployeeActionBar
        status={expense.status}
        rejectedByRole={expense.rejectedByRole}
        editing={editing}
        isDirty={isDirty}
        displayAmount={displayAmount}
        lineCount={lineCount}
        onSaveDraft={handleSaveDraft}
        onSubmit={() => handleSubmitOrResubmit("submit")}
        onResubmit={() => handleSubmitOrResubmit("resubmit")}
        onDiscard={() => setAskDiscard(true)}
        onWithdraw={() => setAskWithdraw(true)}
        submitting={submitting}
      />

      <AlertDialog
        open={askDiscard}
        onOpenChange={setAskDiscard}
        title="Discard this draft?"
        description="The draft will be permanently deleted. This cannot be undone."
        confirmLabel="Discard draft"
        destructive
        onConfirm={handleDiscard}
      />
      <AlertDialog
        open={askWithdraw}
        onOpenChange={setAskWithdraw}
        title="Withdraw this expense?"
        description="It will return to Draft so you can edit and resubmit. Reviewers will no longer see it."
        confirmLabel="Withdraw"
        onConfirm={handleWithdraw}
      />
    </>
  );
}
