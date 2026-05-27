// shadcn-style primitives, hand-rolled with Tailwind to match shadcn/ui aesthetics.
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// ---------- Icon helper ----------
function Icon({ name, size = 16, className = '', strokeWidth = 2, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    el.innerHTML = '';
    const icons = (window.lucide && window.lucide.icons) || {};
    // lucide UMD exposes icons keyed by PascalCase
    const node = icons[name];
    if (node && node.toSvg) {
      el.innerHTML = node.toSvg({ width: size, height: size, 'stroke-width': strokeWidth });
    } else if (window.lucide && window.lucide.createIcons) {
      // fallback: render a span with data-lucide and let createIcons hydrate
      el.innerHTML = `<i data-lucide="${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}" style="width:${size}px;height:${size}px"></i>`;
      window.lucide.createIcons({ attrs: { 'stroke-width': strokeWidth } });
    }
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={'inline-flex items-center justify-center ' + className} style={{ width: size, height: size, lineHeight: 0, ...(style||{}) }} aria-hidden="true" />;
}

// ---------- cn ----------
function cn(...parts) { return parts.filter(Boolean).join(' '); }

// ---------- Button ----------
function Button({ variant = 'default', size = 'default', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50';
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    success: 'bg-green-600 text-white hover:bg-green-600/90 focus-visible:ring-green-600',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  };
  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-10 px-6',
    icon: 'h-9 w-9',
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props}>{children}</button>;
}

// ---------- Input ----------
function Input({ className = '', ...props }) {
  return <input className={cn('flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}

// ---------- Textarea ----------
function Textarea({ className = '', ...props }) {
  return <textarea className={cn('flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}

// ---------- Label ----------
function Label({ className = '', children, htmlFor, required }) {
  return <label htmlFor={htmlFor} className={cn('text-sm font-medium leading-none text-foreground', className)}>{children}{required && <span className="text-destructive ml-0.5">*</span>}</label>;
}

// ---------- Card ----------
function Card({ className = '', children, ...rest }) {
  return <div className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)} {...rest}>{children}</div>;
}
function CardHeader({ className = '', children }) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;
}
function CardTitle({ className = '', children }) {
  return <h3 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>{children}</h3>;
}
function CardDescription({ className = '', children }) {
  return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>;
}
function CardContent({ className = '', children }) {
  return <div className={cn('p-6 pt-0', className)}>{children}</div>;
}
function CardFooter({ className = '', children }) {
  return <div className={cn('flex items-center p-6 pt-0', className)}>{children}</div>;
}

// ---------- Badge ----------
function Badge({ variant = 'default', className = '', children }) {
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-destructive-foreground',
    outline: 'text-foreground',
  };
  return <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', variants[variant], className)}>{children}</span>;
}

// ---------- Select (custom popover-based) ----------
function Select({ value, onChange, options, placeholder = 'Select…', className = '', disabled }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null); // { left, top, width, dropUp }
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const recalc = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const margin = 8;
    const estHeight = Math.min(256, options.length * 32 + 8);
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const dropUp = spaceBelow < estHeight && r.top > estHeight;
    setCoords({
      left: r.left,
      top: dropUp ? r.top - 4 : r.bottom + 4,
      width: r.width,
      dropUp,
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    recalc();
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onReposition = () => recalc();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, recalc]);

  const selected = options.find(o => o.value === value);
  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn('flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50')}
      >
        <span className={selected ? '' : 'text-muted-foreground'}>{selected ? selected.label : placeholder}</span>
        <Icon name="ChevronDown" size={16} className="text-muted-foreground" />
      </button>
      {open && coords && ReactDOM.createPortal(
        <div
          ref={popRef}
          className="pop fixed z-[100] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          style={{
            left: coords.left,
            width: coords.width,
            ...(coords.dropUp ? { bottom: window.innerHeight - coords.top } : { top: coords.top }),
          }}
        >
          <div className="max-h-64 overflow-auto">
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn('flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground', o.value === value && 'bg-accent')}
              >
                <span>{o.label}</span>
                {o.value === value && <Icon name="Check" size={14} />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ---------- Checkbox ----------
function Checkbox({ checked, onChange, id, label, className = '' }) {
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-2 text-sm', className)}>
      <span
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow',
          checked ? 'bg-primary text-primary-foreground' : 'bg-background'
        )}
      >
        {checked && <Icon name="Check" size={12} />}
      </span>
      {label && <span className="select-none">{label}</span>}
      <input type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
    </label>
  );
}

