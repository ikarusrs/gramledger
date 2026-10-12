import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DemoBanner } from '../../components/DemoBanner';
import { localized, useLocale } from '../../core/i18n/LocaleContext';
import { getPanchayatFinance } from '../../lib/api/endpoints';
import type { ApiResult } from '../../lib/api/endpoints';
import type { PanchayatFinance } from '../../lib/api/types';
import { formatInr, formatInrCompact } from '../../lib/format';

export function FinanceScreen() {
  const { id } = useParams();
  const { locale, t } = useLocale();
  const [result, setResult] = useState<ApiResult<PanchayatFinance> | null>(null);
  const [fy, setFy] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (id == null) return;
    setResult(null);
    getPanchayatFinance(Number(id), fy)
      .then((res) => {
        setResult(res);
        if (fy == null) setFy(res.data.fy);
      })
      .catch((err) => console.error(err));
  }, [id, fy]);

  if (result == null) {
    return <p className="muted">{t('loading')}</p>;
  }

  const { data } = result;
  const summary = data.summary;
  const chartData = summary.byScheme.map((s) => ({
    name: s.scheme.nameMr,
    grants: s.grants,
    expenditure: s.expenditure,
  }));

  return (
    <div className="page">
      {result.isMock && <DemoBanner />}

      <div className="row">
        <Link to={`/panchayat/${id}`} className="link-back">
          ← {t('back')}
        </Link>
        <div className="field">
          <label className="field__label" htmlFor="fy">
            {t('fy')}
          </label>
          <select
            id="fy"
            className="field__select"
            value={fy ?? ''}
            onChange={(e) => setFy(Number(e.target.value))}
          >
            {data.availableFys.map((y) => (
              <option key={y} value={y}>
                {y}–{String(y + 1).slice(2)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="summary-grid">
        <div className="card stat-card">
          <div className="stat-card__label">{t('totalGrants')}</div>
          <div className="stat-card__value stat-card__value--positive">
            {formatInr(summary.totalGrants)}
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-card__label">{t('totalExpenditure')}</div>
          <div className="stat-card__value stat-card__value--negative">
            {formatInr(summary.totalExpenditure)}
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-card__label">{t('balance')}</div>
          <div className="stat-card__value">{formatInr(summary.balance)}</div>
        </div>
      </div>

      <div className="chart-card">
        <h2 className="card__title">{t('schemeWise')}</h2>
        <div className="legend">
          <span>
            <span className="legend__dot" style={{ background: '#2e7d32' }} />
            {t('grants')}
          </span>
          <span>
            <span className="legend__dot" style={{ background: '#ef6c00' }} />
            {t('expenditure')}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis tickFormatter={(v) => formatInrCompact(Number(v))} width={80} />
            <Tooltip formatter={(value) => formatInr(Number(value))} />
            <Legend wrapperStyle={{ display: 'none' }} />
            <Bar dataKey="grants" name={t('grants')} fill="#2e7d32" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="expenditure"
              name={t('expenditure')}
              fill="#ef6c00"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2 className="card__title">{t('schemeWise')}</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('scheme')}</th>
                <th align="right">{t('grants')}</th>
                <th align="right">{t('expenditure')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.byScheme.map((s) => (
                <tr key={s.scheme.code}>
                  <td>
                    {s.scheme.nameMr}
                    <br />
                    <span className="muted">{s.scheme.nameEn}</span>
                  </td>
                  <td align="right" className="mono">
                    {formatInr(s.grants)}
                  </td>
                  <td align="right" className="mono">
                    {formatInr(s.expenditure)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card__title">{t('grants')}</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('scheme')}</th>
                <th>{t('source')}</th>
                <th align="right">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.grants.map((g, i) => (
                <tr key={`${g.scheme.code}-${i}`}>
                  <td>{localized(g.scheme.nameMr, g.scheme.nameEn, locale)}</td>
                  <td>{g.source}</td>
                  <td align="right" className="mono">
                    {formatInr(g.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card__title">{t('expenditure')}</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('scheme')}</th>
                <th>{t('head')}</th>
                <th align="right">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.expenditures.map((e, i) => (
                <tr key={`${e.scheme.code}-${e.head}-${i}`}>
                  <td>{localized(e.scheme.nameMr, e.scheme.nameEn, locale)}</td>
                  <td>{e.head}</td>
                  <td align="right" className="mono">
                    {formatInr(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
