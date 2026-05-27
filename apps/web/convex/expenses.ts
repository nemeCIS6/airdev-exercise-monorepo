import { ConvexError, v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  assertRole,
  assertManagerOfSubmitter,
  canReadExpense,
  getCallerProfile,
  getSubmitterProfile,
} from "./lib/auth";

const ALLOWED_RECEIPT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const CURRENCY_SYMBOL: Record<Doc<"expenses">["currency"], string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  PHP: "₱",
};

const CATEGORY_VALUES = [
  "travel",
  "meals",
  "lodging",
  "software",
  "supplies",
  "other",
] as const;
type Category = (typeof CATEGORY_VALUES)[number];

const CURRENCY_VALUES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "PHP",
] as const;
type Currency = (typeof CURRENCY_VALUES)[number];

const STATUS_VALUES = [
  "draft",
  "pending_manager",
  "pending_finance",
  "approved",
  "rejected",
] as const;

const categoryValidator = v.union(
  v.literal("travel"),
  v.literal("meals"),
  v.literal("lodging"),
  v.literal("software"),
  v.literal("supplies"),
  v.literal("other"),
);

const currencyValidator = v.union(
  v.literal("USD"),
  v.literal("EUR"),
  v.literal("GBP"),
  v.literal("CAD"),
  v.literal("AUD"),
  v.literal("JPY"),
  v.literal("PHP"),
);

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_manager"),
  v.literal("pending_finance"),
  v.literal("approved"),
  v.literal("rejected"),
);

const parentFieldsValidator = v.object({
  summary: v.string(),
  currency: currencyValidator,
  expenseDate: v.number(),
  merchant: v.optional(v.string()),
  receiptStorageId: v.optional(v.union(v.id("_storage"), v.null())),
});

const lineInputValidator = v.object({
  _id: v.optional(v.id("expense_lines")),
  description: v.string(),
  category: categoryValidator,
  quantity: v.number(),
  unitAmount: v.number(),
});

type LineInput = {
  _id?: Id<"expense_lines">;
  description: string;
  category: Category;
  quantity: number;
  unitAmount: number;
};

type ParentFieldsInput = {
  summary: string;
  currency: Currency;
  expenseDate: number;
  merchant?: string;
  receiptStorageId?: Id<"_storage"> | null;
};

function formatLineSummary(line: {
  description: string;
  quantity: number;
  unitAmount: number;
}, currency: Currency): string {
  const total = (line.quantity * line.unitAmount).toFixed(2);
  return `${line.description.trim()} — ${CURRENCY_SYMBOL[currency]}${total}`;
}

function validateLineFields(line: LineInput): void {
  const desc = line.description.trim();
  if (desc.length === 0) {
    throw new ConvexError("Line description is required");
  }
  if (desc.length > 200) {
    throw new ConvexError("Line description must be 200 characters or fewer");
  }
  if (!CATEGORY_VALUES.includes(line.category)) {
    throw new ConvexError("Invalid category");
  }
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
    throw new ConvexError("Quantity must be greater than 0");
  }
  if (!Number.isFinite(line.unitAmount) || line.unitAmount <= 0) {
    throw new ConvexError("Unit amount must be greater than 0");
  }
}

function validateParentFields(input: ParentFieldsInput): {
  summary: string;
  currency: Currency;
  expenseDate: number;
  merchant?: string;
} {
  const summary = input.summary.trim();
  // Empty summary is allowed on drafts; validateForSubmit enforces non-empty
  // before transitioning out of draft/rejected.
  if (summary.length > 200) {
    throw new ConvexError("Summary must be 200 characters or fewer");
  }
  if (!CURRENCY_VALUES.includes(input.currency)) {
    throw new ConvexError("Invalid currency");
  }
  if (!Number.isFinite(input.expenseDate) || input.expenseDate <= 0) {
    throw new ConvexError("Invalid expense date");
  }
  if (input.expenseDate > Date.now() + 60_000) {
    throw new ConvexError("Expense date cannot be in the future");
  }
  const merchant = input.merchant?.trim();
  if (merchant && merchant.length > 200) {
    throw new ConvexError("Merchant must be 200 characters or fewer");
  }
  return {
    summary,
    currency: input.currency,
    expenseDate: input.expenseDate,
    merchant: merchant && merchant.length > 0 ? merchant : undefined,
  };
}

