/**
 * The automatic statement feed from Revolut Business, built ready and off.
 *
 * It needs four settings in Vercel, from Revolut Business's API settings
 * (Settings > APIs > Business API), and then ticking on the Bank page:
 *
 *   REVOLUT_CLIENT_ID       the API certificate's client ID
 *   REVOLUT_PRIVATE_KEY     the private key the certificate was made from (PEM)
 *   REVOLUT_REFRESH_TOKEN   from authorising the certificate once
 *   REVOLUT_ISSUER          the domain given as the redirect URI, e.g. dampscan.co.uk
 *   REVOLUT_ACCOUNTS        which account feeds which books, as JSON:
 *                           {"damp":"<account id>","roofing":"<account id>"}
 *
 * Each morning, with the digest, every switched-on set of books fetches the
 * last few days' completed transactions and imports them exactly as an
 * uploaded statement would be: same matching, same rules, and nothing stored
 * twice, because a line's fingerprint is Revolut's own transaction id, which
 * is also what the CSV export carries.
 */
import { createSign } from 'node:crypto';
import { query, queryOne } from '../db.js';
import { importRows } from './import.js';
import { listBooks } from './books.js';

const API = 'https://b2b.revolut.com/api/1.0';
const TIMEOUT_MS = 15000;
const OVERLAP_DAYS = 3;
const FIRST_DAYS = 30;

const env = (k) => (process.env[k] || '').trim();
export const revolutConfigured = () => ['REVOLUT_CLIENT_ID', 'REVOLUT_PRIVATE_KEY', 'REVOLUT_REFRESH_TOKEN', 'REVOLUT_ISSUER', 'REVOLUT_ACCOUNTS'].every((k) => env(k));

function accounts() {
  try { return JSON.parse(env('REVOLUT_ACCOUNTS')) || {}; } catch { return {}; }
}

const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');

/** The signed client assertion Revolut asks for alongside the refresh token. */
export function clientAssertion(nowSeconds = Math.floor(Date.now() / 1000)) {
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({ iss: env('REVOLUT_ISSUER'), sub: env('REVOLUT_CLIENT_ID'), aud: 'https://revolut.com', exp: nowSeconds + 300 });
  const signer = createSign('RSA-SHA256');
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(env('REVOLUT_PRIVATE_KEY').replace(/\\n/g, '\n')).toString('base64url')}`;
}

async function accessToken() {
  const res = await fetch(`${API}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: env('REVOLUT_REFRESH_TOKEN'), client_id: env('REVOLUT_CLIENT_ID'),
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: clientAssertion()
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`Revolut sign-in refused (${res.status})`);
  return (await res.json()).access_token;
}

const pence = (v) => Math.round(Number(v || 0) * 100);
const londonDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

/**
 * Revolut's transactions as the rows the CSV reader produces, for one
 * account. Only completed GBP lines; anything else is counted as skipped,
 * the same as on an upload.
 */
export function rowsFrom(transactions, accountId) {
  const rows = [];
  const skipped = { pending: 0, notGbp: 0, unreadable: 0 };
  for (const t of transactions) {
    for (const leg of t.legs || []) {
      if (leg.account_id !== accountId) continue;
      if (t.state !== 'completed') { skipped.pending += 1; continue; }
      if (leg.currency !== 'GBP') { skipped.notGbp += 1; continue; }
      const when = t.completed_at || t.created_at;
      const fee = pence(leg.fee);
      rows.push({
        externalId: (t.legs.length > 1 ? `${t.id}:${leg.leg_id}` : t.id),
        postedOn: londonDay(when),
        postedTime: new Date(when).toLocaleTimeString('en-GB', { timeZone: 'Europe/London' }),
        type: String(t.type || '').toUpperCase(),
        description: leg.description || (t.merchant && t.merchant.name) || '',
        reference: t.reference || null,
        counterparty: (leg.counterparty && leg.counterparty.name) || (t.merchant && t.merchant.name) || null,
        mcc: t.merchant && t.merchant.category_code ? String(t.merchant.category_code) : null,
        currency: 'GBP',
        amountPence: pence(leg.amount) - fee,
        feePence: fee,
        balancePence: leg.balance == null ? null : pence(leg.balance),
        account: accountId
      });
    }
  }
  return { rows, skipped };
}

/** Runs every switched-on feed. Never throws: a failure is recorded on its books. */
export async function syncFeeds() {
  if (!revolutConfigured()) return { ran: 0 };
  const enabled = await query('select books, last_synced_at from bank_feeds where enabled');
  if (!enabled.length) return { ran: 0 };
  const all = await query('select slug from businesses where active');
  const books = await listBooks({ isAdmin: true, businesses: all.map((r) => r.slug) });
  const map = accounts();
  let token;
  const out = [];
  for (const feed of enabled) {
    const b = books.find((x) => x.key === feed.books);
    const account = map[feed.books];
    try {
      if (!b || !account) throw new Error('No Revolut account is set for these books in REVOLUT_ACCOUNTS.');
      token = token || await accessToken();
      const since = feed.last_synced_at ? new Date(new Date(feed.last_synced_at).getTime() - OVERLAP_DAYS * 86400000) : new Date(Date.now() - FIRST_DAYS * 86400000);
      const res = await fetch(`${API}/transactions?account=${encodeURIComponent(account)}&from=${since.toISOString()}&count=1000`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!res.ok) throw new Error(`Revolut answered ${res.status}`);
      const result = await importRows(rowsFrom(await res.json(), account), 'Revolut feed', b);
      await query('update bank_feeds set last_synced_at = now(), last_error = null, updated_at = now() where books = $1', [feed.books]);
      out.push({ books: feed.books, added: result.added, matched: result.matched });
    } catch (err) {
      console.warn(`revolut feed for ${feed.books} failed:`, err.message);
      await query('update bank_feeds set last_error = $2, updated_at = now() where books = $1', [feed.books, String(err.message).slice(0, 300)]);
      out.push({ books: feed.books, error: err.message });
    }
  }
  return { ran: out.length, feeds: out };
}
