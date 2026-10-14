import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Shirt, Wallet } from 'lucide-react';
import api from '../services/api.js';
import { date, errorMessage, money } from '../utils/constants.js';
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Metric,
  PageHeader,
  StatusBadge,
} from '../components/UI.jsx';

function useRoleDashboard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setBusy(true);
    try {
      setData((await api.get('/dashboard/summary')).data.data);
      setError('');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('order-status-updated', refresh);
    return () => window.removeEventListener('order-status-updated', refresh);
  }, []);
  return { data, busy, error, load };
}

function dueLabel(value) {
  if (!value) return 'No due date';
  const target = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${date(value)}`;
}

export function TailorDashboard() {
  const { data, busy, error, load } = useRoleDashboard();
  if (busy) return <Loading label="Loading your work queue" />;
  if (error) return <ErrorState message={error} retry={load} />;
  const orders = data?.recentOrders || [];
  const today = new Date().toDateString();
  const todayOrders = orders.filter(
    (order) => order.dueDate && new Date(order.dueDate).toDateString() === today,
  );
  const overdue = orders.filter(
    (order) =>
      order.dueDate &&
      new Date(order.dueDate).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime(),
  );
  return (
    <>
      <PageHeader
        eyebrow="YOUR DAILY WORKROOM"
        title="Your work, at a glance."
        subtitle="Keep today’s priorities and deadlines close."
      >
        <Button to="/app/assigned" icon={Shirt}>
          All assigned orders
        </Button>
      </PageHeader>
      <div className="metric-grid">
        <Metric
          icon={Shirt}
          label="Active assignments"
          value={data?.assignedOrders || 0}
          note="Currently in your work queue"
        />
        <Metric
          icon={Clock3}
          label="Due today"
          value={data?.todayWork ?? todayOrders.length}
          note="Pieces to keep moving today"
        />
        <Metric
          icon={Clock3}
          label="Past deadline"
          value={overdue.length}
          note="Check in on these orders"
        />
        <Metric
          icon={CheckCircle2}
          label="Completed work"
          value={data?.completedOrders || 0}
          note="Delivered or completed pieces"
        />
        <Metric
          icon={Wallet}
          label="Current salary"
          value={data?.currentSalary ? money(data.currentSalary.netSalary) : '—'}
          note={data?.currentSalary?.paymentStatus || 'No current month record'}
        />
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <header className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <span>
            <b className="block text-sm font-semibold">Today’s work</b>
            <small className="mt-1 block text-xs text-[var(--muted)]">
              {todayOrders.length ? 'Orders with a deadline today.' : 'No orders are due today.'}
            </small>
          </span>
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sage)] no-underline hover:underline"
            to="/app/assigned"
          >
            Open work queue <ArrowRight size={14} />
          </Link>
        </header>
        {todayOrders.length ? (
          <div className="grid gap-2">
            {todayOrders.map((order) => (
              <Link
                className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-[var(--ink)] no-underline transition hover:bg-[var(--surface-soft)]"
                key={order._id}
                to={`/app/assigned/${order._id}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--sage)]">
                  <Shirt size={17} />
                </span>
                <span className="today-work-copy min-w-0 flex-1">
                  <b className="block truncate text-sm font-medium">
                    #{order.orderNumber} ·{' '}
                    {order.items?.map((item) => item.description).join(', ') || 'Garment order'}
                  </b>
                  <small className="mt-1 block truncate text-xs text-[var(--muted)]">
                    {order.customer?.name || 'Customer'} · {dueLabel(order.dueDate)}
                  </small>
                </span>
                <StatusBadge value={order.status} />
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Clear for today" text="Your upcoming assignments are listed below." />
        )}
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <header className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <span>
            <b className="block text-sm font-semibold">Assigned orders</b>
            <small className="mt-1 block text-xs text-[var(--muted)]">
              Orders are listed by their due date.
            </small>
          </span>
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sage)] no-underline hover:underline"
            to="/app/assigned"
          >
            View all <ArrowRight size={14} />
          </Link>
        </header>
        {orders.length ? (
          <div className="max-w-full overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>CUSTOMER</th>
                  <th>ITEM</th>
                  <th>DEADLINE</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>{order.orderNumber}</td>
                    <td>{order.customer?.name || '—'}</td>
                    <td>
                      {order.items?.map((item) => item.description).join(', ') || 'Garment order'}
                    </td>
                    <td>
                      <span
                        className={
                          dueLabel(order.dueDate).includes('overdue') ? 'deadline-overdue' : ''
                        }
                      >
                        {dueLabel(order.dueDate)}
                      </span>
                      <small className="date-secondary">{date(order.dueDate)}</small>
                    </td>
                    <td>
                      <StatusBadge value={order.status} />
                    </td>
                    <td>
                      <Link
                        className="icon-link"
                        to={`/app/assigned/${order._id}`}
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
          <EmptyState title="No assignments yet" text="Newly assigned orders will appear here." />
        )}
      </section>
    </>
  );
}