// ---------- Popover ----------
function Popover({ trigger, children, align = 'start', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div className={cn('pop absolute z-40 mt-1 min-w-[14rem] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md', align === 'end' ? 'right-0' : 'left-0', className)}>
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

// ---------- Dialog (modal) ----------
function Dialog({ open, onOpenChange, children, className = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <div className="dlg-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={cn('dlg-panel w-full max-w-md rounded-lg border border-border bg-background shadow-lg', className)} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
function DialogHeader({ children, className = '' }) { return <div className={cn('flex flex-col space-y-1.5 p-6 pb-3', className)}>{children}</div>; }
function DialogTitle({ children, className = '' }) { return <h2 className={cn('text-lg font-semibold leading-none', className)}>{children}</h2>; }
function DialogDescription({ children, className = '' }) { return <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>; }
function DialogFooter({ children, className = '' }) { return <div className={cn('flex flex-row justify-end gap-2 p-6 pt-3', className)}>{children}</div>; }
function DialogBody({ children, className = '' }) { return <div className={cn('px-6 pb-3 text-sm', className)}>{children}</div>; }

// ---------- AlertDialog ----------
function AlertDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, destructive }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
        <Button variant={destructive ? 'destructive' : 'default'} onClick={() => { onConfirm && onConfirm(); onOpenChange(false); }}>{confirmLabel}</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ---------- Tabs ----------
function Tabs({ value, onChange, options, className = '' }) {
  return (
    <div className={cn('inline-flex h-9 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2',
            o.value === value ? 'bg-background text-foreground shadow' : 'hover:text-foreground'
          )}
        >{o.label}</button>
      ))}
    </div>
  );
}

// ---------- Toast (Sonner-style) ----------
const ToastCtx = createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((arr) => [...arr, { id, ...t }]);
    setTimeout(() => setToasts((arr) => arr.filter(x => x.id !== id)), t.duration || 3200);
  }, []);
  const toast = useMemo(() => ({
    success: (msg, opts = {}) => push({ kind: 'success', message: msg, ...opts }),
    error: (msg, opts = {}) => push({ kind: 'error', message: msg, ...opts }),
    info: (msg, opts = {}) => push({ kind: 'info', message: msg, ...opts }),
  }), [push]);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="pop pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm shadow-lg">
            <div className={cn('mt-0.5 flex h-5 w-5 items-center justify-center rounded-full',
              t.kind === 'success' && 'bg-green-100 text-green-700',
              t.kind === 'error' && 'bg-red-100 text-red-700',
              t.kind === 'info' && 'bg-secondary text-foreground'
            )}>
              <Icon name={t.kind === 'success' ? 'Check' : t.kind === 'error' ? 'X' : 'Info'} size={12} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <div className="font-medium leading-tight">{t.message}</div>
              {t.description && <div className="text-muted-foreground mt-0.5">{t.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
function useToast() { return useContext(ToastCtx); }

// ---------- Table primitives ----------
function Table({ className = '', children }) {
  return <div className="w-full overflow-auto rounded-md border border-border"><table className={cn('w-full caption-bottom text-sm', className)}>{children}</table></div>;
}
function THead({ children }) { return <thead className="bg-muted/40 [&_tr]:border-b">{children}</thead>; }
function TBody({ children }) { return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>; }
function TR({ children, className = '', onClick, role }) {
  return <tr role={role} onClick={onClick} className={cn('border-b border-border transition-colors', onClick && 'cursor-pointer hover:bg-muted/40', className)}>{children}</tr>;
}
function TH({ children, className = '' }) { return <th className={cn('h-10 px-4 text-left align-middle text-xs font-medium text-muted-foreground', className)}>{children}</th>; }
function TD({ children, className = '' }) { return <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>; }

// ---------- Status badge ----------
function StatusBadge({ status, rejectedByRole }) {
  if (status === 'draft') return <Badge variant="secondary">Draft</Badge>;
  if (status === 'pending_manager') return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-yellow-500 px-2 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-50/60" title="Awaiting manager review">
      <span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-500/15 text-[9px] font-bold text-yellow-700">1</span>
      Pending Manager
    </span>
  );
  if (status === 'pending_finance') return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-blue-400 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50" title="Awaiting finance review">
      <span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500/15 text-[9px] font-bold text-blue-700">2</span>
      Pending Finance
    </span>
  );
  if (status === 'approved') return <span className="inline-flex items-center whitespace-nowrap rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Approved</span>;
  if (status === 'rejected') {
    const who = rejectedByRole === 'finance' ? 'Finance' : rejectedByRole === 'manager' ? 'Manager' : null;
    return <span title={who ? `Rejected by ${who}` : 'Rejected'} className="inline-flex items-center whitespace-nowrap rounded-md border border-transparent bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground cursor-help">{who ? `Rejected · ${who}` : 'Rejected'}</span>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

// ---------- Skeleton ----------
function Skeleton({ className = '' }) { return <div className={cn('skel', className)} />; }

// expose
Object.assign(window, {
  cn, Icon, Button, Input, Textarea, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Badge, Select, Checkbox, Popover, Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody,
  AlertDialog, Tabs, ToastProvider, useToast, Table, THead, TBody, TR, TH, TD, StatusBadge, Skeleton,
});
