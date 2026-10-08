/**
 * The customer's "how did we do" page, served through /api/quote so it adds
 * no function of its own (see api/quote.js).
 *
 * Google does not allow a business to steer only its happy customers to a
 * review ("review gating"). So the Google link is offered to everyone on the
 * page, whatever they pick: five stars goes straight to it, and one to four
 * stars opens a private box to tell us what could be better, with the same
 * Google link still underneath. The stars and any words are kept against the
 * job, and the owner is told; a low score is flagged for the morning digest.
 *
 * The link's key is the job's rating_token, separate from the quote's, so a
 * rating link cannot open a quote or an invoice and a quote link cannot rate.
 */
import { queryOne } from './db.js';
import { json, ipHash, str } from './http.js';
import { notify } from './notify.js';
import { rateLimit, LIMITS } from './ratelimit.js';
import { brandFor } from './brands.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
/* Three stars or fewer is somebody unhappy enough to ring back. */
export const LOW_STARS = 3;

async function findJob(token) {
  if (!TOKEN_RE.test(token || '')) return null;
  return queryOne(
    `select j.id, j.site, j.status, j.customer_name, r.stars, r.comment
       from jobs j left join job_ratings r on r.job_id = j.id where j.rating_token = $1`, [token]);
}

const firstName = (name) => {
  const w = String(name || '').trim().split(/\s+/).filter((x) => !/^(mr|mrs|ms|miss|mx|dr)\.?$/i.test(x));
  return w[0] || null;
};

export async function ratingPage(req, res) {
  const job = await findJob(new URL(req.url, 'http://localhost').searchParams.get('t') || '');
  const brand = job && brandFor(job.site);
  if (!job || !brand) { json(res, 404, { ok: false, error: 'not_found' }); return; }
  json(res, 200, {
    ok: true,
    brand: { name: brand.name, phone: brand.phone, phoneLabel: brand.phoneLabel, email: brand.email, origin: brand.origin, reviewUrl: brand.reviewUrl || null },
    rating: { firstName: firstName(job.customer_name), stars: job.stars == null ? null : Number(job.stars), commented: Boolean(job.comment) }
  });
}

export async function rate(req, res, body) {
  const limit = await rateLimit({ ...LIMITS.quoteAccept, bucket: 'rate', ipHash: ipHash(req) });
  if (!limit.ok) { json(res, 429, { ok: false, error: 'too_many_requests' }); return; }
  const job = await findJob(body.t);
  const brand = job && brandFor(job.site);
  if (!job || !brand) { json(res, 404, { ok: false, error: 'not_found' }); return; }
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    json(res, 400, { ok: false, error: 'incomplete', message: 'Pick a number of stars.' });
    return;
  }
  const comment = str(body.comment, 2000) || null;
  /* Answering again replaces the stars; a comment, once written, is kept
     unless a new one replaces it, so the star tap that follows cannot wipe it. */
  const saved = await queryOne(
    `insert into job_ratings (job_id, stars, comment) values ($1, $2, $3)
     on conflict (job_id) do update set stars = excluded.stars, comment = coalesce(excluded.comment, job_ratings.comment), created_at = now()
     returning (xmax = 0) as fresh`, [job.id, stars, comment]);
  /* Told once for the stars and once more if words follow, not on every tap. */
  if (saved.fresh || (comment && comment !== job.comment)) {
    const low = stars <= LOW_STARS;
    await notify({ business: job.site, kind: low ? 'rating_low' : 'rating', ref: job.id, tags: low ? 'warning' : 'star',
      title: `${brand.name}: ${stars} star${stars === 1 ? '' : 's'}`,
      message: `Job #${job.id} was rated ${stars} out of 5${comment ? ', with a comment to read' : ''}.` });
  }
  json(res, 200, { ok: true, stars, reviewUrl: brand.reviewUrl || null });
}
