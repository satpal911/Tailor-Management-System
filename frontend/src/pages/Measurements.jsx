import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Ruler, Search } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../utils/constants.js';
import { Button, Loading, Modal, PageHeader } from '../components/UI.jsx';
import { ROLES } from '../utils/constants.js';
const base = [
  'Chest',
  'Waist',
  'Hip',
  'Shoulder',
  'Sleeve',
  'Neck',
  'Length',
  'Inseam',
  'Thigh',
  'Bottom',
];
export default function Measurements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [busy, setBusy] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const { register, handleSubmit, reset } = useForm();
  async function load() {
    try {
      const r = await api.get('/measurements');
      setRows(r.data.data);
      if (user.role !== 'CUSTOMER') {
        const c = await api.get('/customers', { params: { limit: 100 } });
        setCustomers(c.data.data);
      }
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
    if (saving) return;
    setSaving(true);
    const values = {};
    for (const k of base) if (v[k]) values[k] = Number(v[k]);
    const customMeasurements =
      v.customName && v.customValue ? [{ name: v.customName, value: Number(v.customValue) }] : [];
    try {
      await api.post('/measurements', {
        customer: v.customer,
        name: v.name,
        garmentType: v.garmentType,
        unit: v.unit,
        values,
        customMeasurements,
        notes: v.notes,
      });
      toast('Measurement profile saved');
      setModal(false);
      reset();
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }
  const filtered = rows.filter((m) =>
    `${m.customer?.name || ''} ${m.name} ${m.garmentType}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const customerGroups = filtered.reduce((groups, measurement) => {
    const customerId = measurement.customer?._id || 'my-measurements';
    const group = groups.find((entry) => entry.id === customerId);
    if (group) group.measurements.push(measurement);
    else
      groups.push({
        id: customerId,
        name: measurement.customer?.name || user.name,
        measurements: [measurement],
      });
    return groups;
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="A PERFECT FIT, REMEMBERED"
        title="Measurements"
        subtitle="Reusable profiles keep each customer's fit close at hand."
      >
        <Button onClick={() => setModal(true)} icon={Plus}>
          New profile
        </Button>
      </PageHeader>
      <div className="filterbar">
        <label className="search-box">
          <Search size={15} />
          <input
            placeholder="Search customer or garment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span>
          <Ruler size={14} /> {rows.length} saved profiles
        </span>
      </div>
      {busy ? (
        <Loading />
      ) : (
        <div className="measurement-customer-groups">
          {customerGroups.map((group) => (
            <section className="measurement-customer-group" key={group.id}>
              {user.role !== ROLES.CUSTOMER && (
                <h2>
                  {group.name} <small>Customer ID: {group.id}</small>
                </h2>
              )}
              <div className="measurement-cards">
                {group.measurements.map((m) => (
                  <article className="card measurement-card" key={m._id}>
                    <header>
                      <span className="measurement-icon">
                        <Ruler size={17} />
                      </span>
                      <span>
                        <b>{m.name}</b>
                        <small>
                          {m.garmentType} · {m.unit}
                        </small>
                      </span>
                      <time>{new Date(m.updatedAt).toLocaleDateString()}</time>
                    </header>
                    <div className="measure-values">
                      {Object.entries(m.values || {}).map(([k, v]) => (
                        <span key={k}>
                          {k}
                          <b>
                            {v} {m.unit}
                          </b>
                        </span>
                      ))}
                      {m.customMeasurements?.map((x) => (
                        <span key={x.name}>
                          {x.name}
                          <b>
                            {x.value} {m.unit}
                          </b>
                        </span>
                      ))}
                    </div>
                    {m.notes && <p>{m.notes}</p>}
                  </article>
                ))}
              </div>
            </section>
          ))}
          {!customerGroups.length && (
            <div className="card empty-state">
              <b>No measurement profiles</b>
              <span>Start a profile to remember a customer’s fit.</span>
              <Button onClick={() => setModal(true)}>Add measurements</Button>
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title="New measurement profile" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit(save)}>
            {user.role !== ROLES.CUSTOMER && (
              <label className="field">
                Customer
                <select required {...register('customer', { required: true })}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option value={c._id} key={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="two-fields">
              <label className="field">
                Profile name
                <input
                  required
                  placeholder="e.g. Winter blouse"
                  {...register('name', { required: true })}
                />
              </label>
              <label className="field">
                Garment type
                <input
                  required
                  placeholder="Blouse, kurta…"
                  {...register('garmentType', { required: true })}
                />
              </label>
            </div>
            <label className="field">
              Unit
              <select {...register('unit')}>
                <option value="cm">Centimetres</option>
                <option value="in">Inches</option>
              </select>
            </label>
            <div className="measurement-input-grid">
              {base.map((k) => (
                <label className="field" key={k}>
                  {k}
                  <input type="number" min="0" step="0.1" {...register(k)} />
                </label>
              ))}
            </div>
            <div className="two-fields">
              <label className="field">
                Custom measurement name
                <input {...register('customName')} />
              </label>
              <label className="field">
                Value
                <input type="number" min="0" step="0.1" {...register('customValue')} />
              </label>
            </div>
            <label className="field">
              Fit notes
              <textarea rows="2" {...register('notes')} />
            </label>
            <div className="actions">
              <Button type="submit" loading={saving} loadingText="Saving profile…">
                Save profile
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