async function validateReceiptStorage(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  const metadata = await ctx.db.system.get(storageId);
  if (!metadata) {
    throw new ConvexError("Receipt file not found in storage");
  }
  if (!ALLOWED_RECEIPT_MIME.has(metadata.contentType ?? "")) {
    throw new ConvexError(
      "Receipt must be JPG, PNG, WebP, or PDF",
    );
  }
  if (metadata.size > MAX_RECEIPT_BYTES) {
    throw new ConvexError("Receipt must be 10MB or smaller");
  }
}

async function ownDraftOrRejected(
  ctx: QueryCtx,
  expenseId: Id<"expenses">,
): Promise<Doc<"expenses">> {
  const expense = await ctx.db.get(expenseId);
  if (!expense) throw new ConvexError("Expense not found");
  const { callerId } = await getCallerProfile(ctx);
  if (expense.employeeId !== callerId) {
    throw new ConvexError("Forbidden: not your expense");
  }
  if (expense.status !== "draft" && expense.status !== "rejected") {
    throw new ConvexError(
      `Cannot edit expense in status "${expense.status}"`,
    );
  }
  return expense;
}

async function fetchLinesByExpense(
  ctx: QueryCtx,
  expenseId: Id<"expenses">,
): Promise<Doc<"expense_lines">[]> {
  return ctx.db
    .query("expense_lines")
    .withIndex("by_expense_and_sortOrder", (q) => q.eq("expenseId", expenseId))
    .collect();
}

async function writeEvent(
  ctx: MutationCtx,
  args: {
    expenseId: Id<"expenses">;
    actorId: Id<"users">;
    actorRoleAtTime: "employee" | "manager" | "finance";
    eventType: Doc<"expense_events">["eventType"];
    note?: string;
    lineId?: Id<"expense_lines">;
    saveGroupId?: string;
  },
): Promise<void> {
  await ctx.db.insert("expense_events", {
    expenseId: args.expenseId,
    actorId: args.actorId,
    actorRoleAtTime: args.actorRoleAtTime,
    eventType: args.eventType,
    note: args.note,
    lineId: args.lineId,
    saveGroupId: args.saveGroupId,
    timestamp: Date.now(),
  });
}

type ExpenseWithLines = Doc<"expenses"> & {
  lines: Doc<"expense_lines">[];
  total: number;
};

type ExpenseWithLinesAndSubmitter = ExpenseWithLines & {
  submitter: {
    userId: Id<"users">;
    displayName: string;
    email: string | null;
  };
};

async function joinLines(
  ctx: QueryCtx,
  expense: Doc<"expenses">,
): Promise<ExpenseWithLines> {
  const lines = await fetchLinesByExpense(ctx, expense._id);
  lines.sort((a, b) => a.sortOrder - b.sortOrder);
  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitAmount, 0);
  return { ...expense, lines, total };
}

async function joinSubmittersForReview(
  ctx: QueryCtx,
  rows: ExpenseWithLines[],
): Promise<ExpenseWithLinesAndSubmitter[]> {
  const cache = new Map<
    Id<"users">,
    { userId: Id<"users">; displayName: string; email: string | null }
  >();
  return Promise.all(
    rows.map(async (row) => {
      let submitter = cache.get(row.employeeId);
      if (!submitter) {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", row.employeeId))
          .unique();
        const user = await ctx.db.get(row.employeeId);
        submitter = {
          userId: row.employeeId,
          displayName: profile?.displayName ?? "Unknown",
          email: user?.email ?? null,
        };
        cache.set(row.employeeId, submitter);
      }
      return { ...row, submitter };
    }),
  );
}

