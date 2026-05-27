"use client";

import { useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ApproverActionBarProps {
  role: "manager" | "finance";
  /** When false, render a hint instead of action buttons. */
  canAct: boolean;
  hint?: React.ReactNode;
  displayAmount: string;
  lineCount: number;
  onApprove: (note: string | undefined) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  submitting: boolean;
}

export function ApproverActionBar({
  role,
  canAct,
  hint,
  displayAmount,
  lineCount,
  onApprove,
  onReject,
  submitting,
}: ApproverActionBarProps) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const reasonValid =
    rejectReason.trim().length >= 5 && rejectReason.trim().length <= 500;

  const confirmApprove = async () => {
    await onApprove(approveNote.trim() || undefined);
    setApproveNote("");
    setMode("idle");
  };
  const confirmReject = async () => {
    if (!reasonValid) return;
    await onReject(rejectReason.trim());
    setRejectReason("");
    setMode("idle");
  };
  const cancelApprove = () => {
    setApproveNote("");
    setMode("idle");
  };
  const cancelReject = () => {
    setRejectReason("");
    setMode("idle");
  };

  const approveLabel =
    role === "finance" ? "Approve & finalize" : "Approve";

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.08)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {canAct && mode !== "idle" && (
          <div className="py-4 border-b border-border">
            {mode === "approve" && (
              <div className="rounded-md border border-border bg-muted/40 p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="approve_note">
                    Note{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="approve_note"
                    placeholder={
                      role === "finance"
                        ? "e.g. Cleared for reimbursement"
                        : "e.g. Approved per Q2 travel budget"
                    }
                    value={approveNote}
                    onChange={(e) => setApproveNote(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={cancelApprove}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    onClick={confirmApprove}
                    disabled={submitting}
                  >
                    <Check size={14} />{" "}
                    {role === "finance"
                      ? "Confirm final approval"
                      : "Confirm approval"}
                  </Button>
                </div>
              </div>
            )}
            {mode === "reject" && (
              <div className="rounded-md border border-border bg-muted/40 p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reject_reason" required>
                    Reason
                  </Label>
                  <Textarea
                    id="reject_reason"
                    placeholder="Tell the employee what to fix or clarify (5–500 characters)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {!reasonValid && rejectReason.length > 0
                        ? rejectReason.length < 5
                          ? "A bit more detail required."
                          : "Too long."
                        : "Visible to the employee."}
                    </span>
                    <span className="tabular-nums">
                      {rejectReason.trim().length}/500
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={cancelReject}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmReject}
                    disabled={!reasonValid || submitting}
                  >
                    <X size={14} /> Confirm rejection
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3 py-3">
          <div className="flex items-end gap-3 min-w-0">
            <div className="text-2xl font-semibold tabular-nums leading-none">
              {displayAmount}
            </div>
            <div className="text-xs text-muted-foreground pb-0.5">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {canAct ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setMode("reject")}
                  disabled={submitting || mode === "reject"}
                  className={
                    "flex-1 sm:flex-none" +
                    (mode === "reject" ? " ring-2 ring-ring" : "")
                  }
                >
                  <X size={14} /> Reject
                </Button>
                <Button
                  variant="success"
                  onClick={() => setMode("approve")}
                  disabled={submitting || mode === "approve"}
                  className={
                    "flex-1 sm:flex-none" +
                    (mode === "approve" ? " ring-2 ring-ring" : "")
                  }
                >
                  <Check size={14} /> {approveLabel}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock size={14} />
                {hint ?? "No action available at this stage."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
