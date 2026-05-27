"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { TableSkeleton } from "@/components/expense-list";
import {
  CATEGORIES,
  expenseTotal,
  formatMoney,
  getInitials,
  lineTotal,
  type Category,
} from "@/lib/format";

// ─── Period selection ───────────────────────────────────────────────────

type Period = "all" | "month" | "quarter" | "year";

const PERIOD_LABEL: Record<Period, string> = {
  all: "All time",
  year: "This year",
  quarter: "This quarter",
  month: "This month",
};

const PERIOD_LABEL_SHORT: Record<Period, string> = {
  all: "All",
  year: "Year",
  quarter: "Quarter",
  month: "Month",
};

function periodStart(period: Period): number {
  if (period === "all") return 0;
  const now = new Date();
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1).getTime();
  }
  return new Date(now.getFullYear(), 0, 1).getTime();
}

// ─── Page ───────────────────────────────────────────────────────────────

interface ExpenseRow {
  _id: string;
  status:
    | "draft"
    | "pending_manager"
    | "pending_finance"
    | "approved"
    | "rejected";
  currency: string;
  submittedAt?: number;
  managerDecidedAt?: number;
  rejectedByRole?: "manager" | "finance";
  lines: Array<{
    category?: string;
    quantity: number;
    unitAmount: number;
    description: string;
  }>;
  submitter?: { userId: string; displayName: string };
}

