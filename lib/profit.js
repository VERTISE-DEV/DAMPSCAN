/**
 * Profit per job for the quoted trades: the price against what the job
 * actually took, its cost lines and the hours people clocked on it.
 *
 *   profit = invoice net - cost lines - labour
 *   labour = each clocked stretch, in hours, at that person's hourly rate
 *
 * A job is over budget when its costs and labour pass a set share of its
 * price. That share is a judgement about margin, not a rule of the trade,
 * so it lives here once and the job screen and Insights both read it.
 *
 * The roofing owners' days are their payout and stay out of this: clocked
 * time is what the job used, days are how the owners are paid for it.
 */
export const OVER_BUDGET_BP = 8000;

const N = (v) => Number(v) || 0;
const HOUR = 3600000;

/** Hours in one clocked stretch; an open one counts up to `now`. */
export const hoursOf = (row, now = Date.now()) =>
  Math.max(0, ((row.ended_at ? Date.parse(row.ended_at) : now) - Date.parse(row.started_at)) / HOUR);

/**
 * The figure for one job. `time` rows carry started_at, ended_at and the
 * person's hourly_rate_pence; `costs` rows carry amount_pence.
 */
export function profitFor(invoiceNetPence, costs, time, now = Date.now()) {
  const pricePence = N(invoiceNetPence);
  const costsPence = costs.reduce((s, c) => s + N(c.amount_pence), 0);
  let hours = 0;
  let labourPence = 0;
  for (const t of time) {
    const h = hoursOf(t, now);
    hours += h;
    labourPence += Math.round(h * N(t.hourly_rate_pence));
  }
  const spent = costsPence + labourPence;
  return {
    pricePence,
    costsPence,
    labourHours: Math.round(hours * 100) / 100,
    labourPence,
    profitPence: pricePence - spent,
    spentBp: pricePence > 0 ? Math.round((spent * 10000) / pricePence) : null,
    overBudget: pricePence > 0 && spent * 10000 > pricePence * OVER_BUDGET_BP,
    thresholdBp: OVER_BUDGET_BP
  };
}

/* The same sums in SQL, for lists that cannot load every job whole. An open
   stretch counts up to now, as above. */
export const COSTS_SQL = `coalesce((select sum(c.amount_pence) from job_costs c where c.job_id = j.id), 0)`;
export const LABOUR_SQL = `coalesce((select sum(round(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)) / 3600 * p.hourly_rate_pence))
  from job_time t join people p on p.id = t.person_id where t.job_id = j.id), 0)`;
export const HOURS_SQL = `coalesce((select sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)) / 3600) from job_time t where t.job_id = j.id), 0)`;

/**
 * A presented job as one viewer may see it. Hourly rates and the profit
 * are pay and margin, which stay with whoever manages the business, as on
 * the Due list and Insights. The "on my way" words carry the viewer's name.
 */
export function forViewer(job, scope, onMyWay) {
  const manage = scope.isAdmin || (scope.levels || {})[job.site] === 'manage';
  const out = { ...job, onMyWay: onMyWay ? onMyWay(job, scope.name) : null, canSeeProfit: manage };
  if (!manage) {
    delete out.profit;
    out.time = { ...job.time, entries: job.time.entries.map(({ ratePence, ...e }) => e) };
  }
  return out;
}
