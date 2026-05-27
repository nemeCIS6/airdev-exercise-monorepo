# Expense Tracker — Implementation Spec (Claude Code Handoff)

**Purpose**: This is the single document Claude Code uses to build the Expense Tracker. It is self-contained — paste it into Claude Code at the start of the session, then build top to bottom.

**Build budget**: ~6–8 hours including deploy.

**Stack**: Next.js (App Router) + TypeScript + Tailwind + Convex (DB + functions + file storage + auth, email/password).

**Reviewer test path** (optimize for this): log in as employee → submit an expense with a receipt → log in as manager → approve or reject → check status + history update correctly.

---

## 0. Decisions log (locked, do not re-litigate)

- **Scope is approval pipeline, not payment.** Statuses end at Approved/Rejected. No "Paid" / "Reimbursed."
- **Three roles in v1**: `employee`, `manager`, `finance`. Schema designed to allow `admin` later without migration.
- **Org model**: each employee has one assigned manager. Finance is a shared pool — any finance user can act at step 2 of the chain. Manager assignment is configurable from a manager-facing "Team" page.
- **Role provisioning**: self-serve signup always creates an `employee`. Manager and finance test accounts are created by the seed script.
- **Two-step approval chain (fixed in v1)**: every expense must be approved by the employee's manager AND a finance reviewer. Manager acts first; finance acts second. Either step can reject. Schema is designed to extend to configurable chains later.
- **Expense lifecycle**: `Draft → Pending (manager) → Pending (finance) → Approved`, or rejection from either pending step to `Rejected`. Rejected expenses can be edited and resubmitted (restart at step 1). Approved expenses are immutable. Pending expenses (at either step) can be Withdrawn back to Draft.
- **Draft persistence**: explicit "Save draft" button + warn-on-navigate when unsaved changes exist. **No debounced autosave.**
- **Approver actions**: Approve (note optional) or Reject (reason required, 5–500 chars). No "Request changes" state. Approval at step 1 advances to step 2; approval at step 2 finalizes. Rejection at either step terminates.
- **Audit trail**: separate `expense_events` table. Visible to employee, manager, and finance on the expense detail page. Records which role acted at each approval/rejection event.
- **Currency**: stored per-expense, no FX conversion. Dropdown limited to USD, EUR, GBP, CAD, AUD, JPY. Default USD.
- **Categories**: fixed enum: Travel, Meals, Lodging, Software, Supplies, Other.
- **Line items**: every expense is composed of 1+ line items. Each line has its own `description`, `category`, `quantity` (default 1), and `unitAmount`. The expense's currency, date, summary, merchant, and receipt are at the parent level. Total = sum of (quantity × unitAmount) across all lines.
- **Receipts**: required, single file, image (JPG/PNG/WebP) or PDF, 10MB cap. Stored in Convex file storage.
- **Manager visibility**: direct reports only (manager sees expenses at step 1 from their assigned employees).
- **Finance visibility**: all expenses at step 2 (org-wide). Finance does not see step-1 expenses unless they want to (read-only).
- **Managers and finance users cannot submit expenses in v1** (clean role separation; data model permits it later).
- **Dashboard**: filterable list + status counts. No charts, no CSV export.
- **Notifications**: none. Status is reflected in-app.
- **Auth**: Convex Auth with email/password provider.

---

## 1. Convex schema

