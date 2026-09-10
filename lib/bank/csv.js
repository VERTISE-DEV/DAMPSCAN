/**
 * Reading a Revolut statement export.
 *
 * Revolut Business and Revolut personal produce different CSVs, and Revolut
 * has renamed columns before, so nothing here depends on position. The header
 * row is read, each field the importer needs is found by trying its known
 * names in turn, and a file that lacks a date, an amount or a description is
 * refused as not a statement rather than imported as nonsense.
 *
 * One line becomes one transaction with a signed net amount in whole pence.
 * Revolut lists a card fee in its own column and, on Business exports, a
 * "Total amount" that includes it. The balance moves by the total, so that is
 * what is kept: the money that actually left. Pending, declined and reverted
 * lines are skipped, because a pending line can still change or vanish and
 * would be imported again, differently, next month.
 */
import { createHash } from 'node:crypto';

/** Plain RFC 4180: quoted fields, doubled quotes, CR LF or LF, optional BOM. */
export function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/* Every name a field has been seen under, most specific first. The London
   timestamp is preferred over UTC because it is the day on the statement. */
const NAMES = {
  completed: ['date completed (europe/london)', 'date completed (uk)', 'completed date', 'date completed'],
  started: ['date started (europe/london)', 'date started (uk)', 'started date', 'date started (utc)', 'date started', 'date'],
  completedUtc: ['date completed (utc)'],
  id: ['id', 'transaction id'],
  type: ['type'],
  state: ['state', 'status'],
  description: ['description', 'details'],
  reference: ['reference', 'payment reference'],
  counterparty: ['payer', 'counterparty', 'beneficiary', 'beneficiary name', 'name'],
  card: ['card label', 'card name'],
  mcc: ['mcc'],
  amount: ['amount'],
  total: ['total amount'],
  fee: ['fee'],
  currency: ['payment currency', 'currency'],
  balance: ['balance'],
  account: ['account', 'account name']
};

function columnIndex(header) {
  const names = header.map((h) => String(h || '').trim().toLowerCase());
  const index = {};
  for (const [key, aliases] of Object.entries(NAMES)) {
    const at = aliases.map((a) => names.indexOf(a)).find((i) => i !== -1);
    index[key] = at === undefined ? -1 : at;
  }
  return index;
}

/** "1,234.56", "-12.30", "−12.30" and " 5 " all to whole pence; null if not a number. */
export function toPence(value) {
  const cleaned = String(value == null ? '' : value).replace(/−/g, '-').replace(/[\s,£$€]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** "2026-08-01 09:12:33" or "01/08/2026 09:12" to ['2026-08-01', '09:12:33']. */
export function splitDate(value) {
  const s = String(value || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/.exec(s);
  if (m) return [`${m[1]}-${m[2]}-${m[3]}`, m[4] || null];
  m = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/.exec(s);
  if (m) return [`${m[3]}-${m[2]}-${m[1]}`, m[4] || null];
  return [null, null];
}

const clean = (v) => {
  const s = String(v == null ? '' : v).trim();
  return s ? s : null;
};

/**
 * The lines of a statement as transactions, plus what was left out and why.
 * Returns {error} when the file is not recognisably a statement.
 */
export function revolutRows(text) {
  const table = parseCsv(text);
  if (table.length < 2) return { error: 'empty' };
  const at = columnIndex(table[0]);
  if (at.amount === -1 || at.description === -1 || (at.completed === -1 && at.started === -1 && at.completedUtc === -1)) {
    return { error: 'not_a_statement' };
  }

  const cell = (row, key) => (at[key] === -1 ? null : row[at[key]]);
  const rows = [];
  const skipped = { pending: 0, notGbp: 0, unreadable: 0 };

  for (const row of table.slice(1)) {
    const state = String(cell(row, 'state') || 'COMPLETED').trim().toUpperCase();
    if (state !== 'COMPLETED') { skipped.pending += 1; continue; }

    const currency = String(cell(row, 'currency') || 'GBP').trim().toUpperCase();
    if (currency !== 'GBP') { skipped.notGbp += 1; continue; }

    const [postedOn, postedTime] = splitDate(cell(row, 'completed') || cell(row, 'completedUtc') || cell(row, 'started'));
    const amount = toPence(cell(row, 'amount'));
    const fee = toPence(cell(row, 'fee')) || 0;
    const total = toPence(cell(row, 'total'));
    if (!postedOn || amount === null) { skipped.unreadable += 1; continue; }

    rows.push({
      externalId: clean(cell(row, 'id')),
      postedOn,
      postedTime,
      type: clean(cell(row, 'type'))?.toUpperCase() || null,
      description: clean(cell(row, 'description')) || '',
      reference: clean(cell(row, 'reference')),
      counterparty: clean(cell(row, 'counterparty')),
      card: clean(cell(row, 'card')),
      mcc: clean(cell(row, 'mcc')),
      currency,
      // The net effect on the balance. Revolut's fee is a positive figure
      // taken on top of the amount, so it is subtracted whichever way the
      // amount points.
      amountPence: total === null ? amount - fee : total,
      feePence: fee,
      balancePence: toPence(cell(row, 'balance')),
      account: clean(cell(row, 'account'))
    });
  }

  return { rows, skipped, columns: Object.keys(at).filter((k) => at[k] !== -1) };
}

/**
 * The identity of a line across uploads. Revolut Business gives every line an
 * ID; the personal export does not, so there the date, amount, description and
 * running balance stand in. The balance is what separates two identical
 * payments on the same day.
 */
export function fingerprint(tx) {
  const parts = tx.externalId
    ? ['id', tx.externalId, tx.currency, tx.amountPence]
    : ['line', tx.postedOn, tx.amountPence, tx.description, tx.reference || '', tx.balancePence ?? ''];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
