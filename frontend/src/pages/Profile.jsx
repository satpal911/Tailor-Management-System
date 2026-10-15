import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Check, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api from '../services/api.js';
import { errorMessage } from '../utils/constants.js';
import { Button, PageHeader } from '../components/UI.jsx';

export default function Profile() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const passwordEnabled = true;
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty, errors },
  } = useForm({ defaultValues: { name: user.name, phone: user.phone || '' } });
  const newPassword = watch('password');

  async function save(values) {
    setBusy(true);
    try {
      const payload = { name: values.name, phone: values.phone };
      if (passwordEnabled && values.password) {
        payload.password = values.password;
        payload.currentPassword = values.currentPassword;
      }
      await api.patch('/users/me', payload);
      await refresh();
      toast('Profile updated');
      reset({ name: values.name, phone: values.phone });
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="YOUR ACCOUNT"
        title="Profile & settings"
        subtitle="Your account details and preferences."
      />
      <div className="profile-layout">
        <section className="card profile-card">
          <header>
            <UserRound size={17} />
            <div>
              <h2>Personal details</h2>
              <p>How we know you and reach you.</p>
            </div>
          </header>
          <form onSubmit={handleSubmit(save)}>
            <label className="field">
              Full name
              <input
                {...register('name', {
                  required: 'Name is required',
                  minLength: { value: 2, message: 'Enter at least 2 characters' },
                  maxLength: { value: 120, message: 'Name must be 120 characters or fewer' },
                })}
              />
              {errors.name && <small className="field-error">{errors.name.message}</small>}
            </label>
            <label className="field">
              Email address
              <input value={user.email || 'Not provided'} disabled />
            </label>
            <label className="field">
              Phone number
              <input
                {...register('phone', {
                  validate: (value) => {
                    const digits = String(value || '').replace(/\D/g, '').length;
                    return !digits || (digits >= 7 && digits <= 15) || 'Enter a valid phone number';
                  },
                })}
              />
              {errors.phone && <small className="field-error">{errors.phone.message}</small>}
            </label>
            <div className="profile-role">
              <span>Workspace role</span>
              <b>{user.role}</b>
            </div>
            {passwordEnabled && (
              <>
                <hr />
                <h3>
                  <LockKeyhole size={15} /> Change password
                </h3>
                <p className="profile-help">
                  Leave these fields empty to keep your current password.
                </p>
                <label className="field">
                  Current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    {...register('currentPassword', {
                      required: newPassword ? 'Current password is required' : false,
                    })}
                  />
                  {errors.currentPassword && (
                    <small className="field-error">{errors.currentPassword.message}</small>
                  )}
                </label>
                <label className="field">
                  New password
                  <input
                    type="password"
                    minLength="8"
                    autoComplete="new-password"
                    {...register('password', {
                      minLength: { value: 8, message: 'Use at least 8 characters' },
                      maxLength: {
                        value: 128,
                        message: 'Password must be 128 characters or fewer',
                      },
                    })}
                  />
                  {errors.password && (
                    <small className="field-error">{errors.password.message}</small>
                  )}
                </label>
                <label className="field">
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    {...register('confirmPassword', {
                      validate: (value) =>
                        !newPassword || value === newPassword || 'Passwords do not match',
                    })}
                  />
                  {errors.confirmPassword && (
                    <small className="field-error">{errors.confirmPassword.message}</small>
                  )}
                </label>
              </>
            )}
            <div className="actions">
              <Button type="submit" disabled={busy || !isDirty}>
                {busy ? 'Saving…' : 'Save changes'} <Check size={14} />
              </Button>
            </div>
          </form>
        </section>
        <aside className="card account-card">
          <span className="account-avatar">
            <UserRound size={24} />
          </span>
          <h2>{user.name}</h2>
          <p>{user.email || user.phone}</p>
          <span className="badge">{user.role}</span>
          <div>
            <b>Account security</b>
            <small>
              Your password is encrypted and your session uses a secure, HTTP-only cookie.
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
