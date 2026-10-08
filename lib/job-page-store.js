/**
 * Reading and saving a finished job's page from the staff area, for
 * lib/routes/admin/photos.js. The rules are lib/job-pages.js; this is only
 * the database side of them, so the photos route stays about photos.
 *
 * Saving always keeps what was typed, so a half written page is not lost.
 * Publishing is refused, with the reasons, until the page qualifies; the
 * public page checks again on every request, so a job later marked
 * cancelled, or whose photos are taken down, drops off the site by itself.
 */
import { query, queryOne } from './db.js';
import { str } from './http.js';
import { brandFor } from './brands.js';
import { record } from './audit.js';
import { pageProblems, districtOf, slugFor, isLive, googlePost, pageUrl, wordCount, MIN_WORDS } from './job-pages.js';

const COLS = 'id, site, status, customer_name, customer_postcode, page_title, page_town, page_district, page_writeup, page_publish, page_slug, page_published_at';

const publicPhotos = async (jobId) => Number((await queryOne('select count(*) as n from job_photos where job_id = $1 and public', [jobId])).n);

/** The page as the staff screen shows it. */
export async function pageFor(jobId) {
  const job = await queryOne(`select ${COLS} from jobs where id = $1`, [jobId]);
  if (!job) return null;
  const brand = brandFor(job.site);
  const photos = await publicPhotos(job.id);
  const live = isLive(job, photos);
  return {
    title: job.page_title || '', town: job.page_town || '', writeup: job.page_writeup || '',
    district: job.page_district || districtOf(job.customer_postcode),
    publish: job.page_publish, live, words: wordCount(job.page_writeup), minWords: MIN_WORDS,
    url: live && brand ? pageUrl(brand.origin, job) : null,
    googlePost: live && brand ? googlePost(job, brand) : null,
    problems: Object.values(pageProblems({ title: job.page_title, town: job.page_town, writeup: job.page_writeup, photos, status: job.status, customerName: job.customer_name, postcode: job.customer_postcode }))
  };
}

/** Save what was typed, and publish or unpublish. Returns { ok, errors?, page }. */
export async function savePage(jobId, body, scope) {
  const job = await queryOne(`select ${COLS} from jobs where id = $1`, [jobId]);
  const title = str(body.title, 60) || null;
  const town = str(body.town, 60) || null;
  const writeup = typeof body.writeup === 'string' ? body.writeup.replace(/\r\n/g, '\n').trim().slice(0, 8000) || null : null;
  const publish = body.publish === true;
  const district = districtOf(job.customer_postcode);
  if (publish) {
    const errors = pageProblems({ title, town, writeup, photos: await publicPhotos(job.id), status: job.status, customerName: job.customer_name, postcode: job.customer_postcode });
    if (Object.keys(errors).length) {
      await query('update jobs set page_title = $2, page_town = $3, page_writeup = $4 where id = $1', [job.id, title, town, writeup]);
      return { ok: false, errors, page: await pageFor(job.id) };
    }
  }
  /* The slug is fixed the first time the page goes up, so a link shared or
     posted to Google keeps working when the wording is tidied later. */
  const slug = job.page_slug || (publish ? slugFor({ id: job.id, title, town, district }) : null);
  await query(
    `update jobs set page_title = $2, page_town = $3, page_writeup = $4, page_district = $5, page_publish = $6, page_slug = $7,
            page_published_at = case when $6 and page_published_at is null then now() else page_published_at end
      where id = $1`,
    [job.id, title, town, writeup, district, publish, slug]);
  if (publish !== job.page_publish) {
    await record({ scope, business: job.site, entity: 'job', entityId: job.id, action: publish ? 'page_publish' : 'page_unpublish', before: null, after: { slug } });
  }
  return { ok: true, page: await pageFor(job.id) };
}
