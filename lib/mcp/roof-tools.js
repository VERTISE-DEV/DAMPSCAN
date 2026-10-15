/**
 * Assistant tools for the Verge Roofing pipeline and job planner: "scaffold
 * booked for Mrs Patel Monday with Acme £450", "materials delivered for the
 * Smiths", "Mrs Patel has said yes", "the Jones roof is finished". Each one
 * is the same /api/admin/roofing write the board and the job screen make,
 * so a cost given here lands once in the job's costs, exactly as on screen.
 */
import { query } from '../db.js';
import roofing from '../routes/admin/roofing.js';
import { callRoute, read, write, fail, notFound, jobInScope, ID, DATE, TIME } from './shared.js';

const STAGE = { type: 'string', enum: ['visit', 'quoted', 'accepted', 'booked', 'in_progress', 'done', 'lost'],
  description: 'visit = site visit booked (needs date), quoted = visit done or quote out, accepted = customer said yes, booked = start date set (needs date), in_progress = crew started, done = roof finished, lost = declined or cancelled. Paid follows the payments and Reviewed the customer\'s rating, so neither is set here.' };
const ITEM = { type: 'string', enum: ['scaffold', 'materials', 'skip', 'crew'], description: 'Which planner line.' };
const STATUS = { type: 'string', enum: ['needed', 'booked', 'up', 'down', 'ordered', 'delivered', 'on_site', 'collected', 'not_needed', 'confirmed'],
  description: 'scaffold: needed, booked, up, down, not_needed. materials: needed, ordered, delivered, not_needed. skip: needed, booked, on_site, collected, not_needed. crew: confirmed.' };

/* Small cards: what the assistant needs to answer, no money for a worker. */
const slim = (c) => ({ id: c.id, name: c.name, postcode: c.postcode, stage: c.stage, next: c.next, badges: c.badges, daysInStage: c.stageDays,
  startDate: c.jobDate, expectedDays: c.expectedDays, siteVisitOn: c.siteVisitOn, crew: c.crew.map((p) => p.name), plan: c.plan,
  ...(c.finish ? { finishingLeft: c.finish.filter((f) => !f.done).map((f) => f.label) } : {}),
  ...(c.weather && c.weather.some((w) => w.warn) ? { weather: c.weather.filter((w) => w.warn).map((w) => `${w.date}: ${w.warn}`) } : {}) });

async function roofJob(scope, id) {
  const found = await jobInScope(scope, id);
  if (!found) return { error: notFound() };
  if (found.job.site !== 'roofing') return { error: fail('The pipeline and planner are for Verge Roofing jobs.') };
  return found;
}

async function board(scope) {
  const r = await callRoute(roofing, scope, { url: '/api/admin/roofing?area=roofing' });
  if (!r.data || !r.data.ok) return r;
  return { status: 200, data: { ok: true, today: r.data.today, enquiries: r.data.enquiries.map((e) => ({ name: e.firstName, postcode: e.postcode, issues: e.issues, days: e.stageDays })),
    jobs: r.data.jobs.map(slim), tip: 'Move a job with set_roofing_stage; scaffold, materials, skip and crew with update_roofing_plan.' } };
}

async function week(scope, { from }) {
  const r = await callRoute(roofing, scope, { url: '/api/admin/roofing?area=roofing&view=week' + (from ? '&from=' + encodeURIComponent(from) : '') });
  if (!r.data || !r.data.ok) return r;
  return { status: 200, data: { ok: true, from: r.data.from, days: r.data.days, jobs: r.data.jobs.map((c) => ({ ...slim(c), onDays: c.days })) } };
}

async function setStage(scope, { id, stage, date, time }) {
  const found = await roofJob(scope, id);
  if (found.error) return found.error;
  const r = await callRoute(roofing, scope, { method: 'POST', url: '/api/admin/roofing', body: { op: 'stage', id, to: stage, date, time } });
  if (r.data && r.data.ok) return { status: 200, data: { ok: true, job: slim(r.data.card) } };
  return r;
}

