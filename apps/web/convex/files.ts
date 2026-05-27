import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertRole, canReadExpense } from "./lib/auth";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    await assertRole(ctx, "employee");
    return ctx.storage.generateUploadUrl();
  },
});

export const getReceiptUrl = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }): Promise<string | null> => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    await canReadExpense(ctx, expense);
    if (!expense.receiptStorageId) return null;
    return ctx.storage.getUrl(expense.receiptStorageId);
  },
});
