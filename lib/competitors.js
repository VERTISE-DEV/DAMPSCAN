/**
 * Competitor watch. Once a month (from the evening run), each competitor's
 * public sitemap is read and every page in it remembered with the day it was
 * first seen. New pages say what they are going after ("damp proofing
 * Maidstone"); the owners get one alert, and the assistant's competitor_watch
 * sets those beside our own Google positions from Search Console.
 *
 * Only the sitemap a site publishes for search engines is read, plus the
 * title of at most a few new pages; nothing behind a login, nothing scraped
 * from Google itself.
 */
import { query, queryOne } from './db.js';
import { notify } from './notify.js';

export const COMPETITORS = [
  { name: 'The Damp Group', host: 'thedampgroup.co.uk', business: 'dampscan' }
];
const MAX_URLS = 3000;
const TITLES = 15;

async function text(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'DampScan competitor watch (monthly sitemap check)' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}
const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));

/** Every page address in a site's sitemap, following one level of sitemap index. */
export async function sitemapUrls(host) {
  const top = await text(`https://${host}/sitemap.xml`);
  let urls = locs(top);
  if (/<sitemapindex/i.test(top)) {
    const children = urls.slice(0, 20);
    urls = [];
    for (const c of children) { try { urls.push(...locs(await text(c))); } catch { /* one broken child map is not the month's check */ } }
  }
  return [...new Set(urls)].filter((u) => { try { return new URL(u).hostname.endsWith(host); } catch { return false; } }).slice(0, MAX_URLS);
}

/* "https://x.co.uk/damp-proofing/maidstone/" to "damp proofing maidstone". */
export const slugWords = (u) => { try { return decodeURIComponent(new URL(u).pathname).replace(/[/_-]+/g, ' ').replace(/\.\w+$/, '').trim() || 'home page'; } catch { return u; } };

async function titleOf(url) {
  try { const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(await text(url)); return m ? m[1].trim().replace(/&amp;/g, '&') : null; } catch { return null; }
}

export async function checkCompetitor(c) {
  let urls;
  try { urls = await sitemapUrls(c.host); } catch (err) {
    await query('insert into competitor_checks (host, error) values ($1, $2)', [c.host, String(err.message).slice(0, 200)]);
    return { host: c.host, error: err.message };
  }
  const first = !(await queryOne('select 1 from competitor_pages where host = $1 limit 1', [c.host]));
  const fresh = await query(
    `insert into competitor_pages (host, url) select $1, u from unnest($2::text[]) u
     on conflict (host, url) do update set last_seen = now() returning url, (xmax = 0) as inserted`, [c.host, urls]);
  /* The first look sees everything as new; only later months mean anything. */
  const added = first ? [] : fresh.filter((r) => r.inserted).map((r) => r.url);
  for (const u of added.slice(0, TITLES)) {
    const t = await titleOf(u);
    if (t) await query('update competitor_pages set title = $3 where host = $1 and url = $2', [c.host, u, t]);
  }
  await query('insert into competitor_checks (host, pages, new_pages) values ($1, $2, $3)', [c.host, urls.length, added.length]);
  if (added.length) {
    await notify({ business: c.business, kind: 'competitor', ref: null, tags: 'eyes', priority: 3, path: '/dashboard.html',
      title: `${c.name}: ${added.length} new page${added.length === 1 ? '' : 's'} this month`,
      message: added.slice(0, 5).map(slugWords).join(', ') + (added.length > 5 ? ', and more. Ask ChatGPT for the competitor watch.' : '.') });
  }
  return { host: c.host, pages: urls.length, added: added.length, first };
}

/** Each competitor not checked in the last 28 days. */
export async function runCompetitorWatch() {
  const out = [];
  for (const c of COMPETITORS) {
    const last = await queryOne(`select 1 from competitor_checks where host = $1 and checked_at > now() - interval '28 days' and error is null`, [c.host]);
    if (!last) out.push(await checkCompetitor(c));
  }
  return out;
}
