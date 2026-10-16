import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Settings2 } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../utils/constants.js';
import { Button, Loading, PageHeader } from '../components/UI.jsx';
export default function Settings() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  useEffect(() => {
    api
      .get('/settings')
      .then((r) => reset(r.data.data))
      .catch((e) => toast(errorMessage(e), 'error'))
      .finally(() => setBusy(false));
  }, []);
  async function save(v) {
    setSaving(true);
    try {
      await api.patch('/settings', {
        ...v,
        taxRate: Number(v.taxRate),
        requireDeposit: Boolean(v.requireDeposit),
      });
      toast('Shop settings saved');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  }
  if (busy) return <Loading />;
  return (
    <>
      <PageHeader
        eyebrow="THE DETAILS BEHIND THE SCENES"
        title="Shop settings"
        subtitle="Set the defaults your team will use every day."
      />
      <form className="card settings-form" onSubmit={handleSubmit(save)}>
        <div className="panel-title">
          <div>
            <h2>
              <Settings2 size={16} /> Shop profile &amp; defaults
            </h2>
            <p>These details appear in your shop workspace and guide new orders.</p>
          </div>
        </div>
        <div className="two-fields">
          <label className="field">
            Shop name
            <input {...register('shopName', { required: true })} />
          </label>
          <label className="field">
            Contact email
            <input type="email" {...register('contactEmail')} />
          </label>
        </div>
        <div className="two-fields">
          <label className="field">
            Phone number
            <input {...register('phone')} />
          </label>
          <label className="field">
            Currency
            <select {...register('currency')}>
              <option value="INR">INR · Indian Rupee</option>
            </select>
          </label>
        </div>
        <label className="field">
          Shop address
          <input {...register('address')} />
        </label>
        <div className="two-fields">
          <label className="field">
            Timezone
            <input {...register('timezone')} />
          </label>
          <label className="field">
            Default tax rate (%)
            <input type="number" min="0" max="100" step="0.01" {...register('taxRate')} />
          </label>
        </div>
        <div className="two-fields">
          <label className="field">
            Order number prefix
            <input maxLength="8" {...register('orderPrefix')} />
          </label>
          <label className="toggle-setting">
            <span>
              <b>Require advance payment</b>
              <small>Display a reminder to collect a deposit on new orders.</small>
            </span>
            <input type="checkbox" {...register('requireDeposit')} />
          </label>
        </div>
        <div className="settings-actions">
          <Button loading={saving} loadingText="Saving settings…" icon={Save}>
            Save settings
          </Button>
        </div>
      </form>
    </>
  );
}
