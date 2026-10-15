/**
 * The price and surveyor fee of a damp job, from what was typed or the rate
 * card. Split from lib/routes/admin/jobs.js to keep that file under the line
 * limit, and because the assistant says survey types the way people say them
 * ("Localised", "full house") rather than as rate card keys.
 */
import { query } from './db.js';
import { str } from './http.js';

const pence = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded < 0 ? null : rounded;
};

const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** A rate card row matching a key or label, ignoring case, spaces and hyphens. */
export async function findRate(said) {
  const rates = await query('select key, label, price_pence, surveyor_fee_pence from job_rates order by position, key');
  const want = squash(said);
  return { rate: rates.find((r) => squash(r.key) === want || squash(r.label) === want) || null, rates };
}

/** Resolve price and surveyor fee: an explicit figure wins, else the rate card. */
export async function resolveAmounts(body) {
  const said = str(body.surveyType, 60) || null;
  let price = pence(body.surveyPricePence);
  let fee = pence(body.surveyorFeePence);
  let type = null;

  if (said) {
    const { rate, rates } = await findRate(said);
    if (!rate) {
      return { error: { surveyType: `Unknown survey type "${said}". The survey types are: ${rates.map((r) => `${r.label} (${r.key})`).join(', ')}.` } };
    }
    type = rate.key;
    if (price == null) price = rate.price_pence;
    if (fee == null) fee = rate.surveyor_fee_pence;
  }

  if (price == null) return { error: { surveyPricePence: 'Enter a survey price.' } };
  if (fee == null) fee = 0;
  return { type, price, fee };
}

/**
 * The phone, email and deposit tick a damp job save may carry. Each is
 * written only when it was sent, so the Jobs page form, which has no such
 * fields, never wipes what the client card or the assistant stored. The
 * checks are the quoted-trade route's own.
 */
export function contactFrom(body, isNew) {
  const columns = [];
  const values = [];
  const errors = {};
  if (body.customerPhone !== undefined) {
    const phone = str(body.customerPhone, 30) || null;
    if (phone && !/^[\d\s+()-]{7,}$/.test(phone)) errors.customerPhone = 'Enter the phone number in digits.';
    columns.push('customer_phone'); values.push(phone);
  }
  if (body.customerEmail !== undefined) {
    const email = str(body.customerEmail, 160) || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.customerEmail = 'That email address does not look right.';
    columns.push('customer_email'); values.push(email);
  }
  /* Only a new job: an edit leaves the tick to the client card, which keeps
     the time it was first ticked. */
  if (isNew && body.depositPaid === true) { columns.push('deposit_paid_at'); values.push(new Date().toISOString()); }
  return Object.keys(errors).length ? { errors } : { columns, values };
}
