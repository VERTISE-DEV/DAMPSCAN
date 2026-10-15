/**
 * CoolRight's records beyond the pipeline: the units fitted on each job, the
 * service plans as recurring income, the service round (plans due, grouped by
 * postcode district so a day's visits sit close together), the "Before
 * summer" list and warranties about to run out.
 *
 * Service plans are the existing service_contracts rows (contracts.js); this
 * file only reads them in the shapes CoolRight's pages want.
 */
import { query } from './db.js';
import { TODAY } from './today.js';
import { messageFor } from './messages.js';
import { firstName } from './roofing.js';
import { WARRANTY_DAYS } from './coolright.js';

const N = (v) => Number(v) || 0;
const day = (v) => (v == null ? null : String(v instanceof Date ? v.toISOString() : v).slice(0, 10));
export const UNIT_SIDES = ['indoor', 'outdoor'];

/** "ME14 5AB" to its district "ME14" and its area "ME"; a part postcode is taken as it is. */
export function districtOf(postcode) {
  const pc = String(postcode || '').toUpperCase().replace(/\s+/g, '');
  if (!pc) return { district: 'No postcode', area: 'No postcode' };
  const district = pc.length >= 5 ? pc.slice(0, -3) : pc;
  return { district, area: (district.match(/^[A-Z]+/) || [district])[0] };
}

export function presentUnit(u) {
  return {
    id: Number(u.id), jobId: Number(u.job_id), side: u.side, make: u.make || null, model: u.model || null, serial: u.serial || null,
    refrigerant: u.refrigerant || null, chargeKg: u.charge_kg == null ? null : Number(u.charge_kg), installedOn: day(u.installed_on),
    warrantyUntil: day(u.warranty_until), location: u.location || null, note: u.note || null
  };
}

export async function unitsOf(jobId) {
  return (await query('select * from ac_units where job_id = $1 order by side desc, id', [jobId])).map(presentUnit);
}

const clean = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Add, change or remove one unit. Returns { unit } or { error } in words.
 * A field left out of an edit keeps its value.
 */
export async function saveUnit(jobId, body) {
  if (body.remove) {
    const gone = await query('delete from ac_units where id = $1 and job_id = $2 returning id', [Number(body.unitId), jobId]);
    return gone.length ? { removed: Number(body.unitId) } : { error: 'That unit is not on this job.' };
  }
  const existing = body.unitId ? (await query('select * from ac_units where id = $1 and job_id = $2', [Number(body.unitId), jobId]))[0] : null;
  if (body.unitId && !existing) return { error: 'That unit is not on this job.' };
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  const pick = (k, col, n) => (has(k) ? clean(body[k], n) : existing ? existing[col] : null);
  const side = has('side') ? body.side : existing ? existing.side : 'indoor';
  if (!UNIT_SIDES.includes(side)) return { error: 'A unit is indoor or outdoor.' };
  let kg = existing ? existing.charge_kg : null;
  if (has('chargeKg')) {
    kg = body.chargeKg == null || body.chargeKg === '' ? null : Number(body.chargeKg);
    if (kg != null && !(kg >= 0 && kg < 1000)) return { error: 'Enter the refrigerant charge in kg.' };
  }
  const dates = {};
  for (const [k, col] of [['installedOn', 'installed_on'], ['warrantyUntil', 'warranty_until']]) {
    dates[k] = has(k) ? (body[k] || null) : existing ? day(existing[col]) : null;
    if (dates[k] && !DATE.test(dates[k])) return { error: 'Enter dates as YYYY-MM-DD.' };
  }
  const v = [side, pick('make', 'make', 60), pick('model', 'model', 80), pick('serial', 'serial', 80), pick('refrigerant', 'refrigerant', 20), kg,
    dates.installedOn, dates.warrantyUntil, pick('location', 'location', 80), pick('note', 'note', 500)];
  const row = existing
    ? (await query(`update ac_units set side = $2, make = $3, model = $4, serial = $5, refrigerant = $6, charge_kg = $7, installed_on = $8::date,
         warranty_until = $9::date, location = $10, note = $11, updated_at = now() where id = $1 returning *`, [existing.id, ...v]))[0]
    : (await query(`insert into ac_units (job_id, side, make, model, serial, refrigerant, charge_kg, installed_on, warranty_until, location, note)
         values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11) returning *`, [jobId, ...v]))[0];
  return { unit: presentUnit(row) };
}

/** Active plans: how many, and what they bring in a month and a year. */
export async function recurringIncome(sites) {
  if (!sites.length) return null;
  const r = (await query(
    `select count(*)::int as plans, count(price_pence)::int as priced,
            coalesce(sum(price_pence * 12.0 / interval_months), 0) as annual
       from service_contracts where business_slug = any($1::text[]) and status = 'active'`, [sites]))[0];
  const annual = Math.round(N(r.annual));
  return { plans: N(r.plans), priced: N(r.priced), annualPence: annual, monthlyPence: Math.round(annual / 12) };
}

const CONTACT = `
  select c.*, c.next_due_on::text as next_due, c.booked_on::text as booked, c.booked_time::text as booked_at,
         c.last_contacted_on::text as contacted, c.last_serviced_on::text as serviced, (c.next_due_on - ${TODAY}) as days_until_due,
         coalesce(j.customer_phone, l.phone) as phone, coalesce(j.customer_email, l.email) as email
    from service_contracts c left join jobs j on j.id = c.job_id left join leads l on l.id = j.lead_id`;

