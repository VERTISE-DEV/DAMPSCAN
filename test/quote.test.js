/**
 * Quotes built from costs and a markup.
 *
 * The arithmetic first: a net price that is the costs plus the markup, VAT on
 * top, and customer lines that add back to the net price to the penny. Then
 * the route: the price follows the lines while a job is quoted and stands once
 * it is booked, labour is never copied into the payout's costs, and the
 * customer's link shows prices and nothing else.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'quote-test-secret-long-enough-xxxxx';
process.env.IP_SALT = 'quote-test-salt';
process.env.STAFF_ACCESS_CODE = '1290';

const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
mock.module('../lib/db.js', {
  namedExports: {
    sql: () => { throw new Error('not used'); },
    query: async (t, p = []) => (await pool.query(t, p)).rows,
    queryOne: async (t, p = []) => { const { rows } = await pool.query(t, p); return rows[0] || null; },
    ping: async () => true
  }
});

const { quoteTotals, spread } = await import('../lib/quote.js');
const login = (await import('../lib/routes/auth/login.js')).default;
const quoted = (await import('../lib/routes/admin/quoted.js')).default;
const publicQuote = (await import('../api/quote.js')).default;

const P = (pounds) => Math.round(pounds * 100);
function makeReq({ method = 'POST', url = '/api/admin/quoted', body, headers = {} } = {}) {
  return { method, url, body, headers: { host: 'vergeroofing.com', 'x-forwarded-for': '203.0.113.7', 'user-agent': 't', ...headers }, socket: { remoteAddress: '203.0.113.7' } };
}
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; }, end(p) { this.body = p; } };
  res.json = () => (res.body ? JSON.parse(res.body) : null);
  return res;
}
async function call(handler, init) { const req = makeReq(init); const res = makeRes(); await handler(req, res); return res; }
async function signedIn() {
  const h = await hash('scott-code', { algorithm: Algorithm.Argon2id });
  const { rows } = await pool.query('insert into people (name, passcode_hash, is_admin) values ($1,$2,true) returning id', ['Scott', h]);
  await pool.query('insert into grants (person_id, business_slug, level) values ($1,$2,$3)', [rows[0].id, 'roofing', 'manage']);
  const raw = (await call(login, { url: '/api/auth/login', body: { code: 'scott-code' } })).getHeader('set-cookie');
  return (Array.isArray(raw) ? raw.join('; ') : String(raw)).split(';')[0];
}
const post = async (cookie, body) => (await call(quoted, { body, headers: { cookie } })).json();
const view = (t) => call(publicQuote, { method: 'GET', url: '/api/quote?t=' + encodeURIComponent(t) });

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => { await pool.query('truncate leads, events, rate_hits, jobs, people, audit, job_costs, job_owner_days, job_payments, payouts, quote_lines restart identity cascade'); });
after(async () => { await pool.end(); });

/* ---------------------------------------------------------- arithmetic ---- */
test('net is costs plus markup, VAT goes on top, and the customer lines add up to the net', () => {
  const t = quoteTotals([
    { kind: 'materials', description: 'Redland 49 tiles', costPence: P(1800) },
    { kind: 'labour', description: 'Strip and re-roof', costPence: P(2400) },
    { kind: 'scaffolding', description: 'Front and rear', costPence: P(700) },
    { kind: 'waste', description: '8 yard skip', costPence: P(260) }
  ], 3300, 2000);
  assert.equal(t.costPence, P(5160));
  assert.equal(t.markupPence, P(1702.80));
  assert.equal(t.netPence, P(6862.80));
  assert.equal(t.vatPence, P(1372.56));
  assert.equal(t.totalPence, P(8235.36));
  assert.equal(t.customerLines.reduce((s, l) => s + l.pricePence, 0), t.netPence, 'to the penny');
  assert.equal(t.customerLines[0].label, 'Materials');
  assert.ok(!('costPence' in t.customerLines[0]), 'a customer line carries no cost');
});

