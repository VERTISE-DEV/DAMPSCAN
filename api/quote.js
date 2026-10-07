/**
 * GET  /api/quote?t=<token>
 * POST /api/quote  {t, name, agree}     the customer accepts the quote
 *
 * The customer's view of one quote, found by the random token in the link
 * staff send them. It returns prices only: each line marked up, the net, VAT
 * and the total. Never a cost, the markup, an internal note or anybody's pay.
 *
 * A wrong or old token is a plain 404, so the endpoint cannot be used to
 * learn which quotes exist. Throttled per address for the same reason.
 *
 * Accepting takes the customer's typed name and a tick, and only while the
 * quote is open: still quoted, not withdrawn, within its thirty days and with
 * a price on it. The price is fixed at that moment, and the owner is told.
 */
import { query, queryOne } from '../lib/db.js';
import { json, requireMethod, ipHash, readJson, str } from '../lib/http.js';
import { notify } from '../lib/notify.js';
import { rateLimit, LIMITS } from '../lib/ratelimit.js';
import { loadQuoteLines } from '../lib/quote-store.js';
import { quoteTotals, spread } from '../lib/quote.js';
import { bpOf } from '../lib/splits.js';
import { brandFor } from '../lib/brands.js';

export const config = { runtime: 'nodejs' };

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const VALID_DAYS = 30;
const N = (v) => Number(v) || 0;

const isoDay = (v) => (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10);

async function findJob(token) {
  if (!TOKEN_RE.test(token || '')) return null;
  return queryOne(
    `select j.id, j.site, j.status, j.customer_name, j.customer_postcode, j.markup_bp, j.invoice_net_pence, j.created_at,
            j.quote_accepted_at, j.quote_accepted_name, b.vat_bp
       from jobs j join businesses b on b.slug = j.site where j.quote_token = $1`, [token]);
}

/** The customer's figures: prices per line, net, VAT and total. */
async function figures(job) {
  const rows = await loadQuoteLines(job.id);
  const totals = quoteTotals(rows.map((r) => ({ kind: r.kind, description: r.description, costPence: N(r.cost_pence) })),
    N(job.markup_bp), job.vat_bp == null ? 2000 : N(job.vat_bp));
  /* An accepted or booked job's agreed price stands even if lines were added
     afterwards, so the customer's lines are spread across that price. */
  const agreed = (job.status !== 'quoted' || job.quote_accepted_at) && rows.length > 0;
  const netPence = agreed ? N(job.invoice_net_pence) : totals.netPence;
  const prices = spread(netPence, rows.map((r) => N(r.cost_pence)));
  const lines = totals.customerLines.map((l, i) => ({ ...l, pricePence: prices[i] }));
  return { lines, netPence, vatBp: totals.vatBp, vatPence: bpOf(netPence, totals.vatBp) };
}

const expired = (job) => Date.now() - new Date(job.created_at).getTime() > (VALID_DAYS + 1) * 86400000;
const pounds = (p) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function accept(req, res) {
  const limit = await rateLimit({ ...LIMITS.quoteAccept, ipHash: ipHash(req) });
  if (!limit.ok) { json(res, 429, { ok: false, error: 'too_many_requests' }); return; }
  const body = await readJson(req);
  const job = await findJob(body.t);
  const brand = job && brandFor(job.site);
  if (!job || !brand) { json(res, 404, { ok: false, error: 'not_found' }); return; }
  const name = str(body.name, 80);
  if (!name || name.length < 2 || body.agree !== true) {
    json(res, 400, { ok: false, error: 'incomplete', message: 'Type your name and tick the box to accept.' });
    return;
  }
  const f = await figures(job);
  const open = job.status === 'quoted' && !job.quote_accepted_at && !expired(job) && f.netPence > 0;
  if (!open) { json(res, 409, { ok: false, error: 'not_open', message: 'This quote can no longer be accepted online. Please call us.' }); return; }
  /* One update, guarded on the same conditions, so two taps cannot accept twice. */
  const done = await queryOne(
    `update jobs set quote_accepted_at = now(), quote_accepted_name = $2, quote_accepted_ip_hash = $3, invoice_net_pence = $4, updated_at = now()
      where id = $1 and status = 'quoted' and quote_accepted_at is null returning id`, [job.id, name, ipHash(req), f.netPence]);
  if (!done) { json(res, 409, { ok: false, error: 'not_open', message: 'This quote has already been accepted.' }); return; }
  await notify({ business: job.site, kind: 'quote_accepted', ref: job.id, tags: 'white_check_mark',
    title: `${brand.name}: quote accepted`, message: `Job #${job.id}, ${pounds(f.netPence)} net, accepted online. Book a start date.` });
  json(res, 200, { ok: true });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    if (req.method === 'POST') return await accept(req, res);
    const limit = await rateLimit({ ...LIMITS.quote, ipHash: ipHash(req) });
    if (!limit.ok) { json(res, 429, { ok: false, error: 'too_many_requests' }); return; }

    const job = await findJob(new URL(req.url, 'http://localhost').searchParams.get('t') || '');
    const brand = job && brandFor(job.site);
    if (!job || !brand) { json(res, 404, { ok: false, error: 'not_found' }); return; }
    const { lines, netPence, vatBp, vatPence } = await figures(job);
    const withdrawn = ['declined', 'cancelled'].includes(job.status);
    const accepted = Boolean(job.quote_accepted_at) || ['booked', 'completed', 'paid'].includes(job.status);

    json(res, 200, {
      ok: true,
      brand: { name: brand.name, phone: brand.phone, phoneLabel: brand.phoneLabel, email: brand.email, origin: brand.origin },
      quote: {
        number: `Q-${job.id}`,
        issuedOn: isoDay(job.created_at),
        validDays: VALID_DAYS,
        withdrawn,
        accepted,
        acceptedOn: job.quote_accepted_at ? isoDay(job.quote_accepted_at) : null,
        acceptedName: job.quote_accepted_name || null,
        /* Open to accept online: what the page's accept form is shown for. */
        acceptable: job.status === 'quoted' && !accepted && !withdrawn && !expired(job) && netPence > 0,
        expired: job.status === 'quoted' && !accepted && expired(job),
        customerName: job.customer_name,
        customerPostcode: job.customer_postcode,
        lines,
        netPence,
        vatBp,
        vatPence,
        totalPence: netPence + vatPence
      }
    });
  } catch (err) {
    console.error('quote view failed:', err.message);
    json(res, 500, { ok: false, error: 'quote_failed' });
  }
}
