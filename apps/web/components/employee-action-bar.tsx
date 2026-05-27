"use client";

import { Clock, MoreVertical, Repeat, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
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
  let actions: React.ReactNode = null;
  let menuItems: { label: string; icon: React.ReactNode; onClick: () => void; destructive?: boolean }[] = [];
  let hint: React.ReactNode = null;

  if (status === "draft") {
    menuItems = [
      {
        label: "Discard draft",
        icon: <Trash2 size={14} />,
        onClick: onDiscard,
        destructive: true,
      },
    ];
    actions = (
      <>
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={!isDirty || submitting}
          className="flex-1 sm:flex-none"
        >
          {submitting ? "Saving…" : "Save draft"}
        </Button>
        <Button
          variant="success"
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 sm:flex-none"
        >
          <Send size={14} /> Submit
        </Button>
      </>
    );
  } else if (status === "pending_manager" || status === "pending_finance") {
    hint = (
      <span className="text-xs text-muted-foreground hidden md:inline">
        {status === "pending_finance"
          ? "Withdrawing will reset to Draft and undo the manager's approval."
          : "You can withdraw and edit anytime before it's reviewed."}
      </span>
    );
    actions = (
      <Button
        variant="outline"
        onClick={onWithdraw}
        disabled={submitting}
        className="flex-1 sm:flex-none"
      >
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
        <Button
          variant="success"
          onClick={onResubmit}
          disabled={submitting}
          className="flex-1 sm:flex-none"
        >
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

  const hasMenu = menuItems.length > 0;
  const hasBar = actions !== null || hint !== null || hasMenu;
  if (!hasBar) return null;

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.08)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 py-3">
          {/* Total + lines (+ unsaved-changes indicator). */}
          <div className="flex items-end gap-3 min-w-0">
            <div className="text-2xl font-semibold tabular-nums leading-none">
              {displayAmount}
            </div>
            <div className="text-xs text-muted-foreground pb-0.5">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
              {isDirty && (
                <span className="ml-2 text-amber-700">· Unsaved changes</span>
              )}
            </div>
          </div>
          {/* Primary actions + overflow menu. Primary buttons take
              flex-1 on mobile so they fill the row; the kebab menu
              stays at its natural icon size. */}
          <div className="flex items-center gap-2 sm:ml-auto">
            {hint}
            {actions}
            {hasMenu && (
              <Popover
                align="end"
                side="top"
                trigger={
                  <Button
                    variant="ghost"
                    aria-label="More actions"
                    title="More actions"
                    className="w-9 px-0 shrink-0 text-muted-foreground"
                  >
                    <MoreVertical size={16} />
                  </Button>
                }
              >
                {({ close }) => (
                  <div className="flex flex-col gap-0.5 min-w-[160px]">
                    {menuItems.map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          close();
                          item.onClick();
                        }}
                        disabled={submitting}
                        className={
                          "flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50 " +
                          (item.destructive
                            ? "text-destructive hover:text-destructive"
                            : "text-foreground")
                        }
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </Popover>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
