/**
 * /api/admin/coolright: CoolRight's install pipeline, equipment, service
 * plans, service round and the "Before summer" list.
 *
 *   GET  ?view=board                 enquiries and live jobs by stage, with plan income and warranties ending
 *   GET  ?view=job&id=               one card, its units, commissioning, kit and plan
 *   GET  ?view=services              plans due this month and next, grouped by postcode district
 *   GET  ?view=summer                past customers to ask before summer
 *   POST {op:'stage', id, to, date?}          to survey, quoted, accepted, installed, commissioned or lost
 *   POST {op:'date', id, date, time?}         book (or move) the install date
 *   POST {op:'restore', id, state}            Undo for stage, date and commission writes
 *   POST {op:'kit', id, status?, supplier?, costPence?, date?}   kit ordered (the planner's materials row)
 *   POST {op:'unit', id, unitId?, remove?, side, make, model, serial, refrigerant, chargeKg, installedOn, warrantyUntil, location, note}
 *   POST {op:'commission', id, commissionedOn, engineer, fgasRef, leakCheckOn, pressureTest}
 *   POST {op:'plan', id, intervalMonths, pricePence, nextDueOn?}  add (or change) the job's service plan
 *   POST {op:'unplan', contractId}            Undo for a plan just added
 *   POST {op:'book', contractId, date?, time?} a service visit agreed for a day (empty date clears it)
 *   POST {op:'summer', id, on}                the Before summer message marked sent, or not
 *
 * Writes that move a card return it and an `undo` body, as the Verge board
 * does. A plan is an ordinary service contract (contracts.js), so servicing,
 * reminders and Today's services work on it unchanged.
 */
import { query, queryOne } from '../../db.js';
import { json, requireMethod, readJson, str } from '../../http.js';
import { requireScope, requestedSites } from '../../access.js';
import { record } from '../../audit.js';
import { londonToday } from '../../pipeline.js';
import { AC_SITES, acBoard, acCard } from '../../coolright.js';
import { unitsOf, saveUnit, recurringIncome, servicesDue, summerList, warrantiesEnding, planOfJob } from '../../coolright-kit.js';
import { saveTask } from '../../roofing-plan.js';

export const config = { runtime: 'nodejs' };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATE = ['status', 'job_date', 'job_time', 'date_set', 'site_visit_on', 'visit_done_at', 'won_at', 'started_at', 'stage_at',
  'commissioned_on', 'commission_engineer', 'fgas_ref', 'leak_check_on', 'pressure_test'];
const CASTS = ['', '::date', '::time', '::boolean', '::date', '::timestamptz', '::timestamptz', '::timestamptz', '::timestamptz', '::date', '', '', '::date', ''];
const mine = (scope) => AC_SITES.filter((s) => scope.businesses.includes(s));
const raw = (id) => queryOne(`select *, job_date::text as job_date, site_visit_on::text as site_visit_on, job_time::text as job_time,
  commissioned_on::text as commissioned_on, leak_check_on::text as leak_check_on from jobs where id = $1`, [id]);
const stateOf = (j) => Object.fromEntries(STATE.map((k) => [k, j[k] instanceof Date ? j[k].toISOString() : j[k] ?? null]));
const bad = (res, message, key = 'stage') => json(res, 400, { ok: false, error: 'bad_' + key, message });
const TODAY_SQL = `(now() at time zone 'Europe/London')::date`;

/* Where a card may go from each stage, and what each move changes ($2 is the date). */
const MOVES = {
  survey: { from: ['quoted'], needs: 'date', sets: [`status = 'quoted'`, 'site_visit_on = $2::date', 'visit_done_at = null', 'won_at = null'] },
  quoted: { from: ['survey', 'accepted'], sets: [`status = 'quoted'`, 'visit_done_at = coalesce(visit_done_at, now())', 'won_at = null'] },
  accepted: { from: ['survey', 'quoted', 'installed'], sets: [`status = case when status = 'completed' then 'booked' else status end`,
    'won_at = coalesce(won_at, quote_accepted_at, now())', 'visit_done_at = coalesce(visit_done_at, now())'] },
  installed: { from: ['accepted', 'commissioned'], sets: [`status = 'completed'`, 'started_at = coalesce(started_at, now())', 'commissioned_on = null',
    `job_date = case when date_set then job_date else ${TODAY_SQL} end`, 'date_set = true', 'won_at = coalesce(won_at, quote_accepted_at, now())'] },
  commissioned: { from: ['installed'], sets: [`commissioned_on = coalesce($2::date, ${TODAY_SQL})`] },
  lost: { from: ['survey', 'quoted', 'accepted'], sets: [`status = case when status = 'booked' then 'cancelled' else 'declined' end`] }
};

