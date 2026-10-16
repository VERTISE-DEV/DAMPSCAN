/**
 * The assistant's day tools: handover, who is on, calls, visits done, the
 * report draft, the playbook, drafting messages, briefings and the guide.
 * Each is checked for scope (another business's job is not found), money
 * (only for managers) and the audit row catch_up reads.
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
const { callTool } = await import('../lib/routes/admin/mcp.js');
const { guideFor } = await import('../lib/mcp/guide-tools.js');
const { workingDaysOn } = await import('../lib/mcp/team-tools.js');
const { londonToday } = await import('../lib/pipeline.js');
const call = async (scope, name, args = {}) => (await callTool(scope, { name, arguments: args })).structuredContent;

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => { await pool.query('truncate leads, jobs, people, audit, notifications, todos, catchups, playbook_notes, job_payments restart identity cascade'); });
after(async () => { await pool.end(); });

async function person(name, site, level = 'manage') {
  const id = Number((await pool.query("insert into people (name, passcode_hash) values ($1, 'x') returning id", [name])).rows[0].id);
  await pool.query('insert into grants (person_id, business_slug, level) values ($1, $2, $3)', [id, site, level]);
  return { personId: id, name, isAdmin: false, businesses: [site], levels: { [site]: level }, viaAssistant: true };
}
const today = londonToday();
async function roofJob(extra = {}) {
  const r = await pool.query(`insert into jobs (site, status, job_date, job_time, customer_name, customer_postcode, customer_phone, customer_email, customer_address, invoice_net_pence, survey_price_pence, surveyor, tax_bp, lead_bp, lead_earner, partner_a, partner_b, reserve_bp, fee_bp, fee_floor_pence, split_bp)
    values ('roofing', $1, $2, '09:30', 'Sarah Jones', 'BR6 8AB', '07700900123', 's@x.com', '1 High St', 500000, 0, null, 0, 0, '', '', '', 1900, 1000, 0, 5000) returning id`, [extra.status || 'booked', extra.date || today]);
  return Number(r.rows[0].id);
}
async function dampJob() {
  const r = await pool.query(`insert into jobs (site, status, job_date, customer_name, customer_postcode, survey_price_pence, surveyor, tax_bp, lead_bp, lead_earner, partner_a, partner_b)
    values ('dampscan','booked',$1,'Dee Patel','ME1 1AA',45000,'tom',2000,1000,'scott','scott','tom') returning id`, [today]);
  return Number(r.rows[0].id);
}
const audit = async () => (await pool.query("select action, after_json->>'said' as said from audit where after_json ? 'said' order by id")).rows;

test('handover sets the assignee, gives them a to-do, and who_is_on shows it', async () => {
  const scott = await person('Scott', 'roofing');
  const tom = await person('Tom', 'roofing');
  await roofJob();
  const r = await call(scott, 'handover_job', { id: 'Sarah BR6', to: 'Tom' });
  assert.match(r.said, /Handed Sarah, BR6 to Tom/);
  const todo = (await pool.query('select for_person_id, text from todos')).rows[0];
  assert.equal(Number(todo.for_person_id), tom.personId);
  assert.match(todo.text, /1 High St/);
  const on = await call(scott, 'who_is_on', {});
  assert.deepEqual(Object.keys(on.days[0].on), ['Tom']);
  assert.deepEqual(on.days[0].free, ['Scott']);
  assert.match((await audit())[0].said, /handed Sarah, BR6 over to Tom/);
  const other = await person('Dan', 'ac');
  assert.equal((await callTool(other, { name: 'handover_job', arguments: { id: 'Sarah BR6', to: 'Tom' } })).isError, true, 'not their business');
});

test('log_call notes the job, moves it, and catch_up hears of it; an enquiry gets a staff note', async () => {
  const scott = await person('Scott', 'roofing');
  const tom = await person('Tom', 'roofing');
  const id = await roofJob();
  const r = await call(tom, 'log_call', { id: 'Sarah BR6', note: 'wants afternoon', time: '14:00' });
  assert.match(r.said, /moved/);
  const j = (await pool.query('select note, job_time::text from jobs where id = $1', [id])).rows[0];
  assert.match(j.note, /call: wants afternoon/);
  assert.equal(j.job_time, '14:00:00');
  await pool.query("insert into leads (site, stage, first_name, email, postcode, session_id) values ('roofing','complete','Ann','a@x.com','BR1 1AA',gen_random_uuid())");
  assert.match((await call(tom, 'log_call', { enquiry: 'Ann BR1', note: 'ring back Friday' })).said, /Ann, BR1/);
  assert.match((await pool.query('select staff_note from leads')).rows[0].staff_note, /ring back Friday/);
  const caught = await call(scott, 'catch_up', {});
  assert.ok(caught.groups.flatMap((g) => g.items).some((i) => /logged a call with Sarah, BR6/.test(i.what) && i.who === 'ChatGPT via Tom'));
});

test('job_done completes a damp survey, keeps findings and adds the report to-do', async () => {
  const tom = await person('Tom', 'dampscan');
  const id = await dampJob();
  const r = await call(tom, 'job_done', { id: 'Patel ME1', findings: 'rising damp rear wall' });
  assert.match(r.said, /Send report/);
  const j = (await pool.query('select status, note from jobs where id = $1', [id])).rows[0];
  assert.equal(j.status, 'completed');
  assert.match(j.note, /rising damp/);
  const t = (await pool.query('select text, due_on::text from todos')).rows[0];
  assert.equal(t.text, 'Send report for Dee, ME1');
  assert.equal(t.due_on, workingDaysOn(today));
  assert.equal(workingDaysOn('2026-10-16'), '2026-10-20', 'Friday plus two working days');
});

test('report drafts and the playbook are kept and shared', async () => {
  const scott = await person('Scott', 'roofing');
  const tom = await person('Tom', 'roofing');
  await roofJob();
  await call(scott, 'save_report_draft', { id: 'Sarah BR6', text: 'Roof is sound.' });
  assert.equal((await call(tom, 'get_report_draft', { id: 'Sarah BR6' })).draft, 'Roof is sound.');
  await call(scott, 'save_playbook_note', { section: 'tone', text: 'Friendly, sign off Cheers' });
  const pb = await call(tom, 'get_playbook', {});
  assert.equal(pb.sections.tone[0].text, 'Friendly, sign off Cheers', 'Tom reads what Scott saved');
  await call(tom, 'remove_playbook_note', { id: pb.sections.tone[0].id });
  assert.equal((await call(tom, 'get_playbook', {})).count, 0);
});

test('draft_message hides money from a worker; links_for builds tap links', async () => {
  const boss = await person('Scott', 'roofing');
  const worker = await person('Wes', 'roofing', 'work');
  /* A worker sees a customer's contacts only on a job handed to them. */
  await pool.query('update jobs set assigned_person_id = $1 where id = $2', [worker.personId, await roofJob()]);
  assert.ok((await call(boss, 'draft_message', { id: 'Sarah BR6', purpose: 'chase balance' })).context.owed);
  const w = await call(worker, 'draft_message', { id: 'Sarah BR6', purpose: 'chase balance' });
  assert.equal(w.context.owed, undefined);
  assert.equal(w.context.firstName, 'Sarah');
  const l = await call(worker, 'links_for', { id: 'Sarah BR6', text: 'Hi Sarah' });
  assert.match(l.links.whatsapp, /^https:\/\/wa\.me\/447700900123\?text=Hi%20Sarah/);
  assert.match(l.links.email, /^mailto:s%40x\.com/);
});

