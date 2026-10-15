/**
 * Search result titles and descriptions for the area pages.
 *
 * Search Console showed the area pages being seen hundreds of times and
 * clicked almost never. The old titles named the service and the place and
 * stopped, which is what every other result on the page says too. These lead
 * with the query people type ("damp survey in <town>"), then give a reason to
 * pick this result, then the brand, and fall back to shorter forms when a long
 * place name would push the title past what Google shows (about 60 characters).
 *
 * Every claim here is one the site already makes in its own copy: DampScan's
 * qualified surveyor, no sales reps and 24 hour report; ATi's independence and
 * no remedial work. DampScan is not called independent, because it also
 * quotes for the work. No prices: the owners asked for none in results.
 */
import { reviews } from '../content/reviews/index.js';
import { MIN_REVIEWS } from '../lib/google-reviews.js';

export const TITLE_MAX = 60;
export const DESC_MAX = 155;

/* "Tonbridge and Malling" reads fine in a heading but costs characters a title
   does not have. */
const short = (name) => String(name).replace(/ and /g, ' & ');

/**
 * True only when every review we hold is five stars and there are enough of
 * them for the home page to show. The count is not quoted, because the live
 * Google total moves and a stale number in a snippet is a claim we cannot keep.
 */
export function fiveStar(site) {
  const list = reviews[site] || [];
  return list.length >= MIN_REVIEWS && list.every((r) => Number(r.rating) === 5);
}

const TITLES = {
  dampscan: (n) => [
    `Damp Survey & Damp Proofing in ${n} | DampScan`,
    `Damp Survey in ${n} | Report in 24 Hours | DampScan`,
    `Damp Survey in ${n} | DampScan`
  ],
  ati: (n) => [
    `Damp Survey in ${n} | Independent, 24h Report | ATi Damp Survey`,
    `Independent Damp Survey in ${n} | ATi Damp Survey`,
    `Damp Survey in ${n} | ATi Damp Survey`
  ]
};

/* First candidate that fits wins. The first DampScan form carries "damp
   proofing" because that is what Kent towns are actually searched with
   (damp proofing sevenoaks, guildford, sittingbourne), and DampScan does carry
   out that work after the survey. ATi does not, so its titles never say it. */
export function areaTitle(area) {
  const make = TITLES[area.site];
  if (!make) return area.title;
  const list = make(short(area.name));
  return list.find((t) => t.length <= TITLE_MAX) || list[list.length - 1];
}

const LEADS = {
  dampscan: (n) => `Damp and mould survey in ${n} by a qualified surveyor. Cause found before any quote, no sales reps, report in 24h.`,
  ati: (n) => `Independent damp and mould survey in ${n}. We sell no treatment, so no hard sell. Written report in 24h.`
};

/**
 * Lead sentence, then the review line, then nearby places, each only if it
 * still fits. The places are what make thirty descriptions genuinely thirty
 * different descriptions rather than one with a name swapped in.
 */
export function areaDescription(area) {
  const lead = LEADS[area.site];
  if (!lead) return area.metaDescription;
  let out = lead(area.name);
  const add = (s) => { if ((out + ' ' + s).length <= DESC_MAX) out += ' ' + s; };
  if (fiveStar(area.site)) add('5-star Google reviews.');
  const places = (area.places || []).filter((p) => p !== area.name);
  for (let k = Math.min(3, places.length); k >= 1; k--) {
    const list = places.slice(0, k);
    const s = `Covering ${list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0]}.`;
    if ((out + ' ' + s).length <= DESC_MAX) { out += ' ' + s; break; }
  }
  return out;
}
