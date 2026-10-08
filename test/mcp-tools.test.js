/**
 * The assistant's write tools: the day's work from ChatGPT.
 *
 * Each tool is run as a real person's scope, the way the MCP route runs it,
 * and the database is read afterwards. The rules under test: a tool changes
 * exactly what the staff screen would, it stays inside the person's
 * businesses, a worker never sees the payout money, every change leaves an
 * audit row, and a spoken quote turns into priced lines from the price book.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'mcp-tools-secret-long-enough-xxxxxxxx';
process.env.IP_SALT = 'mcp-tools-salt-long-enough';

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
const { trimmed } = await import('../lib/mcp/shared.js');
const { priceLine } = await import('../lib/mcp/quote-tools.js');
const { scopeFor } = await import('../lib/access.js');

async function person(name, grants, { admin = false } = {}) {
  const { rows } = await pool.query('insert into people (name, passcode_hash, is_admin) values ($1, $2, $3) returning id', [name, 'x', admin]);
  for (const [slug, level] of grants) await pool.query('insert into grants (person_id, business_slug, level) values ($1, $2, $3)', [rows[0].id, slug, level]);
  return scopeFor({ person: true, sub: Number(rows[0].id) });
}
/** Runs a tool as the MCP route does, money trim included. */
async function run(scope, name, args = {}) {
  const tool = TOOLS.find((t) => t.name === name);
  assert.ok(tool, `no tool ${name}`);
  return trimmed(await tool.run(scope, args), scope);
}
const roofJob = async (extra = '') => Number((await pool.query(
  `insert into jobs (site, status, invoice_net_pence, survey_price_pence, tax_bp, lead_bp, lead_earner, partner_a, partner_b, reserve_bp, fee_bp, fee_floor_pence, split_bp, customer_name, customer_phone, customer_email, customer_postcode${extra ? ', ' + extra.split('=')[0] : ''})
   values ('roofing', 'quoted', 0, 0, 0, 0, '', '', '', 1900, 1000, 0, 5000, 'Anita Patel', '07700 900123', 'anita@example.com', 'BR6 0AA'${extra ? ', ' + extra.split('=')[1] : ''}) returning id`)).rows[0].id);

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => {
  await pool.query('truncate jobs, people, audit, notifications, price_items, quote_templates, bank_statements, bank_transactions restart identity cascade');
  await pool.query("update businesses set trading_address = '1 High Street, Orpington' where slug = 'roofing'");
});
after(async () => { await pool.end(); });

test('a job is started, booked, noted, costed and timed from the assistant, each audited', async () => {
  const me = await person('Scott', [['roofing', 'manage']]);
  const made = await run(me, 'create_job', { site: 'roofing', customer_name: 'Anita Patel', postcode: 'BR6 0AA', phone: '07700 900123', note: 'Leaking valley' });
  assert.equal(made.status, 200, JSON.stringify(made.data));
  const id = made.data.job.id;
  assert.equal(made.data.job.status, 'quoted');

  assert.equal((await run(me, 'book_job', { id, date: '2026-11-03', time: '08:30' })).status, 200);
  assert.equal((await run(me, 'add_note', { id, text: 'Side gate code 1234' })).status, 200);
  assert.equal((await run(me, 'add_cost', { id, label: 'Skip', amount_pounds: 240 })).status, 200);
  assert.equal((await run(me, 'log_time', { id, action: 'hours', hours: 6, date: '2026-11-03' })).status, 200);
  assert.equal((await run(me, 'log_miles', { id, miles: 12.5 })).status, 200);
  assert.equal((await run(me, 'update_job_status', { id, status: 'completed' })).status, 200);
  assert.equal((await run(me, 'update_job_status', { id, status: 'paid' })).status, 400, 'paid only comes from the money');

  const job = (await pool.query('select status, job_date::text, job_time::text, note, customer_name, customer_phone from jobs where id = $1', [id])).rows[0];
  assert.equal(job.status, 'completed');
  assert.equal(job.job_date, '2026-11-03');
  assert.equal(job.customer_name, 'Anita Patel', 'adding a note keeps everything else');
  assert.equal(job.customer_phone, '07700 900123');
  assert.match(job.note, /^Leaking valley\n.+: Side gate code 1234$/);
  assert.equal(Number((await pool.query('select amount_pence from job_costs where job_id = $1', [id])).rows[0].amount_pence), 24000);
  const hours = (await pool.query('select extract(epoch from ended_at - started_at) / 3600 as h from job_time where job_id = $1', [id])).rows[0].h;
  assert.equal(Number(hours), 6);
  assert.equal(Number((await pool.query('select miles from job_miles where job_id = $1', [id])).rows[0].miles), 12.5);

  const actions = (await pool.query('select action, person_id from audit where entity_id = $1 order by id', [id])).rows;
  assert.ok(actions.length >= 7);
  assert.ok(actions.every((a) => Number(a.person_id) === me.personId));
});

