/**
 * The in-season feature: one menu item and one line on the home page.
 *
 * Chosen twice. The build picks for the month it runs in, so a crawler and a
 * visitor without JavaScript see something sensible; /assets/season.js picks
 * again in the browser from the same list, which is carried in the markup, so
 * the feature changes with the month without a rebuild.
 *
 * Everything that depends on the month sits on one line carrying
 * data-season-pick. That is what lets build:check accept a rebuild in a new
 * month: those lines may move, nothing else may.
 */
import { seasons } from '../content/seasons.js';

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The month now in the UK, 1 to 12. */
export function buildMonth(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Europe/London' }).format(now));
}

/** The entry featured in `month`, or null. Month 0 means "let the browser pick". */
export function pick(siteKey, month) {
  return (seasons[siteKey] || []).find((s) => s.m.includes(month)) || null;
}

const data = (siteKey) => esc(JSON.stringify(seasons[siteKey] || []));

/** The menu item, or nothing for a brand with no seasonal features. */
export function seasonNavItem(siteKey, month) {
  if (!(seasons[siteKey] || []).length) return '';
  const s = pick(siteKey, month);
  return `          <li class="season-nav" data-season-pick="${data(siteKey)}"${s ? '' : ' hidden'}><a href="${esc(s ? s.href : '/')}">${esc(s ? s.label : '')}</a></li>\n`;
}

/** The home page line, or nothing for a brand with no seasonal features. */
export function seasonFeature(siteKey, month, style = '') {
  if (!(seasons[siteKey] || []).length) return '';
  const s = pick(siteKey, month);
  return `<p class="season-feature" data-season-pick="${data(siteKey)}"${style ? ` style="${style}"` : ''}${s ? '' : ' hidden'}><a href="${esc(s ? s.href : '/')}"><strong data-season-label>${esc(s ? s.label : '')}</strong></a> <span data-season-text>${esc(s ? s.text : '')}</span></p>`;
}

/* The two hand written home pages (index.html, london.html) carry the same
   feature between markers, filled here so the generated pages and the hand
   written ones cannot disagree about what is in season. */
const BLOCKS = [
  ['<!-- season-nav:start, filled by scripts/build-pages.js -->', '<!-- season-nav:end -->', (site, m) => seasonNavItem(site, m), '          '],
  ['<!-- season-feature:start, filled by scripts/build-pages.js -->', '<!-- season-feature:end -->', (site, m) => seasonFeature(site, m, 'margin-top:4px;font-size:15px') + '\n', '      ']
];

export async function writeSeasonBlocks(root, homes) {
  const { readFile, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const month = buildMonth();
  for (const [site, file] of Object.entries(homes)) {
    const path = join(root, file);
    let html = await readFile(path, 'utf8');
    for (const [start, end, make, indent] of BLOCKS) {
      const from = html.indexOf(start);
      const to = html.indexOf(end);
      if (from === -1 || to === -1) throw new Error(`${file}: season markers missing`);
      const inner = indent + make(site, month).trimStart();
      html = html.slice(0, from) + start + '\n' + inner + indent + html.slice(to);
    }
    await writeFile(path, html, 'utf8');
  }
}
