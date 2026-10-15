/**
 * Writes DampScan's Kent town survey pages into public/areas/dampscan/, next
 * to the district pages, so middleware.js serves both at /damp-survey/<slug>
 * with no new route. Runs after the area pages are written, because that pass
 * clears the directory first.
 *
 * A town whose slug matches a district (Maidstone, Dover...) replaces that
 * district page: the district file is removed from content/areas/ when its
 * town is written, and the build refuses to run with both, since two sources
 * for one URL is how a page silently stops updating.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { towns } from '../content/kent-towns.js';
import { areas } from '../content/areas/index.js';
import { render } from './town-template.js';
import { townWordCount } from './town-template.js';
import { proofingWordCount } from './proofing-template.js';

const MIN_TOWN_WORDS = 750;
const MIN_PROOFING_WORDS = 450;

/** Problems that stop the build, as text, empty when every town is ready. */
export function checkTowns() {
  const problems = [];
  const seen = new Set();
  for (const t of towns) {
    const id = `town ${t.slug || '(no slug)'}`;
    if (!/^[a-z0-9-]+$/.test(t.slug || '')) problems.push(`${id}: bad slug`);
    if (seen.has(t.slug)) problems.push(`${id}: duplicate slug`);
    seen.add(t.slug);
    if (areas.some((a) => a.site === 'dampscan' && a.slug === t.slug)) {
      problems.push(`${id}: content/areas/${t.slug}.js still exists; the town page replaces it`);
    }
    const s = t.survey || {};
    if (!(s.stock || []).length || !(s.causes || []).length || !(s.areas || []).length || (s.faq || []).length < 6) {
      problems.push(`${id}: survey copy incomplete (stock, causes, areas, six FAQs)`);
      continue;
    }
    if (!t.proofing || (t.proofing.faq || []).length < 6 || !(t.proofing.right || []).length) {
      problems.push(`${id}: proofing copy incomplete (right, six FAQs)`);
      continue;
    }
    if (townWordCount(t) < MIN_TOWN_WORDS) problems.push(`${id}: only ${townWordCount(t)} local words on the survey page, needs ${MIN_TOWN_WORDS}`);
    if (proofingWordCount(t) < MIN_PROOFING_WORDS) problems.push(`${id}: only ${proofingWordCount(t)} local words on the proofing page, needs ${MIN_PROOFING_WORDS}`);
    for (const n of t.nearby || []) if (!towns.some((o) => o.slug === n)) problems.push(`${id}: nearby ${n} is not a town`);
  }
  return problems;
}

export async function writeTownPages(root) {
  const dir = join(root, 'public', 'areas', 'dampscan');
  await mkdir(dir, { recursive: true });
  for (const t of towns) await writeFile(join(dir, `${t.slug}.html`), render(t, towns), 'utf8');
  return towns.length;
}
