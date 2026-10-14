import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Shirt,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useShopName } from '../context/ShopContext.jsx';
import { Avatar } from './UI.jsx';
import { errorMessage, ROLES } from '../utils/constants.js';
import ThemeToggle from './ThemeToggle.jsx';

const menus = {
  ADMIN: [
    [
      'Workspace',
      [
        ['Dashboard', '/app/dashboard', LayoutDashboard],
        ['Orders', '/app/orders', Shirt],
        ['Customers', '/app/customers', Users],
        ['Measurements', '/app/measurements', Scissors],
        ['Appointments', '/app/appointments', CalendarDays],
      ],
    ],
    [
      'Business',
      [
        ['Payments', '/app/payments', Wallet],
        ['Payroll', '/app/payroll', Wallet],
        ['Reports', '/app/reports', Activity],
        ['Audit log', '/app/audit-logs', Activity],
        ['Catalog', '/app/catalog', Settings],
        ['Team', '/app/team', Users],
        ['Settings', '/app/settings', Settings],
      ],
    ],
  ],
  TAILOR: [
    [
      'My work',
      [
        ['My dashboard', '/app/tailor-dashboard', LayoutDashboard],
        ['Assigned orders', '/app/assigned', Shirt],
        ['Customers', '/app/customers', Users],
        ['Measurements', '/app/measurements', Scissors],
        ['Appointments', '/app/appointments', CalendarDays],
        ['My salary', '/app/payroll', Wallet],
      ],
    ],
  ],
  CUSTOMER: [
    [
      'My atelier',
      [
        ['Dashboard', '/app/customer-dashboard', LayoutDashboard],
        ['My orders', '/app/my-orders', Shirt],
        ['Measurements', '/app/measurements', Scissors],
        ['Payments', '/app/payments', Wallet],
        ['Appointments', '/app/appointments', CalendarDays],
      ],
    ],
  ],
};

