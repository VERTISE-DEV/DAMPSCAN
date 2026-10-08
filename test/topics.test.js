/**
 * The problem and seasonal pages, and the in-season feature.
 *
 * The pages are built like every other page, so these check what is
 * particular to them: the FAQ schema, the links on to services and areas, no
 * invented prices, and a feature that follows the month both at build time
 * and in the browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pick, seasonNavItem, buildMonth } from '../scripts/season.js';
import { seasons } from '../content/seasons.js';
import { problems } from '../content/problems/index.js';
import { seasonal } from '../content/seasonal/index.js';

const read = (path) => readFile(new URL(`../public/${path}`, import.meta.url), 'utf8');

test('a problem page carries FAQ and breadcrumb schema and links to services and areas', async () => {
  const html = await read('problem-pages/roofing/roof-leaking.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/vergeroofing\.com\/problems\/roof-leaking" \/>/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /href="\/services\/roof-repairs"/);
  assert.match(html, /href="\/roofing-in\/kent-and-south-east-london"/);
  assert.ok(!/£\d/.test(html), 'no price the business has not given');
  const ac = await read('problem-pages/ac/air-con-not-cooling.html');
  assert.ok(!ac.includes('/roofing-in'), 'a brand with no area pages links to none');
});

test('every page is in its brand\'s sitemap, and no damp problem duplicates a service page', async () => {
  for (const [path, list] of [['problems', problems], ['seasonal', seasonal]]) {
    for (const p of list) {
      const file = { dampscan: 'sitemap.xml', ati: 'sitemap-london.xml', roofing: 'sitemap-roofing.xml', ac: 'sitemap-ac.xml' }[p.site];
      assert.match(await read(file), new RegExp(`/${path}/${p.slug}</loc>`));
    }
  }
  assert.equal(problems.filter((p) => p.site === 'dampscan' || p.site === 'ati').length, 0);
});

test('the feature follows the month, and every month a brand features points somewhere real', async () => {
  assert.equal(pick('roofing', 10).href, '/seasonal/winter-roof-checks');
  assert.equal(pick('roofing', 1).href, '/services/storm-damage');
  assert.equal(pick('ac', 6).href, '/seasonal/summer-air-con-installation');
  assert.equal(pick('dampscan', 6), null);
  assert.match(seasonNavItem('dampscan', 6), / hidden>/, 'out of season, the item hides');
  assert.match(seasonNavItem('dampscan', 0), /data-season-pick=/, 'the list is always carried for the browser');
  assert.ok(buildMonth(new Date('2026-07-01T12:00:00Z')) === 7);
  for (const [site, list] of Object.entries(seasons)) {
    for (const s of list) {
      const [, kind, slug] = s.href.split('/');
      const dir = { problems: 'problem-pages', seasonal: 'seasonal-pages', services: 'service-pages' }[kind];
      await read(`${dir}/${site}/${slug}.html`); // throws if the page does not exist
    }
  }
  const script = await read('assets/season.js');
  assert.match(script, /getMonth\(\) \+ 1/);
});
