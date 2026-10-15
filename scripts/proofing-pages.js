/**
 * The list of "damp proofing in <place>" pages, normalised for
 * scripts/proofing-template.js, and the writer that builds them.
 *
 * DampScan: one per Kent town, from content/kent-towns/. ATi: one per London
 * borough that has proofing copy in content/london-proofing/, chosen from the
 * boroughs with the most Search Console impressions.
 *
 * Served at /damp-proofing/<slug> by middleware.js, from
 * public/proofing-pages/<site>/<slug>.html.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { towns } from '../content/kent-towns.js';
import { areas } from '../content/areas/index.js';
import { londonProofing } from '../content/london-proofing/index.js';
import { render } from './proofing-template.js';

function fromTown(t) {
  const nearby = (t.nearby || []).map((s) => towns.find((o) => o.slug === s)).filter(Boolean);
  return {
    site: 'dampscan', slug: t.slug, name: t.name, material: t.material, places: t.places,
    proofing: t.proofing, ground: t.survey.ground, areas: t.survey.areas, buyers: t.survey.buyers, nearby
  };
}

function fromBorough(p) {
  const area = areas.find((a) => a.site === 'ati' && a.slug === p.slug);
  if (!area) throw new Error(`london-proofing/${p.slug}: no ATi area page with that slug`);
  const nearby = (area.nearby || []).filter((s) => londonProofing.some((o) => o.slug === s))
    .map((s) => ({ slug: s, name: areas.find((a) => a.site === 'ati' && a.slug === s).name }));
  return {
    site: 'ati', slug: p.slug, name: area.name, material: p.material || 'London stock brick', places: area.places,
    proofing: p, ground: null, areas: p.areas || [], nearby
  };
}

export const proofingPages = [...towns.map(fromTown), ...londonProofing.map(fromBorough)];

/** Index within its own site, which drives the variant choice. */
export function siteIndex(page) {
  return proofingPages.filter((p) => p.site === page.site).indexOf(page);
}

export const siteCount = (site) => proofingPages.filter((p) => p.site === site).length;

export async function writeProofingPages(root) {
  const out = join(root, 'public', 'proofing-pages');
  await rm(out, { recursive: true, force: true });
  for (const page of proofingPages) {
    await mkdir(join(out, page.site), { recursive: true });
    await writeFile(join(out, page.site, `${page.slug}.html`), render(page, siteIndex(page), siteCount(page.site)), 'utf8');
  }
  return proofingPages.length;
}
