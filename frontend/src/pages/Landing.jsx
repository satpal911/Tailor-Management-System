import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleHelp,
  Scissors,
  Shirt,
  Users,
  Wallet,
  Activity,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';
import atelierBanner from '../assets/atelier-banner.svg';

const features = [
  [Shirt, 'Orders that stay in step', 'Track every fitting, due date, alteration, and handoff from one clear workflow.'],
  [Scissors, 'Measurements close at hand', 'Keep reusable measurement profiles and garment notes available to authorized staff.'],
  [Users, 'Customer relationships', 'Keep customer contact details, order history, and appointments together.'],
  [Wallet, 'Payments with a clear record', 'Record deposits, balances, and refunds. Payments are entered manually; no payment gateway is implied.'],
  [CalendarDays, 'A coordinated team', 'Assign work, manage staff access, and keep appointments visible to your team.'],
  [Activity, 'Progress customers can follow', 'Share order status and approved design references through a shop-specific customer experience.'],
];

const plans = [
  {
    name: 'Essentials',
    code: 'STARTER',
    note: 'A considered start for an independent tailor.',
    items: ['Orders and due dates', 'Customer profiles and measurements', 'Owner workspace and order tracking'],
  },
  {
    name: 'Growing atelier',
    code: 'GROWTH',
    note: 'More coordination as your shop grows.',
    items: ['Everything in Essentials', 'Staff, appointments, and assignments', 'Payment records, payroll, and reports'],
    featured: true,
  },
  {
    name: 'Studio',
    code: 'STUDIO',
    note: 'Guided setup for a more established studio.',
    items: ['Everything in Growing atelier', 'Guided onboarding and launch checklist', 'Custom-domain setup consultation'],
  },
];

const faqs = [
  ['Will submitting an application create a shop?', 'No. It creates an enquiry for review. A platform operator must contact and approve the application before provisioning starts.'],
  ['How does pricing work?', 'We confirm pricing and the selected plan directly during the demo and onboarding process. This site does not charge you or claim fixed rates.'],
  ['Can I use my own domain?', 'You can request a custom domain. DNS, HTTPS, and routing need to be configured for the domain; a request does not configure them automatically.'],
  ['Can customers pay online?', 'The current system records payments entered by the shop. No online payment gateway or subscription billing is included.'],
];

