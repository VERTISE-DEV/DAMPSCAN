/**
 * The website features that wait on the owners: a price range, a WhatsApp
 * number, reviews on service pages. Each shows nothing until its data is
 * there, and shows correctly once it is, without touching the damp brands.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITES } from '../scripts/area-template.js';
import { render } from '../scripts/service-template.js';
import { whatsappButton } from '../scripts/page-shell.js';
import { services } from '../content/services/index.js';
import { priceGuide } from '../content/price-guide.js';
import { bookForm } from '../scripts/book-form.js';

const reRoofs = services.find((s) => s.site === 'roofing' && s.slug === 're-roofs');

test('no price range is shown until the owners give one, and then it says what typical means', () => {
  assert.doesNotMatch(render(reRoofs, services), /What it usually costs/);
  priceGuide.roofing['re-roofs'] = { from: 9000, to: 14000, typical: 'a three-bedroom semi' };
  try {
    const html = render(reRoofs, services);
    assert.match(html, /<h2>What it usually costs<\/h2>/);
    assert.match(html, /£9,000 to £14,000 <span>including VAT<\/span>/);
    assert.match(html, /a three-bedroom semi/);
  } finally {
    delete priceGuide.roofing['re-roofs'];
  }
});

test('the WhatsApp button appears only for a brand with a number, and opens a chat with the brand named', () => {
  assert.equal(whatsappButton(SITES.roofing), '');
  const html = whatsappButton({ ...SITES.roofing, whatsapp: '447700900123' });
  assert.match(html, /href="https:\/\/wa\.me\/447700900123\?text=Hello%20Verge%20Roofing%2C/);
  assert.match(html, /aria-label="Message Verge Roofing on WhatsApp"/);
});

test('Verge has no reviews yet, so its service pages show none rather than an empty section', () => {
  assert.doesNotMatch(render(reRoofs, services), /What customers say/);
});

test('the quoted trades open the photo section of the form; the damp forms do not change', () => {
  assert.match(bookForm('roofing'), /<details class="fold" open>\s*<summary>Add photos of the roof/);
  assert.doesNotMatch(bookForm('dampscan'), /class="fold" open/);
});

test('each brand preloads the font it actually uses', () => {
  assert.match(render(reRoofs, services), /rel="preload" as="font" type="font\/woff2" href="\/assets\/fonts\/archivo-latin\.woff2"/);
  const damp = services.find((s) => s.site === 'dampscan');
  assert.match(render(damp, services), /href="\/assets\/fonts\/plus-jakarta-sans-var\.woff2"/);
});
