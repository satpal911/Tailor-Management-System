import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Scissors } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../utils/constants.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useShopName } from '../context/ShopContext.jsx';

export default function AuthPage({ mode = 'customer' }) {
  const { user, loginAdmin, loginTailor, loginCustomer, registerCustomer, registerTailor } =
    useAuth();
  const { toast } = useToast();
  const shopName = useShopName();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const isCustomer = mode === 'customer' || mode === 'customer-register';
  const isCustomerRegistration = mode === 'customer-register';
  const isAdmin = mode === 'admin';
  const isTailorRegistration = mode === 'tailor-register';
  if (user) return <Navigate to="/app" replace />;

  async function submit(values) {
    setBusy(true);
    setRequestError('');
    try {
      if (isCustomerRegistration)
        await registerCustomer({
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          password: values.password,
        });
      else if (isCustomer) await loginCustomer({ phone: values.phone, password: values.password });
      else if (isAdmin) await loginAdmin({ email: values.email, password: values.password });
      else if (isTailorRegistration) {
        await registerTailor({
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          password: values.password,
          specialties: (values.specialties || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        });
        toast('Registration submitted. An administrator must approve your account.', 'success');
        navigate('/tailor/login');
        return;
      } else await loginTailor({ phone: values.phone, password: values.password });
      navigate('/app');
    } catch (error) {
      const message = errorMessage(error);
      setRequestError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const title = isAdmin
    ? 'Owner sign in.'
    : isCustomerRegistration
      ? 'Create your customer account.'
      : isCustomer
        ? 'Welcome back.'
        : isTailorRegistration
          ? 'Join the tailor team.'
          : 'Staff sign in.';
  const subtitle = isAdmin
    ? 'Use your owner account to manage the shop.'
    : isCustomerRegistration
      ? 'Create a password to track orders and manage your tailoring profile.'
      : isCustomer
        ? `Sign in to ${shopName} with your registered phone number.`
        : isTailorRegistration
          ? 'Submit your details. Shop access starts after approval.'
          : 'Sign in with your registered phone number.';
  const phoneRule = {
    required: 'Phone number is required',
    validate: (value) => {
      const digits = String(value || '').replace(/\D/g, '').length;
      return (digits >= 7 && digits <= 15) || 'Enter a valid phone number';
    },
  };
  const passwordRule = {
    required: 'Password is required',
    minLength: { value: 8, message: 'Use at least 8 characters' },
    maxLength: { value: 128, message: 'Password must be 128 characters or fewer' },
  };

  return (
    <div className="grid min-h-screen bg-[var(--paper)] text-[var(--ink)] lg:grid-cols-[.95fr_1.05fr]">
      <aside className="relative flex h-28 min-h-28 flex-row items-center justify-between overflow-hidden bg-slate-900 bg-[url('../assets/atelier-banner.svg')] bg-cover bg-center p-5 text-white before:absolute before:inset-0 before:bg-gradient-to-br before:from-slate-950/80 before:via-slate-900/50 before:to-emerald-950/70 before:content-[''] lg:min-h-screen lg:flex-col lg:p-10 xl:p-14">
        <Link className="relative z-10 flex items-center gap-3 text-white no-underline" to="/">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Scissors size={17} />
          </span>
          <span className="font-serif text-lg font-semibold">
            {shopName}
            <small className="mt-0.5 block font-sans text-[9px] font-semibold tracking-[.16em] text-white/70">
              TAILORING ATELIER
            </small>
          </span>
        </Link>
        <div className="relative z-10 my-auto hidden max-w-xl py-12 lg:block">
          <span className="text-[11px] font-bold tracking-[.2em] text-amber-200">
            A SHOP THAT RUNS LIKE A GOOD SEAM
          </span>
          <h2 className="mt-5 font-serif text-5xl font-medium leading-[1.12] tracking-tight xl:text-6xl">
            Made with care.
            <br />
            <em className="text-amber-200">Managed with ease.</em>
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/75">
            Bring the moving parts together, and get back to the craft that brought you here.
          </p>
        </div>
        <small className="relative z-10 hidden text-[10px] font-semibold tracking-[.16em] text-white/65 sm:block">
          ✳ &nbsp; THE ART OF A WELL-RUN ATELIER
        </small>
      </aside>
      <main className="relative flex min-h-[calc(100vh-7rem)] items-center justify-center px-5 py-20 sm:px-10 lg:min-h-screen">
        <div className="auth-header-actions">
          <Link to="/access" className="back-link">
            <ArrowLeft size={14} /> Back to role selection
          </Link>
          <ThemeToggle className="auth-theme-toggle" />
        </div>
        <div className="w-full max-w-md">
          <span className="text-[11px] font-bold tracking-[.18em] text-[var(--sage)]">
            {isCustomer
              ? 'CUSTOMER ACCESS'
              : isAdmin
                ? 'OWNER ACCESS'
                : isTailorRegistration
                  ? 'STAFF REGISTRATION'
                  : 'STAFF ACCESS'}
          </span>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mb-7 mt-3 text-sm leading-6 text-[var(--muted)]">{subtitle}</p>
          <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
            {(isCustomerRegistration || isTailorRegistration) && (
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Full name
                <input
                  autoComplete="name"
                  maxLength={120}
                  className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                  {...register('name', {
                    required: 'Name is required',
                    minLength: { value: 2, message: 'Enter your full name' },
                  })}
                />
                {errors.name && (
                  <small className="text-xs font-medium text-rose-700 dark:text-rose-300">
                    {errors.name.message}
                  </small>
                )}
              </label>
            )}
            {isAdmin && (
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Owner email
                <input
                  type="email"
                  autoComplete="username"
                  className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                  {...register('email', { required: 'Email is required' })}
                />
                {errors.email && (
                  <small className="text-xs font-medium text-rose-700 dark:text-rose-300">
                    {errors.email.message}
                  </small>
                )}
              </label>
            )}
            {!isAdmin && (
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Phone number
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                  {...register('phone', phoneRule)}
                />
                {errors.phone && (
                  <small className="text-xs font-medium text-rose-700 dark:text-rose-300">
                    {errors.phone.message}
                  </small>
                )}
              </label>
            )}
            {(isCustomer || isTailorRegistration) && (
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Password
                <input
                  type="password"
                  className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                  autoComplete={
                    isCustomerRegistration || isTailorRegistration
                      ? 'new-password'
                      : 'current-password'
                  }
                  {...register('password', passwordRule)}
                />
                {errors.password && (
                  <small className="text-xs font-medium text-rose-700 dark:text-rose-300">
                    {errors.password.message}
                  </small>
                )}
              </label>
            )}
            {isCustomerRegistration && (
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Email (optional)
                <input
                  type="email"
                  autoComplete="email"
                  className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                  {...register('email', {
                    pattern: {
                      value: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address',
                    },
                  })}
                />
                {errors.email && (
                  <small className="text-xs font-medium text-rose-700 dark:text-rose-300">
                    {errors.email.message}
                  </small>
                )}
              </label>
            )}
            {isTailorRegistration && (
              <>
                <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                  Email (optional)
                  <input
                    className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                  Specialties (optional)
                  <input
                    className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                    placeholder="Blouses, kurtas"
                    {...register('specialties')}
                  />
                </label>
              </>
            )}
            {isAdmin && (
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Password
                <input
                  type="password"
                  className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                  autoComplete="current-password"
                  {...register('password', { required: 'Password is required' })}
                />
                {errors.password && (
                  <small className="text-xs font-medium text-rose-700 dark:text-rose-300">
                    {errors.password.message}
                  </small>
                )}
              </label>
            )}
            {!isCustomer && !isAdmin && !isTailorRegistration && (
              <label className="grid gap-2 text-sm font-medium text-[var(--ink)]">
                Password
                <input
                  type="password"
                  className="min-h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--sage)] focus:ring-4 focus:ring-emerald-900/10"
                  autoComplete="current-password"
                  {...register('password', passwordRule)}
                />
                {errors.password && (
                  <small className="text-xs font-medium text-rose-700 dark:text-rose-300">
                    {errors.password.message}
                  </small>
                )}
              </label>
            )}
            <button
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-between rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-[#fffefa] shadow-sm transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:cursor-wait disabled:opacity-60 dark:text-slate-900"
            >
              {busy
                ? 'Please wait…'
                : isCustomerRegistration
                  ? 'Create customer account'
                  : isTailorRegistration
                    ? 'Submit for approval'
                    : 'Sign in'}{' '}
              <ArrowRight size={15} />
            </button>
          </form>
          {requestError && (
            <div
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
              role="alert"
            >
              {requestError}
            </div>
          )}
          <div className="mt-6 text-center text-sm leading-7 text-[var(--muted)] [&_a]:font-semibold [&_a]:text-[var(--sage)] [&_a]:underline-offset-4 hover:[&_a]:underline">
            {isCustomer ? (
              isCustomerRegistration ? (
                <>
                  Already registered? <Link to="/login">Customer sign in</Link>
                </>
              ) : (
                <>
                  New to the shop? <Link to="/register">Create a customer account</Link>
                  <br />
                  Shop staff? <Link to="/tailor/login">Staff sign in</Link>
                </>
              )
            ) : isTailorRegistration ? (
              <>
                Already approved? <Link to="/tailor/login">Staff sign in</Link>
              </>
            ) : isAdmin ? (
              <>
                Staff member? <Link to="/tailor/login">Staff sign in</Link>
              </>
            ) : (
              <>
                New staff member? <Link to="/tailor/register">Request access</Link>
              </>
            )}
          </div>
          {isCustomer && (
            <small className="mt-5 block text-center text-xs leading-5 text-[var(--muted)]">
              Existing shop customer accounts must be set up by the shop in person before password
              sign-in.
            </small>
          )}
        </div>
      </main>
    </div>
  );
}
