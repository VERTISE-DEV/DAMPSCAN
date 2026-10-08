/**
 * The Insights figures: what a job is worth in each trade, money in from the
 * right ledger, the win rate, where enquiries came from, and the money kept
 * from anyone who does not manage the business.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'insights-test-secret-long-enough-xxx';
process.env.IP_SALT = 'insights-test-salt-long-enough';
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
const insightsRoute = await import('../lib/routes/admin/insights.js');
const insights = insightsRoute.default;

function makeReq({ method = 'GET', url = '/api/admin/insights', body, headers = {} } = {}) {
  return { method, url, body, headers: { host: 'vergeroofing.com', 'x-forwarded-for': '203.0.113.40', 'user-agent': 't', ...headers }, socket: { remoteAddress: '203.0.113.40' } };
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
  const raw = (await call(login, { method: 'POST', url: '/api/auth/login', body: { code } })).getHeader('set-cookie');
  return (Array.isArray(raw) ? raw.join('; ') : String(raw)).split(';')[0];
}
const get = async (cookie, qs = '') => (await call(insights, { url: '/api/admin/insights' + qs, headers: { cookie } })).json();

async function lead(site, postcode, referrer, utm = null) {
  return (await pool.query(
    `insert into leads (site, stage, first_name, email, postcode, session_id, referrer, utm, issues) values ($1, 'complete', 'A', 'a@x.com', $2, gen_random_uuid(), $3, $4, array['Leaking roof']) returning id`,
    [site, postcode, referrer, utm])).rows[0].id;
}
async function job(site, status, fields = {}) {
  const f = { invoice: 0, survey: 0, remedial: 0, date: null, leadId: null, ...fields };
  return (await pool.query(
    `insert into jobs (site, lead_id, status, invoice_net_pence, survey_price_pence, remedial_pence, job_date, surveyor, tax_bp, lead_bp, lead_earner, partner_a, partner_b)
     values ($1, $2, $3, $4, $5, $6, coalesce($7::date, (now() at time zone 'Europe/London')::date), null, 0, 0, '', '', '') returning id`,
    [site, f.leadId, status, f.invoice, f.survey, f.remedial, f.date])).rows[0].id;
}

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => { await pool.query('truncate leads, events, rate_hits, jobs, people, audit, job_costs, job_payments, payouts restart identity cascade'); });
after(async () => { await pool.end(); });

test('a postcode district is the part before the last three characters', () => {
  assert.equal(insightsRoute.districtOf('br6 0aa'), 'BR6');
  assert.equal(insightsRoute.districtOf('SW1A1AA'), 'SW1A');
  assert.equal(insightsRoute.districtOf('nope'), null);
});

test('Verge sees its own figures: work done, money in, win rate and where enquiries came from', async () => {
  const verge = await personWith('verge-code', ['roofing']);
  const google = await lead('roofing', 'BR6 0AA', 'https://www.google.com/');
  await lead('roofing', 'BR6 9ZZ', null, { utm_medium: 'cpc', gclid: 'x' });
  await lead('dampscan', 'ME14 1AA', 'https://www.google.com/');
  const won = await job('roofing', 'completed', { invoice: 900000, leadId: google });
  await job('roofing', 'declined', { invoice: 500000 });
  await job('roofing', 'quoted', { invoice: 300000 });
  await pool.query(`insert into job_payments (job_id, amount_pence, paid_on, label) values ($1, 400000, (now() at time zone 'Europe/London')::date, 'deposit')`, [won]);
  await pool.query(`insert into job_costs (job_id, label, amount_pence) values ($1, 'Tiles', 250000)`, [won]);

  const d = await get(verge, '?area=roofing');
  assert.deepEqual(d.sites, ['roofing']);
  assert.equal(d.money.thisMonth.workPence, 900000);
  assert.equal(d.money.thisMonth.receivedPence, 400000);
  assert.equal(d.money.thisMonth.costsPence, 250000);
  assert.equal(d.money.owedPence, 500000, 'invoice less what has come in');
  assert.equal(d.money.quotedPence, 300000);
  assert.equal(d.funnel.enquiries, 2, 'the damp enquiry is not Verge\'s');
  assert.equal(d.funnel.won, 1);
  assert.equal(d.funnel.lost, 1);
  assert.equal(d.funnel.winRate, 50);
  assert.deepEqual(d.channels.map((c) => [c.channel, c.enquiries, c.won]).sort(), [['organic', 1, 1], ['paid', 1, 0]]);
  assert.deepEqual(d.places, [{ district: 'BR6', enquiries: 2, won: 1 }]);
  assert.equal(d.months.length, 12);
  assert.equal(d.months[11].enquiries, 2);
});

test('a damp job is worth its survey and remedial work, and the money is hidden from a worker', async () => {
  const boss = await personWith('damp-boss', ['dampscan']);
  const worker = await personWith('damp-worker', ['dampscan'], 'work');
  await job('dampscan', 'completed', { survey: 45000, remedial: 120000 });
  assert.equal((await get(boss, '?area=damp')).money.thisMonth.workPence, 165000);
  const w = await get(worker, '?area=damp');
  assert.equal(w.money, null);
  assert.equal(w.months[11].workPence, 0, 'no money in the months either');
  assert.equal(w.funnel.jobs, 1, 'counts are still shown');
});

test('Google visits come from our own tracking: search and ads, with landing pages and enquiries', async () => {
  const boss = await personWith('verge-search', ['roofing']);
  const ev = (sid, type, channel, path, ago = '1 day') => pool.query(
    `insert into events (session_id, type, channel, path, landing_page, site, created_at) values ($1, $2, $3, $4, $4, 'roofing', now() - $5::interval)`, [sid, type, channel, path, ago]);
  const { randomUUID } = await import('node:crypto');
  const a = randomUUID(); const b = randomUUID(); const c = randomUUID();
  await ev(a, 'page_view', 'organic', '/roofing-in/essex-and-east'); await ev(a, 'form_submit', 'organic', '/roofing-in/essex-and-east');
  await ev(b, 'page_view', 'organic', '/services/re-roofs');
  await ev(c, 'page_view', 'paid', '/');
  await ev(randomUUID(), 'page_view', 'organic', '/', '40 days');
  const o = (await get(boss, '?area=roofing')).ownSearch;
  assert.deepEqual(o.organic.now, { visits: 2, calls: 0, enquiries: 1 });
  assert.equal(o.organic.before.visits, 1);
  assert.equal(o.paid.now.visits, 1);
  assert.deepEqual(o.pages.find((p) => p.page === '/roofing-in/essex-and-east'), { page: '/roofing-in/essex-and-east', visits: 1, calls: 0, enquiries: 1 });
});

test('pages to write next: districts with enquiries and no area page on that brand', async () => {
  const both = await personWith('both-code', ['dampscan', 'ati-london']);
  await lead('dampscan', 'ME14 1AA', null); // Maidstone has a DampScan page
  await lead('dampscan', 'BR6 0AA', null); // Bromley is ATi's page, not DampScan's
  await lead('dampscan', 'BR6 1AB', null);
  await lead('ati-london', 'BR6 0AA', null); // ATi has Bromley
  await lead('ati-london', 'ZE1 0AA', null);
  const d = await get(both);
  assert.deepEqual(d.pagesToWrite.map((p) => [p.site, p.district, p.enquiries]),
    [['dampscan', 'BR6', 2], ['ati-london', 'ZE1', 1]]);
});