export default function Landing() {
  return (
    <div className="public saas-marketing">
      <header className="public-nav">
        <Link className="brand" to="/">
          <span className="brand-mark"><Scissors size={17} aria-hidden="true" /></span>
          <span className="brand-word">Stitchcraft <small>TOOLS FOR TAILORING SHOPS</small></span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#plans">Plans</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="actions">
          <ThemeToggle />
          <Link className="text-link" to="/access">Sign in</Link>
          <Link className="button button-primary" to="/apply">
            <span className="public-nav-cta-label">Request a demo</span>
            <span className="public-nav-cta-compact">Demo</span>
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <span className="pill"><Sparkles size={13} aria-hidden="true" /> MADE FOR INDEPENDENT ATELIERS</span>
            <h1>More time for the <em>perfect fit.</em></h1>
            <p className="hero-lede">Bring orders, fittings, measurements, customers, and shop finances into one practical workspace built for tailoring teams.</p>
            <div className="actions hero-actions">
              <Link className="button button-primary" to="/apply">Request a demo <ArrowRight size={16} aria-hidden="true" /></Link>
              <a href="#features" className="text-link">Explore the features</a>
            </div>
            <div className="hero-proof">
              <span className="proof-bubbles">CUT · SEW · FIT</span>
              <span><b>Made for the rhythm of your shop.</b><small>Start with a guided conversation about your workflow.</small></span>
            </div>
          </div>
          <div className="hero-art">
            <img className="hero-banner-image" src={atelierBanner} alt="" aria-hidden="true" />
            <div className="atelier-preview card">
              <div className="preview-top">
                <span><Scissors size={13} aria-hidden="true" /> SAMPLE ATELIER</span>
                <span>DEMO VIEW</span>
              </div>
              <h3>A lovely day to make.</h3>
              <div className="preview-stats">
                <span>ACTIVE ORDERS<b>24</b></span>
                <span>READY FOR PICKUP<b>05</b></span>
              </div>
              {[
                ['JD', 'Sample Customer', 'Blouse · 2 pieces', 'Stitching'],
                ['AS', 'Sample Customer', 'Kurta set · Fitting', 'Fitting'],
              ].map((item, index) => (
                <div className="preview-order" key={`${item[0]}-${index}`}>
                  <i>{item[0]}</i>
                  <span><b>{item[1]}</b><small>{item[2]}</small></span>
                  <em>{item[3]}</em>
                </div>
              ))}
              <div className="preview-foot"><Check size={13} aria-hidden="true" /> Illustrative demo data only</div>
            </div>
            <span className="decor-star" aria-hidden="true">✳</span>
          </div>
        </section>
        <section className="trust-strip">ONE WORKSPACE <i /> INDEPENDENT TAILORS <i /> ALTERATION STUDIOS <i /> CUSTOM ATELIERS</section>
        <section className="feature-section" id="features">
          <div>
            <span className="eyebrow">THE DETAILS, IN ONE PLACE</span>
            <h2>Your craft deserves a calmer back office.</h2>
            <p>Keep the details of each order connected, so your team can spend less time searching and more time making.</p>
          </div>
          <div className="feature-grid">
            {features.map(([Icon, title, description]) => (
              <article key={title}>
                <i><Icon size={18} aria-hidden="true" /></i>
                <b>{title}</b>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="quote-section" id="story">
          <span aria-hidden="true">“</span>
          <blockquote>Every fitting, detail, and promise to a customer deserves a place your team can find.</blockquote>
          <b>Thoughtfully designed for independent tailoring businesses.</b>
        </section>
        <section className="pricing-section" id="plans">
          <div className="pricing-heading">
            <span className="eyebrow">PLANS THAT START WITH A CONVERSATION</span>
            <h2>Choose the workflow that fits.</h2>
            <p>Compare the included features, then request a demo to discuss fit and pricing. No online checkout is available.</p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`pricing-card card${plan.featured ? ' is-featured' : ''}`} key={plan.code}>
                <span className="eyebrow">{plan.code}</span>
                <h3>{plan.name}</h3>
                <p>{plan.note}</p>
                <strong className="pricing-value">Pricing confirmed during demo</strong>
                <ul>{plan.items.map((item) => <li key={item}><Check size={15} aria-hidden="true" />{item}</li>)}</ul>
                <Link className={plan.featured ? 'button button-primary' : 'button button-outline'} to={`/apply?plan=${plan.code}`}>Discuss this plan <ArrowRight size={15} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        </section>
        <section className="faq-section" id="faq">
          <div className="faq-heading">
            <CircleHelp size={22} aria-hidden="true" />
            <div><span className="eyebrow">GOOD TO KNOW</span><h2>Frequently asked questions</h2></div>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer]) => (
              <details key={question}><summary>{question}</summary><p>{answer}</p></details>
            ))}
          </div>
        </section>
        <section className="final-cta" id="contact">
          <div>
            <span className="eyebrow">START WITH A CONVERSATION</span>
            <h2>See how it could fit your shop.</h2>
            <p>Request a demo and tell us what you need. Our team will follow up using the contact details you provide.</p>
            <Link className="button button-primary" to="/apply">Get started <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <span aria-hidden="true">✳</span>
        </section>
      </main>
      <footer className="public-footer">
        Stitchcraft <span>Tools for independent tailoring shops.</span>
        <Link to="/apply">Request a demo</Link>
        <Link to="/platform/login">Platform operator</Link>
      </footer>
    </div>
  );
}
