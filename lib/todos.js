/**
 * The shared to-do list between staff.
 *
 * Mostly fed by each person's assistant ("tell Scott about a potential job
 * next week, name Laura"), and by the assistant itself when a change it tried
 * did not go through, so nothing asked for is lost. The words are kept
 * exactly as said: a to-do is a note from one person to another and
 * rewording it loses what they meant.
 *
 * Who sees what follows the businesses a person holds. A to-do for a business
 * is seen by everyone who holds that business. A general one (no business) is
 * seen only by the person it is for and the person who set it, and an
 * unaddressed general one by the owners, since "everyone" with no business
 * means the people who run the lot.
 */
import { query, queryOne } from './db.js';
import { record } from './audit.js';
import { pushToPerson } from './push.js';
import { notify } from './notify.js';
import { TODAY } from './today.js';
import { findJobs } from './mcp/find-job.js';

export const VIEWS = ['open', 'mine', 'set', 'failed', 'done', 'all'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 2000;

/* $1 is the person's id (null for the owners' code), $2 their businesses,
   $3 whether they are an admin. */
const VISIBLE = `((t.site is not null and t.site = any($2::text[]))
   or (t.site is null and (t.for_person_id is not distinct from $1 or t.set_by_person_id is not distinct from $1
                           or (t.for_person_id is null and $3::boolean))))`;
const FOR_ME = `(t.for_person_id is not distinct from $1 or t.for_person_id is null)`;

const SELECT = `select t.*, t.due_on::text as due_on, fp.name as for_name, sp.name as set_by_person_name, dp.name as done_by_name,
                       j.customer_name, j.customer_postcode, (t.due_on < ${TODAY}) as overdue
                  from todos t
                  left join people fp on fp.id = t.for_person_id
                  left join people sp on sp.id = t.set_by_person_id
                  left join people dp on dp.id = t.done_by
                  left join jobs j on j.id = t.job_id`;

/* The owners sign in with the shared owners' code and have no people row,
   so their names are configured: a to-do "for Scott" is a to-do for the
   owners' list, the one the owners' code calls "me". */
export const ownerNames = () => String(process.env.OWNER_NAMES ?? 'Scott').split(',').map((n) => n.trim()).filter(Boolean);
const ownersLabel = () => ownerNames().join(' and ') || 'Owners';

export function present(r, viewer = null) {
  return {
    id: Number(r.id), site: r.site, text: r.text, lead: r.lead_info || null,
    jobId: r.job_id == null ? null : Number(r.job_id),
    customer: r.job_id == null ? null : [r.customer_name, r.customer_postcode].filter(Boolean).join(', ') || null,
    forPersonId: r.for_person_id == null ? null : Number(r.for_person_id),
    forName: r.for_name || (r.for_person_id == null ? (viewer && !viewer.personId ? ownersLabel() : 'Everyone') : null),
    setByPersonId: r.set_by_person_id == null ? null : Number(r.set_by_person_id),
    setBy: r.set_by_person_name || r.set_by_name || 'Owners',
    source: r.source, dueOn: r.due_on, overdue: Boolean(r.overdue) && !r.done_at,
    createdAt: r.created_at, doneAt: r.done_at, doneBy: r.done_at ? (r.done_by_name || 'Owners') : null
  };
}

/* The owner's phone hears who did what for whom, never the words, which
   may name a customer. Best effort, like every notification. */
const actor = (scope) => `${scope.name || 'The owners'}${scope.viaAssistant ? ' (via ChatGPT)' : ''}`;
async function alert(scope, site, id, message) {
  await notify({ business: site || null, kind: 'todo', ref: id, tags: 'memo', title: 'To-do list', message });
}

const base = (scope) => [scope.personId, scope.businesses, Boolean(scope.isAdmin)];

/** The to-dos one person may see, by view. */
export async function listTodos(scope, view = 'open', { limit = 100 } = {}) {
  const where = {
    open: `t.done_at is null and ${FOR_ME}`,
    mine: `t.done_at is null and t.for_person_id is not distinct from $1`,
    set: `t.done_at is null and t.set_by_person_id is not distinct from $1 and t.source <> 'failed'`,
    failed: `t.done_at is null and t.source = 'failed' and t.for_person_id is not distinct from $1`,
    done: `t.done_at > now() - interval '14 days'`,
    all: `t.done_at is null`
  }[VIEWS.includes(view) ? view : 'open'];
  const order = view === 'done' ? 't.done_at desc' : 't.due_on nulls last, t.created_at desc';
  const rows = await query(`${SELECT} where ${VISIBLE} and ${where} order by ${order} limit ${Math.min(Number(limit) || 100, 200)}`, base(scope));
  return rows.map((r) => present(r, scope));
}

export async function getTodo(scope, id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return queryOne(`${SELECT} where ${VISIBLE} and t.id = $4`, [...base(scope), id]);
}

/**
 * The people this person may address a to-do to: anyone active sharing a
 * business with them, and the admins, who oversee every business. An admin
 * or the owners' code may address anyone active.
 */
export async function teamFor(scope) {
  if (scope.isAdmin) return query('select id, name from people where active order by name');
  return query(
    `select distinct p.id, p.name from people p left join grants g on g.person_id = p.id
      where p.active and (p.is_admin or g.business_slug = any($1::text[])) order by p.name`, [scope.businesses]);
}

/**
 * A spoken name ("Scott", "tom") to one person. Returns {person}, {everyone},
 * or {error} with the candidates when it is not clear.
 */
export async function resolvePerson(scope, name) {
  const said = String(name || '').trim().toLowerCase();
  if (!said || ['me', 'myself', 'i'].includes(said)) return scope.personId ? { person: { id: scope.personId, name: scope.name } } : { everyone: true };
  if (['everyone', 'anyone', 'all', 'owners', 'the owners', 'team'].includes(said)) return { everyone: true };
  const team = await teamFor(scope);
  const exact = team.filter((p) => p.name.toLowerCase() === said);
  const starts = team.filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(said)) || p.name.toLowerCase().startsWith(said));
  /* An owner's name with no person of that name is the owners' list. */
  const owners = ownerNames();
  if (!exact.length && !starts.length && owners.some((n) => n.toLowerCase() === said || n.toLowerCase().split(/\s+/)[0] === said)) return { everyone: true, owners: true };
  const pick = exact.length === 1 ? exact : starts;
  if (pick.length === 1) return { person: { id: Number(pick[0].id), name: pick[0].name } };
  return { error: pick.length
    ? `More than one person is called ${name}: ${pick.map((p) => p.name).join(', ')}. Ask which.`
    : `Nobody called ${name} works in your businesses. People you can set a to-do for: ${[...owners.filter((n) => !team.some((p) => p.name.toLowerCase() === n.toLowerCase())), ...team.map((p) => p.name)].join(', ') || 'nobody yet'}.` };
}