File: `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Extends the auth user with app-specific fields.
  // Convex Auth's `users` table holds email/password; we attach role and manager here.
  userProfiles: defineTable({
    userId: v.id("users"),                    // FK to authTables.users
    displayName: v.string(),
    role: v.union(
      v.literal("employee"),
      v.literal("manager"),
      v.literal("finance"),
    ),
    managerId: v.optional(v.id("users")),     // employee → their assigned manager; null for managers and finance
  })
    .index("by_userId", ["userId"])
    .index("by_managerId", ["managerId"])
    .index("by_role", ["role"]),

  expenses: defineTable({
    employeeId: v.id("users"),                // submitter
    status: v.union(
      v.literal("draft"),
      v.literal("pending_manager"),           // step 1: awaiting manager review
      v.literal("pending_finance"),           // step 2: awaiting finance review
      v.literal("approved"),                  // both steps approved
      v.literal("rejected"),                  // rejected at any step
    ),
    summary: v.string(),                      // short description of the whole expense (e.g. "Team offsite dinner")
    currency: v.union(
      v.literal("USD"),
      v.literal("EUR"),
      v.literal("GBP"),
      v.literal("CAD"),
      v.literal("AUD"),
      v.literal("JPY"),
    ),
    expenseDate: v.number(),                  // unix ms; must be <= now
    merchant: v.optional(v.string()),
    receiptStorageId: v.optional(v.id("_storage")),  // Convex storage ID; required on submit, optional on draft
    submittedAt: v.optional(v.number()),      // set on first submit; preserved across withdraw/resubmit cycles
    managerDecidedAt: v.optional(v.number()), // set when manager approves or rejects
    managerDecidedBy: v.optional(v.id("users")),
    financeDecidedAt: v.optional(v.number()), // set when finance approves or rejects
    financeDecidedBy: v.optional(v.id("users")),
    rejectionReason: v.optional(v.string()),  // set on reject; cleared on resubmit
    rejectedByRole: v.optional(v.union(       // which step rejected; helpful for UI
      v.literal("manager"),
      v.literal("finance"),
    )),
  })
    .index("by_employee", ["employeeId"])
    .index("by_status", ["status"])
    .index("by_employee_and_status", ["employeeId", "status"]),

  expense_lines: defineTable({
    expenseId: v.id("expenses"),
    description: v.string(),                  // required, non-empty
    category: v.union(
      v.literal("travel"),
      v.literal("meals"),
      v.literal("lodging"),
      v.literal("software"),
      v.literal("supplies"),
      v.literal("other"),
    ),
    quantity: v.number(),                     // default 1, must be > 0
    unitAmount: v.number(),                   // must be > 0
    sortOrder: v.number(),                    // for stable display order; assigned on create
  })
    .index("by_expense", ["expenseId"])
    .index("by_expense_and_sortOrder", ["expenseId", "sortOrder"]),

  expense_events: defineTable({
    expenseId: v.id("expenses"),
    actorId: v.id("users"),
    actorRoleAtTime: v.union(                 // captured at write time so audit is accurate even if user's role changes later
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
      v.literal("manager_approved"),          // step 1 advanced to step 2
      v.literal("finance_approved"),          // step 2 finalized
      v.literal("rejected"),                  // see actorRoleAtTime for which step rejected
      v.literal("line_added"),
      v.literal("line_edited"),
      v.literal("line_removed"),
    ),
    note: v.optional(v.string()),             // rejection reason, approval note, or summary for line events
    lineId: v.optional(v.id("expense_lines")),  // present on line_* events; nullable because line may be deleted later
    saveGroupId: v.optional(v.string()),      // groups events from the same save action for collapsible UI
    timestamp: v.number(),
  })
    .index("by_expense", ["expenseId"])
    .index("by_expense_and_timestamp", ["expenseId", "timestamp"]),
});
```

**Notes for Claude Code:**
- Use Convex Auth's `authTables` spread to keep auth tables idiomatic.
- Do NOT put role/manager on the `users` table directly — that table is owned by the auth library. Use `userProfiles` as the join.
- Money: number is fine for this exercise (no currency math beyond display). Don't introduce a Decimal library.
- All timestamps are unix ms (`Date.now()`).
- `submittedAt` is set ONCE on first submit and survives the withdraw/edit/resubmit cycle. This makes the history accurate without extra fields.
- **Line items are stored in their own table** with `expenseId` FK and a `sortOrder` field for stable display ordering. When a line is added, assign `sortOrder = max(existing) + 1`. Don't reorder on delete.
- **Cascade delete**: when an expense is deleted (discardDraft), delete all its lines AND all its events.
- **`lineId` on events is optional** because a line may be deleted after the event was written. The event's `note` field carries the human-readable summary ("Tip — $15.00") so history is meaningful even after the line is gone.
- **`saveGroupId`**: when a single user save touches multiple lines (e.g. edits 2, adds 1, removes 1), all resulting events share the same generated uuid. The history UI uses this to collapse same-group events into one expandable entry. Generate via `crypto.randomUUID()` on the server.
- **Multi-step approval is hardcoded as Manager → Finance in v1.** The status enum makes this explicit. For v2 extensibility, a future `approval_chains` table could hold per-employee or per-category chains, and the `expenses` table could grow a `currentStep` integer. Don't build that table in v1, but the README should call this out as the extension point.
- **`actorRoleAtTime` on events** captures the role at write time, so if a user's role changes later (e.g., promoted from manager to finance), the audit trail remains accurate.

---

## 2. Server functions (Convex)

File layout:
- `convex/auth.ts` — Convex Auth configuration
- `convex/users.ts` — user profile reads/writes, team management
- `convex/expenses.ts` — expense CRUD and lifecycle
- `convex/events.ts` — expense_events queries (writes happen inside `expenses.ts` mutations)
- `convex/files.ts` — file upload URLs

Every function MUST check `auth.getUserId(ctx)` first. Throw if not authenticated. Then check role-based access. **No function trusts the client to pass role or userId.**

### 2.1 auth.ts
Standard Convex Auth setup with email/password provider. Reference: https://labs.convex.dev/auth.

### 2.2 users.ts

