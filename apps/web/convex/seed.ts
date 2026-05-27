import { v } from "convex/values";
import {
  action,
  ActionCtx,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// Tiny valid 1x1 JPEG. Used as a placeholder receipt for every seeded
// non-draft expense. Inlined so the action does not need filesystem access.
const PLACEHOLDER_RECEIPT_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAA//2Q==";

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return view;
}

const ONE_DAY = 24 * 60 * 60 * 1000;

const CURRENCY_USD = "USD" as const;

// ─── Internal queries / mutations used by `run` ─────────────────────────────

export const _findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
  },
});

export const _countExpensesForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<number> => {
    const rows = await ctx.db
      .query("expenses")
      .withIndex("by_employee", (q) => q.eq("employeeId", userId))
      .collect();
    return rows.length;
  },
});

export const _upsertProfile = internalMutation({
  args: {
    userId: v.id("users"),
    displayName: v.string(),
    role: v.union(
      v.literal("employee"),
      v.literal("manager"),
      v.literal("finance"),
    ),
    managerId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        role: args.role,
        managerId: args.managerId,
      });
      return existing._id;
    }
    return ctx.db.insert("userProfiles", {
      userId: args.userId,
      displayName: args.displayName,
      role: args.role,
      managerId: args.managerId,
    });
  },
});

type SeedLine = {
  description: string;
  category: Doc<"expense_lines">["category"];
  quantity: number;
  unitAmount: number;
};

function lineSummary(line: SeedLine): string {
  const total = (line.quantity * line.unitAmount).toFixed(2);
  return `${line.description} — $${total}`;
}

