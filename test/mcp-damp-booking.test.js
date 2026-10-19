/**
 * A survey booked over the phone, through the assistant, the way the owners'
 * ChatGPT sent it: survey type and surveyor as said aloud, a price that is
 * not the rate card's, contact details with no web enquiry behind them. It
 * failed as "unknown error" because the surveyor "Tom" is not the key 'tom'
 * and the route's field-keyed errors were never turned into words.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'mcp-damp-secret-long-enough-xxxxxxxxx';
process.env.IP_SALT = 'mcp-damp-salt-long-enough';

const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
mock.module('../lib/db.js', {
  namedExports: {
    sql: () => { throw new Error('not used'); },
    query: async (t, p = []) => (await pool.query(t, p)).rows,
    queryOne: async (t, p = []) => { const { rows } = await pool.query(t, p); return rows[0] || null; },
    ping: async () => true
  }
});

const { callTool } = await import('../lib/routes/admin/mcp.js');
const { reasonOf } = await import('../lib/mcp/shared.js');
const { scopeFor } = await import('../lib/access.js');
const clients = (await import('../lib/routes/admin/clients.js')).default;
const { callRoute } = await import('../lib/mcp/shared.js');

const owners = async () => ({ ...(await scopeFor({ person: false, name: 'Owners' })), viaAssistant: true });
const ASKED = {
  site: 'ati-london', customer_name: 'John Nicholls', postcode: 'SW2 2JX', phone: '07814 663729', email: 'jsnicholls@gmail.com',
  note: 'Full address: 23 Josephine Avenue, London SW2 2JX. Deposit £107.50 paid.', status: 'booked', job_date: '2026-10-20',
  job_time: '17:00', price_pounds: 215, survey_type: 'localised-basement', surveyor: 'Tom'
};

before(async () => {
  await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  await pool.query(`insert into job_rates (key, label, price_pence, surveyor_fee_pence, position) values ('localised-basement', 'Localised Basement', 25000, 11000, 5) on conflict (key) do nothing`);
});
beforeEach(async () => { await pool.query('truncate jobs, leads, todos, audit, notifications restart identity cascade'); });
after(async () => { await pool.end(); });

test('the owners\' failed ATi booking now goes through with everything said', async () => {
  const out = await callTool(await owners(), { name: 'create_job', arguments: { ...ASKED, deposit_paid: true } });
  assert.equal(out.isError, false, JSON.stringify(out.content));
  const j = (await pool.query('select * from jobs')).rows[0];
  assert.equal(j.site, 'ati-london');
  assert.equal(j.surveyor, 'tom');
  assert.equal(j.survey_type, 'localised-basement');
  assert.equal(Number(j.survey_price_pence), 21500, 'the price said replaces the rate card');
  assert.equal(String(j.job_time).slice(0, 5), '17:00');
  assert.equal(j.customer_phone, '07814 663729');
  assert.equal(j.customer_email, 'jsnicholls@gmail.com');
  assert.match(j.note, /Deposit £107.50 paid/);
  assert.ok(j.deposit_paid_at, 'deposit ticked');
  assert.equal((await pool.query("select count(*)::int as n from todos where source = 'failed'")).rows[0].n, 0);

  const cards = await callRoute(clients, await owners(), { url: '/api/admin/clients?view=all' });
  const card = cards.data.clients[0];
  assert.equal(card.phone, '07814 663729');
  assert.equal(card.email, 'jsnicholls@gmail.com');
  assert.equal(card.surveyDate, '2026-10-20');
});

test('a survey type is matched by its name, any case', async () => {
  const out = await callTool(await owners(), { name: 'create_job', arguments: { ...ASKED, survey_type: 'localised basement', surveyor: 'TOM' } });
  assert.equal(out.isError, false, JSON.stringify(out.content));
  assert.equal((await pool.query('select survey_type from jobs')).rows[0].survey_type, 'localised-basement');
});

test('an unknown survey type fails in words that list the real ones, and the to-do says so too', async () => {
  const out = await callTool(await owners(), { name: 'create_job', arguments: { ...ASKED, survey_type: 'attic' } });
  assert.equal(out.isError, true);
  assert.match(out.content[0].text, /Unknown survey type "attic"\. The survey types are: Localised \(localised\)/);
  const todo = (await pool.query("select text from todos where source = 'failed'")).rows[0].text;
  assert.match(todo, /Unknown survey type/);
  assert.doesNotMatch(todo, /unknown error/);
});

test('every failure shape becomes a sentence', () => {
  assert.equal(reasonOf({ ok: false, errors: { surveyor: 'Choose who surveyed it.', surveyType: 'Unknown.' } }), 'Choose who surveyed it. Unknown.');
  assert.equal(reasonOf({ ok: false, error: 'forbidden' }), 'You do not hold that business.');
  assert.equal(reasonOf({ ok: false, error: 'jobs_failed' }), 'The server hit an error saving it. Try again in a moment.');
  assert.equal(reasonOf(null), 'The server did not say why.');
});

test('update_client sets a phone and email on an ATi card, which then shows them over the enquiry\'s', async () => {
  const lead = (await pool.query(`insert into leads (session_id, site, stage, first_name, phone, email, postcode) values (gen_random_uuid(), 'ati-london', 'complete', 'Jo', '07000 000000', 'old@example.com', 'SW2 2JX') returning id`)).rows[0].id;
  await callTool(await owners(), { name: 'create_job', arguments: { ...ASKED, phone: undefined, email: undefined, lead_id: Number(lead) } });
  const id = Number((await pool.query('select id from jobs')).rows[0].id);
  const before = (await callRoute(clients, await owners(), { url: '/api/admin/clients?view=all' })).data.clients[0];
  assert.equal(before.phone, '07000 000000', 'the enquiry fills in behind');

  const out = await callTool(await owners(), { name: 'update_client', arguments: { id, phone: '07814 663729', email: 'jsnicholls@gmail.com' } });
  assert.equal(out.isError, false, JSON.stringify(out.content));
  const card = (await callRoute(clients, await owners(), { url: '/api/admin/clients?view=all' })).data.clients[0];
  assert.equal(card.phone, '07814 663729');
  assert.equal(card.email, 'jsnicholls@gmail.com');
  assert.ok((await pool.query('select deposit_paid_at from jobs')).rows[0].deposit_paid_at === null, 'no deposit unless said');
});

test('the client card dialog saves a phone and email, checked like the quoted trades', async () => {
  await callTool(await owners(), { name: 'create_job', arguments: { ...ASKED, phone: undefined, email: undefined } });
  const id = Number((await pool.query('select id from jobs')).rows[0].id);
  const bad = await callRoute(clients, await owners(), { method: 'POST', url: '/api/admin/clients', body: { id, email: 'not-an-email' } });
  assert.equal(bad.status, 400);
  const good = await callRoute(clients, await owners(), { method: 'POST', url: '/api/admin/clients', body: { id, phone: '020 7946 0000', email: 'a@b.co' } });
  assert.equal(good.status, 200, JSON.stringify(good.data));
  assert.equal(good.data.client.phone, '020 7946 0000');
  assert.equal(good.data.client.email, 'a@b.co');
});

test('update_client sets a full address and postcode, and the card shows the address', async () => {
  await callTool(await owners(), { name: 'create_job', arguments: ASKED });
  const j = (await pool.query('select id from jobs')).rows[0];
  const r = await callTool(await owners(), { name: 'update_client', arguments: { id: 'Nicholls', address: '12 High Street, West Malling', postcode: 'me19 6qh' } });
  assert.equal(r.isError, false, JSON.stringify(r.content));
  const { rows: [row] } = await pool.query('select customer_address, customer_postcode from jobs where id = $1', [j.id]);
  assert.deepEqual(row, { customer_address: '12 High Street, West Malling', customer_postcode: 'ME19 6QH' });
  const card = (await callRoute(clients, await owners(), { url: '/api/admin/clients?view=all' })).data.clients[0];
  assert.equal(card.fullAddress, '12 High Street, West Malling');
});

test('a survey handed to Ben with no login of his own makes him the surveyor, on the owners\' list', async () => {
  await callTool(await owners(), { name: 'create_job', arguments: ASKED });
  const r = await callTool(await owners(), { name: 'handover_job', arguments: { id: 'Nicholls', to: 'Ben', note: 'Surveyor changed from Tom to Ben.' } });
  assert.equal(r.isError, false, JSON.stringify(r.content));
  assert.equal((await pool.query('select surveyor from jobs')).rows[0].surveyor, 'ben');
  const todo = (await pool.query('select text, for_owners from todos')).rows[0];
  assert.match(todo.text, /^For Ben:/);
  assert.equal(todo.for_owners, true);
  const t = await callTool(await owners(), { name: 'add_todo', arguments: { text: 'Ring Nicholls', for: 'Tom' } });
  assert.equal(t.isError, false, JSON.stringify(t.content));
});

test('still_to_pay counts the surveys not yet paid in full', async () => {
  await callTool(await owners(), { name: 'create_job', arguments: { ...ASKED, job_date: '2026-10-01' } });
  await pool.query(`update jobs set status = 'completed'`);
  const r = await callTool(await owners(), { name: 'still_to_pay', arguments: {} });
  assert.equal(r.isError, false, JSON.stringify(r.content));
  assert.equal(r.structuredContent.count, 1);
  assert.equal(r.structuredContent.list[0].business, 'ATi');
});

test('owner_briefing and match_email answer for the owners', async () => {
  await callTool(await owners(), { name: 'create_job', arguments: ASKED });
  const b = await callTool(await owners(), { name: 'owner_briefing', arguments: { weeks_ago: 0 } });
  assert.equal(b.isError, false, JSON.stringify(b.content));
  assert.ok(b.structuredContent.businesses.some((x) => x.business === 'ATi'));
  const m = await callTool(await owners(), { name: 'match_email', arguments: { from_email: 'JSNicholls@gmail.com', text: 'Can we move the survey?' } });
  assert.equal(m.isError, false, JSON.stringify(m.content));
  assert.equal(m.structuredContent.jobs[0].customer, 'John Nicholls');
  const byPhone = await callTool(await owners(), { name: 'match_email', arguments: { from_email: 'other@example.com', text: 'ring me on 07814 663729' } });
  assert.equal(byPhone.structuredContent.jobs.length, 1);
});

test('a phone alert button ticks paid in full for its job only, and a forged one does nothing', async () => {
  const { quickButtons } = await import('../lib/quick-action.js');
  const quick = (await import('../lib/routes/admin/quick.js')).default;
  await callTool(await owners(), { name: 'create_job', arguments: ASKED });
  const id = Number((await pool.query('select id from jobs')).rows[0].id);
  const [paid, deposit, open] = quickButtons(id, ['paid', 'deposit'], 'https://dampscan.co.uk/staff/jobs.html');
  assert.equal(paid.label, 'Paid in full');
  assert.equal(deposit.label, 'Deposit paid');
  assert.equal(open.action, 'view');
  const hit = async (url) => { const u = new URL(url); let body = ''; const res = { statusCode: 200, setHeader() {}, getHeader() {}, write(c) { body += c; }, end(c) { if (c) body += c; } };
    await quick({ method: 'POST', url: u.pathname + u.search, headers: {} }, res); return res.statusCode; };
  assert.equal(await hit(paid.url.replace(/sig=../, 'sig=00')), 403);
  assert.equal(await hit(paid.url.replace(`job=${id}`, `job=${id + 1}`)), 403);
  assert.equal((await pool.query('select paid_at from jobs')).rows[0].paid_at, null);
  assert.equal(await hit(paid.url), 200);
  assert.notEqual((await pool.query('select paid_at from jobs')).rows[0].paid_at, null);
});
