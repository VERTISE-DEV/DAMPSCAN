/**
 * GET /api/quote?t=<token>
 *
 * The customer's view of one quote, found by the random token in the link
 * staff send them. It returns prices only: each line marked up, the net, VAT
 * and the total. Never a cost, the markup, an internal note or anybody's pay.
 *
 * A wrong or old token is a plain 404, so the endpoint cannot be used to
 * learn which quotes exist. Throttled per address for the same reason.
 */
import { queryOne } from '../lib/db.js';
import { json, requireMethod, ipHash } from '../lib/http.js';
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

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    const limit = await rateLimit({ ...LIMITS.quote, ipHash: ipHash(req) });
    if (!limit.ok) { json(res, 429, { ok: false, error: 'too_many_requests' }); return; }

    const token = new URL(req.url, 'http://localhost').searchParams.get('t') || '';
    const job = TOKEN_RE.test(token)
      ? await queryOne(
          `select j.id, j.site, j.status, j.customer_name, j.customer_postcode, j.markup_bp, j.invoice_net_pence, j.created_at, b.vat_bp
             from jobs j join businesses b on b.slug = j.site where j.quote_token = $1`, [token])
      : null;
    const brand = job && brandFor(job.site);
    if (!job || !brand) { json(res, 404, { ok: false, error: 'not_found' }); return; }

    const rows = await loadQuoteLines(job.id);
    const totals = quoteTotals(rows.map((r) => ({ kind: r.kind, description: r.description, costPence: N(r.cost_pence) })),
      N(job.markup_bp), job.vat_bp == null ? 2000 : N(job.vat_bp));
    /* A booked job's agreed price stands even if lines were added after it
       was accepted, so the customer's lines are spread across that price. */
    const agreed = job.status !== 'quoted' && rows.length > 0;
    const netPence = agreed ? N(job.invoice_net_pence) : totals.netPence;
    const prices = spread(netPence, rows.map((r) => N(r.cost_pence)));
    const lines = totals.customerLines.map((l, i) => ({ ...l, pricePence: prices[i] }));
    const vatPence = bpOf(netPence, totals.vatBp);

    json(res, 200, {
      ok: true,
      brand: { name: brand.name, phone: brand.phone, phoneLabel: brand.phoneLabel, email: brand.email, origin: brand.origin },
      quote: {
        number: `Q-${job.id}`,
        issuedOn: isoDay(job.created_at),
        validDays: VALID_DAYS,
        withdrawn: ['declined', 'cancelled'].includes(job.status),
        accepted: ['booked', 'completed', 'paid'].includes(job.status),
        customerName: job.customer_name,
        customerPostcode: job.customer_postcode,
        lines,
        netPence,
        vatBp: totals.vatBp,
        vatPence,
        totalPence: netPence + vatPence
      }
    });
  } catch (err) {
    console.error('quote view failed:', err.message);
    json(res, 500, { ok: false, error: 'quote_failed' });
  }
}
