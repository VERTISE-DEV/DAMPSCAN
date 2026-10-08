/**
 * /api/admin/photos
 *
 *   GET   ?job=ID                        a job's photos
 *   GET   ?img=ID&size=thumb|full        one photo, to a signed-in member of staff
 *   POST  ?job=ID          (image/jpeg)  a new photo, its full size
 *   POST  ?photo=ID&size=thumb (image/jpeg)  that photo's thumbnail
 *   POST  {op:'update', id, stage, caption, public, publicCaption, area}
 *   POST  {op:'delete', id}
 *
 * Every photo is reached through its job, and the job through the person's
 * scope, so a photo id from another business reads as absent. Publishing
 * needs a caption and a town, because the gallery shows nothing else: a
 * photo with neither would go up with no words, or tempt somebody to type
 * the street.
 */
import { query, queryOne } from '../../db.js';
import { json, requireMethod, readJson, str } from '../../http.js';
import { requireScope } from '../../access.js';
import { record } from '../../audit.js';
import { PHOTO_STAGES, PHOTO_SIZES, isJpeg, stripMetadata, storePhoto, deletePhotos, readImageBody, sendPhoto } from '../../photos.js';

export const config = { runtime: 'nodejs' };

const present = (p) => ({
  id: Number(p.id), jobId: Number(p.job_id), stage: p.stage, caption: p.caption, public: p.public,
  publicCaption: p.public_caption, area: p.area_label, width: p.width, height: p.height, hasThumb: Boolean(p.path_thumb),
  createdAt: p.created_at, publishedAt: p.published_at
});

/** A job in scope, of a quoted trade, or null. */
async function jobFor(id, scope) {
  if (!Number.isInteger(id) || id < 1) return null;
  const job = await queryOne(`select j.id, j.site from jobs j join businesses b on b.slug = j.site where j.id = $1 and b.payout_model <> 'damp'`, [id]);
  return job && scope.businesses.includes(job.site) ? job : null;
}

async function photoFor(id, scope) {
  if (!Number.isInteger(id) || id < 1) return null;
  const photo = await queryOne('select * from job_photos where id = $1', [id]);
  return photo && scope.businesses.includes(photo.site) ? photo : null;
}

const list = async (jobId) => (await query('select * from job_photos where job_id = $1 order by id', [jobId])).map(present);
const notFound = (res) => json(res, 404, { ok: false, error: 'not_found' });

async function upload(req, res, scope, url) {
  const raw = await readImageBody(req);
  if (!raw) return json(res, 413, { ok: false, error: 'too_large', message: 'That photo is too large. Try again; the page shrinks it before sending.' });
  const jpeg = isJpeg(raw) ? stripMetadata(raw) : null;
  if (!jpeg) return json(res, 400, { ok: false, error: 'not_jpeg', message: 'Only photographs can be added here.' });

  const photoId = Number(url.searchParams.get('photo'));
  if (photoId) {
    const photo = await photoFor(photoId, scope);
    if (!photo || url.searchParams.get('size') !== 'thumb') return notFound(res);
    const stored = await storePhoto(photo.job_id, 'thumb', jpeg);
    if (!stored.ok) return json(res, 503, { ok: false, error: stored.reason });
    await query('update job_photos set path_thumb = $2 where id = $1', [photo.id, stored.path]);
    if (photo.path_thumb) await deletePhotos([photo.path_thumb]);
    return json(res, 200, { ok: true, photo: present({ ...photo, path_thumb: stored.path }) });
  }

  const job = await jobFor(Number(url.searchParams.get('job')), scope);
  if (!job) return notFound(res);
  const stored = await storePhoto(job.id, 'full', jpeg);
  if (!stored.ok) return json(res, 503, { ok: false, error: stored.reason, message: stored.reason === 'not_configured' ? 'Photo storage is not switched on yet.' : 'The photo could not be stored.' });
  const width = Number(url.searchParams.get('w')) || null;
  const height = Number(url.searchParams.get('h')) || null;
  const stage = PHOTO_STAGES.includes(url.searchParams.get('stage')) ? url.searchParams.get('stage') : 'during';
  const row = await queryOne(
    `insert into job_photos (job_id, site, path_full, width, height, stage, added_by) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [job.id, job.site, stored.path, width, height, stage, scope.personId]);
  await record({ scope, business: job.site, entity: 'job', entityId: job.id, action: 'photo_add', before: null, after: { photoId: Number(row.id) } });
  return json(res, 200, { ok: true, photo: present(row) });
}

async function change(res, body, scope) {
  const photo = await photoFor(Number(body.id), scope);
  if (!photo) return notFound(res);
  if (body.op === 'delete') {
    await query('delete from job_photos where id = $1', [photo.id]);
    await deletePhotos([photo.path_full, photo.path_thumb]);
    await record({ scope, business: photo.site, entity: 'job', entityId: photo.job_id, action: 'photo_delete', before: present(photo), after: null });
    return json(res, 200, { ok: true, photos: await list(photo.job_id) });
  }
  if (body.op !== 'update') return json(res, 400, { ok: false, error: 'unknown_op' });
  const stage = PHOTO_STAGES.includes(body.stage) ? body.stage : photo.stage;
  const publicCaption = str(body.publicCaption, 120) || null;
  const area = str(body.area, 60) || null;
  const makePublic = body.public === true;
  if (makePublic && (!publicCaption || !area)) {
    return json(res, 400, { ok: false, errors: { public: 'To show it on the website, give it a caption, such as "New slate roof", and the town.' } });
  }
  if (makePublic && /\d/.test(area)) {
    return json(res, 400, { ok: false, errors: { area: 'Just the town or area, not a street or postcode.' } });
  }
  const row = await queryOne(
    `update job_photos set stage = $2, caption = $3, public = $4, public_caption = $5, area_label = $6,
            published_at = case when $4 and not public then now() when not $4 then null else published_at end
      where id = $1 returning *`,
    [photo.id, stage, str(body.caption, 300) || null, makePublic, publicCaption, area]);
  if (makePublic !== photo.public) {
    await record({ scope, business: photo.site, entity: 'job', entityId: photo.job_id, action: makePublic ? 'photo_publish' : 'photo_unpublish', before: null, after: { photoId: Number(photo.id) } });
  }
  return json(res, 200, { ok: true, photo: present(row), photos: await list(photo.job_id) });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.searchParams.get('img')) {
      const photo = await photoFor(Number(url.searchParams.get('img')), scope);
      const size = PHOTO_SIZES.includes(url.searchParams.get('size')) ? url.searchParams.get('size') : 'thumb';
      const path = photo && (size === 'thumb' ? photo.path_thumb || photo.path_full : photo.path_full);
      if (!path) return notFound(res);
      return await sendPhoto(res, path, 'private, max-age=3600');
    }
    if (req.method === 'GET') {
      const job = await jobFor(Number(url.searchParams.get('job')), scope);
      if (!job) return notFound(res);
      return json(res, 200, { ok: true, photos: await list(job.id) });
    }
    if (String(req.headers['content-type'] || '').startsWith('image/')) return await upload(req, res, scope, url);
    return await change(res, await readJson(req), scope);
  } catch (err) {
    console.error('photos request failed:', err.message);
    json(res, 500, { ok: false, error: 'photos_failed' });
  }
}
