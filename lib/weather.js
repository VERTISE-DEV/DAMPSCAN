/**
 * The forecast for a roofing job: rain or wind worth a warning in the next
 * week, from Open-Meteo (free, no key) with postcodes.io turning the postcode
 * into a place. Both are free services, so this asks as little as it can:
 * one forecast per postcode, kept in weather_cache for WEATHER_HOURS and
 * shared by the week board, the pipeline and the evening run.
 *
 * Nothing here may hold a page up. Every outside call has a short timeout,
 * the whole lookup has a budget, and a failure is simply "no forecast": the
 * card shows no icon rather than an error. A postcode that failed is not
 * asked again for a few minutes, so a down service is not hammered.
 */
import { query } from './db.js';

export const WEATHER_HOURS = 6;
/* A roofer's thresholds: a likely wet day, or gusts that make a roof unsafe
   for loose tiles and sheeting. */
export const RAIN_CHANCE = 60;
export const RAIN_MM = 3;
export const GUST_MPH = 35;
const CALL_MS = 2500;
const RETRY_MS = 10 * 60 * 1000;
const failed = new Map();

const key = (pc) => String(pc || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function getJson(url) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), CALL_MS);
  try {
    const res = await fetch(url, { signal: abort.signal, headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Weather code to a word and an icon a phone can show. */
export function describe(code) {
  const c = Number(code);
  if (c >= 95) return ['Thunder', '⛈'];
  if (c >= 71 && c <= 86 && !(c >= 80 && c <= 82)) return ['Snow', '❄'];
  if (c >= 51) return ['Rain', '🌧'];
  if (c >= 45) return ['Fog', '🌫'];
  if (c >= 2) return ['Cloud', '☁'];
  return ['Dry', '☀'];
}

/** One day's forecast, with the warning a roofer would want. */
export function dayFrom(date, code, chance, mm, gust) {
  const [word, icon] = describe(code);
  const wet = Number(chance) >= RAIN_CHANCE || Number(mm) >= RAIN_MM;
  const windy = Number(gust) >= GUST_MPH;
  return {
    date, word, icon: windy && !wet ? '💨' : icon, rainChance: chance == null ? null : Number(chance),
    rainMm: mm == null ? null : Number(mm), gustMph: gust == null ? null : Math.round(Number(gust)),
    warn: wet && windy ? 'rain and wind' : wet ? 'rain' : windy ? 'wind' : null
  };
}

/** Open-Meteo's daily block as a list of days. */
export function parseForecast(data) {
  const d = data && data.daily;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((date, i) => dayFrom(date, d.weather_code?.[i], d.precipitation_probability_max?.[i], d.precipitation_sum?.[i], d.wind_gusts_10m_max?.[i]));
}

async function fetchFor(postcode) {
  const pc = encodeURIComponent(postcode);
  let place = await getJson(`https://api.postcodes.io/postcodes/${pc}`);
  let r = place && place.result;
  /* A part postcode, or one just retired, still has a district centre. */
  if (!r) { place = await getJson(`https://api.postcodes.io/outcodes/${encodeURIComponent(postcode.slice(0, -3) || postcode)}`); r = place && place.result; }
  if (!r || r.latitude == null) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${r.latitude}&longitude=${r.longitude}`
    + '&daily=weather_code,precipitation_probability_max,precipitation_sum,wind_gusts_10m_max&wind_speed_unit=mph&timezone=Europe%2FLondon&forecast_days=8';
  const days = parseForecast(await getJson(url));
  return days.length ? days : null;
}

/**
 * Forecasts for these postcodes, as a Map of tidy postcode to days. Cached
 * ones come straight from the table; the rest are fetched together within
 * `budgetMs`, and anything slower is left out this time.
 */
export async function forecasts(postcodes, { budgetMs = 3000, fetchMissing = true } = {}) {
  const want = [...new Set(postcodes.map(key).filter((p) => p.length >= 2))];
  const out = new Map();
  if (!want.length) return out;
  let rows = [];
  try {
    rows = await query(`select postcode, days, fetched_at > now() - interval '${WEATHER_HOURS} hours' as fresh from weather_cache where postcode = any($1::text[])`, [want]);
  } catch { return out; }
  const stale = [];
  for (const r of rows) out.set(r.postcode, r.days);
  for (const p of want) if (!rows.some((r) => r.postcode === p && r.fresh)) stale.push(p);
  const now = Date.now();
  const ask = fetchMissing ? stale.filter((p) => !(failed.get(p) > now - RETRY_MS)) : [];
  if (!ask.length) return out;
  const work = Promise.all(ask.map(async (p) => {
    try {
      const days = await fetchFor(p);
      if (!days) { failed.set(p, Date.now()); return; }
      out.set(p, days);
      await query(`insert into weather_cache (postcode, days) values ($1, $2::jsonb)
                   on conflict (postcode) do update set days = excluded.days, fetched_at = now()`, [p, JSON.stringify(days)]);
    } catch { failed.set(p, Date.now()); }
  }));
  await Promise.race([work, new Promise((r) => setTimeout(r, budgetMs))]);
  return out;
}

/** The forecast for one postcode on one day, or null. */
export function dayOf(map, postcode, date) {
  const days = map.get(key(postcode));
  return (days && days.find((d) => d.date === date)) || null;
}

export { key as weatherKey };

/**
 * Fetches the coming week's forecast for every Verge job on, or about to go
 * on, a roof, so the first person to open the week board in the morning
 * does not wait for it. Run from the evening cron; best effort.
 */
export async function warmRoofing() {
  const rows = await query(`select distinct customer_postcode as pc from jobs
     where site = 'roofing' and status = 'booked' and customer_postcode is not null
       and job_date between (now() at time zone 'Europe/London')::date - 14 and (now() at time zone 'Europe/London')::date + 7`);
  const got = await forecasts(rows.map((r) => r.pc), { budgetMs: 8000 });
  return { postcodes: rows.length, forecasts: got.size };
}