export default function FinanceOverviewPage() {
  const [period, setPeriod] = useState<Period>("year");
  const all = useQuery(api.expenses.listExpensesForReview, {});

  const filtered = useMemo<ExpenseRow[]>(() => {
    if (!all) return [];
    const start = periodStart(period);
    return all.filter((e) => (e.submittedAt ?? 0) >= start);
  }, [all, period]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Financial view of all submitted expenses across the company.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {all === undefined ? (
        <TableSkeleton rows={3} cols={4} />
      ) : (
        <>
          <KpiStrip stats={stats} />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mt-8">
            <CategoryBreakdown stats={stats} />
            <TopSubmitters stats={stats} />
          </div>
          {stats.totalCount === 0 && (
            <div className="mt-8 rounded-md border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No submitted expenses in this period yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Period selector ────────────────────────────────────────────────────

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (next: Period) => void;
}) {
  const items: Period[] = ["all", "year", "quarter", "month"];
  return (
    <div
      role="tablist"
      aria-label="Period"
      className="inline-flex items-center rounded-md border border-border bg-background p-0.5 text-xs"
    >
      {items.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className={
              "px-2.5 sm:px-3 py-1.5 rounded-[5px] font-medium transition-colors whitespace-nowrap " +
              (active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <span className="sm:hidden">{PERIOD_LABEL_SHORT[p]}</span>
            <span className="hidden sm:inline">{PERIOD_LABEL[p]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── KPI strip ──────────────────────────────────────────────────────────

interface Stats {
  approved: { byCurrency: Map<string, number>; count: number };
  queue: { byCurrency: Map<string, number>; count: number };
  rejected: {
    byCurrency: Map<string, number>;
    count: number;
    byFinance: number;
    byManager: number;
  };
  financeDecisions: { approve: number; reject: number };
  totalCount: number;
  categoriesByPrimaryCurrency: { category: Category; total: number }[];
  primaryCurrency: string;
  topSubmitters: {
    userId: string;
    name: string;
    count: number;
    total: number;
    currency: string;
  }[];
}

function KpiStrip({ stats }: { stats: Stats }) {
  const approvalRate =
    stats.financeDecisions.approve + stats.financeDecisions.reject === 0
      ? null
      : Math.round(
          (stats.financeDecisions.approve /
            (stats.financeDecisions.approve +
              stats.financeDecisions.reject)) *
            100,
        );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        accent="emerald"
        icon={CheckCircle2}
        label="Approved"
        countLabel={`${stats.approved.count} expense${stats.approved.count === 1 ? "" : "s"}`}
        amounts={stats.approved.byCurrency}
      />
      <KpiCard
        accent="blue"
        icon={Clock}
        label="In your queue"
        countLabel={`${stats.queue.count} awaiting finance review`}
        amounts={stats.queue.byCurrency}
      />
      <KpiCard
        accent="red"
        icon={XCircle}
        label="Rejected"
        countLabel={`${stats.rejected.byManager} by manager · ${stats.rejected.byFinance} by finance`}
        amounts={stats.rejected.byCurrency}
      />
      <KpiCard
        accent="amber"
        icon={TrendingUp}
        label="Approval rate"
        countLabel={
          approvalRate === null
            ? "No finance decisions yet"
            : `${stats.financeDecisions.approve} approve · ${stats.financeDecisions.reject} reject`
        }
        single={approvalRate === null ? "—" : `${approvalRate}%`}
      />
    </div>
  );
}

const ACCENT_STYLES = {
  emerald: {
    rule: "bg-emerald-500",
    iconBg: "bg-emerald-50 text-emerald-700",
  },
  blue: {
    rule: "bg-blue-500",
    iconBg: "bg-blue-50 text-blue-700",
  },
  red: {
    rule: "bg-red-500",
    iconBg: "bg-red-50 text-red-700",
  },
  amber: {
    rule: "bg-amber-500",
    iconBg: "bg-amber-50 text-amber-700",
  },
} as const;

type Accent = keyof typeof ACCENT_STYLES;

function KpiCard({
  accent,
  icon: Icon,
  label,
  amounts,
  single,
  countLabel,
}: {
  accent: Accent;
  icon: typeof CheckCircle2;
  label: string;
  amounts?: Map<string, number>;
  single?: string;
  countLabel: string;
}) {
  const styles = ACCENT_STYLES[accent];
  const sorted = amounts
    ? Array.from(amounts.entries()).sort((a, b) => b[1] - a[1])
    : [];
  const primary = sorted[0];
  const others = sorted.slice(1);
  return (
    <div className="relative rounded-md border border-border bg-card overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${styles.rule}`} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md ${styles.iconBg}`}
          >
            <Icon size={14} />
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        {single !== undefined ? (
          <div className="text-3xl font-semibold tracking-tight tabular-nums">
            {single}
          </div>
        ) : primary ? (
          <>
            <div className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatMoney(primary[1], primary[0])}
            </div>
            {others.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                {others.map(([cur, amt]) => (
                  <span key={cur}>{formatMoney(amt, cur)}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-3xl font-semibold tracking-tight text-muted-foreground/50 tabular-nums">
            —
          </div>
        )}
        <div className="mt-2 text-xs text-muted-foreground">{countLabel}</div>
      </div>
    </div>
  );
}

// ─── Category breakdown ─────────────────────────────────────────────────

const CATEGORY_COLOR: Record<Category, string> = {
  travel: "bg-sky-500",
  meals: "bg-amber-500",
  lodging: "bg-violet-500",
  software: "bg-emerald-500",
  supplies: "bg-rose-400",
  other: "bg-zinc-400",
};

function CategoryBreakdown({ stats }: { stats: Stats }) {
  const data = stats.categoriesByPrimaryCurrency;
  const max = data[0]?.total ?? 0;
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="px-5 pt-5 pb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Approved spend by category</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across all approved expenses
            {stats.primaryCurrency ? (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  {stats.primaryCurrency}
                </span>{" "}
                only
              </>
            ) : null}
          </p>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="px-5 pb-6 text-sm text-muted-foreground">
          No approved expenses to break down.
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {data.map((row) => {
            const pct = max === 0 ? 0 : Math.round((row.total / max) * 100);
            return (
              <li
                key={row.category}
                className="px-5 py-3 grid grid-cols-[80px_1fr_auto] items-center gap-4"
              >
                <div className="flex items-center gap-2 text-xs font-medium capitalize">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLOR[row.category]}`}
                  />
                  {row.category}
                </div>
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 ${CATEGORY_COLOR[row.category]}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-sm font-semibold tabular-nums whitespace-nowrap">
                  {formatMoney(row.total, stats.primaryCurrency)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ─── Top submitters ─────────────────────────────────────────────────────

function TopSubmitters({ stats }: { stats: Stats }) {
  const rows = stats.topSubmitters;
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold">Top submitters</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          By approved spend
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 pb-6 text-sm text-muted-foreground">
          Nobody has had an expense approved yet.
        </div>
      ) : (
        <ol className="divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.userId}
              className="px-5 py-3 flex items-center gap-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                {getInitials(r.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.count} approved
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums whitespace-nowrap">
                {formatMoney(r.total, r.currency)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── Stats computation ──────────────────────────────────────────────────

function computeStats(expenses: ExpenseRow[]): Stats {
  const approvedByCur = new Map<string, number>();
  const queueByCur = new Map<string, number>();
  const rejectedByCur = new Map<string, number>();
  let approvedCount = 0;
  let queueCount = 0;
  let rejectedCount = 0;
  let rejectedByFinanceCount = 0;
  let rejectedByManagerCount = 0;
  let financeApprove = 0;
  let financeReject = 0;

  // Category totals scoped to primary currency only (multi-currency
  // breakdowns would mix incompatible units).
  const currencyTotals = new Map<string, number>();
  const categoryByCur = new Map<string, Map<Category, number>>();
  // Top submitters scoped to approved expenses in the primary currency.
  const submitterTotals = new Map<
    string,
    {
      userId: string;
      name: string;
      count: number;
      total: number;
      currency: string;
    }
  >();

  for (const e of expenses) {
    const total = expenseTotal(e);
    currencyTotals.set(e.currency, (currencyTotals.get(e.currency) ?? 0) + total);

    if (e.status === "approved") {
      approvedByCur.set(
        e.currency,
        (approvedByCur.get(e.currency) ?? 0) + total,
      );
      approvedCount++;
      financeApprove++;

      // Category aggregation per currency.
      if (!categoryByCur.has(e.currency))
        categoryByCur.set(e.currency, new Map());
      const catMap = categoryByCur.get(e.currency)!;
      for (const line of e.lines || []) {
        const cat = (line.category as Category) || "other";
        catMap.set(cat, (catMap.get(cat) ?? 0) + lineTotal(line));
      }

      // Submitter aggregation (per currency, dominant currency wins).
      const subId = e.submitter?.userId;
      const subName = e.submitter?.displayName ?? "Unknown";
      if (subId) {
        const key = `${subId}::${e.currency}`;
        const prev = submitterTotals.get(key);
        if (prev) {
          prev.count++;
          prev.total += total;
        } else {
          submitterTotals.set(key, {
            userId: subId,
            name: subName,
            count: 1,
            total,
            currency: e.currency,
          });
        }
      }
    } else if (e.status === "pending_finance") {
      queueByCur.set(e.currency, (queueByCur.get(e.currency) ?? 0) + total);
      queueCount++;
    } else if (e.status === "rejected") {
      rejectedByCur.set(
        e.currency,
        (rejectedByCur.get(e.currency) ?? 0) + total,
      );
      rejectedCount++;
      if (e.rejectedByRole === "finance") {
        rejectedByFinanceCount++;
        financeReject++;
      } else {
        rejectedByManagerCount++;
      }
    }
  }

  // Pick primary currency = currency with the largest absolute spend
  // (sum across all statuses) to anchor the bar chart + submitters list.
  const primaryCurrency =
    Array.from(currencyTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "USD";

  const primaryCatMap =
    categoryByCur.get(primaryCurrency) ?? new Map<Category, number>();
  const categoriesByPrimaryCurrency = CATEGORIES
    .map((category) => ({
      category,
      total: primaryCatMap.get(category) ?? 0,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const topSubmitters = Array.from(submitterTotals.values())
    .filter((s) => s.currency === primaryCurrency)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    approved: { byCurrency: approvedByCur, count: approvedCount },
    queue: { byCurrency: queueByCur, count: queueCount },
    rejected: {
      byCurrency: rejectedByCur,
      count: rejectedCount,
      byFinance: rejectedByFinanceCount,
      byManager: rejectedByManagerCount,
    },
    financeDecisions: { approve: financeApprove, reject: financeReject },
    totalCount: expenses.length,
    categoriesByPrimaryCurrency,
    primaryCurrency,
    topSubmitters,
  };
}

