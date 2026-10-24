/**
 * All time on Insights: what the business has earned, and what it could have
 * earned. Earned is money that came in (payments on quoted jobs, and damp
 * surveys ticked paid in full). The two "could have" figures price every
 * missed chance at the average value of a job actually won:
 *   - every enquiry booked: jobs won plus enquiries that never became a job,
 *   - every visitor booked: each unique visitor to the website.
 * They are ceilings to steer by, not forecasts. Managers only (money).
 */
import { queryOne } from './db.js';

const VALUE = `(case when b.payout_model = 'damp' then j.survey_price_pence + j.remedial_pence else coalesce(j.invoice_net_pence, 0) end)`;
const N = (v) => Number(v || 0);

export async function allTime(sites) {
  if (!sites.length) return null;
  const r = await queryOne(
    `select
       /* Money in per job: quoted trades by their payments; a damp survey by the
          larger of its ticks (paid in full, or the half taken as a deposit) and
          any bank payments matched to it, so nothing counts twice. */
       (select coalesce(sum(case when b.payout_model = 'damp' then greatest(coalesce(p.paid, 0),
                  case when j.paid_at is not null then j.survey_price_pence + j.remedial_pence
                       when j.deposit_paid_at is not null then ceil(j.survey_price_pence / 2.0) else 0 end)
                else coalesce(p.paid, 0) end), 0)
          from jobs j join businesses b on b.slug = j.site
          left join (select job_id, sum(amount_pence) as paid from job_payments group by job_id) p on p.job_id = j.id
         where j.site = any($1::text[]) and j.status not in ('cancelled', 'declined')) as earned,
       (select count(*) from jobs j where j.site = any($1::text[]) and j.status in ('booked', 'completed', 'paid')) as won,
       (select coalesce(sum(${VALUE}), 0) from jobs j join businesses b on b.slug = j.site
         where j.site = any($1::text[]) and j.status in ('booked', 'completed', 'paid')) as won_value,
       (select count(*) from leads l where l.site = any($1::text[]) and l.stage = 'complete'
         /* Missed only if no job is theirs: many are booked by phone or the
            assistant without the enquiry being linked, so the same person is
            matched by email, phone, or first name and postcode. */
         and not exists (select 1 from jobs j where j.site = l.site and j.status not in ('cancelled', 'declined') and (
               j.lead_id = l.id
            or (l.email <> '' and lower(j.customer_email) = lower(l.email))
            or (coalesce(l.phone, '') <> '' and regexp_replace(j.customer_phone, '\\D', '', 'g') = regexp_replace(l.phone, '\\D', '', 'g'))
            or (replace(upper(j.customer_postcode), ' ', '') = replace(upper(l.postcode), ' ', '')
                and lower(split_part(trim(j.customer_name), ' ', 1)) = lower(trim(l.first_name)))))) as missed,
       (select count(distinct session_id) from events e where e.site = any($1::text[]) and e.type not in ('staff_login', 'staff_login_failed')) as visitors`,
    [sites]);
  const won = N(r.won);
  const average = won ? Math.round(N(r.won_value) / won) : 0;
  const enquiries = won + N(r.missed);
  return {
    earnedPence: N(r.earned), jobsWon: won, averageJobPence: average,
    enquiries, everyEnquiryPence: enquiries * average,
    visitors: N(r.visitors), everyVisitorPence: N(r.visitors) * average,
    bookingRate: enquiries ? Math.round((won / enquiries) * 1000) / 10 : null
  };
}
