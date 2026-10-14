import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CalendarDays, Clock3, Plus } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { date, errorMessage } from '../utils/constants.js';
import { Button, Loading, Modal, PageHeader, StatusBadge } from '../components/UI.jsx';
import { ROLES } from '../utils/constants.js';
export default function Appointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [busy, setBusy] = useState(true);
  const [modal, setModal] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  async function load() {
    try {
      const r = await api.get('/appointments');
      setRows(r.data.data);
      if (user.role === 'ADMIN')
        setCustomers((await api.get('/customers', { params: { limit: 100 } })).data.data);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(v) {
    try {
      await api.post('/appointments', { ...v, durationMinutes: Number(v.durationMinutes) });
      toast('Appointment scheduled');
      setModal(false);
      reset();
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }
  async function mark(id, status) {
    try {
      await api.patch(`/appointments/${id}`, { status });
      toast('Appointment updated');
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE ROOM IN THE DAY"
        title="Appointments"
        subtitle="Fittings, pickups and the moments in between."
      >
        {user.role !== ROLES.TAILOR && (
          <Button onClick={() => setModal(true)} icon={Plus}>
            Add appointment
          </Button>
        )}
      </PageHeader>
      <div className="appointments-summary">
        <CalendarDays size={17} />
        <span>Upcoming appointments</span>
        <small>{rows.filter((a) => a.status === 'SCHEDULED').length} scheduled</small>
      </div>
      {busy ? (
        <Loading />
      ) : (
        <div className="appointment-list">
          {rows.map((a) => (
            <article className="card appointment-card" key={a._id}>
              <div className="appointment-date">
                <b>{new Date(a.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit' })}</b>
                <small>
                  {new Date(a.scheduledAt).toLocaleDateString('en-IN', { month: 'short' })}
                </small>
              </div>
              <div className="appointment-info">
                <b>{a.title}</b>
                <small>
                  {a.customer?.name} · {a.type.replaceAll('_', ' ').toLowerCase()}
                </small>
                <span>
                  <Clock3 size={13} />{' '}
                  {new Date(a.scheduledAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · {a.durationMinutes} min {a.tailor?.user?.name ? `· ${a.tailor.user.name}` : ''}
                </span>
              </div>
              <StatusBadge value={a.status} />
              {a.status === 'SCHEDULED' && user.role !== ROLES.CUSTOMER && (
                <button className="button button-outline" onClick={() => mark(a._id, 'COMPLETED')}>
                  Mark complete
                </button>
              )}
            </article>
          ))}
          {!rows.length && (
            <div className="card empty-state">
              <b>No appointments scheduled</b>
              <span>New fittings and pickups will show here.</span>
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title="Schedule an appointment" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit(save)}>
            {user.role === ROLES.ADMIN && (
              <label className="field">
                Customer
                <select required {...register('customer', { required: true })}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
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
              <select {...register('durationMinutes')}>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
              </select>
            </label>
            <label className="field">
              Notes
              <textarea rows="2" {...register('notes')} />
            </label>
            <Button type="submit">Save appointment</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
