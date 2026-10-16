import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import { errorMessage } from '../utils/constants.js';
import { useToast } from '../context/ToastContext.jsx';

const plans = [
  ['STARTER', 'Essentials', 'Orders, customers, measurements, and a clear daily view.'],
  ['GROWTH', 'Growing atelier', 'Everything in Essentials, plus payments, reports, and team workflows.'],
  ['STUDIO', 'Studio', 'All features, priority onboarding, and a guided launch.'],
];

export default function ApplyShop() {
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get('plan');
  const initialPlan = plans.some(([code]) => code === requestedPlan) ? requestedPlan : 'GROWTH';
  const { toast } = useToast();
  const [values, setValues] = useState({
    ownerName: '',
    shopName: '',
    phone: '',
    email: '',
    city: '',
    businessDetails: '',
    plan: initialPlan,
    customDomain: false,
    website: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (event) => {
    const { name, value, checked, type } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrors({});
    try {
      await api.post('/public/applications', values);
      setSubmitted(true);
      toast('Application received. We will contact you about a demo.');
    } catch (error) {
      const fieldErrors = error.response?.data?.errors || [];
      setErrors(Object.fromEntries(fieldErrors.map(({ field, message }) => [field, message])));
      toast(errorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="public application-page">
      <header className="public-nav">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">✂</span>
          <span className="brand-word">Stitchcraft <small>TAILORING SOFTWARE</small></span>
        </Link>
        <Link className="text-link inline-flex items-center gap-2" to="/">
          <ArrowLeft size={15} aria-hidden="true" /> Back to overview
        </Link>
      </header>
      <section className="application-intro">
        <span className="eyebrow">LET'S GET TO KNOW YOUR ATELIER</span>
        <h1>Request a demo</h1>
        <p>Tell us a little about your shop. We’ll follow up to understand what you need and arrange a walkthrough.</p>
      </section>
      <section className="application-card card">
        {submitted ? (
          <div className="application-success" role="status">
            <CheckCircle2 size={34} aria-hidden="true" />
            <h2>Thank you for your interest.</h2>
            <p>Your application is with our team. We’ll contact you using the details you provided.</p>
            <Link className="button button-primary" to="/">Return to overview</Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="application-form-grid">
              <label className="field">
                Owner name *
                <input autoComplete="name" name="ownerName" value={values.ownerName} onChange={update} required maxLength={120} aria-invalid={Boolean(errors.ownerName)} />
                {errors.ownerName && <small className="field-error">{errors.ownerName}</small>}
              </label>
              <label className="field">
                Shop name *
                <input autoComplete="organization" name="shopName" value={values.shopName} onChange={update} required maxLength={120} aria-invalid={Boolean(errors.shopName)} />
                {errors.shopName && <small className="field-error">{errors.shopName}</small>}
              </label>
              <label className="field">
                Email *
                <input autoComplete="email" type="email" name="email" value={values.email} onChange={update} required maxLength={254} aria-invalid={Boolean(errors.email)} />
                {errors.email && <small className="field-error">{errors.email}</small>}
              </label>
              <label className="field">
                Phone number *
                <input autoComplete="tel" type="tel" name="phone" placeholder="+91 98765 43210" value={values.phone} onChange={update} required maxLength={30} aria-invalid={Boolean(errors.phone)} />
                {errors.phone && <small className="field-error">{errors.phone}</small>}
              </label>
              <label className="field">
                City *
                <input autoComplete="address-level2" name="city" value={values.city} onChange={update} required maxLength={120} aria-invalid={Boolean(errors.city)} />
                {errors.city && <small className="field-error">{errors.city}</small>}
              </label>
              <label className="field">
                Preferred plan *
                <select name="plan" value={values.plan} onChange={update}>
                  {plans.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
                </select>
              </label>
              <label className="field application-details">
                What would you like help with? <span className="muted-copy">(optional)</span>
                <textarea name="businessDetails" rows="4" maxLength={1000} value={values.businessDetails} onChange={update} />
                {errors.businessDetails && <small className="field-error">{errors.businessDetails}</small>}
              </label>
            </div>
            <label className="application-checkbox">
              <input type="checkbox" name="customDomain" checked={values.customDomain} onChange={update} />
              I’m interested in using my own website domain.
            </label>
            <label className="application-honeypot" aria-hidden="true">
              Website
              <input tabIndex="-1" autoComplete="off" name="website" value={values.website} onChange={update} />
            </label>
            <p className="application-privacy">We use these details only to respond to your enquiry and manage onboarding. No shop account is created by submitting this form.</p>
            <button className="button button-primary" type="submit" disabled={submitting} aria-busy={submitting}>
              <Send size={15} aria-hidden="true" />
              {submitting ? 'Sending application…' : 'Request a demo'}
            </button>
          </form>
        )}
      </section>
      <p className="pricing-disclaimer">Plan features are outlined for discussion. Pricing and any payment are confirmed directly during onboarding; online payments are not enabled.</p>
    </main>
  );
}
