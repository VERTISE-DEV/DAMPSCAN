/**
 * GET /api/cron/evening
 *
 * The evening run, on the schedule in vercel.json (17:00 UTC, so 6pm in
 * summer and 5pm in winter, and the plan may start it any time in that hour).
 * Tells each business what is booked for tomorrow, while there is still time
 * to ring a customer or load the van, and catches any half-finished forms
 * from the day. Both are stamped, so a second run sends nothing. It also
 * fetches the week's forecast for Verge's booked roofs (lib/weather.js).
 */
import { json, requireMethod } from '../../http.js';
import { requireCron } from '../../cron-guard.js';
import { alertDiary, alertPartials } from '../../daily-alerts.js';
import { warmRoofing } from '../../weather.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  if (!requireCron(req, res)) return;
  try {
    const tomorrow = await alertDiary(1);
    const partials = await alertPartials().catch((err) => ({ error: err.message }));
    /* The roofing forecast, fetched now so tomorrow's week board is instant. */
    const weather = await warmRoofing().catch((err) => ({ error: err.message }));
    json(res, 200, { ok: true, tomorrow, partials, weather });
  } catch (err) {
    console.error('evening run failed:', err.message);
    json(res, 500, { ok: false, error: 'evening_failed' });
  }
}