export default function AppLayout() {
  const shopName = useShopName();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const profileRef = useRef(null);
  const nav = useNavigate();
  const socket = useMemo(() => io({ withCredentials: true, autoConnect: false }), []);

  useEffect(() => {
    let alive = true;
    api
      .get('/notifications', { params: { unread: true } })
      .then(({ data }) => {
        if (alive) setUnread(data.meta?.unreadCount ?? (data.data || []).length);
      })
      .catch((error) => toast(errorMessage(error), 'error'));
    const unreadCount = (event) => {
      if (Number.isFinite(event.detail?.count)) setUnread(event.detail.count);
    };
    const clickAway = (event) => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setOpen(false);
      }
    };
    window.addEventListener('notifications:unread-count', unreadCount);
    document.addEventListener('mousedown', clickAway);
    document.addEventListener('keydown', escape);
    return () => {
      alive = false;
      window.removeEventListener('notifications:unread-count', unreadCount);
      document.removeEventListener('mousedown', clickAway);
      document.removeEventListener('keydown', escape);
    };
  }, [toast]);

  useEffect(() => {
    socket.connect();
    const updated = (event) => {
      toast(
        `Order ${event.orderNumber} updated: ${String(event.status || '')
          .replaceAll('_', ' ')
          .toLowerCase()}`,
      );
      window.dispatchEvent(new CustomEvent('order-status-updated', { detail: event }));
    };
    const created = (event) => toast(`New order ${event.orderNumber} received`);
    const notification = (event) => {
      setUnread((count) => count + 1);
      toast(event.title);
      window.dispatchEvent(new Event('notifications:refresh'));
    };
    socket.on('order:updated', updated);
    socket.on('order:created', created);
    socket.on('notification:new', notification);
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket, toast]);

  async function signOut() {
    await logout();
    nav('/');
  }
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] md:pl-[260px]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[var(--line)] bg-[var(--paper)] px-4 py-5 shadow-xl transition-transform duration-200 md:translate-x-0 md:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <Link className="mb-7 flex items-center gap-3 rounded-xl px-2 py-1 no-underline" to="/app">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--navy)] text-white dark:text-slate-900">
            <Scissors size={17} />
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight text-[var(--ink)]">
            stitchcraft
            <small className="mt-0.5 block font-sans text-[9px] font-semibold tracking-[.15em] text-[var(--muted)]">
              ATELIER MANAGEMENT
            </small>
          </span>
        </Link>
        <button
          className="absolute right-3 top-5 grid size-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-soft)] md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
        {user.role === ROLES.ADMIN && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3">
            <i className="grid size-9 place-items-center rounded-lg bg-[var(--paper)] font-serif text-lg not-italic text-[var(--sage)]">
              {shopName?.charAt(0) || 'S'}
            </i>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm font-semibold">{shopName}</b>
              <small className="mt-0.5 block text-xs text-[var(--muted)]">Shop workspace</small>
            </span>
          </div>
        )}
        {menus[user.role]?.map(([group, items]) => (
          <section className="mb-5" key={group}>
            <span className="mb-2 block px-3 text-[10px] font-bold tracking-[.16em] text-[var(--muted)]">
              {group.toUpperCase()}
            </span>
            {items.map(([label, path, Icon]) => (
              <NavLink
                key={label}
                to={path}
                end={[
                  '/app/dashboard',
                  '/app/assigned',
                  '/app/tailor-dashboard',
                  '/app/customer-dashboard',
                ].includes(path)}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium no-underline transition hover:bg-[var(--surface-soft)] ${isActive ? 'border-l-[3px] border-[var(--gold)] bg-[var(--surface-soft)] text-[var(--ink)]' : 'text-[var(--muted)]'}`
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </section>
        ))}
        <div className="flex-1" />
        <NavLink
          className={({ isActive }) =>
            `mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium no-underline transition hover:bg-[var(--surface-soft)] ${isActive ? 'bg-[var(--surface-soft)] text-[var(--ink)]' : 'text-[var(--muted)]'}`
          }
          to="/app/notifications"
          onClick={() => setOpen(false)}
        >
          <Bell size={17} />
          Notifications
          {unread > 0 && (
            <span className="ml-auto rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium no-underline transition hover:bg-[var(--surface-soft)] ${isActive ? 'bg-[var(--surface-soft)] text-[var(--ink)]' : 'text-[var(--muted)]'}`
          }
          to="/app/profile"
          onClick={() => setOpen(false)}
        >
          <Settings size={17} />
          Profile
        </NavLink>
        <button
          className="mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-soft)]"
          onClick={() => toast('For help, contact your atelier administrator.', 'info')}
        >
          <CircleHelp size={17} />
          Help &amp; support
        </button>
        <div className="mt-3 flex items-center gap-3 border-t border-[var(--line)] pt-4">
          <Avatar name={user.name} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm font-semibold">{user.name}</b>
            <small className="mt-0.5 block text-xs capitalize text-[var(--muted)]">
              {user.role.toLowerCase()}
            </small>
          </span>
          <button
            className="grid size-9 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
            title="Sign out"
            onClick={signOut}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="min-h-screen min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--paper)]/95 px-4 backdrop-blur sm:px-6 lg:px-9">
          <button
            className="grid size-10 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-soft)] md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <span className="min-w-0 truncate text-sm font-medium text-[var(--muted)]">
            {shopName} <i className="px-2 not-italic text-[var(--gold)]">/</i> Workspace
          </span>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <Link
              to="/app/notifications"
              className="relative grid size-10 place-items-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <div className="relative" ref={profileRef}>
              <button
                className="flex items-center gap-2 rounded-xl p-1.5 text-left transition hover:bg-[var(--surface-soft)] sm:gap-3 sm:px-2"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((value) => !value)}
              >
                <Avatar name={user.name} />
                <span className="hidden min-w-0 sm:block">
                  <b className="block max-w-36 truncate text-xs font-semibold text-[var(--ink)]">
                    {user.name}
                  </b>
                  <small className="mt-0.5 block text-[11px] capitalize text-[var(--muted)]">
                    {user.role.toLowerCase()}
                  </small>
                </span>
                <ChevronDown size={14} />
              </button>
              {profileOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--paper)] p-2 text-[var(--ink)] shadow-xl"
                  role="menu"
                >
                  <div className="border-b border-[var(--line)] px-3 py-3">
                    <b className="block truncate text-sm">{user.name}</b>
                    <small className="mt-1 block truncate text-xs text-[var(--muted)]">
                      {user.email}
                    </small>
                  </div>
                  <Link
                    className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm no-underline hover:bg-[var(--surface-soft)]"
                    role="menuitem"
                    to="/app/profile"
                    onClick={() => setProfileOpen(false)}
                  >
                    <UserRound size={15} />
                    My profile
                  </Link>
                  <Link
                    className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm no-underline hover:bg-[var(--surface-soft)]"
                    role="menuitem"
                    to="/app/notifications"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Bell size={15} />
                    Notifications{unread > 0 && <span className="nav-count">{unread}</span>}
                  </Link>
                  <button
                    className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-[var(--surface-soft)]"
                    role="menuitem"
                    onClick={signOut}
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] min-w-0 p-4 sm:p-6 lg:p-9">
          <Outlet />
        </main>
      </div>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
    </div>
  );
}
