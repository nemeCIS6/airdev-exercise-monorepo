// Expense detail (employee + manager views), line items editor, history timeline.

// ---- useUnsavedChanges hook ----
function useUnsavedChanges(isDirty) {
  React.useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
}

const NavGuardCtx = React.createContext({ register: () => () => {}, requestNav: (fn) => fn() });

function NavGuardProvider({ children }) {
  const guardRef = React.useRef(null);
  const [pending, setPending] = React.useState(null);

  const register = React.useCallback((g) => {
    guardRef.current = g;
    return () => { if (guardRef.current === g) guardRef.current = null; };
  }, []);

  const requestNav = React.useCallback((fn) => {
    const g = guardRef.current;
    if (g && g.check()) setPending(() => fn);
    else fn();
  }, []);

  const ctx = React.useMemo(() => ({ register, requestNav }), [register, requestNav]);

  return (
    <NavGuardCtx.Provider value={ctx}>
      {children}
      <AlertDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Discard unsaved changes?"
        description="You have unsaved edits on this expense. Leaving now will discard them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => { if (pending) pending(); setPending(null); }}
      />
    </NavGuardCtx.Provider>
  );
}
function useNavGuard() { return React.useContext(NavGuardCtx); }


// ============================================================
// History timeline (with grouped line events)
// ============================================================

const EVENT_ICON = {
  created: 'FilePlus',
  submitted: 'Send',
  withdrawn: 'Undo2',
  edited: 'Pencil',
  resubmitted: 'Repeat',
  manager_approved: 'CheckCircle2',
  finance_approved: 'CheckCircle2',
  approved: 'CheckCircle2', // legacy
  rejected: 'XCircle',
  line_added: 'Plus',
  line_edited: 'Pencil',
  line_removed: 'Minus',
};
function eventVerb(ev) {
  switch (ev.action) {
    case 'created':          return 'created this expense';
    case 'submitted':        return 'submitted for review';
    case 'withdrawn':        return 'withdrew this expense';
    case 'edited':           return 'edited the expense';
    case 'resubmitted':      return 'resubmitted for review';
    case 'manager_approved': return 'approved at the manager step';
    case 'finance_approved': return 'approved at the finance step';
    case 'approved':         return 'approved'; // legacy
    case 'rejected':
      if (ev.actorRoleAtTime === 'finance') return 'rejected this expense (finance step)';
      if (ev.actorRoleAtTime === 'manager') return 'rejected this expense (manager step)';
      return 'rejected this expense';
    case 'line_added':       return 'added line';
    case 'line_edited':      return 'edited line';
    case 'line_removed':     return 'removed line';
    default: return ev.action;
  }
}
const EVENT_COLOR = {
  manager_approved: 'text-green-700 bg-green-100 border-green-200',
  finance_approved: 'text-emerald-700 bg-emerald-100 border-emerald-200',
  approved:         'text-green-700 bg-green-100 border-green-200',
  rejected:         'text-red-700 bg-red-100 border-red-200',
};
const defaultColor = 'text-muted-foreground bg-secondary border-border';

function StepIndicator({ step }) {
  return <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background border border-border text-[8px] font-bold text-foreground">{step}</span>;
}

function eventBundle(history) {
  // Returns an array of "rows":
  //   { kind: 'single', event }     OR
  //   { kind: 'group', saveGroupId, events: [...], at }   (only when 3+ line_* share the same saveGroupId)
  const out = [];
  const seenGroups = new Set();
  for (const ev of history) {
    if (ev.saveGroupId && ev.action.startsWith('line_')) {
      if (seenGroups.has(ev.saveGroupId)) continue;
      const group = history.filter(x => x.saveGroupId === ev.saveGroupId && x.action.startsWith('line_'));
      if (group.length >= 3) {
        seenGroups.add(ev.saveGroupId);
        out.push({ kind: 'group', saveGroupId: ev.saveGroupId, events: group, at: group[0].at, actor: ev.actor });
        continue;
      }
    }
    out.push({ kind: 'single', event: ev });
  }
  return out;
}