| Function | Type | Access | Purpose |
|---|---|---|---|
| `getMyProfile` | query | any authenticated | Returns the calling user's `userProfile` joined with `users` (email). Returns `null` if profile doesn't exist yet (newly signed-up user) — caller redirects to onboarding. |
| `completeOnboarding` | mutation | any authenticated | Creates a `userProfile` for the calling user. Takes `displayName`. Role hardcoded to `employee`. Assigns a default manager if any manager exists, otherwise leaves null. |
| `listMyTeam` | query | manager only | Returns all `userProfiles` where `managerId === ctx.userId`, joined with email. |
| `listAllEmployees` | query | manager only | Returns all `userProfiles` where `role === "employee"`, joined with email + their current `managerId`. For the Team page reassignment UI. |
| `reassignEmployeeManager` | mutation | manager only | Updates `userProfiles.managerId` for a given employee. Caller must be a manager. (Any manager can reassign any employee in v1; this is fine for the demo.) |

### 2.3 expenses.ts

All mutations that touch lines must wrap line-event writes in a single `saveGroupId` (one uuid per save action). Use `crypto.randomUUID()`.

All approval/rejection mutations must check the expense's current status against the actor's role. **Status is authoritative**: a manager can only act when status is `pending_manager`; a finance user can only act when status is `pending_finance`.

| Function | Type | Access | Purpose |
|---|---|---|---|
| `listMyExpenses` | query | employee | Returns calling user's expenses, sorted by most-recent first. Each expense joined with its lines. Supports optional `status` filter (multi-status, e.g. `["pending_manager", "pending_finance"]`) and date range. |
| `listExpensesForReview` | query | manager OR finance | **Role-aware**: if caller is `manager`, returns expenses where status === `pending_manager` AND submitter's `managerId === ctx.userId`, sorted by `submittedAt` ASC. If caller is `finance`, returns expenses where status === `pending_finance` across the entire org, sorted by `managerDecidedAt` ASC. Same line-joining and filter shape (status, date range, optional `employeeId`). |
| `getExpense` | query | employee (own) OR manager (of submitter) OR finance (any) | Returns one expense + submitter profile + all lines (sorted by sortOrder). Authorization: caller is submitter, OR caller is manager AND submitter's `managerId === caller`, OR caller is finance (any expense). |
| `createDraft` | mutation | employee | Creates a draft. Takes `summary`, `currency`, `expenseDate`, and optional initial line. If no line provided, creates one empty placeholder. Writes `created` event with `actorRoleAtTime = "employee"`. Returns new expense `_id`. |
| `updateDraft` | mutation | employee (own) | Updates parent-level fields on a draft. Rejects if status not in `["draft", "rejected"]`. |
| `saveDraftWithLines` | mutation | employee (own) | Single mutation: takes `{ expenseId, parentFields, lines: [...] }`, diffs lines server-side, writes appropriate `line_added` / `line_edited` / `line_removed` events all sharing one `saveGroupId`. Updates parent fields atomically. Allowed on draft or rejected status. |
| `submitExpense` | mutation | employee (own) | Validates: at least one line, all lines valid, receiptStorageId present, summary non-empty, expenseDate <= now. Transitions `draft → pending_manager`. Sets `submittedAt = Date.now()` if not already set. Writes `submitted` event. |
| `withdrawExpense` | mutation | employee (own) | Transitions `pending_manager → draft` OR `pending_finance → draft`. Writes `withdrawn` event. `submittedAt` preserved on the record. Clears `managerDecidedAt`, `managerDecidedBy` if the expense was at pending_finance (since the approval is being undone). |
| `resubmitRejected` | mutation | employee (own) | Same validation as `submitExpense`. Transitions `rejected → pending_manager` (always restarts at step 1, even if finance was the rejecter). Clears `rejectionReason`, `rejectedByRole`, and previous decision fields. Writes `resubmitted` event. |
| `managerApprove` | mutation | manager (of submitter) | Allowed only when status === `pending_manager`. Transitions to `pending_finance`. Sets `managerDecidedAt`, `managerDecidedBy`. Writes `manager_approved` event with optional note and `actorRoleAtTime = "manager"`. |
| `managerReject` | mutation | manager (of submitter) | Allowed only when status === `pending_manager`. Requires `reason` (5–500 chars). Transitions to `rejected`. Sets `managerDecidedAt`, `managerDecidedBy`, `rejectionReason`, `rejectedByRole = "manager"`. Writes `rejected` event with `actorRoleAtTime = "manager"`. |
| `financeApprove` | mutation | finance (any) | Allowed only when status === `pending_finance`. Transitions to `approved`. Sets `financeDecidedAt`, `financeDecidedBy`. Writes `finance_approved` event with optional note and `actorRoleAtTime = "finance"`. |
| `financeReject` | mutation | finance (any) | Allowed only when status === `pending_finance`. Requires `reason` (5–500 chars). Transitions to `rejected`. Sets `financeDecidedAt`, `financeDecidedBy`, `rejectionReason`, `rejectedByRole = "finance"`. Writes `rejected` event with `actorRoleAtTime = "finance"`. |
| `discardDraft` | mutation | employee (own) | Deletes a draft, all its lines, all its events. Deletes the receipt file from storage if present. Only allowed on `draft` status. |

