// Employee screens: My Expenses (list) + filters/counts/empty/loading.

// ---- Shared list filters / table ----
function StatusCountChips({ counts }) {
  const items = [
    { key: 'draft', label: 'Drafts', n: counts.draft },
    { key: 'pending_manager', label: 'Pending Manager', n: counts.pending_manager },
    { key: 'pending_finance', label: 'Pending Finance', n: counts.pending_finance },
    { key: 'approved', label: 'Approved', n: counts.approved },
    { key: 'rejected', label: 'Rejected', n: counts.rejected },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {items.map((it, i) => (
        <React.Fragment key={it.key}>
          {i > 0 && <span className="text-muted-foreground/40">·</span>}
          <span className="text-muted-foreground">{it.label}: <span className="font-medium text-foreground tabular-nums">{it.n}</span></span>
        </React.Fragment>
      ))}
    </div>
  );
}

function MultiCheckPopover({ label, values, options, onChange, allLabel = 'All' }) {
  const summary = values.length === 0 ? allLabel : values.length === 1 ? options.find(o => o.value === values[0])?.label : `${values.length} selected`;
  const toggle = (v) => onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  return (
    <Popover
      trigger={
        <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-accent">
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium">{summary}</span>
          <Icon name="ChevronDown" size={14} className="text-muted-foreground" />
        </button>
      }
    >
      {({ close }) => (
        <div className="flex flex-col gap-2 min-w-[180px]">
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border mb-1">
            <span>{label}</span>
            {values.length > 0 && <button onClick={() => onChange([])} className="hover:text-foreground">Clear</button>}
          </div>
          {options.map(o => (
            <Checkbox key={o.value} id={`f_${label}_${o.value}`} checked={values.includes(o.value)} onChange={() => toggle(o.value)} label={o.label} />
          ))}
        </div>
      )}
    </Popover>
  );
}

function ExpenseFilters({ filters, onChange, statusDefault }) {
  const update = (patch) => onChange({ ...filters, ...patch });
  const cleared = filters.statuses.length === 0 && !filters.from && !filters.to;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <MultiCheckPopover
        label="Status"
        values={filters.statuses}
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'pending_manager', label: 'Pending Manager' },
          { value: 'pending_finance', label: 'Pending Finance' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
        ]}
        onChange={(v) => update({ statuses: v })}
      />
      <div className="flex items-center gap-2">
        <Label className="text-muted-foreground text-xs whitespace-nowrap">From</Label>
        <Input type="date" value={filters.from || ''} onChange={e => update({ from: e.target.value })} className="h-9 w-[150px]" />
        <Label className="text-muted-foreground text-xs">To</Label>
        <Input type="date" value={filters.to || ''} onChange={e => update({ to: e.target.value })} className="h-9 w-[150px]" />
      </div>
      {!cleared && (
        <button onClick={() => onChange({ statuses: statusDefault || [], from: '', to: '' })} className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1">Clear filters</button>
      )}
    </div>
  );
}

function applyFilters(expenses, filters) {
  return expenses.filter(e => {
    if (filters.statuses.length && !filters.statuses.includes(e.status)) return false;
    if (filters.from && e.expenseDate < filters.from) return false;
    if (filters.to && e.expenseDate > filters.to) return false;
    return true;
  });
}

function getCounts(expenses) {
  return {
    draft: expenses.filter(e => e.status === 'draft').length,
    pending_manager: expenses.filter(e => e.status === 'pending_manager').length,
    pending_finance: expenses.filter(e => e.status === 'pending_finance').length,
    approved: expenses.filter(e => e.status === 'approved').length,
    rejected: expenses.filter(e => e.status === 'rejected').length,
  };
}

// ---- Empty / error / loading ----
function EmptyState({ icon = 'Inbox', title, body, action }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
          <Icon name={icon} size={22} />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        {body && <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{body}</p>}
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}

