import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../utils/constants.js';
import { useToast } from '../context/ToastContext.jsx';

export default function ActivateOwner() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [activation] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { application: params.get('application') || '', token: params.get('token') || '' };
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { application, token } = activation;

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', '/activate');
  }, [token]);

  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 12) {
      setError('Use at least 12 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/public/applications/${application}/activate`, { token, password });
      setPassword('');
      setConfirmPassword('');
      await refresh();
      toast('Your account is active. Welcome to your shop.');
      navigate('/app', { replace: true });
    } catch (requestError) {
      const message = errorMessage(requestError);
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="platform-page">
      <section className="platform-auth-card card">
        <span className="eyebrow">SHOP OWNER ONBOARDING</span>
        <h1>Activate your owner account</h1>
        <p>Choose a new password to activate your account. Activation links expire after 48 hours and can only be used once.</p>
        {!application || !token ? (
          <p className="field-error" role="alert">This activation link is incomplete. Ask the platform team for a new link.</p>
        ) : (
          <form onSubmit={submit}>
            <label className="field">
              New password
              <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
              <small>Use at least 12 characters.</small>
            </label>
            <label className="field">
              Confirm password
              <input type="password" autoComplete="new-password" maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </label>
            {error && <p className="field-error" role="alert">{error}</p>}
            <button className="button button-primary w-full" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? 'Activating account…' : 'Set password and continue'}
            </button>
          </form>
        )}
        <Link className="text-link mt-5 inline-block" to="/">Back to overview</Link>
      </section>
    </main>
  );
}
