/**
 * Who pays for whom, remembered from the matches people make.
 *
 * A landlord or an agent pays for several customers' jobs from one account,
 * and a customer's partner often pays from theirs. Once somebody matches a
 * payer to a customer, that pairing is kept, and the next payment from the
 * same payer scores strongly for that customer's open job (lib/bank/match.js).
 */
import { query, queryOne } from '../db.js';
import { payerKey, customerKey } from './match.js';

export async function loadPayers(books) {
  const rows = await query('select payer_key, customer_key from bank_payers where books = $1', [books.key]);
  return new Set(rows.map((r) => `${r.payer_key}|${r.customer_key}`));
}

/** Remembers that this line's payer paid for this job's customer. */
export async function rememberPayer(books, tx, jobId) {
  const job = await queryOne(
    `select j.customer_name, l.first_name from jobs j left join leads l on l.id = j.lead_id where j.id = $1`, [jobId]);
  if (!job) return;
  const payer = payerKey({ counterparty: tx.counterparty, description: tx.description });
  const customer = customerKey({ customerName: job.customer_name, firstName: job.first_name });
  if (!payer || !customer) return;
  await query('insert into bank_payers (books, payer_key, customer_key) values ($1, $2, $3) on conflict do nothing', [books.key, payer, customer]);
}
