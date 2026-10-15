/**
 * GET /api/admin/due?site=
 *
 * What needs doing, across every business the viewer may see, in the order
 * a morning goes: enquiries nobody has turned into a job, the visits today
 * and this week, quotes out with no answer, services falling due, money
 * owed, payouts ready to freeze, and frozen figures that have drifted. Each row carries enough to
 * act on and a link to where the action is. Messages to send sit at the top:
 * quote follow-ups, tomorrow's reminders and review requests, each ready to
 * go in one tap: the "how did we do" ask and its one chase, and the yearly
 * check a year after the work.
 *
 * Everything is scoped in SQL, like every other list. A worker sees their
 * business's rows; the money sections need manage or admin, because a
 * worker's view of a job stops at their own payout.
 */
import { json, requireMethod } from '../../http.js';
import { requireScope, requestedSites } from '../../access.js';
import { messages, enquiries, visits, quotes, services, owed, payouts } from '../../due-sections.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  const url = new URL(req.url, 'http://localhost');
  const sites = requestedSites(scope, url.searchParams);
  /* Money is for whoever manages the business, or an admin. */
  const moneySites = sites.filter((s) => scope.isAdmin || scope.levels[s] === 'manage');
  try {
    const [m, e, v, q, sv, o, p] = await Promise.all([messages(sites), enquiries(sites), visits(sites), quotes(sites), services(sites), owed(moneySites), payouts(moneySites)]);
    json(res, 200, { ok: true, sites, money: moneySites.length > 0, messages: m, enquiries: e, visits: v, quotes: q, services: sv, owed: o, ready: p.ready, drifted: p.drifted });
  } catch (err) {
    console.error('due request failed:', err.message);
    json(res, 500, { ok: false, error: 'due_failed' });
  }
}
