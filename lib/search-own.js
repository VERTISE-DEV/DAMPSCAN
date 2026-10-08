/**
 * Google search, from the site's own tracking: no Google account needed.
 *
 * Every page view is logged with its channel (lib/attribution.js), so visits
 * that arrived from a Google search, and from Google Ads, are already known,
 * with the page they landed on and whether that visit went on to call or
 * enquire. What this cannot know is the words people searched or where the
 * site ranked: Google removes the search terms before the visit arrives,
 * and only Search Console holds those (lib/search-console.js, optional).
 *
 * The last 28 days against the 28 before, per channel, and the landing pages
 * Google search visits start on, best first.
 */
import { query } from './db.js';

const N = (v) => Number(v) || 0;
const WINDOW = `(now() - interval '28 days')`;
const BEFORE = `(now() - interval '56 days')`;

export async function ownSearch(sites) {
  const totals = await query(
    `with s as (
       select session_id, channel, min(created_at) as first_at,
              bool_or(type = 'call_click') as called, bool_or(type = 'form_submit') as enquired
         from events
        where site = any($1::text[]) and created_at >= ${BEFORE} and channel in ('organic', 'paid')
        group by session_id, channel)
     select channel, (first_at >= ${WINDOW}) as recent, count(*) as visits,
            count(*) filter (where called) as calls, count(*) filter (where enquired) as enquiries
       from s group by channel, (first_at >= ${WINDOW})`, [sites]);
  const pages = await query(
    `with s as (
       select session_id,
              (array_agg(coalesce(landing_page, path) order by created_at) filter (where type = 'page_view'))[1] as landing,
              bool_or(type = 'form_submit') as enquired, bool_or(type = 'call_click') as called
         from events
        where site = any($1::text[]) and created_at >= ${WINDOW} and channel = 'organic'
        group by session_id)
     select landing, count(*) as visits, count(*) filter (where enquired) as enquiries, count(*) filter (where called) as calls
       from s where landing is not null group by landing order by count(*) desc limit 15`, [sites]);
  const pick = (channel, recent) => {
    const r = totals.find((t) => t.channel === channel && t.recent === recent) || {};
    return { visits: N(r.visits), calls: N(r.calls), enquiries: N(r.enquiries) };
  };
  return {
    organic: { now: pick('organic', true), before: pick('organic', false) },
    paid: { now: pick('paid', true), before: pick('paid', false) },
    pages: pages.map((p) => ({ page: String(p.landing).replace(/^https?:\/\/[^/]+/, '').split('?')[0] || '/', visits: N(p.visits), calls: N(p.calls), enquiries: N(p.enquiries) }))
  };
}
