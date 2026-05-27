# Claude Design Follow-up #2 — Add Two-Step Approval (Manager + Finance)

> Paste this in the **same Claude Design chat** as before, after the line-items refactor is done. This builds on the existing prototype.

---

Update the prototype to support a **two-step approval chain**. Every expense now goes through both a manager and a finance reviewer before being marked Approved. Either step can reject.

This adds a new role (`finance`) and a new in-between status, but keeps everything else from the current prototype intact (auth flow, line items, history timeline, etc.).

## New role: Finance

Add a third user role: `finance`. Add a new mock user:

- `finance@example.com` / any password → role `finance`, displayName "Fiona Finance"

Sign-in routes by email exactly as before. Finance users have their own landing page and review queue.

## New status model

Replace the single `pending` status with two:

- `draft` (unchanged)
- `pending_manager` (was `pending` — awaiting step 1, the assigned manager)
- `pending_finance` (new — manager approved, awaiting step 2, anyone in finance)
- `approved` (unchanged — both steps approved)
- `rejected` (unchanged — but track WHICH role rejected)

Status badges in the UI:
- Draft → gray (unchanged)
- Pending Manager → yellow (rename the existing "Pending" badge)
- Pending Finance → blue (new)
- Approved → green (unchanged)
- Rejected → red. On hover, tooltip shows "Rejected by Manager" or "Rejected by Finance" depending on `rejectedByRole`.

## Expense data shape additions

Each expense now tracks two decision rows:

```
managerDecidedAt?: number
managerDecidedBy?: userId
financeDecidedAt?: number
financeDecidedBy?: userId
rejectedByRole?: "manager" | "finance"
```

The old `decidedAt` / `decidedBy` fields are replaced by these.

## Updated mock data

Replace the existing four seeded expenses with **five** new ones covering all five states. The fifth expense gives the finance user something in their queue on first login.

1. **Draft** — "Office supplies — printer ink and paper", USD, no receipt
   - Lines: "Black ink cartridge" supplies qty 2 $24.99 ($49.98), "A4 paper ream" supplies qty 1 $8.50 ($8.50)
   - Total: $58.48
   - History: [created]

2. **Pending Manager** — "Client lunch at Bistro 12", USD, merchant "Bistro 12", receipt `bistro-12-receipt.jpg`
   - Lines: "Lunch entrées" meals qty 2 $32.00 ($64.00), "Beverages" meals qty 1 $18.50, "Tip" meals qty 1 $7.00
   - Total: $89.50
   - History: [created, line_added × 3 (same saveGroupId), submitted]
   - **Visible in Morgan's queue.**

3. **Pending Finance** — "Monthly SaaS subscriptions", USD, merchant "Various", receipt `saas-receipts.pdf` (PDF icon)
   - Lines: "Notion workspace seat" software qty 1 $14.00, "Figma editor seat" software qty 1 $15.00, "Linear standard seat" software qty 1 $10.00
   - Total: $39.00
   - History: [created, line_added × 3 (same saveGroupId), submitted, manager_approved by Morgan with note "Standard monthly tooling — approved."]
   - **Visible in Fiona's queue.**
   - submittedAt: 3 days ago. managerDecidedAt: 2 days ago.

4. **Approved** — "Conference trip to SF", USD, merchant "United Airlines + Hilton", receipt `conference-receipt.pdf`
   - Lines: "Round-trip flight SFO" travel qty 1 $312.00, "Conference proceedings (digital)" software qty 1 $100.00
   - Total: $412.00
   - History: [created, line_added × 2 (same saveGroupId), submitted, manager_approved by Morgan with note "Approved per Q2 travel budget.", finance_approved by Fiona with note "Cleared for reimbursement."]

5. **Rejected** — "Team offsite dinner", USD, merchant "The Tavern", receipt `tavern-receipt.jpg`
   - Lines: "Dinner for team" meals qty 1 $280.00
   - Total: $280.00
   - History: [created, line_added, submitted, rejected by Morgan (`rejectedByRole: "manager"`, reason: "Please itemize the meals and any alcohol separately, then resubmit.")]
   - `rejectedByRole: "manager"`

## New Finance landing experience

