import { useLocale } from '../core/i18n/LocaleContext';
import type { MessageKey } from '../core/i18n/messages';
import type { PanchayatLevel } from '../lib/api/types';

const LABELS: Record<PanchayatLevel, MessageKey> = {
  gram: 'gram',
  block: 'block',
  district: 'districtLevel',
};

export function LevelBadge({ level }: { level: PanchayatLevel }) {
  const { t } = useLocale();
  return <span className="badge">{t(LABELS[level])}</span>;
}
