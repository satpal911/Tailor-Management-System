import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCheck,
  Clock3,
  Plus,
  Scissors,
  Shirt,
  Users,
  Wallet,
} from 'lucide-react';
import api from '../services/api.js';
import { money, date, errorMessage } from '../utils/constants.js';
import {
  Button,
  EmptyState,
  ErrorState,
  Metric,
  PageHeader,
  StatusBadge,
} from '../components/UI.jsx';

const monthLabel = (value) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(
    new Date(`${value}-01T00:00:00`),
  );
const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" role="status" aria-label="Loading business dashboard">
      <div className="skeleton-heading" />
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((key) => (
          <span className="skeleton-card" key={key} />
        ))}
      </div>
      <div className="skeleton-grid chart-skeleton">
        {[1, 2].map((key) => (
          <span className="skeleton-card" key={key} />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData((await api.get('/dashboard/summary')).data.data);
      setError('');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const months = useMemo(() => {
    const revenue = new Map((data?.monthly || []).map((item) => [item._id, item.revenue]));
    const orders = new Map((data?.monthlyOrders || []).map((item) => [item._id, item.orders]));
    return Array.from({ length: 6 }, (_, offset) => {
      const month = new Date();
      month.setDate(1);
      month.setMonth(month.getMonth() - (5 - offset));
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      return { month: key, revenue: revenue.get(key) || 0, orders: orders.get(key) || 0 };
    });
  }, [data]);

  if (busy) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} retry={load} />;

  const attention = [
    data.pendingTailorApprovals > 0 && {
      icon: Users,
      label: `${data.pendingTailorApprovals} tailor approval${data.pendingTailorApprovals === 1 ? '' : 's'} waiting`,
      to: '/app/team',
    },
    data.pendingPaymentOrders > 0 && {
      icon: Wallet,
      label: `${data.pendingPaymentOrders} order${data.pendingPaymentOrders === 1 ? '' : 's'} with balances`,
      to: '/app/payments',
    },
    data.pendingSalaryCount > 0 && {
      icon: Wallet,
      label: `${data.pendingSalaryCount} salary record${data.pendingSalaryCount === 1 ? '' : 's'} not fully paid`,
      to: '/app/payroll',
    },
  ].filter(Boolean);

  const metrics = [
    [Shirt, 'All orders', data.totalOrders ?? 0, 'Across every stage'],
    [Activity, 'In progress', data.activeOrders ?? 0, 'Moving through the workroom'],
    [Scissors, 'Available tailors', data.tailors ?? 0, 'Active team members'],
    [CalendarDays, 'Today’s fittings', data.todayAppointments ?? 0, 'Scheduled appointments'],
    [Wallet, 'Net collected', money(data.revenue), 'Payments less recorded refunds'],
    [
      Wallet,
      'Customer balances',
      money(data.pendingPayments),
      `${data.pendingPaymentOrders ?? 0} orders with an amount due`,
    ],
    [Users, 'Tailor approvals', data.pendingTailorApprovals ?? 0, 'Accounts awaiting review'],
    [
      CheckCheck,
      'Payroll outstanding',
      money(data.pendingSalaries),
      `${data.pendingSalaryCount ?? 0} salary records not fully paid`,
    ],
  ];

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat('en-IN', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
          .format(new Date())
          .toUpperCase()}
        title={`${greeting()}. Here’s your atelier.`}
        subtitle="A practical view of orders, collections, and the work ahead."
      >
        <Button to="/app/orders/new" icon={Plus}>
          Create order
        </Button>
      </PageHeader>

      <section className="metric-grid dashboard-metrics" aria-label="Shop summary">
        {metrics.map(([Icon, label, value, note]) => (
          <Metric key={label} icon={Icon} label={label} value={value} note={note} />
        ))}
      </section>

      <section
        className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-sm sm:p-6"
        aria-labelledby="attention-heading"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--sage)]">
            <Activity size={17} />
          </span>
          <div>
            <h2 className="font-semibold" id="attention-heading">
              Needs your attention
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Actionable items from your shop data.
            </p>
          </div>
        </div>
        {attention.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map(({ icon: Icon, label, to }) => (
              <Link
                className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--line)] px-3 text-sm font-medium text-[var(--ink)] no-underline transition hover:bg-[var(--surface-soft)]"
                key={to}
                to={to}
              >
                <Icon size={16} />
                <span>{label}</span>
                <ArrowRight className="ml-auto shrink-0 text-[var(--muted)]" size={14} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--sage)]">
            <CheckCheck size={15} /> Nothing urgent is waiting right now.
          </p>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
            <div>
              <h2 className="font-semibold">Collections</h2>
              <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
                Net payments received, less recorded refunds
              </p>
            </div>
          </div>
          <div className="h-[280px] min-w-0">
            {months.some((item) => item.revenue !== 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={months} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthLabel}
                    tick={{ fontSize: 10, fill: 'var(--chart-text)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    width={52}
                    tick={{ fontSize: 10, fill: 'var(--chart-text)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `₹${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    labelFormatter={monthLabel}
                    formatter={(value) => [money(value), 'Net collections']}
                    contentStyle={{
                      borderRadius: 10,
                      borderColor: 'var(--line)',
                      background: 'var(--paper)',
                      color: 'var(--ink)',
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={30}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: 'var(--ink)' }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Net collections"
                    fill="var(--sage)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={34}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No collection activity yet"
                text="Recorded payments and refunds will appear here."
              />
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
            <div>
              <h2 className="font-semibold">Orders created</h2>
              <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
                New work entering the atelier over six months
              </p>
            </div>
          </div>
          <div className="h-[280px] min-w-0">
            {months.some((item) => item.orders > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={months} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthLabel}
                    tick={{ fontSize: 10, fill: 'var(--chart-text)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={32}
                    tick={{ fontSize: 10, fill: 'var(--chart-text)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={monthLabel}
                    formatter={(value) => [value, 'Orders']}
                    contentStyle={{
                      borderRadius: 10,
                      borderColor: 'var(--line)',
                      background: 'var(--paper)',
                      color: 'var(--ink)',
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={30}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: 'var(--ink)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Orders"
                    stroke="var(--gold)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--gold)' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No orders created yet" text="New orders will shape this chart." />
            )}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="mb-3">
          <span className="text-[10px] font-bold tracking-[.16em] text-[var(--sage)]">
            SHORTCUTS
          </span>
          <h2 className="mt-1 text-lg font-semibold">Quick actions</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            className="group grid grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 text-[var(--ink)] no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            to="/app/orders/new"
          >
            <span className="row-span-2 grid size-10 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--sage)]">
              <Plus size={17} />
            </span>
            <b className="text-sm font-semibold">New order</b>
            <small className="text-xs text-[var(--muted)]">Start a garment request</small>
            <ArrowRight size={15} />
          </Link>
          <Link
            className="group grid grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 text-[var(--ink)] no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            to="/app/appointments"
          >
            <span className="row-span-2 grid size-10 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--sage)]">
              <CalendarDays size={17} />
            </span>
            <b className="text-sm font-semibold">Schedule fitting</b>
            <small className="text-xs text-[var(--muted)]">Open the appointment calendar</small>
            <ArrowRight size={15} />
          </Link>
          <Link
            className="group grid grid-cols-[40px_1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 text-[var(--ink)] no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            to="/app/customers"
          >
            <span className="row-span-2 grid size-10 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--sage)]">
              <Users size={17} />
            </span>
            <b className="text-sm font-semibold">Customer directory</b>
            <small className="text-xs text-[var(--muted)]">Find a customer profile</small>
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Recent orders</h2>
            <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
              The latest pieces in motion
            </p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sage)] no-underline hover:underline sm:text-sm"
            to="/app/orders"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {data.recentOrders?.length ? (
          <div className="max-w-full overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[650px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="bg-[var(--surface-soft)] px-3 py-3 text-[10px] font-bold tracking-wider text-[var(--muted)]">
                    ORDER
                  </th>
                  <th className="bg-[var(--surface-soft)] px-3 py-3 text-[10px] font-bold tracking-wider text-[var(--muted)]">
                    CUSTOMER
                  </th>
                  <th className="bg-[var(--surface-soft)] px-3 py-3 text-[10px] font-bold tracking-wider text-[var(--muted)]">
                    ITEM
                  </th>
                  <th className="bg-[var(--surface-soft)] px-3 py-3 text-[10px] font-bold tracking-wider text-[var(--muted)]">
                    DUE DATE
                  </th>
                  <th className="bg-[var(--surface-soft)] px-3 py-3 text-[10px] font-bold tracking-wider text-[var(--muted)]">
                    FINAL AMOUNT
                  </th>
                  <th className="bg-[var(--surface-soft)] px-3 py-3 text-[10px] font-bold tracking-wider text-[var(--muted)]">
                    STATUS
                  </th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order._id}>
                    <td className="border-t border-[var(--line)] px-3 py-3 text-[var(--ink)]">
                      <b className="order-number">#{order.orderNumber}</b>
                    </td>
                    <td className="border-t border-[var(--line)] px-3 py-3 text-[var(--ink)]">
                      {order.customer?.name || 'Customer'}
                    </td>
                    <td className="max-w-52 truncate border-t border-[var(--line)] px-3 py-3 text-[var(--muted)]">
                      {order.items?.map((item) => item.description).join(', ') || 'Custom garment'}
                    </td>
                    <td className="border-t border-[var(--line)] px-3 py-3 text-[var(--muted)]">
                      {date(order.dueDate)}
                    </td>
                    <td className="border-t border-[var(--line)] px-3 py-3 font-medium text-[var(--ink)]">
                      {money(order.finalAmount)}
                    </td>
                    <td className="border-t border-[var(--line)] px-3 py-3">
                      <StatusBadge value={order.status} />
                    </td>
                    <td className="border-t border-[var(--line)] px-3 py-3">
                      <Link
                        to={`/app/orders/${order._id}`}
                        className="inline-grid size-8 place-items-center rounded-lg text-[var(--sage)] hover:bg-[var(--surface-soft)]"
                        aria-label={`Open order ${order.orderNumber}`}
                      >
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-empty">
            <EmptyState
              title="No orders yet"
              text="Create the first order to start your work queue."
              action={<Button to="/app/orders/new">Create order</Button>}
            />
          </div>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Recent payments</h2>
            <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
              Collections and refunds from the payment ledger
            </p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sage)] no-underline hover:underline sm:text-sm"
            to="/app/payments"
          >
            Payment ledger <ArrowRight size={14} />
          </Link>
        </div>
        {data.recentPayments?.length ? (
          <div className="max-w-full overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[540px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th>CUSTOMER</th>
                  <th>ORDER</th>
                  <th>DATE</th>
                  <th>METHOD</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayments.map((payment) => (
                  <tr key={payment._id}>
                    <td>{payment.customer?.name || '—'}</td>
                    <td>{payment.order?.orderNumber || '—'}</td>
                    <td>{date(payment.createdAt)}</td>
                    <td>{payment.method}</td>
                    <td>
                      <b className={payment.type === 'REFUND' ? 'refund-amount' : ''}>
                        {payment.type === 'REFUND' ? '−' : ''}
                        {money(payment.amount)}
                      </b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-empty">
            <EmptyState
              title="No payments recorded"
              text="Shop-entered payments and refunds will appear here."
            />
          </div>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Recent activity</h2>
            <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
              Updates delivered to the owner account
            </p>
          </div>
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sage)] no-underline hover:underline sm:text-sm"
            to="/app/notifications"
          >
            Notification center <ArrowRight size={14} />
          </Link>
        </div>
        {data.recentNotifications?.length ? (
          <div className="dashboard-notification-list">
            {data.recentNotifications.map((notification) => (
              <div
                className="flex items-center gap-3 border-b border-[var(--line)] py-3 text-[var(--sage)]"
                key={notification._id}
              >
                <Bell className="shrink-0" size={16} />
                <span className="min-w-0">
                  <b className="block text-sm font-medium text-[var(--ink)]">
                    {notification.title}
                  </b>
                  <small className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                    {notification.message} · {date(notification.createdAt)}
                  </small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty">
            <EmptyState
              title="No recent activity"
              text="Important shop notifications will appear here."
            />
          </div>
        )}
      </section>
    </>
  );
}
