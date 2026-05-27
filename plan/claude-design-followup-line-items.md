# Claude Design Follow-up — Add Line Items to the Expense Tracker Prototype

> Paste this in the **same Claude Design chat** as the original prototype, not a new chat. It references the existing artifact and asks for a targeted refactor.

---

Update the Expense Tracker prototype to support **line items**. Every expense is now composed of one or more line items rather than a single amount/category at the expense level.

This is a refactor of the existing prototype, not a rebuild. Keep the auth flow, mock users, shadcn/ui components, top nav, and overall layout. Replace the data model, form, detail views, and list table columns to match the new shape below.

## New data model

Every expense has these **parent-level** fields:
- `id`
- `employeeId`
- `status` (draft / pending / approved / rejected)
- `summary` (short one-liner — replaces the old "description")
- `currency` (USD, EUR, GBP, CAD, AUD, JPY)
- `expenseDate`
- `merchant` (optional)
- `receipt` (filename + type, or null)
- `submittedAt`, `decidedAt`, `decidedBy`, `rejectionReason`
- `lines: LineItem[]` (at least 1)

Each `LineItem` has:
- `id`
- `description` (required, non-empty)
- `category` (Travel / Meals / Lodging / Software / Supplies / Other)
- `quantity` (number, default 1, > 0)
- `unitAmount` (number, > 0)
- `sortOrder` (number, for stable display)

Line total = `quantity × unitAmount`. Expense total = sum of all line totals.

## Updated mock data

Replace the existing four seeded expenses with these line-aware versions:

1. **Draft** — Summary: "Office supplies — printer ink and paper", USD, no merchant yet, no receipt yet
   - Lines:
     - "Black ink cartridge" · supplies · qty 2 · $24.99 → $49.98
     - "A4 paper ream" · supplies · qty 1 · $8.50 → $8.50
   - Total: $58.48
   - History: [created]

2. **Pending** — Summary: "Client lunch at Bistro 12", USD, merchant "Bistro 12", receipt `bistro-12-receipt.jpg`
   - Lines:
     - "Lunch entrées" · meals · qty 2 · $32.00 → $64.00
     - "Beverages" · meals · qty 1 · $18.50 → $18.50
     - "Tip" · meals · qty 1 · $7.00 → $7.00
   - Total: $89.50
   - History: [created, line_added × 3, submitted]

3. **Approved** — Summary: "Conference trip to SF", USD, merchant "United Airlines + Hilton", receipt `united-conference-receipt.pdf`
   - Lines:
     - "Round-trip flight SFO" · travel · qty 1 · $312.00 → $312.00
     - "Conference proceedings (digital)" · software · qty 1 · $100.00 → $100.00
   - Total: $412.00
   - History: [created, line_added × 2, submitted, approved by Morgan, note "Approved per Q2 travel budget."]

4. **Rejected** — Summary: "Team offsite dinner", USD, merchant "The Tavern", receipt `tavern-receipt.jpg`
   - Lines:
     - "Dinner for team" · meals · qty 1 · $280.00 → $280.00
   - Total: $280.00
   - History: [created, line_added, submitted, rejected by Morgan, reason "Please itemize the meals and any alcohol separately, then resubmit."]

## Updated list table columns

The "Amount" column becomes **Total**: sum of line totals, formatted in the expense's currency.

The "Category" column becomes **Categories**: a derived breakdown of the expense's lines, grouped by category and sorted by subtotal descending. Render up to 3 entries as `"Meals $89.50"` (single category) or `"Meals $64.00 · Software $40.00 · Travel $15.00"` (multiple). If more than 3 categories, append `· +N more`. If only one category, just show that category and total. Cap at ~60 chars with ellipsis if needed.

The "Merchant" column stays.

