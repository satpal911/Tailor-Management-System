import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CalendarDays, Clock3, Plus } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../utils/constants.js';
import { Button, Loading, Modal, PageHeader, StatusBadge } from '../components/UI.jsx';
import { ROLES } from '../utils/constants.js';

export default function Appointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [busy, setBusy] = useState(true);
  const [modal, setModal] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  async function load() {
    try {
      const response = await api.get('/appointments');
      setRows(response.data.data || []);
      if (user.role === ROLES.ADMIN) {
        const [customerResponse, tailorResponse] = await Promise.all([
          api.get('/customers', { params: { limit: 100 } }),
          api.get('/tailors'),
        ]);
        setCustomers((customerResponse.data.data || []).filter((customer) => customer.isActive));
        setTailors(
          (tailorResponse.data.data || []).filter(
            (tailor) =>
              tailor.status === 'ACTIVE' &&
              tailor.isAvailable &&
              tailor.user?.isActive &&
              tailor.user?.accountStatus === 'ACTIVE',
          ),
        );
      }
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
    window.addEventListener('appointments:refresh', load);
    return () => window.removeEventListener('appointments:refresh', load);
  }, []);

  async function save(values) {
    try {
      await api.post('/appointments', {
        ...values,
        durationMinutes: Number(values.durationMinutes || 30),
      });
      toast(user.role === ROLES.CUSTOMER ? 'Appointment request sent' : 'Appointment scheduled');
      setModal(false);
      reset();
      await load();
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  }
  async function update(appointment, status) {
    try {
      const tailor = user.role === ROLES.ADMIN ? assignments[appointment._id] : undefined;
      await api.patch(`/appointments/${appointment._id}`, {
        status,
        ...(tailor ? { tailor } : {}),
      });
      toast(status === 'SCHEDULED' ? 'Appointment approved' : 'Appointment updated');
      await load();
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  }

  const admin = user.role === ROLES.ADMIN;
  const customer = user.role === ROLES.CUSTOMER;
  const pending = rows.filter((appointment) => appointment.status === 'PENDING').length;
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE ROOM IN THE DAY"
        title="Appointments"
        subtitle={
          customer
            ? 'Request an appointment and wait for confirmation from the shop.'
            : 'Review customer requests, assign a tailor, and manage your schedule.'
        }
      >
        {(admin || customer) && (
          <Button onClick={() => setModal(true)} icon={Plus}>
            {customer ? 'Request appointment' : 'Create appointment'}
          </Button>
        )}
      </PageHeader>
      <div className="appointments-summary">
        <CalendarDays size={17} />
        <span>{customer ? 'Your appointments' : 'Appointment schedule'}</span>
        {pending > 0 && <small>{pending} pending approval</small>}
        <small>
          {rows.filter((appointment) => appointment.status === 'SCHEDULED').length} approved
        </small>
      </div>
      {busy ? (
        <Loading />
      ) : (
        <div className="appointment-list">
          {rows.map((appointment) => (
            <article className="card appointment-card" key={appointment._id}>
              <div className="appointment-date">
                <b>
                  {new Date(appointment.scheduledAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                  })}
                </b>
                <small>
                  {new Date(appointment.scheduledAt).toLocaleDateString('en-IN', {
                    month: 'short',
                  })}
                </small>
              </div>
              <div className="appointment-info">
                <b>{appointment.title}</b>
                <small>
                  {appointment.customer?.name} ·{' '}
                  {appointment.type.replaceAll('_', ' ').toLowerCase()}
                </small>
                <span>
                  <Clock3 size={13} />{' '}
                  {new Date(appointment.scheduledAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · {appointment.durationMinutes} min
                  {appointment.tailor?.user?.name ? ` · ${appointment.tailor.user.name}` : ''}
                </span>
              </div>
              <StatusBadge value={appointment.status} />
              {appointment.status === 'PENDING' && !customer && (
                <div className="appointment-actions">
                  {admin && (
                    <select
                      aria-label={`Assign tailor for ${appointment.title}`}
                      value={assignments[appointment._id] || ''}
                      onChange={(event) =>
                        setAssignments((current) => ({
                          ...current,
                          [appointment._id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose tailor…</option>
                      {tailors.map((tailor) => (
                        <option key={tailor._id} value={tailor._id}>
                          {tailor.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    disabled={admin && !assignments[appointment._id]}
                    onClick={() => update(appointment, 'SCHEDULED')}
                  >
                    Approve
                  </Button>
                  <Button variant="outline" onClick={() => update(appointment, 'REJECTED')}>
                    Not approve
                  </Button>
                </div>
              )}
              {appointment.status === 'SCHEDULED' && !customer && (
                <Button variant="outline" onClick={() => update(appointment, 'COMPLETED')}>
                  Mark complete
                </Button>
              )}
            </article>
          ))}
          {!rows.length && (
            <div className="card empty-state">
              <b>No appointments yet</b>
              <span>
                {customer
                  ? 'Send an appointment request and the shop will confirm it.'
                  : 'Customer requests and scheduled appointments will appear here.'}
              </span>
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal
          title={customer ? 'Request an appointment' : 'Create an appointment'}
          onClose={() => setModal(false)}
        >
          <form onSubmit={handleSubmit(save)}>
            {admin && (
              <>
                <label className="field">
                  Customer
                  <select required {...register('customer', { required: true })}>
                    <option value="">Select customer…</option>
                    {customers.map((entry) => (
                      <option key={entry._id} value={entry._id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Assign tailor
                  <select required {...register('tailor', { required: true })}>
                    <option value="">Select tailor…</option>
                    {tailors.map((entry) => (
                      <option key={entry._id} value={entry._id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className="field">
              Appointment title
              <input
                required
                placeholder="First fitting, pickup…"
                {...register('title', { required: true })}
              />
            </label>
            <label className="field">
              Type
              <select {...register('type')}>
                <option value="FITTING">Fitting</option>
                <option value="MEASUREMENT">Measurement</option>
                <option value="PICKUP">Pickup</option>
                <option value="CONSULTATION">Consultation</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="field">
              Date and time
              <input
                required
                type="datetime-local"
                {...register('scheduledAt', { required: true })}
              />
            </label>
            <label className="field">
              Duration
              <select defaultValue="30" {...register('durationMinutes')}>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
              </select>
            </label>
            <label className="field">
              Notes
              <textarea rows="2" maxLength="1000" {...register('notes')} />
            </label>
            <Button type="submit">
              {customer ? 'Send appointment request' : 'Schedule appointment'}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
