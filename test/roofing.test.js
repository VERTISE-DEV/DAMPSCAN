/**
 * The Verge Roofing pipeline, planner, week board and forecast: stages are
 * derived from the job's facts, every move can be undone exactly, a planner
 * cost is one cost line however often it is edited, Today lists the missing
 * scaffold and the missed finishing steps, and the forecast is cached and
 * never holds a page up when the outside services fail.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'roofing-test-secret-long-enough-xxxxx';
process.env.IP_SALT = 'roofing-test-salt';
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

/* The outside world: postcodes.io and Open-Meteo, or a failure when `down`. */
let calls = [];
let down = false;
globalThis.fetch = async (url) => {
  calls.push(String(url));
  if (down) throw new Error('offline');
  if (String(url).includes('postcodes.io')) return { ok: true, status: 200, json: async () => ({ result: { latitude: 51.37, longitude: 0.1 } }) };
  if (String(url).includes('open-meteo')) {
    const start = new Date();
    const time = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => new Date(start.getTime() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }));
    return { ok: true, status: 200, json: async () => ({ daily: { time, weather_code: time.map(() => 61), precipitation_probability_max: time.map(() => 80),
      precipitation_sum: time.map(() => 6), wind_gusts_10m_max: time.map(() => 20) } }) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

const login = (await import('../lib/routes/auth/login.js')).default;
const dispatch = (await import('../api/admin/[action].js')).default;
const { TOOLS } = await import('../lib/mcp/tools.js');
const { scopeFor } = await import('../lib/access.js');
const { actionsFor } = await import('../lib/work.js');
const { workingDays } = await import('../lib/roofing.js');
const { parseForecast, dayFrom } = await import('../lib/weather.js');

function makeReq({ method = 'GET', url, body, headers = {} }) {
  return { method, url, body, headers: { host: 'dampscan.co.uk', 'x-forwarded-for': '203.0.113.9', 'user-agent': 't', ...headers }, socket: { remoteAddress: '203.0.113.9' } };
}
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; }, end(p) { this.body = p; } };
  res.json = () => (res.body ? JSON.parse(res.body) : null);
  return res;
}
async function call(handler, init) { const req = makeReq(init); const res = makeRes(); await handler(req, res); return res; }
async function person(name, code, grants, level = 'manage') {
  const h = await hash(code, { algorithm: Algorithm.Argon2id });
  const { rows } = await pool.query('insert into people (name, passcode_hash) values ($1,$2) returning id', [name, h]);
  for (const g of grants) await pool.query('insert into grants (person_id, business_slug, level) values ($1,$2,$3)', [rows[0].id, g, level]);
  const raw = (await call(login, { method: 'POST', url: '/api/auth/login', body: { code } })).getHeader('set-cookie');
  return { id: Number(rows[0].id), cookie: (Array.isArray(raw) ? raw.join('; ') : String(raw)).split(';')[0] };
}
const api = (who, method, url, body) => call(dispatch, { method, url, body, headers: { cookie: who.cookie } });
const roof = async (who, body) => (await api(who, 'POST', '/api/admin/roofing', body)).json();
const boardOf = async (who) => (await api(who, 'GET', '/api/admin/roofing?area=roofing')).json();
const cardOf = async (who, id) => (await boardOf(who)).jobs.find((j) => j.id === id);
async function job(who, extra = {}) {
  const r = (await api(who, 'POST', '/api/admin/quoted', { op: 'save', site: 'roofing', customerName: 'Mrs Anita Patel', customerPostcode: 'BR6 0AA', customerPhone: '07700 900123', status: 'quoted', invoiceNetPence: 500000, ...extra })).json();
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.job.id;
}
let D;

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => {
  await pool.query('truncate leads, jobs, people, audit, notifications, todos, job_photos, weather_cache restart identity cascade');
  D = (await pool.query(`select d::text as today, (d + 1)::text as tomorrow, (d + 3)::text as soon, (d - 6)::text as past from (select (now() at time zone 'Europe/London')::date as d) x`)).rows[0];
  calls = [];
  down = false;
});
after(async () => { await pool.end(); });

