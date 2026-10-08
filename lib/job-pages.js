/**
 * A finished job's own page ("Re-roof in Orpington, BR6"), its Google post,
 * and the rules for when it may go up.
 *
 * Pure functions, so the staff route, the public page and the tests all
 * apply the same rules. Only what staff typed for the page is ever shown:
 * a title, a town, the postcode district worked out from the job, and the
 * write-up. Never the customer's name, street or full postcode; the write-up
 * is refused if it contains either, because it is the one free text field.
 *
 * A page goes up only with at least one public photo and a write-up of
 * MIN_WORDS, because a photo and a sentence is a thin page, and thin pages
 * pull a whole site down in search.
 */
import { imageUrl } from './gallery.js';

export const MIN_WORDS = 60;
export const MAX_WORDS = 800;
/* Google Business Profile posts stop at 1500 characters. */
export const POST_LIMIT = 1500;
export const LIVE_STATUSES = ['completed', 'paid'];

const STAGE = { before: 'Before', during: 'During', after: 'After' };
const ORDER = { before: 0, during: 1, after: 2 };

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The district a postcode is in: "BR6 0AA" is BR6. */
export const districtOf = (postcode) => {
  const pc = String(postcode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return pc.length >= 5 ? pc.slice(0, -3) : null;
};

/** The postcode area of a district: BR6 is BR, EC1A is EC. */
export const areaOf = (district) => (String(district || '').toUpperCase().match(/^[A-Z]+/) || [null])[0];

export const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

const slugPart = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** re-roof-in-orpington-br6-42: readable, and the id keeps it unique. */
export function slugFor({ id, title, town, district }) {
  return [slugPart(title).slice(0, 50), 'in', slugPart(town).slice(0, 40), slugPart(district), String(Number(id))].filter(Boolean).join('-').replace(/-+/g, '-');
}

/** The heading everywhere the page is named. */
export const headline = (job) => `${job.page_title} in ${job.page_town}${job.page_district ? `, ${job.page_district}` : ''}`;

/**
 * What stops this job's page going up, as { field: message }; empty when it
 * can. `photos` is the number of its photos marked public.
 */
export function pageProblems({ title, town, writeup, photos, status, customerName, postcode }) {
  const errors = {};
  if (!title) errors.title = 'Give it a short title, such as "Re-roof" or "New flat roof".';
  if (!town) errors.town = 'Give the town, such as "Orpington".';
  else if (/\d/.test(town)) errors.town = 'Just the town, not a street or postcode.';
  const words = wordCount(writeup);
  if (words < MIN_WORDS) errors.writeup = `Write at least ${MIN_WORDS} words about the job (${words} so far): what was wrong, what you did, and how it turned out.`;
  if (words > MAX_WORDS) errors.writeup = `Keep it under ${MAX_WORDS} words.`;
  const text = String(writeup || '').toLowerCase();
  const names = String(customerName || '').toLowerCase().split(/[^a-z']+/).filter((w) => w.length >= 3 && !['mrs', 'miss', 'the', 'and'].includes(w));
  if (names.some((n) => new RegExp(`\\b${n}\\b`).test(text))) errors.writeup = 'Leave the customer\'s name out of the write-up.';
  const pc = String(postcode || '').toUpperCase().replace(/\s+/g, '');
  if (/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(writeup || '') || (pc.length >= 5 && String(writeup || '').toUpperCase().replace(/\s+/g, '').includes(pc))) {
    errors.writeup = 'Leave the full postcode out; the page shows only the town and district.';
  }
  if (/\b\d+[a-z]?\s+[a-z]+\s+(road|street|avenue|lane|close|drive|way|gardens|crescent|grove|place|rise|hill)\b/i.test(writeup || '')) {
    errors.writeup = 'Leave the street address out; the page shows only the town and district.';
  }
  if (!photos) errors.photos = 'Tick at least one photo for the website first.';
  if (!LIVE_STATUSES.includes(status)) errors.status = 'Only finished jobs can have a page.';
  return errors;
}

/** Whether a stored job may be shown, checked again at serve time. */
export const isLive = (job, photos) => Boolean(job && job.page_publish && job.page_slug && LIVE_STATUSES.includes(job.status)
  && photos > 0 && wordCount(job.page_writeup) >= MIN_WORDS);

const month = (d) => new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' });
const paras = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const sorted = (photos) => [...photos].sort((a, b) => ORDER[a.stage] - ORDER[b.stage] || Number(a.id) - Number(b.id));

export function pageUrl(origin, job) { return `${origin}/our-work/${job.page_slug}`; }

export function description(job) {
  const text = String(job.page_writeup || '').replace(/\s+/g, ' ').trim();
  const lead = `${headline(job)}: `;
  const room = 155 - lead.length;
  return lead + (text.length > room ? text.slice(0, text.lastIndexOf(' ', room)).replace(/[,.;:]$/, '') + '...' : text);
}

/** The left hand column of the page. `region` is { name, href } or null. */
export function jobBody(job, photos, region, galleryPath) {
  const h = headline(job);
  return `
  <p class="crumb"><a href="/">Home</a> / <a href="${galleryPath}">Our work</a> / ${esc(h)}</p>

  <div class="hero">
    <h1>${esc(h)}</h1>
    <p class="lede">Finished ${esc(month(job.page_published_at || Date.now()))}. Photographs from the job, and what we did.</p>
  </div>

  <section class="sec gallery" aria-label="Photographs of this job">
    <div class="gallery-grid">
      ${sorted(photos).map((p) => `<figure>
        <a href="${esc(imageUrl(p.id, 'full'))}"><img src="${esc(imageUrl(p.id, p.path_thumb ? 'thumb' : 'full'))}" alt="${esc(`${STAGE[p.stage]}: ${p.public_caption}, ${job.page_town}`)}" loading="lazy" decoding="async"${p.width && p.height ? ` width="${Number(p.width)}" height="${Number(p.height)}"` : ''} /></a>
        <figcaption><span class="stage stage--${p.stage}">${STAGE[p.stage]}</span> ${esc(p.public_caption)}</figcaption>
      </figure>`).join('\n      ')}
    </div>
  </section>

  <section class="sec">
    <h2>About this job</h2>
    ${paras(job.page_writeup).map((p) => `<p>${esc(p)}</p>`).join('\n    ')}
  </section>

  <section class="sec">
    <h2>More of our work</h2>
    <ul class="chips">
      ${region ? `<li><a href="${esc(region.href)}">${esc(`Our work in ${region.name}`)}</a></li>\n      ` : ''}<li><a href="${galleryPath}">Every recent job</a></li>
      <li><a href="/services">Our services</a></li>
    </ul>
  </section>`;
}

export function jobSchemas(job, photos, brand, url, galleryPath) {
  const crumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: brand.name, item: `${brand.origin}/` },
      { '@type': 'ListItem', position: 2, name: 'Our work', item: `${brand.origin}${galleryPath}` },
      { '@type': 'ListItem', position: 3, name: headline(job), item: url }
    ]
  };
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: headline(job),
    description: description(job),
    mainEntityOfPage: url,
    datePublished: new Date(job.page_published_at || Date.now()).toISOString().slice(0, 10),
    author: { '@type': 'Organization', name: brand.name, url: `${brand.origin}/` },
    publisher: { '@type': 'Organization', name: brand.name, url: `${brand.origin}/` },
    contentLocation: { '@type': 'Place', name: `${job.page_town}${job.page_district ? `, ${job.page_district}` : ''}` },
    image: sorted(photos).map((p) => `${brand.origin}${imageUrl(p.id, 'full')}`)
  };
  return [crumb, article].map((s) => JSON.stringify(s).replace(/</g, '\\u003c'));
}

