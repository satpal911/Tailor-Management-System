import {
  ArrowRight,
  CalendarDays,
  Check,
  Scissors,
  Shirt,
  Users,
  Wallet,
  Activity,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/UI.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import atelierBanner from '../assets/atelier-banner.svg';
import { useShopName } from '../context/ShopContext.jsx';
export default function Landing() {
  const { user } = useAuth();
  const shopName = useShopName();
  return (
    <div className="public">
      <header className="public-nav">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Scissors size={17} />
          </span>
          <span className="brand-word">
            {shopName}
            <small>TAILORING ATELIER</small>
          </span>
        </Link>
        <nav>
          <a href="#features">Features</a>
          <a href="#story">Our story</a>
        </nav>
        <div className="actions">
          <ThemeToggle />
          {user ? (
            <Button to="/app">
              Open workspace <ArrowRight size={14} />
            </Button>
          ) : (
            <>
              <Link className="text-link" to="/access">
                Sign in
              </Link>
              <Button to="/access">
                <span className="public-nav-cta-label">Choose your access</span>
                <span className="public-nav-cta-compact">Access</span> <ArrowRight size={14} />
              </Button>
            </>
          )}
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <span className="pill">
              <Sparkles size={13} /> YOUR ATELIER, IN GOOD HANDS
            </span>
            <h1>
              More time for
              <br />
              the <em>perfect fit.</em>
            </h1>
            <p className="hero-lede">
              The quiet confidence of knowing every order, fitting and customer is exactly where it
              should be.
            </p>
            <div className="actions hero-actions">
              <Button to={user ? '/app' : '/access'}>
                Bring your shop together <ArrowRight size={16} />
              </Button>
              <a href="#features" className="text-link">
                See how it works
              </a>
            </div>
            <div className="hero-proof">
              <span className="proof-bubbles">M A N +</span>
              <span>
                <b>Made for the hands that make.</b>
                <small>Thoughtfully designed for independent ateliers</small>
              </span>
            </div>
          </div>
          <div className="hero-art">
            <img className="hero-banner-image" src={atelierBanner} alt="" aria-hidden="true" />
            <div className="atelier-preview card">
              <div className="preview-top">
                <span>
                  <Scissors size={13} /> STITCHCRAFT ATELIER
                </span>
                <span>MONDAY · OCT 12</span>
              </div>
              <h3>A lovely day to make.</h3>
              <div className="preview-stats">
                <span>
                  ACTIVE ORDERS<b>24</b>
                </span>
                <span>
                  READY FOR PICKUP<b>05</b>
                </span>
              </div>
              {[
                ['MS', 'Meera Shah', 'Silk blouse · 2 pieces', 'Stitching'],
                ['AK', 'Arjun Kapoor', 'Kurta set · Fitting today', 'Fitting'],
              ].map((x) => (
                <div className="preview-order" key={x[0]}>
                  <i>{x[0]}</i>
                  <span>
                    <b>{x[1]}</b>
                    <small>{x[2]}</small>
                  </span>
                  <em>{x[3]}</em>
                </div>
              ))}
              <div className="preview-foot">
                <Check size={13} /> All caught up <span>View your day →</span>
              </div>
            </div>
            <div className="floating-note">
              <Check size={15} />
              <span>
                <b>One less thing to remember</b>
                <small>Meera’s fitting · 10:30 am</small>
              </span>
            </div>
            <span className="decor-star">✳</span>
          </div>
        </section>
        <section className="trust-strip">
          MADE FOR THE HANDS THAT MAKE <i /> INDEPENDENT TAILORS <i /> ALTERATION STUDIOS <i />{' '}
          CUSTOM ATELIERS
        </section>
        <section className="feature-section" id="features">
          <div>
            <span className="eyebrow">A LITTLE MORE IN SYNC</span>
            <h2>
              Your craft deserves
              <br />a calmer back office.
            </h2>
            <p>
              The thoughtful details of your shop, all in one place. Simple enough to pick up,
              considered enough to grow with you.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                Shirt,
                'Every order, in step',
                'From first pin to final pickup, see what’s moving and what needs attention.',
              ],
              [
                Users,
                'Know your people',
                'Remember the customer and just how they like their sleeves to fall.',
              ],
              [
                Scissors,
                'A perfect record',
                'Keep measurements and fitting notes close, so a great fit gets easier to repeat.',
              ],
              [
                Wallet,
                'Money, made clear',
                'Deposits, balances and daily takings, all accounted for.',
              ],
              [
                CalendarDays,
                'The day at a glance',
                'Fittings and deadlines together, so the shop finds its rhythm.',
              ],
              [Activity, 'See what’s taking shape', 'A clear view of your work and your numbers.'],
            ].map(([Icon, t, d]) => (
              <article key={t}>
                <i>
                  <Icon size={18} />
                </i>
                <b>{t}</b>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="quote-section" id="story">
          <span>“</span>
          <blockquote>
            We finally have room to focus on the work we love. The little things just take care of
            themselves.
          </blockquote>
          <b>
            Riya Mehta <small>Owner, House of Mehta · Jaipur</small>
          </b>
        </section>
        <section className="final-cta">
          <div>
            <span className="eyebrow">A BETTER KIND OF BUSY</span>
            <h2>
              Let’s make your day
              <br />
              feel a little lighter.
            </h2>
            <p>Your first order is just a few clicks away.</p>
            <Button to={user ? '/app' : '/access'}>
              Get started <ArrowRight size={15} />
            </Button>
          </div>
          <span>✳</span>
        </section>
      </main>
      <footer className="public-footer">
        {shopName} <span>Thoughtfully made for the people who make things fit.</span>
        <span>© 2026</span>
      </footer>
    </div>
  );
}
