/**
 * GET /api/admin/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&area=|site=
 *
 * Everything with a date on it between two days: booked and finished work for
 * every trade, and service visits falling due. One list, so the calendar can
 * show a damp survey and a re-roof on the same day without asking twice.
 *
 * Scoped like every other list, and money is left out: a calendar shows who
 * is where, and the value of a job belongs to whoever manages the business.
 * A window is at most about two months, which is a month view with the edges
 * of the weeks either side, and keeps one request bounded.
 */
import { query } from '../../db.js';
import { json, requireMethod } from '../../http.js';
import { requireScope, requestedSites } from '../../access.js';

export const config = { runtime: 'nodejs' };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 70;
const day = (v) => (v == null ? null : String(v).slice(0, 10));

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  const url = new URL(req.url, 'http://localhost');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const span = ISO.test(from || '') && ISO.test(to || '') ? (Date.parse(to) - Date.parse(from)) / 86400000 : -1;
  if (span < 0 || span > MAX_DAYS) {
    json(res, 400, { ok: false, error: 'bad_range', message: `Ask for a from and to date, at most ${MAX_DAYS} days apart.` });
    return;
  }
  const sites = requestedSites(scope, url.searchParams);
  try {
    const jobs = await query(
      `select j.id, j.site, j.job_date::text as job_date, j.job_time, j.customer_name, j.customer_postcode, j.status, b.payout_model
         from jobs j join businesses b on b.slug = j.site
        where j.site = any($1::text[]) and j.job_date between $2::date and $3::date
          and j.status in ('booked', 'completed', 'paid')
        order by j.job_date, j.job_time nulls last, j.id limit 500`, [sites, from, to]);
    const services = await query(
      `select c.id, c.business_slug, c.job_id, c.next_due_on::text as next_due_on, c.customer_name, c.customer_postcode
         from service_contracts c
        where c.business_slug = any($1::text[]) and c.status = 'active' and c.next_due_on between $2::date and $3::date
        order by c.next_due_on, c.id limit 200`, [sites, from, to]);
    json(res, 200, {
      ok: true,
      from,
      to,
      events: [
        ...jobs.map((r) => ({
          kind: 'job', id: Number(r.id), site: r.site, date: day(r.job_date), time: r.job_time ? String(r.job_time).slice(0, 5) : null,
          customerName: r.customer_name, postcode: r.customer_postcode, status: r.status, quoted: r.payout_model !== 'damp'
        })),
        ...services.map((r) => ({
          kind: 'service', id: Number(r.id), jobId: r.job_id == null ? null : Number(r.job_id), site: r.business_slug, date: day(r.next_due_on),
          time: null, customerName: r.customer_name, postcode: r.customer_postcode, status: 'service due', quoted: true
        }))
      ]
    });
  } catch (err) {
    console.error('calendar request failed:', err.message);
    json(res, 500, { ok: false, error: 'calendar_failed' });
  }
}
