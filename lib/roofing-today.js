/**
 * Verge Roofing's lines on Today: work about to start with its scaffold or
 * materials not sorted, and finished jobs with a finishing step missed
 * (photos, the website page, the rating request, the Google post, the yearly
 * check). Both read the board's own cards (lib/roofing.js), so Today and the
 * pipeline badge the same jobs for the same reasons.
 */
import { query } from './db.js';
import { TODAY } from './today.js';
import { ROOF_SITES, ROOF_SELECT, cardsFor } from './roofing.js';
import { BADGE_WORDS } from './roofing-plan.js';

/* How far ahead a start date makes a missing scaffold urgent, and how long a
   finished job is given before a missed step is listed. */
export const PREP_DAYS = 10;
export const FINISH_AFTER_DAYS = 2;

export async function roofActions(sites) {
  const mine = sites.filter((s) => ROOF_SITES.includes(s));
  if (!mine.length) return { prep: [], finish: [] };
  const rows = await query(`${ROOF_SELECT}
      where j.site = any($1::text[])
        and ((j.status in ('quoted', 'booked') and j.job_date between ${TODAY} and ${TODAY} + ${PREP_DAYS} and (j.status = 'booked' or j.won_at is not null or j.quote_accepted_at is not null))
          or (j.status in ('completed', 'paid') and j.job_date between ${TODAY} - 60 and ${TODAY} - ${FINISH_AFTER_DAYS}))
      order by j.job_date, j.id limit 120`, [mine]);
  const cards = await cardsFor(rows);
  const prep = [];
  const finish = [];
  for (const c of cards) {
    const base = { id: c.id, site: c.site, status: c.status, date: c.jobDate, time: c.jobTime, customerName: c.name, postcode: c.postcode, quoted: true };
    if (['accepted', 'booked'].includes(c.stage)) {
      const miss = c.badges.filter((b) => b === 'scaffold' || b === 'materials');
      if (miss.length) prep.push({ ...base, what: miss.map((b) => BADGE_WORDS[b]).join(', ') });
    } else if (c.finish) {
      const left = c.finish.filter((f) => !f.done);
      if (left.length) finish.push({ ...base, what: `Still to do: ${left.map((f) => f.label.toLowerCase()).join(', ')}` });
    }
  }
  return { prep, finish };
}
