/**
 * The quote on a quoted-trade job: its lines, its markup, the price that
 * follows from them, and the changes staff can make.
 *
 * The rule that ties the quote to the job: while a job is still "quoted" and
 * has quote lines, its invoice is the quote's net price, recomputed on every
 * change. Once the customer says yes and the job is booked, the agreed price
 * stands; lines added later move the margin, not the price. A job with no
 * quote lines keeps whatever invoice was typed, so nothing that existed before
 * quotes is touched.
 */
import { randomBytes } from 'node:crypto';
import { query, queryOne } from './db.js';
import { str } from './http.js';
import { quoteTotals, QUOTE_KINDS } from './quote.js';
import { brandFor } from './brands.js';

const N = (v) => Number(v) || 0;

export const QUOTE_OPS = new Set(['qline', 'unqline', 'markup', 'quotelink', 'costsfromquote']);

export async function loadQuoteLines(jobId) {
  return query('select id, kind, description, cost_pence from quote_lines where job_id = $1 order by id', [jobId]);
}

/** The quote as staff see it: costs, markup and price together. */
export function presentQuote(job, business, rows) {
  const lines = rows.map((r) => ({ id: Number(r.id), kind: r.kind, description: r.description, costPence: N(r.cost_pence) }));
  const totals = quoteTotals(lines, N(job.markup_bp), business.vat_bp == null ? 2000 : N(business.vat_bp));
  const brand = brandFor(job.site);
  return {
    lines,
    ...totals,
    /* True while the invoice is being driven by these lines. */
    driving: job.status === 'quoted' && lines.length > 0,
    url: job.quote_token && brand ? `${brand.origin}/quote.html?t=${job.quote_token}` : null
  };
}

/** Puts the quote's net price on the invoice, if the quote is in charge of it. */
export async function syncQuotePrice(jobId, business) {
  const job = await queryOne('select id, status, markup_bp from jobs where id = $1', [jobId]);
  if (!job || job.status !== 'quoted') return;
  const rows = await loadQuoteLines(jobId);
  if (!rows.length) return;
  const { netPence } = quoteTotals(rows.map((r) => ({ kind: r.kind, costPence: N(r.cost_pence) })), N(job.markup_bp), N(business.vat_bp));
  await query('update jobs set invoice_net_pence = $2, updated_at = now() where id = $1 and invoice_net_pence is distinct from $2', [jobId, netPence]);
}

const fail = (json, res, key, message) => { json(res, 400, { ok: false, errors: { [key]: message } }); return false; };

/**
 * One quote change. Returns true when it was made, false when a response has
 * already been sent explaining why not.
 */
export async function quoteOp({ op, job, business, body, scope, res, json, pence }) {
  if (op === 'qline') {
    const kind = Object.hasOwn(QUOTE_KINDS, body.kind) ? body.kind : null;
    const description = str(body.description, 160);
    const cost = pence(body.costPence);
    if (!kind || !description || cost === null || Number.isNaN(cost) || cost < 0) {
      return fail(json, res, 'quote', 'A quote line needs a type, a description and what it costs in pounds.');
    }
    await query('insert into quote_lines (job_id, kind, description, cost_pence, added_by) values ($1, $2, $3, $4, $5)',
      [job.id, kind, description, cost, scope.personId]);
  } else if (op === 'unqline') {
    await query('delete from quote_lines where id = $1 and job_id = $2', [Number(body.lineId), job.id]);
  } else if (op === 'markup') {
    const bp = Math.round(Number(body.markupBp));
    if (!Number.isFinite(bp) || bp < 0 || bp > 100000) return fail(json, res, 'markup', 'Enter the markup as a percentage, 0 or more.');
    await query('update jobs set markup_bp = $2, updated_at = now() where id = $1', [job.id, bp]);
  } else if (op === 'quotelink') {
    /* Made once and kept, so a link already sent keeps working. Making it is
       the moment it is copied to go to the customer, so the follow-ups count
       from here unless a message recorded the quote going earlier. */
    await query('update jobs set quote_token = coalesce(quote_token, $2), quote_sent_at = coalesce(quote_sent_at, now()) where id = $1',
      [job.id, randomBytes(18).toString('base64url')]);
  } else if (op === 'costsfromquote') {
    /* Everything but labour, once each. Labour is paid as owners' days. */
    await query(
      `insert into job_costs (job_id, label, amount_pence, added_by, quote_line_id)
       select q.job_id, left(case q.kind when 'materials' then 'Materials' when 'scaffolding' then 'Scaffolding'
                                         when 'waste' then 'Waste and skip' else 'Other' end || ': ' || q.description, 80),
              q.cost_pence, $2, q.id
         from quote_lines q
        where q.job_id = $1 and q.kind <> 'labour'
          and not exists (select 1 from job_costs c where c.quote_line_id = q.id)`,
      [job.id, scope.personId]
    );
  }
  await syncQuotePrice(job.id, business);
  return true;
}
