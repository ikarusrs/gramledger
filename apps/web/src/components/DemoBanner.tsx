import { useLocale } from '../core/i18n/LocaleContext';

/** Shown whenever data comes from the demo fixtures instead of the API. */
export function DemoBanner() {
  const { t } = useLocale();
  return (
    <div className="demo-banner" role="status">
      {t('demoBanner')}
    </div>
  );
}