function withinDateRange(
  expense: Doc<"expenses">,
  range?: { from?: number; to?: number },
): boolean {
  if (!range) return true;
  if (range.from !== undefined && expense.expenseDate < range.from) return false;
  if (range.to !== undefined && expense.expenseDate > range.to) return false;
  return true;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export const listMyExpenses = query({
  args: {
    statuses: v.optional(v.array(statusValidator)),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  handler: async (ctx, { statuses, dateFrom, dateTo }): Promise<ExpenseWithLines[]> => {
    const { callerId } = await getCallerProfile(ctx);
    const all = await ctx.db
      .query("expenses")
      .withIndex("by_employee", (q) => q.eq("employeeId", callerId))
      .order("desc")
      .collect();
    const filtered = all
      .filter((e) => !statuses?.length || statuses.includes(e.status))
      .filter((e) => withinDateRange(e, { from: dateFrom, to: dateTo }));
    return Promise.all(filtered.map((e) => joinLines(ctx, e)));
  },
});

export const listExpensesForReview = query({
  args: {
    statuses: v.optional(v.array(statusValidator)),
    employeeId: v.optional(v.id("users")),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { statuses, employeeId, dateFrom, dateTo },
  ): Promise<ExpenseWithLinesAndSubmitter[]> => {
    const { callerId, profile } = await getCallerProfile(ctx);
    if (profile.role !== "manager" && profile.role !== "finance") {
      throw new ConvexError("Forbidden: review role required");
    }

    let candidates: Doc<"expenses">[];
    if (profile.role === "manager") {
      // Managers see every submitted expense from their direct reports —
      // not just the pending queue, but their full history (approved,
      // rejected at any step, in flight at finance). Drafts stay private
      // to the employee and are intentionally excluded.
      const directReports = await ctx.db
        .query("userProfiles")
        .withIndex("by_managerId", (q) => q.eq("managerId", callerId))
        .collect();
      const reportIds = new Set(directReports.map((r) => r.userId));

      const perReport = await Promise.all(
        Array.from(reportIds).map((rid) =>
          ctx.db
            .query("expenses")
            .withIndex("by_employee", (q) => q.eq("employeeId", rid))
            .collect(),
        ),
      );
      candidates = perReport
        .flat()
        .filter((e) => e.status !== "draft")
        .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
    } else {
      // Finance gets the full audit view: every submitted expense in
      // the company, regardless of status (except drafts, which stay
      // private to the submitter). Manager rejections are visible
      // read-only — they can't act on them, but seeing the full
      // pipeline supports audit + pattern detection use cases that
      // a real financial controller would have.
      const all = await ctx.db.query("expenses").collect();
      candidates = all
        .filter((e) => e.status !== "draft")
        .sort(
          (a, b) =>
            (b.managerDecidedAt ?? b.submittedAt ?? 0) -
            (a.managerDecidedAt ?? a.submittedAt ?? 0),
        );
    }

    const filtered = candidates
      .filter((e) => !statuses?.length || statuses.includes(e.status))
      .filter((e) => !employeeId || e.employeeId === employeeId)
      .filter((e) => withinDateRange(e, { from: dateFrom, to: dateTo }));
    const withLines = await Promise.all(filtered.map((e) => joinLines(ctx, e)));
    return joinSubmittersForReview(ctx, withLines);
  },
});

export const getExpense = query({
  args: { expenseId: v.id("expenses") },
  handler: async (
    ctx,
    { expenseId },
  ): Promise<
    | (ExpenseWithLines & {
        submitter: { userId: Id<"users">; displayName: string; email: string | null };
      })
    | null
  > => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) return null;
    await canReadExpense(ctx, expense);
    const submitterProfile = await getSubmitterProfile(ctx, expense.employeeId);
    const submitterUser = await ctx.db.get(expense.employeeId);
    const joined = await joinLines(ctx, expense);
    return {
      ...joined,
      submitter: {
        userId: submitterProfile.userId,
        displayName: submitterProfile.displayName,
        email: submitterUser?.email ?? null,
      },
    };
  },
});

/**
 * Returns true if the caller owns a draft (or rejected) expense whose
 * `receiptStorageId` matches the given storage ID. Used by `ai.ts` to gate
 * Gemini OCR — only the file's owner can ask us to extract text from it.
 */
export const callerOwnsDraftWithReceipt = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<boolean> => {
    const caller = await getCallerProfile(ctx);
    const matches = await ctx.db
      .query("expenses")
      .withIndex("by_employee_and_status", (q) =>
        q.eq("employeeId", caller.callerId),
      )
      .collect();
    return matches.some(
      (e) =>
        e.receiptStorageId === storageId &&
        (e.status === "draft" || e.status === "rejected"),
    );
  },
});

// ─── Lifecycle mutations ────────────────────────────────────────────────────

