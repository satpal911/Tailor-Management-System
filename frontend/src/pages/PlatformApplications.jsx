import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, LogOut, RefreshCw, Search } from 'lucide-react';
import api from '../services/api.js';
import { date, errorMessage } from '../utils/constants.js';
import { useToast } from '../context/ToastContext.jsx';

const statuses = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'APPROVED', 'REJECTED'];
const editableStatuses = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'REJECTED'];
const paymentStatuses = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'NOT_REQUIRED'];
const plans = { STARTER: 'Essentials', GROWTH: 'Growing atelier', STUDIO: 'Studio' };

function initialEdits(applications) {
  return Object.fromEntries(
    applications.map((application) => [
      application._id,
      {
        status: application.status,
        paymentStatus: application.paymentStatus,
        internalNotes: application.internalNotes || '',
      },
    ]),
  );
}

export default function PlatformApplications() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [applications, setApplications] = useState([]);
  const [edits, setEdits] = useState({});
  const [activationLinks, setActivationLinks] = useState({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [admin, setAdmin] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const session = await api.get('/platform/auth/me');
      setAdmin(session.data.data.admin);
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (status) params.status = status;
      const response = await api.get('/platform/applications', { params });
      const items = response.data.data || [];
      setApplications(items);
      setEdits((current) => ({ ...initialEdits(items), ...current }));
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        navigate('/platform/login', { replace: true });
        return;
      }
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [navigate, query, status]);

  useEffect(() => {
    load();
  }, [load]);

  const updateEdit = (id, key, value) => {
    setEdits((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  };

  const save = async (application) => {
    setBusyId(application._id);
    try {
      const response = await api.patch(`/platform/applications/${application._id}`, edits[application._id]);
      const updated = response.data.data;
      setApplications((current) => current.map((item) => item._id === updated._id ? updated : item));
      setEdits((current) => ({ ...current, [updated._id]: { status: updated.status, paymentStatus: updated.paymentStatus, internalNotes: updated.internalNotes || '' } }));
      toast('Application updated.');
    } catch (requestError) {
      toast(errorMessage(requestError), 'error');
    } finally {
      setBusyId('');
    }
  };

  const approve = async (application) => {
    setBusyId(application._id);
    try {
      const response = await api.post(`/platform/applications/${application._id}/approve`);
      const data = response.data.data;
      setApplications((current) => current.map((item) => item._id === application._id ? data.application : item));
      setEdits((current) => ({ ...current, [application._id]: { status: data.application.status, paymentStatus: data.application.paymentStatus, internalNotes: data.application.internalNotes || '' } }));
      if (data.activationUrl) {
        setActivationLinks((current) => ({ ...current, [application._id]: data.activationUrl }));
        toast('Shop provisioned. Copy and securely send the one-time activation link.');
      } else {
        toast(data.message || 'Shop is already provisioned. Generate a new activation link if needed.');
      }
    } catch (requestError) {
      toast(errorMessage(requestError), 'error');
    } finally {
      setBusyId('');
    }
  };

  const regenerate = async (application) => {
    setBusyId(application._id);
    try {
      const response = await api.post(`/platform/applications/${application._id}/activation-link`);
      setActivationLinks((current) => ({ ...current, [application._id]: response.data.data.activationUrl }));
      toast('A new one-time activation link is ready. Any previous link is now invalid.');
    } catch (requestError) {
      toast(errorMessage(requestError), 'error');
    } finally {
      setBusyId('');
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied.`);
    } catch {
      toast('Could not copy automatically. Select and copy the link manually.', 'error');
    }
  };

  const logout = async () => {
    try {
      await api.post('/platform/auth/logout');
    } finally {
      navigate('/platform/login', { replace: true });
    }
  };

  return (
    <main className="platform-page platform-console">
      <header className="platform-console-header">
        <div>
          <span className="eyebrow">PLATFORM OPERATIONS</span>
          <h1>Shop applications</h1>
          <p>Review prospective shops, coordinate demos, and provision only after approval.</p>
        </div>
        <div className="platform-admin-actions">
          <span>{admin?.name}</span>
          <button className="button button-outline" type="button" onClick={logout}><LogOut size={15} /> Sign out</button>
        </div>
      </header>
      <section className="platform-toolbar card" aria-label="Application filters">
        <form className="platform-search" onSubmit={(event) => { event.preventDefault(); load(); }}>
          <label className="search-box">
            <Search size={16} aria-hidden="true" />
            <input aria-label="Search applications" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search owner, shop, email, or city" />
          </label>
          <button className="button button-primary" type="submit">Search</button>
        </form>
        <label className="field platform-status-filter">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      {loading ? (
        <div className="platform-empty card" role="status">Loading applications…</div>
      ) : applications.length === 0 ? (
        <div className="platform-empty card">No applications match these filters.</div>
      ) : (
        <section className="platform-application-list" aria-label="Shop applications">
          {applications.map((application) => {
            const edit = edits[application._id] || {};
            const activationUrl = activationLinks[application._id];
            const isBusy = busyId === application._id;
            return (
              <article className="platform-application card" key={application._id}>
                <header className="platform-application-heading">
                  <div>
                    <span className="eyebrow">{plans[application.plan] || application.plan} · received {date(application.createdAt)}</span>
                    <h2>{application.shopName}</h2>
                    <p>{application.ownerName} · {application.city}</p>
                  </div>
                  <span className={`platform-status platform-status-${application.status.toLowerCase()}`}>{application.status.replaceAll('_', ' ')}</span>
                </header>
                <dl className="platform-contact-grid">
                  <div><dt>Email</dt><dd><a href={`mailto:${application.ownerEmail}`}>{application.ownerEmail}</a></dd></div>
                  <div><dt>Phone</dt><dd><a href={`tel:${application.phone}`}>{application.phone}</a></dd></div>
                  <div><dt>Custom domain</dt><dd>{application.customDomain ? 'Requested (manual setup)' : 'Not requested'}</dd></div>
                  <div><dt>Provisioning</dt><dd>{application.provisioningStatus.replaceAll('_', ' ')}</dd></div>
                </dl>
                {application.businessDetails && <p className="platform-business-details">{application.businessDetails}</p>}
                <div className="platform-edit-grid">
                  <label className="field">
                    Application status
                    <select value={edit.status || application.status} disabled={application.status === 'APPROVED' || application.status === 'REJECTED'} onChange={(event) => updateEdit(application._id, 'status', event.target.value)}>
                      {statuses.filter((item) => item === application.status || editableStatuses.includes(item)).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    Payment verification
                    <select value={edit.paymentStatus || application.paymentStatus} onChange={(event) => updateEdit(application._id, 'paymentStatus', event.target.value)}>
                      {paymentStatuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                  <label className="field platform-notes">
                    Internal notes
                    <textarea rows="3" maxLength={5000} value={edit.internalNotes ?? ''} onChange={(event) => updateEdit(application._id, 'internalNotes', event.target.value)} placeholder="Only platform administrators can see these notes." />
                  </label>
                </div>
                <footer className="platform-application-actions">
                  <button className="button button-outline" type="button" onClick={() => save(application)} disabled={isBusy}>
                    <Check size={15} /> {isBusy ? 'Saving…' : 'Save changes'}
                  </button>
                  {application.provisioningStatus !== 'COMPLETE' && application.status !== 'REJECTED' && (
                    <button className="button button-primary" type="button" onClick={() => approve(application)} disabled={isBusy || application.provisioningStatus === 'IN_PROGRESS'}>
                      {isBusy ? 'Provisioning…' : application.provisioningStatus === 'FAILED' ? 'Retry approval' : 'Approve and provision'}
                    </button>
                  )}
                  {application.provisioningStatus === 'COMPLETE' && !application.activatedAt && (
                    <button className="button button-outline" type="button" onClick={() => regenerate(application)} disabled={isBusy}>
                      <RefreshCw size={15} /> New activation link
                    </button>
                  )}
                </footer>
                {application.domain && (
                  <p className="platform-provisioning-link">
                    Shop host: <code>{application.domain}</code> · Customer sign-in: <code>{application.domain}/login</code>
                  </p>
                )}
                {application.activatedAt && <p className="platform-activated">Owner account activated {date(application.activatedAt)}.</p>}
                {activationUrl && (
                  <div className="platform-activation-notice" role="status">
                    <strong>One-time owner activation link</strong>
                    <p>Copy this link now and send it to the owner through a verified channel. The raw link is not saved and expires after 48 hours.</p>
                    <div className="platform-copy-row">
                      <input aria-label="One-time activation link" readOnly value={activationUrl} onFocus={(event) => event.target.select()} />
                      <button className="button button-primary" type="button" onClick={() => copy(activationUrl, 'Activation link')}><Copy size={15} /> Copy</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
