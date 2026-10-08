/**
 * Job photographs: stored, read back, and made safe to publish.
 *
 * Staff take them on site for the job record (before, during, after) and some
 * of them become the public gallery. They live in the same private Blob store
 * as the form attachments, under jobs/<id>/, and are only ever read through a
 * route that checks either a staff session or that the photo was published.
 *
 * The browser shrinks every photo before it uploads, to a full size and a
 * thumbnail, so what arrives is a modest JPEG. It is still checked here and
 * its metadata stripped: a phone writes the GPS position of the house into
 * every photograph, and a gallery that published that would publish the
 * customer's address.
 */
import { put, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { blobConfigured, readAttachment } from './blob.js';

export const PHOTO_SIZES = ['full', 'thumb'];
export const PHOTO_STAGES = ['before', 'during', 'after'];
/* The browser sends about 400KB for a full size; this leaves room for a
   large detailed photo without letting the function be used as a file store. */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export const isJpeg = (buf) => Buffer.isBuffer(buf) && buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

/**
 * The JPEG with every APP1 to APP15 and comment segment removed: EXIF (with
 * its GPS block), XMP, maker notes. APP0, the JFIF header, stays, and the
 * image data after the start of scan is copied untouched.
 *
 * Returns null for anything that is not a well formed JPEG.
 */
export function stripMetadata(buf) {
  if (!isJpeg(buf)) return null;
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    /* Start of scan: the rest is image data, copied as it is. */
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); }
    /* Markers with no length. */
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    const length = buf.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > buf.length) return null;
    const metadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!metadata) out.push(buf.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  return null;
}

/** Stores one size of one photo; returns its pathname. */
export async function storePhoto(jobId, size, jpeg) {
  if (!blobConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    const blob = await put(`jobs/${Number(jobId)}/${randomUUID()}-${size}.jpg`, jpeg, {
      access: 'private', addRandomSuffix: false, contentType: 'image/jpeg'
    });
    return { ok: true, path: blob.pathname };
  } catch (err) {
    console.warn('photo upload failed:', err.message);
    return { ok: false, reason: 'store_failed' };
  }
}

export const readPhoto = (path) => readAttachment(path);

/** Best effort: a photo row deleted with its file left behind is only storage. */
export async function deletePhotos(paths) {
  const list = paths.filter(Boolean);
  if (!list.length || !blobConfigured()) return;
  try { await del(list); } catch (err) { console.warn('photo delete failed:', err.message); }
}

/** Reads a raw body up to the cap, whether the platform buffered it or not. */
export async function readImageBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.length > MAX_PHOTO_BYTES ? null : req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_PHOTO_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Pipes a stored photo to a response with the cache policy given. */
export async function sendPhoto(res, path, cacheControl) {
  const file = await readPhoto(path);
  if (!file.ok) { res.statusCode = file.reason === 'not_found' ? 404 : 502; res.end(); return; }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (file.size) res.setHeader('Content-Length', String(file.size));
  const { Readable } = await import('node:stream');
  Readable.fromWeb(file.stream).pipe(res);
}
