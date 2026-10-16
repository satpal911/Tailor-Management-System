import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { errorMessage } from '../utils/constants.js';
import { useToast } from '../context/ToastContext.jsx';

export default function PlatformAdminLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/platform/auth/login', { email, password });
      setPassword('');
      navigate('/platform/applications', { replace: true });
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="platform-page">
      <section className="platform-auth-card card">
        <span className="eyebrow">PLATFORM OPERATIONS</span>
        <h1>Administrator sign in</h1>
        <p>Access to platform enquiries is restricted to authorized operators.</p>
        <form onSubmit={submit}>
          <label className="field">
            Email
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
          </label>
          <label className="field">
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={128} />
          </label>
          <button className="button button-primary w-full" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
