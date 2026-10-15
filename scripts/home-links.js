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

export const START = '<!-- area-links:start, filled by scripts/build-pages.js -->';
export const END = '<!-- area-links:end -->';

/** Area links for one site: the busiest first, then everything else. */
export function orderedAreas(site) {
  const top = topAreas(site, areas);
  const rest = areas.filter((a) => a.site === site && !top.includes(a));
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
      <h3 style="margin-top:22px">Guides by problem</h3>
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
    await writeFile(path, html.slice(0, from) + linkBlock(site) + html.slice(to + END.length), 'utf8');
  }
}
