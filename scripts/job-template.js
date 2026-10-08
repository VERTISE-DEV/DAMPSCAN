/**
 * The frame of a finished job's page (/our-work/<slug>), built with the rest
 * of the site and filled per request by api/gallery.js from the database, the
 * same way as the gallery page. Everything that differs between jobs is a
 * token here: the title, description and canonical in the head, and the whole
 * left hand column. The nav, footer, booking form and asset versions are the
 * site's own, so a job page cannot drift from the area pages around it.
 */
import { SITES, bookScripts, verifiedBadge, shell } from './area-template.js';
import { orCall } from './page-shell.js';
import { bookForm } from './book-form.js';

export const TOKENS = { title: '@@JOB_TITLE@@', description: '@@JOB_DESCRIPTION@@', url: '@@JOB_URL@@', body: '@@JOB_BODY@@' };

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function render(siteKey) {
  const site = SITES[siteKey];
  const aside = `
    <div class="booking">
      <h2>${esc(site.enquiryCta ? site.enquiryCta.heading : 'Get a free quote')}</h2>
      <p>${esc(site.enquiryCta ? site.enquiryCta.body : '')}${orCall(site)}</p>
      ${bookForm(site.key)}
      ${verifiedBadge(site)}
    </div>`;
  return shell({
    site, url: TOKENS.url, title: TOKENS.title, metaDescription: TOKENS.description, schemas: [],
    ownFaq: false, body: TOKENS.body, aside, scripts: bookScripts(site), styles: ['/assets/gallery.css'], month: 0
  });
}
