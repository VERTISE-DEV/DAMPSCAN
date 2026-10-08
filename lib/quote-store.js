/**
 * The quote on a quoted-trade job: its lines, its markup, the price that
 * follows from them, and the changes staff can make.
 *
 * The rule that ties the quote to the job: a price typed by hand is the
 * price. Once staff type one (or the customer accepts, or the job is
 * booked) the job is price_fixed, and quote lines added after that are
 * costs of the job: each non-labour line goes straight into its costs, once,
 * and the price does not move. Only a quoted job whose price has never been
 * typed lets its invoice follow the lines (costs plus markup), which is how a
 * quote is built up from nothing. "Use the lines' total" switches back.
 */
import { randomBytes } from 'node:crypto';
import { query, queryOne } from './db.js';
import { str } from './http.js';
import { quoteTotals, QUOTE_KINDS } from './quote.js';
import { bpOf } from './splits.js';
import { brandFor } from './brands.js';
import { effectiveVatBp, canInvoice, invoiceBlocker } from './business-details.js';

const N = (v) => Number(v) || 0;

export const QUOTE_OPS = new Set(['qline', 'unqline', 'markup', 'quotelink', 'costsfromquote', 'fromtemplate', 'invoice', 'pricefromlines']);

/** Whether the job's invoice is being driven by its quote lines. */
export const priceFollowsLines = (job) => !job.price_fixed && job.status === 'quoted' && !job.quote_accepted_at;

/* A quote line's cost as a job cost, linked so it is counted exactly once:
   the unique index on quote_line_id refuses a second copy. Labour is left
   out because the roofing owners are paid by days and profit counts clocked
   time; a labour cost as well would count it twice. */
const COPY_COSTS_SQL = `insert into job_costs (job_id, label, amount_pence, added_by, quote_line_id)
  select q.job_id, left(case q.kind when 'materials' then 'Materials' when 'scaffolding' then 'Scaffolding'
                                    when 'waste' then 'Waste and skip' else 'Other' end || ': ' || q.description, 80),
         q.cost_pence, $2, q.id
    from quote_lines q
   where q.job_id = $1 and q.kind <> 'labour' and ($3::bigint[] is null or q.id = any($3::bigint[]))
     and not exists (select 1 from job_costs c where c.quote_line_id = q.id)`;
export const invoiceNumber = (brand, n) => `${brand.invoicePrefix}-${String(n).padStart(4, '0')}`;

export async function loadQuoteLines(jobId) {
  return query('select id, kind, description, cost_pence from quote_lines where job_id = $1 order by id', [jobId]);
}

/** The quote as staff see it: costs, markup and price together. */
export function presentQuote(job, business, rows) {
  const lines = rows.map((r) => ({ id: Number(r.id), kind: r.kind, description: r.description, costPence: N(r.cost_pence) }));
  const totals = quoteTotals(lines, N(job.markup_bp), effectiveVatBp(business));
  const brand = brandFor(job.site);
  const driving = priceFollowsLines(job) && lines.length > 0;
  /* The price shown is the job's price. The lines' own total is kept beside
     it, so a fixed price and the costs under it are never confused. */
  const netPence = driving ? totals.netPence : N(job.invoice_net_pence);
  const vatPence = bpOf(netPence, totals.vatBp);
  return {
    lines,
    ...totals,
    linesNetPence: totals.netPence,
    netPence,
    vatPence,
    totalPence: netPence + vatPence,
    driving,
    fixed: Boolean(job.price_fixed),
    url: job.quote_token && brand ? `${brand.origin}/quote.html?t=${job.quote_token}` : null,
    accepted: job.quote_accepted_at ? { at: job.quote_accepted_at, name: job.quote_accepted_name } : null,
    /* Whether this business can issue invoices yet, and the invoice if issued. */
    canInvoice: canInvoice(business),
    invoiceBlocker: invoiceBlocker(business),
    vatRegistered: Boolean(business.vat_registered),
    invoice: job.invoice_number && brand ? {
      number: invoiceNumber(brand, job.invoice_number), issuedAt: job.invoiced_at, dueOn: job.invoice_due_on ? String(job.invoice_due_on instanceof Date ? job.invoice_due_on.toISOString() : job.invoice_due_on).slice(0, 10) : null,
      url: job.quote_token ? `${brand.origin}/invoice.html?t=${job.quote_token}` : null
    } : null
  };
}

/** Puts the quote's net price on the invoice, if the quote is in charge of it. */
export async function syncQuotePrice(jobId) {
  const job = await queryOne('select id, status, markup_bp, quote_accepted_at, price_fixed from jobs where id = $1', [jobId]);
  if (!job || !priceFollowsLines(job)) return;
  const rows = await loadQuoteLines(jobId);
  if (!rows.length) return;
  const { netPence } = quoteTotals(rows.map((r) => ({ kind: r.kind, costPence: N(r.cost_pence) })), N(job.markup_bp), 0);
  await query('update jobs set invoice_net_pence = $2, updated_at = now() where id = $1 and invoice_net_pence is distinct from $2', [jobId, netPence]);
}