test('a roofing job walks the pipeline, each stage derived and each move undone exactly', async () => {
  const boss = await person('Tom Roofer', 'tom-code', ['roofing']);
  await pool.query(`insert into leads (site, stage, first_name, email, phone, postcode, session_id) values ('roofing', 'complete', 'Priya', 'p@x.com', '07700 900111', 'BR1 1AA', gen_random_uuid())`);
  const id = await job(boss);
  let board = await boardOf(boss);
  assert.deepEqual(board.enquiries.map((e) => e.firstName), ['Priya'], 'a finished enquiry is the first column');
  let c = board.jobs.find((j) => j.id === id);
  assert.equal(c.stage, 'quoted');
  assert.equal(c.firstName, 'Anita', 'first name, without the title');
  assert.ok(c.badges.includes('quote'), 'a quote not sent says so');
  assert.equal(c.next, 'Send the quote');

  assert.equal((await roof(boss, { op: 'stage', id, to: 'visit' })).error, 'bad_date', 'a site visit needs its day');
  assert.equal((await roof(boss, { op: 'stage', id, to: 'visit', date: D.tomorrow })).card.stage, 'visit');
  const won = await roof(boss, { op: 'stage', id, to: 'accepted' });
  assert.equal(won.card.stage, 'accepted');
  assert.ok(won.card.badges.includes('deposit') && won.card.badges.includes('scaffold') && won.card.badges.includes('materials'));
  const undone = await roof(boss, won.undo);
  assert.equal(undone.card.stage, 'visit', 'Undo puts the visit back, date and all');
  assert.equal(undone.card.siteVisitOn, D.tomorrow);
  await roof(boss, { op: 'stage', id, to: 'accepted' });
  assert.equal((await roof(boss, { op: 'stage', id, to: 'done' })).error, 'bad_stage', 'no skipping from accepted to done');
  const booked = await roof(boss, { op: 'stage', id, to: 'booked', date: D.soon, time: '08:00' });
  assert.equal(booked.card.stage, 'booked');
  assert.equal(booked.card.jobDate, D.soon);
  assert.equal((await roof(boss, { op: 'stage', id, to: 'in_progress' })).card.stage, 'in_progress');
  const finished = await roof(boss, { op: 'stage', id, to: 'done' });
  assert.equal(finished.card.stage, 'done');
  assert.ok(finished.card.badges.includes('unpaid'));
  assert.equal(finished.card.finish.length, 5, 'the finishing checklist appears once the roof is done');

  await api(boss, 'POST', '/api/admin/quoted', { op: 'payment', id, amountPence: 500000, label: 'balance' });
  c = await cardOf(boss, id);
  assert.equal(c.stage, 'paid', 'paid follows the payments, not a drag');
  assert.ok(c.badges.includes('review'));
  await pool.query('insert into job_ratings (job_id, stars) values ($1, 5)', [id]);
  assert.equal((await cardOf(boss, id)).stage, 'reviewed', 'reviewed follows the rating');

  const g = await roof(boss, { op: 'finish', id, step: 'google', on: true });
  assert.equal(g.card.finish.find((f) => f.key === 'google').done, true);
  await roof(boss, g.undo);
  assert.equal((await cardOf(boss, id)).finish.find((f) => f.key === 'google').done, false, 'the Google tick undoes');
  assert.ok((await pool.query("select 1 from audit where action = 'roofing_stage' and entity_id = $1", [id])).rows.length, 'moves are audited');
});

