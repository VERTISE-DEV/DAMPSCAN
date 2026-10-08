/**
 * Maintenance plans for Verge: a plan made from a finished roofing job, with
 * a price per visit, on the Due list when its visit falls due, with the
 * customer's reminder ready to send, and off the list once it has gone.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'plans-test-secret-long-enough-xxxxx';
process.env.IP_SALT = 'plans-test-salt-long-enough';
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

const { mobileFor, greeting, dueMessage, messageFor } = await import('../lib/messages.js');
const login = (await import('../lib/routes/auth/login.js')).default;
const quoted = (await import('../lib/routes/admin/quoted.js')).default;
const due = (await import('../lib/routes/admin/due.js')).default;
const contracts = (await import('../lib/routes/admin/contracts.js')).default;

function makeReq({ method = 'POST', url = '/api/admin/quoted', body, headers = {} } = {}) {
  return { method, url, body, headers: { host: 'vergeroofing.com', 'x-forwarded-for': '203.0.113.9', 'user-agent': 't', ...headers }, socket: { remoteAddress: '203.0.113.9' } };
}
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; }, end(p) { this.body = p; } };
  res.json = () => (res.body ? JSON.parse(res.body) : null);
  return res;
}
async function call(handler, init) { const req = makeReq(init); const res = makeRes(); await handler(req, res); return res; }
async function personWith(code, grants) {
  const h = await hash(code, { algorithm: Algorithm.Argon2id });
  const { rows } = await pool.query('insert into people (name, passcode_hash, is_admin) values ($1,$2,false) returning id', [code, h]);
  for (const g of grants) await pool.query('insert into grants (person_id, business_slug, level) values ($1,$2,$3)', [rows[0].id, g, 'manage']);
  const raw = (await call(login, { url: '/api/auth/login', body: { code } })).getHeader('set-cookie');
  return (Array.isArray(raw) ? raw.join('; ') : String(raw)).split(';')[0];
}
const post = async (cookie, body) => (await call(quoted, { body, headers: { cookie } })).json();
const get = async (handler, cookie, url) => (await call(handler, { method: 'GET', url, headers: { cookie } })).json();
const londonDay = (offset = 0) => new Date(Date.now() + offset * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => { await pool.query('truncate leads, events, rate_hits, jobs, people, audit, job_messages, service_contracts restart identity cascade'); });
after(async () => { await pool.end(); });

test('a Verge maintenance plan is due, offers the reminder, and leaves the list once reminded', async () => {
  const cookie = await personWith('verge-code', ['roofing']);
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Mrs Patel', customerPhone: '07700900123', status: 'completed' });
  const plan = (await call(contracts, { url: '/api/admin/contracts', body: { op: 'save', site: 'roofing', jobId: job.id, intervalMonths: 12, nextDueOn: londonDay(10), pricePence: 14500 }, headers: { cookie } })).json();
  assert.equal(plan.ok, true);
  assert.equal(plan.contract.pricePence, 14500);

  const due1 = await get(due, cookie, '/api/admin/due?area=roofing');
  assert.equal(due1.services.length, 1);
  assert.match(due1.services[0].message.text, /your yearly roof and gutter check is due in/);
  assert.match(due1.services[0].message.links.whatsapp, /^https:\/\/wa\.me\/447700900123/);

  await post(cookie, { op: 'message', id: job.id, kind: 'service', channel: 'whatsapp' });
  const due2 = await get(due, cookie, '/api/admin/due?area=roofing');
  assert.equal(due2.services[0].message, null, 'reminded, so no second reminder');
  assert.ok(due2.services[0].lastContactedOn, 'and the plan says when');
});

test('the schema can be applied again over every kind of message already sent', async () => {
  const cookie = await personWith('verge-code', ['roofing']);
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'X', status: 'completed' });
  for (const kind of ['quote', 'followup', 'reminder', 'review', 'invoice', 'service']) {
    await pool.query("insert into job_messages (job_id, kind, channel) values ($1, $2, 'sms')", [job.id, kind]);
  }
  await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
});