test('nobody reaches a job outside their businesses, and a worker sees no payout money', async () => {
  const roof = await roofJob();
  const acOnly = await person('Cara', [['ac', 'manage']]);
  for (const [name, args] of [['add_cost', { id: roof, label: 'x', amount_pounds: 1 }], ['add_note', { id: roof, text: 'hi' }], ['book_job', { id: roof, date: '2026-11-01' }],
    ['get_message', { id: roof, kind: 'quote' }], ['create_invoice', { id: roof }], ['build_quote_from_words', { id: roof }]]) {
    assert.equal((await run(acOnly, name, args)).status, 404, name);
  }
  assert.equal((await run(acOnly, 'create_job', { site: 'roofing', customer_name: 'X' })).status, 400);

  const worker = await person('Wes', [['roofing', 'work']]);
  const r = await run(worker, 'add_cost', { id: roof, label: 'Lead flashing', amount_pounds: 85 });
  assert.equal(r.status, 200);
  for (const k of ['payout', 'payoutRows', 'frozen', 'rates', 'profit']) assert.ok(!(k in r.data.job), `${k} hidden from a worker`);
  const boss = await person('Bea', [['roofing', 'manage']]);
  assert.ok('payout' in (await run(boss, 'add_cost', { id: roof, label: 'Nails', amount_pounds: 5 })).data.job, 'a manager still sees it');
});

test('a spoken quote becomes priced lines from the price book, all or nothing', async () => {
  const me = await person('Scott', [['roofing', 'manage']]);
  const id = await roofJob();
  const tiles = (await pool.query(`insert into price_items (business_slug, kind, description, unit, cost_pence) values ('roofing', 'materials', 'Redland 49 tiles', 'm2', 2500) returning id`)).rows[0].id;
  const labour = (await pool.query(`insert into price_items (business_slug, kind, description, unit, cost_pence) values ('roofing', 'labour', 'Roofer day', 'day', 22000) returning id`)).rows[0].id;

  const first = await run(me, 'build_quote_from_words', { id });
  assert.equal(first.data.added, 0);
  assert.deepEqual(first.data.priceBook.items.map((i) => i.description).sort(), ['Redland 49 tiles', 'Roofer day']);

  const bad = await run(me, 'build_quote_from_words', { id, lines: [{ price_book_item_id: Number(tiles), qty: 40 }, { label: 'Scaffold front and back' }] });
  assert.equal(bad.status, 400, 'scaffold has no price');
  assert.equal(Number((await pool.query('select count(*) from quote_lines where job_id = $1', [id])).rows[0].count), 0, 'nothing half added');

  const ok = await run(me, 'build_quote_from_words', { id, lines: [
    { price_book_item_id: Number(tiles), qty: 40 }, { price_book_item_id: Number(labour), qty: 2 }, { label: 'Scaffold front and back', kind: 'scaffolding', unit_price_pounds: 900 }] });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const lines = (await pool.query('select kind, description, cost_pence from quote_lines where job_id = $1 order by id', [id])).rows;
  assert.deepEqual(lines.map((l) => [l.kind, Number(l.cost_pence)]), [['materials', 100000], ['labour', 44000], ['scaffolding', 90000]]);
  assert.match(lines[0].description, /Redland 49 tiles, 40 m2 at £25\.00/);

  assert.equal((await run(me, 'remove_quote_line', { id, line_id: ok.data.quote.lines[2].id })).status, 200);
  assert.equal((await run(me, 'add_quote_line', { id, kind: 'waste', description: 'Skip', cost_pounds: 240 })).status, 200);
  await pool.query(`insert into quote_templates (business_slug, name, lines) values ('roofing', 'Ridge repoint', '[{"kind":"labour","description":"Repoint ridge","costPence":30000}]')`);
  assert.equal((await run(me, 'create_quote_from_template', { id, template_name: 'ridge repoint' })).status, 200);
  assert.equal(Number((await pool.query('select count(*) from quote_lines where job_id = $1', [id])).rows[0].count), 4);

  assert.deepEqual(priceLine({ label: 'Lead', qty: 3, unit_price_pounds: 10.5 }, []), { kind: 'other', description: 'Lead, 3 at £10.50', costPence: 3150 });
  assert.ok(priceLine({ price_book_item_id: 999 }, []).error);
});

