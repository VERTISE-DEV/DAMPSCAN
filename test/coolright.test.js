/**
 * CoolRight: the install pipeline derived from the job's facts with every
 * move undone exactly, the units and the commissioning and F-gas record, a
 * service plan in one tap with its recurring income, the service round
 * grouped by district and booked onto the calendar, the Before summer list,
 * warranties ending on Today, and the assistant's tools.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'coolright-test-secret-long-enough-xxx';
process.env.IP_SALT = 'coolright-test-salt';
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

globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });

const login = (await import('../lib/routes/auth/login.js')).default;
const dispatch = (await import('../api/admin/[action].js')).default;
const { TOOLS } = await import('../lib/mcp/tools.js');
const { scopeFor } = await import('../lib/access.js');
const { actionsFor } = await import('../lib/work.js');
const { districtOf } = await import('../lib/coolright-kit.js');

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
const ac = async (who, body) => (await api(who, 'POST', '/api/admin/coolright', body)).json();
const boardOf = async (who) => (await api(who, 'GET', '/api/admin/coolright?area=ac')).json();
const cardOf = async (who, id) => (await boardOf(who)).jobs.find((j) => j.id === id);
async function job(who, extra = {}) {
  const r = (await api(who, 'POST', '/api/admin/quoted', { op: 'save', site: 'ac', customerName: 'Mrs Anita Patel', customerPostcode: 'ME14 5AB', customerPhone: '07700 900123', status: 'quoted', invoiceNetPence: 500000, ...extra })).json();
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.job.id;
}
let D;


before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => {
  await pool.query('truncate leads, jobs, people, audit, notifications, todos, job_photos, service_contracts restart identity cascade');
  D = (await pool.query(`select d::text as today, (d + 1)::text as tomorrow, (d + 3)::text as soon, (d - 6)::text as past, (d + 30)::text as month,
    (d + 400)::text as far from (select (now() at time zone 'Europe/London')::date as d) x`)).rows[0];
});
after(async () => { await pool.end(); });

test('a CoolRight job walks the install pipeline, each stage derived and each move undone exactly', async () => {
  const boss = await person('Cara Cool', 'cara-code', ['ac']);
  await pool.query(`insert into leads (site, stage, first_name, email, phone, postcode, session_id) values ('ac', 'complete', 'Priya', 'p@x.com', '07700 900111', 'ME1 1AA', gen_random_uuid())`);
  const id = await job(boss);
  let board = await boardOf(boss);
  assert.deepEqual(board.enquiries.map((e) => e.firstName), ['Priya']);
  let c = board.jobs.find((j) => j.id === id);
  assert.equal(c.stage, 'quoted');
  assert.equal(c.firstName, 'Anita');
  assert.ok(c.badges.includes('survey') && c.badges.includes('quote'), 'no survey and no quote sent');

  assert.equal((await ac(boss, { op: 'stage', id, to: 'survey' })).error, 'bad_date', 'a survey needs its day');
  assert.equal((await ac(boss, { op: 'stage', id, to: 'survey', date: D.tomorrow })).card.stage, 'survey');
  const won = await ac(boss, { op: 'stage', id, to: 'accepted' });
  assert.equal(won.card.stage, 'accepted');
  assert.ok(won.card.badges.includes('deposit') && won.card.badges.includes('kit'));
  const undone = await ac(boss, won.undo);
  assert.equal(undone.card.stage, 'survey', 'Undo puts the survey back');
  assert.equal(undone.card.siteVisitOn, D.tomorrow);
  await ac(boss, { op: 'stage', id, to: 'accepted' });
  assert.equal((await ac(boss, { op: 'stage', id, to: 'commissioned' })).error, 'bad_stage', 'no skipping the install');

  const booked = await ac(boss, { op: 'date', id, date: D.soon, time: '08:30' });
  assert.equal(booked.card.status, 'booked');
  assert.equal(booked.card.jobDate, D.soon);
  assert.match(booked.card.next, /Take the deposit/);
  const kit = await ac(boss, { op: 'kit', id, status: 'ordered', supplier: 'AirCo Direct', costPence: 180000 });
  assert.equal(kit.card.kit, 'ordered');
  assert.ok(!kit.card.badges.includes('kit'));
  assert.equal(Number((await pool.query('select sum(amount_pence) as s from job_costs where job_id = $1', [id])).rows[0].s), 180000, 'the kit cost is one cost line');

  const fitted = await ac(boss, { op: 'stage', id, to: 'installed' });
  assert.equal(fitted.card.stage, 'installed');
  assert.ok(['commission', 'fgas', 'unpaid', 'plan'].every((b) => fitted.card.badges.includes(b)), JSON.stringify(fitted.card.badges));
  assert.equal(fitted.card.jobDate, D.soon, 'a booked install keeps its date');
  const comm = await ac(boss, { op: 'stage', id, to: 'commissioned' });
  assert.equal(comm.card.stage, 'commissioned');
  assert.equal(comm.card.commissionedOn, D.today);
  assert.equal((await ac(boss, comm.undo)).card.stage, 'installed', 'commissioning undoes');

  const rec = await ac(boss, { op: 'commission', id, commissionedOn: D.today, engineer: 'Sam Frost', fgasRef: 'FG-2291', leakCheckOn: D.today, pressureTest: '38 bar 30 min' });
  assert.equal(rec.card.stage, 'commissioned');
  assert.ok(!rec.card.badges.includes('fgas') && !rec.card.badges.includes('commission'));
  assert.equal(rec.card.engineer, 'Sam Frost');

  await api(boss, 'POST', '/api/admin/quoted', { op: 'payment', id, amountPence: 500000, label: 'balance' });
  c = await cardOf(boss, id);
  assert.equal(c.stage, 'paid', 'paid follows the payments');
  assert.equal(c.next, 'Add a service plan');
  assert.ok(c.badges.includes('plan'));
  assert.ok((await pool.query("select 1 from audit where action = 'coolright_stage' and entity_id = $1", [id])).rows.length, 'moves are audited');
});

test('units, a service plan in one tap with its income, warranties on Today and in the pop-up', async () => {
  const boss = await person('Cara Cool', 'cara-code', ['ac']);
  const id = await job(boss, { status: 'completed', jobDate: D.past });
  let r = await ac(boss, { op: 'unit', id, side: 'indoor', make: 'Daikin', model: 'FTXM25R', serial: 'S1', refrigerant: 'R32', chargeKg: 0.75, location: 'Main bedroom', warrantyUntil: D.month });
  assert.equal(r.ok, true, JSON.stringify(r));
  const unitId = r.unit.id;
  r = await ac(boss, { op: 'unit', id, side: 'outdoor', make: 'Daikin', model: 'RXM25R', chargeKg: 0.5, warrantyUntil: D.far });
  assert.equal(r.units.length, 2);
  r = await ac(boss, { op: 'unit', id, unitId, serial: 'S1-B' });
  assert.equal(r.unit.serial, 'S1-B');
  assert.equal(r.unit.make, 'Daikin', 'fields left out keep their value');
  assert.equal((await ac(boss, { op: 'unit', id, side: 'loft' })).error, 'bad_unit');
  assert.ok(r.card.badges.includes('warranty'), 'a warranty ending within 60 days is badged');

  const plan = await ac(boss, { op: 'plan', id, intervalMonths: 12, pricePence: 12000 });
  assert.equal(plan.ok, true, JSON.stringify(plan));
  assert.equal(plan.plan.intervalMonths, 12);
  const contract = (await pool.query('select * from service_contracts where job_id = $1', [id])).rows[0];
  assert.equal(Number(contract.unit_count), 1, 'one indoor unit');
  assert.equal(Number(contract.refrigerant_kg), 1.25, 'the charge of both units');
  assert.ok(plan.card.onPlan && !plan.card.badges.includes('plan'));
  const board = await boardOf(boss);
  assert.equal(board.income.plans, 1);
  assert.equal(board.income.annualPence, 12000);
  assert.equal(board.income.monthlyPence, 1000);
  assert.equal(board.warranties.length, 1);
  const ins = (await api(boss, 'GET', '/api/admin/insights?area=ac')).json();
  assert.equal(ins.recurring.monthlyPence, 1000, 'Insights shows the plan income');
  assert.equal((await ac(boss, plan.undo)).removed, contract.id * 1, 'Undo takes a new plan away');
  assert.equal((await pool.query('select count(*)::int as n from service_contracts')).rows[0].n, 0);

  const scope = await scopeFor({ person: true, sub: boss.id });
  const work = await actionsFor(scope, ['ac']);
  const w = work.groups.find((g) => g.key === 'warranty');
  assert.ok(w && w.items.length === 1 && w.items[0].jobId === id && /FTXM25R/.test(w.items[0].what), JSON.stringify(work.groups.map((g) => g.key)));
  const pop = (await api(boss, 'GET', `/api/admin/calendar?view=job&id=${id}`)).json();
  assert.equal(pop.job.coolright.units.length, 2, 'the pop-up shows the equipment');
  assert.equal(pop.job.coolright.plan, null);
});

test('the service round groups by district, books visits onto the calendar, and servicing clears the booking', async () => {
  const boss = await person('Cara Cool', 'cara-code', ['ac']);
  const a = await job(boss, { status: 'completed', jobDate: D.past });
  const b = await job(boss, { customerName: 'Dev Shah', customerPostcode: 'TN13 2AB', status: 'completed', jobDate: D.past });
  await ac(boss, { op: 'plan', id: a, intervalMonths: 12, pricePence: 9000, nextDueOn: D.soon });
  await ac(boss, { op: 'plan', id: b, intervalMonths: 6, pricePence: 6000, nextDueOn: D.past });
  await pool.query(`insert into service_contracts (business_slug, customer_name, customer_postcode, next_due_on) values ('ac', 'Far Away', 'CT1 1AA', $1)`, [D.far]);
  const svc = (await api(boss, 'GET', '/api/admin/coolright?area=ac&view=services')).json();
  assert.deepEqual(svc.districts.map((d) => d.district), ['ME14', 'TN13'], 'by area then district; next year is left out');
  const shah = svc.districts[1].services[0];
  assert.ok(shah.daysUntilDue < 0 && /wa\.me/.test(shah.message.links.whatsapp), 'overdue, with a WhatsApp booking message');

  const booked = await ac(boss, { op: 'book', contractId: shah.id, date: D.tomorrow, time: '10:00' });
  assert.equal(booked.bookedOn, D.tomorrow);
  const cal = (await api(boss, 'GET', `/api/admin/calendar?from=${D.today}&to=${D.soon}&area=ac`)).json();
  const ev = cal.events.find((e) => e.kind === 'service' && e.id === shah.id);
  assert.ok(ev && ev.date === D.tomorrow && ev.time === '10:00' && ev.status === 'service booked', JSON.stringify(cal.events));
  assert.equal((await ac(boss, booked.undo)).bookedOn, null, 'the booking undoes');
  await ac(boss, { op: 'book', contractId: shah.id, date: D.tomorrow });
  await api(boss, 'POST', '/api/admin/contracts', { op: 'serviced', id: shah.id });
  const row = (await pool.query('select booked_on, last_serviced_on::text as s from service_contracts where id = $1', [shah.id])).rows[0];
  assert.equal(row.booked_on, null, 'servicing clears the booked visit');
  assert.equal(row.s, D.today);

  const tool = TOOLS.find((t) => t.name === 'coolright_services_due');
  const scope = await scopeFor({ person: true, sub: boss.id });
  const me = await tool.run(scope, { area: 'ME' });
  assert.deepEqual(me.data.districts.map((d) => d.district), ['ME14']);
  assert.deepEqual(districtOf('me14 5ab'), { district: 'ME14', area: 'ME' });
});

test('the Before summer list asks each past customer once a year, and the assistant records kit and paperwork', async () => {
  const boss = await person('Cara Cool', 'cara-code', ['ac']);
  const a = await job(boss, { status: 'completed', jobDate: D.past });
  await job(boss, { customerName: 'Dev Shah', customerPostcode: 'TN13 2AB', status: 'quoted' });
  let list = (await api(boss, 'GET', '/api/admin/coolright?area=ac&view=summer')).json();
  assert.deepEqual(list.customers.map((c) => c.jobId), [a], 'only installed customers');
  assert.equal(list.customers[0].onPlan, false);
  assert.match(list.customers[0].message.text, /service plan/);
  const sent = await ac(boss, { op: 'summer', id: a, on: true });
  assert.equal(sent.card.summerAskedOn, D.today);
  list = (await api(boss, 'GET', '/api/admin/coolright?area=ac&view=summer')).json();
  assert.equal(list.customers[0].askedThisYear, true);
  await ac(boss, sent.undo);
  assert.equal((await cardOf(boss, a)).summerAskedOn, null, 'mark sent undoes');
  await api(boss, 'POST', '/api/admin/quoted', { op: 'message', id: a, kind: 'summer', channel: 'whatsapp' });
  assert.equal((await cardOf(boss, a)).summerAskedOn, D.today, 'tapping the WhatsApp link marks it sent too');

  const scope = await scopeFor({ person: true, sub: boss.id });
  const run = (name, args) => TOOLS.find((t) => t.name === name).run(scope, args);
  const u = await run('coolright_unit', { id: a, side: 'indoor', make: 'Mitsubishi', model: 'MSZ-LN25', refrigerant: 'R32', charge_kg: 0.8 });
  assert.equal(u.status, 200, JSON.stringify(u.data));
  assert.equal(u.data.units[0].make, 'Mitsubishi');
  const c1 = await run('coolright_commissioning', { id: a, commissioned_on: D.today, engineer: 'Sam' });
  assert.equal(c1.data.job.stage, 'commissioned');
  const c2 = await run('coolright_commissioning', { id: a, fgas_ref: 'FG-1' });
  assert.equal(c2.data.job.engineer, 'Sam', 'fields not given keep their value');
  assert.equal(c2.data.job.fgasRef, 'FG-1');
  const p = await run('coolright_service_plan', { id: a, interval_months: 12, price_pounds: 120 });
  assert.equal(p.data.plan.pricePence, 12000);
  const roofer = await person('Tom Roofer', 'tom-code', ['roofing']);
  const wrong = (await api(roofer, 'POST', '/api/admin/quoted', { op: 'save', site: 'roofing', customerName: 'Roof Person', status: 'quoted' })).json().job.id;
  assert.equal((await run('coolright_unit', { id: wrong, make: 'X' })).status, 404, 'a job outside CoolRight is not found here');
  assert.equal((await ac(roofer, { op: 'unit', id: a, make: 'X' })).error, 'not_found', 'a roofer cannot touch CoolRight');
});
