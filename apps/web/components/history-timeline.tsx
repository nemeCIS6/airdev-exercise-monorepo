"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  FilePlus,
  ListChecks,
  Minus,
  Pencil,
  Plus,
  Repeat,
  Send,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { formatDateTime, timeAgo } from "@/lib/format";

type EventType = Doc<"expense_events">["eventType"];

type TimelineEvent = Doc<"expense_events"> & {
  actor: { displayName: string; role: string } | null;
};

const EVENT_ICON: Record<EventType, LucideIcon> = {
  created: FilePlus,
  submitted: Send,
  withdrawn: Undo2,
  edited: Pencil,
  resubmitted: Repeat,
  manager_approved: CheckCircle2,
  finance_approved: CheckCircle2,
  rejected: XCircle,
  line_added: Plus,
  line_edited: Pencil,
  line_removed: Minus,
};

const EVENT_COLOR: Partial<Record<EventType, string>> = {
  manager_approved: "text-green-700 bg-green-100 border-green-200",
  finance_approved: "text-emerald-700 bg-emerald-100 border-emerald-200",
  rejected: "text-red-700 bg-red-100 border-red-200",
};

const DEFAULT_COLOR = "text-muted-foreground bg-secondary border-border";

function eventVerb(ev: TimelineEvent): string {
  switch (ev.eventType) {
    case "created":
      return "created this expense";
    case "submitted":
      return "submitted for review";
    case "withdrawn":
      return "withdrew this expense";
    case "edited":
      return "edited the expense";
    case "resubmitted":
      return "resubmitted for review";
    case "manager_approved":
      return "approved at the manager step";
    case "finance_approved":
      return "approved at the finance step";
    case "rejected":
      if (ev.actorRoleAtTime === "finance")
        return "rejected this expense (finance step)";
      if (ev.actorRoleAtTime === "manager")
        return "rejected this expense (manager step)";
      return "rejected this expense";
    case "line_added":
      return "added line";
    case "line_edited":
      return "edited line";
    case "line_removed":
      return "removed line";
  }
}

type Row =
  | { kind: "single"; event: TimelineEvent }
  | {
      kind: "group";
      saveGroupId: string;
      events: TimelineEvent[];
      timestamp: number;
      actorName: string;
    };

function buildRows(events: TimelineEvent[]): Row[] {
  // Events arrive newest-first (DESC). Find line_* events sharing a saveGroupId
  // and collapse groups of 3+ into one expandable row.
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (
      ev.saveGroupId &&
      (ev.eventType === "line_added" ||
        ev.eventType === "line_edited" ||
        ev.eventType === "line_removed")
    ) {
      if (seen.has(ev.saveGroupId)) continue;
      const group = events.filter(
        (x) =>
          x.saveGroupId === ev.saveGroupId &&
          (x.eventType === "line_added" ||
            x.eventType === "line_edited" ||
            x.eventType === "line_removed"),
      );
      if (group.length >= 3) {
        seen.add(ev.saveGroupId);
        out.push({
          kind: "group",
          saveGroupId: ev.saveGroupId,
          events: group,
          timestamp: group[0].timestamp,
          actorName: ev.actor?.displayName ?? "Someone",
        });
        continue;
      }
    }
    out.push({ kind: "single", event: ev });
  }
  return out;
}

function StepIndicator({ step }: { step: string }) {
  return (
    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background border border-border text-[8px] font-bold text-foreground">
      {step}
    </span>
  );
}

