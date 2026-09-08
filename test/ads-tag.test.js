/**
 * The Google Ads tag goes on the site it belongs to and nowhere else.
 *
 * One Vercel project serves both domains from one public directory, so a tag
 * written into the shared shell without a site check lands on both. That is not
 * a cosmetic mistake: it reports DampScan's traffic as ATi conversions, which
 * corrupts the bidding on a live ad account and is close to invisible until the
 * numbers stop making sense.
 *
 * These check the built output rather than the template, because the output is
 * what Vercel serves and what a stale build would betray.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { adsTag, taggedSites } from '../scripts/ads-tag.js';

const ROOT = new URL('..', import.meta.url).pathname;
const ATI_ID = 'AW-18231740318';

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await htmlFiles(path));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

/* Which site a built page belongs to. The generated pages say so on <html>,
   and the two home pages carry the same attribute. */
function siteOf(html) {
  const m = /<html[^>]*data-site="([^"]+)"/.exec(html);
  return m ? m[1] : null;
}

test('a site with no tag configured gets no markup at all', () => {
  assert.equal(adsTag('dampscan'), '');
  assert.equal(adsTag('nonsense'), '');
  assert.match(adsTag('ati'), /AW-18231740318/);
  assert.deepEqual(taggedSites, ['ati']);
});

test('every ATi page carries the tag and no DampScan page does', async () => {
  const pages = (await htmlFiles(join(ROOT, 'public'))).filter((p) => !p.includes('/staff/'));
  const counts = { ati: 0, dampscan: 0 };

  for (const path of pages) {
    const html = await readFile(path, 'utf8');
    const site = siteOf(html);
    if (!site) continue;
    const tagged = html.includes(ATI_ID);

    if (site === 'ati') {
      assert.ok(tagged, `${path} is an ATi page with no Google Ads tag`);
      counts.ati++;
    } else {
      assert.ok(!tagged, `${path} is a ${site} page carrying ATi's Google Ads tag`);
      counts.dampscan++;
    }
  }

  assert.ok(counts.ati > 40, `expected the tag across ATi's pages, found ${counts.ati}`);
  assert.ok(counts.dampscan > 10, `expected DampScan pages to check against, found ${counts.dampscan}`);
});

test('the staff dashboard is never tagged', async () => {
  for (const path of await htmlFiles(join(ROOT, 'public', 'staff'))) {
    const html = await readFile(path, 'utf8');
    assert.ok(!html.includes(ATI_ID), `${path} carries the Google Ads tag`);
    assert.ok(!html.includes('googletagmanager'), `${path} loads gtag`);
  }
});

/* The notice is the site's own statement about what it does. A tag that
   contradicts it is the sort of thing nobody notices until somebody complains,
   so the contradiction is a test failure rather than a matter of memory. */
test('a tagged site does not claim it serves no advertising cookies', async () => {
  for (const file of ['public/index.html', 'public/london.html']) {
    const html = await readFile(join(ROOT, file), 'utf8');
    const site = siteOf(html);
    const claimsNone = /don't use advertising/.test(html);
    if (html.includes(ATI_ID)) {
      assert.ok(!claimsNone, `${file} loads an ads tag and still says it uses no advertising cookies`);
    } else if (site === 'dampscan') {
      assert.ok(claimsNone, `${file} carries no ads tag, so it should still say so`);
    }
  }
});