export const _createSeedExpenses = internalMutation({
  args: {
    eddieId: v.id("users"),
    morganId: v.id("users"),
    fionaId: v.id("users"),
    receipts: v.object({
      bistro: v.id("_storage"),
      saas: v.id("_storage"),
      sfconf: v.id("_storage"),
      tavern: v.id("_storage"),
    }),
  },
  handler: async (
    ctx,
    { eddieId, morganId, fionaId, receipts },
  ): Promise<{ expenses: number; lines: number; events: number }> => {
    const now = Date.now();
    let totalLines = 0;
    let totalEvents = 0;

    const writeLineAdded = async (
      expenseId: Id<"expenses">,
      saveGroupId: string,
      line: SeedLine,
      sortOrder: number,
      timestamp: number,
    ): Promise<Id<"expense_lines">> => {
      const lineId = await ctx.db.insert("expense_lines", {
        expenseId,
        description: line.description,
        category: line.category,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        sortOrder,
      });
      await ctx.db.insert("expense_events", {
        expenseId,
        actorId: eddieId,
        actorRoleAtTime: "employee",
        eventType: "line_added",
        note: lineSummary(line),
        lineId,
        saveGroupId,
        timestamp,
      });
      totalLines += 1;
      totalEvents += 1;
      return lineId;
    };

    const writeEvent = async (
      expenseId: Id<"expenses">,
      actorId: Id<"users">,
      role: "employee" | "manager" | "finance",
      eventType: Doc<"expense_events">["eventType"],
      timestamp: number,
      note?: string,
    ): Promise<void> => {
      await ctx.db.insert("expense_events", {
        expenseId,
        actorId,
        actorRoleAtTime: role,
        eventType,
        note,
        timestamp,
      });
      totalEvents += 1;
    };

    // ── 1. Draft — Office supplies ────────────────────────────────────────
    const e1Created = now - 2 * ONE_DAY;
    const e1 = await ctx.db.insert("expenses", {
      employeeId: eddieId,
      status: "draft",
      summary: "Office supplies — printer ink and paper",
      currency: CURRENCY_USD,
      expenseDate: now - 1 * ONE_DAY,
    });
    await writeEvent(e1, eddieId, "employee", "created", e1Created);
    const e1Save = crypto.randomUUID();
    await writeLineAdded(
      e1,
      e1Save,
      {
        description: "Black ink cartridge",
        category: "supplies",
        quantity: 2,
        unitAmount: 24.99,
      },
      1,
      e1Created + 1000,
    );
    await writeLineAdded(
      e1,
      e1Save,
      {
        description: "A4 paper ream",
        category: "supplies",
        quantity: 1,
        unitAmount: 8.5,
      },
      2,
      e1Created + 1100,
    );

    // ── 2. Pending Manager — Bistro 12 lunch ──────────────────────────────
    const e2Created = now - 5 * ONE_DAY;
    const e2Submitted = now - 4 * ONE_DAY;
    const e2 = await ctx.db.insert("expenses", {
      employeeId: eddieId,
      status: "pending_manager",
      summary: "Client lunch at Bistro 12",
      currency: CURRENCY_USD,
      expenseDate: now - 4 * ONE_DAY - 2 * 60 * 60 * 1000,
      merchant: "Bistro 12",
      receiptStorageId: receipts.bistro,
      submittedAt: e2Submitted,
    });
    await writeEvent(e2, eddieId, "employee", "created", e2Created);
    const e2Save = crypto.randomUUID();
    await writeLineAdded(
      e2,
      e2Save,
      { description: "Lunch entrées (2x)", category: "meals", quantity: 2, unitAmount: 32 },
      1,
      e2Created + 1000,
    );
    await writeLineAdded(
      e2,
      e2Save,
      { description: "Beverages", category: "meals", quantity: 1, unitAmount: 18.5 },
      2,
      e2Created + 1100,
    );
    await writeLineAdded(
      e2,
      e2Save,
      { description: "Tip", category: "meals", quantity: 1, unitAmount: 7 },
      3,
      e2Created + 1200,
    );
    await writeEvent(e2, eddieId, "employee", "submitted", e2Submitted);

    // ── 3. Pending Finance — SaaS subscriptions ───────────────────────────
    const e3Created = now - 5 * ONE_DAY;
    const e3Submitted = now - 3 * ONE_DAY;
    const e3ManagerDecided = now - 2 * ONE_DAY;
    const e3 = await ctx.db.insert("expenses", {
      employeeId: eddieId,
      status: "pending_finance",
      summary: "Monthly SaaS subscriptions",
      currency: CURRENCY_USD,
      expenseDate: now - 5 * ONE_DAY,
      merchant: "Various",
      receiptStorageId: receipts.saas,
      submittedAt: e3Submitted,
      managerDecidedAt: e3ManagerDecided,
      managerDecidedBy: morganId,
    });
    await writeEvent(e3, eddieId, "employee", "created", e3Created);
    const e3Save = crypto.randomUUID();
    await writeLineAdded(
      e3,
      e3Save,
      { description: "Notion workspace seat", category: "software", quantity: 1, unitAmount: 14 },
      1,
      e3Created + 1000,
    );
    await writeLineAdded(
      e3,
      e3Save,
      { description: "Figma editor seat", category: "software", quantity: 1, unitAmount: 15 },
      2,
      e3Created + 1100,
    );
    await writeLineAdded(
      e3,
      e3Save,
      { description: "Linear standard seat", category: "software", quantity: 1, unitAmount: 10 },
      3,
      e3Created + 1200,
    );
    await writeEvent(e3, eddieId, "employee", "submitted", e3Submitted);
    await writeEvent(
      e3,
      morganId,
      "manager",
      "manager_approved",
      e3ManagerDecided,
      "Standard monthly tooling — approved.",
    );

    // ── 4. Approved — SF conference ───────────────────────────────────────
    const e4Created = now - 12 * ONE_DAY;
    const e4Submitted = now - 10 * ONE_DAY;
    const e4ManagerDecided = now - 8 * ONE_DAY;
    const e4FinanceDecided = now - 6 * ONE_DAY;
    const e4 = await ctx.db.insert("expenses", {
      employeeId: eddieId,
      status: "approved",
      summary: "Conference trip to SF",
      currency: CURRENCY_USD,
      expenseDate: now - 14 * ONE_DAY,
      merchant: "United Airlines + Hilton",
      receiptStorageId: receipts.sfconf,
      submittedAt: e4Submitted,
      managerDecidedAt: e4ManagerDecided,
      managerDecidedBy: morganId,
      financeDecidedAt: e4FinanceDecided,
      financeDecidedBy: fionaId,
    });
    await writeEvent(e4, eddieId, "employee", "created", e4Created);
    const e4Save = crypto.randomUUID();
    await writeLineAdded(
      e4,
      e4Save,
      { description: "Round-trip flight SFO", category: "travel", quantity: 1, unitAmount: 312 },
      1,
      e4Created + 1000,
    );
    await writeLineAdded(
      e4,
      e4Save,
      { description: "Conference proceedings (digital)", category: "software", quantity: 1, unitAmount: 100 },
      2,
      e4Created + 1100,
    );
    await writeEvent(e4, eddieId, "employee", "submitted", e4Submitted);
    await writeEvent(
      e4,
      morganId,
      "manager",
      "manager_approved",
      e4ManagerDecided,
      "Approved per Q2 travel budget.",
    );
    await writeEvent(
      e4,
      fionaId,
      "finance",
      "finance_approved",
      e4FinanceDecided,
      "Cleared for reimbursement.",
    );

    // ── 5. Rejected — Team offsite dinner ─────────────────────────────────
    const e5Created = now - 3 * ONE_DAY;
    const e5Submitted = now - 2 * ONE_DAY;
    const e5Rejected = now - 1 * ONE_DAY;
    const rejectReason =
      "Please itemize the meals and any alcohol separately, then resubmit.";
    const e5 = await ctx.db.insert("expenses", {
      employeeId: eddieId,
      status: "rejected",
      summary: "Team offsite dinner",
      currency: CURRENCY_USD,
      expenseDate: now - 3 * ONE_DAY,
      merchant: "The Tavern",
      receiptStorageId: receipts.tavern,
      submittedAt: e5Submitted,
      managerDecidedAt: e5Rejected,
      managerDecidedBy: morganId,
      rejectionReason: rejectReason,
      rejectedByRole: "manager",
    });
    await writeEvent(e5, eddieId, "employee", "created", e5Created);
    const e5Save = crypto.randomUUID();
    await writeLineAdded(
      e5,
      e5Save,
      { description: "Dinner for team", category: "meals", quantity: 1, unitAmount: 280 },
      1,
      e5Created + 1000,
    );
    await writeEvent(e5, eddieId, "employee", "submitted", e5Submitted);
    await writeEvent(
      e5,
      morganId,
      "manager",
      "rejected",
      e5Rejected,
      rejectReason,
    );

    return { expenses: 5, lines: totalLines, events: totalEvents };
  },
});

