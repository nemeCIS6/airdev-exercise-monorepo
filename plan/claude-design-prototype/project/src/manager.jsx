// Manager screens: Review, Team.

function ManagerReview({ go }) {
  const store = useStore();
  const user = store.currentUser();
  // direct reports
  const reportIds = React.useMemo(() => store.data.users.filter(u => u.managerId === user.id).map(u => u.id), [store.data.users, user.id]);
  // expenses scoped to direct reports, excluding drafts (managers don't see drafts)
  const scoped = React.useMemo(() => store.data.expenses
    .filter(e => reportIds.includes(e.employeeId) && e.status !== 'draft')
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')), [store.data.expenses, reportIds]);

  const [filters, setFilters] = React.useState({ statuses: ['pending_manager'], from: '', to: '' });
  const [devState, setDevState] = React.useState('normal');
  const filtered = applyFilters(scoped, filters);
  const counts = getCounts(scoped);

  const userById = (id) => store.data.users.find(u => u.id === id);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">Step 1 of approval. Approve or reject expenses from your direct reports.</p>
        </div>
        {counts.pending_manager > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{counts.pending_manager}</span> awaiting your review
          </div>
        )}
      </div>

      <div className="mb-3"><StatusCountChips counts={counts} /></div>
      <div className="mb-5">
        <ExpenseFilters filters={filters} onChange={setFilters} statusDefault={['pending_manager']} />
      </div>

      {devState === 'loading' && <TableSkeleton rows={5} cols={7} />}
      {devState === 'error' && <ErrorState onRetry={() => setDevState('normal')} />}
      {devState === 'empty' && (
        <EmptyState icon="CheckCheck" title="Nothing to review" body="You're all caught up. New submissions from your team will appear here." />
      )}
      {devState === 'normal' && (
        filtered.length === 0 ? (
          scoped.length === 0 ? (
            <EmptyState icon="CheckCheck" title="Nothing to review" body="When your direct reports submit expenses, they'll show up here." />
          ) : (
            <EmptyState icon="Filter" title="No expenses match these filters" body="Try clearing filters or expanding your date range."
              action={<Button variant="outline" onClick={() => setFilters({ statuses: ['pending_manager'], from: '', to: '' })}>Reset to pending</Button>} />
          )
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Submitted</TH>
                <TH>Employee</TH>
                <TH>Summary</TH>
                <TH>Merchant</TH>
                <TH>Categories</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map(e => {
                const owner = userById(e.employeeId);
                return (
                  <TR key={e.id} onClick={() => go({ name: 'detail', id: e.id })}>
                    <TD className="text-muted-foreground whitespace-nowrap">{e.submittedAt ? formatDate(e.submittedAt) : '—'}</TD>
                    <TD className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">{owner?.name.split(' ').map(s => s[0]).join('').slice(0, 2)}</span>
                        <span>{owner?.name || 'Unknown'}</span>
                      </div>
                    </TD>
                    <TD className="max-w-[260px]"><div className="truncate font-medium">{e.summary}</div></TD>
                    <TD className="text-muted-foreground">{e.merchant || '—'}</TD>
                    <TD className="text-sm text-muted-foreground max-w-[260px]"><div className="truncate">{categoriesColText(e)}</div></TD>
                    <TD className="text-right font-medium tabular-nums">{formatMoney(expenseTotal(e), e.currency)}</TD>
                    <TD><StatusBadge status={e.status} rejectedByRole={e.rejectedByRole} /></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )
      )}

      <DevStatesToggle value={devState} onChange={setDevState} />
    </div>
  );
}

// ---- Finance Review queue ----
function FinanceReview({ go }) {
  const store = useStore();
  const userById = (id) => store.data.users.find(u => u.id === id);

  // All expenses where status === pending_finance, sorted by managerDecidedAt asc (oldest first)
  const scoped = React.useMemo(() => store.data.expenses
    .filter(e => e.status === 'pending_finance')
    .sort((a, b) => (a.managerDecidedAt || '').localeCompare(b.managerDecidedAt || '')), [store.data.expenses]);

  // Provide counts across all non-draft expenses in the org for context
  const orgScoped = React.useMemo(() => store.data.expenses.filter(e => e.status !== 'draft'), [store.data.expenses]);
  const counts = getCounts(orgScoped);

  const [filters, setFilters] = React.useState({ statuses: ['pending_finance'], from: '', to: '' });
  const [devState, setDevState] = React.useState('normal');
  // When the user expands filters beyond pending_finance, also show those (across org)
  const visible = React.useMemo(() => {
    const base = filters.statuses.length === 1 && filters.statuses[0] === 'pending_finance'
      ? scoped
      : orgScoped;
    return applyFilters(base, filters);
  }, [filters, scoped, orgScoped]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">Step 2 of approval. Final sign-off on expenses already cleared by a manager.</p>
        </div>
        {counts.pending_finance > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{counts.pending_finance}</span> awaiting your review
          </div>
        )}
      </div>

      <div className="mb-3"><StatusCountChips counts={counts} /></div>
      <div className="mb-5">
        <ExpenseFilters filters={filters} onChange={setFilters} statusDefault={['pending_finance']} />
      </div>

      {devState === 'loading' && <TableSkeleton rows={5} cols={7} />}
      {devState === 'error' && <ErrorState onRetry={() => setDevState('normal')} />}
      {devState === 'empty' && (
        <EmptyState icon="CheckCheck" title="Nothing to review" body="No expenses are awaiting finance sign-off right now." />
      )}
      {devState === 'normal' && (
        visible.length === 0 ? (
          <EmptyState icon="CheckCheck" title="Inbox zero" body="No expenses are awaiting finance sign-off. New submissions appear here after a manager approves them." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Submitted</TH>
                <TH>Employee</TH>
                <TH>Manager</TH>
                <TH>Summary</TH>
                <TH>Categories</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {visible.map(e => {
                const owner = userById(e.employeeId);
                const mgr = owner && owner.managerId ? userById(owner.managerId) : null;
                return (
                  <TR key={e.id} onClick={() => go({ name: 'detail', id: e.id })}>
                    <TD className="text-muted-foreground whitespace-nowrap">{e.submittedAt ? formatDate(e.submittedAt) : '—'}</TD>
                    <TD className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">{owner?.name.split(' ').map(s => s[0]).join('').slice(0, 2)}</span>
                        <span>{owner?.name || 'Unknown'}</span>
                      </div>
                    </TD>
                    <TD className="text-muted-foreground whitespace-nowrap">{mgr ? mgr.name : <span className="italic">Unassigned</span>}</TD>
                    <TD className="max-w-[240px]"><div className="truncate font-medium">{e.summary}</div></TD>
                    <TD className="text-sm text-muted-foreground max-w-[240px]"><div className="truncate">{categoriesColText(e)}</div></TD>
                    <TD className="text-right font-medium tabular-nums">{formatMoney(expenseTotal(e), e.currency)}</TD>
                    <TD><StatusBadge status={e.status} rejectedByRole={e.rejectedByRole} /></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )
      )}

      <DevStatesToggle value={devState} onChange={setDevState} />
    </div>
  );
}

function ManagerTeam() {
  const store = useStore();
  const toast = useToast();
  const me = store.currentUser();
  const managers = store.data.users.filter(u => u.role === 'manager');
  const employees = store.data.users.filter(u => u.role === 'employee');
  const mgrOptions = [{ value: '', label: 'Unassigned' }, ...managers.map(m => ({ value: m.id, label: m.name }))];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone you can assign managers for. {/* NOTE (prototype): production app supports many managers/employees; we seed one of each. */}
        </p>
      </div>
      {employees.length === 0 ? (
        <EmptyState icon="Users" title="No employees yet" body="When employees sign up, they'll appear here." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Display name</TH>
              <TH>Email</TH>
              <TH className="w-[280px]">Manager</TH>
            </TR>
          </THead>
          <TBody>
            {employees.map(emp => (
              <TR key={emp.id}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">{emp.name.split(' ').map(s => s[0]).join('').slice(0, 2)}</span>
                    <span className="font-medium">{emp.name}</span>
                  </div>
                </TD>
                <TD className="text-muted-foreground">{emp.email}</TD>
                <TD>
                  <Select
                    value={emp.managerId || ''}
                    options={mgrOptions}
                    onChange={(v) => {
                      store.assignManager(emp.id, v);
                      const mgr = v ? managers.find(m => m.id === v) : null;
                      toast.success(`${emp.name.split(' ')[0]}\u2019s manager updated to ${mgr ? mgr.name.split(' ')[0] : 'Unassigned'}.`);
                    }}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

Object.assign(window, { ManagerReview, ManagerTeam, FinanceReview });
