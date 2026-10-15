/**
 * The job planner for a roofing job: scaffold, materials, skip and crew,
 * each with a status, a date, a supplier and a cost.
 *
 * A planner row with a cost owns exactly one line in job_costs (cost_id),
 * which it updates in place when the figure changes and removes when the
 * cost is cleared. So "scaffold £450" typed twice is still one £450 cost,
 * and the profit and the payout read it like any other cost line. If somebody
 * deletes that cost line by hand, the link goes (on delete set null) and the
 * next save makes a fresh one, which is what they would expect.
 */
import { query, queryOne } from './db.js';

/* Each kind's statuses in the order the work goes. The first is "not sorted
   yet"; not_needed takes a kind off the badges for a job without it. */
export const TASK_STATUSES = {
  scaffold: ['needed', 'booked', 'up', 'down', 'not_needed'],
  materials: ['needed', 'ordered', 'delivered', 'not_needed'],
  skip: ['needed', 'booked', 'on_site', 'collected', 'not_needed'],
  crew: ['needed', 'confirmed']
};
export const STATUS_WORDS = {
  needed: 'Not sorted', not_needed: 'Not needed', booked: 'Booked', up: 'Up', down: 'Down', ordered: 'Ordered',
  delivered: 'Delivered', on_site: 'On site', collected: 'Collected', confirmed: 'Confirmed'
};
export const KIND_WORDS = { scaffold: 'Scaffold', materials: 'Materials', skip: 'Skip', crew: 'Crew' };
export const BADGE_WORDS = {
  quote: 'Quote not sent', deposit: 'Deposit due', scaffold: 'Scaffold not booked', materials: 'Materials not ordered',
  late: 'Should have started', unpaid: 'Unpaid', review: 'Rating due'
};
/* Statuses at which a kind still needs somebody to act before the start. */
const OPEN = { scaffold: ['needed'], materials: ['needed'], skip: [] };

const initials = (name) => String(name || '').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

function presentTask(t) {
  return {
    id: Number(t.id), kind: t.kind, status: t.status, date: t.task_date ? String(t.task_date instanceof Date ? t.task_date.toISOString() : t.task_date).slice(0, 10) : null,
    supplier: t.supplier || null, costPence: t.cost_pence == null ? null : Number(t.cost_pence), note: t.note || null,
    personId: t.person_id == null ? null : Number(t.person_id), name: t.name || null, initials: initials(t.name), costLine: t.cost_id != null
  };
}

/** The planner for each of these jobs, as a Map of job id to plan. */
export async function planFor(ids) {
  const rows = ids.length ? await query(
    `select t.*, t.task_date::text as task_date, p.name from job_tasks t left join people p on p.id = t.person_id
      where t.job_id = any($1::bigint[]) order by t.id`, [ids]) : [];
  const map = new Map();
  for (const id of ids) {
    const mine = rows.filter((r) => Number(r.job_id) === id).map(presentTask);
    const one = (kind) => {
      const t = mine.find((x) => x.kind === kind);
      const status = t ? t.status : 'needed';
      return { ...(t || { kind, status }), status, open: (OPEN[kind] || []).includes(status) };
    };
    map.set(id, { scaffold: one('scaffold'), materials: one('materials'), skip: one('skip'), crew: mine.filter((x) => x.kind === 'crew') });
  }
  return map;
}

const costLabel = (kind, supplier) => `${KIND_WORDS[kind]}${supplier ? ` (${supplier})` : ''}`.slice(0, 80);