export const createDraft = mutation({
  args: {
    summary: v.string(),
    currency: currencyValidator,
    expenseDate: v.number(),
    merchant: v.optional(v.string()),
    initialLine: v.optional(lineInputValidator),
  },
  handler: async (
    ctx,
    { summary, currency, expenseDate, merchant, initialLine },
  ): Promise<Id<"expenses">> => {
    const { callerId } = await assertRole(ctx, "employee");
    const parent = validateParentFields({
      summary,
      currency,
      expenseDate,
      merchant,
    });

    const expenseId = await ctx.db.insert("expenses", {
      employeeId: callerId,
      status: "draft",
      summary: parent.summary,
      currency: parent.currency,
      expenseDate: parent.expenseDate,
      merchant: parent.merchant,
    });

    await writeEvent(ctx, {
      expenseId,
      actorId: callerId,
      actorRoleAtTime: "employee",
      eventType: "created",
    });

    if (initialLine) {
      validateLineFields(initialLine);
      const saveGroupId = crypto.randomUUID();
      const lineId = await ctx.db.insert("expense_lines", {
        expenseId,
        description: initialLine.description.trim(),
        category: initialLine.category,
        quantity: initialLine.quantity,
        unitAmount: initialLine.unitAmount,
        sortOrder: 1,
      });
      await writeEvent(ctx, {
        expenseId,
        actorId: callerId,
        actorRoleAtTime: "employee",
        eventType: "line_added",
        note: formatLineSummary(initialLine, parent.currency),
        lineId,
        saveGroupId,
      });
    }

    return expenseId;
  },
});

export const updateDraft = mutation({
  args: {
    expenseId: v.id("expenses"),
    parentFields: parentFieldsValidator,
  },
  handler: async (ctx, { expenseId, parentFields }) => {
    const expense = await ownDraftOrRejected(ctx, expenseId);
    const parent = validateParentFields(parentFields);

    let receiptStorageId = expense.receiptStorageId;
    if (parentFields.receiptStorageId === null) {
      receiptStorageId = undefined;
    } else if (
      parentFields.receiptStorageId !== undefined &&
      parentFields.receiptStorageId !== expense.receiptStorageId
    ) {
      await validateReceiptStorage(ctx, parentFields.receiptStorageId);
      receiptStorageId = parentFields.receiptStorageId;
    }

    await ctx.db.patch(expenseId, {
      summary: parent.summary,
      currency: parent.currency,
      expenseDate: parent.expenseDate,
      merchant: parent.merchant,
      receiptStorageId,
    });

    await writeEvent(ctx, {
      expenseId,
      actorId: expense.employeeId,
      actorRoleAtTime: "employee",
      eventType: "edited",
    });
  },
});

export const saveDraftWithLines = mutation({
  args: {
    expenseId: v.id("expenses"),
    parentFields: parentFieldsValidator,
    lines: v.array(lineInputValidator),
  },
  handler: async (ctx, { expenseId, parentFields, lines }) => {
    const expense = await ownDraftOrRejected(ctx, expenseId);
    const parent = validateParentFields(parentFields);

    let receiptStorageId = expense.receiptStorageId;
    if (parentFields.receiptStorageId === null) {
      receiptStorageId = undefined;
    } else if (
      parentFields.receiptStorageId !== undefined &&
      parentFields.receiptStorageId !== expense.receiptStorageId
    ) {
      await validateReceiptStorage(ctx, parentFields.receiptStorageId);
      receiptStorageId = parentFields.receiptStorageId;
    }

    for (const line of lines) validateLineFields(line);

    const existing = await fetchLinesByExpense(ctx, expenseId);
    const existingById = new Map(existing.map((l) => [l._id, l]));
    const incomingIds = new Set(lines.map((l) => l._id).filter(Boolean) as Id<"expense_lines">[]);
    const maxSortOrder = existing.reduce(
      (acc, l) => Math.max(acc, l.sortOrder),
      0,
    );

    const saveGroupId = crypto.randomUUID();
    const eventInserts: Promise<unknown>[] = [];
    let newSortCounter = maxSortOrder;

    for (const line of lines) {
      if (line._id && existingById.has(line._id)) {
        const prev = existingById.get(line._id)!;
        const desc = line.description.trim();
        const changed =
          prev.description !== desc ||
          prev.category !== line.category ||
          prev.quantity !== line.quantity ||
          prev.unitAmount !== line.unitAmount;
        if (changed) {
          await ctx.db.patch(line._id, {
            description: desc,
            category: line.category,
            quantity: line.quantity,
            unitAmount: line.unitAmount,
          });
          eventInserts.push(
            writeEvent(ctx, {
              expenseId,
              actorId: expense.employeeId,
              actorRoleAtTime: "employee",
              eventType: "line_edited",
              note: formatLineSummary(line, parent.currency),
              lineId: line._id,
              saveGroupId,
            }),
          );
        }
      } else {
        newSortCounter += 1;
        const newLineId = await ctx.db.insert("expense_lines", {
          expenseId,
          description: line.description.trim(),
          category: line.category,
          quantity: line.quantity,
          unitAmount: line.unitAmount,
          sortOrder: newSortCounter,
        });
        eventInserts.push(
          writeEvent(ctx, {
            expenseId,
            actorId: expense.employeeId,
            actorRoleAtTime: "employee",
            eventType: "line_added",
            note: formatLineSummary(line, parent.currency),
            lineId: newLineId,
            saveGroupId,
          }),
        );
      }
    }

    for (const prev of existing) {
      if (!incomingIds.has(prev._id)) {
        eventInserts.push(
          writeEvent(ctx, {
            expenseId,
            actorId: expense.employeeId,
            actorRoleAtTime: "employee",
            eventType: "line_removed",
            note: formatLineSummary(prev, parent.currency),
            saveGroupId,
          }),
        );
        await ctx.db.delete(prev._id);
      }
    }

    await ctx.db.patch(expenseId, {
      summary: parent.summary,
      currency: parent.currency,
      expenseDate: parent.expenseDate,
      merchant: parent.merchant,
      receiptStorageId,
    });

    await Promise.all(eventInserts);
  },
});

