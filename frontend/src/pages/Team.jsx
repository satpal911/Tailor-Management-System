import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Users } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../utils/constants.js';
import { Button, Loading, Modal, PageHeader, PasswordInput } from '../components/UI.jsx';

export default function Team() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState('');
  const { register, handleSubmit, reset } = useForm();
  async function load() {
    try {
      setRows((await api.get('/tailors')).data.data || []);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function save(values) {
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/tailors', {
        ...values,
        email: values.email || undefined,
        specialties: (values.specialties || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      });
      toast('Tailor account created');
      setModal(false);
      reset();
      await load();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus(tailor, accountStatus) {
    if (statusSaving) return;
    const key = `${tailor._id}:${accountStatus}`;
    setStatusSaving(key);
    try {
      await api.patch(`/users/${tailor.user._id}`, { accountStatus });
      toast(`Account ${accountStatus.toLowerCase()}`);
      await load();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setStatusSaving('');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="THE HANDS BEHIND THE WORK"
        title="Tailor team"
        subtitle="Manage accounts, approvals, specialties and capacity."
      >
        <Button onClick={() => setModal(true)} icon={Plus}>
          Add tailor
        </Button>
      </PageHeader>
      {busy ? (
        <Loading />
      ) : (
        <div className="team-grid">
          {rows.map((tailor) => (
            <article className="card team-card" key={tailor._id}>
              <header>
                <i>
                  {tailor.name
                    .split(' ')
                    .map((value) => value[0])
                    .join('')
                    .slice(0, 2)}
                </i>
                <span className={`availability ${tailor.status === 'ACTIVE' ? 'available' : ''}`}>
                  {tailor.status || 'ACTIVE'}
                </span>
              </header>
              <h2>{tailor.name}</h2>
              <p>
                {tailor.phone}
                {tailor.user?.email ? ` · ${tailor.user.email}` : ''}
              </p>
              <div className="specialties">
                {tailor.specialties?.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
              <footer>
                <span>Capacity</span>
                <b>{tailor.capacity} active orders</b>
              </footer>
              {tailor.status === 'PENDING' && (
                <div className="actions">
                  <Button
                    variant="success"
                    loading={statusSaving === `${tailor._id}:ACTIVE`}
                    disabled={Boolean(statusSaving)}
                    loadingText="Approving…"
                    onClick={() => changeStatus(tailor, 'ACTIVE')}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    loading={statusSaving === `${tailor._id}:REJECTED`}
                    disabled={Boolean(statusSaving)}
                    loadingText="Rejecting…"
                    onClick={() => changeStatus(tailor, 'REJECTED')}
                  >
                    Reject
                  </Button>
                </div>
              )}
              {tailor.status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  loading={statusSaving === `${tailor._id}:INACTIVE`}
                  disabled={Boolean(statusSaving)}
                  loadingText="Updating…"
                  onClick={() => changeStatus(tailor, 'INACTIVE')}
                >
                  Deactivate
                </Button>
              )}
              {tailor.status === 'INACTIVE' && (
                <Button
                  loading={statusSaving === `${tailor._id}:ACTIVE`}
                  disabled={Boolean(statusSaving)}
                  loadingText="Updating…"
                  onClick={() => changeStatus(tailor, 'ACTIVE')}
                >
                  Reactivate
                </Button>
              )}
            </article>
          ))}
          {!rows.length && (
            <div className="card empty-state">
              <Users size={20} />
              <b>No tailors added</b>
              <span>Build your team roster to assign tailoring work.</span>
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title="Add an active tailor" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit(save)}>
            <label className="field">
              Full name
              <input
                required
                minLength={2}
                {...register('name', { required: true, minLength: 2 })}
              />
            </label>
            <label className="field">
              Phone number
              <input
                required
                type="tel"
                autoComplete="tel"
                {...register('phone', { required: true })}
              />
            </label>
            <label className="field">
              Email (optional)
              <input type="email" {...register('email')} />
            </label>
            <label className="field">
              Temporary password
              <PasswordInput
                required
                minLength={8}
                autoComplete="new-password"
                {...register('password', { required: true, minLength: 8 })}
              />
            </label>
            <label className="field">
              Specialties
              <input placeholder="Blouses, kurtas" {...register('specialties')} />
            </label>
            <label className="field">
              Active order capacity
              <input
                type="number"
                min="1"
                max="200"
                defaultValue="20"
                {...register('capacity', { valueAsNumber: true, min: 1, max: 200 })}
              />
            </label>
            <Button type="submit" loading={saving} loadingText="Creating account…">
              Create tailor account
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