// ─── Public orchestrator action ─────────────────────────────────────────────

async function ensureUser(
  ctx: ActionCtx,
  email: string,
  password: string,
  displayName: string,
  role: "employee" | "manager" | "finance",
  managerId?: Id<"users">,
): Promise<{ userId: Id<"users">; created: boolean }> {
  const existing = await ctx.runQuery(internal.seed._findUserByEmail, { email });
  let userId: Id<"users">;
  let created = false;
  if (existing) {
    userId = existing._id;
  } else {
    const result = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: password },
      profile: { email },
    });
    userId = result.user._id as Id<"users">;
    created = true;
  }
  await ctx.runMutation(internal.seed._upsertProfile, {
    userId,
    displayName,
    role,
    managerId,
  });
  return { userId, created };
}

export const run = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    usersCreated: number;
    expensesCreated: number;
    linesCreated: number;
    eventsCreated: number;
    skippedExpensesSeed: boolean;
  }> => {
    const morgan = await ensureUser(
      ctx,
      "manager@example.com",
      "manager123!",
      "Morgan Manager",
      "manager",
    );
    const fiona = await ensureUser(
      ctx,
      "finance@example.com",
      "finance123!",
      "Fiona Finance",
      "finance",
    );
    const eddie = await ensureUser(
      ctx,
      "employee@example.com",
      "employee123!",
      "Eddie Employee",
      "employee",
      morgan.userId,
    );

    const usersCreated = [morgan, fiona, eddie].filter((u) => u.created).length;

    const existingCount = await ctx.runQuery(internal.seed._countExpensesForUser, {
      userId: eddie.userId,
    });
    if (existingCount > 0) {
      console.log(
        `Seed skipped: Eddie already has ${existingCount} expense(s). usersCreated=${usersCreated}`,
      );
      return {
        usersCreated,
        expensesCreated: 0,
        linesCreated: 0,
        eventsCreated: 0,
        skippedExpensesSeed: true,
      };
    }

    const jpegBytes = base64ToBytes(PLACEHOLDER_RECEIPT_JPEG_BASE64);
    const mkBlob = () => new Blob([jpegBytes as BlobPart], { type: "image/jpeg" });
    const receipts = {
      bistro: await ctx.storage.store(mkBlob()),
      saas: await ctx.storage.store(mkBlob()),
      sfconf: await ctx.storage.store(mkBlob()),
      tavern: await ctx.storage.store(mkBlob()),
    };

    const result = await ctx.runMutation(internal.seed._createSeedExpenses, {
      eddieId: eddie.userId,
      morganId: morgan.userId,
      fionaId: fiona.userId,
      receipts,
    });

    console.log(
      `Seed complete: usersCreated=${usersCreated}, expenses=${result.expenses}, lines=${result.lines}, events=${result.events}`,
    );

    return {
      usersCreated,
      expensesCreated: result.expenses,
      linesCreated: result.lines,
      eventsCreated: result.events,
      skippedExpensesSeed: false,
    };
  },
});
