/**
 * The link block on the two hand written home pages.
 *
 * The home pages carry the links into the area pages. A page nothing links to
 * is a page Google treats as unimportant, so this is not decoration: it is the
 * difference between the area pages being crawled and being ignored. Written
 * between markers so adding an area updates both sites automatically.
 *
 * The areas Search Console already shows most often lead the list (see
 * content/area-groups.js), then the rest alphabetically. Moved out of
 * build-pages.js, which had reached the size limit.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { areas } from '../content/areas/index.js';
import { services } from '../content/services/index.js';
import { guides } from '../content/guides/index.js';
import { topAreas } from '../content/area-groups.js';
import { towns } from '../content/kent-towns.js';
import { proofingPages } from './proofing-pages.js';
import { footerAreas, FOOT_START, FOOT_END, FOOT_CSS } from './footer-areas.js';

export const START = '<!-- area-links:start, filled by scripts/build-pages.js -->';
export const END = '<!-- area-links:end -->';

/** Area links for one site: the busiest first, then everything else. */
export function orderedAreas(site) {
  const top = topAreas(site, areas);
  const rest = [...areas, ...towns].filter((a) => a.site === site && !top.includes(a));
  return [...top, ...rest];
}

export function linkBlock(site) {
  const areaLinks = orderedAreas(site)
    .map((a) => `        <li><a href="/damp-survey/${a.slug}">Damp surveys in ${a.name}</a></li>`)
    .join('\n');
  const serviceLinks = services
    .filter((s) => s.site === site)
    .map((s) => `        <li><a href="/services/${s.slug}">${s.name}</a></li>`)
    .join('\n');
  /* The "damp proofing <place>" pages for the busiest places, so the home
     page passes them weight too. The rest are linked from their survey page. */
  const proofLinks = topAreas(site, areas)
    .filter((a) => proofingPages.some((p) => p.site === site && p.slug === a.slug))
    .map((a) => `        <li><a href="/damp-proofing/${a.slug}">Damp proofing in ${a.name}? Survey first</a></li>`)
    .join('\n');
  const guideLinks = guides
    .filter((g) => g.site === site)
    .map((g) => `        <li><a href="/guides/${g.slug}">${g.name}</a></li>`)
    .join('\n');

  return `${START}
    <div class="area-links">
      <h3>Area guides</h3>
      <ul>
${areaLinks}
        <li><a href="/damp-survey">Every area we cover, by district</a></li>
      </ul>
${proofLinks ? `      <h3 style="margin-top:22px">Quoted for damp proofing?</h3>
      <ul>
${proofLinks}
      </ul>
` : ''}      <h3 style="margin-top:22px">Guides by problem</h3>
      <ul>
${serviceLinks}
      </ul>
      <h3 style="margin-top:22px">Before you pay for treatment</h3>
      <ul>
${guideLinks}
      </ul>
    </div>
    ${END}`;
}

export async function writeHomeLinks(root, homes) {
  for (const [site, file] of Object.entries(homes)) {
    const path = join(root, file);
    const html = await readFile(path, 'utf8');
    const from = html.indexOf(START);
    const to = html.indexOf(END);
    if (from === -1 || to === -1) throw new Error(`${file}: area link markers missing`);
    let out = html.slice(0, from) + linkBlock(site) + html.slice(to + END.length);
    /* The grouped list of every area page, in the footer. */
    const f = out.indexOf(FOOT_START);
    const t = out.indexOf(FOOT_END);
    if (f === -1 || t === -1) throw new Error(`${file}: footer area markers missing`);
    out = out.slice(0, f) + `${FOOT_START}\n    ${FOOT_CSS}\n    ${footerAreas(site)}\n    ` + out.slice(t);
    await writeFile(path, out, 'utf8');
  }
}
