/**
 * catch_up: who did what since the person last asked, grouped, scoped to
 * their businesses, without their own changes, and the bookmark moving on.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
mock.module('../lib/db.js', {
  namedExports: {
    sql: () => { throw new Error('not used'); },
    query: async (t, p = []) => (await pool.query(t, p)).rows,
    queryOne: async (t, p = []) => { const { rows } = await pool.query(t, p); return rows[0] || null; },
    ping: async () => true
  }
});

const { TOOLS } = await import('../lib/mcp/tools.js');
const { notify } = await import('../lib/notify.js');
const { record } = await import('../lib/audit.js');
const { actorStore } = await import('../lib/actor.js');
const { groupOf, hideMoney, parseSince } = await import('../lib/catch-up.js');
const catchUp = (scope, args = {}) => TOOLS.find((t) => t.name === 'catch_up').run(scope, args);

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => { await pool.query('truncate leads, jobs, people, audit, notifications, todos, catchups restart identity cascade'); });
after(async () => { await pool.end(); });

async function person(name, site, level = 'manage') {
  const id = Number((await pool.query("insert into people (name, passcode_hash) values ($1, 'x') returning id", [name])).rows[0].id);
  await pool.query('insert into grants (person_id, business_slug, level) values ($1, $2, $3)', [id, site, level]);
  return { personId: id, name, isAdmin: false, businesses: [site], levels: { [site]: level }, viaAssistant: true };
}
const as = (scope, fn) => actorStore.run({ scope }, fn);

test('groups what others did, names them, scopes to the business and leaves out my own', async () => {
  const scott = await person('Scott', 'roofing');
  const tom = await person('Tom', 'roofing');
  const dan = await person('Dan', 'ac');
  await pool.query("insert into leads (site, stage, first_name, email, postcode, session_id) values ('roofing','complete','sarah jones','s@x.com','BR6 8AB',gen_random_uuid()), ('ac','complete','Al','a@x.com','ME1 1AA',gen_random_uuid())");
  const job = Number((await pool.query("insert into jobs (site, status, customer_name, customer_postcode, survey_price_pence, surveyor, tax_bp, lead_bp, lead_earner, partner_a, partner_b) values ('roofing','booked','Ola Smith','SE9 1AA',0,null,0,0,'','','') returning id")).rows[0].id);
  await as(tom, () => notify({ business: 'roofing', kind: 'payment', ref: job, title: 'Payment in: Ola, SE9', message: 'Deposit £500 received.' }));
  await as(tom, () => notify({ business: 'roofing', kind: 'activity', title: 't', message: 'Tom (via ChatGPT) issued the invoice for Ola, SE9.' }));
  await as(scott, () => notify({ business: 'roofing', kind: 'activity', title: 't', message: 'Scott booked Ola, SE9.' }));
  await as(dan, () => notify({ business: 'ac', kind: 'activity', title: 't', message: 'Dan booked Al, ME1.' }));
  await record({ scope: tom, business: 'roofing', entity: 'lead', entityId: 1, action: 'close', after: { closed_reason: 'spam' } });
  await pool.query("insert into todos (site, text, for_person_id, set_by_person_id, set_by_name) values ('roofing','Ring Ola',$1,$2,'Tom')", [scott.personId, tom.personId]);

  const r = (await catchUp(scott)).data;
  const by = Object.fromEntries(r.groups.map((g) => [g.key, g]));
  assert.deepEqual(by.enquiries.items.map((i) => i.customer), ['Sarah, BR6'], 'only my business');
  assert.equal(by.payments.items[0].who, 'ChatGPT via Tom');
  assert.equal(by.payments.items[0].customer, 'Ola, SE9');
  assert.match(by.quotes.items[0].what, /^issued the invoice for Ola, SE9/);
  assert.match(by.closures.items[0].what, /closed the enquiry from Sarah, BR6 \(spam\)/);
  assert.match(by.todos.items[0].what, /Ring Ola/);
  assert.ok(!by.bookings, 'my own booking is left out');
  assert.match(r.summary, /^Since .*1 new enquiries/);
  assert.ok(!JSON.stringify(r).includes('Al, ME1'));

  const mine = (await catchUp(scott, { since: '2 days', include_mine: true, peek: true })).data;
  assert.ok(mine.groups.some((g) => g.key === 'bookings'));
});

test('the bookmark moves on unless peeking, and since overrides it', async () => {
  const scott = await person('Scott', 'roofing');
  await pool.query("insert into leads (site, stage, first_name, email, postcode, session_id) values ('roofing','complete','Ann','a@x.com','BR1 1AA',gen_random_uuid())");
  assert.equal((await catchUp(scott, { peek: true })).data.total, 1);
  assert.equal((await pool.query('select count(*)::int as n from catchups')).rows[0].n, 0, 'peek leaves it');
  assert.equal((await catchUp(scott)).data.total, 1);
  const again = (await catchUp(scott)).data;
  assert.equal(again.total, 0);
  assert.match(again.said, /^Nothing new since/);
  assert.equal((await catchUp(scott, { since: 'yesterday' })).data.total, 1);
  assert.equal((await catchUp(scott, { since: 'whenever' })).status, 400);
});

test('money is hidden from someone who only works on the business', async () => {
  const tom = await person('Tom', 'roofing');
  const worker = await person('Wes', 'roofing', 'work');
  await as(tom, () => notify({ business: 'roofing', kind: 'activity', title: 't', message: 'Tom added a £260 cost to Ola, SE9.' }));
  const line = (await catchUp(worker)).data.groups[0].items[0].what;
  assert.equal(line, 'added a cost to Ola, SE9');
  assert.match((await catchUp(tom, { since: '1', include_mine: true })).data.groups[0].items[0].what, /£260/, 'a manager sees it');
});

test('words: grouping, money and since', () => {
  assert.equal(groupOf('activity', 'marked a message sent on Ola'), 'other');
  assert.equal(groupOf('activity', 'removed a payment from Ola'), 'payments');
  assert.equal(groupOf('job_status', ''), 'bookings');
  assert.equal(hideMoney('Deposit £1,500.50 received (£20).'), 'Deposit received.');
  const now = new Date('2026-10-16T12:00:00Z');
  assert.equal(parseSince('3', now).toISOString(), '2026-10-16T09:00:00.000Z');
  assert.equal(parseSince('yesterday', now).toISOString(), '2026-10-14T23:00:00.000Z');
  assert.equal(parseSince('nope', now), null);
});
