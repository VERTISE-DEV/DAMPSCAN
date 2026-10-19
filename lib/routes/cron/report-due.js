/**
 * GET /api/cron/report-due
 *
 * Rings for survey reports past their 24 hours (lib/report-late.js). The
 * hosting plan runs its own schedules once a day, so this is called hourly
 * by the GitHub workflow report-due.yml; the morning and evening runs call
 * the same check too, in case that is not set up.
 */
import { json, requireMethod } from '../../http.js';
import { requireCron } from '../../cron-guard.js';
import { alertLateReports } from '../../report-late.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  if (!requireCron(req, res)) return;
  try {
    json(res, 200, { ok: true, ...(await alertLateReports()) });
  } catch (err) {
    console.error('report-due run failed:', err.message);
    json(res, 500, { ok: false, error: 'report_due_failed' });
  }
}