- **Top nav** for finance users: logo · "Review" · (user menu with name + "Sign out")
- **Default landing page** after sign-in as finance: `/finance/review` (or whatever route shape matches the prototype's internal routing)
- **Finance queue table**: same component as manager review, but the list shows all expenses where `status === "pending_finance"` across the org (not scoped to direct reports). Sorted by `managerDecidedAt` ascending (oldest pending finance review first).
- Columns: Submitted on · Employee · Manager (name of submitter's manager) · Summary · Categories · Total · (row click → detail)

## Updated manager review queue

The manager queue now shows only expenses where `status === "pending_manager"` AND the submitter's manager is the current user. Same table component, same column set as before (Date · Employee · Summary · Categories · Total · Status).

If the manager opens an expense at a later step (e.g., they navigate to it directly), show it read-only with an info banner: "This expense has moved past your review stage."

## New: Finance detail page

Structurally identical to the manager detail page, with these differences:

- Show **both** the submitter's name AND the submitter's manager's name in the top metadata block, plus `submittedAt` AND `managerDecidedAt` timestamps.
- Above the action bar, show a callout card titled "Manager review" containing:
  - "Approved by {manager name} on {date}"
  - The manager's approval note, if any (rendered as a quote block)
- The action bar (Approve / Reject) only appears when `status === "pending_finance"`. Behaves identically to the manager's action bar.
- If the expense is already approved or rejected, no action bar; show informational text.

## Updated manager detail page

- Action bar (Approve / Reject) only appears when `status === "pending_manager"`.
- If the expense is at `pending_finance`: no action bar, show informational text "Awaiting finance review."
- If approved or rejected: no action bar, show the relevant decision details.

## Updated history timeline

Replace the single `approved` event with two new event types:

- `manager_approved` — verb "approved at the manager step", icon `CheckCircle2` (consider adding a small "1" badge or different color tint to distinguish from finance approval)
- `finance_approved` — verb "approved at the finance step", icon `CheckCircle2` (with "2" indicator or distinct color)

The `rejected` event now needs to indicate which role rejected. Render the action verb as "Morgan rejected this expense (manager step)" or "Fiona rejected this expense (finance step)" — derive this from the event's `actorRoleAtTime` field, which should be `"manager"` or `"finance"` accordingly.

Each event should record `actorRoleAtTime` as a field so the timeline knows the role context. Add this to the event data shape.

## Updated flows to verify

After the refactor, walk through these flows in the artifact:

1. **Happy path through both steps**:
   - Sign in as employee → submit a new expense → status flips to `pending_manager`
   - Sign in as manager → see it in queue → approve with optional note → status flips to `pending_finance`, no longer in manager's queue
   - Sign in as finance → see it in queue → approve with optional note → status flips to `approved`, no longer in finance's queue
   - Sign back in as employee → see the full history with both approval events

2. **Rejection at step 1 (manager)**:
   - Already in seed as expense #5. Employee opens it → sees "Rejected by Manager" badge → reads the reason → edits and resubmits → restarts at `pending_manager`.

3. **Rejection at step 2 (finance)** — exercise this flow live:
   - Sign in as finance → open the pending_finance expense (#3) → click Reject → enter a reason → confirm → status flips to `rejected` with `rejectedByRole: "finance"` → history shows the finance rejection.
   - Sign in as employee → see "Rejected by Finance" badge → open the expense → resubmit → status restarts at `pending_manager` (not `pending_finance` — always restart at step 1).

4. **Withdraw from pending_finance**:
   - Sign in as employee → open the pending_finance expense (#3) → click Withdraw → confirm → status drops to `draft`, manager's previous approval is undone (clear `managerDecidedAt`/`managerDecidedBy`).

5. **Manager sees later-stage expense as read-only**:
   - Sign in as manager → navigate directly to expense #3 (pending_finance) → see read-only view with "This expense has moved past your review stage" info banner.

## What stays the same

- Mock auth (sign in determines role)
- All five primary flows already wired (sign in / list / submit / review / detail)
- shadcn/ui component vocabulary
- Line items section, line-derived list columns, history timeline grouping by saveGroupId
- Warn-on-navigate, Team page (manager only — still scoped to one employee per the seed)
- Empty / loading / error states

## What's intentionally fixed (not configurable) in v1

The two-step chain is **hardcoded as Manager → Finance** for every expense. There is no chain configuration UI. The data model is designed so this could be made configurable later (per-employee, per-amount, per-category), but v1 enforces this single chain. The README will explain this design decision.
