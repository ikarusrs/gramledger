import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../core/theme/ThemeContext';

const USER_KEY = 'gramledger:user';
type User = { id: string; email: string; name: string | null };
const TOKEN_KEY = 'gramledger:access-token';

export function AccountScreen() {
  const { mode, setMode } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) setUser(JSON.parse(saved));
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/v1/auth/request-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    setBusy(false);
    if (!response.ok) {
      setMessage((await response.json()).error?.message ?? 'Could not send the code');
      return;
    }
    const payload = await response.json();
    setStep('code');
    setMessage(
      payload.devCode
        ? `Development code: ${payload.devCode}`
        : 'Check your email for a 6-digit code.',
    );
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/v1/auth/verify-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name, code }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error?.message ?? 'Could not verify the code');
      return;
    }
    localStorage.setItem(TOKEN_KEY, payload.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setUser(payload.user);
    setMessage('');
  }
  function signOut() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Account</h1>
          <p className="page__subtitle">Your GramLedger profile and preferences</p>
        </div>
      </header>
      {user ? (
        <section className="card stack">
          <div className="account-avatar">{(user.name ?? user.email)[0]?.toUpperCase()}</div>
          <h2 className="card__title">{user.name ?? user.email}</h2>
          <p className="muted">{user.email}</p>
          <button className="secondary-btn" onClick={signOut}>
            Sign out
          </button>
        </section>
      ) : (
        <section className="card stack">
          <h2 className="card__title">Sign in to save your villages and questions</h2>
          <p className="muted">We’ll send a one-time code. No password is stored.</p>
          <form className="stack" onSubmit={step === 'email' ? signIn : verify}>
            <label className="field">
              <span className="field__label">Name</span>
              <input
                className="search-box__input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="search-box__input"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {step === 'code' && (
              <label className="field">
                <span className="field__label">6-digit code</span>
                <input
                  className="search-box__input"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
            )}
            {message && <p className="muted">{message}</p>}
            <button className="primary-btn" disabled={busy}>
              {busy ? 'Please wait…' : step === 'email' ? 'Send code' : 'Verify code'}
            </button>
          </form>
        </section>
      )}
      <section className="card stack">
        <h2 className="card__title">Appearance</h2>
        <div className="segmented">
          {(['light', 'dark', 'system'] as const).map((option) => (
            <button
              key={option}
              className={`segmented__btn${mode === option ? ' segmented__btn--active' : ''}`}
              onClick={() => setMode(option)}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
        <Link to="/settings" className="text-link">
          More language settings →
        </Link>
      </section>
    </div>
  );
}