async function write(res, scope, id, sets, params, action) {
  const before = await raw(id);
  if (!before || !mine(scope).includes(before.site)) return json(res, 404, { ok: false, error: 'not_found' });
  if (sets.length) await query(`update jobs set ${sets.join(', ')}, updated_at = now() where id = $1`, [id, ...params]);
  const after = await raw(id);
  await record({ scope, business: before.site, entity: 'job', entityId: id, action, before: stateOf(before), after: stateOf(after) });
  return json(res, 200, { ok: true, card: await acCard(id, mine(scope)), undo: { op: 'restore', id, state: stateOf(before) } });
}

const dateOrNull = (v) => (v == null || v === '' ? null : ISO.test(String(v).slice(0, 10)) ? String(v).slice(0, 10) : undefined);
const stamp = (v) => (v == null || v === '' ? null : Number.isNaN(Date.parse(v)) ? undefined : new Date(v).toISOString());
const text = (v, n) => (v == null ? null : typeof v === 'string' ? v.slice(0, n) || null : undefined);

function restoreValues(s) {
  return [
    ['quoted', 'booked', 'completed', 'declined', 'cancelled'].includes(s.status) ? s.status : undefined,
    dateOrNull(s.job_date), s.job_time == null ? null : /^\d{2}:\d{2}/.test(s.job_time) ? String(s.job_time).slice(0, 5) : undefined,
    typeof s.date_set === 'boolean' ? s.date_set : undefined, dateOrNull(s.site_visit_on), stamp(s.visit_done_at), stamp(s.won_at),
    stamp(s.started_at), stamp(s.stage_at), dateOrNull(s.commissioned_on), text(s.commission_engineer, 80), text(s.fgas_ref, 80),
    dateOrNull(s.leak_check_on), text(s.pressure_test, 200)
  ];
}

/* Plan, booking and summer writes act on a contract or a job of CoolRight's. */
async function contractIn(scope, id) {
  const c = Number.isInteger(id) && id > 0 ? await queryOne('select * from service_contracts where id = $1', [id]) : null;
  return c && mine(scope).includes(c.business_slug) ? c : null;
}

async function planOp(res, scope, body, card) {
  const interval = body.intervalMonths == null || body.intervalMonths === '' ? 12 : Number(body.intervalMonths);
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) return bad(res, 'Months between services, 1 to 60.', 'plan');
  const price = body.pricePence == null || body.pricePence === '' ? null : Math.round(Number(body.pricePence));
  if (price != null && !(price >= 0)) return bad(res, 'Enter the price per service in pounds.', 'plan');
  const due = str(body.nextDueOn, 10) || null;
  if (due && !ISO.test(due)) return bad(res, 'Enter the first service date as YYYY-MM-DD.', 'plan');
  const units = await unitsOf(card.id);
  const indoor = units.filter((u) => u.side === 'indoor').length || 1;
  const kg = units.reduce((s, u) => s + (u.chargeKg || 0), 0) || null;
  const existing = await queryOne(`select id from service_contracts where job_id = $1 and status = 'active' order by id desc limit 1`, [card.id]);
  /* The first service is a year (or the interval) from the install or commissioning. */
  const from = card.commissionedOn || (card.dateSet && card.jobDate) || card.today;
  const row = existing
    ? await queryOne(`update service_contracts set interval_months = $2, price_pence = $3, next_due_on = coalesce($4::date, next_due_on), updated_at = now() where id = $1 returning id`,
      [existing.id, interval, price, due])
    : await queryOne(`insert into service_contracts (business_slug, job_id, customer_name, customer_postcode, installed_on, interval_months, next_due_on, unit_count, refrigerant_kg, price_pence)
        values ($1, $2, $3, $4, $5::date, $6, coalesce($7::date, $5::date + ($6::int * interval '1 month')), $8, $9, $10) returning id`,
      [card.site, card.id, card.name, card.postcode, from, interval, due, indoor, kg, price]);
  await record({ scope, business: card.site, entity: 'contract', entityId: row.id, action: existing ? 'contract_update' : 'contract_create', before: null, after: { interval, price } });
  return json(res, 200, { ok: true, card: await acCard(card.id, mine(scope)), plan: await planOfJob(card.id),
    undo: existing ? null : { op: 'unplan', contractId: Number(row.id) } });
}

