import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyRound, Plus, Search, Users } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../utils/constants.js';
import {
  Button,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  PasswordInput,
  SearchBox,
} from '../components/UI.jsx';

export default function Customers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(true);
  const [modal, setModal] = useState(false);
  const [passwordCustomer, setPasswordCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const customerForm = useForm();
  const passwordForm = useForm();

  async function load() {
    setBusy(true);
    try {
      const response = await api.get('/customers', {
        params: { page, limit: 15, search: q || undefined },
      });
      setRows(response.data.data);
      setMeta(response.data.meta);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [page, q]);

  async function saveCustomer(values) {
    if (saving) return;
    setSaving(true);
    try {
      await api.post('/customers', values);
      toast('Customer added');
      setModal(false);
      customerForm.reset();
      load();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(values) {
    if (savingPassword) return;
    setSavingPassword(true);
    try {
      await api.post(`/customers/${passwordCustomer._id}/password`, { password: values.password });
      toast('Password set. Give the customer their sign-in details in person.', 'success');
      setPasswordCustomer(null);
      passwordForm.reset();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="THE PEOPLE BEHIND THE PIECES"
        title="Customers"
        subtitle="Good work begins with remembering the little things."
      >
        <Button onClick={() => setModal(true)} icon={Plus}>
          Add customer
        </Button>
      </PageHeader>
      <div className="filterbar">
        <SearchBox
          value={q}
          onChange={(value) => {
            setPage(1);
            setQ(value);
          }}
          placeholder="Search name, phone, email…"
        />
        <span>
          <Users size={14} /> {meta?.total ?? '—'} customer profiles
        </span>
      </div>
      {busy ? (
        <Loading />
      ) : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>CUSTOMER</th>
                <th>PHONE</th>
                <th>EMAIL</th>
                <th>PROFILE</th>
                <th>ADDED</th>
                {user.role === 'ADMIN' && <th>ACCOUNT ACCESS</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer._id}>
                  <td>
                    <span className="customer-name">
                      <i>
                        {customer.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)}
                      </i>
                      <b>{customer.name}</b>
                    </span>
                  </td>
                  <td>{customer.phone || '—'}</td>
                  <td>{customer.email || '—'}</td>
                  <td>{customer.isActive ? 'Active' : 'Archived'}</td>
                  <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
                  {user.role === 'ADMIN' && (
                    <td>
                      <Button
                        variant="outline"
                        disabled={!customer.isActive || !customer.phone}
                        onClick={() => setPasswordCustomer(customer)}
                        icon={KeyRound}
                      >
                        Set password
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={meta} onPage={setPage} />
        </div>
      )}
      {modal && (
        <Modal title="Add a customer" onClose={() => setModal(false)}>
          <form onSubmit={customerForm.handleSubmit(saveCustomer)}>
            <label className="field">
              Full name
              <input required {...customerForm.register('name', { required: true })} />
            </label>
            <label className="field">
              Email
              <input type="email" {...customerForm.register('email')} />
            </label>
            <label className="field">
              Phone
              <input {...customerForm.register('phone')} />
            </label>
            <label className="field">
              Address
              <textarea rows="2" {...customerForm.register('address')} />
            </label>
            <div className="actions">
              <Button variant="outline" type="button" onClick={() => setModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} loadingText="Saving customer…">
                Save customer
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {passwordCustomer && (
        <Modal
          title={`Set up ${passwordCustomer.name}`}
          onClose={() => {
            setPasswordCustomer(null);
            passwordForm.reset();
          }}
        >
          <p className="profile-help">
            Only use this while the customer is present and has chosen their password. The password
            is stored as a hash. Share no temporary credentials.
          </p>
          <form onSubmit={passwordForm.handleSubmit(savePassword)}>
            <label className="field">
              Customer-chosen password
              <PasswordInput
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                {...passwordForm.register('password', {
                  required: true,
                  minLength: 8,
                  maxLength: 128,
                })}
              />
              <small>At least 8 characters.</small>
            </label>
            <div className="actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setPasswordCustomer(null);
                  passwordForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={savingPassword} loadingText="Saving password…">
                Save password
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