**Authorization helpers** (use throughout):

```typescript
// Inside expenses.ts
async function getCallerProfile(ctx) {
  const callerId = await getAuthUserId(ctx);
  if (!callerId) throw new Error("Unauthenticated");
  const profile = await ctx.db.query("userProfiles")
    .withIndex("by_userId", q => q.eq("userId", callerId)).unique();
  if (!profile) throw new Error("No profile");
  return { callerId, profile };
}

async function assertManagerOfSubmitter(ctx, expense) {
  const { callerId, profile } = await getCallerProfile(ctx);
  if (profile.role !== "manager") throw new Error("Not a manager");
  const submitterProfile = await ctx.db.query("userProfiles")
    .withIndex("by_userId", q => q.eq("userId", expense.employeeId)).unique();
  if (submitterProfile?.managerId !== callerId) throw new Error("Not your direct report");
}

async function assertFinanceRole(ctx) {
  const { profile } = await getCallerProfile(ctx);
  if (profile.role !== "finance") throw new Error("Not finance");
}
```

### 2.4 events.ts

| Function | Type | Access | Purpose |
|---|---|---|---|
| `listEventsForExpense` | query | same as `getExpense` (employee own, manager of submitter, any finance) | Returns events for an expense, sorted by timestamp DESC, joined with actor display name. |

### 2.5 files.ts

| Function | Type | Access | Purpose |
|---|---|---|---|
| `generateUploadUrl` | mutation | employee | Returns a Convex file upload URL. |
| `getReceiptUrl` | query | same as `getExpense` (employee own, manager of submitter, any finance) | Takes `storageId`, returns signed URL for display/download. |

**Receipt validation**: file type and size are validated client-side AND on the next mutation (`updateDraft` or `submitExpense`) — the server checks the file's metadata via `ctx.storage.getMetadata(storageId)` and rejects oversized or wrong-type files. Don't trust the client.

---

## 3. Frontend route tree

Next.js App Router. All routes under `app/`.

```
app/
├── layout.tsx                          # Convex provider, auth provider, top nav
├── page.tsx                            # Redirects: unauth → /sign-in, employee → /expenses, manager → /review, finance → /finance/review
├── sign-in/page.tsx                    # Email + password sign-in
├── sign-up/page.tsx                    # Email + password sign-up + display name capture
├── onboarding/page.tsx                 # If signed in but no userProfile, capture displayName
│
├── (employee)/                         # Route group, guards: role === "employee"
│   ├── expenses/
│   │   ├── page.tsx                    # List of my expenses (table, filters)
│   │   ├── new/page.tsx                # New expense form (creates draft, then redirects to detail)
│   │   └── [id]/page.tsx               # Expense detail + edit (if draft/rejected) + history timeline
│
├── (manager)/                          # Route group, guards: role === "manager"
│   ├── review/
│   │   ├── page.tsx                    # List of expenses at pending_manager from my direct reports
│   │   └── [id]/page.tsx               # Expense detail (read-only fields) + approve/reject (if pending_manager) + history
│   └── team/page.tsx                   # List of all employees with manager-assignment dropdowns
│
├── (finance)/                          # Route group, guards: role === "finance"
│   └── finance/
│       └── review/
│           ├── page.tsx                # List of expenses at pending_finance, org-wide
│           └── [id]/page.tsx           # Expense detail (read-only) + approve/reject (if pending_finance) + history
```

**Route guards**: implemented as a `<RoleGuard role="employee" | "manager" | "finance">` wrapper component in each route group layout. The wrapper:
1. Calls `getMyProfile`.
2. If null → redirects to `/onboarding`.
3. If role mismatch → redirects to the right home (employee → `/expenses`, manager → `/review`, finance → `/finance/review`).
4. Otherwise renders children.

**Top nav** (in `app/layout.tsx`):
- Employee: "My Expenses" · "New Expense" · (user menu with sign out)
- Manager: "Review" · "Team" · (user menu with sign out)
- Finance: "Review" · (user menu with sign out)
- Unauthenticated: "Sign in" · "Sign up"

---

## 4. Key component specs

### 4.1 Expense list table (shared between employee and manager views)

Columns:
- Employee view: Date · Summary · Categories · Total · Status · (link to detail)
- Manager view: Date · Employee · Summary · Categories · Total · Status · (link to detail)

