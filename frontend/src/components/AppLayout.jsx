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
  const menuButtonRef = useRef(null);
  const nav = useNavigate();
  const socket = useMemo(() => io({ withCredentials: true, autoConnect: false }), []);

  function closeNavigation() {
    setOpen(false);
    menuButtonRef.current?.focus();
  }

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
        if (open) closeNavigation();
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
  }, [open, toast]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const updateScrollLock = () => {
      document.body.style.overflow = window.matchMedia('(max-width: 767px)').matches
        ? 'hidden'
        : previousOverflow;
    };
    updateScrollLock();
    window.addEventListener('resize', updateScrollLock);
    return () => {
      window.removeEventListener('resize', updateScrollLock);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
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
    const message = (event) =>
      window.dispatchEvent(new CustomEvent('order-note-added', { detail: event }));
    const appointment = (event) =>
      window.dispatchEvent(new CustomEvent('appointments:refresh', { detail: event }));
    const notification = (event) => {
      setUnread((count) => count + 1);
      toast(event.title);
      window.dispatchEvent(new Event('notifications:refresh'));
    };
    socket.on('order:updated', updated);
    socket.on('order:created', created);
    socket.on('order:message', message);
    socket.on('appointment:updated', appointment);
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
    <div className="workspace-layout">
      <aside
        id="workspace-sidebar"
        aria-label="Shop workspace navigation"
        className={`workspace-sidebar${open ? ' is-open' : ''}`}
      >
        <div className="workspace-sidebar-header">
          <Link className="workspace-brand" to="/app">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--navy)] text-white dark:text-slate-900">
              <Scissors size={17} aria-hidden="true" />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight text-[var(--ink)]">
              stitchcraft
              <small className="mt-0.5 block font-sans text-[9px] font-semibold tracking-[.15em] text-[var(--muted)]">
                ATELIER MANAGEMENT
              </small>
            </span>
          </Link>
          <button
            className="workspace-sidebar-close"
            onClick={closeNavigation}
            aria-label="Close navigation"
          >
            <X size={19} aria-hidden="true" />
          </button>
          {user.role === ROLES.ADMIN && (
            <div className="workspace-shop-card">
              <i aria-hidden="true">{shopName?.charAt(0) || 'S'}</i>
              <span>
                <b>{shopName}</b>
                <small>Shop workspace</small>
              </span>
            </div>
          )}
        </div>
        <nav className="workspace-sidebar-nav" aria-label="Main navigation">
          {menus[user.role]?.map(([group, items]) => (
            <section className="workspace-nav-group" key={group}>
              <span className="workspace-nav-label">{group}</span>
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
                    `workspace-nav-link${isActive ? ' is-active' : ''}`
                  }
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </section>
          ))}
          <NavLink
            className={({ isActive }) =>
              `workspace-nav-link${isActive ? ' is-active' : ''}`
            }
            to="/app/notifications"
            onClick={() => setOpen(false)}
          >
            <Bell size={18} aria-hidden="true" />
            <span>Notifications</span>
            {unread > 0 && (
              <span className="workspace-nav-count">{unread > 9 ? '9+' : unread}</span>
            )}
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `workspace-nav-link${isActive ? ' is-active' : ''}`
            }
            to="/app/profile"
            onClick={() => setOpen(false)}
          >
            <Settings size={18} aria-hidden="true" />
            <span>Profile</span>
          </NavLink>
          <button
            className="workspace-nav-link workspace-help-link"
            onClick={() => toast('For help, contact your atelier administrator.', 'info')}
          >
            <CircleHelp size={18} aria-hidden="true" />
            <span>Help &amp; support</span>
          </button>
        </nav>
        <footer className="workspace-sidebar-footer">
          <Avatar name={user.name} />
          <span className="workspace-user-summary">
            <b>{user.name}</b>
            <small>{user.role.toLowerCase()}</small>
          </span>
          <button
            className="workspace-sign-out"
            title="Sign out"
            aria-label="Sign out"
            onClick={signOut}
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
        </footer>
      </aside>
      <div className="workspace-main">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--paper)]/95 px-4 backdrop-blur sm:px-6 lg:px-9">
          <button
            ref={menuButtonRef}
            className="workspace-menu-button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="workspace-sidebar"
          >
            {open ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
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
        <main className="workspace-content">
          <Outlet />
        </main>
      </div>
      {open && (
        <button
          className="workspace-sidebar-scrim"
          onClick={closeNavigation}
          aria-label="Close navigation"
        />
      )}
    </div>
  );
}
