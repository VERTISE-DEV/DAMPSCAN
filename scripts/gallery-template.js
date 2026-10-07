/**
 * The gallery page's frame: header, nav, intro, booking form and footer,
 * built here with everything else and stamped with the asset versions, so the
 * page cannot drift from the rest of the site.
 *
 * The photographs are not known at build time, because staff publish them
 * from the staff area. So the build writes the frame, with a marker where the
 * photos go, into lib/generated/gallery-shells.js, and api/gallery.js fills
 * the marker on each request. One template, one copy of the nav.
 */
import { SITES, bookScripts, verifiedBadge, shell } from './area-template.js';
import { orCall } from './page-shell.js';
import { bookForm } from './book-form.js';
import { galleries } from '../content/gallery.js';

export const ITEMS_MARKER = '<!-- gallery:items -->';

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function render(siteKey) {
  const site = SITES[siteKey];
  const copy = galleries[siteKey];
  const url = `${site.origin}${site.galleryPath}`;
  const crumb = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: site.brand, item: `${site.origin}/` },
      { '@type': 'ListItem', position: 2, name: 'Our work', item: url }
    ]
  });
  const body = `
  <p class="crumb"><a href="/">Home</a> / Our work</p>

  <div class="hero">
    <h1>${esc(copy.h1)}</h1>
    <p class="lede">${esc(copy.intro)}</p>
  </div>

  <section class="sec gallery" aria-label="Photographs of recent jobs">
    ${ITEMS_MARKER}
  </section>`;
  const aside = `
    <div class="booking">
      <h2>${esc(site.enquiryCta ? site.enquiryCta.heading : 'Get a free quote')}</h2>
      <p>${esc(site.enquiryCta ? site.enquiryCta.body : '')}${orCall(site)}</p>
      ${bookForm(site.key)}
      ${verifiedBadge(site)}
    </div>`;
  return shell({
    site, url, title: copy.title, metaDescription: copy.metaDescription, schemas: [crumb],
    ownFaq: false, body, aside, scripts: bookScripts(site), styles: ['/assets/gallery.css']
  });
}
