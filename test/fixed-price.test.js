/**
 * A price typed by hand is the price.
 *
 * The owner agrees £5,000 for the job, then enters £1,000 of materials. The
 * price stays £5,000, the materials become a cost of the job exactly once,
 * and profit and payout are the price less that cost. The customer's page
 * shows the price, not the lines scaled up to it.
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

const pageFor = async (cookie, id) => {
  const j = (await post(cookie, { op: 'quotelink', id })).job;
  return (await view(j.quote.url.split('t=')[1])).json().quote;
};

test('a typed £5,000 stays £5,000 when £1,000 of materials is added, and the materials are a cost once', async () => {
  const cookie = await signedIn();
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Mrs Patel', invoiceNetPence: P(5000), status: 'quoted' });
  let j = (await post(cookie, { op: 'qline', id: job.id, kind: 'materials', description: 'Tiles and battens', costPence: P(1000) })).job;
  assert.equal(j.invoiceNetPence, P(5000), 'the price does not follow the lines');
  assert.equal(j.quote.fixed, true);
  assert.equal(j.quote.netPence, P(5000));
  assert.equal(j.quote.linesNetPence, P(1000));
  assert.deepEqual(j.costs.map((c) => [c.amountPence, c.fromQuote]), [[P(1000), true]]);
  assert.equal(j.profit.profitPence, P(4000));
  assert.equal(j.payout.balance, P(4000), 'roofing payout starts from price less materials');

  /* Copy costs adds nothing more; labour is never a cost. */
  await post(cookie, { op: 'qline', id: job.id, kind: 'labour', description: 'Two days', costPence: P(600) });
  j = (await post(cookie, { op: 'costsfromquote', id: job.id })).job;
  assert.equal(j.costs.length, 1, 'counted once');
  assert.equal(j.invoiceNetPence, P(5000));

  /* The customer sees £5,000 as one figure, not "Materials £5,000". */
  const q = await pageFor(cookie, job.id);
  assert.equal(q.netPence, P(5000));
  assert.deepEqual(q.lines.map((l) => [l.label, l.pricePence]), [['Work as quoted', P(5000)]]);

  /* Removing the line removes its cost too. */
  const line = j.quote.lines.find((l) => l.kind === 'materials');
  j = (await post(cookie, { op: 'unqline', id: job.id, lineId: line.id })).job;
  assert.equal(j.costs.length, 0);
  assert.equal(j.profit.profitPence, P(5000));
});

test('"use the lines\' total" hands the price back to the lines, and blanking the price does too', async () => {
  const cookie = await signedIn();
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Mr Okafor', invoiceNetPence: P(3000), status: 'quoted' });
  await post(cookie, { op: 'qline', id: job.id, kind: 'materials', description: 'Felt', costPence: P(800) });
  let j = (await post(cookie, { op: 'pricefromlines', id: job.id })).job;
  assert.equal(j.invoiceNetPence, P(800));
  assert.equal(j.quote.driving, true);
  j = (await post(cookie, { op: 'qline', id: job.id, kind: 'other', description: 'Lead', costPence: P(200) })).job;
  assert.equal(j.invoiceNetPence, P(1000), 'following again');
  const q = await pageFor(cookie, job.id);
  assert.equal(q.lines.length, 2, 'lines that are the price are itemised');

  j = (await post(cookie, { op: 'save', id: job.id, site: 'roofing', customerName: 'Mr Okafor', invoiceNetPence: P(4500), status: 'quoted' })).job;
  assert.equal(j.quote.fixed, true);
  j = (await post(cookie, { op: 'save', id: job.id, site: 'roofing', customerName: 'Mr Okafor', invoiceNetPence: '', status: 'quoted' })).job;
  assert.equal(j.invoiceNetPence, P(1000), 'blank means build it from the lines');
});

test('the backfill fixes booked jobs and typed prices, and leaves a lines-driven quote following', async () => {
  const ins = (status, price) => pool.query("insert into jobs (site, customer_name, status, invoice_net_pence, survey_price_pence, tax_bp, lead_bp, lead_earner, partner_a, partner_b, job_date) values ('roofing','x',$1,$2,0,0,0,'','','',current_date) returning id", [status, price]);
  const booked = (await ins('booked', P(100))).rows[0].id;
  const typed = (await ins('quoted', P(200))).rows[0].id;
  const driven = (await ins('quoted', P(300))).rows[0].id;
  await pool.query("insert into quote_lines (job_id, kind, description, cost_pence) values ($1, 'materials', 'x', 30000)", [driven]);
  await pool.query('alter table jobs alter column price_fixed drop not null');
  await pool.query('update jobs set price_fixed = null');
  await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  const { rows } = await pool.query('select id, price_fixed from jobs order by id');
  assert.deepEqual(rows.map((r) => [Number(r.id), r.price_fixed]), [[Number(booked), true], [Number(typed), true], [Number(driven), false]]);
});