export function CustomerDashboard() {
  const { data, busy, error, load } = useRoleDashboard();
  if (busy) return <Loading label="Loading your atelier updates" />;
  if (error) return <ErrorState message={error} retry={load} />;
  const orders = data?.recentOrders || [];
  const balance =
    data?.balanceDue ?? orders.reduce((total, order) => total + (order.remainingAmount || 0), 0);
  return (
    <>
      <PageHeader
        eyebrow="WELCOME TO YOUR ATELIER"
        title="Your pieces, in good hands."
        subtitle="Follow each order from first fitting to final pickup."
      >
        <Button to="/app/my-orders/new" icon={Shirt}>
          Request an order
        </Button>
      </PageHeader>
      <div className="metric-grid">
        <Metric
          icon={Shirt}
          label="Orders with us"
          value={data?.totalOrders || 0}
          note="Across your atelier history"
        />
        <Metric
          icon={Clock3}
          label="In progress"
          value={
            data?.activeOrders ??
            orders.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)).length
          }
          note="Being made just for you"
        />
        <Metric
          icon={Wallet}
          label="Balance due"
          value={money(balance)}
          note="Across all your orders"
        />
        <Metric
          icon={Clock3}
          label="Next due date"
          value={orders[0] ? date(orders[0].dueDate) : '—'}
          note="We’ll keep you posted"
        />
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <header className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <span>
            <b className="block text-sm font-semibold">Your recent orders</b>
            <small className="mt-1 block text-xs text-[var(--muted)]">
              Updates from the atelier, as they happen.
            </small>
          </span>
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sage)] no-underline hover:underline"
            to="/app/my-orders"
          >
            View all orders <ArrowRight size={14} />
          </Link>
        </header>
        {orders.length ? (
          <div className="max-w-full overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[650px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>ITEM</th>
                  <th>DUE DATE</th>
                  <th>TOTAL</th>
                  <th>PAYMENT</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>{order.orderNumber}</td>
                    <td>
                      {order.items?.map((item) => item.description).join(', ') || 'Garment order'}
                    </td>
                    <td>{date(order.dueDate)}</td>
                    <td>{money(order.finalAmount)}</td>
                    <td>
                      <StatusBadge value={order.paymentStatus} />
                    </td>
                    <td>
                      <StatusBadge value={order.status} />
                    </td>
                    <td>
                      <Link
                        className="icon-link"
                        to={`/app/my-orders/${order._id}`}
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
          <EmptyState
            title="No orders just yet"
            text="When you request a piece, it will show up here."
            action={<Button to="/app/my-orders/new">Create an order</Button>}
          />
        )}
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <header className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <span>
            <b className="block text-sm font-semibold">Upcoming appointments</b>
            <small className="mt-1 block text-xs text-[var(--muted)]">
              Your fitting and pickup schedule.
            </small>
          </span>
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sage)] no-underline hover:underline"
            to="/app/appointments"
          >
            All appointments <ArrowRight size={14} />
          </Link>
        </header>
        {data?.upcomingAppointments?.length ? (
          data.upcomingAppointments.map((appointment) => (
            <div
              className="flex items-center gap-3 border-b border-[var(--line)] py-3 text-[var(--sage)]"
              key={appointment._id}
            >
              <Clock3 className="shrink-0" size={16} />
              <span className="min-w-0">
                <b className="block text-sm font-medium text-[var(--ink)]">{appointment.title}</b>
                <small className="mt-1 block text-xs text-[var(--muted)]">
                  {date(appointment.scheduledAt)}
                  {appointment.order?.orderNumber ? ` · ${appointment.order.orderNumber}` : ''}
                </small>
              </span>
            </div>
          ))
        ) : (
          <EmptyState
            title="No upcoming appointments"
            text="The atelier will add fitting times to your account."
          />
        )}
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-sm sm:p-5">
        <header className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <span>
            <b className="block text-sm font-semibold">Recent payments</b>
            <small className="mt-1 block text-xs text-[var(--muted)]">
              Your payment history for orders with the atelier.
            </small>
          </span>
          <Link
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--sage)] no-underline hover:underline"
            to="/app/payments"
          >
            View payments <ArrowRight size={14} />
          </Link>
        </header>
        {data?.recentPayments?.length ? (
          data.recentPayments.map((payment) => (
            <div
              className="flex items-center gap-3 border-b border-[var(--line)] py-3 text-[var(--sage)]"
              key={payment._id}
            >
              <Wallet className="shrink-0" size={16} />
              <span className="min-w-0">
                <b className="block text-sm font-medium text-[var(--ink)]">
                  {payment.type === 'REFUND' ? 'Refund' : payment.method} · {money(payment.amount)}
                </b>
                <small className="mt-1 block text-xs text-[var(--muted)]">
                  {date(payment.createdAt)}
                  {payment.order?.orderNumber ? ` · ${payment.order.orderNumber}` : ''}
                </small>
              </span>
            </div>
          ))
        ) : (
          <EmptyState title="No payments recorded" text="Your payment history will appear here." />
        )}
      </section>
      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-5 sm:p-6">
        <div>
          <span className="text-[10px] font-bold tracking-[.16em] text-[var(--sage)]">
            YOUR ATELIER PROFILE
          </span>
          <b className="mt-1 block font-semibold">Keep your fit details ready</b>
          <small className="mt-1 block text-sm text-[var(--muted)]">
            Save measurements to make future requests simpler.
          </small>
        </div>
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-[#fffefa] no-underline hover:brightness-110 dark:text-slate-900"
          to="/app/measurements"
        >
          Manage measurements <ArrowRight size={15} />
        </Link>
      </section>
    </>
  );
}
