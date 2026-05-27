import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  userProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    role: v.union(
      v.literal("employee"),
      v.literal("manager"),
      v.literal("finance"),
    ),
    managerId: v.optional(v.id("users")),
  })
    .index("by_userId", ["userId"])
    .index("by_managerId", ["managerId"])
    .index("by_role", ["role"]),

  expenses: defineTable({
    employeeId: v.id("users"),
    status: v.union(
      v.literal("draft"),
      v.literal("pending_manager"),
      v.literal("pending_finance"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    summary: v.string(),
    currency: v.union(
      v.literal("USD"),
      v.literal("EUR"),
      v.literal("GBP"),
      v.literal("CAD"),
      v.literal("AUD"),
      v.literal("JPY"),
    ),
    expenseDate: v.number(),
    merchant: v.optional(v.string()),
    receiptStorageId: v.optional(v.id("_storage")),
    submittedAt: v.optional(v.number()),
    managerDecidedAt: v.optional(v.number()),
    managerDecidedBy: v.optional(v.id("users")),
    financeDecidedAt: v.optional(v.number()),
    financeDecidedBy: v.optional(v.id("users")),
    rejectionReason: v.optional(v.string()),
    rejectedByRole: v.optional(
      v.union(v.literal("manager"), v.literal("finance")),
    ),
  })
    .index("by_employee", ["employeeId"])
    .index("by_status", ["status"])
    .index("by_employee_and_status", ["employeeId", "status"]),

  expense_lines: defineTable({
    expenseId: v.id("expenses"),
    description: v.string(),
    category: v.union(
      v.literal("travel"),
      v.literal("meals"),
      v.literal("lodging"),
      v.literal("software"),
      v.literal("supplies"),
      v.literal("other"),
    ),
    quantity: v.number(),
    unitAmount: v.number(),
    sortOrder: v.number(),
  })
    .index("by_expense", ["expenseId"])
    .index("by_expense_and_sortOrder", ["expenseId", "sortOrder"]),

  expense_events: defineTable({
    expenseId: v.id("expenses"),
    actorId: v.id("users"),
    actorRoleAtTime: v.union(
      v.literal("employee"),
      v.literal("manager"),
      v.literal("finance"),
    ),
    eventType: v.union(
      v.literal("created"),
      v.literal("submitted"),
      v.literal("withdrawn"),
      v.literal("edited"),
      v.literal("resubmitted"),
      v.literal("manager_approved"),
      v.literal("finance_approved"),
      v.literal("rejected"),
      v.literal("line_added"),
      v.literal("line_edited"),
      v.literal("line_removed"),
    ),
    note: v.optional(v.string()),
    lineId: v.optional(v.id("expense_lines")),
    saveGroupId: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_expense", ["expenseId"])
    .index("by_expense_and_timestamp", ["expenseId", "timestamp"]),
});
