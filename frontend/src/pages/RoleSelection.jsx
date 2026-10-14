import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Scissors,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useShopName } from '../context/ShopContext.jsx';

const roles = [
  {
    title: 'Customer',
    description: 'Track your orders, fittings, and payments in one place.',
    detail: 'Sign in with your registered phone number and password.',
    path: '/login',
    action: 'Customer sign in',
    Icon: UserRound,
  },
  {
    title: 'Tailor / Staff',
    description: 'See assigned work, customer measurements, and your salary.',
    detail: 'Use your registered phone number and password.',
    path: '/tailor/login',
    action: 'Staff sign in',
    Icon: Scissors,
  },
  {
    title: 'Admin / Shop Owner',
    description: 'Manage orders, customers, team approvals, and shop finances.',
    detail: 'Owner access is granted only to authorized admin accounts.',
    path: '/admin/login',
    action: 'Owner sign in',
    Icon: ShieldCheck,
  },
];

export default function RoleSelection() {
  const { user } = useAuth();
  const shopName = useShopName();
  if (user) return <Navigate to="/app" replace />;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--paper)] px-5 sm:px-8 lg:px-[max(2rem,calc((100vw-1160px)/2))]">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--navy)] text-white dark:text-slate-900">
            <Scissors size={17} />
          </span>
          <span className="font-serif text-lg font-semibold text-[var(--ink)]">
            {shopName}
            <small className="mt-0.5 block font-sans text-[9px] font-semibold tracking-[.16em] text-[var(--muted)]">
              TAILORING ATELIER
            </small>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <Link
            to="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-[var(--muted)] no-underline hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] sm:text-sm"
          >
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>
      </header>
      <section
        className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20"
        aria-labelledby="role-select-title"
      >
        <span className="text-[11px] font-bold tracking-[.18em] text-[var(--sage)]">
          WELCOME TO {shopName.toUpperCase()}
        </span>
        <h1
          id="role-select-title"
          className="mt-3 max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
        >
          How would you like to sign in?
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          Choose the access that matches your work at the shop.
        </p>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {roles.map(({ title, description, detail, path, action, Icon }) => (
            <article
              className="flex min-h-[300px] flex-col rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-7"
              key={title}
            >
              <span className="grid size-12 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--sage)]">
                <Icon size={21} />
              </span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
              <small className="mt-3 text-xs leading-5 text-[var(--muted)]">{detail}</small>
              <Link
                className="mt-auto flex min-h-11 items-center justify-between gap-3 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-[#fffefa] no-underline transition hover:brightness-110 dark:text-slate-900"
                to={path}
              >
                {action}
                <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-7 flex items-center gap-2 text-xs leading-5 text-[var(--muted)]">
          <BriefcaseBusiness size={15} /> Shop permissions are checked on the server after sign-in.
        </p>
      </section>
    </main>
  );
}