test('messages come back as words and links, are marked sent, and links and invoices are made once', async () => {
  const me = await person('Scott', [['roofing', 'manage']]);
  const id = await roofJob();
  const link = await run(me, 'get_quote_link', { id });
  assert.match(link.data.quoteUrl, /\/quote\.html\?t=/);
  assert.equal((await run(me, 'get_quote_link', { id })).data.quoteUrl, link.data.quoteUrl, 'the same link again');

  const way = await run(me, 'get_message', { id, kind: 'onmyway', minutes: 20 });
  assert.equal(way.status, 200, JSON.stringify(way.data));
  assert.match(way.data.words, /20 minutes/);
  assert.match(way.data.links.whatsapp, /^https:\/\/wa\.me\/447700900123\?text=/);
  assert.match(way.data.links.email, /^mailto:anita%40example\.com/);
  assert.equal((await run(me, 'get_message', { id, kind: 'rating' })).status, 400, 'no rating ask on a quote');
  assert.equal((await run(me, 'mark_message_sent', { id, kind: 'onmyway', channel: 'whatsapp' })).status, 200);
  assert.equal((await pool.query('select channel from job_messages where job_id = $1', [id])).rows[0].channel, 'whatsapp');

  assert.equal((await run(me, 'get_invoice_link', { id })).status, 400, 'no invoice yet');
  assert.equal((await run(me, 'create_invoice', { id })).status, 400, 'not booked and no price');
  await pool.query("update jobs set status = 'booked', invoice_net_pence = 500000 where id = $1", [id]);
  const inv = await run(me, 'create_invoice', { id });
  assert.equal(inv.status, 200, JSON.stringify(inv.data));
  assert.match(inv.data.invoice.number, /-0001$/);
  assert.equal((await run(me, 'create_invoice', { id })).data.invoice.number, inv.data.invoice.number, 'one number per job');
  assert.equal((await run(me, 'get_invoice_link', { id })).data.invoice.number, inv.data.invoice.number);
});

test('project page, insights answers, and a bank payment matched to a job', async () => {
  const me = await person('Scott', [['roofing', 'manage']], { admin: true });
  const id = await roofJob();
  const page = await run(me, 'set_project_page', { id, title: 'New roof', town: 'Orpington', writeup: 'Short', publish: true });
  assert.equal(page.status, 400, 'too short and not finished, so not published');
  assert.ok(page.data.errors);
  assert.equal((await pool.query('select page_title from jobs where id = $1', [id])).rows[0].page_title, 'New roof', 'what was typed is kept');
  assert.equal((await run(me, 'get_google_post', { id })).data.ok, false);

  for (const name of ['insights_summary', 'ratings', 'over_budget_jobs', 'pages_to_write', 'due_messages_today']) {
    const r = await run(me, name, { area: 'roofing' });
    assert.equal(r.status, 200, name);
  }

  await pool.query("update jobs set status = 'booked', invoice_net_pence = 100000 where id = $1", [id]);
  const st = (await pool.query("insert into bank_statements (books, filename) values ('roofing', 'x.csv') returning id")).rows[0].id;
  const tx = (await pool.query(`insert into bank_transactions (statement_id, books, fingerprint, posted_on, description, amount_pence) values ($1, 'roofing', 'fp1', current_date, 'PATEL A', 50000) returning id`, [st])).rows[0].id;
  const open = await run(me, 'list_unmatched_payments', { books: 'roofing' });
  assert.equal(open.status, 200, JSON.stringify(open.data));
  assert.deepEqual(open.data.payments.map((p) => p.id), [Number(tx)]);
  const matched = await run(me, 'match_payment', { transaction_id: Number(tx), job_id: id, books: 'roofing' });
  assert.equal(matched.status, 200, JSON.stringify(matched.data));
  assert.deepEqual((await run(me, 'list_unmatched_payments', { books: 'roofing' })).data.payments, []);
  assert.ok((await pool.query("select 1 from audit where action = 'assistant_match' and entity_id = $1", [tx])).rows.length);

  const worker = await person('Wes', [['roofing', 'work']]);
  assert.equal((await run(worker, 'list_unmatched_payments', { books: 'roofing' })).status, 403, 'the bank is admin only');
});

