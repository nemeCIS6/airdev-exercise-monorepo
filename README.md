# Expense Tracker

Internal expense tracker with employee submission and a two-step approval chain (Manager → Finance).

## Live demo

- URL: _<deployed Vercel URL>_
- Employee — `employee@example.com` / `employee123!`
- Manager — `manager@example.com` / `manager123!`
- Finance — `finance@example.com` / `finance123!`

The three accounts above are created by the seed script and exist on the production deployment.

## Quick start

```bash
# from repo root
cd apps/web

npm install
npx convex dev            # follow prompts to create a Convex deployment
cp .env.example .env.local # then paste in the values printed by convex dev + Auth setup
npx convex run seed:run   # seed Eddie/Morgan/Fiona + five expenses (idempotent)
npm run dev               # http://localhost:3000
```

Convex Auth setup (one-time): follow https://labs.convex.dev/auth/setup to generate `JWT_PRIVATE_KEY` and `JWKS` into `.env.local`.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui primitives · Convex (database, server functions, file storage, auth).

## Design decisions

- **Approval pipeline, not payment tracker.** v1 ends at Approved/Rejected; reimbursement and AP integration are future scope.
- **Two-step approval chain (Manager → Finance) is fixed in v1.** Every expense must be approved by the employee's assigned manager and then by a member of the finance pool before reaching `approved`. Either step can reject. The schema (status enum + per-step decision fields) is designed so the chain can be made configurable in v2: a future `approval_chains` table could hold per-employee, per-amount, or per-category chains, and `expenses` could track a `currentStep` integer.
- **Finance is a shared pool.** Any user with the `finance` role can act at step 2 — first-come, first-decide. Direct-report scoping only applies at the manager step.
- **Review pages show full history, not just inboxes.** Managers see every submitted expense from their direct reports across all statuses; finance sees every submitted expense in the company (drafts always stay private to the submitter). The status filter defaults to the pending queue (`pending_manager` / `pending_finance`) so the queue view is one click away, but clearing the filter reveals the full audit trail — matching how real expense tools (Brex, Ramp, Expensify) treat the financial-controller role.
- **Resubmit always restarts at step 1.** Even if finance rejected, the manager reviews again. Conservative choice — finance concerns are often shared by the manager, and skipping the manager on resubmit would be surprising.
- **One manager per employee.** Configurable from the manager's Team page. Designed to extend to chained or branched approval graphs later.
- **Self-serve signup creates employees only.** Manager and finance accounts are seeded. Promotion is admin work, out of v1 scope.
- **Expenses are composed of line items.** Each line carries its own category and amount; the parent holds shared context (summary, currency, date, merchant, receipt). This reflects how itemized receipts actually work — a single dinner check may include food, drinks, and tip under different policies. The seed's rejected expense exists precisely to demonstrate this ("Please itemize and resubmit.").
- **Drafts persist explicitly.** Save Draft button + browser warn-on-navigate. Chosen over debounced autosave because the visible button advertises the feature to reviewers and avoids edge cases (race conditions, orphan drafts) in a tight build window.
- **History as a separate table.** `expense_events` keeps the audit trail queryable and immutable without bloating the expense record. Events capture `actorRoleAtTime` so the audit remains accurate even if a user's role changes later. Line-level events share a `saveGroupId` so the timeline collapses same-save events into one expandable entry.
- **Fixed category and currency lists.** Seven currencies (USD, EUR, GBP, CAD, AUD, JPY, PHP), six categories. Forward-compatible with the brief's "different countries" hint without committing to 180 ISO codes.
- **All state lives in Convex.** No `localStorage`, no in-memory mock stores. Convex queries drive every list and detail page; mutations are the only writer.
- **Authorization is server-side.** Every Convex function calls `auth.getUserId(ctx)` first, then a role/ownership helper. The client never passes role or userId.

## Assumptions

- Single company / single tenant. Multi-org is not in v1.
- Currency is stored per-expense (not per line) but not converted. FX is future scope.
- Every expense has at least one line item. The form starts new drafts with one empty line.
- Managers and finance users cannot submit expenses in v1. Clean role separation; the data model supports adding it later.
- Rejection requires a reason (5–500 chars). Approval notes are optional at both steps.
- Approved expenses are immutable. Rejected expenses are editable and resubmittable; resubmit always restarts at the manager step.
- Withdraw is available from both `pending_manager` and `pending_finance` — withdrawing from `pending_finance` undoes the manager's prior approval.
- Receipts are required on submit (image or PDF, ≤10MB) at the parent level — one receipt per expense, regardless of line count.
- `submittedAt` is set once on first submission and survives withdraw/resubmit cycles.
- No notifications. Status is reflected in-app.

## Out of scope for v1

Payment tracking · configurable approval chains (chain is fixed at Manager → Finance) · approval routing by amount/category · multi-currency FX · admin role · notifications · social login · CSV export · field-level audit diffs.

## Project structure

```
airdev-exercise-monorepo/
├── README.md
├── plan/                          # spec + design prototype + handoff docs
└── apps/web/                      # Next.js app + Convex backend
    ├── app/
    │   ├── (employee)/expenses/   # /expenses, /expenses/new, /expenses/[id]
    │   ├── (manager)/             # /review, /review/[id], /team
    │   ├── (finance)/finance/     # /finance/review, /finance/review/[id]
    │   ├── sign-in, sign-up, onboarding
    │   └── layout.tsx, page.tsx
    ├── components/                # ExpenseForm, LineItemsSection, HistoryTimeline,
    │   │                          # ApproverActionBar, EmployeeActionBar, StatusBadge,
    │   │                          # RoleGuard, ErrorBoundary, ExpenseList, ExpenseFilters
    │   └── ui/                    # shadcn primitives (Button, Card, Select, …)
    ├── convex/
    │   ├── schema.ts              # userProfiles · expenses · expense_lines · expense_events
    │   ├── auth.ts                # Convex Auth (Password provider)
    │   ├── users.ts               # getMyProfile, completeOnboarding, listMyTeam,
    │   │                          # listAllEmployees, listAllManagers, reassignEmployeeManager
    │   ├── expenses.ts            # createDraft, saveDraftWithLines, submitExpense,
    │   │                          # withdrawExpense, resubmitRejected, discardDraft,
    │   │                          # managerApprove/Reject, financeApprove/Reject,
    │   │                          # listMyExpenses, listExpensesForReview, getExpense
    │   ├── events.ts              # listEventsForExpense
    │   ├── files.ts               # generateUploadUrl, getReceiptUrl
    │   ├── seed.ts                # idempotent seed: 3 users + 5 expenses (one per status)
    │   └── lib/auth.ts            # role/ownership helpers
    └── lib/                       # format helpers, useUnsavedChanges hook
```

## Three flows verified end-to-end on the live URL

1. **Full approval** — employee submits → manager approves → finance approves → status flips `pending_manager` → `pending_finance` → `approved`, history updates at each step.
2. **Reject and resubmit** — employee submits → manager rejects → employee edits and resubmits → restarts at `pending_manager` → manager approves → finance approves.
3. **Manager-approves-then-finance-rejects** — employee submits → manager approves → finance rejects → expense ends at `rejected` with `rejectedByRole = "finance"`; history shows the finance rejection.
