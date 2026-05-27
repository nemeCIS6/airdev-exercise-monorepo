"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ReceiptUpload } from "@/components/receipt-upload";
import {
  LineItemsSection,
  makeLine,
  type LineErrors,
  type LineLocal,
} from "@/components/line-items-section";
import {
  CURRENCIES,
  today,
  tsToDayString,
  type Category,
  type Currency,
} from "@/lib/format";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export interface FormValue {
  summary: string;
  currency: Currency;
  expenseDate: string;
  merchant: string;
  lines: LineLocal[];
}

export interface FormErrors {
  summary?: string;
  expenseDate?: string;
  receipt?: string;
  lines?: string;
}

interface ExpenseFormProps {
  expenseId: Id<"expenses">;
  value: FormValue;
  onChange: (next: FormValue) => void;
  errors?: FormErrors;
  lineErrors?: Record<string, LineErrors>;
  disabled?: boolean;
  /** Used by ReceiptUpload to forward server-current parent fields on upload. */
  serverParent: {
    summary: string;
    currency: Currency;
    expenseDate: number;
    merchant?: string;
    receiptStorageId?: Id<"_storage"> | undefined;
  };
}

export function ExpenseForm({
  expenseId,
  value,
  onChange,
  errors = {},
  lineErrors = {},
  disabled,
  serverParent,
}: ExpenseFormProps) {
  const set = (patch: Partial<FormValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <Label>
          Receipt{" "}
          <span className="text-muted-foreground font-normal text-xs">
            (required to submit)
          </span>
        </Label>
        <ReceiptUpload
          expenseId={expenseId}
          receiptStorageId={serverParent.receiptStorageId}
          serverParentFields={{
            summary: serverParent.summary,
            currency: serverParent.currency,
            expenseDate: serverParent.expenseDate,
            merchant: serverParent.merchant,
          }}
          editable={!disabled}
        />
        {errors.receipt && (
          <div className="text-xs text-destructive">{errors.receipt}</div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="f_summary" required>
            Summary
          </Label>
          <Input
            id="f_summary"
            placeholder="What was this expense for?"
            value={value.summary}
            onChange={(e) => set({ summary: e.target.value })}
            disabled={disabled}
          />
          {errors.summary && (
            <div className="text-xs text-destructive">{errors.summary}</div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="f_date" required>
            Expense date
          </Label>
          <Input
            id="f_date"
            type="date"
            max={today()}
            value={value.expenseDate}
            onChange={(e) => set({ expenseDate: e.target.value })}
            disabled={disabled}
          />
          {errors.expenseDate && (
            <div className="text-xs text-destructive">{errors.expenseDate}</div>
          )}
        </div>
        <div className="space-y-2">
          <Label required>Currency</Label>
          <Select
            value={value.currency}
            onChange={(v) => set({ currency: v as Currency })}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            disabled={disabled}
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="f_merch">
            Merchant{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </Label>
          <Input
            id="f_merch"
            placeholder="e.g. United Airlines"
            value={value.merchant}
            onChange={(e) => set({ merchant: e.target.value })}
            disabled={disabled}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold">Line items</h3>
          <span className="text-xs text-muted-foreground">
            {value.lines.length} {value.lines.length === 1 ? "line" : "lines"}
          </span>
        </div>
        <LineItemsSection
          lines={value.lines}
          currency={value.currency}
          onChange={(lines) => set({ lines })}
          errors={lineErrors}
          disabled={disabled}
          receiptStorageId={serverParent.receiptStorageId}
        />
        {errors.lines && (
          <div className="text-xs text-destructive">{errors.lines}</div>
        )}
      </section>
    </div>
  );
}

export function formValueFromServer(s: {
  summary: string;
  currency: Currency;
  expenseDate: number;
  merchant?: string;
  lines: Doc<"expense_lines">[];
}): FormValue {
  const lines: LineLocal[] = s.lines.map((l) => ({
    clientId: l._id,
    _id: l._id,
    description: l.description,
    category: l.category as Category,
    quantity: l.quantity,
    unitAmount: l.unitAmount,
  }));
  if (lines.length === 0) lines.push(makeLine());
  return {
    summary: s.summary,
    currency: s.currency,
    expenseDate: tsToDayString(s.expenseDate),
    merchant: s.merchant ?? "",
    lines,
  };
}

export interface ValidationResult {
  errs: FormErrors;
  lineErrs: Record<string, LineErrors>;
}

export function validateForm(
  value: FormValue,
  options: { hasReceipt: boolean },
): ValidationResult {
  const errs: FormErrors = {};
  const lineErrs: Record<string, LineErrors> = {};

  if (!value.summary.trim()) errs.summary = "Summary is required.";
  if (!value.expenseDate) errs.expenseDate = "Expense date is required.";
  else if (value.expenseDate > today())
    errs.expenseDate = "Expense date cannot be in the future.";

  if (!options.hasReceipt) errs.receipt = "A receipt is required to submit.";

  if (!value.lines || value.lines.length === 0) {
    errs.lines = "At least one line item is required.";
  }

  for (const line of value.lines ?? []) {
    const le: LineErrors = {};
    if (!line.description.trim()) le.description = "Required";
    if (!(line.quantity > 0)) le.quantity = "> 0";
    if (!(line.unitAmount > 0)) le.unitAmount = "> 0";
    if (Object.keys(le).length > 0) lineErrs[line.clientId] = le;
  }

  return { errs, lineErrs };
}

export function linesEqual(
  a: LineLocal[],
  b: Doc<"expense_lines">[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x._id !== y._id) return false;
    if (x.description !== y.description) return false;
    if (x.category !== y.category) return false;
    if (x.quantity !== y.quantity) return false;
    if (x.unitAmount !== y.unitAmount) return false;
  }
  return true;
}

export function isFormDirty(
  form: FormValue,
  server: {
    summary: string;
    currency: Currency;
    expenseDate: number;
    merchant?: string;
    lines: Doc<"expense_lines">[];
  },
): boolean {
  if (form.summary !== server.summary) return true;
  if (form.currency !== server.currency) return true;
  if (form.expenseDate !== tsToDayString(server.expenseDate)) return true;
  if ((form.merchant ?? "") !== (server.merchant ?? "")) return true;
  if (!linesEqual(form.lines, server.lines)) return true;
  return false;
}

/** Serialize FormValue's line array for the saveDraftWithLines mutation. */
export function linesForServer(value: FormValue) {
  return value.lines.map((l) => ({
    _id: l._id,
    description: l.description,
    category: l.category,
    quantity: l.quantity,
    unitAmount: l.unitAmount,
  }));
}

export function parentFieldsForServer(value: FormValue) {
  return {
    summary: value.summary,
    currency: value.currency,
    expenseDate:
      new Date(`${value.expenseDate}T00:00:00`).getTime() || Date.now(),
    merchant: value.merchant.trim() ? value.merchant.trim() : undefined,
  };
}
