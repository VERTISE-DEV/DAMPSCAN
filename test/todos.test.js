/**
 * The shared to-do list (lib/todos.js, lib/mcp/todo-tools.js, the staff
 * route, and the failed-change catch in the MCP route).
 *
 * The rules under test: words are stored exactly as said, a name resolves to
 * a colleague in a shared business, each person sees only their businesses'
 * to-dos and general ones addressed to or set by them, a failed write lands
 * on the caller's list once (not a read, not a "which job?"), the person it
 * is for gets a buzz, and the digest counts what is open.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createECDH, randomBytes } from 'node:crypto';
import pg from 'pg';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'todos-test-secret-long-enough-xxxxxxxx';
process.env.IP_SALT = 'todos-test-salt-long-enough';
delete process.env.NTFY_TOPIC;

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
const { callRoute } = await import('../lib/mcp/shared.js');
const { callTool } = await import('../lib/routes/admin/mcp.js');
const todosRoute = (await import('../lib/routes/admin/todos.js')).default;
const { digestFor, todoLine } = await import('../lib/digest.js');
const { saveSubscription } = await import('../lib/push.js');
const { generateVapidKeys } = await import('../lib/webpush.js');
const { scopeFor } = await import('../lib/access.js');

async function person(name, grants, { admin = false } = {}) {
  const { rows } = await pool.query('insert into people (name, passcode_hash, is_admin) values ($1, $2, $3) returning id', [name, 'x', admin]);
  for (const slug of grants) await pool.query('insert into grants (person_id, business_slug, level) values ($1, $2, $3)', [rows[0].id, slug, 'manage']);
  return scopeFor({ person: true, sub: Number(rows[0].id) });
}
const run = async (scope, name, args = {}) => TOOLS.find((t) => t.name === name).run(scope, args);
const roofJob = async (name, postcode) => Number((await pool.query(
  `insert into jobs (site, status, invoice_net_pence, survey_price_pence, tax_bp, lead_bp, lead_earner, partner_a, partner_b, reserve_bp, fee_bp, fee_floor_pence, split_bp, customer_name, customer_postcode)
   values ('roofing', 'quoted', 0, 0, 0, 0, '', '', '', 1900, 1000, 0, 5000, $1, $2) returning id`, [name, postcode])).rows[0].id);

const realFetch = globalThis.fetch;
let pushes = [];
before(async () => {
  await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  globalThis.fetch = async (url) => { pushes.push(url); return new Response(null, { status: 201 }); };
});
beforeEach(async () => {
  pushes = [];
  await pool.query('truncate todos, jobs, people, audit, push_subscriptions restart identity cascade');
});
after(async () => { globalThis.fetch = realFetch; await pool.end(); });

test('Tom tells Scott about Laura: kept word for word, set by Tom, Scott sees it and ticks it off', async () => {
  const tom = await person('Tom', ['roofing']);
  const scott = await person('Scott Elson', ['roofing', 'ac']);
  const words = 'need to tell Scott about a potential job next week, name Laura';
  const made = await run(tom, 'add_todo', { text: words, for: 'Scott', customer: 'Laura' });
  assert.equal(made.status, 200, JSON.stringify(made.data));
  const row = (await pool.query('select * from todos')).rows[0];
  assert.equal(row.text, words, 'verbatim');
  assert.equal(Number(row.for_person_id), scott.personId);
  assert.equal(Number(row.set_by_person_id), tom.personId);
  assert.equal(row.site, 'roofing', 'Tom holds only roofing');
  assert.equal(row.lead_info, 'Laura', 'no job for Laura yet, so kept as a note');
  assert.equal(row.source, 'assistant');

  const listed = await run(scott, 'list_todos');
  assert.equal(listed.data.count, 1);
  assert.equal(listed.data.todos[0].setBy, 'Tom');
  assert.ok(listed.data.todos[0].createdAt);
  assert.equal((await run(tom, 'list_todos', { view: 'set' })).data.count, 1);
  assert.equal((await run(tom, 'list_todos', { view: 'mine' })).data.count, 0);

  assert.equal((await run(scott, 'complete_todo', { text: 'laura' })).status, 200);
  assert.equal((await run(scott, 'list_todos')).data.count, 0);
  assert.equal((await run(scott, 'list_todos', { view: 'done' })).data.todos[0].doneBy, 'Scott Elson');
  assert.equal((await run(scott, 'reopen_todo', { text: 'Laura' })).status, 200);
  assert.equal((await run(scott, 'list_todos')).data.count, 1);
  const audits = (await pool.query("select action from audit where entity = 'todo' order by id")).rows.map((r) => r.action);
  assert.deepEqual(audits, ['add', 'done', 'reopen']);
});

test('names resolve only within shared businesses, and a customer links the job', async () => {
  const tom = await person('Tom', ['roofing']);
  await person('Scott', ['roofing']);
  await person('Sam', ['ac']);
  assert.match((await run(tom, 'add_todo', { text: 'x', for: 'Sam' })).data.error, /Nobody called Sam/);
  const job = await roofJob('Anita Patel', 'BR6 0AA');
  const r = await run(tom, 'add_todo', { text: 'Order lead', for: 'me', customer: 'Patel BR6', due_on: '2026-01-02' });
  assert.equal(r.data.todo.jobId, job);
  assert.equal(r.data.todo.customer, 'Anita Patel, BR6 0AA');
  assert.equal(r.data.todo.overdue, true);
});

test('each person sees only their businesses and general to-dos for or by them', async () => {
  const tom = await person('Tom', ['roofing']);
  const ann = await person('Ann', ['ac']);
  const owners = await scopeFor({ person: false, name: 'Owners' });
  await run(owners, 'add_todo', { text: 'Roofing note', business: 'roofing' });
  await run(owners, 'add_todo', { text: 'General for owners' });
  await run(ann, 'add_todo', { text: 'AC note' });
  const tomSees = (await run(tom, 'list_todos', { view: 'all' })).data.todos.map((t) => t.text);
  assert.deepEqual(tomSees, ['Roofing note']);
  const ownersSee = (await run(owners, 'list_todos', { view: 'all' })).data.todos.map((t) => t.text).sort();
  assert.deepEqual(ownersSee, ['AC note', 'General for owners', 'Roofing note']);
  assert.equal((await run(owners, 'list_todos', { view: 'set' })).data.todos[0].setBy, 'Owners');
  const id = (await pool.query("select id from todos where text = 'AC note'")).rows[0].id;
  assert.equal((await run(tom, 'complete_todo', { id: Number(id) })).status, 400, 'not his to tick');
});

test('the staff route lists, adds and ticks within scope', async () => {
  const tom = await person('Tom', ['roofing']);
  const scott = await person('Scott', ['roofing']);
  const add = await callRoute(todosRoute, tom, { method: 'POST', url: '/api/admin/todos', body: { op: 'add', text: 'Ring the scaffolder', forPersonId: scott.personId, dueOn: '2026-12-01' } });
  assert.equal(add.status, 200, JSON.stringify(add.data));
  const list = await callRoute(todosRoute, scott, { url: '/api/admin/todos?view=open' });
  assert.equal(list.data.todos[0].text, 'Ring the scaffolder');
  assert.deepEqual(list.data.people.map((p) => p.name), ['Scott', 'Tom']);
  assert.equal((await callRoute(todosRoute, scott, { method: 'POST', url: '/api/admin/todos', body: { op: 'done', id: add.data.todo.id } })).status, 200);
  assert.equal((await callRoute(todosRoute, scott, { url: '/api/admin/todos?view=nope' })).status, 400);
  const outsider = await person('Ann', ['ac']);
  assert.equal((await callRoute(todosRoute, outsider, { method: 'POST', url: '/api/admin/todos', body: { op: 'reopen', id: add.data.todo.id } })).status, 404);
});

test('a failed change goes on the caller\'s list once, reads and "which job?" do not', async () => {
  const tom = await person('Tom', ['roofing']);
  const job = await roofJob('Anita Patel', 'BR6 0AA');
  const bad = await callTool(tom, { name: 'book_job', arguments: { id: 'Patel', date: 'next tuesday' } });
  assert.equal(bad.isError, true);
  assert.equal(bad.content.at(-1).text, 'Saved to your to-do list.');
  await callTool(tom, { name: 'book_job', arguments: { id: 'Patel', date: 'next tuesday' } });
  const rows = (await pool.query('select * from todos')).rows;
  assert.equal(rows.length, 1, 'a retry is not saved twice');
  assert.equal(rows[0].source, 'failed');
  assert.equal(Number(rows[0].for_person_id), tom.personId);
  assert.equal(Number(rows[0].job_id), job);
  assert.match(rows[0].text, /^Tried to book .*Patel.*next tuesday.*did not go through/i);
  assert.equal((await run(tom, 'list_todos', { view: 'failed' })).data.count, 1);

  await callTool(tom, { name: 'get_job', arguments: { id: 9999 } });
  await roofJob('Anita Patel', 'BR6 9ZZ');
  const ambiguous = await callTool(tom, { name: 'book_job', arguments: { id: 'Patel', date: '2026-11-03' } });
  assert.equal(ambiguous.isError, true);
  assert.equal(ambiguous.content.length, 1);
  assert.equal(Number((await pool.query('select count(*) from todos')).rows[0].count), 1);
});

test('the person it is for gets a buzz; setting your own does not', async () => {
  const keys = generateVapidKeys();
  Object.assign(process.env, { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'mailto:owner@example.com' });
  try {
    const tom = await person('Tom', ['roofing']);
    const scott = await person('Scott', ['roofing']);
    const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
    const sub = (n) => ({ endpoint: `https://push.example.com/${n}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } });
    assert.ok(await saveSubscription(scott, sub('scott')));
    assert.ok(await saveSubscription(tom, sub('tom')));
    await run(tom, 'add_todo', { text: 'Laura next week', for: 'Scott' });
    assert.deepEqual(pushes, ['https://push.example.com/scott']);
    await run(tom, 'add_todo', { text: 'Note to self', for: 'me' });
    assert.equal(pushes.length, 1);
  } finally {
    delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY; delete process.env.VAPID_SUBJECT;
  }
});

test('the morning digest counts open and overdue to-dos per person', async () => {
  const tom = await person('Tom', ['roofing']);
  await person('Scott', ['roofing']);
  await run(tom, 'add_todo', { text: 'a', for: 'Scott', due_on: '2020-01-01' });
  await run(tom, 'add_todo', { text: 'b', for: 'Scott' });
  await run(tom, 'add_todo', { text: 'c', for: 'everyone' });
  const lines = await digestFor({ slug: 'roofing', payout_model: 'quoted' });
  assert.ok(lines.includes('3 open to-dos (Everyone 1, Scott 2), 1 overdue.'), lines.join(' | '));
  assert.equal(await todoLine(null), null);
});