test('a planner cost is one cost line, updated in place and removed when cleared', async () => {
  const boss = await person('Tom Roofer', 'tom-code', ['roofing']);
  const ben = await person('Ben Slater', 'ben-code', ['roofing'], 'work');
  const id = await job(boss, { status: 'booked', jobDate: D.soon });
  let r = await roof(boss, { op: 'task', id, kind: 'scaffold', status: 'booked', date: D.soon, supplier: 'Acme', costPence: 45000 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.plan.scaffold.costLine, true);
  r = await roof(boss, { op: 'task', id, kind: 'scaffold', status: 'up', costPence: 47500 });
  const costs = (await pool.query('select label, amount_pence from job_costs where job_id = $1', [id])).rows;
  assert.deepEqual(costs.map((x) => [x.label, Number(x.amount_pence)]), [['Scaffold (Acme)', 47500]], 'edited, never doubled');
  assert.equal(r.job.costs.length, 1, 'the job screen sees the cost at once');
  assert.equal(r.card.plan.scaffold, 'up');
  await roof(boss, { op: 'task', id, kind: 'scaffold', costPence: null });
  assert.equal((await pool.query('select count(*)::int as n from job_costs where job_id = $1', [id])).rows[0].n, 0, 'clearing the cost clears the line');
  assert.equal((await roof(boss, { op: 'task', id, kind: 'materials', status: 'up' })).error, 'bad_task', 'materials are not "up"');
  r = await roof(boss, { op: 'task', id, kind: 'crew', personId: ben.id });
  assert.deepEqual(r.card.crew.map((x) => x.initials), ['BS']);
  assert.equal((await roof(boss, { op: 'plan', id, expectedDays: 3 })).card.expectedDays, 3);
  await roof(boss, { op: 'task', id, kind: 'crew', personId: ben.id, remove: true });
  assert.equal((await cardOf(boss, id)).crew.length, 0);
});

test('the week board places each working day, moves a start with Undo, and survives the forecast failing', async () => {
  const boss = await person('Tom Roofer', 'tom-code', ['roofing']);
  const id = await job(boss, { status: 'booked', jobDate: D.tomorrow });
  await roof(boss, { op: 'plan', id, expectedDays: 2 });
  const wk = (await api(boss, 'GET', `/api/admin/roofing?view=week&from=${D.tomorrow}`)).json();
  const mine = wk.jobs.find((j) => j.id === id);
  assert.ok(mine, JSON.stringify(wk));
  assert.equal(wk.days.length, 6, 'Monday to Saturday');
  assert.ok(mine.days.includes(D.tomorrow));
  assert.ok(mine.weather.length && mine.weather[0].warn === 'rain', 'an 80% chance of rain is a warning');
  assert.ok(mine.badges.includes('weather'));
  assert.equal((await pool.query('select count(*)::int as n from weather_cache')).rows[0].n, 1, 'the forecast is kept');
  const asked = calls.length;
  await api(boss, 'GET', `/api/admin/roofing?view=week&from=${D.tomorrow}`);
  assert.equal(calls.length, asked, 'a fresh forecast is not fetched again');

  const moved = await roof(boss, { op: 'date', id, date: D.soon });
  assert.equal(moved.card.jobDate, D.soon);
  assert.equal((await roof(boss, moved.undo)).card.jobDate, D.tomorrow, 'the move undoes');

  await pool.query('truncate weather_cache');
  down = true;
  const r = await api(boss, 'GET', '/api/admin/roofing?area=roofing');
  assert.equal(r.statusCode, 200, 'the board loads without a forecast');
  assert.equal(r.json().jobs.find((j) => j.id === id).weather.length, 0);

  assert.deepEqual(workingDays('2026-10-16', 3), ['2026-10-16', '2026-10-17', '2026-10-19'], 'Friday, Saturday, then Monday');
  assert.equal(dayFrom('2026-10-16', 3, 10, 0, 40).warn, 'wind');
  assert.equal(parseForecast(null).length, 0);
});

test('Today lists roofs to get ready and finishing steps missed; the assistant updates the planner', async () => {
  const boss = await person('Tom Roofer', 'tom-code', ['roofing']);
  const soon = await job(boss, { status: 'booked', jobDate: D.soon });
  const done = await job(boss, { customerName: 'Dev Shah', status: 'completed', jobDate: D.past });
  const scope = await scopeFor({ person: true, sub: boss.id });
  const work = await actionsFor(scope, ['roofing']);
  const prep = work.groups.find((g) => g.key === 'prep');
  assert.ok(prep && prep.items.some((i) => i.jobId === soon && /Scaffold not booked/.test(i.what)), JSON.stringify(work.groups.map((g) => g.key)));
  const finish = work.groups.find((g) => g.key === 'finish');
  assert.ok(finish && finish.items.some((i) => i.jobId === done && /google post/.test(i.what)));

  const tool = TOOLS.find((t) => t.name === 'update_roofing_plan');
  const r = await tool.run(scope, { id: soon, item: 'scaffold', status: 'booked', date: D.tomorrow, supplier: 'Acme', cost_pounds: 450 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.job.plan.scaffold, 'booked');
  const m = await tool.run(scope, { id: soon, item: 'materials', status: 'delivered' });
  assert.equal(m.data.job.plan.materials, 'delivered');
  const crew = await tool.run(scope, { id: soon, item: 'crew', person: 'tom' });
  assert.deepEqual(crew.data.job.crew, ['Tom Roofer']);
  const stage = await TOOLS.find((t) => t.name === 'set_roofing_stage').run(scope, { id: soon, stage: 'in_progress' });
  assert.equal(stage.data.job.stage, 'in_progress');
  const pipe = await TOOLS.find((t) => t.name === 'roofing_pipeline').run(scope, {});
  assert.ok(pipe.data.jobs.some((j) => j.id === soon && j.stage === 'in_progress'));
  assert.equal(Number((await pool.query('select sum(amount_pence) as s from job_costs where job_id = $1', [soon])).rows[0].s), 45000);
});