**Filter changes**: remove the Category filter from above the table (it's ambiguous now that categories are per-line). Keep Status filter and Date range filter.

## Updated form (the biggest change)

### Parent-level fields (top section)
1. **Summary** (text input, required, placeholder "What was this expense for?" — keep it short, this replaces the old description)
2. **Expense date** (native date input, required, max = today)
3. **Currency** (Select, default USD, six options)
4. **Merchant** (text input, optional)
5. **Receipt** (file input, required to submit, optional to save draft — keep the same mocked behavior as before: store filename, show placeholder image preview for images / PDF icon for PDFs)

### Line items section (heading: "Line items")

A dynamic list of rows. The form starts with **one empty row** when creating a new expense. Each row has:

- **Description** — text input (required) — ~40% of row width
- **Category** — Select (required) with the six options — ~18% width
- **Quantity** — number input (default 1, min 0.01, step 0.01) — ~10% width
- **Unit amount** — number input (required, > 0, step 0.01) — ~14% width
- **Line total** — read-only computed display showing `quantity × unitAmount` formatted in the expense currency — ~12% width, right-aligned, font-mono
- **Remove button** — trash icon button (lucide `Trash2`), disabled when only one line remains — ~6% width

Below the rows: an **"Add line"** button (with lucide `Plus` icon, ghost variant, full-width or left-aligned).

Below that: a **Total** row showing the sum of all line totals, right-aligned, formatted in the expense currency. Style as a bold large number.

### Dirty state and warn-on-navigate

Any add/edit/remove of a line marks the form as dirty, alongside parent field changes. The existing `useUnsavedChanges` hook should cover all of this — just make sure line array changes trip the dirty flag too.

### Validation on submit

- Summary non-empty
- Receipt present
- At least one line item (always true since we enforce ≥1 line in the UI)
- Every line: description non-empty, category set, quantity > 0, unitAmount > 0

Show inline error states on invalid fields and a top-of-form summary if multiple fields are invalid.

## Updated detail page (read-only view, both roles)

Replace the old single description/amount/category display with:

1. **Parent fields** rendered as a labeled key-value list at the top: Summary · Date · Currency · Merchant · Receipt (clickable to view)
2. **Line items table** below the parent fields. Columns: Description · Category · Qty · Unit · Total. Use a shadcn `Table` component. Below the table, a right-aligned grand total row in a slightly larger / bolder font.
3. **History timeline** below that (existing component, see updates below)

For the manager view, the action bar (Approve / Reject) sits between the line items table and the history timeline.

## Updated history timeline

Add three new event types alongside the existing ones:

- `line_added` — icon: lucide `Plus`, verb: "added line", note shows line summary like `"Tip — $7.00"`
- `line_edited` — icon: lucide `Pencil`, verb: "edited line", note shows the line summary after edit
- `line_removed` — icon: lucide `Minus`, verb: "removed line", note shows the line summary at time of removal

When 3+ events share the same `saveGroupId`, render them as a collapsible group:
- Header: `"Eddie edited line items"` + a summary like `(added 1, edited 2, removed 1)`
- Click to expand → nested list of the individual line events with their notes
- Timestamp of the group is the timestamp of the first event in the group
- Standalone events (no group match) render normally as before

In the mock data, give the three `line_added` events in the Pending expense the same `saveGroupId` so the grouping behavior is visible on first render. Same for the two line_addeds in the Approved expense.

## What stays exactly the same

- Mock auth flow (sign in determines role, no toggle)
- All five primary flows: sign in → list → submit → review → approve/reject
- shadcn/ui component vocabulary
- Top nav, status badges, empty/loading/error states
- Withdraw, resubmit, discard-draft behaviors (just operating on the new shape)
- Warn-on-navigate dialog
- Team page

## What to verify after the refactor

When you're done, walk through these flows in the artifact and make sure each one works cleanly:

1. **Create from scratch**: sign in as employee → "New Expense" → form opens with one empty line → fill in parent fields → fill the line → "Add line" to add a second → fill it → "Save draft" → land on detail page showing both lines and the total → "Submit" → status flips to pending
2. **Itemize a rejection**: sign in as employee → open the rejected "Team offsite dinner" → see the rejection banner → click Edit → split the single $280 line into ~3 itemized lines → Resubmit → status flips to pending → history shows the line edits grouped
3. **Manager review with lines**: sign in as manager → open the pending expense → see the line items table → see the per-line totals adding up to the grand total → Approve with a note → history updates
4. **Discard draft**: open the draft → "Discard draft" → confirmation → expense removed from list