function GroupedLineEvents({ row, users }) {
  const [open, setOpen] = React.useState(false);
  const actor = users.find(u => u.id === row.actor);
  const counts = { line_added: 0, line_edited: 0, line_removed: 0 };
  row.events.forEach(ev => { counts[ev.action] = (counts[ev.action] || 0) + 1; });
  const parts = [];
  if (counts.line_added) parts.push(`added ${counts.line_added}`);
  if (counts.line_edited) parts.push(`edited ${counts.line_edited}`);
  if (counts.line_removed) parts.push(`removed ${counts.line_removed}`);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between rounded-md text-left text-sm hover:bg-muted/40 -mx-1 px-1 py-0.5"
      >
        <span>
          <span className="font-medium">{actor?.name || 'Someone'}</span>
          <span className="text-muted-foreground"> edited line items</span>
          <span className="text-muted-foreground"> ({parts.join(', ')})</span>
        </span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-muted-foreground" />
      </button>
      <div className="text-xs text-muted-foreground mt-0.5" title={formatDateTime(row.at)}>{timeAgo(row.at)}</div>
      {open && (
        <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
          {row.events.map(ev => (
            <li key={ev.id} className="text-xs flex items-start gap-2">
              <Icon name={EVENT_ICON[ev.action]} size={11} className="text-muted-foreground mt-0.5 shrink-0" />
              <span>
                <span className="capitalize text-muted-foreground">{ev.action.replace('line_', '')}: </span>
                <span className="text-foreground">{ev.note}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function HistoryTimeline({ expense }) {
  const store = useStore();
  const rows = eventBundle([...expense.history].reverse());
  return (
    <div>
      <h2 className="text-base font-semibold mb-3">History</h2>
      <ol className="relative ml-1">
        {rows.map((row, i) => {
          const last = i === rows.length - 1;
          if (row.kind === 'group') {
            return (
              <li key={row.saveGroupId} className="relative pl-9 pb-5">
                {!last && <span className="absolute left-3 top-7 bottom-0 w-px bg-border" />}
                <span className={cn('absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border', defaultColor)}>
                  <Icon name="ListChecks" size={13} />
                </span>
                <GroupedLineEvents row={row} users={store.data.users} />
              </li>
            );
          }
          const ev = row.event;
          const actor = store.data.users.find(u => u.id === ev.actor);
          const colorCls = EVENT_COLOR[ev.action] || defaultColor;
          const isMgrApproval = ev.action === 'manager_approved';
          const isFinApproval = ev.action === 'finance_approved';
          return (
            <li key={ev.id} className="relative pl-9 pb-5">
              {!last && <span className="absolute left-3 top-7 bottom-0 w-px bg-border" />}
              <span className={cn('absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border', colorCls)}>
                <Icon name={EVENT_ICON[ev.action] || 'Circle'} size={13} />
                {isMgrApproval && <StepIndicator step="1" />}
                {isFinApproval && <StepIndicator step="2" />}
              </span>
              <div className="text-sm">
                <span className="font-medium">{actor?.name || 'Someone'}</span>
                <span className="text-muted-foreground"> {eventVerb(ev)}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="text-muted-foreground" title={formatDateTime(ev.at)}>{timeAgo(ev.at)}</span>
              </div>
              {ev.note && (ev.action === 'manager_approved' || ev.action === 'finance_approved' || ev.action === 'approved' || ev.action === 'rejected') && (
                <blockquote className="mt-2 rounded-md border-l-2 border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  {ev.note}
                </blockquote>
              )}
              {ev.note && ev.action.startsWith('line_') && (
                <div className="mt-1 text-xs text-muted-foreground">{ev.note}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ============================================================
// Receipt preview
// ============================================================

function ReceiptPreview({ receipt, onChange, editable }) {
  const inputRef = React.useRef(null);
  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    onChange({ name: f.name, type: f.type || 'application/octet-stream' });
  };
  if (!receipt) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 flex flex-col items-center justify-center text-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon name="Paperclip" size={16} /></div>
        <div className="text-sm font-medium">No receipt attached</div>
        <div className="text-xs text-muted-foreground">Required to submit. Images or PDF.</div>
        {editable && (
          <>
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} className="mt-2">
              <Icon name="Upload" size={14} /> Attach receipt
            </Button>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />
          </>
        )}
      </div>
    );
  }
  const isImage = receipt.type && receipt.type.startsWith('image/');
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Icon name={isImage ? 'Image' : 'FileText'} size={14} className="text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{receipt.name}</span>
        </div>
        {editable && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}><Icon name="Replace" size={13} /> Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive"><Icon name="Trash2" size={13} /></Button>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />
          </div>
        )}
      </div>
      {isImage ? (
        <div className="receipt-stripes aspect-[4/3] flex items-center justify-center text-muted-foreground text-xs font-mono">
          <div className="rounded-md bg-background/80 backdrop-blur px-3 py-1.5 border border-border">receipt image preview</div>
        </div>
      ) : (
        <div className="aspect-[4/3] flex flex-col items-center justify-center gap-2 bg-muted/30">
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-background border border-border text-red-600 shadow-sm">
            <Icon name="FileText" size={26} />
          </div>
          <div className="text-xs font-mono text-muted-foreground">PDF · {receipt.name}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Line items editor
// ============================================================

function LineItemsEditor({ lines, currency, onChange, errors = {}, disabled }) {
  const updateLine = (id, patch) => onChange(lines.map(l => l.id === id ? { ...l, ...patch } : l));
  const addLine = () => {
    const maxSort = lines.reduce((m, l) => Math.max(m, l.sortOrder || 0), -1);
    onChange([...lines, makeLine({ description: '', category: '', quantity: 1, unitAmount: 0, sortOrder: maxSort + 1 })]);
  };
  const removeLine = (id) => onChange(lines.filter(l => l.id !== id));

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const canRemove = lines.length > 1;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_140px_80px_120px_110px_36px] gap-2 px-3 py-2 bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border">
        <div>Description</div>
        <div>Category</div>
        <div className="text-right">Qty</div>
        <div className="text-right">Unit</div>
        <div className="text-right">Total</div>
        <div></div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-border">
        {lines.map((line, idx) => {
          const err = errors[line.id] || {};
          return (
            <div key={line.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_80px_120px_110px_36px] gap-2 p-3 items-start">
              <div className="space-y-1">
                <Input
                  placeholder="What was this line for?"
                  value={line.description}
                  onChange={(e) => updateLine(line.id, { description: e.target.value })}
                  disabled={disabled}
                  className={cn(err.description && 'border-destructive focus-visible:ring-destructive')}
                />
                {err.description && <div className="text-xs text-destructive">{err.description}</div>}
              </div>
              <div className="space-y-1">
                <Select
                  value={line.category}
                  onChange={(v) => updateLine(line.id, { category: v })}
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                  placeholder="Category"
                  disabled={disabled}
                />
                {err.category && <div className="text-xs text-destructive">{err.category}</div>}
              </div>
              <div className="space-y-1">
                <Input
                  type="number" min="0.01" step="0.01" inputMode="decimal"
                  value={Number.isFinite(line.quantity) ? line.quantity : ''}
                  onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                  disabled={disabled}
                  className={cn('text-right tabular-nums', err.quantity && 'border-destructive focus-visible:ring-destructive')}
                />
                {err.quantity && <div className="text-xs text-destructive">{err.quantity}</div>}
              </div>
              <div className="space-y-1">
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{CURRENCY_SYMBOL[currency] || ''}</span>
                  <Input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={Number.isFinite(line.unitAmount) ? line.unitAmount : ''}
                    onChange={(e) => updateLine(line.id, { unitAmount: parseFloat(e.target.value) || 0 })}
                    disabled={disabled}
                    className={cn('text-right tabular-nums pl-6', err.unitAmount && 'border-destructive focus-visible:ring-destructive')}
                  />
                </div>
                {err.unitAmount && <div className="text-xs text-destructive">{err.unitAmount}</div>}
              </div>
              <div className="font-mono tabular-nums text-right text-sm h-9 flex items-center justify-end px-2 text-foreground">
                {formatMoney(lineTotal(line), currency)}
              </div>
              <div className="flex items-center justify-center md:pt-0 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(line.id)}
                  disabled={disabled || !canRemove}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                  title={canRemove ? 'Remove line' : 'At least one line is required'}
                >
                  <Icon name="Trash2" size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-3 py-3 border-t border-border bg-muted/20">
        <Button type="button" variant="ghost" size="sm" onClick={addLine} disabled={disabled} className="text-foreground">
          <Icon name="Plus" size={14} /> Add line
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Total</span>
          <span className="text-xl font-semibold tabular-nums">{formatMoney(grandTotal, currency)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Expense form (parent fields + line editor + AI extract)
// ============================================================

function ExpenseForm({ value, onChange, errors = {}, lineErrors = {}, disabled }) {
  const toast = useToast();
  const set = (patch) => onChange({ ...value, ...patch });
  const [extracting, setExtracting] = React.useState(false);
  const [extractedFor, setExtractedFor] = React.useState(null);

  const onExtract = async () => {
    if (!value.receipt || extracting) return;
    setExtracting(true);
    try {
      const prompt = `You are a receipt parser. Based ONLY on the filename of an uploaded receipt, infer plausible expense details. The filename is your only signal; make reasonable guesses for realistic business expenses.

Filename: "${value.receipt.name}"
File type: ${value.receipt.type || 'unknown'}
Today: ${today()}

Respond with ONLY a single-line JSON object (no markdown fences, no commentary) matching this schema:
{
  "summary": string (short one-liner, 4-10 words),
  "currency": "USD"|"EUR"|"GBP"|"CAD"|"AUD"|"JPY",
  "merchant": string (best-guess vendor name),
  "expenseDate": "YYYY-MM-DD" (within the last 30 days, never future),
  "lines": [
    { "description": string, "category": "Travel"|"Meals"|"Lodging"|"Software"|"Supplies"|"Other", "quantity": number (>0, default 1), "unitAmount": number (>0, 2 decimals) }
  ]
}

The lines array MUST have 1-5 items that sum to a plausible total for the receipt. Use distinct line descriptions when itemizing.`;
      const raw = await window.claude.complete(prompt);
      const cleaned = (raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const data = JSON.parse(match[0]);

      const patch = {};
      let filledFields = 0;
      if (typeof data.summary === 'string' && data.summary.trim()) { patch.summary = data.summary.trim(); filledFields++; }
      if (CURRENCIES.includes(data.currency)) { patch.currency = data.currency; filledFields++; }
      if (typeof data.merchant === 'string' && data.merchant.trim()) { patch.merchant = data.merchant.trim(); filledFields++; }
      if (typeof data.expenseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.expenseDate) && data.expenseDate <= today()) {
        patch.expenseDate = data.expenseDate; filledFields++;
      }

      let newLines = null;
      if (Array.isArray(data.lines) && data.lines.length > 0) {
        const valid = data.lines
          .filter(L => typeof L.description === 'string' && L.description.trim() && CATEGORIES.includes(L.category) && L.unitAmount > 0)
          .slice(0, 8)
          .map((L, i) => makeLine({
            description: L.description.trim(),
            category: L.category,
            quantity: (typeof L.quantity === 'number' && L.quantity > 0) ? Math.round(L.quantity * 100) / 100 : 1,
            unitAmount: Math.round(L.unitAmount * 100) / 100,
            sortOrder: i,
          }));
        if (valid.length > 0) newLines = valid;
      }
      if (newLines) { patch.lines = newLines; filledFields++; }

      onChange({ ...value, ...patch });
      setExtractedFor(value.receipt.name);
      if (filledFields === 0) {
        toast.info('Couldn\u2019t pull anything useful from that file. Try filling fields manually.');
      } else {
        toast.success(`Filled in ${filledFields} section${filledFields === 1 ? '' : 's'} from your receipt. Double-check before submitting.`);
      }
    } catch (err) {
      console.warn('Extraction failed', err);
      toast.error('Couldn\u2019t read that receipt. You can still fill the form manually.');
    } finally {
      setExtracting(false);
    }
  };

  const canExtract = !!value.receipt && !disabled;
  const alreadyExtracted = extractedFor === value.receipt?.name;

  return (
    <div className="space-y-8">
      {/* --- Receipt (first, since required + powers AI) --- */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label>
            Receipt{' '}
            {value.status === 'draft'
              ? <span className="text-muted-foreground font-normal text-xs">(required to submit)</span>
              : <span className="text-muted-foreground font-normal text-xs">(required)</span>}
          </Label>
          {canExtract && (
            <button
              type="button"
              onClick={onExtract}
              disabled={extracting}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-60',
                alreadyExtracted
                  ? 'border-border bg-background text-muted-foreground hover:text-foreground'
                  : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
              )}
              title="Extract summary, merchant, date, and line items from the receipt"
            >
              <Icon name={extracting ? 'Loader2' : 'Sparkles'} size={13} className={extracting ? 'animate-spin' : ''} />
              {extracting ? 'Reading receipt…' : alreadyExtracted ? 'Re-extract with AI' : 'Autofill from receipt'}
            </button>
          )}
        </div>
        <ReceiptPreview receipt={value.receipt} onChange={(r) => set({ receipt: r })} editable={!disabled} />
        {errors.receipt && <div className="text-xs text-destructive">{errors.receipt}</div>}
        {value.receipt && !alreadyExtracted && !extracting && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Icon name="Sparkles" size={11} className="text-primary" />
            Tap <span className="font-medium text-foreground">Autofill from receipt</span> to pull summary, merchant, date, and line items.
          </p>
        )}
      </section>

      {/* --- Parent fields --- */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="f_summary" required>Summary</Label>
          <Input id="f_summary" placeholder="What was this expense for?" value={value.summary} onChange={e => set({ summary: e.target.value })} disabled={disabled} />
          {errors.summary && <div className="text-xs text-destructive">{errors.summary}</div>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="f_date" required>Expense date</Label>
          <Input id="f_date" type="date" max={today()} value={value.expenseDate} onChange={e => set({ expenseDate: e.target.value })} disabled={disabled} />
          {errors.expenseDate && <div className="text-xs text-destructive">{errors.expenseDate}</div>}
        </div>
        <div className="space-y-2">
          <Label required>Currency</Label>
          <Select
            value={value.currency}
            onChange={(v) => set({ currency: v })}
            options={CURRENCIES.map(c => ({ value: c, label: c }))}
            disabled={disabled}
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="f_merch">Merchant <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="f_merch" placeholder="e.g. United Airlines" value={value.merchant} onChange={e => set({ merchant: e.target.value })} disabled={disabled} />
        </div>
      </section>

      {/* --- Line items --- */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-semibold">Line items</h3>
          <span className="text-xs text-muted-foreground">{value.lines.length} {value.lines.length === 1 ? 'line' : 'lines'}</span>
        </div>
        <LineItemsEditor
          lines={value.lines}
          currency={value.currency}
          onChange={(lines) => set({ lines })}
          errors={lineErrors}
          disabled={disabled}
        />
        {errors.lines && <div className="text-xs text-destructive">{errors.lines}</div>}
      </section>
    </div>
  );
}

// ---- Read-only display ----
function ReadOnlyExpense({ expense }) {
  const total = expenseTotal(expense);
  const Row = ({ label, value }) => (
    <div className="grid grid-cols-[140px,1fr] gap-4 py-2.5 border-b border-border last:border-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
  return (
    <div className="space-y-8">
      {/* Parent fields */}
      <section>
        <h3 className="text-base font-semibold mb-2">Details</h3>
        <Row label="Summary" value={expense.summary} />
        <Row label="Date" value={formatDate(expense.expenseDate)} />
        <Row label="Currency" value={expense.currency} />
        <Row label="Merchant" value={expense.merchant || <span className="text-muted-foreground">—</span>} />
        <Row label="Receipt" value={<ReceiptPreview receipt={expense.receipt} editable={false} />} />
      </section>

      {/* Line items table */}
      <section>
        <h3 className="text-base font-semibold mb-2">Line items</h3>
        <Table>
          <THead>
            <TR>
              <TH>Description</TH>
              <TH>Category</TH>
              <TH className="text-right">Qty</TH>
              <TH className="text-right">Unit</TH>
              <TH className="text-right">Total</TH>
            </TR>
          </THead>
          <TBody>
            {expense.lines.map(l => (
              <TR key={l.id}>
                <TD className="font-medium">{l.description}</TD>
                <TD className="text-muted-foreground">{l.category}</TD>
                <TD className="text-right tabular-nums">{l.quantity}</TD>
                <TD className="text-right tabular-nums">{formatMoney(l.unitAmount, expense.currency)}</TD>
                <TD className="text-right font-mono tabular-nums">{formatMoney(lineTotal(l), expense.currency)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <div className="mt-3 flex items-center justify-end gap-3 px-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Grand total</span>
          <span className="text-2xl font-semibold tabular-nums">{formatMoney(total, expense.currency)}</span>
        </div>
      </section>
    </div>
  );
}

// ---- Validation ----
function validateForm(v) {
  const errs = {};
  const lineErrs = {};
  if (!v.summary.trim()) errs.summary = 'Summary is required.';
  if (!v.expenseDate) errs.expenseDate = 'Expense date is required.';
  else if (v.expenseDate > today()) errs.expenseDate = 'Expense date cannot be in the future.';
  if (!v.receipt) errs.receipt = 'A receipt is required to submit.';
  if (!v.lines || v.lines.length === 0) errs.lines = 'At least one line item is required.';
  (v.lines || []).forEach(line => {
    const le = {};
    if (!line.description.trim()) le.description = 'Required';
    if (!line.category) le.category = 'Required';
    if (!(parseFloat(line.quantity) > 0)) le.quantity = '> 0';
    if (!(parseFloat(line.unitAmount) > 0)) le.unitAmount = '> 0';
    if (Object.keys(le).length) lineErrs[line.id] = le;
  });
  return { errs, lineErrs };
}

// Compare lines for dirty detection (id + significant fields)
function linesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.id !== y.id) return false;
    if (x.description !== y.description) return false;
    if (x.category !== y.category) return false;
    if (parseFloat(x.quantity) !== parseFloat(y.quantity)) return false;
    if (parseFloat(x.unitAmount) !== parseFloat(y.unitAmount)) return false;
  }
  return true;
}

// ============================================================
// Expense detail page
// ============================================================

function ExpenseDetail({ id, go }) {
  const store = useStore();
  const toast = useToast();
  const navGuard = useNavGuard();
  const me = store.currentUser();
  const expense = store.data.expenses.find(e => e.id === id);

  if (!expense) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <EmptyState icon="FileQuestion" title="Expense not found" body="It may have been discarded or you don't have access."
          action={<Button variant="outline" onClick={() => go({ name: 'home' })}><Icon name="ArrowLeft" size={14} /> Back</Button>} />
      </div>
    );
  }

  const isOwner = expense.employeeId === me.id;
  const isManagerView = me.role === 'manager' && !isOwner;
  const isFinanceView = me.role === 'finance' && !isOwner;
  const owner = store.data.users.find(u => u.id === expense.employeeId);
  const ownerManager = owner && owner.managerId ? store.data.users.find(u => u.id === owner.managerId) : null;
  const managerDecider = expense.managerDecidedBy ? store.data.users.find(u => u.id === expense.managerDecidedBy) : null;
  const financeDecider = expense.financeDecidedBy ? store.data.users.find(u => u.id === expense.financeDecidedBy) : null;

  // Manager: can take action only when pending_manager AND assigned to this employee.
  const canManagerAct = isManagerView && expense.status === 'pending_manager' && owner?.managerId === me.id;
  const managerPastStage = isManagerView && (expense.status === 'pending_finance' || expense.status === 'approved' || (expense.status === 'rejected' && expense.rejectedByRole === 'finance'));
  // Finance: can act only when pending_finance.
  const canFinanceAct = isFinanceView && expense.status === 'pending_finance';

  const editable = isOwner && (expense.status === 'draft' || expense.status === 'rejected');
  const [editing, setEditing] = React.useState(expense.status === 'draft' && isOwner);
  const [form, setForm] = React.useState(() => snapshotForm(expense));
  const [errs, setErrs] = React.useState({});
  const [lineErrs, setLineErrs] = React.useState({});

  function snapshotForm(exp) {
    return {
      summary: exp.summary,
      currency: exp.currency,
      expenseDate: exp.expenseDate,
      merchant: exp.merchant,
      receipt: exp.receipt,
      lines: exp.lines.map(l => ({ ...l })),
      status: exp.status,
    };
  }

  // Reset on expense identity change
  React.useEffect(() => {
    setForm(snapshotForm(expense));
    setErrs({});
    setLineErrs({});
    setEditing(expense.status === 'draft' && isOwner);
  }, [expense.id]);

  // Dirty detection
  const isDirty = React.useMemo(() => {
    if (!editing) return false;
    if (form.summary !== expense.summary) return true;
    if (form.currency !== expense.currency) return true;
    if (form.expenseDate !== expense.expenseDate) return true;
    if (form.merchant !== expense.merchant) return true;
    const a = form.receipt, b = expense.receipt;
    if ((a && !b) || (!a && b)) return true;
    if (a && b && (a.name !== b.name || a.type !== b.type)) return true;
    if (!linesEqual(form.lines, expense.lines)) return true;
    return false;
  }, [form, expense, editing]);

  useUnsavedChanges(isDirty);
  React.useEffect(() => navGuard.register({ check: () => isDirty }), [navGuard, isDirty]);

  // ---- Actions ----
  const onSaveDraft = () => {
    // Save without full validation (allow incomplete draft)
    store.saveDraft(expense.id, me.id, {
      summary: form.summary, currency: form.currency, expenseDate: form.expenseDate,
      merchant: form.merchant, receipt: form.receipt, lines: form.lines,
    });
    toast.success('Draft saved.');
    setErrs({}); setLineErrs({});
  };

  const onSubmit = () => {
    const { errs: e, lineErrs: le } = validateForm(form);
    setErrs(e); setLineErrs(le);
    if (Object.keys(e).length > 0 || Object.keys(le).length > 0) {
      toast.error('Please fix the highlighted fields before submitting.');
      return;
    }
    store.submitExpense(expense.id, me.id, {
      summary: form.summary, currency: form.currency, expenseDate: form.expenseDate,
      merchant: form.merchant, receipt: form.receipt, lines: form.lines,
    });
    toast.success('Expense submitted for review.');
    setEditing(false);
  };

  const onDiscard = () => {
    store.discardDraft(expense.id);
    toast.info('Draft discarded.');
    go({ name: 'home' });
  };

  const [askDiscard, setAskDiscard] = React.useState(false);
  const [askWithdraw, setAskWithdraw] = React.useState(false);

  const onStartEditRejected = () => { setEditing(true); };

  const onResubmit = () => {
    const { errs: e, lineErrs: le } = validateForm(form);
    setErrs(e); setLineErrs(le);
    if (Object.keys(e).length > 0 || Object.keys(le).length > 0) {
      toast.error('Please fix the highlighted fields before resubmitting.');
      return;
    }
    store.resubmitExpense(expense.id, me.id, {
      summary: form.summary, currency: form.currency, expenseDate: form.expenseDate,
      merchant: form.merchant, receipt: form.receipt, lines: form.lines,
    });
    toast.success('Expense resubmitted.');
    setEditing(false);
  };

  // Approver actions
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [approveNote, setApproveNote] = React.useState('');
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState('');
  const reasonValid = rejectReason.trim().length >= 5 && rejectReason.trim().length <= 500;

  const onApprove = () => {
    if (canManagerAct) {
      store.managerApprove(expense.id, me.id, approveNote.trim() || null);
      toast.success(`Approved at the manager step. Now awaiting finance review.`);
    } else if (canFinanceAct) {
      store.financeApprove(expense.id, me.id, approveNote.trim() || null);
      toast.success(`Approved. ${owner ? owner.name.split(' ')[0] + ' will be reimbursed.' : 'Cleared for reimbursement.'}`);
    }
    setApproveOpen(false); setApproveNote('');
  };
  const onReject = () => {
    if (!reasonValid) return;
    const role = canManagerAct ? 'manager' : canFinanceAct ? 'finance' : me.role;
    store.rejectExpense(expense.id, me.id, rejectReason.trim(), role);
    toast.success('Expense rejected. The employee will see your reason.');
    setRejectOpen(false); setRejectReason('');
  };

  const goBack = () => navGuard.requestNav(() => go({ name: 'home' }));

  // Errors summary count (top of form)
  const errCount = Object.keys(errs).length + Object.values(lineErrs).reduce((s, le) => s + Object.keys(le).length, 0);

  // For sticky bar + header
  const displayTotal = (editable && editing)
    ? form.lines.reduce((s, l) => s + lineTotal(l), 0)
    : expenseTotal(expense);
  const displayCurrency = (editable && editing) ? form.currency : expense.currency;
  const displayAmount = formatMoney(displayTotal, displayCurrency);

  return (
    <>
    <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
      {/* Back */}
      <button onClick={goBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <Icon name="ArrowLeft" size={14} /> {(isManagerView || isFinanceView) ? 'Back to Review' : 'Back to My Expenses'}
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {(editing ? form.summary : expense.summary) || <span className="text-muted-foreground italic">Untitled draft</span>}
            </h1>
            <StatusBadge status={expense.status} rejectedByRole={expense.rejectedByRole} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {(isManagerView || isFinanceView) && <>Submitted by <span className="font-medium text-foreground">{owner?.name}</span></>}
            {isFinanceView && ownerManager && <> · Manager <span className="font-medium text-foreground">{ownerManager.name}</span></>}
            {(isManagerView || isFinanceView) && ' · '}
            {expense.submittedAt
              ? <>Submitted <span title={formatDateTime(expense.submittedAt)}>{timeAgo(expense.submittedAt)}</span></>
              : <>Created <span title={formatDateTime(expense.createdAt)}>{timeAgo(expense.createdAt)}</span></>}
            {isFinanceView && expense.managerDecidedAt && (
              <> · Manager approved <span title={formatDateTime(expense.managerDecidedAt)}>{timeAgo(expense.managerDecidedAt)}</span></>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-semibold tabular-nums leading-none">{displayAmount}</div>
          <div className="mt-1 text-xs text-muted-foreground">{expense.lines.length} {expense.lines.length === 1 ? 'line' : 'lines'}</div>
        </div>
      </div>

      {/* Manager: past your review stage */}
      {managerPastStage && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 shrink-0"><Icon name="Info" size={16} /></div>
          <div className="text-sm">
            <div className="font-semibold text-blue-900">This expense has moved past your review stage.</div>
            <div className="text-blue-800/80 mt-0.5">
              {expense.status === 'pending_finance' && 'It\u2019s now awaiting finance review.'}
              {expense.status === 'approved' && 'It was approved by finance.'}
              {expense.status === 'rejected' && expense.rejectedByRole === 'finance' && 'It was rejected by finance.'}
            </div>
          </div>
        </div>
      )}

      {/* Manager: awaiting finance (when they're the assigned manager but it's already at pending_finance) */}
      {isManagerView && expense.status === 'pending_finance' && owner?.managerId === me.id && !managerPastStage && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 shrink-0"><Icon name="Clock" size={16} /></div>
          <div className="text-sm">
            <div className="font-semibold text-blue-900">Awaiting finance review.</div>
            <div className="text-blue-800/80 mt-0.5">You approved this at the manager step. Finance will sign off before reimbursement.</div>
          </div>
        </div>
      )}

      {/* Finance: Manager review callout (always present on finance view if there's a manager decision) */}
      {isFinanceView && expense.managerDecidedAt && managerDecider && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 shrink-0 relative">
              <Icon name="CheckCircle2" size={16} />
              <StepIndicator step="1" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-green-900">Manager review</div>
              <div className="text-sm text-green-900/80 mt-0.5">
                Approved by <span className="font-medium text-green-900">{managerDecider.name}</span> on <span title={formatDateTime(expense.managerDecidedAt)}>{formatDate(expense.managerDecidedAt)}</span>
              </div>
              {(() => {
                const note = [...expense.history].reverse().find(h => h.action === 'manager_approved' && h.note)?.note;
                return note ? (
                  <blockquote className="mt-2 rounded-md border-l-2 border-green-300/60 bg-white/60 px-3 py-2 text-sm text-green-950">
                    {note}
                  </blockquote>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Rejection banner */}
      {isOwner && expense.status === 'rejected' && !editing && (
        <div className="mt-4 mb-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0"><Icon name="XCircle" size={16} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-destructive">
                {expense.rejectedByRole === 'finance' ? 'Rejected at finance review' : 'Rejected by your manager'}
              </div>
              <blockquote className="mt-1 text-sm text-foreground border-l-2 border-destructive/40 pl-3">
                {expense.rejectionReason}
              </blockquote>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={onStartEditRejected}><Icon name="Pencil" size={13} /> Edit and fix</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline error summary at top of edit form */}
      {editing && errCount > 0 && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">There {errCount === 1 ? 'is 1 issue' : `are ${errCount} issues`} to fix before submitting</div>
            <div className="text-xs mt-0.5 opacity-90">Required fields and line items are highlighted below.</div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{editing ? 'Edit expense' : 'Expense'}</CardTitle>
                {isOwner && expense.status === 'rejected' && !editing && (
                  <Button size="sm" variant="outline" onClick={onStartEditRejected}><Icon name="Pencil" size={13} /> Edit</Button>
                )}
                {isOwner && expense.status === 'rejected' && editing && (
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm(snapshotForm(expense)); setErrs({}); setLineErrs({}); }}>Cancel edit</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {editable && editing
                ? <ExpenseForm value={form} onChange={setForm} errors={errs} lineErrors={lineErrs} />
                : <ReadOnlyExpense expense={expense} />
              }
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <HistoryTimeline expense={expense} />
            </CardContent>
          </Card>
        </aside>
      </div>

      <AlertDialog
        open={askWithdraw} onOpenChange={setAskWithdraw}
        title="Withdraw this expense?"
        description="It will return to Draft so you can edit and resubmit. Your manager will no longer see it in Review."
        confirmLabel="Withdraw"
        onConfirm={() => { store.withdrawExpense(expense.id, me.id); toast.info('Expense withdrawn to Draft.'); }}
      />
      <AlertDialog
        open={askDiscard} onOpenChange={setAskDiscard}
        title="Discard this draft?"
        description="The draft will be permanently deleted. This cannot be undone."
        confirmLabel="Discard draft" destructive
        onConfirm={onDiscard}
      />
    </div>

    {/* Sticky bottom bar */}
    <StickyActionBar
      expense={expense}
      displayAmount={displayAmount}
      isOwner={isOwner}
      isManagerView={isManagerView}
      isFinanceView={isFinanceView}
      canManagerAct={canManagerAct}
      canFinanceAct={canFinanceAct}
      managerPastStage={managerPastStage}
      editing={editing}
      isDirty={isDirty}
      onSaveDraft={onSaveDraft}
      onSubmit={onSubmit}
      onDiscard={() => setAskDiscard(true)}
      onWithdraw={() => setAskWithdraw(true)}
      onResubmit={onResubmit}
      onApprove={() => setApproveOpen(o => !o)}
      onReject={() => setRejectOpen(o => !o)}
      approveOpen={approveOpen}
      rejectOpen={rejectOpen}
      approveNote={approveNote}
      setApproveNote={setApproveNote}
      confirmApprove={onApprove}
      cancelApprove={() => { setApproveOpen(false); setApproveNote(''); }}
      rejectReason={rejectReason}
      setRejectReason={setRejectReason}
      reasonValid={reasonValid}
      confirmReject={onReject}
      cancelReject={() => { setRejectOpen(false); setRejectReason(''); }}
    />
    </>
  );
}

// ============================================================
// Sticky action bar
// ============================================================

function StickyActionBar(props) {
  const { expense, displayAmount, isOwner, isManagerView, isFinanceView,
    canManagerAct, canFinanceAct, managerPastStage,
    editing, isDirty,
    onSaveDraft, onSubmit, onDiscard, onWithdraw, onResubmit,
    onApprove, onReject, approveOpen, rejectOpen,
    approveNote, setApproveNote, confirmApprove, cancelApprove,
    rejectReason, setRejectReason, reasonValid, confirmReject, cancelReject } = props;

  let actions = null;
  let leftActions = null;
  let hint = null;

  // ---- Approver: manager or finance with action rights ----
  if (canManagerAct || canFinanceAct) {
    actions = (
      <>
        <Button variant="destructive" onClick={onReject} className={rejectOpen ? 'ring-2 ring-ring' : ''}><Icon name="X" size={14} /> Reject</Button>
        <Button variant="success" onClick={onApprove} className={approveOpen ? 'ring-2 ring-ring' : ''}>
          <Icon name="Check" size={14} /> {canFinanceAct ? 'Approve & finalize' : 'Approve'}
        </Button>
      </>
    );
  } else if (expense.status === 'approved') {
    hint = (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon name="CheckCircle2" size={14} className="text-green-700" />
        Approved · read-only
      </div>
    );
  } else if (managerPastStage) {
    // Manager viewing a past-stage expense
    hint = <div className="text-sm text-muted-foreground">No further action available from your account.</div>;
  } else if (isManagerView && expense.status === 'pending_finance') {
    hint = <div className="text-sm text-muted-foreground flex items-center gap-1.5"><Icon name="Clock" size={14} /> Awaiting finance review.</div>;
  } else if (isFinanceView && expense.status !== 'pending_finance') {
    hint = <div className="text-sm text-muted-foreground">{expense.status === 'rejected' ? 'This expense was rejected.' : 'No action available at this stage.'}</div>;
  } else if (isOwner && expense.status === 'draft') {
    leftActions = (
      <Button variant="ghost" onClick={onDiscard} className="text-muted-foreground hover:text-destructive">
        <Icon name="Trash2" size={14} /> Discard draft
      </Button>
    );
    actions = (
      <>
        <Button variant="outline" onClick={onSaveDraft} disabled={!isDirty}>Save draft</Button>
        <Button variant="success" onClick={onSubmit}><Icon name="Send" size={14} /> Submit</Button>
      </>
    );
  } else if (isOwner && (expense.status === 'pending_manager' || expense.status === 'pending_finance')) {
    hint = (
      <span className="text-xs text-muted-foreground">
        {expense.status === 'pending_finance'
          ? 'Withdrawing will reset to Draft and undo the manager\u2019s approval.'
          : 'You can withdraw and edit anytime before it\u2019s reviewed.'}
      </span>
    );
    actions = <Button variant="outline" onClick={onWithdraw}><Icon name="Undo2" size={14} /> Withdraw</Button>;
  } else if (isOwner && expense.status === 'rejected') {
    if (editing) {
      hint = <span className="text-xs text-muted-foreground hidden md:inline">{isDirty ? 'Resubmitting restarts review at the manager step.' : 'Make a change before resubmitting.'}</span>;
      actions = <Button variant="success" onClick={onResubmit}><Icon name="Repeat" size={14} /> Resubmit</Button>;
    } else {
      hint = <span className="text-sm text-muted-foreground">Click <span className="font-medium text-foreground">Edit</span> above to address the rejection.</span>;
    }
  }

  const hasBar = actions !== null || hint !== null || leftActions !== null;
  if (!hasBar) return null;

  const showInlineExpansion = (canManagerAct || canFinanceAct) && (approveOpen || rejectOpen);

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.08)]">
      <div className="max-w-6xl mx-auto px-6">
        {showInlineExpansion && (
          <div className="py-4 border-b border-border">
            {approveOpen && (
              <div className="pop rounded-md border border-border bg-muted/40 p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="approve_note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea id="approve_note" placeholder={canFinanceAct ? 'e.g. Cleared for reimbursement' : 'e.g. Approved per Q2 travel budget'} value={approveNote} onChange={e => setApproveNote(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelApprove}>Cancel</Button>
                  <Button variant="success" onClick={confirmApprove}><Icon name="Check" size={14} /> {canFinanceAct ? 'Confirm final approval' : 'Confirm approval'}</Button>
                </div>
              </div>
            )}
            {rejectOpen && (
              <div className="pop rounded-md border border-border bg-muted/40 p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reject_reason" required>Reason</Label>
                  <Textarea id="reject_reason" placeholder="Tell the employee what to fix or clarify (5–500 characters)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{!reasonValid && rejectReason.length > 0 ? (rejectReason.length < 5 ? 'A bit more detail required.' : 'Too long.') : 'Visible to the employee.'}</span>
                    <span className="tabular-nums">{rejectReason.trim().length}/500</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={cancelReject}>Cancel</Button>
                  <Button variant="destructive" onClick={confirmReject} disabled={!reasonValid}><Icon name="X" size={14} /> Confirm rejection</Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-end gap-3 min-w-0">
              <div className="text-2xl font-semibold tabular-nums leading-none">{displayAmount}</div>
              <div className="text-xs text-muted-foreground pb-0.5">
                {expense.lines.length} {expense.lines.length === 1 ? 'line' : 'lines'}
                {isDirty && <span className="ml-2 text-amber-700">· Unsaved changes</span>}
              </div>
            </div>
            {leftActions && <div className="flex items-center gap-2 pl-2 border-l border-border ml-1">{leftActions}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {hint}
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ExpenseDetail, HistoryTimeline, useUnsavedChanges, NavGuardProvider, useNavGuard,
  LineItemsEditor, ReadOnlyExpense,
});