async function validateForSubmit(
  ctx: QueryCtx,
  expense: Doc<"expenses">,
): Promise<void> {
  if (!expense.summary.trim()) {
    throw new ConvexError("Summary is required");
  }
  if (expense.expenseDate > Date.now() + 60_000) {
    throw new ConvexError("Expense date cannot be in the future");
  }
  if (!expense.receiptStorageId) {
    throw new ConvexError("Receipt is required");
  }
  await validateReceiptStorage(ctx, expense.receiptStorageId);

  const lines = await fetchLinesByExpense(ctx, expense._id);
  if (lines.length === 0) {
    throw new ConvexError("At least one line item is required");
  }
  for (const line of lines) {
    validateLineFields(line);
  }
}

export const submitExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    const { callerId } = await assertRole(ctx, "employee");
    if (expense.employeeId !== callerId) {
      throw new ConvexError("Forbidden: not your expense");
    }
    if (expense.status !== "draft") {
      throw new ConvexError(
        `Cannot submit expense in status "${expense.status}"`,
      );
    }
    await validateForSubmit(ctx, expense);

    const now = Date.now();
    await ctx.db.patch(expenseId, {
      status: "pending_manager",
      submittedAt: expense.submittedAt ?? now,
    });
    await writeEvent(ctx, {
      expenseId,
      actorId: callerId,
      actorRoleAtTime: "employee",
      eventType: "submitted",
    });
  },
});

export const withdrawExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    const { callerId } = await assertRole(ctx, "employee");
    if (expense.employeeId !== callerId) {
      throw new ConvexError("Forbidden: not your expense");
    }
    if (
      expense.status !== "pending_manager" &&
      expense.status !== "pending_finance"
    ) {
      throw new ConvexError(
        `Cannot withdraw expense in status "${expense.status}"`,
      );
    }

    const patch: Partial<Doc<"expenses">> = { status: "draft" };
    if (expense.status === "pending_finance") {
      patch.managerDecidedAt = undefined;
      patch.managerDecidedBy = undefined;
    }
    await ctx.db.patch(expenseId, patch);
    await writeEvent(ctx, {
      expenseId,
      actorId: callerId,
      actorRoleAtTime: "employee",
      eventType: "withdrawn",
    });
  },
});

export const resubmitRejected = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    const { callerId } = await assertRole(ctx, "employee");
    if (expense.employeeId !== callerId) {
      throw new ConvexError("Forbidden: not your expense");
    }
    if (expense.status !== "rejected") {
      throw new ConvexError(
        `Cannot resubmit expense in status "${expense.status}"`,
      );
    }
    await validateForSubmit(ctx, expense);

    await ctx.db.patch(expenseId, {
      status: "pending_manager",
      rejectionReason: undefined,
      rejectedByRole: undefined,
      managerDecidedAt: undefined,
      managerDecidedBy: undefined,
      financeDecidedAt: undefined,
      financeDecidedBy: undefined,
    });
    await writeEvent(ctx, {
      expenseId,
      actorId: callerId,
      actorRoleAtTime: "employee",
      eventType: "resubmitted",
    });
  },
});

