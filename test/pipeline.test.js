/**
 * The pipeline, the calendar and the one-tap customer messages.
 *
 * The message rules first, as pure functions: who is greeted how, which
 * numbers WhatsApp and a text can use, and when each message falls due. Then
 * the routes: a job keeps its phone and email, copies them only from its own
 * business's enquiries, moves stage, records a message, and appears on the Due
 * list and the calendar of the people allowed to see it and nobody else.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'pipeline-test-secret-long-enough-xx';
process.env.IP_SALT = 'pipeline-test-salt';
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
const calendar = (await import('../lib/routes/admin/calendar.js')).default;

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
beforeEach(async () => { await pool.query('truncate leads, events, rate_hits, jobs, people, audit, job_costs, job_owner_days, job_payments, payouts, quote_lines, job_messages, service_contracts restart identity cascade'); });
after(async () => { await pool.end(); });

/* ------------------------------------------------------------ the rules ---- */
test('a UK mobile in any usual form becomes 447..., and a landline is no use for WhatsApp or a text', () => {
  for (const n of ['07700 900123', '+44 7700 900123', '0044 7700 900123', '(07700) 900-123']) assert.equal(mobileFor(n), '447700900123', n);
  assert.equal(mobileFor('020 3432 4561'), null);
  assert.equal(mobileFor(''), null);
});

test('a customer is greeted the way they gave their name', () => {
  assert.equal(greeting('Mrs Anita Patel'), 'Hi Mrs Patel,');
  assert.equal(greeting('Anita Patel'), 'Hi Anita,');
  assert.equal(greeting('Mr'), 'Hello,');
  assert.equal(greeting(null), 'Hello,');
});

test('follow-ups fall due at three and seven days, then stop; a reminder the day before; a review once', () => {
  const job = { site: 'roofing', status: 'quoted', customerName: 'Anita', customerPhone: '07700900123', quoteUrl: 'https://vergeroofing.com/quote.html?t=x', quoteSentAt: '2026-10-01T09:00:00Z' };
  assert.equal(dueMessage(job, [], '2026-10-03'), null, 'two days is too soon');
  assert.equal(dueMessage(job, [], '2026-10-04').followupNumber, 1);
  const one = [{ kind: 'followup', channel: 'sms', sentAt: '2026-10-04T10:00:00Z' }];
  assert.equal(dueMessage(job, one, '2026-10-06'), null, 'the second waits for day seven');
  assert.equal(dueMessage(job, one, '2026-10-08').followupNumber, 2);
  const two = [...one, { kind: 'followup', channel: 'sms', sentAt: '2026-10-08T10:00:00Z' }];
  assert.equal(dueMessage(job, two, '2026-10-20'), null, 'never a third');

  const booked = { ...job, status: 'booked', jobDate: '2026-10-09', jobTime: '08:00' };
  assert.equal(dueMessage(booked, [], '2026-10-07'), null, 'two days out is not tomorrow');
  const reminder = dueMessage(booked, [], '2026-10-08');
  assert.equal(reminder.kind, 'reminder');
  assert.match(reminder.text, /Friday 9 October at 08:00/);
  assert.equal(dueMessage(booked, [{ kind: 'reminder', channel: 'whatsapp', sentAt: '2026-10-08T09:00:00Z' }], '2026-10-08'), null);

  const done = { ...job, status: 'completed' };
  assert.equal(dueMessage(done, [], '2026-10-10').kind, 'review');
  assert.equal(dueMessage(done, [{ kind: 'review', channel: 'email', sentAt: '2026-10-10T09:00:00Z' }], '2026-11-10'), null);
});

test('the links carry the words, and a channel with nothing to send to is left out', () => {
  const m = messageFor('review', { site: 'ac', customerName: 'Tom', customerPhone: '020 1234 5678', customerEmail: 'tom@example.com' });
  assert.equal(m.links.whatsapp, null);
  assert.equal(m.links.sms, null);
  assert.match(m.links.email, /^mailto:tom%40example\.com\?subject=Thank%20you%20from%20CoolRight&body=Hi%20Tom%2C/);
  assert.equal(messageFor('quote', { site: 'roofing' }), null, 'no link, no quote message');
  assert.equal(messageFor('review', { site: 'dampscan' }), null, 'the damp brands do not send these');
});

/* ------------------------------------------------------------ the route ---- */
test('a job keeps its phone and email, and a save that does not send them leaves them alone', async () => {
  const cookie = await personWith('verge-code', ['roofing']);
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Anita', customerPhone: '07700 900123', customerEmail: 'a@example.com', status: 'quoted' });
  assert.equal(job.customerPhone, '07700 900123');
  const kept = (await post(cookie, { op: 'save', id: job.id, site: 'roofing', customerName: 'Anita P', status: 'quoted' })).job;
  assert.equal(kept.customerPhone, '07700 900123');
  assert.equal(kept.customerEmail, 'a@example.com');
  const cleared = (await post(cookie, { op: 'save', id: job.id, site: 'roofing', customerName: 'Anita P', customerEmail: '', status: 'quoted' })).job;
  assert.equal(cleared.customerEmail, null);
  assert.equal((await post(cookie, { op: 'save', site: 'roofing', customerEmail: 'not-an-email', status: 'quoted' })).ok, false);
});

