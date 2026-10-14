import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
export function Button({
  children,
  to,
  onClick,
  type = 'button',
  variant = 'primary',
  icon: Icon,
  disabled = false,
  className = '',
}) {
  const C = to ? Link : 'button';
  return (
    <C
      to={to}
      type={to ? undefined : type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:pointer-events-none disabled:opacity-60 ${variant === 'primary' ? 'border-transparent bg-[var(--navy)] text-[#fffefa] shadow-sm hover:brightness-110 dark:text-[#17212a]' : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--surface-soft)]'} ${className}`}
    >
      {Icon ? <Icon size={15} /> : null}
      {children}
    </C>
  );
}
export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0">
        <span className="text-[11px] font-bold tracking-[.16em] text-[var(--sage)]">{eyebrow}</span>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
export function Avatar({ name = '', className = '' }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase() || '?';
  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-soft)] text-sm font-semibold text-[var(--sage)] ring-1 ring-[var(--line)] ${className}`}
    >
      {initials}
    </span>
  );
}
export function StatusBadge({ value }) {
  const key = String(value).toLowerCase();
  const tone = ['completed', 'delivered', 'paid', 'active', 'approved'].includes(key)
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
    : ['cancelled', 'rejected', 'failed', 'overdue'].includes(key)
      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
      : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      {String(value).replaceAll('_', ' ')}
    </span>
  );
}
export function Loading({ label = 'Loading your workspace' }) {
  return (
    <div
      className="mx-auto grid min-h-64 max-w-5xl content-center gap-5 p-6"
      role="status"
      aria-live="polite"
    >
      <div className="h-9 w-56 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((x) => (
          <span
            className="h-28 animate-pulse rounded-xl border border-[var(--line)] bg-[var(--paper)]"
            key={x}
          />
        ))}
      </div>
      <span className="flex items-center gap-3 text-sm text-[var(--muted)]">
        <i className="size-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--sage)]" />
        {label}
      </span>
    </div>
  );
}
export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="grid gap-3" aria-label="Loading content">
      {Array.from({ length: rows }, (_, i) => (
        <span className="h-12 animate-pulse rounded-lg bg-[var(--surface-soft)]" key={i} />
      ))}
    </div>
  );
}
export function ErrorState({ message = 'Something went wrong', retry }) {
  return (
    <div className="mx-auto grid max-w-xl justify-items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-8 text-center shadow-sm">
      <b className="text-lg font-semibold text-[var(--ink)]">{message}</b>
      <span className="text-sm text-[var(--muted)]">Check your connection and try again.</span>
      {retry && (
        <button
          className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-soft)]"
          onClick={retry}
        >
          Try again
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title = 'Nothing here yet',
  text = 'When you have a new record, it will appear here.',
  action,
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-6 py-9 text-center">
      <b className="text-base font-semibold text-[var(--ink)]">{title}</b>
      <span className="max-w-md text-sm leading-6 text-[var(--muted)]">{text}</span>
      {action}
    </div>
  );
}
export function SearchBox({ value, onChange, placeholder = 'Search...' }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 text-[var(--muted)] focus-within:ring-2 focus-within:ring-[var(--sage)]">
      <Search size={15} />
      <input
        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Modal({ title, children, onClose }) {
  const modalRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    modalRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [
        ...(modalRef.current?.querySelectorAll(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) || []),
      ].filter((item) => item.getAttribute('aria-hidden') !== 'true' && item.offsetParent !== null);
      if (!items.length) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }
      const first = items[0],
        last = items.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === modalRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 text-[var(--ink)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <button
            className="grid size-9 place-items-center rounded-lg text-xl text-[var(--muted)] hover:bg-[var(--surface-soft)]"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Metric({ label, value, note, icon: Icon }) {
  return (
    <article className="group min-w-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--muted)] sm:text-sm">{label}</span>
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--sage)]">
            <Icon size={17} />
          </span>
        )}
      </div>
      <strong className="mt-3 block break-words text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
        {value}
      </strong>
      <small className="mt-1 block text-xs leading-5 text-[var(--muted)]">{note}</small>
    </article>
  );
}
export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages < 2) return null;
  return (
    <div className="pagination">
      <span>
        {meta.total} records · page {meta.page} of {meta.pages}
      </span>
      <div>
        <button disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Previous
        </button>
        <button disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
