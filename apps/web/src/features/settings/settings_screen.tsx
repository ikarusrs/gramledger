import { useLocale } from '../../core/i18n/LocaleContext';
import { useTheme } from '../../core/theme/ThemeContext';
import type { ThemeMode } from '../../core/theme/ThemeContext';

const THEME_OPTIONS: {
  mode: ThemeMode;
  labelKey: 'settingsThemeLight' | 'settingsThemeDark' | 'settingsThemeSystem';
}[] = [
  { mode: 'light', labelKey: 'settingsThemeLight' },
  { mode: 'dark', labelKey: 'settingsThemeDark' },
  { mode: 'system', labelKey: 'settingsThemeSystem' },
];

export function SettingsScreen() {
  const { locale, setLocale, t } = useLocale();
  const { mode, setMode } = useTheme();

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">{t('settings')}</h1>
      </header>

      <section className="card stack">
        <h2 className="card__title">{t('settingsLanguage')}</h2>
        <div className="segmented" role="group" aria-label={t('settingsLanguage')}>
          <button
            type="button"
            className={`segmented__btn${locale === 'mr' ? ' segmented__btn--active' : ''}`}
            onClick={() => setLocale('mr')}
          >
            {t('marathi')}
          </button>
          <button
            type="button"
            className={`segmented__btn${locale === 'en' ? ' segmented__btn--active' : ''}`}
            onClick={() => setLocale('en')}
          >
            {t('english')}
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2 className="card__title">{t('settingsAppearance')}</h2>
        <div className="segmented" role="group" aria-label={t('settingsAppearance')}>
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              className={`segmented__btn${mode === opt.mode ? ' segmented__btn--active' : ''}`}
              onClick={() => setMode(opt.mode)}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