test('a job started from an enquiry takes its contact details, but only from its own business', async () => {
  const cookie = await personWith('verge-code', ['roofing']);
  const lead = async (site) => (await pool.query(
    `insert into leads (site, stage, first_name, email, phone, postcode, session_id) values ($1, 'complete', 'Ola', 'ola@example.com', '07700 900555', 'BR6 0AA', gen_random_uuid()) returning id`, [site])).rows[0].id;
  const own = (await post(cookie, { op: 'save', site: 'roofing', leadId: await lead('roofing'), customerName: 'Ola', status: 'quoted' })).job;
  assert.equal(own.customerEmail, 'ola@example.com');
  assert.equal(own.customerPhone, '07700 900555');
  const other = (await post(cookie, { op: 'save', site: 'roofing', leadId: await lead('dampscan'), customerName: 'Ola', status: 'quoted' })).job;
  assert.equal(other.customerEmail, null, 'a damp lead number is not a key to its details');
});

test('a card moves stage with a date and time, and a paid job cannot be moved from the board', async () => {
  const cookie = await personWith('verge-code', ['roofing']);
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Ben', status: 'quoted' });
  const booked = (await post(cookie, { op: 'status', id: job.id, status: 'booked', jobDate: '2026-11-02', jobTime: '08:30' })).job;
  assert.equal(booked.status, 'booked');
  assert.equal(booked.jobDate, '2026-11-02');
  assert.equal(booked.jobTime, '08:30');
  assert.equal((await post(cookie, { op: 'status', id: job.id, status: 'paid' })).ok, false, 'paid comes from the freeze');
  await pool.query(`update jobs set status = 'paid', payout_frozen_at = now() where id = $1`, [job.id]);
  assert.equal((await post(cookie, { op: 'status', id: job.id, status: 'booked' })).ok, false);
});

test('sending the quote starts the follow-up clock, and every message tapped is kept', async () => {
  const cookie = await personWith('verge-code', ['roofing']);
  const { job } = await post(cookie, { op: 'save', site: 'roofing', customerName: 'Mrs Anita Patel', customerPhone: '07700900123', status: 'quoted' });
  assert.equal(job.messages.ready.quote, null, 'no link yet');
  const linked = (await post(cookie, { op: 'quotelink', id: job.id })).job;
  assert.ok(linked.quoteSentAt, 'making the link is copying it to send');
  assert.match(linked.messages.ready.quote.links.whatsapp, /^https:\/\/wa\.me\/447700900123\?text=Hi%20Mrs%20Patel%2C/);
  const after = (await post(cookie, { op: 'message', id: job.id, kind: 'quote', channel: 'whatsapp' })).job;
  assert.deepEqual(after.messages.sent.map((m) => [m.kind, m.channel]), [['quote', 'whatsapp']]);
  assert.equal((await post(cookie, { op: 'message', id: job.id, kind: 'spam', channel: 'whatsapp' })).ok, false);
});

test('the Due list offers the follow-up, and only to someone who can see the business', async () => {
  const verge = await personWith('verge-code', ['roofing']);
  const cool = await personWith('cool-code', ['ac']);
  const { job } = await post(verge, { op: 'save', site: 'roofing', customerName: 'Anita', customerPhone: '07700900123', status: 'quoted' });
  await post(verge, { op: 'quotelink', id: job.id });
  await pool.query(`update jobs set quote_sent_at = now() - interval '4 days' where id = $1`, [job.id]);
  const list = await get(due, verge, '/api/admin/due?area=roofing');
  assert.deepEqual(list.messages.map((m) => [m.id, m.message.kind, m.message.followupNumber]), [[job.id, 'followup', 1]]);
  assert.deepEqual((await get(due, cool, '/api/admin/due')).messages, []);
  await post(verge, { op: 'message', id: job.id, kind: 'followup', channel: 'sms' });
  assert.deepEqual((await get(due, verge, '/api/admin/due')).messages, [], 'sent, so off the list');
});

test('the calendar shows booked work and services in scope, and refuses an unbounded range', async () => {
  const verge = await personWith('verge-code', ['roofing']);
  const cool = await personWith('cool-code', ['ac']);
  const { job } = await post(verge, { op: 'save', site: 'roofing', customerName: 'Ben', status: 'quoted' });
  await post(verge, { op: 'status', id: job.id, status: 'booked', jobDate: londonDay(2) });
  await pool.query(`insert into service_contracts (business_slug, customer_name, next_due_on) values ('ac', 'Kim', $1::date)`, [londonDay(3)]);
  const range = `from=${londonDay(-1)}&to=${londonDay(10)}`;
  const mine = await get(calendar, verge, `/api/admin/calendar?${range}`);
  assert.deepEqual(mine.events.map((e) => [e.kind, e.site, e.customerName]), [['job', 'roofing', 'Ben']]);
  assert.ok(!('invoiceNetPence' in mine.events[0]), 'no money on a calendar');
  const theirs = await get(calendar, cool, `/api/admin/calendar?${range}`);
  assert.deepEqual(theirs.events.map((e) => [e.kind, e.customerName]), [['service', 'Kim']]);
  assert.equal((await call(calendar, { method: 'GET', url: '/api/admin/calendar?from=2026-01-01&to=2026-12-31', headers: { cookie: verge } })).statusCode, 400);
  assert.equal((await call(calendar, { method: 'GET', url: '/api/admin/calendar', headers: { cookie: verge } })).statusCode, 400);
});
