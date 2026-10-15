/**
 * Two reads for Today (calendar.html) beyond the dated events:
 *
 * unbookedFor: work that is agreed but has no day anybody chose. A job always
 * holds a date (it defaults to the day it was made), so date_set (schema.sql)
 * tells a real date from a default; these sit in "Not booked in yet" rather
 * than on the day they happened to be typed in.
 *
 * jobFor: one job as Today's pop-up shows it, so a tap on the timeline can
 * show and act on everything about the job without leaving the page. Money is
 * only included for a business the person manages, as everywhere else.
 */
import { query, queryOne } from './db.js';

const day = (v) => (v == null ? null : String(v).slice(0, 10));
const hhmm = (v) => (v ? String(v).slice(0, 5) : null);

export async function unbookedFor(sites) {
  const rows = await query(
    `select j.id, j.site, j.status, j.job_date::text as job_date, j.customer_name, j.customer_postcode, b.payout_model
       from jobs j join businesses b on b.slug = j.site
      where j.site = any($1::text[]) and j.job_time is null
        and ((j.status = 'booked' and not j.date_set)
          or (j.status = 'quoted' and (j.quote_accepted_at is not null or j.won_at is not null) and not j.date_set))
      order by j.created_at desc limit 60`, [sites]);
  return rows.map((r) => ({ kind: 'job', id: Number(r.id), site: r.site, status: r.status, date: null, time: null,
    customerName: r.customer_name, postcode: r.customer_postcode, quoted: r.payout_model !== 'damp', dateSet: false }));
}

export async function jobFor(scope, sites, id) {
  const r = await queryOne(
    `select j.id, j.site, j.status, j.job_date::text as job_date, j.job_time, j.date_set, j.customer_name, j.customer_postcode,
            coalesce(j.customer_phone, l.phone) as phone, coalesce(j.customer_email, l.email) as email, j.note, j.awaiting_agent,
            j.deposit_paid_at, j.paid_at, j.survey_sent_at, j.survey_price_pence, j.remedial_pence, j.invoice_net_pence,
            j.quote_accepted_at, j.won_at, l.address_line1, l.address_line2, l.town, b.payout_model, b.name as business_name,
            coalesce((select sum(p.amount_pence) from job_payments p where p.job_id = j.id), 0) as received
       from jobs j join businesses b on b.slug = j.site left join leads l on l.id = j.lead_id and l.site = j.site
      where j.id = $1 and j.site = any($2::text[])`, [id, sites]);
  if (!r) return null;
  const money = scope.isAdmin || scope.levels[r.site] === 'manage';
  const damp = r.payout_model === 'damp';
  const todos = await query(
    `select t.id, t.text, t.due_on::text as due_on, p.name as for_name from todos t left join people p on p.id = t.for_person_id
      where t.job_id = $1 and t.done_at is null order by t.due_on nulls last, t.id limit 20`, [id]);
  const price = Number(r.survey_price_pence || 0) + Number(r.remedial_pence || 0);
  return {
    id: Number(r.id), site: r.site, business: r.business_name, status: r.status, quoted: !damp,
    date: day(r.job_date), time: hhmm(r.job_time), dateSet: Boolean(r.date_set), accepted: Boolean(r.quote_accepted_at || r.won_at),
    customerName: r.customer_name, postcode: r.customer_postcode, phone: r.phone, email: r.email, note: r.note,
    address: [r.address_line1, r.address_line2, r.town, r.customer_postcode].filter(Boolean),
    awaitingAgent: Boolean(r.awaiting_agent), depositPaid: Boolean(r.deposit_paid_at), paid: Boolean(r.paid_at), reportSent: Boolean(r.survey_sent_at),
    money: money ? (damp ? { pricePence: price, depositPence: Math.ceil(Number(r.survey_price_pence || 0) / 2) }
      : { pricePence: Number(r.invoice_net_pence || 0), receivedPence: Number(r.received) }) : null,
    todos: todos.map((t) => ({ id: Number(t.id), text: t.text, dueOn: t.due_on, forName: t.for_name }))
  };
}
