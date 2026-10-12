import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { DemoBanner } from '../../components/DemoBanner';
import { LevelBadge } from '../../components/LevelBadge';
import { useLocale } from '../../core/i18n/LocaleContext';
import { getPanchayat } from '../../lib/api/endpoints';
import type { ApiResult } from '../../lib/api/endpoints';
import type { PanchayatDetail } from '../../lib/api/types';

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="profile-item">
      <div className="profile-item__label">{label}</div>
      <div className="profile-item__value">{value ?? '—'}</div>
    </div>
  );
}

export function PanchayatScreen() {
  const { id } = useParams();
  const { t } = useLocale();
  const [result, setResult] = useState<ApiResult<PanchayatDetail | undefined> | null>(null);

  useEffect(() => {
    if (id == null) return;
    setResult(null);
    getPanchayat(Number(id))
      .then(setResult)
      .catch((err) => console.error(err));
  }, [id]);

  if (result == null) {
    return <p className="muted">{t('loading')}</p>;
  }

  const detail = result.data;
  if (!detail) {
    return (
      <div className="page">
        <p className="muted">{t('searchNoResults')}</p>
        <Link to="/" className="link-back">
          ← {t('back')}
        </Link>
      </div>
    );
  }

  const profile = detail.profile;
  const detailId = detail.id;
  async function save() {
    const token = localStorage.getItem('gramledger:access-token');
    if (!token) return;
    await fetch('/v1/me/favorites', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ panchayatId: detailId }),
    });
  }

  return (
    <div className="page">
      {result.isMock && <DemoBanner />}

      <header className="page__head">
        <h1 className="page__title">
          {detail.nameMr} <span className="muted">({detail.nameEn})</span>
        </h1>
        <LevelBadge level={detail.level} />
      </header>

      <p className="page__subtitle">
        {detail.districtNameMr ?? detail.districtNameEn} ·{' '}
        {detail.talukaNameMr ?? detail.talukaNameEn}
      </p>
      <button className="secondary-btn" onClick={save}>
        {t('savePanchayat')}
      </button>

      <div className="card">
        <div className="profile-grid">
          <Field label={t('lgdCode')} value={detail.lgdCode} />
          <Field label={t('sarpanch')} value={profile.sarpanchName} />
          <Field label={t('secretary')} value={profile.secretaryName} />
          <Field label={t('contactPhone')} value={profile.contactPhone} />
        </div>
      </div>

      {profile.electedCommittee != null && profile.electedCommittee.length > 0 && (
        <div className="card">
          <h2 className="card__title">{t('electedCommittee')}</h2>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('role')}</th>
                  <th>{t('name')}</th>
                </tr>
              </thead>
              <tbody>
                {profile.electedCommittee.map((member, i) => (
                  <tr key={`${member.role}-${i}`}>
                    <td>{member.role}</td>
                    <td>{member.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="row">
        <Link to={`/panchayat/${detail.id}/finance`} className="btn btn--primary">
          {t('finance')}
        </Link>
        <Link to="/" className="link-back">
          ← {t('back')}
        </Link>
      </div>
    </div>
  );
}
