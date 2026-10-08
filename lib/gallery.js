/**
 * The photographs on a brand's gallery page, as HTML and as schema.
 *
 * Pure functions over published photo rows, so the page and the tests see
 * exactly the same output. Photos are grouped by job, newest job first, and
 * within a job run before, during, after. Everything shown is what staff
 * typed when they published the photo; nothing is read from the job itself,
 * so a customer's name or address cannot reach the page by accident.
 */
const STAGE = { before: 'Before', during: 'During', after: 'After' };
const ORDER = { before: 0, during: 1, after: 2 };

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const month = (d) => new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/London' });
export const imageUrl = (id, size) => `/api/gallery?img=${Number(id)}&size=${size}`;

/** Published photos, grouped into jobs. */
export function groupJobs(rows) {
  const jobs = new Map();
  for (const r of rows) {
    if (!jobs.has(r.job_id)) jobs.set(r.job_id, []);
    jobs.get(r.job_id).push(r);
  }
  return [...jobs.values()]
    .map((photos) => photos.sort((a, b) => ORDER[a.stage] - ORDER[b.stage] || Number(a.id) - Number(b.id)))
    .sort((a, b) => new Date(b[0].published_at) - new Date(a[0].published_at));
}

export function itemsHtml(rows, emptyText) {
  const jobs = groupJobs(rows);
  if (!jobs.length) return `<p class="gallery-empty">${esc(emptyText)}</p>`;
  return jobs.map((photos) => {
    const lead = photos.find((p) => p.stage === 'after') || photos[photos.length - 1];
    const title = lead.public_caption;
    return `<article class="gallery-job">
      <h2>${esc(title)}</h2>
      <p class="gallery-meta">${esc(lead.area_label)} · ${esc(month(lead.published_at))}</p>
      <div class="gallery-grid">
        ${photos.map((p) => `<figure>
          <a href="${esc(imageUrl(p.id, 'full'))}"><img src="${esc(imageUrl(p.id, p.path_thumb ? 'thumb' : 'full'))}" alt="${esc(`${STAGE[p.stage]}: ${p.public_caption}, ${p.area_label}`)}" loading="lazy" decoding="async"${p.width && p.height ? ` width="${Number(p.width)}" height="${Number(p.height)}"` : ''} /></a>
          <figcaption><span class="stage stage--${p.stage}">${STAGE[p.stage]}</span>${p.public_caption === title ? '' : ` ${esc(p.public_caption)}`}</figcaption>
        </figure>`).join('\n        ')}
      </div>
    </article>`;
  }).join('\n    ');
}

export function gallerySchema(rows, origin, brand) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `${brand}: recent work`,
    url: `${origin}/our-work`,
    associatedMedia: rows.slice(0, 60).map((p) => ({
      '@type': 'ImageObject',
      contentUrl: `${origin}${imageUrl(p.id, 'full')}`,
      thumbnailUrl: `${origin}${imageUrl(p.id, 'thumb')}`,
      caption: `${STAGE[p.stage]}: ${p.public_caption}, ${p.area_label}`,
      datePublished: new Date(p.published_at).toISOString().slice(0, 10)
    }))
  }).replace(/</g, '\\u003c');
}
