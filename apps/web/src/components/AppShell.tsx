import { Link, NavLink, Outlet } from 'react-router-dom';

import { useLocale } from '../core/i18n/LocaleContext';
import { useTheme } from '../core/theme/ThemeContext';

function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 11l9-7 9 7h-2v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7H3z" />
      <rect x="10" y="14" width="4" height="5" rx="1" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppShell() {
  const { locale, setLocale, t } = useLocale();
  const { resolved, toggle } = useTheme();

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="app-bar__inner">
          <Link to="/" className="brand">
            <BrandMark />
            <span className="brand__name">{t('appTitle')}</span>
          </Link>
          <nav className="app-bar__nav" aria-label="Primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `app-bar__link${isActive ? ' app-bar__link--active' : ''}`
              }
            >
              {t('home')}
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `app-bar__link${isActive ? ' app-bar__link--active' : ''}`
              }
            >
              {t('settings')}
            </NavLink>
          </nav>
          <div className="app-bar__actions">
            <div className="segmented" role="group" aria-label="Language">
              <button
                type="button"
                className={`segmented__btn${locale === 'mr' ? ' segmented__btn--active' : ''}`}
                onClick={() => setLocale('mr')}
              >
                मराठी
              </button>
              <button
                type="button"
                className={`segmented__btn${locale === 'en' ? ' segmented__btn--active' : ''}`}
                onClick={() => setLocale('en')}
              >
                English
              </button>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={toggle}
              aria-label={resolved === 'dark' ? t('settingsThemeLight') : t('settingsThemeDark')}
              title={resolved === 'dark' ? t('settingsThemeLight') : t('settingsThemeDark')}
            >
              {resolved === 'dark' ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
