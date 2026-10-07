/**
 * Invoices for the quoted trades: refused until the business's VAT details
 * are on the site, numbered from each business's own unbroken sequence, issued
 * once, and shown to the customer with what has been paid against them.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'invoice-test-secret-long-enough-xxxx';
process.env.IP_SALT = 'invoice-test-salt-long-enough';
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

const login = (await import('../lib/routes/auth/login.js')).default;
const quoted = (await import('../lib/routes/admin/quoted.js')).default;
const publicQuote = (await import('../api/quote.js')).default;

const P = (pounds) => Math.round(pounds * 100);
function makeReq({ method = 'POST', url = '/api/admin/quoted', body, headers = {} } = {}) {
  return { method, url, body, headers: { host: 'vergeroofing.com', 'x-forwarded-for': '198.51.100.23', 'user-agent': 't', ...headers }, socket: { remoteAddress: '198.51.100.23' } };
}
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; }, end(p) { this.body = p; } };
  res.json = () => (res.body ? JSON.parse(res.body) : null);
  return res;
}
async function call(handler, init) { const req = makeReq(init); const res = makeRes(); await handler(req, res); return res; }
async function personWith(code, grants, level = 'manage') {
  const h = await hash(code, { algorithm: Algorithm.Argon2id });
  const { rows } = await pool.query('insert into people (name, passcode_hash, is_admin) values ($1,$2,false) returning id', [code, h]);
  for (const g of grants) await pool.query('insert into grants (person_id, business_slug, level) values ($1,$2,$3)', [rows[0].id, g, level]);
  const raw = (await call(login, { url: '/api/auth/login', body: { code } })).getHeader('set-cookie');
  return (Array.isArray(raw) ? raw.join('; ') : String(raw)).split(';')[0];
}
const post = async (cookie, body) => (await call(quoted, { body, headers: { cookie } })).json();
const view = (t) => call(publicQuote, { method: 'GET', url: '/api/quote?t=' + encodeURIComponent(t) });
const invoiceView = (t) => call(publicQuote, { method: 'GET', url: '/api/quote?doc=invoice&t=' + encodeURIComponent(t) });


async function bookedJob(cookie, name, pounds) {
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: name, customerPostcode: 'BR6 0AA', status: 'quoted' });
  await post(cookie, { op: 'qline', id: job.id, kind: 'materials', description: 'Tiles', costPence: P(pounds) });
  return (await post(cookie, { op: 'status', id: job.id, status: 'booked', jobDate: '2026-11-02' })).job;
}

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => {
  await pool.query('truncate leads, events, rate_hits, jobs, people, audit, job_costs, job_owner_days, job_payments, payouts, quote_lines, job_messages restart identity cascade');
  await pool.query("update businesses set next_invoice = 1, vat_registered = false, vat_number = null, trading_address = null");
});
after(async () => { await pool.end(); });

const details = (fields) => pool.query(
  `update businesses set trading_address = $1, vat_registered = $2, vat_number = $3 where slug = 'roofing'`,
  [fields.address || null, Boolean(fields.vat), fields.vatNumber || null]);

test('no invoice without the business address, nor without the VAT number once VAT is on', async () => {
  const cookie = await personWith('verge-code', ['roofing']);
  const job = await bookedJob(cookie, 'Mrs Patel', 1000);
  assert.equal(job.quote.canInvoice, false);
  const refused = await post(cookie, { op: 'invoice', id: job.id });
  assert.equal(refused.ok, false);
  assert.match(refused.errors.invoice, /address/);
  await details({ address: '1 High Street', vat: true });
  assert.match((await post(cookie, { op: 'invoice', id: job.id })).errors.invoice, /VAT number/);
});

test('an unregistered business issues a plain invoice with no VAT and no VAT number', async () => {
  await details({ address: '1 High Street, Orpington' });
  const cookie = await personWith('verge-code', ['roofing']);
  const job = await bookedJob(cookie, 'Mrs Patel', 1000);
  const inv = (await post(cookie, { op: 'invoice', id: job.id })).job.quote.invoice;
  const v = (await invoiceView(new URL(inv.url).searchParams.get('t'))).json();
  assert.equal(v.invoice.vatPence, 0);
  assert.equal(v.invoice.totalPence, P(1000));
  assert.equal(v.brand.vatNumber, null);
  assert.equal(v.brand.address, '1 High Street, Orpington');
});

test('invoices take the next number once each, and the customer sees lines, VAT, payments and the balance', async () => {
  await details({ address: '1 High Street, Orpington BR6 0AA', vat: true, vatNumber: 'GB123456789' });
  const cookie = await personWith('verge-code', ['roofing']);
  const quotedOnly = (await post(cookie, { op: 'save', site: 'roofing', customerName: 'X', invoiceNetPence: P(100), status: 'quoted' })).job;
  assert.equal((await post(cookie, { op: 'invoice', id: quotedOnly.id })).ok, false, 'not before it is booked');

  const a = await bookedJob(cookie, 'Mrs Patel', 1000);
  const b = await bookedJob(cookie, 'Mr Okafor', 500);
  const ai = (await post(cookie, { op: 'invoice', id: a.id, dueDays: 14 })).job.quote.invoice;
  const bi = (await post(cookie, { op: 'invoice', id: b.id })).job.quote.invoice;
  assert.equal(ai.number, 'VR-0001');
  assert.equal(bi.number, 'VR-0002');
  const again = (await post(cookie, { op: 'invoice', id: a.id, dueDays: 30 })).job.quote.invoice;
  assert.equal(again.number, 'VR-0001', 'reissuing keeps the number');

  const token = new URL(ai.url).searchParams.get('t');
  assert.match(ai.url, /^https:\/\/vergeroofing\.com\/invoice\.html\?t=/);
  await post(cookie, { op: 'payment', id: a.id, amountPence: P(500), label: 'deposit' });
  const v = (await invoiceView(token)).json();
  assert.equal(v.brand.vatNumber, 'GB123456789');
  assert.equal(v.invoice.number, 'VR-0001');
  assert.equal(v.invoice.netPence, P(1000));
  assert.equal(v.invoice.vatPence, P(200));
  assert.equal(v.invoice.totalPence, P(1200));
  assert.equal(v.invoice.receivedPence, P(500));
  assert.equal(v.invoice.balancePence, P(700));
  assert.deepEqual(v.invoice.customerAddress, ['BR6 0AA']);
  for (const secret of ['costPence', 'markup']) assert.ok(!JSON.stringify(v).includes(secret), 'no costs on an invoice');

  const msg = (await post(cookie, { op: 'payment', id: b.id, amountPence: 1, label: 'payment' })).job.messages.ready.invoice;
  assert.match(msg.text, /Here is your invoice, VR-0002/);
});

test('an invoice link shows nothing before an invoice is issued', async () => {
  await details({ address: '1 High Street' });
  const cookie = await personWith('verge-code', ['roofing']);
  const job = await bookedJob(cookie, 'Mrs Patel', 1000);
  const url = (await post(cookie, { op: 'quotelink', id: job.id })).job.quote.url;
  assert.equal((await invoiceView(new URL(url).searchParams.get('t'))).statusCode, 404);
});