/* The cost line follows the task: made, updated or removed, never doubled. */
async function syncCost(task, personId) {
  const amount = task.cost_pence == null ? 0 : Number(task.cost_pence);
  const line = task.cost_id ? await queryOne('select id from job_costs where id = $1', [task.cost_id]) : null;
  if (amount > 0 && line) {
    await query('update job_costs set label = $2, amount_pence = $3 where id = $1', [line.id, costLabel(task.kind, task.supplier), amount]);
  } else if (amount > 0) {
    const made = await queryOne('insert into job_costs (job_id, label, amount_pence, added_by) values ($1, $2, $3, $4) returning id',
      [task.job_id, costLabel(task.kind, task.supplier), amount, personId || null]);
    await query('update job_tasks set cost_id = $2 where id = $1', [task.id, made.id]);
  } else if (line) {
    await query('update job_tasks set cost_id = null where id = $1', [task.id]);
    await query('delete from job_costs where id = $1', [line.id]);
  }
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * One planner change. `body` holds kind and whichever of status, date,
 * supplier, costPence, note and personId changed; a field left out stays.
 * Returns { ok } or { error } with a sentence a person can act on.
 */
export async function saveTask(jobId, body, personId) {
  const kind = body.kind;
  if (!TASK_STATUSES[kind]) return { error: 'Choose scaffold, materials, skip or crew.' };
  if (body.status != null && !TASK_STATUSES[kind].includes(body.status)) return { error: `A ${kind} can be ${TASK_STATUSES[kind].map((s) => STATUS_WORDS[s].toLowerCase()).join(', ')}.` };
  if (body.date != null && body.date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return { error: 'Enter a date as YYYY-MM-DD.' };
  let cost;
  if (has(body, 'costPence')) {
    cost = body.costPence == null || body.costPence === '' ? null : Math.round(Number(body.costPence));
    if (cost != null && !(cost >= 0)) return { error: 'Enter the cost in pounds.' };
  }
  let crewId = null;
  if (kind === 'crew') {
    crewId = Number(body.personId);
    const ok = Number.isInteger(crewId) && await queryOne(
      `select 1 from people p join grants g on g.person_id = p.id join jobs j on j.site = g.business_slug and j.id = $2 where p.id = $1 and p.active`, [crewId, jobId]);
    if (!ok) return { error: 'Choose somebody who works for this business.' };
    if (body.remove) { await query(`delete from job_tasks where job_id = $1 and kind = 'crew' and person_id = $2`, [jobId, crewId]); return { ok: true }; }
  }
  const existing = await queryOne(kind === 'crew' ? `select *, task_date::text as task_date from job_tasks where job_id = $1 and kind = 'crew' and person_id = $2`
    : 'select *, task_date::text as task_date from job_tasks where job_id = $1 and kind = $2', kind === 'crew' ? [jobId, crewId] : [jobId, kind]);
  const v = {
    status: body.status != null ? body.status : existing ? existing.status : (kind === 'crew' ? 'confirmed' : 'needed'),
    date: has(body, 'date') ? (body.date || null) : existing ? existing.task_date : null,
    supplier: has(body, 'supplier') ? (String(body.supplier || '').trim().slice(0, 80) || null) : existing ? existing.supplier : null,
    cost: has(body, 'costPence') ? cost : existing ? existing.cost_pence : null,
    note: has(body, 'note') ? (String(body.note || '').trim().slice(0, 300) || null) : existing ? existing.note : null
  };
  /* A kind that is not needed carries no cost. */
  if (v.status === 'not_needed') v.cost = null;
  const task = existing
    ? await queryOne(`update job_tasks set status = $2, task_date = $3::date, supplier = $4, cost_pence = $5, note = $6, updated_at = now() where id = $1 returning *`,
      [existing.id, v.status, v.date, v.supplier, v.cost, v.note])
    : await queryOne(`insert into job_tasks (job_id, kind, status, task_date, supplier, cost_pence, note, person_id) values ($1, $2, $3, $4::date, $5, $6, $7, $8) returning *`,
      [jobId, kind, v.status, v.date, v.supplier, v.cost, v.note, kind === 'crew' ? crewId : null]);
  if (kind !== 'crew') await syncCost(task, personId);
  return { ok: true };
}

/** The planner for one job as the job screen shows it. */
export async function planOf(jobId) {
  return (await planFor([jobId])).get(jobId);
}
