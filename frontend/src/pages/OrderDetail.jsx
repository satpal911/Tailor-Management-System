import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ImagePlus,
  Scissors,
  Send,
  Shirt,
  UserRound,
  Wallet,
} from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { date, errorMessage, money, ORDER_STATUSES, ROLES } from '../utils/constants.js';
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
} from '../components/UI.jsx';

const nextStatuses = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['CUTTING', 'CANCELLED'],
  CUTTING: ['STITCHING', 'CANCELLED'],
  STITCHING: ['QUALITY_CHECK', 'CANCELLED'],
  QUALITY_CHECK: ['STITCHING', 'READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};
const lifecycle = ORDER_STATUSES.filter((status) => status !== 'CANCELLED');
const label = (value = '') =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState(null);
  const [tailors, setTailors] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [cancelConfirmation, setCancelConfirmation] = useState(false);
  const [internalNote, setInternalNote] = useState(false);
  const customerView = user.role === ROLES.CUSTOMER;

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/orders/${id}`);
      setOrder(response.data.data);
      setError('');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    setBusy(true);
    load();
    const onUpdate = (event) => {
      if (event.detail?.id === id) load();
    };
    const onNoteAdded = (event) => {
      if (event.detail?.id === id) load();
    };
    window.addEventListener('order-status-updated', onUpdate);
    window.addEventListener('order-note-added', onNoteAdded);
    return () => {
      window.removeEventListener('order-status-updated', onUpdate);
      window.removeEventListener('order-note-added', onNoteAdded);
    };
  }, [id, load]);

  useEffect(() => {
    if (user.role !== ROLES.ADMIN) return;
    api
      .get('/tailors')
      .then(({ data }) =>
        setTailors((data.data || []).filter((tailor) => tailor.status === 'ACTIVE')),
      )
      .catch((reason) => toast(errorMessage(reason), 'error'));
  }, [user.role, toast]);

  const history = useMemo(() => order?.statusHistory || [], [order]);
  async function updateStatus(status) {
    setActionBusy('status');
    try {
      await api.patch(`/orders/${id}/status`, { status });
      toast(`Order moved to ${label(status).toLowerCase()}`);
      await load();
    } catch (reason) {
      toast(errorMessage(reason), 'error');
    } finally {
      setActionBusy('');
    }
  }
  function requestStatusChange(status) {
    if (status === 'CANCELLED') setCancelConfirmation(true);
    else updateStatus(status);
  }
  async function assignTailor(event) {
    const tailor = event.target.value;
    if (!tailor) return;
    setActionBusy('tailor');
    try {
      await api.patch(`/orders/${id}/assign`, { tailor });
      toast('Tailor assignment saved');
      await load();
    } catch (reason) {
      toast(errorMessage(reason), 'error');
    } finally {
      setActionBusy('');
    }
  }
  async function addNote(event) {
    event.preventDefault();
    if (!note.trim() || actionBusy) return;
    setActionBusy('note');
    try {
      await api.post(`/orders/${id}/notes`, {
        text: note.trim(),
        internal: !customerView && internalNote,
      });
      setNote('');
      setInternalNote(false);
      toast('Note added');
      await load();
    } catch (reason) {
      toast(errorMessage(reason), 'error');
    } finally {
      setActionBusy('');
    }
  }

  if (busy) return <Loading label="Loading order details" />;
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => {
          setBusy(true);
          load();
        }}
      />
    );
  if (!order)
    return (
      <EmptyState
        title="Order not found"
        text="This order may have been moved or is not available to your account."
        action={
          <Button
            variant="outline"
            to={
              user.role === ROLES.TAILOR
                ? '/app/assigned'
                : customerView
                  ? '/app/my-orders'
                  : '/app/orders'
            }
            icon={ArrowLeft}
          >
            Back to orders
          </Button>
        }
      />
    );

  const backPath =
    user.role === ROLES.TAILOR ? '/app/assigned' : customerView ? '/app/my-orders' : '/app/orders';
  const statusIndex = lifecycle.indexOf(order.status);
  const statusEntry = [...history].reverse().find((entry) => entry.status === order.status);
  const items = order.items || [];
  const notes = (order.notes || []).filter((entry) => !customerView || !entry.internal);
  const measurements = order.measurement;
  const availableNext = nextStatuses[order.status] || [];

  return (
    <>
      <PageHeader
        eyebrow="ORDER DETAILS"
        title={`Order ${order.orderNumber || ''}`}
        subtitle={
          customerView
            ? 'Your garment, its progress, and the details behind it.'
            : `${order.customer?.name || 'Customer'} · ${items.map((item) => item.description).join(' · ') || 'Custom garment'}`
        }
      >
        <Button variant="outline" to={backPath} icon={ArrowLeft}>
          Back to orders
        </Button>
      </PageHeader>

      <div className="tracking-grid">
        <section className="card tracking-overview">
          <div className="tracking-overview-copy">
            <span className="eyebrow">MADE JUST FOR YOU</span>
            <h2>
              {items
                .map((item) => item.description)
                .filter(Boolean)
                .join(' · ') || 'Custom garment'}
            </h2>
            <p>
              {items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} piece
              {items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) === 1
                ? ''
                : 's'}{' '}
              · Ordered {date(order.createdAt)}
            </p>
          </div>
          <div className="tracking-dates">
            <div>
              <CalendarDays size={17} />
              <span>
                <small>EXPECTED DELIVERY</small>
                <b>{date(order.dueDate)}</b>
              </span>
            </div>
            <div>
              <Clock3 size={17} />
              <span>
                <small>LAST UPDATE</small>
                <b>{date(statusEntry?.createdAt || order.updatedAt)}</b>
              </span>
            </div>
          </div>
        </section>

        <section
          className={`card tracking-progress ${order.status === 'CANCELLED' ? 'is-cancelled' : ''}`}
          aria-labelledby="tracking-title"
        >
          <div className="tracking-current">
            <div className="tracking-current-icon">
              {order.status === 'CANCELLED' ? (
                <AlertTriangle size={19} />
              ) : order.status === 'COMPLETED' ? (
                <Check size={20} />
              ) : (
                <Scissors size={19} />
              )}
            </div>
            <div>
              <span className="eyebrow">CURRENT STATUS</span>
              <h2 id="tracking-title">{label(order.status)}</h2>
              <p>
                {order.status === 'CANCELLED'
                  ? 'This order has been cancelled. Future stages have not been completed.'
                  : order.status === 'COMPLETED'
                    ? 'Your order is complete. Thank you for choosing the atelier.'
                    : `Your piece is at the ${label(order.status).toLowerCase()} stage.`}
              </p>
            </div>
            <StatusBadge value={order.status} />
          </div>
          {order.status === 'CANCELLED' && (
            <div className="cancelled-notice">
              <AlertTriangle size={15} /> Cancelled orders do not continue through the production
              stages.
            </div>
          )}
          <ol className="tracking-timeline" aria-label="Order progress">
            {lifecycle.map((status, index) => {
              const inHistory = history.some((entry) => entry.status === status);
              const isCurrent = order.status === status;
              const isComplete =
                order.status !== 'CANCELLED' &&
                !isCurrent &&
                (inHistory || (statusIndex >= 0 && index < statusIndex));
              const state = isCurrent ? 'current' : isComplete ? 'complete' : 'upcoming';
              const entry = [...history].reverse().find((candidate) => candidate.status === status);
              return (
                <li
                  className={`tracking-step ${state}`}
                  key={status}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="tracking-step-marker">
                    {isComplete ? <Check size={13} /> : index + 1}
                  </span>
                  <span className="tracking-step-copy">
                    <b>{label(status)}</b>
                    {entry?.createdAt && <time>{date(entry.createdAt)}</time>}
                    {isCurrent && !entry?.createdAt && <small>In progress now</small>}
                  </span>
                </li>
              );
            })}
          </ol>
          {!customerView && (
            <div className="tracking-controls">
              <label className="field">
                Update order status
                <select
                  disabled={!availableNext.length || actionBusy === 'status'}
                  value=""
                  onChange={(event) =>
                    event.target.value && requestStatusChange(event.target.value)
                  }
                >
                  <option value="">
                    {actionBusy === 'status'
                      ? 'Saving status…'
                      : availableNext.length
                        ? 'Choose next status…'
                        : 'No further status changes'}
                  </option>
                  {availableNext.map((status) => (
                    <option value={status} key={status}>
                      {label(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>

        <section className="card tracking-payment detail-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PAYMENT SUMMARY</span>
              <h2>Order balance</h2>
              <p>Amounts shown in INR</p>
            </div>
            <Wallet size={18} />
          </div>
          <div className="side-summary">
            <div>
              <span>Subtotal</span>
              <b>{money(order.totalAmount)}</b>
            </div>
            <div>
              <span>Discount</span>
              <b>−{money(order.discount)}</b>
            </div>
            <div>
              <span>Tax</span>
              <b>{money(order.tax)}</b>
            </div>
            <div className="tracking-final">
              <span>Final amount</span>
              <b>{money(order.finalAmount)}</b>
            </div>
            <div>
              <span>Paid</span>
              <b>{money(order.paidAmount)}</b>
            </div>
            <div className="balance">
              <span>Remaining balance</span>
              <b>{money(order.remainingAmount)}</b>
            </div>
            <div className="tracking-payment-status">
              <span>Payment status</span>
              <StatusBadge value={order.paymentStatus} />
            </div>
            {customerView && order.remainingAmount > 0 && order.status !== 'CANCELLED' && (
              <p className="rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-sm leading-6 text-[var(--muted)]">
                To pay this balance, pay the shop directly using the agreed cash, UPI, or bank
                transfer method. Ask the shop to record the confirmed payment; this app does not
                process online payments.
              </p>
            )}
            {user.role === ROLES.ADMIN &&
              order.remainingAmount > 0 &&
              order.status !== 'CANCELLED' && (
                <Link to={`/app/payments?order=${order._id}`} className="button button-primary">
                  <Wallet size={15} /> Record received payment
                </Link>
              )}
            {customerView && (
              <Link to="/app/payments" className="button button-outline payment-history-button">
                <Wallet size={15} /> View payment history
              </Link>
            )}
          </div>
        </section>

        <section className="card tracking-items detail-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE PIECES</span>
              <h2>Garment details</h2>
              <p>Services and quantities on this order.</p>
            </div>
            <Shirt size={18} />
          </div>
          {items.length ? (
            <div className="item-lines">
              {items.map((item, index) => (
                <div key={`${item.description}-${index}`}>
                  <span>
                    <b>{item.description || 'Custom garment'}</b>
                    <small>
                      {item.quantity} × {money(item.unitPrice)}
                    </small>
                  </span>
                  <strong>
                    {money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">No garment items were returned for this order.</p>
          )}
        </section>

        <section className="card tracking-images detail-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">VISUAL REFERENCES</span>
              <h2>Design references</h2>
              <p>Images shared for this piece.</p>
            </div>
            <ImagePlus size={18} />
          </div>
          {order.designImages?.length ? (
            <div className="tracking-image-grid">
              {order.designImages.map(
                (image, index) =>
                  image.url && (
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      key={image.publicId || image.url}
                    >
                      <img
                        src={image.url}
                        alt={`Design reference ${index + 1} for order ${order.orderNumber}`}
                        loading="lazy"
                      />
                      <span>
                        View image <ArrowRight size={12} />
                      </span>
                    </a>
                  ),
              )}
            </div>
          ) : (
            <div className="empty-inline">
              <ImagePlus size={17} /> No design images were attached to this order.
            </div>
          )}
        </section>

        {user.role === ROLES.ADMIN && (
          <section className="card tracking-team detail-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">WORKROOM</span>
                <h2>Assigned tailor</h2>
                <p>Team member responsible for this piece.</p>
              </div>
              <UserRound size={18} />
            </div>
            {order.tailor?.user ? (
              <div className="assigned-person">
                <span>
                  {order.tailor.user.name
                    ?.split(' ')
                    .map((part) => part[0])
                    .join('') || '?'}
                </span>
                <b>
                  {order.tailor.user.name}
                  <small>{order.tailor.specialties?.join(' · ') || 'Tailor'}</small>
                </b>
              </div>
            ) : (
              <p className="muted-copy">No tailor is assigned yet.</p>
            )}
            {['CONFIRMED', 'ASSIGNED'].includes(order.status) && (
              <label className="field">
                Assign or reassign
                <select
                  disabled={actionBusy === 'tailor'}
                  value={order.tailor?._id || ''}
                  onChange={assignTailor}
                >
                  <option value="">
                    {actionBusy === 'tailor' ? 'Saving assignment…' : 'Choose an active tailor'}
                  </option>
                  {tailors.map((tailor) => (
                    <option key={tailor._id} value={tailor._id}>
                      {tailor.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>
        )}

        <section className="card tracking-measurements detail-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIT PROFILE</span>
              <h2>Measurements</h2>
              <p>Measurement record linked to this order.</p>
            </div>
            <Scissors size={18} />
          </div>
          {measurements ? (
            <>
              <div className="measurement-linked">
                <Scissors size={16} />
                <span>
                  <b>{measurements.name || 'Saved measurement'}</b>
                  <small>
                    {measurements.garmentType || 'Garment'} · {measurements.unit || 'cm'}
                  </small>
                </span>
              </div>
              <div className="order-measure-values">
                {Object.entries(measurements.values || {}).map(([key, value]) => (
                  <span key={key}>
                    {label(key)}
                    <b>
                      {value} {measurements.unit || ''}
                    </b>
                  </span>
                ))}
                {measurements.customMeasurements?.map((item) => (
                  <span key={item.name}>
                    {item.name}
                    <b>
                      {item.value} {measurements.unit || ''}
                    </b>
                  </span>
                ))}
              </div>
              {measurements.notes && <p className="measurement-note">{measurements.notes}</p>}
            </>
          ) : (
            <p className="muted-copy">No measurement profile is linked to this order.</p>
          )}
        </section>

        <section className="card tracking-appointments detail-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FITTINGS & VISITS</span>
              <h2>Appointments</h2>
              <p>Visits connected to this order.</p>
            </div>
            <CalendarDays size={18} />
          </div>
          {order.appointments?.length ? (
            order.appointments.map((appointment) => (
              <div className="measurement-linked" key={appointment._id}>
                <CalendarDays size={16} />
                <span>
                  <b>{appointment.title}</b>
                  <small>
                    {date(appointment.scheduledAt)} · {label(appointment.status)}
                  </small>
                </span>
              </div>
            ))
          ) : (
            <p className="muted-copy">No appointment is linked to this order.</p>
          )}
        </section>

        <section className="card tracking-history detail-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LEDGER</span>
              <h2>Payment history</h2>
              <p>Collections and refunds recorded for this order.</p>
            </div>
            <Wallet size={18} />
          </div>
          {order.paymentHistory?.length ? (
            order.paymentHistory.map((payment) => (
              <div className="measurement-linked" key={payment._id}>
                <span
                  className={`payment-history-icon ${payment.type === 'REFUND' ? 'is-refund' : ''}`}
                >
                  {payment.type === 'REFUND' ? '−' : '+'}
                </span>
                <span>
                  <b>
                    {payment.type === 'REFUND' ? 'Refund' : label(payment.method)} ·{' '}
                    {money(payment.amount)}
                  </b>
                  <small>
                    {date(payment.createdAt)}
                    {payment.reference ? ` · ${payment.reference}` : ''}
                  </small>
                </span>
              </div>
            ))
          ) : (
            <p className="muted-copy">No payments recorded yet.</p>
          )}
        </section>

        <section className="card tracking-notes detail-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ATELIER UPDATES</span>
              <h2>Notes &amp; messages</h2>
              <p>
                {customerView
                  ? 'Updates shared with you about this order.'
                  : 'Keep the customer and workroom in sync.'}
              </p>
            </div>
          </div>
          {notes.length ? (
            <div className="notes-list">
              {notes.map((entry) => (
                <article key={entry._id}>
                  <span className="note-avatar">
                    <UserRound size={14} />
                  </span>
                  <span>
                    <b>
                      {entry.author?.name || 'Shop team'}
                      {entry.internal && !customerView && <small> · Team note</small>}
                    </b>
                    <p>{entry.text}</p>
                    <time>{date(entry.createdAt)}</time>
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted-copy">No messages have been added yet.</p>
          )}
          <form className="note-form" onSubmit={addNote}>
            <input
              aria-label="Order note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                customerView ? 'Send a message to the atelier…' : 'Add a note or update…'
              }
              maxLength="2000"
            />
            <button
              className="button button-primary"
              aria-label="Send note"
              disabled={actionBusy === 'note' || !note.trim()}
            >
              {actionBusy === 'note' ? (
                'Sending…'
              ) : (
                <>
                  <Send size={14} />
                  <span>Send</span>
                </>
              )}
            </button>
          </form>
          {!customerView && (
            <label className="internal-note-toggle">
              <input
                type="checkbox"
                checked={internalNote}
                onChange={(event) => setInternalNote(event.target.checked)}
              />
              Keep this message private to the team
            </label>
          )}
        </section>
      </div>
      {cancelConfirmation && (
        <Modal title="Cancel this order?" onClose={() => setCancelConfirmation(false)}>
          <div className="confirm-content">
            <p>
              Cancel order <b>{order.orderNumber}</b>? The order will stop moving through production
              stages, and the customer will see its cancelled status.
            </p>
            <div className="actions">
              <Button variant="outline" onClick={() => setCancelConfirmation(false)}>
                Keep order
              </Button>
              <Button
                onClick={async () => {
                  setCancelConfirmation(false);
                  await updateStatus('CANCELLED');
                }}
              >
                Confirm cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