function ErrorState({ onRetry, message }) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center justify-center text-center py-12 px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <Icon name="TriangleAlert" size={22} />
        </div>
        <h3 className="text-base font-semibold">Something went wrong</h3>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{message || 'We couldn\u2019t load that. Try again in a moment.'}</p>
        <div className="mt-5"><Button variant="outline" onClick={onRetry}><Icon name="RefreshCw" size={14} /> Retry</Button></div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="bg-muted/40 h-10 border-b border-border" />
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid items-center px-4 py-3 gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((__, j) => (
              <Skeleton key={j} className={`h-4 ${j === cols - 1 ? 'w-16' : 'w-3/4'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Dev "show states" toggle ----
function DevStatesToggle({ value, onChange }) {
  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1 rounded-md border border-border bg-background/95 backdrop-blur px-1.5 py-1 shadow-sm text-[11px]">
      <span className="text-muted-foreground px-1.5">Demo state:</span>
      {['normal', 'loading', 'empty', 'error'].map(s => (
        <button key={s} onClick={() => onChange(s)}
          className={cn('rounded px-1.5 py-0.5 capitalize', value === s ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>{s}</button>
      ))}
    </div>
  );
}

// ---- My Expenses ----
function MyExpenses({ go }) {
  const store = useStore();
  const user = store.currentUser();
  const own = React.useMemo(() => store.data.expenses.filter(e => e.employeeId === user.id), [store.data.expenses, user.id]);

  const [filters, setFilters] = React.useState({ statuses: [], from: '', to: '' });
  const [devState, setDevState] = React.useState('normal');
  const filtered = applyFilters(own, filters);
  const counts = getCounts(own);

  const onNew = () => {
    const id = store.createDraft(user.id);
    go({ name: 'detail', id });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your submissions, drafts, and reimbursements.</p>
        </div>
        <Button onClick={onNew}><Icon name="Plus" size={14} /> New expense</Button>
      </div>

      <div className="mb-3"><StatusCountChips counts={counts} /></div>
      <div className="mb-5"><ExpenseFilters filters={filters} onChange={setFilters} /></div>

      {devState === 'loading' && <TableSkeleton rows={5} cols={6} />}
      {devState === 'error' && <ErrorState onRetry={() => setDevState('normal')} />}
      {devState === 'empty' && (
        <EmptyState
          icon="Receipt"
          title="No expenses yet"
          body="Start your first expense report. We'll save it as a draft until you submit."
          action={<Button onClick={onNew}><Icon name="Plus" size={14} /> New expense</Button>}
        />
      )}
      {devState === 'normal' && (
        filtered.length === 0 ? (
          own.length === 0 ? (
            <EmptyState
              icon="Receipt"
              title="No expenses yet"
              body="Start your first expense report. We'll save it as a draft until you submit."
              action={<Button onClick={onNew}><Icon name="Plus" size={14} /> New expense</Button>}
            />
          ) : (
            <EmptyState
              icon="Filter"
              title="No expenses match these filters"
              body="Try clearing filters or expanding your date range."
              action={<Button variant="outline" onClick={() => setFilters({ statuses: [], from: '', to: '' })}>Clear filters</Button>}
            />
          )
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Summary</TH>
                <TH>Merchant</TH>
                <TH>Categories</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map(e => (
                <TR key={e.id} onClick={() => go({ name: 'detail', id: e.id })}>
                  <TD className="text-muted-foreground whitespace-nowrap">{formatDate(e.expenseDate)}</TD>
                  <TD className="max-w-[280px]"><div className="truncate font-medium">{e.summary || <span className="text-muted-foreground italic">Untitled draft</span>}</div></TD>
                  <TD className="text-muted-foreground">{e.merchant || '—'}</TD>
                  <TD className="text-sm text-muted-foreground max-w-[280px]"><div className="truncate">{categoriesColText(e)}</div></TD>
                  <TD className="text-right font-medium tabular-nums">{formatMoney(expenseTotal(e), e.currency)}</TD>
                  <TD><StatusBadge status={e.status} rejectedByRole={e.rejectedByRole} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      )}

      <DevStatesToggle value={devState} onChange={setDevState} />
    </div>
  );
}

Object.assign(window, {
  MyExpenses, ExpenseFilters, StatusCountChips, EmptyState, ErrorState, TableSkeleton,
  applyFilters, getCounts, MultiCheckPopover, DevStatesToggle,
});
