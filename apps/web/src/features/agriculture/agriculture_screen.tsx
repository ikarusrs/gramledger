import { useEffect, useState } from 'react';

type Weather = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    wind_speed_10m?: number;
  };
};
type Scheme = { nameMr: string; nameEn: string; description: string; source: string };
type CalendarItem = { crop: string; cropMr: string; sowing: string; harvest: string };
type Market = Record<string, string | number>;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error((await response.json()).error?.message ?? 'Request failed');
  return response.json();
}

export function AgricultureScreen() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      get<Weather>('/v1/weather?district=pune'),
      get<Scheme[]>('/v1/schemes'),
      get<{ seasons: CalendarItem[] }>('/v1/calendar'),
      get<{ records: Market[] }>('/v1/markets/prices?district=Pune').catch(() => ({ records: [] })),
    ])
      .then(([weatherResult, schemeResult, calendarResult, marketResult]) => {
        setWeather(weatherResult);
        setSchemes(schemeResult);
        setCalendar(calendarResult.seasons);
        setMarkets(marketResult.records);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load agriculture information'),
      );
  }, []);
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Field Notes</h1>
          <p className="page__subtitle">
            Weather, crop timing, and public schemes for Maharashtra farmers.
          </p>
        </div>
      </header>
      {error && <p className="form-error">{error}</p>}
      <section className="agri-lead">
        <span className="eyebrow">PUNE · TODAY</span>
        <h2>{weather?.current?.temperature_2m ?? '—'}°C</h2>
        <p>
          {weather
            ? `${weather.current?.relative_humidity_2m ?? '—'}% humidity · ${weather.current?.precipitation ?? 0} mm rain · ${weather.current?.wind_speed_10m ?? '—'} km/h wind`
            : 'Loading local conditions…'}
        </p>
      </section>
      <section className="data-section">
        <div className="section-heading">
          <span className="eyebrow">TODAY'S MARKET</span>
          <h2>Prices</h2>
        </div>
        <div className="data-list">
          {markets.length === 0 ? (
            <p className="muted">Market data is not configured yet.</p>
          ) : (
            markets.slice(0, 8).map((item, index) => (
              <div className="data-row" key={index}>
                <strong>{String(item.commodity ?? item.Commodity ?? 'Commodity')}</strong>
                <span>{String(item.market ?? item.Market ?? 'Pune')}</span>
                <span>Modal {String(item.modal_price ?? item.Modal_Price ?? '—')}</span>
                <span>₹ / quintal</span>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="data-section">
        <div className="section-heading">
          <span className="eyebrow">WHEN TO PLANT</span>
          <h2>Seasonal calendar</h2>
        </div>
        <div className="data-list">
          {calendar.map((item) => (
            <div className="data-row" key={item.crop}>
              <strong>{item.cropMr}</strong>
              <span>{item.crop}</span>
              <span>Sow {item.sowing}</span>
              <span>Harvest {item.harvest}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="data-section">
        <div className="section-heading">
          <span className="eyebrow">PUBLIC SUPPORT</span>
          <h2>Government schemes</h2>
        </div>
        <div className="scheme-list">
          {schemes.map((scheme) => (
            <a
              className="scheme-row"
              href={scheme.source}
              target="_blank"
              rel="noreferrer"
              key={scheme.nameEn}
            >
              <strong>{scheme.nameMr}</strong>
              <span>{scheme.nameEn}</span>
              <p>{scheme.description}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
