/**
 * Rate us, the review booster, the yearly check and profit per job.
 *
 * The rules first, as pure functions: a finished job asks how we did, chases
 * once a week later and never again, and a year on asks about the yearly
 * check unless the customer is on a plan. Then the customer's page: five
 * stars goes to Google, fewer opens a private box, and the Google link is
 * offered either way. Then the time on a job: clocking in and out, "on my
 * way" in the viewer's own name, the profit, which only a manager sees, and
 * Insights and the digest that count it all.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'rating-test-secret-long-enough-xxxxx';
process.env.IP_SALT = 'rating-test-salt-long-enough';
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

const { dueMessage, messageFor } = await import('../lib/messages.js');
const { profitFor } = await import('../lib/profit.js');
const login = (await import('../lib/routes/auth/login.js')).default;
const quoted = (await import('../lib/routes/admin/quoted.js')).default;
const due = (await import('../lib/routes/admin/due.js')).default;
const insights = (await import('../lib/routes/admin/insights.js')).default;
const publicQuote = (await import('../api/quote.js')).default;
const { digestFor } = await import('../lib/digest.js');

function makeReq({ method = 'POST', url = '/api/admin/quoted', body, headers = {} } = {}) {
  return { method, url, body, headers: { host: 'vergeroofing.com', 'x-forwarded-for': '198.51.100.77', 'user-agent': 't', ...headers }, socket: { remoteAddress: '198.51.100.77' } };
}
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; }, end(p) { this.body = p; } };
  res.json = () => (res.body ? JSON.parse(res.body) : null);
  return res;
}
async function call(handler, init) { const req = makeReq(init); const res = makeRes(); await handler(req, res); return res; }
async function personWith(name, grants, level = 'manage') {
  const h = await hash(name, { algorithm: Algorithm.Argon2id });
  const { rows } = await pool.query('insert into people (name, passcode_hash, is_admin) values ($1,$2,false) returning id', [name, h]);
  for (const g of grants) await pool.query('insert into grants (person_id, business_slug, level) values ($1,$2,$3)', [rows[0].id, g, level]);
  const raw = (await call(login, { url: '/api/auth/login', body: { code: name } })).getHeader('set-cookie');
  return { id: Number(rows[0].id), cookie: (Array.isArray(raw) ? raw.join('; ') : String(raw)).split(';')[0] };
}
const post = async (cookie, body) => (await call(quoted, { body, headers: { cookie } })).json();
const get = async (handler, cookie, url) => (await call(handler, { method: 'GET', url, headers: { cookie } })).json();
const tokenOf = async (id) => (await pool.query('select rating_token from jobs where id = $1', [id])).rows[0].rating_token;

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => {
  await pool.query('truncate leads, events, rate_hits, jobs, people, audit, job_costs, job_owner_days, job_payments, payouts, quote_lines, job_messages, service_contracts, notifications, job_ratings, job_time, job_miles restart identity cascade');
});
after(async () => { await pool.end(); });

/* ------------------------------------------------------------ the rules ---- */
test('a finished job asks how we did, chases once after a week, and stops when rated', () => {
  const job = { site: 'roofing', status: 'completed', customerName: 'Sarah Jones', customerPhone: '07700900123', ratingUrl: 'https://vergeroofing.com/rate.html?t=abc', jobDate: '2026-10-01' };
  const first = dueMessage(job, [], '2026-10-02');
  assert.equal(first.kind, 'rating');
  assert.match(first.text, /^Hi Sarah, .*rate\.html\?t=abc/s);
  const asked = [{ kind: 'rating', channel: 'whatsapp', sentAt: '2026-10-02T09:00:00Z' }];
  assert.equal(dueMessage(job, asked, '2026-10-08'), null, 'six days is too soon');
  const chase = dueMessage(job, asked, '2026-10-09');
  assert.equal(chase.kind, 'rating');
  assert.equal(chase.followupNumber, 2);
  assert.match(chase.text, /gentle nudge/);
  assert.equal(dueMessage(job, [...asked, { kind: 'rating', channel: 'sms', sentAt: '2026-10-09T09:00:00Z' }], '2026-10-30'), null, 'chased once only');
  assert.equal(dueMessage({ ...job, rated: true }, asked, '2026-10-09'), null, 'rated, so no chase');
  assert.equal(dueMessage(job, [{ kind: 'review', channel: 'sms', sentAt: '2026-10-02T09:00:00Z' }], '2026-10-03'), null, 'a hand-sent review link already asked');
});

