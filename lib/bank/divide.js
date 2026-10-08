/**
 * Two more changes to a bank line, kept out of the bank route for length:
 *
 *   divide  one payment covering several jobs (a landlord paying for two
 *           surveys at once) becomes several lines, one per part, which are
 *           then matched like any other. The parts must add back to the
 *           payment exactly, so the bank's own total never moves.
 *   feed    switch the automatic Revolut import on or off for these books.
 */
import { query, queryOne } from '../db.js';
import { writeAllocation } from './store.js';
import { shares } from './allocate.js';
import { syncPayments } from './ledger.js';
import { revolutConfigured } from './revolut.js';

const CARRY = ['statement_id', 'external_id', 'posted_on', 'posted_time', 'type', 'description', 'reference', 'counterparty',
  'mcc', 'currency', 'fee_pence', 'balance_pence', 'rule_key', 'books'];

export async function divideLine(books, body) {
  const tx = await queryOne('select * from bank_transactions where id = $1 and books = $2', [Number(body.id), books.key]);
  if (!tx) return { status: 404, error: 'not_found' };
  const parts = (Array.isArray(body.parts) ? body.parts : []).map((p) => Math.round(Number(p)));
  const total = Number(tx.amount_pence);
  if (!(total > 0)) return { status: 400, errors: { divide: 'Only money in can be divided between jobs.' } };
  if (parts.length < 2 || parts.some((p) => !(p > 0)) || parts.reduce((s, p) => s + p, 0) !== total) {
    return { status: 400, errors: { divide: `The parts must each be more than nothing and add up to £${(total / 100).toFixed(2)}.` } };
  }
  const targets = books.targets.map((t) => t.key);
  const before = tx.job_id == null ? null : Number(tx.job_id);
  /* The first part stays on the line; each other part is a new line beside
     it, with the same date and payer and a fingerprint of its own. */
  await query('update bank_transactions set amount_pence = $2 where id = $1', [tx.id, parts[0]]);
  await writeAllocation(Number(tx.id), { category: 'income', categoryKind: 'manual', split: [], splitKind: 'manual', shares: shares(parts[0], [], targets), jobId: null, matchKind: null });
  const ids = [Number(tx.id)];
  for (let i = 1; i < parts.length; i += 1) {
    const row = await queryOne(
      `insert into bank_transactions (${CARRY.join(', ')}, fingerprint, amount_pence, category, category_kind, split_kind, shares)
       select ${CARRY.join(', ')}, fingerprint || '#part' || $2, $3, 'income', 'manual', 'manual', '{}'::jsonb from bank_transactions where id = $1
       returning id`, [tx.id, `${Date.now()}-${i}`, parts[i]]);
    ids.push(Number(row.id));
  }
  if (before) await syncPayments(books, [before], 'recompute');
  return { status: 200, ids };
}

export async function feedSetting(books, body) {
  if (typeof body.enabled !== 'boolean') return { status: 400, error: 'bad_request' };
  if (body.enabled && !revolutConfigured()) return { status: 400, errors: { feed: 'Add the Revolut Business API keys in Vercel first; see the note on this page.' } };
  await query(`insert into bank_feeds (books, enabled) values ($1, $2)
               on conflict (books) do update set enabled = excluded.enabled, updated_at = now()`, [books.key, body.enabled]);
  return { status: 200 };
}

export async function feedStatus(books) {
  const row = await queryOne('select enabled, last_synced_at, last_error from bank_feeds where books = $1', [books.key]);
  return { configured: revolutConfigured(), enabled: Boolean(row && row.enabled), lastSyncedAt: row ? row.last_synced_at : null, lastError: row ? row.last_error : null };
}
