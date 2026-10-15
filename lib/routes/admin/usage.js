/**
 * /api/admin/usage
 *
 *   POST  {page, area?}   one staff page view, sent once per page load by shell.js
 *   GET   ?days=30        the most used pages, for an admin on Insights
 *
 * The point is to learn which screens people actually reach for, so the staff
 * area can be shaped around them. It records who (the person, or the owners'
 * shared code), which page, which company area and when. Never an IP, a
 * device or anything typed on the page.
 */
import { query } from '../../db.js';
import { json, requireMethod, readJson } from '../../http.js';
import { requireScope, requireAdmin } from '../../access.js';

export const config = { runtime: 'nodejs' };

const PAGE = /^[a-z0-9-]{1,40}\.html$/;
const AREAS = ['damp', 'roofing', 'ac'];

/** The top pages over the last `days`, with how many people used each. */
export async function mostUsed(days = 30) {
  const rows = await query(
    `select v.page, v.area, count(*)::int as views,
            count(distinct coalesce(v.person_id::text, case when v.owners then 'owners' end))::int as people,
            max(v.viewed_at) as last_at
       from staff_page_views v
      where v.viewed_at >= now() - ($1::int * interval '1 day')
      group by v.page, v.area order by views desc, v.page limit 25`, [days]);
  return rows.map((r) => ({ page: r.page, area: r.area, views: r.views, people: r.people, lastAt: r.last_at }));
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    if (req.method === 'GET') {
      if (!requireAdmin(scope, res)) return;
      const days = Math.min(Math.max(Number(new URL(req.url, 'http://localhost').searchParams.get('days')) || 30, 1), 365);
      return json(res, 200, { ok: true, days, pages: await mostUsed(days) });
    }
    const body = await readJson(req);
    const page = String(body.page || '').toLowerCase();
    if (!PAGE.test(page)) return json(res, 400, { ok: false, error: 'bad_page' });
    const area = AREAS.includes(body.area) ? body.area : null;
    await query('insert into staff_page_views (person_id, owners, page, area) values ($1, $2, $3, $4)', [scope.personId, scope.personId == null, page, area]);
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('usage request failed:', err.message);
    return json(res, 500, { ok: false, error: 'usage_failed' });
  }
}