/**
 * Ready-written text for a Google Business Profile post: what was done and
 * where, the start of the write-up, the page link and a call to action, under
 * POST_LIMIT characters however long the write-up is.
 */
export function googlePost(job, brand) {
  const url = pageUrl(brand.origin, job);
  const head = `${headline(job)}\n\n`;
  const tail = `\n\nSee the photos and the full story: ${url}\n\nNeed something similar? Ask ${brand.name} for a free quote, fixed in writing${brand.phoneLabel ? `. Call ${brand.phoneLabel} or visit` : ':'} ${brand.origin}/`;
  const text = String(job.page_writeup || '').replace(/\s*\n\s*\n\s*/g, '\n\n').trim();
  const room = Math.min(POST_LIMIT - head.length - tail.length - 3, 700);
  const body = text.length <= room ? text : text.slice(0, text.lastIndexOf(' ', room)).replace(/[,.;:]$/, '') + '...';
  return head + body + tail;
}

/** The region page a district belongs to, from the generated list. */
export function regionFor(regions, district) {
  const area = areaOf(district);
  return (regions || []).find((r) => r.postcodes.includes(area)) || null;
}

/* The same test as isLive, in SQL over jobs aliased j, for the listings. */
export const LIVE_SQL = `(j.page_publish and j.page_slug is not null and j.status in ('completed','paid')
  and coalesce(array_length(regexp_split_to_array(trim(coalesce(j.page_writeup, '')), '\\s+'), 1), 0) >= ${MIN_WORDS})`;
