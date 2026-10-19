/**
 * A survey report not sent within 24 hours of the survey ending (its start
 * plus an hour), as one phone alert per job. The board's countdown turns red
 * at the same moment. Only the last two days are looked at, so the first run
 * does not ring for every old survey, and the stamp keeps it to one alert.
 * The customer is first name and postcode district only, as every alert is.
 */
import { query } from './db.js';
import { notify } from './notify.js';
import { customer, jobPage } from './alert-words.js';

const SURVEYOR = { scott: 'Scott', tom: 'Tom', ben: 'Ben', ronnie: 'Ronnie' };

export async function alertLateReports() {
  const rows = await query(
    `update jobs j set report_late_alerted_at = now()
      where j.site in ('dampscan', 'ati-london') and j.job_time is not null and j.survey_sent_at is null
        and j.report_late_alerted_at is null and j.status in ('booked', 'completed', 'paid')
        and ((j.job_date + j.job_time) at time zone 'Europe/London') + interval '25 hours' between now() - interval '2 days' and now()
      returning j.id, j.site, j.customer_name, j.customer_postcode, j.surveyor`);
  for (const r of rows) {
    await notify({ business: r.site, kind: 'report_late', ref: r.id, tags: 'alarm_clock', priority: 4, path: jobPage(r.site, r.id),
      title: `Report overdue: ${customer(r.customer_name, r.customer_postcode)}`,
      message: `24 hours since the survey${SURVEYOR[r.surveyor] ? ` (${SURVEYOR[r.surveyor]})` : ''} and the report is not sent.` });
  }
  return { sent: rows.length };
}