/**
 * Adds one to-do. The business is the one asked for, else the job's, else
 * the caller's only business; with several and no clue it is general.
 */
export async function addTodo(scope, { text, forPersonId = null, site = null, jobId = null, lead = null, dueOn = null, source = 'manual' }) {
  const words = String(text || '').trim().slice(0, MAX_TEXT);
  if (!words) return { error: 'Say what the to-do is.' };
  if (dueOn && !DATE.test(dueOn)) return { error: 'The due date must be YYYY-MM-DD.' };
  if (site && !scope.businesses.includes(site)) return { error: 'That business is not one you hold.' };
  if (jobId) {
    const job = await queryOne('select site from jobs where id = $1', [jobId]);
    if (!job || !scope.businesses.includes(job.site)) return { error: 'No such job in the businesses you hold.' };
    site = site || job.site;
  }
  if (forPersonId) {
    const ok = (await teamFor(scope)).some((p) => Number(p.id) === Number(forPersonId)) || Number(forPersonId) === scope.personId;
    if (!ok) return { error: 'That person does not work in your businesses.' };
  }
  if (!site && scope.businesses.length === 1 && !scope.isAdmin) site = scope.businesses[0];
  const row = await queryOne(
    `insert into todos (site, job_id, lead_info, text, for_person_id, set_by_person_id, set_by_name, source, due_on)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [site, jobId, lead ? String(lead).slice(0, 500) : null, words, forPersonId, scope.personId, scope.personId ? null : (scope.name || 'Owners'), source, dueOn]);
  const id = Number(row.id);
  await record({ scope, business: site, entity: 'todo', entityId: id, action: 'add', after: { text: words, forPersonId, jobId, dueOn, source } });
  /* A buzz for the person it is for, unless they set it themselves. Lock
     screen rule: who set it, never the words, which may name a customer. */
  if (forPersonId && Number(forPersonId) !== scope.personId) {
    await pushToPerson(forPersonId, { title: 'New to-do', message: `${scope.name || 'The owners'} added something to your to-do list.`, url: '/staff/todo.html', tag: 'todo-' + id });
  }
  const out = present(await getTodo(scope, id), scope);
  await alert(scope, site, id, `${actor(scope)} added a to-do for ${forPersonId ? out.forName : site ? 'everyone' : ownersLabel()}.`);
  return { todo: out };
}

/** Ticks a to-do done, or opens it again. */
export async function setDone(scope, id, done) {
  const row = await getTodo(scope, id);
  if (!row) return { error: 'No such to-do on your list.' };
  if (Boolean(row.done_at) === done) return { todo: present(row), unchanged: true };
  await query(done ? 'update todos set done_at = now(), done_by = $2 where id = $1' : 'update todos set done_at = null, done_by = null where id = $1', [id, ...(done ? [scope.personId] : [])]);
  await record({ scope, business: row.site, entity: 'todo', entityId: id, action: done ? 'done' : 'reopen', before: { doneAt: row.done_at } });
  const setBy = row.set_by_person_name || row.set_by_name || 'the owners';
  await alert(scope, row.site, id, `${actor(scope)} ${done ? 'ticked off' : 'reopened'} a to-do set by ${row.set_by_person_id != null && Number(row.set_by_person_id) === scope.personId ? 'themselves' : setBy}.`);
  return { todo: present(await getTodo(scope, id), scope) };
}

/** The open (or done) to-dos whose words or customer match, for "I've told Scott". */
export async function matchTodos(scope, words, { done = false } = {}) {
  const terms = String(words || '').toLowerCase().split(/[\s,]+/).filter((w) => w.length > 1).slice(0, 6);
  if (!terms.length) return [];
  const conds = terms.map((_, i) => `lower(t.text || ' ' || coalesce(t.lead_info, '') || ' ' || coalesce(j.customer_name, '') || ' ' || coalesce(j.customer_postcode, '')) like $${i + 4}`).join(' and ');
  const rows = await query(`${SELECT} where ${VISIBLE} and t.done_at is ${done ? 'not ' : ''}null and ${conds} order by t.created_at desc limit 8`,
    [...base(scope), ...terms.map((t) => `%${t.replace(/[%_\\]/g, '')}%`)]);
  return rows.map((r) => present(r, scope));
}

/** A customer said in words to one job, or null; any other words stay as lead notes. */
export async function jobFromWords(scope, words) {
  if (!words) return null;
  if (/^\d+$/.test(String(words).trim())) return Number(words);
  const found = (await findJobs(scope, words)).filter((j) => !['cancelled', 'declined'].includes(j.status));
  return found.length === 1 ? Number(found[0].id) : null;
}

/** Open to-dos per person for the morning digest of one business (or general when null). */
export async function digestCounts(site) {
  return query(
    `select coalesce(p.name, 'Everyone') as name, count(*) as open, count(*) filter (where t.due_on < ${TODAY}) as overdue
       from todos t left join people p on p.id = t.for_person_id
      where t.done_at is null and t.site is not distinct from $1
      group by 1 order by 1`, [site]);
}

const brief = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 117) + '...' : s;
};

/**
 * A change the assistant tried that did not go through, kept on the caller's
 * own list so it is not forgotten once the conversation ends. The same
 * failure again within ten minutes (a retry) is not added twice.
 */
export async function saveFailure(scope, { title, args, error, jobId = null }) {
  const asked = Object.entries(args || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${brief(v)}`).join(', ');
  const text = `Tried to ${title.toLowerCase()}${asked ? ` (${asked})` : ''} but it did not go through: ${brief(error || 'unknown error')}`;
  const dup = await queryOne(
    `select id from todos where source = 'failed' and done_at is null and text = $1 and for_person_id is not distinct from $2
        and created_at > now() - interval '10 minutes'`, [text, scope.personId]);
  if (dup) return { id: Number(dup.id), duplicate: true };
  const job = jobId ? await queryOne('select site from jobs where id = $1', [jobId]) : null;
  const site = job && scope.businesses.includes(job.site) ? job.site : null;
  const row = await queryOne(
    `insert into todos (site, job_id, text, for_person_id, set_by_person_id, set_by_name, source)
     values ($1, $2, $3, $4, $4, $5, 'failed') returning id`,
    [site, site ? jobId : null, text, scope.personId, scope.personId ? null : (scope.name || 'Owners')]);
  await record({ scope, business: site, entity: 'todo', entityId: row.id, action: 'failed', after: { text } });
  await alert(scope, site, Number(row.id), `A change ${scope.name || 'the owners'} asked ChatGPT for did not go through. It is on their to-do list.`);
  return { id: Number(row.id) };
}
