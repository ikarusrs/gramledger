import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../core/theme/ThemeContext';

const USER_KEY = 'gramledger:user';
type User = { email: string; name: string };

export function AccountScreen() {
  const { mode, setMode } = useTheme();
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  function signIn(event: FormEvent) {
    event.preventDefault();
    const next = { email: email.trim(), name: name.trim() || email.split('@')[0] };
    if (!next.email) return;
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  }
  function signOut() {
    localStorage.removeItem(USER_KEY);
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
          <div className="account-avatar">{user.name[0]?.toUpperCase()}</div>
          <h2 className="card__title">{user.name}</h2>
          <p className="muted">{user.email}</p>
          <button className="secondary-btn" onClick={signOut}>
            Sign out
          </button>
        </section>
      ) : (
        <section className="card stack">
          <h2 className="card__title">Sign in to save your villages and questions</h2>
          <p className="muted">
            This local MVP keeps your profile on this device. Production OTP authentication will
            connect to the API.
          </p>
          <form className="stack" onSubmit={signIn}>
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
            <button className="primary-btn">Continue</button>
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