test('brief_me, customer_history, wrap_up_day and week_review answer within scope', async () => {
  const boss = await person('Scott', 'roofing');
  const worker = await person('Wes', 'roofing', 'work');
  await roofJob();
  await roofJob({ status: 'completed', date: '2025-01-10' });
  const b = await call(boss, 'brief_me', {});
  assert.equal(b.count, 1);
  assert.match(b.jobs[0].maps, /google\.com\/maps.*BR6/);
  assert.equal(b.jobs[0].phone, '07700900123');
  assert.equal(b.jobs[0].before.length, 1);
  assert.ok(b.jobs[0].owed);
  assert.equal((await call(worker, 'brief_me', {})).jobs[0].owed, null);
  const h = await call(worker, 'customer_history', { words: 'BR6 8AB' });
  assert.equal(h.jobs.length, 2);
  assert.equal(h.jobs[0].value, undefined);
  assert.equal((await call(await person('Dan', 'ac'), 'customer_history', { words: 'BR6 8AB' })).jobs.length, 0);
  const w = await call(boss, 'wrap_up_day', {});
  assert.equal(w.notDoneToday.length, 1);
  const wk = await call(boss, 'week_review', {});
  assert.ok('moneyIn' in wk.thisWeek);
  assert.ok(!('moneyInPence' in (await call(worker, 'week_review', {})).thisWeek));
});

test('every tool is in the guide, and the limits offer an alternative', async () => {
  const g = guideFor(TOOLS);
  const listed = g.groups.flatMap((x) => x.tools.map((t) => t.name)).sort();
  assert.deepEqual(listed, TOOLS.map((t) => t.name).sort());
  assert.ok(!g.groups.some((x) => x.key === 'other'), 'every tool has a home: ' + JSON.stringify(g.groups.find((x) => x.key === 'other')));
  assert.ok(g.limits.every((l) => l.instead));
  const scott = await person('Scott', 'roofing');
  assert.deepEqual((await call(scott, 'what_can_you_do', { topic: 'playbook' })).groups.map((x) => x.key), ['playbook']);
  assert.ok(guideFor([...TOOLS, { name: 'new_thing', title: 'New', description: 'Does a thing.' }]).groups.find((x) => x.key === 'other'));
});
