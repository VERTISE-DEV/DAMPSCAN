/**
 * The grouped list of every area page, in the footer of every page on the two
 * damp sites, generated and hand written alike.
 *
 * A town page linked only from its hub is two clicks from anywhere. Listing
 * every town and borough in the footer puts each one a click from every page,
 * which is the cheapest internal linking there is, and it is also where a
 * reader looks for "do you cover my town". Grouped the same way as the areas
 * hub (content/area-groups.js), so the two never disagree.
 */
import { areas } from '../content/areas/index.js';
import { towns } from '../content/kent-towns.js';
import { areaGroups } from '../content/area-groups.js';

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const FOOT_START = '<!-- foot-areas:start, filled by scripts/build-pages.js -->';
export const FOOT_END = '<!-- foot-areas:end -->';

/** The footer area list for a site, or '' for a brand without one. */
export function footerAreas(site) {
  const g = areaGroups[site];
  if (!g) return '';
  const pool = [...areas, ...towns].filter((a) => a.site === site);
  const cols = g.groups.map((group) => {
    const members = group.slugs.map((s) => pool.find((a) => a.slug === s)).filter(Boolean);
    if (!members.length) return '';
    return `    <div><p class="foot-areas-h">${esc(group.name)}</p><ul>${members.map((a) => `<li><a href="/damp-survey/${a.slug}">${esc(a.name)}</a></li>`).join('')}</ul></div>`;
  }).filter(Boolean);
  return `<nav class="foot-areas" aria-label="Areas we cover">
${cols.join('\n')}
  </nav>`;
}

/** Inline styles for the hand written home pages, whose stylesheet is their
    own. The generated pages get the same rules from /assets/area.css. */
export const FOOT_CSS = '<style>.foot-areas{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:18px 26px;padding:26px 0;border-top:1px solid rgba(127,127,127,.25);font-size:13px}.foot-areas ul{list-style:none;margin:0;padding:0}.foot-areas li{margin:3px 0}.foot-areas-h{font-weight:600;margin:0 0 6px}</style>';