async function change(res, scope, body) {
  if (body.op === 'unplan' || body.op === 'book') {
    const c = await contractIn(scope, Number(body.contractId));
    if (!c) return json(res, 404, { ok: false, error: 'not_found' });
    if (body.op === 'unplan') {
      await query('delete from service_contracts where id = $1', [c.id]);
      await record({ scope, business: c.business_slug, entity: 'contract', entityId: c.id, action: 'contract_remove', before: { jobId: c.job_id }, after: null });
      return json(res, 200, { ok: true, removed: Number(c.id) });
    }
    const date = str(body.date, 10) || null;
    const time = str(body.time, 5) || null;
    if (date && !ISO.test(date)) return bad(res, 'Enter a date as YYYY-MM-DD.', 'date');
    if (time && !TIME.test(time)) return bad(res, 'Enter a time as HH:MM.', 'time');
    const prev = { op: 'book', contractId: Number(c.id), date: c.booked_on ? new Date(c.booked_on).toISOString().slice(0, 10) : null, time: c.booked_time ? String(c.booked_time).slice(0, 5) : null };
    await query('update service_contracts set booked_on = $2::date, booked_time = case when $2::date is null then null else $3::time end, updated_at = now() where id = $1', [c.id, date, time]);
    await record({ scope, business: c.business_slug, entity: 'contract', entityId: c.id, action: 'contract_book', before: { bookedOn: prev.date }, after: { bookedOn: date } });
    return json(res, 200, { ok: true, contractId: Number(c.id), bookedOn: date, bookedTime: date ? time : null, undo: prev });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json(res, 400, { ok: false, error: 'bad_id' });
  const card = await acCard(id, mine(scope));
  if (!card) return json(res, 404, { ok: false, error: 'not_found' });
  const date = str(body.date, 10) || null;
  if (date && !ISO.test(date)) return bad(res, 'Enter a date as YYYY-MM-DD.', 'date');

  if (body.op === 'stage') {
    const move = MOVES[body.to];
    if (card.frozen || card.status === 'paid') return bad(res, 'This job is paid and its payout is frozen, so its stage cannot move from here.');
    if (!move || !move.from.includes(card.stage)) return bad(res, `A job cannot go from ${card.stage} to ${String(body.to)} from here.`);
    if (body.to === 'quoted' && card.acceptedOnline) return bad(res, 'The customer accepted this quote online, so it stays accepted.');
    if (move.needs === 'date' && !date) return bad(res, 'Choose the day of the survey.', 'date');
    const params = move.needs === 'date' || body.to === 'commissioned' ? [date] : [];
    return write(res, scope, id, [...move.sets, 'stage_at = now()'], params, 'coolright_stage');
  }
  if (body.op === 'date') {
    if (!date) return bad(res, 'Choose the install date.', 'date');
    const time = str(body.time, 5) || null;
    if (time && !TIME.test(time)) return bad(res, 'Enter a time as HH:MM.', 'time');
    if (card.stage !== 'accepted') return bad(res, 'Only an accepted job has an install date to book.', 'date');
    return write(res, scope, id, [`status = 'booked'`, 'job_date = $2::date', 'date_set = true', 'job_time = $3::time',
      'won_at = coalesce(won_at, quote_accepted_at, now())'], [date, time], 'coolright_date');
  }
  if (body.op === 'restore') {
    const vals = restoreValues(body.state || {});
    if (vals.some((v) => v === undefined)) return json(res, 400, { ok: false, error: 'bad_state' });
    const sets = STATE.map((c, i) => (c === 'job_date' ? `job_date = coalesce($${i + 2}::date, job_date)` : `${c} = $${i + 2}${CASTS[i]}`));
    return write(res, scope, id, sets, vals, 'coolright_restore');
  }
  if (body.op === 'commission') {
    const vals = [dateOrNull(body.commissionedOn), text(body.engineer, 80), text(body.fgasRef, 80), dateOrNull(body.leakCheckOn), text(body.pressureTest, 200)];
    if (vals.some((v) => v === undefined)) return bad(res, 'Enter dates as YYYY-MM-DD.', 'commission');
    if (!['installed', 'commissioned', 'paid'].includes(card.stage) && vals[0]) return bad(res, 'Mark the job installed before it is commissioned.', 'commission');
    return write(res, scope, id, ['commissioned_on = $2::date', 'commission_engineer = $3', 'fgas_ref = $4', 'leak_check_on = $5::date', 'pressure_test = $6'], vals, 'coolright_commission');
  }
  if (body.op === 'kit') {
    const done = await saveTask(id, { ...body, kind: 'materials' }, scope.personId);
    if (done.error) return bad(res, done.error.replace(/materials/g, 'kit'), 'kit');
    await record({ scope, business: card.site, entity: 'job', entityId: id, action: 'coolright_kit', before: null, after: { status: body.status ?? null } });
    return json(res, 200, { ok: true, card: await acCard(id, mine(scope)) });
  }
  if (body.op === 'unit') {
    const done = await saveUnit(id, body);
    if (done.error) return bad(res, done.error, 'unit');
    await record({ scope, business: card.site, entity: 'job', entityId: id, action: 'coolright_unit', before: null, after: done.unit || { removed: done.removed } });
    return json(res, 200, { ok: true, ...done, units: await unitsOf(id), card: await acCard(id, mine(scope)) });
  }
  if (body.op === 'plan') return planOp(res, scope, body, card);
  if (body.op === 'summer') {
    if (typeof body.on !== 'boolean') return bad(res, 'Say whether the message went.', 'summer');
    const prev = card.summerAskedOn;
    await query(`update jobs set summer_asked_on = case when $2::boolean then ${TODAY_SQL} else $3::date end where id = $1`, [id, body.on, body.on ? null : (str(body.was, 10) || null)]);
    return json(res, 200, { ok: true, card: await acCard(id, mine(scope)), undo: { op: 'summer', id, on: Boolean(prev), was: prev } });
  }
  return json(res, 400, { ok: false, error: 'unknown_op' });
}

async function read(req, res, scope) {
  const url = new URL(req.url, 'http://localhost');
  const sites = requestedSites(scope, url.searchParams).filter((s) => AC_SITES.includes(s));
  const money = sites.filter((s) => scope.isAdmin || scope.levels[s] === 'manage');
  const view = url.searchParams.get('view') || 'board';
  const today = londonToday();
  if (view === 'job') {
    const id = Number(url.searchParams.get('id'));
    const card = Number.isInteger(id) ? await acCard(id, sites) : null;
    if (!card) return json(res, 404, { ok: false, error: 'not_found' });
    return json(res, 200, { ok: true, card, units: await unitsOf(id), plan: await planOfJob(id) });
  }
  if (view === 'services') return json(res, 200, { ok: true, today, ...(await servicesDue(sites)) });
  if (view === 'summer') {
    const m = Number(today.slice(5, 7));
    return json(res, 200, { ok: true, today, season: m >= 3 && m <= 5, customers: await summerList(sites) });
  }
  const [data, income, ending] = await Promise.all([acBoard(sites), recurringIncome(money), warrantiesEnding(sites)]);
  return json(res, 200, { ok: true, today, ...data, income: money.length ? income : null, warranties: ending });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    if (req.method === 'GET') return await read(req, res, scope);
    return await change(res, scope, await readJson(req));
  } catch (err) {
    console.error('coolright request failed:', err.message);
    json(res, 500, { ok: false, error: 'coolright_failed' });
  }
}
