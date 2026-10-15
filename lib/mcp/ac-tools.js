/**
 * Assistant tools for CoolRight: "add a Daikin indoor unit to the Patels'
 * job, serial X, R32 0.9kg", "commissioned today by Sam, F-gas ref 1234",
 * "put Mrs Patel on a yearly plan at £120", "which services are due in ME
 * this month". Each is the same /api/admin/coolright write the board and the
 * job screen make, so audit and Undo stay one story.
 */
import coolright from '../routes/admin/coolright.js';
import { callRoute, read, write, fail, notFound, jobInScope, ID, DATE } from './shared.js';

async function acJob(scope, id) {
  const found = await jobInScope(scope, id);
  if (!found) return { error: notFound() };
  if (found.job.site !== 'ac') return { error: fail('These tools are for CoolRight jobs.') };
  return found;
}

const post = (scope, body) => callRoute(coolright, scope, { method: 'POST', url: '/api/admin/coolright', body });
const slim = (c) => ({ id: c.id, name: c.name, postcode: c.postcode, stage: c.stage, next: c.next, badges: c.badges, units: c.units,
  commissionedOn: c.commissionedOn, engineer: c.engineer, fgasRef: c.fgasRef, onPlan: c.onPlan });

async function unit(scope, args) {
  const found = await acJob(scope, args.id);
  if (found.error) return found.error;
  const body = { op: 'unit', id: args.id };
  const map = { unit_id: 'unitId', side: 'side', make: 'make', model: 'model', serial: 'serial', refrigerant: 'refrigerant', charge_kg: 'chargeKg',
    installed_on: 'installedOn', warranty_until: 'warrantyUntil', location: 'location', note: 'note', remove: 'remove' };
  for (const [k, v] of Object.entries(map)) if (args[k] !== undefined) body[v] = args[k];
  const r = await post(scope, body);
  if (r.data && r.data.ok) return { status: 200, data: { ok: true, units: r.data.units, job: slim(r.data.card) } };
  return r;
}

async function commission(scope, args) {
  const found = await acJob(scope, args.id);
  if (found.error) return found.error;
  /* Fields not given keep what the job has, as the job screen's form sends them all. */
  const now = (await callRoute(coolright, scope, { url: `/api/admin/coolright?area=ac&view=job&id=${args.id}` })).data;
  const c = (now && now.card) || {};
  const pick = (k, cur) => (args[k] !== undefined ? args[k] : cur);
  const r = await post(scope, { op: 'commission', id: args.id, commissionedOn: pick('commissioned_on', c.commissionedOn), engineer: pick('engineer', c.engineer),
    fgasRef: pick('fgas_ref', c.fgasRef), leakCheckOn: pick('leak_check_on', c.leakCheckOn), pressureTest: pick('pressure_test', c.pressureTest) });
  if (r.data && r.data.ok) return { status: 200, data: { ok: true, job: slim(r.data.card) } };
  return r;
}

async function plan(scope, { id, interval_months: months, price_pounds: pounds, first_due_on: due }) {
  const found = await acJob(scope, id);
  if (found.error) return found.error;
  const r = await post(scope, { op: 'plan', id, intervalMonths: months, pricePence: pounds == null ? null : Math.round(Number(pounds) * 100), nextDueOn: due });
  if (r.data && r.data.ok) return { status: 200, data: { ok: true, plan: r.data.plan, job: slim(r.data.card) } };
  return r;
}

async function due(scope, { area }) {
  const r = await callRoute(coolright, scope, { url: '/api/admin/coolright?area=ac&view=services' });
  if (!r.data || !r.data.ok) return r;
  const want = String(area || '').toUpperCase().replace(/\s+/g, '');
  const districts = r.data.districts.filter((d) => !want || d.district.startsWith(want) || d.area === want)
    .map((d) => ({ district: d.district, services: d.services.map((s) => ({ contractId: s.id, jobId: s.jobId, name: s.name, postcode: s.postcode, phone: s.phone,
      nextDueOn: s.nextDueOn, overdueDays: s.daysUntilDue < 0 ? -s.daysUntilDue : 0, bookedOn: s.bookedOn, lastContactedOn: s.lastContactedOn,
      whatsapp: s.message && s.message.links.whatsapp })) }));
  return { status: 200, data: { ok: true, today: r.data.today, districts, tip: 'Book a visit or record a service on the CoolRight Services page (the service round).' } };
}

export const AC_TOOLS = [
  write('coolright_unit', 'CoolRight unit record', 'Adds or updates one air conditioning or heat pump unit on a CoolRight job: indoor or outdoor, make, model, serial, refrigerant type, charge in kg, install date, warranty expiry, where it is in the property, notes. Give unit_id to change an existing unit (remove true takes it off). Fields left out keep their value.',
    { id: ID, unit_id: { type: 'integer' }, side: { type: 'string', enum: ['indoor', 'outdoor'] }, make: { type: 'string' }, model: { type: 'string' }, serial: { type: 'string' },
      refrigerant: { type: 'string', description: 'e.g. R32' }, charge_kg: { type: ['number', 'null'] }, installed_on: DATE, warranty_until: DATE,
      location: { type: 'string', description: 'e.g. main bedroom, rear wall' }, note: { type: 'string' }, remove: { type: 'boolean' } }, ['id'], unit),
  write('coolright_commissioning', 'CoolRight commissioning and F-gas', 'Records commissioning and the F-gas record on a CoolRight job that is installed: the day commissioned (moves it to Commissioned), the engineer, the F-gas certificate or record reference, the leak check date and the pressure test. Fields left out keep their value; an empty string clears one.',
    { id: ID, commissioned_on: DATE, engineer: { type: 'string' }, fgas_ref: { type: 'string' }, leak_check_on: DATE, pressure_test: { type: 'string', description: 'e.g. 38 bar held for 30 minutes' } }, ['id'], commission),
  write('coolright_service_plan', 'CoolRight service plan', 'Adds a service plan (a service contract) to a fitted CoolRight job, or changes its interval and price if it has one. The first service is due the interval after commissioning unless first_due_on is given.',
    { id: ID, interval_months: { type: 'integer', description: 'Months between services, usually 12.' }, price_pounds: { type: ['number', 'null'], description: 'Price per service in pounds.' }, first_due_on: DATE }, ['id'], plan),
  read('coolright_services_due', 'CoolRight services due by area', 'CoolRight service plans due this month and next (and any overdue), grouped by postcode district, with phone, WhatsApp link and whether a visit is booked. Give area as a postcode area or district (e.g. ME or ME14) to narrow it.',
    { area: { type: 'string', description: 'Postcode area or district, e.g. ME or ME14.' } }, due)
];