test('the odd pennies go where the rounding lost most, and nothing is lost', () => {
  assert.deepEqual(spread(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(spread(0, [5, 5]), [0, 0]);
  assert.deepEqual(spread(500, [0, 0]), [0, 0], 'no costs, nothing to spread');
  const shares = spread(P(6862.80), [P(1800), P(2400), P(700), P(260)]);
  assert.equal(shares.reduce((s, v) => s + v, 0), P(6862.80));
});

/* --------------------------------------------------------------- route ---- */
test('while quoted, the price follows the lines; once booked, it stands', async () => {
  const cookie = await signedIn();
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Mrs Patel', customerPostcode: 'BR6 0AA', invoiceNetPence: '', status: 'quoted' });
  assert.equal(job.invoiceNetPence, 0, 'a quote can start with no price');

  await post(cookie, { op: 'qline', id: job.id, kind: 'materials', description: 'Redland 49 tiles, membrane, battens', costPence: P(1800) });
  await post(cookie, { op: 'qline', id: job.id, kind: 'labour', description: 'Strip and re-roof', costPence: P(2400) });
  let j = (await post(cookie, { op: 'markup', id: job.id, markupBp: 2500 })).job;
  assert.equal(j.quote.netPence, P(5250));
  assert.equal(j.invoiceNetPence, P(5250), 'the invoice is the quote while the job is quoted');
  assert.equal(j.quote.driving, true);

  /* Saving the same figure back does not fix it: the lines still drive. */
  j = (await post(cookie, { op: 'save', id: job.id, site: 'roofing', customerName: 'Mrs Patel', invoiceNetPence: P(5250), status: 'quoted' })).job;
  assert.equal(j.quote.driving, true);

  /* Accepted: booked at the quoted price, and a later line moves the margin only. */
  j = (await post(cookie, { op: 'save', id: job.id, site: 'roofing', customerName: 'Mrs Patel', invoiceNetPence: P(5250), status: 'booked' })).job;
  j = (await post(cookie, { op: 'qline', id: job.id, kind: 'other', description: 'Extra lead', costPence: P(100) })).job;
  assert.equal(j.invoiceNetPence, P(5250), 'the agreed price stands');
  assert.equal(j.quote.driving, false);
});

test('copying costs leaves labour out, and copying twice adds nothing', async () => {
  const cookie = await signedIn();
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Mr Okafor', status: 'quoted' });
  await post(cookie, { op: 'qline', id: job.id, kind: 'materials', description: 'Felt system', costPence: P(900) });
  await post(cookie, { op: 'qline', id: job.id, kind: 'labour', description: 'Two days', costPence: P(500) });
  await post(cookie, { op: 'qline', id: job.id, kind: 'waste', description: 'Skip', costPence: P(250) });

  let j = (await post(cookie, { op: 'costsfromquote', id: job.id })).job;
  assert.deepEqual(j.costs.map((c) => [c.label, c.amountPence, c.fromQuote]),
    [['Materials: Felt system', P(900), true], ['Waste and skip: Skip', P(250), true]]);
  j = (await post(cookie, { op: 'costsfromquote', id: job.id })).job;
  assert.equal(j.costs.length, 2, 'once each');
});

test('a quote line needs a type, a description and a figure', async () => {
  const cookie = await signedIn();
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Test', status: 'quoted' });
  for (const bad of [{ kind: 'bribes', description: 'x', costPence: 1 }, { kind: 'materials', description: '', costPence: 1 }, { kind: 'materials', description: 'x', costPence: -5 }]) {
    const res = await post(cookie, { op: 'qline', id: job.id, ...bad });
    assert.equal(res.ok, false, JSON.stringify(bad));
  }
  assert.equal((await post(cookie, { op: 'markup', id: job.id, markupBp: -1 })).ok, false);
});

/* ------------------------------------------------------ customer's view ---- */
test('the customer link shows prices, VAT and total, and never a cost or the markup', async () => {
  await pool.query("update businesses set vat_registered = true where slug = 'roofing'");
  const cookie = await signedIn();
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Mrs Patel', customerPostcode: 'BR6 0AA', note: 'Tight on budget', status: 'quoted' });
  await post(cookie, { op: 'qline', id: job.id, kind: 'materials', description: 'Natural slate', costPence: P(3000) });
  await post(cookie, { op: 'markup', id: job.id, markupBp: 3000 });
  const linked = (await post(cookie, { op: 'quotelink', id: job.id })).job;
  assert.match(linked.quote.url, /^https:\/\/vergeroofing\.com\/quote\.html\?t=[A-Za-z0-9_-]{20,}$/);
  const token = new URL(linked.quote.url).searchParams.get('t');

  const again = (await post(cookie, { op: 'quotelink', id: job.id })).job;
  assert.equal(again.quote.url, linked.quote.url, 'a link already sent keeps working');

  const res = await view(token);
  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader('x-robots-tag'), 'noindex, nofollow');
  const body = res.json();
  assert.equal(body.brand.name, 'Verge Roofing');
  assert.equal(body.quote.netPence, P(3900));
  assert.equal(body.quote.vatPence, P(780));
  assert.equal(body.quote.totalPence, P(4680));
  assert.deepEqual(body.quote.lines, [{ kind: 'materials', label: 'Materials', description: 'Natural slate', pricePence: P(3900) }]);
  const text = res.body;
  for (const secret of ['3000', 'markup', 'cost', 'Tight on budget']) assert.ok(!text.toLowerCase().includes(secret.toLowerCase()), `leaks ${secret}`);
  await pool.query("update businesses set vat_registered = false where slug = 'roofing'");
});

test('a business that is not VAT registered charges no VAT, to staff or the customer', async () => {
  await pool.query("update businesses set vat_registered = false where slug = 'roofing'");
  const cookie = await signedIn();
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Mrs Patel', status: 'quoted' });
  await post(cookie, { op: 'qline', id: job.id, kind: 'materials', description: 'Natural slate', costPence: P(3000) });
  const j = (await post(cookie, { op: 'markup', id: job.id, markupBp: 3000 })).job;
  assert.equal(j.quote.vatRegistered, false);
  assert.equal(j.quote.vatPence, 0);
  assert.equal(j.quote.totalPence, P(3900), 'the customer pays the net price and nothing more');
  const token = new URL((await post(cookie, { op: 'quotelink', id: job.id })).job.quote.url).searchParams.get('t');
  const body = (await view(token)).json();
  assert.equal(body.quote.vatBp, 0);
  assert.equal(body.quote.totalPence, P(3900));
});

test('a wrong or missing token is a plain 404, and a declined quote says it is closed', async () => {
  assert.equal((await view('not-a-real-token-at-all-xx')).statusCode, 404);
  assert.equal((await view('')).statusCode, 404);
  assert.equal((await view('<script>')).statusCode, 404);

  const cookie = await signedIn();
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'X', status: 'quoted' });
  await post(cookie, { op: 'qline', id: job.id, kind: 'materials', description: 'Tiles', costPence: P(100) });
  const url = (await post(cookie, { op: 'quotelink', id: job.id })).job.quote.url;
  await post(cookie, { op: 'save', id: job.id, site: 'roofing', customerName: 'X', status: 'declined' });
  const body = (await view(new URL(url).searchParams.get('t'))).json();
  assert.equal(body.quote.withdrawn, true);
});