test('the yearly check falls due eleven months on, and not for a customer on a plan or a damp job', () => {
  const job = { site: 'ac', status: 'paid', customerName: 'Tom', customerPhone: '07700900123', ratingUrl: 'x', rated: true, jobDate: '2025-10-01' };
  assert.equal(dueMessage(job, [], '2026-08-25'), null, 'ten and a bit months is too soon');
  const yearly = dueMessage(job, [], '2026-09-05');
  assert.equal(yearly.kind, 'yearly');
  assert.match(yearly.text, /air conditioning/);
  assert.equal(dueMessage(job, [{ kind: 'yearly', channel: 'sms', sentAt: '2026-09-05T09:00:00Z' }], '2026-09-20'), null, 'sent this year');
  assert.equal(dueMessage({ ...job, onPlan: true }, [], '2026-09-05'), null, 'on a plan already');
  assert.equal(dueMessage({ ...job, site: 'dampscan' }, [], '2026-09-05'), null);
  assert.equal(dueMessage(job, [{ kind: 'yearly', channel: 'sms', sentAt: '2026-09-05T09:00:00Z' }], '2027-09-05').kind, 'yearly', 'and again the next year');
  assert.match(messageFor('yearly', { ...job, site: 'roofing' }).text, /roof and gutters/);
});

test('on my way names who is coming and roughly when', () => {
  const m = messageFor('onmyway', { site: 'roofing', customerName: 'Sarah Jones', customerPhone: '07700900123', staffName: 'Dan Smith', minutes: 30 });
  assert.equal(m.text, "Hi Sarah, it's Dan from Verge Roofing, on my way, about 30 minutes.");
  assert.match(m.links.whatsapp, /^https:\/\/wa\.me\/447700900123/);
});

test('profit is price less costs less labour, and over budget past the set share', () => {
  const t0 = Date.parse('2026-10-01T08:00:00Z');
  const time = [{ started_at: '2026-10-01T08:00:00Z', ended_at: '2026-10-01T12:00:00Z', hourly_rate_pence: 2000 }];
  const p = profitFor(100000, [{ amount_pence: 50000 }], time, t0);
  assert.deepEqual([p.costsPence, p.labourHours, p.labourPence, p.profitPence, p.overBudget], [50000, 4, 8000, 42000, false]);
  assert.equal(profitFor(100000, [{ amount_pence: 75000 }], time, t0).overBudget, true, '83% is over 80%');
});

/* ------------------------------------------------------- the customer page -- */
test('five stars goes to Google; fewer opens a private box; the Google link is offered either way', async () => {
  const dan = await personWith('Dan Smith', ['roofing']);
  const { job } = await post(dan.cookie, { op: 'save', site: 'roofing', customerName: 'Mrs Sarah Jones', customerPhone: '07700900123', status: 'completed', invoiceNetPence: 100000 });
  assert.match(job.messages.ready.rating.text, /rate\.html\?t=[0-9a-f]{32}/);
  assert.equal(job.messages.due.kind, 'rating');
  const t = await tokenOf(job.id);
  const page = (await call(publicQuote, { method: 'GET', url: '/api/quote?doc=rate&t=' + t })).json();
  assert.equal(page.brand.reviewUrl, 'https://share.google/p2JjORGy8UdZUpQnV', 'offered to everybody, before any stars');
  assert.equal(page.rating.firstName, 'Sarah');
  assert.ok(!('lines' in page) && !('quote' in page), 'a rating link shows nothing of the price');
  assert.equal((await call(publicQuote, { method: 'GET', url: '/api/quote?t=' + t })).statusCode, 404, 'a rating token does not open the quote');

  const two = (await call(publicQuote, { url: '/api/quote', body: { doc: 'rate', t, stars: 2 } })).json();
  assert.equal(two.ok, true);
  await call(publicQuote, { url: '/api/quote', body: { doc: 'rate', t, stars: 2, comment: 'Left the gutter full of moss.' } });
  const rated = (await get(quoted, dan.cookie, '/api/admin/quoted?range=all')).jobs[0];
  assert.deepEqual([rated.rating.stars, rated.rating.comment], [2, 'Left the gutter full of moss.']);
  assert.equal(rated.messages.due, null, 'rated, so nothing to chase');
  const kinds = (await pool.query('select kind from notifications order by id')).rows.map((r) => r.kind);
  assert.deepEqual(kinds.filter((k) => k.startsWith('rating')), ['rating_low', 'rating_low'], 'told for the stars and again for the words');

  const five = (await call(publicQuote, { url: '/api/quote', body: { doc: 'rate', t, stars: 5 } })).json();
  assert.equal(five.reviewUrl, 'https://share.google/p2JjORGy8UdZUpQnV');
  assert.equal((await pool.query('select count(*)::int as n, max(comment) as c from job_ratings')).rows[0].n, 1, 'one rating per job');
  assert.equal((await call(publicQuote, { url: '/api/quote', body: { doc: 'rate', t, stars: 9 } })).statusCode, 400);
  assert.equal((await call(publicQuote, { url: '/api/quote', body: { doc: 'rate', t: 'x'.repeat(32), stars: 5 } })).statusCode, 404);
});

test('the Due list chases an unanswered rating once, a week on', async () => {
  const dan = await personWith('Dan Smith', ['roofing']);
  const { job } = await post(dan.cookie, { op: 'save', site: 'roofing', customerName: 'Sarah', customerPhone: '07700900123', status: 'completed' });
  assert.equal((await get(due, dan.cookie, '/api/admin/due')).messages[0].message.kind, 'rating');
  await post(dan.cookie, { op: 'message', id: job.id, kind: 'rating', channel: 'whatsapp' });
  assert.deepEqual((await get(due, dan.cookie, '/api/admin/due')).messages, []);
  await pool.query(`update job_messages set sent_at = now() - interval '8 days'`);
  const chase = (await get(due, dan.cookie, '/api/admin/due')).messages[0].message;
  assert.deepEqual([chase.kind, chase.followupNumber], ['rating', 2]);
});

