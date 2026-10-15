/**
 * Search result titles and descriptions.
 *
 * Search Console showed the pages being seen and not clicked, so the snippet
 * is the thing being optimised, and it has rules the owners set: fits what
 * Google shows, unique per page, no prices, and no claim the site does not
 * already make. This checks every page the build writes against them, from
 * the committed HTML, so a content edit that breaks one fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { areas } from '../content/areas/index.js';
import { areaGroups, topAreas } from '../content/area-groups.js';
import { areaTitle, areaDescription, fiveStar, townTitle, proofingTitle } from '../scripts/seo-meta.js';
import { towns } from '../content/kent-towns.js';
import { proofingPages } from '../scripts/proofing-pages.js';

const PUBLIC = new URL('../public/', import.meta.url).pathname;
const un = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

async function pages(dir = PUBLIC) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'staff') out.push(...await pages(p)); continue; }
    if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const indexable = [];
for (const p of await pages()) {
  const html = await readFile(p, 'utf8');
  if (/noindex/.test(html)) continue;
  indexable.push({
    path: p.slice(PUBLIC.length),
    title: un((html.match(/<title>([^<]*)<\/title>/) || [])[1] || ''),
    desc: un((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '')
  });
}

test('every indexable title fits in a search result', () => {
  for (const p of indexable) assert.ok(p.title.length > 0 && p.title.length <= 60, `${p.path}: ${p.title.length} "${p.title}"`);
});

test('every indexable description is a usable length', () => {
  for (const p of indexable) assert.ok(p.desc.length >= 100 && p.desc.length <= 160, `${p.path}: ${p.desc.length}`);
});

test('titles and descriptions are unique', () => {
  const t = new Map(); const d = new Map();
  for (const p of indexable) {
    assert.ok(!t.has(p.title), `${p.path} shares its title with ${t.get(p.title)}`);
    assert.ok(!d.has(p.desc), `${p.path} shares its description with ${d.get(p.desc)}`);
    t.set(p.title, p.path); d.set(p.desc, p.path);
  }
});

test('no prices in titles or descriptions', () => {
  for (const p of indexable) assert.ok(!/£/.test(p.title + p.desc), `${p.path} shows a price`);
});

test('area titles lead with the query and end with the brand', () => {
  for (const a of areas.filter((x) => x.site === 'dampscan' || x.site === 'ati')) {
    const t = areaTitle(a);
    assert.match(t, /Damp Survey/);
    assert.ok(t.endsWith(a.site === 'ati' ? '| ATi Damp Survey' : '| DampScan'), t);
  }
});

test('each brand only claims what it is', () => {
  for (const a of areas) {
    const text = areaTitle(a) + ' ' + areaDescription(a);
    /* Neither brand carries out remedial work, so a survey page's snippet
       never offers damp proofing; the /damp-proofing pages answer that search
       with "survey first". */
    assert.doesNotMatch(text, /damp proofing/i, a.slug);
  }
});

test('the star line appears only when every held review is five stars', () => {
  for (const a of areas.filter((x) => x.site !== 'roofing')) {
    assert.equal(areaDescription(a).includes('5-star'), fiveStar(a.site), a.slug);
  }
});

test('every damp area sits in exactly one hub group, and every top area exists', () => {
  for (const [site, g] of Object.entries(areaGroups)) {
    const slugs = g.groups.flatMap((x) => x.slugs);
    assert.equal(new Set(slugs).size, slugs.length, `${site}: an area is in two groups`);
    for (const a of [...areas, ...towns].filter((x) => x.site === site)) assert.ok(slugs.includes(a.slug), `${site}/${a.slug} is in no group`);
    assert.equal(topAreas(site, areas).length, g.top.length, `${site}: a top area has no page`);
  }
});

test('town titles lead with the query and the town, and end with the brand', () => {
  for (const t of towns) {
    const title = townTitle(t);
    assert.ok(title.startsWith(`Damp Survey in ${t.name.replace(/ and /g, ' & ')}`), title);
    assert.ok(title.endsWith('| DampScan'), title);
  }
});

test('damp proofing titles always say survey first, never offer the work', () => {
  for (const p of proofingPages) {
    const title = proofingTitle(p);
    assert.match(title, /^Damp Proofing/, title);
    assert.match(title, /Survey First/, title);
    assert.ok(title.length <= 60, `${title} is ${title.length}`);
  }
});
