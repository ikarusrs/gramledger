import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../config';
import { serviceUnavailable } from '../../lib/errors';

const districtQuery = z.object({ district: z.string().trim().max(80).optional() });
const marketQuery = districtQuery.extend({ commodity: z.string().trim().max(80).optional() });
const DISTRICTS: Record<string, { lat: number; lon: number }> = {
  nashik: { lat: 20.01, lon: 73.78 },
  pune: { lat: 18.52, lon: 73.86 },
  nagpur: { lat: 21.15, lon: 79.09 },
  aurangabad: { lat: 19.88, lon: 75.34 },
  kolhapur: { lat: 16.7, lon: 74.24 },
};

export const agricultureRouter = new Hono<AppEnv>();

agricultureRouter.get('/weather', zValidator('query', districtQuery), async (c) => {
  const district = c.req.valid('query').district?.toLowerCase() ?? 'pune';
  const point = DISTRICTS[district] ?? { lat: 18.52, lon: 73.86 };
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(point.lat));
  url.searchParams.set('longitude', String(point.lon));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
  );
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  );
  url.searchParams.set('timezone', 'Asia/Kolkata');
  const response = await fetch(url);
  if (!response.ok) throw serviceUnavailable('Weather is temporarily unavailable');
  const weather = (await response.json()) as Record<string, unknown>;
  return c.json({ district, ...weather });
});

agricultureRouter.get('/markets/prices', zValidator('query', marketQuery), async (c) => {
  const { district, commodity } = c.req.valid('query');
  const key = c.env.DATA_GOV_API_KEY;
  const resource = c.env.DATA_GOV_MARKET_RESOURCE;
  if (!key || !resource) throw serviceUnavailable('Market prices are not configured');
  const url = new URL(`https://api.data.gov.in/resource/${resource}`);
  url.searchParams.set('api-key', key);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '50');
  if (district) url.searchParams.set('filters[district]', district);
  if (commodity) url.searchParams.set('filters[commodity]', commodity);
  const response = await fetch(url);
  if (!response.ok) throw serviceUnavailable('Market prices are temporarily unavailable');
  const payload = (await response.json()) as { records?: unknown[] };
  return c.json({ records: payload.records ?? [] });
});

agricultureRouter.get('/schemes', (c) =>
  c.json([
    {
      code: 'pm-kisan',
      nameMr: 'प्रधानमंत्री किसान सन्मान निधी',
      nameEn: 'PM-KISAN',
      description: 'Income support for eligible landholding farmer families.',
      source: 'https://pmkisan.gov.in/',
    },
    {
      code: 'pmfby',
      nameMr: 'प्रधानमंत्री पीक विमा योजना',
      nameEn: 'Pradhan Mantri Fasal Bima Yojana',
      description: 'Crop insurance against notified risks and losses.',
      source: 'https://pmfby.gov.in/',
    },
    {
      code: 'kcc',
      nameMr: 'किसान क्रेडिट कार्ड',
      nameEn: 'Kisan Credit Card',
      description: 'Short-term credit for cultivation and allied activities.',
      source: 'https://www.india.gov.in/',
    },
  ]),
);

agricultureRouter.get('/calendar', zValidator('query', districtQuery), (c) =>
  c.json({
    district: c.req.valid('query').district ?? 'Maharashtra',
    seasons: [
      { crop: 'Cotton', cropMr: 'कापूस', sowing: 'June–July', harvest: 'October–January' },
      { crop: 'Soybean', cropMr: 'सोयाबीन', sowing: 'June–July', harvest: 'September–October' },
      { crop: 'Onion', cropMr: 'कांदा', sowing: 'June–August', harvest: 'October–February' },
      { crop: 'Wheat', cropMr: 'गहू', sowing: 'November–December', harvest: 'February–March' },
    ],
  }),
);