test('a yearly check reaches the Due list, unless the customer is on a maintenance plan', async () => {
  const dan = await personWith('Dan Smith', ['roofing']);
  const { job } = await post(dan.cookie, { op: 'save', site: 'roofing', customerName: 'Sarah', customerPostcode: 'BR6 0AA', customerPhone: '07700900123', status: 'completed' });
  await pool.query(`update jobs set job_date = (now() at time zone 'Europe/London')::date - 340, updated_at = now() - interval '200 days' where id = $1`, [job.id]);
  assert.deepEqual((await get(due, dan.cookie, '/api/admin/due')).messages.map((m) => m.message.kind), ['yearly']);
  await pool.query(`insert into service_contracts (business_slug, customer_name, customer_postcode, next_due_on) values ('roofing', 'sarah', 'BR60AA', now()::date + 60)`);
  assert.deepEqual((await get(due, dan.cookie, '/api/admin/due')).messages, [], 'on a plan, so the plan does the asking');
});

/* -------------------------------------------------------------- the time ---- */
test('clock in and out, on my way in your own name, and profit only for a manager', async () => {
  const dan = await personWith('Dan Smith', ['roofing'], 'work');
  const boss = await personWith('Scott Elson', ['roofing']);
  const { job } = await post(boss.cookie, { op: 'save', site: 'roofing', customerName: 'Sarah Jones', customerPhone: '07700900123', status: 'booked', invoiceNetPence: 100000 });
  const other = (await post(boss.cookie, { op: 'save', site: 'roofing', customerName: 'Ola', status: 'booked' })).job;

  const seen = (await post(dan.cookie, { op: 'clockin', id: other.id })).job;
  assert.ok(!('profit' in seen), 'no margin for a worker');
  const on = (await post(dan.cookie, { op: 'clockin', id: job.id })).job;
  assert.deepEqual(on.time.open, [dan.id]);
  assert.equal((await pool.query('select count(*)::int as n from job_time where ended_at is null')).rows[0].n, 1, 'clocking in here closed the other job');
  assert.equal(on.onMyWay['20'].text, "Hi Sarah, it's Dan from Verge Roofing, on my way, about 20 minutes.");
  assert.equal((await post(dan.cookie, { op: 'message', id: job.id, kind: 'onmyway', channel: 'whatsapp' })).ok, true, 'the departure is recorded');
  assert.equal((await post(dan.cookie, { op: 'rate', id: job.id, personId: dan.id, hourlyRatePence: 5000 })).ok, false, 'a worker cannot set pay');
  assert.equal((await post(dan.cookie, { op: 'miles', id: job.id, miles: 12.5 })).job.time.totalMiles, 12.5);
  assert.equal((await post(dan.cookie, { op: 'clockout', id: job.id })).job.time.open.length, 0);

  await pool.query(`update job_time set started_at = now() - interval '10 hours', ended_at = now() where job_id = $1`, [job.id]);
  await post(boss.cookie, { op: 'rate', id: job.id, personId: dan.id, hourlyRatePence: 2500 });
  await post(boss.cookie, { op: 'cost', id: job.id, label: 'Tiles', amountPence: 60000 });
  const fig = (await post(boss.cookie, { op: 'cost', id: job.id, label: 'Skip', amountPence: 0 })).job.profit;
  assert.deepEqual([fig.costsPence, fig.labourPence, fig.profitPence, fig.overBudget], [60000, 25000, 15000, true]);

  const ins = await get(insights, boss.cookie, '/api/admin/insights?area=roofing');
  assert.deepEqual(ins.overBudget.map((j) => [j.id, j.profitPence]), [[job.id, 15000]]);
  assert.equal((await get(insights, dan.cookie, '/api/admin/insights?area=roofing')).overBudget, null, 'money stays with managers');
});

test('Insights averages the ratings and the digest counts them, low ones called out', async () => {
  const boss = await personWith('Scott Elson', ['roofing']);
  for (const stars of [5, 4, 2]) {
    const { job } = await post(boss.cookie, { op: 'save', site: 'roofing', customerName: 'C' + stars, status: 'completed' });
    await call(publicQuote, { url: '/api/quote', body: { doc: 'rate', t: await tokenOf(job.id), stars } });
  }
  const r = (await get(insights, boss.cookie, '/api/admin/insights?area=roofing')).ratings;
  assert.deepEqual([r.count, r.average, r.five, r.low.length], [3, 3.7, 1, 1]);
  const lines = await digestFor({ slug: 'roofing', name: 'Verge Roofing', payout_model: 'roofing' });
  assert.ok(lines.includes('3 ratings received, averaging 3.7 stars.'), lines.join(' | '));
  assert.ok(lines.includes('1 low rating to look at.'));
  assert.ok(!lines.some((l) => /Since the last digest:.*rating/.test(l)), 'not said twice');
});
