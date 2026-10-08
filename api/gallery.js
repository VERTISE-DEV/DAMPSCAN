/**
 * GET /api/gallery?site=roofing        the brand's "Our work" page, as HTML
 * GET /api/gallery?site=roofing&job=SLUG  one finished job's own page
 * GET /api/gallery?site=roofing&sitemap=1 the sitemap of those job pages
 * GET /api/gallery?site=roofing&near=BR,DA  recent job pages there, as JSON,
 *                                      for the regional pages to link to
 * GET /api/gallery?img=ID&size=thumb   one published photograph
 *
 * middleware.js serves the page at /our-work on the brand's own domain. It is
 * rendered here rather than at build time because staff publish photographs
 * from the staff area, and a page that needed a rebuild for every photo would
 * never be up to date. The frame around the photos is still built with the
 * rest of the site (scripts/gallery-template.js), so the nav and the assets
 * match every other page.
 *
 * Only photos marked public are ever served, page or file, and only with the
 * caption and town staff typed for them. The CDN caches both: the page for a
 * few minutes, so a newly published photo appears soon, and the files for a
 * day, since a photo's bytes never change once it is stored.
 */
import { query, queryOne } from '../lib/db.js';
import { json, requireMethod } from '../lib/http.js';
import { sendPhoto, PHOTO_SIZES } from '../lib/photos.js';
import { itemsHtml, gallerySchema } from '../lib/gallery.js';
import { shells, MARKER, jobShells, JOB_TOKENS, regionLinks } from '../lib/generated/gallery-shells.js';
import { isLive, jobBody, jobSchemas, description, headline, pageUrl, regionFor, LIVE_SQL } from '../lib/job-pages.js';
import { brandFor } from '../lib/brands.js';
import { galleries } from '../content/gallery.js';

export const config = { runtime: 'nodejs' };

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* Fewer than this and the page is too thin to ask Google to index. */
const INDEX_FROM = 3;

async function page(res, site) {
  const shell = shells[site];
  const brand = brandFor(site);
  if (!shell || !brand) return json(res, 404, { ok: false, error: 'not_found' });
  const rows = await query(
    `select p.id, p.job_id, p.stage, p.public_caption, p.area_label, p.width, p.height, p.path_thumb, p.published_at,
            case when ${LIVE_SQL} then j.page_slug end as page_slug
       from job_photos p join jobs j on j.id = p.job_id
      where p.site = $1 and p.public order by p.published_at desc, p.id limit 240`, [site]);
  let html = shell.replace(MARKER, itemsHtml(rows, galleries[site].empty));
  const head = [];
  if (rows.length) head.push(`<script type="application/ld+json">${gallerySchema(rows, brand.origin, brand.name)}</script>`);
  if (rows.length < INDEX_FROM) head.push('<meta name="robots" content="noindex, follow" />');
  if (head.length) html = html.replace('</head>', `${head.join('\n')}\n</head>`);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.end(html);
}

const CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
const missing = (res) => { res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'public, s-maxage=300'); res.end('Not found'); };
const JOB_COLS = 'j.id, j.status, j.page_publish, j.page_slug, j.page_title, j.page_town, j.page_district, j.page_writeup, j.page_published_at';

/* One finished job's page: the generated frame, filled with what staff wrote
   for it and its public photos. Gone (404) the moment it stops qualifying. */
async function jobPage(res, site, slug) {
  const shell = jobShells[site];
  const brand = brandFor(site);
  if (!shell || !brand || !/^[a-z0-9-]{1,160}$/.test(slug)) return missing(res);
  const job = await queryOne(`select ${JOB_COLS} from jobs j where j.site = $1 and j.page_slug = $2`, [site, slug]);
  const photos = job ? await query('select id, stage, public_caption, width, height, path_thumb from job_photos where job_id = $1 and public order by id', [job.id]) : [];
  if (!isLive(job, photos.length)) return missing(res);
  const url = pageUrl(brand.origin, job);
  const fill = { [JOB_TOKENS.title]: esc(`${headline(job)} | ${brand.name}`), [JOB_TOKENS.description]: esc(description(job)), [JOB_TOKENS.url]: esc(url),
    [JOB_TOKENS.body]: jobBody(job, photos, regionFor(regionLinks[site], job.page_district), '/our-work') };
  let html = shell;
  for (const [token, value] of Object.entries(fill)) html = html.split(token).join(value);
  html = html.replace('</head>', () => `${jobSchemas(job, photos, brand, url, '/our-work').map((s) => `<script type="application/ld+json">${s}</script>`).join('\n')}\n</head>`);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', CACHE);
  res.end(html);
}

async function liveJobs(site, limit) {
  return query(`select ${JOB_COLS}, (select max(p.published_at) from job_photos p where p.job_id = j.id and p.public) as photo_at
       from jobs j where j.site = $1 and ${LIVE_SQL} and exists (select 1 from job_photos p where p.job_id = j.id and p.public)
      order by j.page_published_at desc nulls last, j.id desc limit ${Number(limit)}`, [site]);
}

/* The job pages, as a sitemap of their own: the static sitemaps are written
   at build time and cannot know them. robots.txt lists this one too. */
async function sitemap(res, site) {
  const brand = brandFor(site);
  if (!jobShells[site] || !brand) return missing(res);
  const jobs = await liveJobs(site, 5000);
  const day = (d) => new Date(d || Date.now()).toISOString().slice(0, 10);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${jobs.map((j) => `  <url>
    <loc>${esc(pageUrl(brand.origin, j))}</loc>
    <lastmod>${day(j.page_published_at)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')}
</urlset>
`);
}

/* Recent job pages in some postcode areas, for a regional page to list. */
async function near(res, site, areas) {
  const wanted = String(areas).toUpperCase().split(/[\s,]+/).filter((a) => /^[A-Z]{1,2}$/.test(a)).slice(0, 12);
  const jobs = jobShells[site] && wanted.length ? await liveJobs(site, 200) : [];
  const hits = jobs.filter((j) => wanted.includes((String(j.page_district || '').match(/^[A-Z]+/) || [''])[0])).slice(0, 8);
  res.setHeader('Cache-Control', CACHE);
  json(res, 200, { ok: true, jobs: hits.map((j) => ({ href: `/our-work/${j.page_slug}`, title: headline(j) })) });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const url = new URL(req.url, 'http://localhost');
  try {
    const img = Number(url.searchParams.get('img'));
    if (img) {
      const size = PHOTO_SIZES.includes(url.searchParams.get('size')) ? url.searchParams.get('size') : 'thumb';
      const photo = await queryOne('select path_full, path_thumb from job_photos where id = $1 and public', [img]);
      const path = photo && (size === 'thumb' ? photo.path_thumb || photo.path_full : photo.path_full);
      if (!path) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, s-maxage=300'); res.end(); return; }
      return await sendPhoto(res, path, 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    }
    const site = url.searchParams.get('site');
    if (url.searchParams.get('job')) return await jobPage(res, site, url.searchParams.get('job'));
    if (url.searchParams.get('sitemap')) return await sitemap(res, site);
    if (url.searchParams.get('near')) return await near(res, site, url.searchParams.get('near'));
    return await page(res, site);
  } catch (err) {
    console.error('gallery request failed:', err.message);
    json(res, 500, { ok: false, error: 'gallery_failed' });
  }
}