test('clients are found, added, corrected and reused for a new job, inside the person\'s businesses only', async () => {
  const me = await person('Scott', [['roofing', 'manage']]);
  const old = await roofJob();
  await pool.query(`insert into jobs (site, status, invoice_net_pence, survey_price_pence, tax_bp, lead_bp, lead_earner, partner_a, partner_b, reserve_bp, fee_bp, fee_floor_pence, split_bp, customer_name, customer_postcode)
    values ('ac', 'quoted', 0, 0, 0, 0, '', '', '', 0, 0, 0, 5000, 'Anita Elsewhere', 'BR6 0AB')`);
  const found = await run(me, 'find_client', { text: 'anita' });
  assert.deepEqual(found.data.clients.map((c) => [c.name, c.jobs.map((j) => j.id)]), [['Anita Patel', [old]]], 'not the CoolRight client');

  const made = await run(me, 'create_client', { site: 'roofing', customer_name: 'Dev Shah', phone: '07700 900456' });
  assert.equal(made.status, 200, JSON.stringify(made.data));
  assert.equal(made.data.job.status, 'quoted');

  assert.equal((await run(me, 'update_client', { id: old, phone: '07700 900999', email: 'bad' })).status, 400, 'the route\'s own checks');
  assert.equal((await run(me, 'update_client', { id: old, phone: '07700 900999' })).status, 200);
  const row = (await pool.query('select customer_name, customer_phone, customer_email from jobs where id = $1', [old])).rows[0];
  assert.deepEqual(row, { customer_name: 'Anita Patel', customer_phone: '07700 900999', customer_email: 'anita@example.com' });

  const again = await run(me, 'create_job', { site: 'roofing', client_job_id: old, note: 'Gutters this time' });
  assert.equal(again.status, 200, JSON.stringify(again.data));
  assert.equal(again.data.job.customerName, 'Anita Patel');
  assert.equal(again.data.job.customerPhone, '07700 900999');
  assert.equal(again.data.job.customerPostcode, 'BR6 0AA');
  assert.ok((await pool.query("select 1 from audit where action = 'quoted_update' and entity_id = $1", [old])).rows.length, 'audited');
});

test('a job is found by the customer\'s name and postcode, never needing its number', async () => {
  const { resolveJobArgs } = await import('../lib/mcp/find-job.js');
  const me = await person('Scott', [['roofing', 'manage']]);
  const id = await roofJob();
  assert.deepEqual((await resolveJobArgs(me, { id: 'Anita BR60AA', text: 'x' })).args, { id, text: 'x' });
  assert.equal((await resolveJobArgs(me, { id: 'patel br6 0aa' })).args.id, id);
  assert.equal((await resolveJobArgs(me, { id: String(id) })).args.id, id);
  assert.match((await resolveJobArgs(me, { id: 'Nobody' })).error.error, /No job/);
  await roofJob();
  assert.equal((await resolveJobArgs(me, { id: 'Anita' })).error.matches.length, 2, 'two Anitas: ask which');
});

test('a job moves to a new date and time by the customer\'s name, keeping its place in the pipeline', async () => {
  const me = await person('Scott', [['roofing', 'manage']]);
  const id = await roofJob();
  await pool.query("update jobs set status = 'completed' where id = $1", [id]);
  const { resolveJobArgs } = await import('../lib/mcp/find-job.js');
  const moved = await run(me, 'move_job', (await resolveJobArgs(me, { id: 'Anita Patel', date: '2026-11-12', time: '09:30' })).args);
  assert.equal(moved.status, 200, JSON.stringify(moved.data));
  const row = (await pool.query('select status, job_date::text, job_time::text from jobs where id = $1', [id])).rows[0];
  assert.deepEqual(row, { status: 'completed', job_date: '2026-11-12', job_time: '09:30:00' });
});
