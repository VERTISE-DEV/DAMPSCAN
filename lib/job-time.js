/**
 * Time on site, miles driven and "on my way", for /api/admin/quoted.
 *
 *   clockin   {id}                     start the viewer's clock on this job
 *   clockout  {id}                     stop it
 *   untime    {id, timeId}             remove a stretch entered by mistake (manage)
 *   miles     {id, miles, onDate?}     the viewer's driving for this job
 *   hours     {id, hours, onDate?}     a stretch worked but never clocked, from 8am
 *   rate      {id, personId, hourlyRatePence}   a person's hourly rate (manage)
 *
 * Clocking in on one job while clocked in on another closes the other first:
 * nobody is on two roofs at once, and a forgotten clock-out should cost a
 * correction, not a refusal at the next front door.
 *
 * "On my way" is a customer message (lib/messages.js), so tapping it goes
 * through the ordinary message op and its row is the record of leaving.
 */
import { query, queryOne } from './db.js';
import { str } from './http.js';
import { messageFor, ON_MY_WAY_MINUTES } from './messages.js';
import { hoursOf } from './profit.js';

export { forViewer } from './profit.js';

export const TIME_OPS = new Set(['clockin', 'clockout', 'untime', 'miles', 'hours', 'rate']);

const N = (v) => Number(v) || 0;
const canManage = (scope, site) => scope.isAdmin || scope.levels[site] === 'manage';
const fail = (json, res, key, message, status = 400) => { json(res, status, { ok: false, errors: { [key]: message } }); return false; };

export async function loadTime(jobId) {
  return query(
    `select t.id, t.person_id, p.name, p.hourly_rate_pence, t.started_at, t.ended_at
       from job_time t join people p on p.id = t.person_id where t.job_id = $1 order by t.started_at, t.id`, [jobId]);
}

export async function loadMiles(jobId) {
  return query(
    `select m.id, m.person_id, p.name, m.on_date::text as on_date, m.miles from job_miles m join people p on p.id = m.person_id
      where m.job_id = $1 order by m.on_date, m.id`, [jobId]);
}

/** The time block of a presented job. */
export function presentTime(time, miles, now = Date.now()) {
  return {
    entries: time.map((t) => ({ id: Number(t.id), personId: Number(t.person_id), name: t.name, startedAt: t.started_at, endedAt: t.ended_at,
      hours: Math.round(hoursOf(t, now) * 100) / 100, ratePence: N(t.hourly_rate_pence) })),
    open: time.filter((t) => !t.ended_at).map((t) => Number(t.person_id)),
    miles: miles.map((m) => ({ id: Number(m.id), personId: Number(m.person_id), name: m.name, onDate: m.on_date, miles: Number(m.miles) })),
    totalMiles: Math.round(miles.reduce((s, m) => s + Number(m.miles), 0) * 10) / 10
  };
}

/** One "on my way" message per choice of minutes, in the viewer's name. */
export function onMyWay(job, staffName) {
  if (!['quoted', 'booked', 'completed'].includes(job.status)) return null;
  const contact = { site: job.site, customerName: job.customerName, customerPhone: job.customerPhone, customerEmail: job.customerEmail, staffName };
  const out = {};
  for (const minutes of ON_MY_WAY_MINUTES) out[minutes] = messageFor('onmyway', { ...contact, minutes });
  return out;
}

/** One time op. True when made; false when an error has been sent. */
export async function timeOp({ op, job, body, scope, res, json }) {
  const site = job.site;
  if (['clockin', 'clockout', 'miles', 'hours'].includes(op) && !scope.personId) {
    return fail(json, res, 'time', 'Sign in with your own code to clock in or log miles.');
  }
  if (op === 'clockin') {
    await query('update job_time set ended_at = now() where person_id = $1 and ended_at is null', [scope.personId]);
    await query('insert into job_time (job_id, person_id) values ($1, $2)', [job.id, scope.personId]);
    return true;
  }
  if (op === 'clockout') {
    const done = await queryOne('update job_time set ended_at = now() where person_id = $1 and job_id = $2 and ended_at is null returning id', [scope.personId, job.id]);
    return done ? true : fail(json, res, 'time', 'You are not clocked in on this job.');
  }
  if (op === 'untime') {
    if (!canManage(scope, site)) return fail(json, res, 'time', 'Whoever manages the business can remove time.', 403);
    await query('delete from job_time where id = $1 and job_id = $2', [Number(body.timeId), job.id]);
    return true;
  }
  if (op === 'miles') {
    const miles = Math.round(Number(body.miles) * 10) / 10;
    const onDate = str(body.onDate, 10) || null;
    if (!(miles > 0 && miles < 10000) || (onDate && !/^\d{4}-\d{2}-\d{2}$/.test(onDate))) return fail(json, res, 'miles', 'Miles as a number, and a date if not today.');
    await query(`insert into job_miles (person_id, job_id, on_date, miles) values ($1, $2, coalesce($3::date, (now() at time zone 'Europe/London')::date), $4)`,
      [scope.personId, job.id, onDate, miles]);
    return true;
  }
  if (op === 'hours') {
    /* Told afterwards ("I did six hours on Tuesday"), so it is written as a
       closed stretch from 8am London time that day, which is all the profit
       maths needs: the length, the person and their rate. */
    const hours = Math.round(Number(body.hours) * 100) / 100;
    const onDate = str(body.onDate, 10) || null;
    if (!(hours > 0 && hours <= 16) || (onDate && !/^\d{4}-\d{2}-\d{2}$/.test(onDate))) return fail(json, res, 'time', 'Hours between 0 and 16, and a date if not today.');
    await query(
      `insert into job_time (job_id, person_id, started_at, ended_at)
       select $1, $2, s, s + $4::float8 * interval '1 hour'
         from (select ((coalesce($3::date, (now() at time zone 'Europe/London')::date) + time '08:00') at time zone 'Europe/London') as s) x`,
      [job.id, scope.personId, onDate, hours]);
    return true;
  }
  if (op === 'rate') {
    if (!canManage(scope, site)) return fail(json, res, 'rate', 'Whoever manages the business sets hourly rates.', 403);
    const rate = Math.round(Number(body.hourlyRatePence));
    if (!(rate >= 0 && rate <= 100000)) return fail(json, res, 'rate', 'An hourly rate in pounds.');
    /* Only somebody who works for this business: a rate is not a key to
       anybody else's record. */
    const done = await queryOne(
      `update people set hourly_rate_pence = $2 where id = $1 and exists (select 1 from grants g where g.person_id = $1 and g.business_slug = $3) returning id`,
      [Number(body.personId), rate, site]);
    return done ? true : fail(json, res, 'rate', 'Choose somebody who works for this business.');
  }
  return fail(json, res, 'op', 'Unknown change.');
}
