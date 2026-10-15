import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, Plus, Wallet } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { date, errorMessage, money, ROLES } from '../utils/constants.js';
import { Button, Loading, Metric, Modal, PageHeader, StatusBadge } from '../components/UI.jsx';
export default function Payments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState(true);
  const [modal, setModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { register, handleSubmit, reset } = useForm({ defaultValues: { method: 'CASH' } });
  async function load() {
    try {
      const [p, o] = await Promise.all([
        api.get('/payments', { params: { limit: 100 } }),
        api.get('/orders', { params: { limit: 100 } }),
      ]);
      setRows(p.data.data);
      setOrders(o.data.data);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const orderId = searchParams.get('order');
    const selectedOrder = orders.find((order) => order._id === orderId);
    if (!selectedOrder) return;
    if (selectedOrder.remainingAmount > 0) {
      reset({
        order: selectedOrder._id,
        amount: Number(selectedOrder.remainingAmount.toFixed(2)),
        method: 'CASH',
        reference: '',
        notes: '',
      });
      setModal(true);
    }
    setSearchParams({}, { replace: true });
  }, [orders, reset, searchParams, setSearchParams]);
  async function save(v) {
    try {
      await api.post('/payments', {
        order: v.order,
        amount: Number(v.amount),
        method: v.method,
        reference: v.reference,
        notes: v.notes,
      });
      toast('Payment recorded');
      setModal(false);
      reset({ method: 'CASH' });
      await load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }
  const amount = rows.reduce(
    (total, payment) => total + (payment.type === 'REFUND' ? -payment.amount : payment.amount),
    0,
  );
  return (
    <>
      <PageHeader
        eyebrow="THE NUMBERS, NICELY IN ORDER"
        title="Payments"
        subtitle="Deposits, balances and the day’s takings, accounted for."
      >
        {user.role === ROLES.ADMIN && (
          <Button onClick={() => setModal(true)} icon={Plus}>
            Record payment
          </Button>
        )}
      </PageHeader>
      <div className="metric-grid">
        <Metric
          icon={ArrowDownLeft}
          label="Net paid"
          value={money(amount)}
          note="Net of displayed receipts and refunds"
        />
        <Metric
          icon={Wallet}
          label="Transactions"
          value={rows.length}
          note="Payment and refund entries"
        />
        <Metric
          icon={Wallet}
          label="Open balances"
          value={orders.filter((o) => o.remainingAmount > 0).length}
          note="Orders with amount due"
        />
        <Metric
          icon={Wallet}
          label="Outstanding"
          value={money(orders.reduce((n, o) => n + o.remainingAmount, 0))}
          note="Across visible orders"
        />
      </div>
      {busy ? (
        <Loading />
      ) : (
        <section className="card payments-table">
          <div className="panel-title">
            <div>
              <h2>Payment history</h2>
              <p>Every payment and refund recorded.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>CUSTOMER</th>
                  <th>ORDER</th>
                  <th>METHOD</th>
                  <th>REFERENCE</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p._id}>
                    <td>{date(p.createdAt)}</td>
                    <td>{p.customer?.name}</td>
                    <td>{p.order?.orderNumber}</td>
                    <td>{p.method}</td>
                    <td>{p.reference || '—'}</td>
                    <td className={p.type === 'REFUND' ? 'refund-amount' : ''}>
                      {p.type === 'REFUND' ? '−' : ''}
                      {money(p.amount)}
                    </td>
                    <td>
                      <StatusBadge value={p.type === 'REFUND' ? 'REFUNDED' : 'PAID'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="empty-state">
                <b>No payments yet</b>
                <span>Recorded payments will appear here.</span>
              </div>
            )}
          </div>
        </section>
      )}
      {modal && (
        <Modal title="Record a payment" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit(save)}>
            <label className="field">
              Order
              <select required {...register('order', { required: true })}>
                <option value="">Choose an order…</option>
                {orders
                  .filter((o) => o.remainingAmount > 0 && o.status !== 'CANCELLED')
                  .map((o) => (
                    <option value={o._id} key={o._id}>
                      {o.orderNumber} · {o.customer?.name || 'Customer'} · due{' '}
                      {money(o.remainingAmount)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Amount (₹)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                {...register('amount', { required: true, min: 0.01, valueAsNumber: true })}
              />
              <small>The server rejects payments above the remaining order balance.</small>
            </label>
            <label className="field">
              Method
              <select {...register('method')}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="field">
              Reference
              <input {...register('reference')} />
            </label>
            <label className="field">
              Note
              <textarea rows="2" {...register('notes')} />
            </label>
            <p className="text-sm text-[var(--muted)]">
              Record a payment only after the shop has received it. This ledger does not transfer
              money; customers pay the shop separately by the agreed cash, UPI, or bank-transfer
              method.
            </p>
            <div className="actions">
              <Button type="submit">Save payment</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
