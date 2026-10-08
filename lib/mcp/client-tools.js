/**
 * Assistant tools for clients: finding one, starting one, and correcting
 * their details.
 *
 * There is no clients table, on purpose (see lib/routes/admin/clients.js): a
 * client is the customer on a job, filled in behind by the web enquiry it
 * came from. So a client here is found across jobs and enquiries, "creating"
 * one is starting their first job (the client card appears from it, exactly
 * as on the screen), and updating one changes the details on their job
 * through the same staff route save, with its validation and audit row.
 */
import { query } from '../db.js';
import { present } from '../quoted.js';
import quoted from '../routes/admin/quoted.js';
import jobs from '../routes/admin/jobs.js';
import { callRoute, read, write, fail, notFound, jobInScope, ID } from './shared.js';

const isDamp = (site) => site === 'dampscan' || site === 'ati-london';

/** Clients in scope matching a name, phone, email or postcode, grouped by who they are. */
async function findClient(scope, { text }) {
  const raw = String(text || '').trim().slice(0, 80);
  if (raw.length < 2) return fail('Search for at least two characters.');
  const t = `%${raw}%`;
  const rows = await query(
    `select j.id as job_id, null::bigint as lead_id, j.site, j.status, j.job_date::text as job_date,
            coalesce(j.customer_name, l.first_name) as name, coalesce(j.customer_phone, l.phone) as phone,
            coalesce(j.customer_email, l.email) as email, coalesce(j.customer_postcode, l.postcode) as postcode
       from jobs j left join leads l on l.id = j.lead_id
      where j.site = any($1::text[]) and (j.customer_name ilike $2 or j.customer_postcode ilike $2 or j.customer_email ilike $2 or j.customer_phone ilike $2
            or l.first_name ilike $2 or l.email ilike $2 or l.phone ilike $2 or replace(coalesce(j.customer_postcode, l.postcode, ''), ' ', '') ilike replace($2, ' ', ''))
     union all
     select null, l.id, l.site, 'enquiry', null, l.first_name, l.phone, l.email, l.postcode
       from leads l
      where l.site = any($1::text[]) and l.stage = 'complete' and not exists (select 1 from jobs j where j.lead_id = l.id)
        and (l.first_name ilike $2 or l.email ilike $2 or l.phone ilike $2 or replace(l.postcode, ' ', '') ilike replace($2, ' ', ''))
     limit 60`, [scope.businesses, t]);
  /* One person with three jobs is one client: grouped by email, else phone, else name and postcode. */
  const byKey = new Map();
  for (const r of rows) {
    const key = (r.email || '').toLowerCase() || (r.phone || '').replace(/\D/g, '') || `${(r.name || '').toLowerCase()}|${(r.postcode || '').replace(/\s/g, '').toUpperCase()}`;
    const c = byKey.get(key) || { name: r.name, phone: r.phone, email: r.email, postcode: r.postcode, jobs: [], enquiries: [] };
    if (r.job_id) c.jobs.push({ id: Number(r.job_id), site: r.site, status: r.status, date: r.job_date });
    else c.enquiries.push({ id: Number(r.lead_id), site: r.site });
    byKey.set(key, c);
  }
  return { status: 200, data: { ok: true, clients: [...byKey.values()].slice(0, 25) } };
}

/** An existing client's details, from one of their jobs, for create_job. */
export async function clientFrom(scope, jobId) {
  const found = await jobInScope(scope, jobId);
  if (!found) return null;
  const j = found.job;
  const lead = j.lead_id ? (await query('select first_name, phone, email, postcode from leads where id = $1', [j.lead_id]))[0] : null;
  return {
    customer_name: j.customer_name || (lead && lead.first_name), postcode: j.customer_postcode || (lead && lead.postcode),
    phone: j.customer_phone || (lead && lead.phone), email: j.customer_email || (lead && lead.email)
  };
}

async function updateClient(scope, { id, name, postcode, phone, email }) {
  const found = await jobInScope(scope, id);
  if (!found) return notFound();
  const j = found.job;
  if (isDamp(j.site)) {
    if (phone !== undefined || email !== undefined) return fail('On ATi and DampScan cards the phone and email come from the enquiry, so only the name and postcode can be changed here.');
    /* The damp save writes every field, so it is sent the job as it stands. */
    return callRoute(jobs, scope, { method: 'POST', url: '/api/admin/jobs', body: {
      id, site: j.site, surveyor: j.surveyor, surveyType: j.survey_type, surveyPricePence: Number(j.survey_price_pence), surveyorFeePence: Number(j.surveyor_fee_pence),
      remedialPence: Number(j.remedial_pence), status: j.status, leadId: j.lead_id, jobDate: j.job_date ? new Date(j.job_date).toLocaleDateString('en-CA') : null,
      jobTime: j.job_time ? String(j.job_time).slice(0, 5) : null, note: j.note,
      customerName: name ?? j.customer_name, customerPostcode: postcode ?? j.customer_postcode } });
  }
  const p = await present(j, found.business);
  return callRoute(quoted, scope, { method: 'POST', url: '/api/admin/quoted', body: {
    op: 'save', id, site: p.site, customerName: name ?? p.customerName, customerPostcode: postcode ?? p.customerPostcode, note: p.note,
    invoiceNetPence: p.invoiceNetPence, status: p.status, jobDate: p.jobDate, jobTime: p.jobTime,
    ...(phone !== undefined ? { customerPhone: phone } : {}), ...(email !== undefined ? { customerEmail: email } : {}) } });
}

export const CLIENT_TOOLS = [
  read('find_client', 'Find a client', 'Finds clients by name, phone, email or postcode across jobs and enquiries, one entry per person with their job numbers and any enquiry not yet a job.',
    { text: { type: 'string' } }, findClient),
  write('update_client', 'Update a client', 'Corrects a client\'s name, postcode, phone or email on one of their jobs (id is the client\'s name and/or postcode). For ATi and DampScan only the name and postcode.',
    { id: ID, name: { type: 'string' }, postcode: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } }, ['id'], updateClient, { idempotent: true })
];
