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
import { alertLateReports } from '../../report-late.js';
import { runCompetitorWatch } from '../../competitors.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  if (!requireCron(req, res)) return;
  try {
    /* The owners turned the "Tomorrow" push off; EVENING_DIARY=on brings it back. */
    const tomorrow = process.env.EVENING_DIARY === 'on' ? await alertDiary(1) : 'off';
    const partials = await alertPartials().catch((err) => ({ error: err.message }));
    /* The roofing forecast, fetched now so tomorrow's week board is instant. */
    const weather = await warmRoofing().catch((err) => ({ error: err.message }));
    const reports = await alertLateReports().catch((err) => ({ error: err.message }));
    /* Monthly: it does nothing until 28 days have passed since the last look. */
    const competitors = await runCompetitorWatch().catch((err) => ({ error: err.message }));
    json(res, 200, { ok: true, tomorrow, partials, weather, reports, competitors });
  } catch (err) {
    console.error('evening run failed:', err.message);
    json(res, 500, { ok: false, error: 'evening_failed' });
  }
}
