/**
 * A survey's finished report as a file on its job.
 *
 * The assistant hands over a file the person uploaded in the chat as a short
 * lived download address; it is fetched once here and kept as a private blob.
 * Reading it back is through /api/admin/attachment, either signed in or with
 * a signed link that runs out, which is what the assistant gives to the
 * person's own Outlook connector to attach to the final email.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { storeAttachment } from './blob.js';

export const REPORT_TYPES = { 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
const MAX_BYTES = 25 * 1024 * 1024;
const LINK_DAYS = 7;

/* Only an https address, and no redirects, so the fetch cannot be pointed at
   anything on the server's own network. */
export async function fetchReport(url, name) {
  let u;
  try { u = new URL(String(url || '')); } catch { return { error: 'That file link is not right.' }; }
  if (u.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) return { error: 'That file link is not right.' };
  const res = await fetch(u, { redirect: 'error' }).catch(() => null);
  if (!res || !res.ok) return { error: 'The file could not be fetched. Upload it again.' };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) return { error: 'That file is over 25MB.' };
  const pdf = buf.subarray(0, 5).toString() === '%PDF-';
  const docx = buf[0] === 0x50 && buf[1] === 0x4b && /\.docx$/i.test(name || '');
  if (!pdf && !docx) return { error: 'The report must be a PDF or a Word document.' };
  const type = pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const clean = String(name || '').replace(/[^\w .-]/g, '').trim() || `report.${REPORT_TYPES[type]}`;
  const stored = await storeAttachment(clean, type, buf);
  if (!stored.ok) return { error: stored.reason === 'not_configured' ? 'File storage is not set up.' : 'The file could not be saved. Try again.' };
  return { path: stored.path, name: clean };
}

const sign = (id, exp) => createHmac('sha256', process.env.SESSION_SECRET || '').update(`report:${id}:${exp}`).digest('hex');

/** A link to the job's report that works without signing in, for a week. */
export function reportLink(origin, id, now = Date.now()) {
  const exp = Math.floor(now / 1000) + LINK_DAYS * 86400;
  return `${origin}/api/admin/attachment?report=${id}&exp=${exp}&sig=${sign(id, exp)}`;
}

export function signedOk(id, exp, sig) {
  if (!/^\d+$/.test(String(id)) || !/^\d+$/.test(String(exp)) || Number(exp) < Date.now() / 1000) return false;
  const want = Buffer.from(sign(Number(id), Number(exp)));
  const got = Buffer.from(String(sig || ''));
  return want.length === got.length && timingSafeEqual(want, got);
}