/* A crew member by name, among the people who work for Verge. */
async function personByName(name) {
  const t = String(name || '').trim().toLowerCase();
  if (!t) return { error: 'Say who, by name.' };
  const rows = await query(`select distinct p.id, p.name from people p join grants g on g.person_id = p.id
                             where g.business_slug = 'roofing' and p.active and lower(p.name) like $1`, [`${t.replace(/[%_\\]/g, '')}%`]);
  if (rows.length === 1) return { id: Number(rows[0].id) };
  return { error: rows.length ? `More than one person matches "${name}": ${rows.map((r) => r.name).join(', ')}.` : `Nobody called "${name}" works for Verge.` };
}

async function updatePlan(scope, { id, item, status, date, supplier, cost_pounds: pounds, note, person, remove, expected_days: days }) {
  const found = await roofJob(scope, id);
  if (found.error) return found.error;
  let r;
  if (days != null) {
    r = await callRoute(roofing, scope, { method: 'POST', url: '/api/admin/roofing', body: { op: 'plan', id, expectedDays: days } });
    if (!item || !(r.data && r.data.ok)) return r.data && r.data.ok ? { status: 200, data: { ok: true, job: slim(r.data.card) } } : r;
  }
  if (!item) return fail('Say which planner line: scaffold, materials, skip or crew.');
  const body = { op: 'task', id, kind: item };
  if (status != null) body.status = status;
  if (date !== undefined) body.date = date;
  if (supplier !== undefined) body.supplier = supplier;
  if (note !== undefined) body.note = note;
  if (pounds !== undefined) body.costPence = pounds == null ? null : Math.round(Number(pounds) * 100);
  if (item === 'crew') {
    const who = await personByName(person);
    if (who.error) return fail(who.error);
    body.personId = who.id;
    if (remove) body.remove = true;
  }
  r = await callRoute(roofing, scope, { method: 'POST', url: '/api/admin/roofing', body });
  if (r.data && r.data.ok) return { status: 200, data: { ok: true, job: slim(r.data.card), plan: r.data.plan } };
  return r;
}

export const ROOF_TOOLS = [
  read('roofing_pipeline', 'Verge pipeline', 'The Verge Roofing pipeline: enquiries and every live job with its stage (site visit, quoted, accepted, booked, in progress, done, paid, reviewed), the next action, days in that stage, what is missing (quote not sent, deposit due, scaffold not booked, materials not ordered, unpaid, rating due, weather) and the finishing steps left.', {}, board),
  read('roofing_week', 'Verge week', 'The Verge week board, Monday to Saturday: which roofs are on which day, the crew, the planner state and any rain or wind warning.', { from: { ...DATE, description: 'Any day in the week wanted, YYYY-MM-DD. Default this week.' } }, week),
  write('set_roofing_stage', 'Move a Verge job', 'Moves a Verge Roofing job to a pipeline stage. A site visit and a booking need a date (YYYY-MM-DD; work out "Monday" from today). The board offers Undo; here, move it back the same way.',
    { id: ID, stage: STAGE, date: DATE, time: TIME }, ['id', 'stage'], setStage),
  write('update_roofing_plan', 'Verge job planner', 'Updates the planner on a Verge Roofing job: scaffold, materials or skip (status, date, supplier, cost in pounds, note), the crew (person by name; remove true to take them off), or the expected days on the roof. A cost becomes one line in the job\'s costs and is updated in place, never added twice. E.g. "scaffold booked for Mrs Patel Monday with Acme £450" is item scaffold, status booked, date that Monday, supplier Acme, cost_pounds 450.',
    { id: ID, item: ITEM, status: STATUS, date: DATE, supplier: { type: 'string' }, cost_pounds: { type: ['number', 'null'], description: 'The cost in pounds; null clears it.' }, note: { type: 'string' },
      person: { type: 'string', description: 'Crew only: who, by name.' }, remove: { type: 'boolean', description: 'Crew only: take them off the job.' }, expected_days: { type: 'number', description: 'Days the crew expect on the roof.' } },
    ['id'], updatePlan)
];
