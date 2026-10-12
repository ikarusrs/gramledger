import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../core/theme/ThemeContext';
import { useLocale } from '../../core/i18n/LocaleContext';
import { resolveApiUrl } from '../../lib/api/client';

const USER_KEY = 'gramledger:user';
type User = { id: string; email: string; name: string | null };
const TOKEN_KEY = 'gramledger:access-token';

export function AccountScreen() {
  const { mode, setMode } = useTheme();
  const { t } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as User;
      if (parsed && typeof parsed.email === 'string') setUser(parsed);
      else localStorage.removeItem(USER_KEY);
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch(resolveApiUrl('/v1/auth/request-otp'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    setBusy(false);
    if (!response.ok) {
      setMessage((await response.json()).error?.message ?? t('codeSent'));
      return;
    }
    const payload = await response.json();
    setStep('code');
    setMessage(payload.devCode ? `${t('developmentCode')}: ${payload.devCode}` : t('codeSent'));
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch(resolveApiUrl('/v1/auth/verify-otp'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name, code }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(payload.error?.message ?? t('verifyCode'));
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
          <h1 className="page__title">{t('account')}</h1>
          <p className="page__subtitle">{t('accountSubtitle')}</p>
        </div>
      </header>
      {user ? (
        <section className="card stack">
          <div className="account-avatar">{(user.name ?? user.email)[0]?.toUpperCase()}</div>
          <h2 className="card__title">{user.name ?? user.email}</h2>
          <p className="muted">{user.email}</p>
          <button className="secondary-btn" onClick={signOut}>
            {t('signOut')}
          </button>
        </section>
      ) : (
        <section className="card stack">
          <h2 className="card__title">{t('signInTitle')}</h2>
          <p className="muted">{t('otpHint')}</p>
          <form className="stack" onSubmit={step === 'email' ? signIn : verify}>
            <label className="field">
              <span className="field__label">{t('name')}</span>
              <input
                className="search-box__input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('yourName')}
              />
            </label>
            <label className="field">
              <span className="field__label">{t('email')}</span>
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
                <span className="field__label">{t('sixDigitCode')}</span>
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
              {busy ? t('pleaseWait') : step === 'email' ? t('sendCode') : t('verifyCode')}
            </button>
          </form>
        </section>
      )}
      <section className="card stack">
        <h2 className="card__title">{t('appearance')}</h2>
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