export const discardDraft = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    const { callerId } = await assertRole(ctx, "employee");
    if (expense.employeeId !== callerId) {
      throw new ConvexError("Forbidden: not your expense");
    }
    if (expense.status !== "draft") {
      throw new ConvexError(
        `Cannot discard expense in status "${expense.status}"`,
      );
    }

    const lines = await fetchLinesByExpense(ctx, expenseId);
    for (const line of lines) {
      await ctx.db.delete(line._id);
    }

    const events = await ctx.db
      .query("expense_events")
      .withIndex("by_expense", (q) => q.eq("expenseId", expenseId))
      .collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    if (expense.receiptStorageId) {
      await ctx.storage.delete(expense.receiptStorageId);
    }

    await ctx.db.delete(expenseId);
  },
});

// ─── Approval mutations ─────────────────────────────────────────────────────

function validateReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    throw new ConvexError("Reason must be at least 5 characters");
  }
  if (trimmed.length > 500) {
    throw new ConvexError("Reason must be 500 characters or fewer");
  }
  return trimmed;
}

function validateOptionalNote(note: string | undefined): string | undefined {
  if (note === undefined) return undefined;
  const trimmed = note.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > 500) {
    throw new ConvexError("Note must be 500 characters or fewer");
  }
  return trimmed;
}

export const managerApprove = mutation({
  args: {
    expenseId: v.id("expenses"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { expenseId, note }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.status !== "pending_manager") {
      throw new ConvexError(
        `Cannot approve at manager step in status "${expense.status}"`,
      );
    }
    const { callerId } = await assertManagerOfSubmitter(ctx, expense);
    const cleanNote = validateOptionalNote(note);

    const now = Date.now();
    await ctx.db.patch(expenseId, {
      status: "pending_finance",
      managerDecidedAt: now,
      managerDecidedBy: callerId,
    });
    await writeEvent(ctx, {
      expenseId,
      actorId: callerId,
      actorRoleAtTime: "manager",
      eventType: "manager_approved",
      note: cleanNote,
    });
  },
});

export const managerReject = mutation({
  args: {
    expenseId: v.id("expenses"),
    reason: v.string(),
  },
  handler: async (ctx, { expenseId, reason }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.status !== "pending_manager") {
      throw new ConvexError(
        `Cannot reject at manager step in status "${expense.status}"`,
      );
    }
    const { callerId } = await assertManagerOfSubmitter(ctx, expense);
    const cleanReason = validateReason(reason);

    const now = Date.now();
    await ctx.db.patch(expenseId, {
      status: "rejected",
      managerDecidedAt: now,
      managerDecidedBy: callerId,
      rejectionReason: cleanReason,
      rejectedByRole: "manager",
    });
    await writeEvent(ctx, {
      expenseId,
      actorId: callerId,
      actorRoleAtTime: "manager",
      eventType: "rejected",
      note: cleanReason,
    });
  },
});

export const financeApprove = mutation({
  args: {
    expenseId: v.id("expenses"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { expenseId, note }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.status !== "pending_finance") {
      throw new ConvexError(
        `Cannot approve at finance step in status "${expense.status}"`,
      );
    }
    const { callerId } = await assertRole(ctx, "finance");
    const cleanNote = validateOptionalNote(note);

    const now = Date.now();
    await ctx.db.patch(expenseId, {
      status: "approved",
      financeDecidedAt: now,
      financeDecidedBy: callerId,
    });
    await writeEvent(ctx, {
      expenseId,
      actorId: callerId,
      actorRoleAtTime: "finance",
      eventType: "finance_approved",
      note: cleanNote,
    });
  },
});

export const financeReject = mutation({
  args: {
    expenseId: v.id("expenses"),
    reason: v.string(),
  },
  handler: async (ctx, { expenseId, reason }) => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    if (expense.status !== "pending_finance") {
      throw new ConvexError(
        `Cannot reject at finance step in status "${expense.status}"`,
      );
    }
    const { callerId } = await assertRole(ctx, "finance");
    const cleanReason = validateReason(reason);

    const now = Date.now();
    await ctx.db.patch(expenseId, {
      status: "rejected",
      financeDecidedAt: now,
      financeDecidedBy: callerId,
      rejectionReason: cleanReason,
      rejectedByRole: "finance",
    });
    await writeEvent(ctx, {
      expenseId,
      actorId: callerId,
      actorRoleAtTime: "finance",
      eventType: "rejected",
      note: cleanReason,
    });
  },
});
