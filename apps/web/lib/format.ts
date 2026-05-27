export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  PHP: "₱",
};

export const CATEGORIES = [
  "travel",
  "meals",
  "lodging",
  "software",
  "supplies",
  "other",
] as const;

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "PHP",
] as const;

export type Currency = (typeof CURRENCIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Status =
  | "draft"
  | "pending_manager"
  | "pending_finance"
  | "approved"
  | "rejected";

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount || 0);
  } catch {
    return `${CURRENCY_SYMBOL[currency] || ""}${(amount || 0).toFixed(2)} ${currency}`;
  }
}

export function formatDate(ts: number | undefined | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(ts: number | undefined | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(ts: number | undefined | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk} week${wk === 1 ? "" : "s"} ago`;
  const mo = Math.floor(day / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

export interface LineLike {
  category?: string;
  quantity: number;
  unitAmount: number;
  description: string;
}

export function lineTotal(line: LineLike): number {
  const q = Number(line.quantity) || 0;
  const u = Number(line.unitAmount) || 0;
  return Math.round(q * u * 100) / 100;
}

export interface ExpenseLike {
  lines?: LineLike[] | null;
  currency: string;
}

export function expenseTotal(expense: ExpenseLike): number {
  return (expense.lines ?? []).reduce((s, l) => s + lineTotal(l), 0);
}

export function lineSummary(line: LineLike, currency: string): string {
  return `${line.description} — ${formatMoney(lineTotal(line), currency)}`;
}

export function categoryBreakdown(
  expense: ExpenseLike,
): { category: string; subtotal: number }[] {
  const byCat = new Map<string, number>();
  (expense.lines ?? []).forEach((l) => {
    if (!l.category) return;
    byCat.set(l.category, (byCat.get(l.category) ?? 0) + lineTotal(l));
  });
  return Array.from(byCat.entries())
    .map(([category, subtotal]) => ({ category, subtotal }))
    .sort((a, b) => b.subtotal - a.subtotal);
}

export function categoriesColText(expense: ExpenseLike): string {
  const items = categoryBreakdown(expense);
  if (items.length === 0) return "—";
  const cur = expense.currency;
  if (items.length === 1)
    return `${items[0].category} ${formatMoney(items[0].subtotal, cur)}`;
  const top = items.slice(0, 3);
  let txt = top
    .map((it) => `${it.category} ${formatMoney(it.subtotal, cur)}`)
    .join(" · ");
  if (items.length > 3) txt += ` · +${items.length - 3} more`;
  if (txt.length > 60) txt = txt.slice(0, 57) + "…";
  return txt;
}

export function getInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function dayStringToTs(s: string, end = false): number | undefined {
  if (!s) return undefined;
  const suffix = end ? "T23:59:59.999" : "T00:00:00";
  const t = new Date(`${s}${suffix}`).getTime();
  return Number.isFinite(t) ? t : undefined;
}

export function tsToDayString(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return tsToDayString(Date.now());
}
