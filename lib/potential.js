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
       (select coalesce(sum(p.amount_pence), 0) from job_payments p join jobs j on j.id = p.job_id where j.site = any($1::text[]))
       + (select coalesce(sum(j.survey_price_pence + j.remedial_pence), 0) from jobs j join businesses b on b.slug = j.site
           where j.site = any($1::text[]) and b.payout_model = 'damp' and j.paid_at is not null) as earned,
       (select count(*) from jobs j where j.site = any($1::text[]) and j.status in ('booked', 'completed', 'paid')) as won,
       (select coalesce(sum(${VALUE}), 0) from jobs j join businesses b on b.slug = j.site
         where j.site = any($1::text[]) and j.status in ('booked', 'completed', 'paid')) as won_value,
       (select count(*) from leads l where l.site = any($1::text[]) and l.stage = 'complete'
         and not exists (select 1 from jobs j where j.lead_id = l.id and j.status in ('booked', 'completed', 'paid'))) as missed,
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
