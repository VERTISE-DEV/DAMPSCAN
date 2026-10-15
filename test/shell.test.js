/**
 * The shared staff shell: the page-view count (admins read it), the header
 * search, snoozing an item off Today and back, the Undo for "Reminded", and
 * payouts ready to freeze arriving on Today the way they sat on Due.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'shell-test-secret-long-enough-xxxxx';
process.env.IP_SALT = 'shell-test-salt';
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
const dispatch = (await import('../api/admin/[action].js')).default;

function makeReq({ method = 'GET', url, body, headers = {} }) {
  return { method, url, body, headers: { host: 'dampscan.co.uk', 'x-forwarded-for': '203.0.113.9', 'user-agent': 't', ...headers }, socket: { remoteAddress: '203.0.113.9' } };
}
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; }, end(p) { this.body = p; } };
  res.json = () => (res.body ? JSON.parse(res.body) : null);
  return res;
}
async function call(handler, init) { const req = makeReq(init); const res = makeRes(); await handler(req, res); return res; }
async function person(name, code, grants, isAdmin = false, level = 'manage') {
  const h = await hash(code, { algorithm: Algorithm.Argon2id });
  const { rows } = await pool.query('insert into people (name, passcode_hash, is_admin) values ($1,$2,$3) returning id', [name, h, isAdmin]);
  for (const g of grants) await pool.query('insert into grants (person_id, business_slug, level) values ($1,$2,$3)', [rows[0].id, g, level]);
  const raw = (await call(login, { method: 'POST', url: '/api/auth/login', body: { code } })).getHeader('set-cookie');
  return { id: Number(rows[0].id), cookie: (Array.isArray(raw) ? raw.join('; ') : String(raw)).split(';')[0] };
}
const api = (who, method, url, body) => call(dispatch, { method, url, body, headers: { cookie: who.cookie } });
let D;

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => {
  await pool.query('truncate leads, events, rate_hits, jobs, people, audit, job_costs, job_payments, payouts, notifications, todos, staff_page_views, action_snoozes, service_contracts restart identity cascade');
  D = (await pool.query(`select d::text as today, (d + 1)::text as tomorrow, (d + 7)::text as week, (d - 30)::text as "from", (d + 30)::text as "to"
                           from (select (now() at time zone 'Europe/London')::date as d) x`)).rows[0];
});
after(async () => { await pool.end(); });

test('each page view is counted against the person, and only an admin reads the counts', async () => {
  const admin = await person('Scott', 'admin-code', ['roofing'], true);
  const steve = await person('Steve', 'steve-code', ['roofing'], false, 'work');
  assert.equal((await api(steve, 'POST', '/api/admin/usage', JSON.stringify({ page: 'pipeline.html', area: 'roofing' }))).statusCode, 200, 'a beacon sends text');
  await api(steve, 'POST', '/api/admin/usage', { page: 'pipeline.html', area: 'roofing' });
  await api(admin, 'POST', '/api/admin/usage', { page: 'calendar.html' });
  assert.equal((await api(steve, 'POST', '/api/admin/usage', { page: '../etc/passwd' })).statusCode, 400);
  const rows = (await pool.query('select * from staff_page_views order by id')).rows;
  assert.equal(rows.length, 3);
  assert.equal(Number(rows[0].person_id), steve.id);
  assert.ok(!Object.keys(rows[0]).some((k) => /ip|agent/.test(k)), 'no address or device is kept');
  assert.equal((await api(steve, 'GET', '/api/admin/usage')).statusCode, 403);
  const d = (await api(admin, 'GET', '/api/admin/usage?days=30')).json();
  assert.deepEqual(d.pages.map((p) => [p.page, p.area, p.views, p.people]), [['pipeline.html', 'roofing', 2, 1], ['calendar.html', null, 1, 1]]);
  assert.equal((await pool.query('select count(*)::int as n from notifications')).rows[0].n, 0, 'a page view is not an alert');
});

test('the header search finds people across jobs and enquiries, only in the businesses held', async () => {
  const steve = await person('Steve', 'steve-code', ['roofing']);
  await pool.query(`insert into jobs (site, customer_name, customer_postcode, customer_phone, status, job_date, tax_bp, lead_bp, lead_earner, partner_a, partner_b)
                    values ('roofing', 'Anita Patel', 'BR6 0AA', '07700 900123', 'quoted', $1::date, 0, 0, '', '', ''),
                           ('dampscan', 'Arun Patel', 'ME14 1AA', null, 'booked', $1::date, 0, 0, '', '', '')`, [D.today]);
  await pool.query(`insert into leads (site, stage, first_name, email, phone, postcode, session_id) values ('roofing', 'complete', 'Pat', 'pat@x.com', '07700 900999', 'BR6 1AB', gen_random_uuid())`);
  const byName = (await api(steve, 'GET', '/api/admin/search?q=patel')).json();
  assert.deepEqual(byName.clients.map((c) => [c.name, c.jobs.map((j) => j.site)]), [['Anita Patel', ['roofing']]], 'the damp job is not his');
  const byPostcode = (await api(steve, 'GET', '/api/admin/search?q=br61ab')).json();
  assert.deepEqual(byPostcode.clients.map((c) => c.enquiries.length), [1]);
  assert.deepEqual((await api(steve, 'GET', '/api/admin/search?q=a')).json().clients, []);
});

test('a snoozed item leaves my Today until its day, comes back on Undo, and stays on everyone else\'s', async () => {
  const scott = await person('Scott', 'scott-code', ['dampscan'], true);
  const tom = await person('Tom', 'tom-code', ['dampscan']);
  await pool.query(`insert into leads (site, stage, first_name, email, phone, postcode, session_id) values ('dampscan', 'complete', 'Priya', 'p@x.com', '07700 900111', 'ME14 1AA', gen_random_uuid())`);
  const today = async (who) => (await api(who, 'GET', `/api/admin/calendar?view=work&from=${D.from}&to=${D.to}`)).json().work;
  const lead = (await today(scott)).groups.find((g) => g.key === 'enquiries').items[0];
  assert.equal((await api(scott, 'POST', '/api/admin/snooze', { kind: 'enquiries', ref: lead.id, until: D.today })).statusCode, 400, 'not to today');
  assert.equal((await api(scott, 'POST', '/api/admin/snooze', { kind: 'enquiries', ref: lead.id, until: D.week })).statusCode, 200);
  assert.ok(!(await today(scott)).groups.some((g) => g.key === 'enquiries'), 'gone from my list');
  assert.equal((await today(tom)).groups.find((g) => g.key === 'enquiries').count, 1, 'still on Tom\'s');
  await api(scott, 'DELETE', '/api/admin/snooze', { kind: 'enquiries', ref: String(lead.id) });
  assert.equal((await today(scott)).groups.find((g) => g.key === 'enquiries').count, 1, 'back after Undo');
});

test('Undo on Reminded puts the last reminder date back', async () => {
  const scott = await person('Scott', 'scott-code', ['ac'], true);
  const { rows } = await pool.query(`insert into service_contracts (business_slug, customer_name, customer_postcode, installed_on, interval_months, next_due_on, status)
                                     values ('ac', 'Dev Shah', 'TN13 1AA', $1::date - 365, 12, $1::date + 3, 'active') returning id`, [D.today]);
  const id = Number(rows[0].id);
  await api(scott, 'POST', '/api/admin/contracts', { op: 'contacted', id });
  assert.ok((await pool.query('select last_contacted_on from service_contracts where id = $1', [id])).rows[0].last_contacted_on);
  await api(scott, 'POST', '/api/admin/contracts', { op: 'uncontacted', id, on: '' });
  assert.equal((await pool.query('select last_contacted_on from service_contracts where id = $1', [id])).rows[0].last_contacted_on, null);
});

test('a job paid in full shows on Today as a payout to freeze, for whoever manages it', async () => {
  const scott = await person('Scott', 'scott-code', ['roofing'], true);
  const { rows } = await pool.query(`insert into jobs (site, customer_name, status, job_date, invoice_net_pence, tax_bp, lead_bp, lead_earner, partner_a, partner_b)
                                     values ('roofing', 'Paula Paid', 'completed', $1::date - 5, 100000, 0, 0, '', '', '') returning id`, [D.today]);
  await pool.query(`insert into job_payments (job_id, amount_pence, paid_on, label) values ($1, 100000, $2::date, 'deposit')`, [rows[0].id, D.today]);
  const work = (await api(scott, 'GET', `/api/admin/calendar?view=work&from=${D.from}&to=${D.to}`)).json().work;
  const pay = work.groups.find((g) => g.key === 'payouts');
  assert.ok(pay, JSON.stringify(work.groups.map((g) => g.key)));
  assert.equal(pay.items[0].jobId, Number(rows[0].id));
});