/** Services due by the end of next month (and any overdue), each with its booking message, grouped by district. */
export async function servicesDue(sites, { months = 2 } = {}) {
  const rows = await query(`${CONTACT}
     where c.business_slug = any($1::text[]) and c.status = 'active'
       and c.next_due_on < date_trunc('month', ${TODAY}) + ($2::int * interval '1 month')
     order by c.next_due_on, c.id limit 400`, [sites, months]);
  const services = rows.map((r) => {
    const { district, area } = districtOf(r.customer_postcode);
    const message = messageFor('service', { site: r.business_slug, customerName: r.customer_name, serviceDueOn: r.next_due, customerPhone: r.phone, customerEmail: r.email });
    return {
      id: Number(r.id), site: r.business_slug, jobId: r.job_id == null ? null : Number(r.job_id), name: r.customer_name || null, firstName: firstName(r.customer_name),
      postcode: r.customer_postcode || null, district, area, phone: r.phone || null, nextDueOn: r.next_due, daysUntilDue: N(r.days_until_due),
      bookedOn: r.booked, bookedTime: r.booked_at ? r.booked_at.slice(0, 5) : null, lastContactedOn: r.contacted, lastServicedOn: r.serviced,
      intervalMonths: N(r.interval_months), pricePence: r.price_pence == null ? null : N(r.price_pence), unitCount: N(r.unit_count), message
    };
  });
  const groups = new Map();
  for (const s of services) {
    if (!groups.has(s.district)) groups.set(s.district, { district: s.district, area: s.area, services: [] });
    groups.get(s.district).services.push(s);
  }
  return { services, districts: [...groups.values()].sort((a, b) => a.area.localeCompare(b.area) || a.district.localeCompare(b.district, 'en', { numeric: true })) };
}

/**
 * The "Before summer" list: past CoolRight customers (installed work) with no
 * active plan, or whose plan is due by the end of June, not asked this year.
 * One row per job; the newest job wins for a customer with two.
 */
export async function summerList(sites) {
  const rows = await query(
    `select distinct on (lower(coalesce(j.customer_name, '')), upper(coalesce(j.customer_postcode, '')))
            j.id, j.site, j.customer_name, j.customer_postcode, j.job_date::text as job_date, j.summer_asked_on::text as asked,
            coalesce(j.customer_phone, l.phone) as phone, coalesce(j.customer_email, l.email) as email,
            c.id as contract_id, c.next_due_on::text as next_due
       from jobs j left join leads l on l.id = j.lead_id
       left join service_contracts c on c.job_id = j.id and c.status = 'active'
      where j.site = any($1::text[]) and j.status in ('completed', 'paid')
        and (c.id is null or c.next_due_on <= make_date(extract(year from ${TODAY})::int, 6, 30))
        and (c.booked_on is null)
      order by lower(coalesce(j.customer_name, '')), upper(coalesce(j.customer_postcode, '')), j.job_date desc, j.id desc
      limit 400`, [sites]);
  const year = new Date().getUTCFullYear();
  return rows.map((r) => {
    const onPlan = r.contract_id != null;
    return {
      jobId: Number(r.id), site: r.site, name: r.customer_name || null, firstName: firstName(r.customer_name), postcode: r.customer_postcode || null,
      phone: r.phone || null, jobDate: r.job_date, onPlan, contractId: onPlan ? Number(r.contract_id) : null, nextDueOn: r.next_due || null,
      askedOn: r.asked, askedThisYear: Boolean(r.asked && Number(r.asked.slice(0, 4)) === year),
      message: messageFor('summer', { site: r.site, customerName: r.customer_name, onPlan, customerPhone: r.phone, customerEmail: r.email })
    };
  }).sort((a, b) => Number(a.askedThisYear) - Number(b.askedThisYear) || String(a.postcode).localeCompare(String(b.postcode)));
}

/** Units whose warranty ends within WARRANTY_DAYS, for Today and the board. */
export async function warrantiesEnding(sites) {
  if (!sites.length) return [];
  const rows = await query(
    `select u.*, j.site, j.status, j.customer_name, j.customer_postcode, j.job_date::text as job_date
       from ac_units u join jobs j on j.id = u.job_id
      where j.site = any($1::text[]) and u.warranty_until between ${TODAY} and ${TODAY} + ${WARRANTY_DAYS}
      order by u.warranty_until, u.id limit 60`, [sites]);
  return rows.map((r) => ({ ...presentUnit(r), site: r.site, status: r.status, customerName: r.customer_name, postcode: r.customer_postcode, jobDate: r.job_date }));
}

/** The job's active plan, as the pop-up and the job screen show it. */
export async function planOfJob(jobId) {
  const r = (await query(`${CONTACT} where c.job_id = $1 order by (c.status = 'active') desc, c.id desc limit 1`, [jobId]))[0];
  if (!r) return null;
  return { id: Number(r.id), status: r.status, intervalMonths: N(r.interval_months), pricePence: r.price_pence == null ? null : N(r.price_pence),
    nextDueOn: r.next_due, bookedOn: r.booked, bookedTime: r.booked_at ? r.booked_at.slice(0, 5) : null, lastServicedOn: r.serviced, daysUntilDue: N(r.days_until_due) };
}
