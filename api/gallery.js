/**
 * GET /api/gallery?site=roofing        the brand's "Our work" page, as HTML
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
import { shells, MARKER } from '../lib/generated/gallery-shells.js';
import { brandFor } from '../lib/brands.js';
import { galleries } from '../content/gallery.js';

export const config = { runtime: 'nodejs' };

/* Fewer than this and the page is too thin to ask Google to index. */
const INDEX_FROM = 3;

async function page(res, site) {
  const shell = shells[site];
  const brand = brandFor(site);
  if (!shell || !brand) return json(res, 404, { ok: false, error: 'not_found' });
  const rows = await query(
    `select id, job_id, stage, public_caption, area_label, width, height, path_thumb, published_at
       from job_photos where site = $1 and public order by published_at desc, id limit 240`, [site]);
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
    return await page(res, url.searchParams.get('site'));
  } catch (err) {
    console.error('gallery request failed:', err.message);
    json(res, 500, { ok: false, error: 'gallery_failed' });
  }
}