/* Lines added under a fixed price are what the job costs, so they become its
   costs at once rather than waiting for "Copy costs". */
async function costNewLines(job, ids, scope) {
  if (priceFollowsLines(job) || !ids.length) return;
  await query(COPY_COSTS_SQL, [job.id, scope.personId, ids]);
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
    const row = await queryOne('insert into quote_lines (job_id, kind, description, cost_pence, added_by) values ($1, $2, $3, $4, $5) returning id',
      [job.id, kind, description, cost, scope.personId]);
    await costNewLines(job, [row.id], scope);
  } else if (op === 'unqline') {
    /* The line's cost goes with it, so a removed line is not still deducted. */
    await query('delete from job_costs where quote_line_id = $1 and job_id = $2', [Number(body.lineId), job.id]);
    await query('delete from quote_lines where id = $1 and job_id = $2', [Number(body.lineId), job.id]);
  } else if (op === 'pricefromlines') {
    /* Back to the lines: on a quote still open the price follows them again;
       on a booked or accepted job it is set to their total once and stays. */
    if (job.payout_frozen_at) return fail(json, res, 'quote', 'The payout is frozen. Reopen it before changing the price.');
    const rows = await loadQuoteLines(job.id);
    if (!rows.length) return fail(json, res, 'quote', 'Add quote lines first: there is no lines total to use.');
    const { netPence } = quoteTotals(rows.map((r) => ({ kind: r.kind, costPence: N(r.cost_pence) })), N(job.markup_bp), 0);
    await query(`update jobs set invoice_net_pence = $2, price_fixed = (status <> 'quoted' or quote_accepted_at is not null), updated_at = now() where id = $1`,
      [job.id, netPence]);
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
  } else if (op === 'invoice') {
    /* Issued once: the number comes from the business's own unbroken
       sequence, taken in the same statement that stamps the job, so two
       clicks cannot use two numbers. Reissuing only moves the due date. */
    if (!canInvoice(business)) return fail(json, res, 'invoice', invoiceBlocker(business));
    if (!['booked', 'completed', 'paid'].includes(job.status) || !(N(job.invoice_net_pence) > 0)) return fail(json, res, 'invoice', 'Invoice a job once it is booked and has a price.');
    const days = Number.isInteger(Number(body.dueDays)) && Number(body.dueDays) >= 0 && Number(body.dueDays) <= 120 ? Number(body.dueDays) : 14;
    await query(
      `with n as (update businesses set next_invoice = next_invoice + 1 where slug = $2
                    and exists (select 1 from jobs where id = $1 and invoice_number is null) returning next_invoice - 1 as num)
       update jobs set invoice_number = coalesce(jobs.invoice_number, (select num from n)), invoiced_at = coalesce(invoiced_at, now()),
              invoice_due_on = (coalesce(invoiced_at, now()) at time zone 'Europe/London')::date + $3::int,
              quote_token = coalesce(quote_token, $4), updated_at = now()
        where id = $1`, [job.id, job.site, days, randomBytes(18).toString('base64url')]);
  } else if (op === 'fromtemplate') {
    /* A template's lines are added to whatever is there, and its markup is
       used only if this quote has none yet, so applying one never overwrites
       work already done. The business check is in the query: a template id
       from another business adds nothing. */
    const t = await queryOne('select lines, markup_bp from quote_templates where id = $1 and business_slug = $2', [Number(body.templateId), job.site]);
    if (!t) return fail(json, res, 'template', 'That template could not be found.');
    const ids = [];
    for (const l of Array.isArray(t.lines) ? t.lines : []) {
      if (!Object.hasOwn(QUOTE_KINDS, l.kind) || !l.description || !(N(l.costPence) >= 0)) continue;
      const row = await queryOne('insert into quote_lines (job_id, kind, description, cost_pence, added_by) values ($1, $2, $3, $4, $5) returning id',
        [job.id, l.kind, String(l.description).slice(0, 160), N(l.costPence), scope.personId]);
      ids.push(row.id);
    }
    await costNewLines(job, ids, scope);
    if (t.markup_bp != null && !N(job.markup_bp)) await query('update jobs set markup_bp = $2 where id = $1', [job.id, t.markup_bp]);
  } else if (op === 'costsfromquote') {
    /* Everything but labour, once each. Labour is paid as owners' days. */
    await query(COPY_COSTS_SQL, [job.id, scope.personId, null]);
  }
  await syncQuotePrice(job.id);
  return true;
}
