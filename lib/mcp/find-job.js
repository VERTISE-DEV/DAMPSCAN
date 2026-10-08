/**
 * Jobs by who and where, not by number. Nobody sees job numbers on the
 * screens, so the person says "Sarah Jones BR6" and the assistant passes
 * those words in place of the number; this turns them into the one job
 * they mean, or lists the candidates so the assistant can ask which.
 */
import { query } from '../db.js';

const JOB_KEYS = ['id', 'job', 'job_id', 'client_job_id'];

/** Every word must appear in the name or the postcode (spaces ignored). */
export async function findJobs(scope, words) {
  const terms = String(words || '').toLowerCase().split(/[\s,]+/).filter(Boolean).slice(0, 6);
  if (!terms.length) return [];
  const conds = terms.map((_, i) =>
    `(lower(coalesce(j.customer_name, l.first_name, '')) like $${i + 2}
      or replace(lower(coalesce(j.customer_postcode, l.postcode, '')), ' ', '') like $${i + 2})`).join(' and ');
  return query(
    `select j.id, j.site, j.status, j.job_date, coalesce(j.customer_name, l.first_name) as name,
            coalesce(j.customer_postcode, l.postcode) as postcode
       from jobs j left join leads l on l.id = j.lead_id
      where j.site = any($1::text[]) and ${conds}
      order by (j.status in ('cancelled','declined')), j.created_at desc limit 8`,
    [scope.businesses, ...terms.map((t) => `%${t.replace(/[%_\\]/g, '')}%`)]);
}

/**
 * Swaps words for a job number in a tool's arguments. Returns the arguments
 * ready to run, or a message for the assistant when there is no clear match.
 */
export async function resolveJobArgs(scope, args) {
  const out = { ...args };
  for (const key of JOB_KEYS) {
    const v = out[key];
    if (typeof v !== 'string') continue;
    if (/^\d+$/.test(v.trim())) { out[key] = Number(v); continue; }
    const found = await findJobs(scope, v);
    const live = found.filter((j) => !['cancelled', 'declined'].includes(j.status));
    const pick = live.length === 1 ? live[0] : found.length === 1 ? found[0] : null;
    if (pick) { out[key] = Number(pick.id); continue; }
    const matches = found.map((j) => ({ number: Number(j.id), name: j.name, postcode: j.postcode, business: j.site, status: j.status, date: j.job_date }));
    return {
      error: found.length
        ? { ok: false, error: 'More than one job matches. Ask the person which one, describing each by name, postcode, business, status and date (not by number), then call again with that job\'s number.', matches }
        : { ok: false, error: `No job for "${v}" in the businesses you hold. Try the name or postcode another way, or use find_client.` }
    };
  }
  return { args: out };
}

/** The job argument as the assistant sees it: words or a number. */
export const JOB_REF = {
  type: 'string',
  description: 'The customer, by name and/or postcode as the person says it (e.g. "Sarah Jones", "BR6 0AA", "Jones BR6"). A job number also works but people never see those, so do not ask for one.'
};