function GroupedLineEvents({
  row,
}: {
  row: Extract<Row, { kind: "group" }>;
}) {
  const [open, setOpen] = useState(false);
  const counts: Record<string, number> = {
    line_added: 0,
    line_edited: 0,
    line_removed: 0,
  };
  row.events.forEach((ev) => {
    counts[ev.eventType] = (counts[ev.eventType] ?? 0) + 1;
  });
  const parts: string[] = [];
  if (counts.line_added) parts.push(`added ${counts.line_added}`);
  if (counts.line_edited) parts.push(`edited ${counts.line_edited}`);
  if (counts.line_removed) parts.push(`removed ${counts.line_removed}`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md text-left text-sm hover:bg-muted/40 -mx-1 px-1 py-0.5"
      >
        <span>
          <span className="font-medium">{row.actorName}</span>
          <span className="text-muted-foreground"> edited line items</span>
          <span className="text-muted-foreground"> ({parts.join(", ")})</span>
        </span>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground" />
        )}
      </button>
      <div
        className="text-xs text-muted-foreground mt-0.5"
        title={formatDateTime(row.timestamp)}
      >
        {timeAgo(row.timestamp)}
      </div>
      {open && (
        <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
          {row.events.map((ev) => {
            const Icon = EVENT_ICON[ev.eventType];
            const label = ev.eventType.replace("line_", "");
            return (
              <li key={ev._id} className="text-xs flex items-start gap-2">
                <Icon
                  size={11}
                  className="text-muted-foreground mt-0.5 shrink-0"
                />
                <span>
                  <span className="capitalize text-muted-foreground">
                    {label}:{" "}
                  </span>
                  <span className="text-foreground">{ev.note}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

interface HistoryTimelineProps {
  expenseId: Id<"expenses">;
}

export function HistoryTimeline({ expenseId }: HistoryTimelineProps) {
  const events = useQuery(api.events.listEventsForExpense, { expenseId });

  if (events === undefined) {
    return (
      <div>
        <h2 className="text-base font-semibold mb-3">History</h2>
        <div className="space-y-3">
          <div className="skel h-4 w-32" />
          <div className="skel h-4 w-24" />
          <div className="skel h-4 w-40" />
        </div>
      </div>
    );
  }

  const rows = buildRows(events);

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">History</h2>
      <ol className="relative ml-1">
        {rows.map((row, i) => {
          const last = i === rows.length - 1;
          if (row.kind === "group") {
            return (
              <li
                key={row.saveGroupId}
                className="relative pl-9 pb-5 last:pb-0"
              >
                {!last && (
                  <span className="absolute left-3 top-7 bottom-0 w-px bg-border" />
                )}
                <span
                  className={cn(
                    "absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border",
                    DEFAULT_COLOR,
                  )}
                >
                  <ListChecks size={13} />
                </span>
                <GroupedLineEvents row={row} />
              </li>
            );
          }
          const ev = row.event;
          const Icon = EVENT_ICON[ev.eventType] ?? Circle;
          const colorCls = EVENT_COLOR[ev.eventType] ?? DEFAULT_COLOR;
          const isMgrApproval = ev.eventType === "manager_approved";
          const isFinApproval = ev.eventType === "finance_approved";
          const showApprovalNote =
            !!ev.note &&
            (ev.eventType === "manager_approved" ||
              ev.eventType === "finance_approved" ||
              ev.eventType === "rejected");
          const showLineNote =
            !!ev.note &&
            (ev.eventType === "line_added" ||
              ev.eventType === "line_edited" ||
              ev.eventType === "line_removed");
          return (
            <li key={ev._id} className="relative pl-9 pb-5 last:pb-0">
              {!last && (
                <span className="absolute left-3 top-7 bottom-0 w-px bg-border" />
              )}
              <span
                className={cn(
                  "absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border",
                  colorCls,
                )}
              >
                <Icon size={13} />
                {isMgrApproval && <StepIndicator step="1" />}
                {isFinApproval && <StepIndicator step="2" />}
              </span>
              <div className="text-sm">
                <span className="font-medium">
                  {ev.actor?.displayName ?? "Someone"}
                </span>
                <span className="text-muted-foreground"> {eventVerb(ev)}</span>
                <span className="text-muted-foreground"> · </span>
                <span
                  className="text-muted-foreground"
                  title={formatDateTime(ev.timestamp)}
                >
                  {timeAgo(ev.timestamp)}
                </span>
              </div>
              {showApprovalNote && (
                <blockquote className="mt-2 rounded-md border-l-2 border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {ev.note}
                </blockquote>
              )}
              {showLineNote && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {ev.note}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
