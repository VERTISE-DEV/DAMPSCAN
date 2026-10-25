/**
 * The same person twice: a website enquiry that was never linked to the job
 * made for them (booked by phone, or before the assistant linked enquiries).
 * Matched by email, phone, or first name and postcode within the business.
 * Linking it marks the enquiry converted, which keeps the booking figures
 * on Insights and the dashboard true.
 */
import { query, queryOne } from './db.js';

const MATCH = `l.site = j.site and l.stage = 'complete'
  and not exists (select 1 from jobs k where k.lead_id = l.id)
  and ((coalesce(l.email, '') <> '' and lower(l.email) = lower(coalesce(j.customer_email, '')))
    or (coalesce(l.phone, '') <> '' and regexp_replace(l.phone, '\\D', '', 'g') = regexp_replace(coalesce(j.customer_phone, ''), '\\D', '', 'g'))
    or (replace(upper(l.postcode), ' ', '') = replace(upper(coalesce(j.customer_postcode, '')), ' ', '')
        and lower(trim(l.first_name)) = lower(split_part(trim(coalesce(j.customer_name, '')), ' ', 1))))`;

/** Unlinked enquiries that look like this job's customer. */
export async function matchesFor(scope, jobId) {
  const j = await queryOne('select id, site, lead_id from jobs where id = $1', [jobId]);
  if (!j || !scope.businesses.includes(j.site) || j.lead_id) return [];
  const rows = await query(
    `select l.id, l.first_name, l.postcode, l.created_at from jobs j join leads l on ${MATCH}
      where j.id = $1 order by l.created_at desc limit 5`, [jobId]);
  return rows.map((r) => ({ leadId: Number(r.id), firstName: r.first_name, postcode: r.postcode, createdAt: r.created_at }));
}

/** Links one of those enquiries to the job. Only a match is accepted. */
export async function linkLead(scope, jobId, leadId) {
  const ok = (await matchesFor(scope, jobId)).some((m) => m.leadId === Number(leadId));
  if (!ok) return { error: 'That enquiry is not an unlinked match for this customer.' };
  await query('update jobs set lead_id = $2, updated_at = now() where id = $1 and lead_id is null', [jobId, leadId]);
  return { ok: true };
}
