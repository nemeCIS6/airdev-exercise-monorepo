"use client";

import { Clock, Repeat, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Status } from "@/lib/format";

interface EmployeeActionBarProps {
  status: Status;
  rejectedByRole?: "manager" | "finance";
  editing: boolean;
  isDirty: boolean;
  displayAmount: string;
  lineCount: number;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onDiscard: () => void;
  onWithdraw: () => void;
  onResubmit: () => void;
  submitting: boolean;
}

export function EmployeeActionBar({
  status,
  editing,
  isDirty,
  displayAmount,
  lineCount,
  onSaveDraft,
  onSubmit,
  onDiscard,
  onWithdraw,
  onResubmit,
  submitting,
}: EmployeeActionBarProps) {
  let leftActions: React.ReactNode = null;
  let actions: React.ReactNode = null;
  let hint: React.ReactNode = null;

  if (status === "draft") {
    leftActions = (
      <Button
        variant="ghost"
        onClick={onDiscard}
        disabled={submitting}
        aria-label="Discard draft"
        title="Discard draft"
        className="w-9 px-0 sm:w-auto sm:px-3 text-muted-foreground hover:text-destructive"
      >
        <Trash2 size={14} />
        <span className="hidden sm:inline">Discard draft</span>
      </Button>
    );
    actions = (
      <>
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={!isDirty || submitting}
        >
          {submitting ? "Saving…" : "Save draft"}
        </Button>
        <Button variant="success" onClick={onSubmit} disabled={submitting}>
          <Send size={14} /> Submit
        </Button>
      </>
    );
  } else if (status === "pending_manager" || status === "pending_finance") {
    hint = (
      <span className="text-xs text-muted-foreground">
        {status === "pending_finance"
          ? "Withdrawing will reset to Draft and undo the manager's approval."
          : "You can withdraw and edit anytime before it's reviewed."}
      </span>
    );
    actions = (
      <Button variant="outline" onClick={onWithdraw} disabled={submitting}>
        <Undo2 size={14} /> Withdraw
      </Button>
    );
  } else if (status === "rejected") {
    if (editing) {
      hint = (
        <span className="text-xs text-muted-foreground hidden md:inline">
          {isDirty
            ? "Resubmitting restarts review at the manager step."
            : "Make a change before resubmitting."}
        </span>
      );
      actions = (
        <Button variant="success" onClick={onResubmit} disabled={submitting}>
          <Repeat size={14} /> Resubmit
        </Button>
      );
    } else {
      hint = (
        <span className="text-sm text-muted-foreground">
          Click <span className="font-medium text-foreground">Edit</span> above
          to address the rejection.
        </span>
      );
    }
  } else if (status === "approved") {
    hint = (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock size={14} className="text-green-700" />
        Approved · read-only
      </div>
    );
  }

  const hasBar = actions !== null || hint !== null || leftActions !== null;
  if (!hasBar) return null;

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.08)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3 py-3">
          {/* Total + secondary leftActions (Discard, etc.). On mobile,
              stacks above the primary actions; on sm+, sits at left. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
            <div className="flex items-end gap-3 min-w-0">
              <div className="text-2xl font-semibold tabular-nums leading-none">
                {displayAmount}
              </div>
              <div className="text-xs text-muted-foreground pb-0.5">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
                {isDirty && (
                  <span className="ml-2 text-amber-700">
                    · Unsaved changes
                  </span>
                )}
              </div>
            </div>
            {leftActions && (
              <div className="flex items-center gap-2 ml-auto sm:ml-1 sm:pl-2 sm:border-l sm:border-border">
                {leftActions}
              </div>
            )}
          </div>
          {/* Primary actions. Full-width buttons on mobile, inline on sm+. */}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto [&>button]:flex-1 sm:[&>button]:flex-none">
            {hint}
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
