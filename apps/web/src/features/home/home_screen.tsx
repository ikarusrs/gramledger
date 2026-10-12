import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { DemoBanner } from '../../components/DemoBanner';
import { LevelBadge } from '../../components/LevelBadge';
import { localized, useLocale } from '../../core/i18n/LocaleContext';
import { getHierarchy, searchPanchayats } from '../../lib/api/endpoints';
import type { ApiResult } from '../../lib/api/endpoints';
import type { Hierarchy, Panchayat, SearchQuery } from '../../lib/api/types';

export function HomeScreen() {
  const { locale, t } = useLocale();
  const [hierarchy, setHierarchy] = useState<ApiResult<Hierarchy> | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [districtId, setDistrictId] = useState<number | undefined>(undefined);
  const [talukaId, setTalukaId] = useState<number | undefined>(undefined);
  const [results, setResults] = useState<ApiResult<Panchayat[]> | null>(null);

  useEffect(() => {
    getHierarchy()
      .then(setHierarchy)
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const q: SearchQuery = { q: debouncedQuery || undefined, districtId, talukaId };
    searchPanchayats(q)
      .then(setResults)
      .catch((err) => console.error(err));
  }, [debouncedQuery, districtId, talukaId]);

  const selectedDistrict = hierarchy?.data.districts.find((d) => d.id === districtId);
  const hasFilters = debouncedQuery !== '' || districtId != null || talukaId != null;
  const list = results?.data ?? [];

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">{t('homeTitle')}</h1>
        <p className="page__subtitle">{t('homeSubtitle')}</p>
      </header>

      {hierarchy?.isMock === true && <DemoBanner />}

      <div className="search-box">
        <input
          className="search-box__input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
        />
      </div>

      <div className="filters">
        <div className="field">
          <label className="field__label" htmlFor="district">
            {t('district')}
          </label>
          <select
            id="district"
            className="field__select"
            value={districtId ?? ''}
            onChange={(e) => {
              setDistrictId(e.target.value === '' ? undefined : Number(e.target.value));
              setTalukaId(undefined);
            }}
          >
            <option value="">{t('allDistricts')}</option>
            {hierarchy?.data.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {localized(d.nameMr, d.nameEn, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="taluka">
            {t('taluka')}
          </label>
          <select
            id="taluka"
            className="field__select"
            value={talukaId ?? ''}
            disabled={selectedDistrict == null}
            onChange={(e) =>
              setTalukaId(e.target.value === '' ? undefined : Number(e.target.value))
            }
          >
            <option value="">{t('allTalukas')}</option>
            {selectedDistrict?.talukas.map((tk) => (
              <option key={tk.id} value={tk.id}>
                {localized(tk.nameMr, tk.nameEn, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!hasFilters ? (
        <p className="muted">{t('searchEmpty')}</p>
      ) : (
        <>
          {list.length === 0 ? (
            <p className="muted">{t('searchNoResults')}</p>
          ) : (
            <ul className="list" aria-label={t('results')}>
              {list.map((p) => (
                <li key={p.id}>
                  <Link to={`/panchayat/${p.id}`} className="list__item">
                    <span className="list__item-main">
                      <span className="list__item-title">
                        {localized(p.nameMr, p.nameEn, locale)}
                      </span>
                      <span className="list__item-sub">
                        {localized(p.districtNameMr, p.districtNameEn, locale)} ·{' '}
                        {localized(p.talukaNameMr, p.talukaNameEn, locale)} ·{' '}
                        <span className="mono">{p.lgdCode}</span>
                      </span>
                    </span>
                    <LevelBadge level={p.level} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