The **Categories** column shows a breakdown derived from the expense's lines:
- Group line totals by category, sort by subtotal descending
- Render up to 3 categories as `"Meals $240.00 · Software $40.00 · Travel $15.00"` (formatted with the expense's currency symbol)
- If more than 3, append `· +N more`
- If only one category, render just that category name + total
- Cap text length at ~60 chars; truncate with ellipsis if needed

The **Total** column shows the sum of all `(quantity × unitAmount)` across the expense's lines, formatted in the expense's currency.

Filters above the table:
- Status (multi-select; default: employee = all, manager = `["pending"]`)
- Date range (two date inputs; default: empty)
- (Category filter removed — categories are now per-line; filtering at the expense level is ambiguous. If we add it back later, it would mean "expenses containing at least one line of this category.")

Empty state: "No expenses yet." + CTA to create one (employee only).
Loading state: skeleton rows.
Error state: friendly message + retry button.

Status badges:
- Draft → gray
- Pending (manager) → yellow with label "Pending Manager"
- Pending (finance) → blue with label "Pending Finance"
- Approved → green
- Rejected → red (badge tooltip shows "Rejected by Manager" or "Rejected by Finance" based on `rejectedByRole`)

### 4.2 New / Edit expense form

**Parent-level fields** (in this order, at the top of the form):
1. Summary (text input, required, placeholder "What was this expense for?" — short, one-liner)
2. Expense date (date picker, required, max = today, default today)
3. Currency (dropdown, default USD)
4. Merchant (text, optional)
5. Receipt (file input, required on submit, optional on save-draft) — image preview or PDF filename

**Line items section** (below parent fields, heading "Line items"):
- Renders a row per line. Each row has:
  - Description (text input, required, ~40% width)
  - Category (Select dropdown, required, ~20% width)
  - Quantity (number input, default 1, min 0.01, ~10% width)
  - Unit amount (number input, required, > 0, ~15% width)
  - Computed line total (read-only display: `quantity × unitAmount`, formatted in expense currency)
  - Remove button (trash icon; disabled when only one line remains)
- "Add line" button below the list adds a new empty row
- Below all rows: "Total: $XXX.XX" (sum of all line totals)

**Behavior**:
- The form starts with one empty line row when creating a new draft
- Adding/editing/removing lines triggers the warn-on-navigate dirty state (covered by `useUnsavedChangesWarning`)
- Saving the draft persists all current lines to the server in one mutation batch (the client diffs against the last-saved state and calls `addLine` / `updateLine` / `removeLine` as needed, each sharing the same generated `saveGroupId` — or, simpler: a single `saveDraftLines` mutation that accepts the full list and does the diff server-side)

> **Implementation note for Claude Code**: prefer the server-side diff approach. Expose a single `saveDraftWithLines` mutation that takes `{ expenseId, parentFields, lines: [...] }`, generates a `saveGroupId`, diffs against current lines, and writes the appropriate events. This keeps the client simple and guarantees atomicity. Lines are matched by their `_id` (client preserves it across edits); new lines have no `_id` yet.

Buttons (state-dependent):
- Draft: "Save draft" · "Submit" · "Discard draft"
- Rejected (editable): "Save changes" · "Resubmit" — show the rejection reason at the top in a banner
- Pending: read-only fields, "Withdraw" button
- Approved: read-only fields, no actions

**Warn-on-navigate**: when in Draft or Rejected state with unsaved field changes, attach a `beforeunload` listener that prompts the user. Reset the dirty flag on save. Use a custom hook `useUnsavedChangesWarning(isDirty: boolean)`.

### 4.3 Expense detail page (employee)

Layout:
- Top: status badge + employee name + submitted/decided timestamps
- Middle: parent fields (summary, date, currency, merchant, receipt). In edit mode (draft/rejected): full form including line items section. In read-only mode (pending/approved): rendered as a labeled key-value list.
- **Line items section** (read-only mode): rendered as a table with columns Description · Category · Qty · Unit · Total, with a final row showing the grand total.
- Bottom: history timeline (see 4.5)

If rejected: prominent banner at top showing the rejection reason and "Edit and resubmit" CTA.

### 4.4 Expense detail page (manager)

Layout:
- Top: status badge + submitter name + submitted timestamp
- Middle: read-only parent fields including receipt (image inline, PDF "View receipt" link)
- **Line items table** (read-only): Description · Category · Qty · Unit · Total + grand total row
- Action bar (only shown if status === `pending_manager`):
  - "Approve" button → inline expansion with optional note textarea + "Confirm approval" (advances to pending_finance)
  - "Reject" button → inline expansion with required reason textarea (5–500 chars) + "Confirm rejection"
- If status is `pending_finance`, `approved`, or `rejected`: no action bar. Show informational text: "Awaiting finance review" / "Approved by finance on {date}" / "Rejected by {role} on {date}".
- Bottom: history timeline

### 4.4b Expense detail page (finance)

Layout:
- Top: status badge + submitter name + submitter's manager name + both `submittedAt` and `managerDecidedAt` timestamps
- Middle: read-only parent fields including receipt
- **Line items table** (read-only)
- **Manager approval summary block** (always visible, since by the time finance sees an expense the manager has already acted): "Approved by {Morgan Manager} on {date}" plus the manager's approval note if any. Renders as a small card / callout above the action bar.
- Action bar (only shown if status === `pending_finance`):
  - "Approve" button → inline expansion with optional note textarea + "Confirm approval" (finalizes to approved)
  - "Reject" button → inline expansion with required reason textarea (5–500 chars) + "Confirm rejection"
- If status is not `pending_finance`: no action bar; informational text only.
- Bottom: history timeline

### 4.5 History timeline

Visual: reverse-chronological vertical list. Each entry:
- Icon (one per event type)
- Actor name + action verb (e.g., "Alice submitted this expense")
- Timestamp (relative + absolute on hover)
- Optional note rendered as a quote block (always shown for rejections, line summaries, approval notes)

**Event icons** (using `lucide-react`):
- created → `FilePlus`
- submitted → `Send`
- withdrawn → `Undo2`
- edited → `Pencil`
- resubmitted → `Repeat`
- manager_approved → `CheckCircle2` (with subtle "step 1" indicator)
- finance_approved → `CheckCircle2` (with subtle "step 2" indicator)
- rejected → `XCircle`
- line_added → `Plus`
- line_edited → `Pencil`
- line_removed → `Minus`

**Action verbs**:
- `created` / `submitted` / `withdrawn` / `edited` / `resubmitted` — render with the actor's name: "Eddie submitted this expense"
- `manager_approved` — "Morgan approved at the manager step"
- `finance_approved` — "Fiona approved at the finance step"
- `rejected` — "Morgan rejected this expense" or "Fiona rejected this expense" (the `actorRoleAtTime` field distinguishes; the note carries the required reason)

**Action verbs for line events**:
- `line_added`: "added line"
- `line_edited`: "edited line"
- `line_removed`: "removed line"
- (each shows the line summary in the note: e.g., "Tip — $15.00")

**Grouping by `saveGroupId`**: when 3+ consecutive events in the timeline share the same `saveGroupId`, render them as a single collapsed entry:
- Header: "{actor} edited line items" + a summary like "(added 1, edited 2, removed 1)"
- Click to expand → shows the individual line events as a nested list
- The group's timestamp is the timestamp of the first event in the group
- Standalone events (no group match) render normally

Empty state: should never occur (every expense has at least a `created` event).

### 4.6 Team page (manager)

Table: Display name · Email · Current manager (dropdown of all managers + "Unassigned"). Save on dropdown change with toast confirmation. Includes the employee already pre-linked to the seed manager.

---

## 5. Seed script

File: `convex/seed.ts` (run via `npx convex run seed:run`)

**Idempotent**: re-running should not create duplicates. Check by email before inserting.

Creates:

**Users (via Convex Auth's admin signup, or direct insert + a separate password setup)**:
- `manager@example.com` / `manager123!` — role `manager`, displayName "Morgan Manager"
- `finance@example.com` / `finance123!` — role `finance`, displayName "Fiona Finance"
- `employee@example.com` / `employee123!` — role `employee`, displayName "Eddie Employee", managerId → Morgan's userId

**Expenses** (all owned by Eddie). Each expense's `summary`, `currency`, and `merchant` are at the parent level; categories and amounts live on the line items.

The seed data covers all five statuses (`draft`, `pending_manager`, `pending_finance`, `approved`, `rejected`) across five expenses, so each role sees something interesting on first login.

1. **Draft** — Summary: "Office supplies — printer ink and paper", USD, no merchant yet, no receipt yet.
   - Lines:
     - "Black ink cartridge" · supplies · qty 2 · $24.99 = $49.98
     - "A4 paper ream" · supplies · qty 1 · $8.50 = $8.50
   - Total: $58.48
   - Events: [created]

2. **Pending Manager** — Summary: "Client lunch at Bistro 12", USD, merchant "Bistro 12", with a seed receipt file. Visible in Morgan's queue.
   - Lines:
     - "Lunch entrées (2x)" · meals · qty 2 · $32.00 = $64.00
     - "Beverages" · meals · qty 1 · $18.50 = $18.50
     - "Tip" · meals · qty 1 · $7.00 = $7.00
   - Total: $89.50
   - Events: [created, line_added×3 (same saveGroupId), submitted]

3. **Pending Finance** — Summary: "Monthly SaaS subscriptions", USD, merchant "Various", with a seed receipt file. Already approved by Morgan; visible in Fiona's queue.
   - Lines:
     - "Notion workspace seat" · software · qty 1 · $14.00 = $14.00
     - "Figma editor seat" · software · qty 1 · $15.00 = $15.00
     - "Linear standard seat" · software · qty 1 · $10.00 = $10.00
   - Total: $39.00
   - Events: [created, line_added×3 (same saveGroupId), submitted, manager_approved (by Morgan, note: "Standard monthly tooling — approved.")]
   - `submittedAt` ≈ 3 days ago, `managerDecidedAt` ≈ 2 days ago.

4. **Approved** — Summary: "Conference trip to SF", USD, merchant "United Airlines + Hilton", with a seed receipt file. Fully approved by both steps.
   - Lines:
     - "Round-trip flight SFO" · travel · qty 1 · $312.00 = $312.00
     - "Conference proceedings (digital)" · software · qty 1 · $100.00 = $100.00
   - Total: $412.00
   - Events: [created, line_added×2 (same saveGroupId), submitted, manager_approved (by Morgan, note: "Approved per Q2 travel budget."), finance_approved (by Fiona, note: "Cleared for reimbursement.")]

5. **Rejected** — Summary: "Team offsite dinner", USD, merchant "The Tavern", with a seed receipt file. Rejected at the manager step.
   - Lines (intentionally vague — that's why it got rejected):
     - "Dinner for team" · meals · qty 1 · $280.00 = $280.00
   - Total: $280.00
   - Events: [created, line_added, submitted, rejected (by Morgan, `actorRoleAtTime: "manager"`, reason: "Please itemize the meals and any alcohol separately, then resubmit.")]
   - `rejectedByRole = "manager"`

**Seed receipt files**: use any small placeholder JPGs committed to the repo under `convex/seed-assets/`. Upload them via `ctx.storage.store()` inside the seed function.

---

## 6. Environment variables

`.env.example`:

```
# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=

# Convex Auth
JWT_PRIVATE_KEY=
JWKS=
SITE_URL=http://localhost:3000
```

Generate Convex Auth keys per the docs: https://labs.convex.dev/auth/setup. The `SITE_URL` must match the deployed Vercel URL in production.

---

## 7. README.md outline

```markdown
# Expense Tracker

Internal expense tracker with employee submission and a two-step approval chain (manager + finance).

## Live demo
- URL: <vercel-url>
- Employee: employee@example.com / employee123!
- Manager: manager@example.com / manager123!
- Finance: finance@example.com / finance123!

## Quick start
1. `npm install`
2. `npx convex dev` (follow prompts to create deployment)
3. Copy `.env.example` to `.env.local` and fill values
4. `npx convex run seed:run` to seed test data
5. `npm run dev`

## Tech stack
Next.js (App Router) · TypeScript · Tailwind · Convex (DB + functions + file storage + Auth)

## Design decisions
- **Approval pipeline, not payment tracker.** v1 ends at Approved/Rejected; reimbursement is a future scope concern.
- **Two-step approval chain (Manager → Finance) is fixed in v1.** Every expense must be approved by the employee's assigned manager AND a member of the finance pool before being marked Approved. Either step can reject. This satisfies the "multi-level approvals" requirement from the brief in the simplest form that's still genuinely two-step. The schema (status enum + per-step decision fields) is designed so the chain can be made configurable in v2: a future `approval_chains` table could hold per-employee, per-amount, or per-category chains, and `expenses` could track a `currentStep` integer.
- **Finance is a shared pool.** Any user with the `finance` role can act at step 2 — whoever picks it up first owns the decision. Direct-report scoping applies only at step 1 (manager).
- **Resubmit always restarts at step 1.** Even if finance rejected, the manager reviews again. Conservative choice — finance concerns are often shared by the manager, and skipping the manager on resubmit would be surprising.
- **One manager per employee.** Configurable from the manager's Team page. Designed to extend to chained or branched approval graphs later.
- **Self-serve signup creates employees only.** Manager and finance accounts are seeded. Promotion is admin work, out of v1 scope.
- **Expenses are composed of line items.** Each line carries its own category and amount; the parent holds shared context (summary, currency, date, merchant, receipt). This reflects how itemized receipts actually work — a single dinner check may include food, drinks, and tip under different policies. The seed's rejected expense exists precisely to demonstrate this: "Please itemize and resubmit."
- **Drafts persist explicitly.** Save Draft button + browser warn-on-navigate. Chose this over debounced autosave because the visible button advertises the feature to reviewers and avoids edge cases (race conditions, orphan drafts) in a tight build window.
- **History as a separate table.** `expense_events` keeps the audit trail queryable and immutable without bloating the expense record. Events capture `actorRoleAtTime` so the audit remains accurate even if a user's role changes later. Line-level events share a `saveGroupId` so the timeline can collapse same-save events into one expandable entry.
- **Fixed category and currency lists.** Six currencies, six categories. Forward-compatible with the brief's "different countries" hint without committing to 180 ISO codes.

## Assumptions
- Single company / single tenant. Multi-org is not in v1.
- Currency is stored per-expense (not per line) but not converted. FX is future scope.
- Every expense has at least one line item. The form starts new drafts with one empty line.
- Managers and finance users cannot submit expenses in v1. Clean role separation; the data model supports adding it later (a `finance` user submitting would just route to their assigned manager like any employee).
- Rejection requires a reason (5–500 chars). Approval notes are optional at both steps.
- Approved expenses are immutable. Rejected expenses are editable and resubmittable; resubmit always restarts at the manager step.
- Withdraw is available from both `pending_manager` and `pending_finance` — withdrawing from `pending_finance` undoes the manager's prior approval.
- Receipts are required on submit (image or PDF, ≤10MB) at the parent level — one receipt per expense, regardless of line count.
- No notifications. Status is reflected in-app.

## Out of scope for v1
Payment tracking · configurable approval chains (chain is fixed at Manager → Finance) · approval routing by amount/category · multi-currency FX · admin role · notifications · social login · CSV export · field-level audit diffs.

## Project structure
[short tree]
```

---

## 8. Build order (suggested for Claude Code)

This order minimizes rework — each step's output is consumed by the next.

1. **Scaffold**: `npx create-next-app`, add Tailwind, `npm i convex @convex-dev/auth`, init Convex.
2. **Schema** (section 1) including the `expense_lines` table, all three roles, and the multi-step status enum. Push and verify in the Convex dashboard.
3. **Auth wiring** (section 2.1) — sign in / sign up / sign out, plus `/onboarding` for first-time profile creation.
4. **`getMyProfile` + RoleGuard + redirect logic for all three roles** — get the role-based routing skeleton working with placeholder pages first. Verify all three test accounts route to the correct landing page once seeded.
5. **Expense list + filters** (employee side, then manager side, then finance side). Use the same table component across all three; the role-aware `listExpensesForReview` query drives manager and finance views. Render the line-derived Categories breakdown and Total columns from the lines joined into each row.
6. **New expense form (parent fields only)** + file upload (sections 2.3, 2.5, 4.2). Save draft works at the parent level. Submit is blocked at this step (needs lines).
7. **Line items section in the form** — add/edit/remove rows, server-side diff via `saveDraftWithLines`, validation. Submit now works end-to-end → `pending_manager`.
8. **Expense detail page** (employee, section 4.3) with line items rendered. Edit-on-draft works. Withdraw works (from both pending states). Resubmit-on-reject works (restarts at pending_manager).
9. **Manager detail page** (section 4.4) with line items table. `managerApprove` advances to `pending_finance`; `managerReject` terminates. Inline confirmation expansions.
10. **Finance detail page** (section 4.4b) with the manager-approval summary block at the top. `financeApprove` finalizes to `approved`; `financeReject` terminates.
11. **History timeline** (section 4.5) on all three detail pages, including line events with saveGroupId-based collapsing AND the new manager_approved / finance_approved event types.
12. **Team page** (section 4.6, manager only). Reassignment works.
13. **Empty / loading / error states** swept across all pages.
14. **Seed script** (section 5). Run it. Verify all three test accounts log in to a populated app with the right things in their queues (Morgan sees the pending_manager expense; Fiona sees the pending_finance expense).
15. **Deploy**: Convex production deployment + Vercel. Confirm env vars, run seed against prod, smoke-test the reviewer path end to end.
16. **README** (section 7).

**Time buffer**: aim to finish step 15 with at least 30 minutes left. The reviewer judges what's on the live URL — a polished local app that doesn't deploy cleanly is a failed submission.

**Where to cut if running long**: in priority order, drop (a) the saveGroupId timeline grouping (still write the events, just don't collapse them visually), (b) the finance-route status badge tooltip detail, (c) the Team page reassignment dropdown (read-only list of employees is enough to demonstrate the data model). Do NOT cut the two-step approval flow, the line items, or the seed data — those are the spine of the demo.

---

## 9. Submission checklist (from brief)

- [ ] Public GitHub repo
- [ ] `README.md` with setup instructions and design decisions including the two-step approval rationale
- [ ] `.env.example` with all required env vars
- [ ] Live Vercel deployment URL, fully functional
- [ ] Seed run against production
- [ ] **Three** test account credentials sent in submission message — one employee and one manager (as the brief requires), plus one finance account so the reviewer can complete the full two-step approval flow on the live URL
- [ ] End-to-end verified on the live URL:
  - employee submits → manager approves → finance approves → status flips through pending_manager → pending_finance → approved, history updates at each step
  - employee submits → manager rejects → employee edits and resubmits → restarts at pending_manager → manager approves → finance approves
  - employee submits → manager approves → finance rejects → expense ends at rejected, history shows the finance rejection
