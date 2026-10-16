import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Archive, Layers3, Plus, Scissors } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage, money } from '../utils/constants.js';
import { Button, Loading, Modal, PageHeader, StatusBadge } from '../components/UI.jsx';
export default function Catalog() {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [busy, setBusy] = useState(true);
  const [mode, setMode] = useState('');
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  async function load() {
    try {
      const [a, b] = await Promise.all([
        api.get('/categories', { params: { limit: 100 } }),
        api.get('/services', { params: { limit: 100 } }),
      ]);
      setCategories(a.data.data);
      setServices(b.data.data);
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
    try {
      if (mode === 'category') await api.post('/categories', v);
      else
        await api.post('/services', {
          ...v,
          basePrice: Number(v.basePrice),
          estimatedDays: Number(v.estimatedDays),
        });
      toast('Catalog item added');
      setMode('');
      reset();
      load();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="THE WORK YOU OFFER"
        title="Services & categories"
        subtitle="Keep your atelier’s offerings and starting prices organized."
      >
        <Button onClick={() => setMode('category')} variant="outline" icon={Layers3}>
          Add category
        </Button>
        <Button onClick={() => setMode('service')} icon={Plus}>
          Add service
        </Button>
      </PageHeader>
      {busy ? (
        <Loading />
      ) : (
        <div className="catalog-grid">
          <section className="card catalog-panel">
            <header>
              <Layers3 size={16} />
              <b>Categories</b>
              <span>{categories.length}</span>
            </header>
            {categories.map((c) => (
              <article key={c._id}>
                <span>
                  {c.name}
                  <small>{c.description || 'Tailoring category'}</small>
                </span>
                <StatusBadge value={c.isActive ? 'ACTIVE' : 'ARCHIVED'} />
              </article>
            ))}
            {!categories.length && <p className="empty-state">No categories yet.</p>}
          </section>
          <section className="card catalog-panel">
            <header>
              <Scissors size={16} />
              <b>Services</b>
              <span>{services.length}</span>
            </header>
            {services.map((s) => (
              <article key={s._id}>
                <span>
                  {s.name}
                  <small>
                    {s.category?.name || 'Service'} · {s.estimatedDays} day estimate
                  </small>
                </span>
                <b>{money(s.basePrice)}</b>
              </article>
            ))}
            {!services.length && <p className="empty-state">No services yet.</p>}
          </section>
        </div>
      )}
      {mode && (
        <Modal
          title={mode === 'category' ? 'Add category' : 'Add service'}
          onClose={() => setMode('')}
        >
          <form onSubmit={handleSubmit(save)}>
            <label className="field">
              Name
              <input required {...register('name', { required: true })} />
            </label>
            <label className="field">
              Description
              <textarea rows="2" {...register('description')} />
            </label>
            {mode === 'service' && (
              <>
                <label className="field">
                  Category
                  <select required {...register('category', { required: true })}>
                    <option value="">Choose category…</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Starting price (₹)
                  <input
                    type="number"
                    min="0"
                    required
                    {...register('basePrice', { required: true })}
                  />
                </label>
                <label className="field">
                  Estimated days
                  <input type="number" min="1" defaultValue="7" {...register('estimatedDays')} />
                </label>
              </>
            )}
            <Button
              type="submit"
              loading={saving}
              loadingText={`Saving ${mode}…`}
            >
              Save {mode}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
