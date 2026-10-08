/**
 * A finished job's own page, its Google post and the sitemap that lists it.
 *
 * The rules: a page goes up only for a finished job with a public photo and
 * a write-up long enough not to be thin, and shows only the title, town,
 * district and write-up, never the customer's name, street or postcode.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'jobpages-test-secret-long-enough-xxx';
process.env.IP_SALT = 'jobpages-test-salt-long-enough';
process.env.STAFF_ACCESS_CODE = '1290';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token';

const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
mock.module('../lib/db.js', {
  namedExports: {
    sql: () => { throw new Error('not used'); },
    query: async (t, p = []) => (await pool.query(t, p)).rows,
    queryOne: async (t, p = []) => { const { rows } = await pool.query(t, p); return rows[0] || null; },
    ping: async () => true
  }
});
/* An in-memory store in place of Vercel Blob. */
const store = new Map();
mock.module('@vercel/blob', {
  namedExports: {
    put: async (pathname, body) => { store.set(pathname, Buffer.from(body)); return { pathname }; },
    get: async (pathname) => {
      const b = store.get(pathname);
      if (!b) return null;
      return { statusCode: 200, stream: new Blob([b]).stream(), blob: { contentType: 'image/jpeg', size: b.length } };
    },
    del: async (paths) => { for (const p of [].concat(paths)) store.delete(p); },
    list: async () => ({ blobs: [], hasMore: false }),
    issueSignedToken: async () => { throw new Error('not used'); },
    presignUrl: async () => { throw new Error('not used'); }
  }
});

const { stripMetadata, isJpeg } = await import('../lib/photos.js');
const login = (await import('../lib/routes/auth/login.js')).default;
const quoted = (await import('../lib/routes/admin/quoted.js')).default;
const photos = (await import('../lib/routes/admin/photos.js')).default;
const gallery = (await import('../api/gallery.js')).default;

/* A minimal JPEG: SOI, an APP0, an APP1 "Exif" segment carrying a GPS
   marker string, a quantisation table, SOS and EOI. */
const seg = (marker, payload) => { const b = Buffer.alloc(4); b[0] = 0xff; b[1] = marker; b.writeUInt16BE(payload.length + 2, 2); return Buffer.concat([b, payload]); };
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
  seg(0xe1, Buffer.from('Exif\0\0GPSLatitude 51.3762 GPSLongitude 0.0981', 'latin1')),
  seg(0xdb, Buffer.alloc(65, 1)),
  Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0x11, 0x22, 0x33, 0xff, 0xd9])
]);

function makeReq({ method = 'POST', url = '/api/admin/photos', body, headers = {} } = {}) {
  return { method, url, body, headers: { host: 'vergeroofing.com', 'x-forwarded-for': '203.0.113.30', 'user-agent': 't', ...headers }, socket: { remoteAddress: '203.0.113.30' } };
}
function makeRes() {
  const chunks = [];
  const res = {
    statusCode: 200, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeader(k) { return this.headers[k.toLowerCase()]; },
    write(c) { chunks.push(Buffer.from(c)); return true; }, on() { return this; }, once() { return this; }, emit() { return true; },
    end(p) { if (p) chunks.push(Buffer.from(p)); this.body = Buffer.concat(chunks); this.done(); }
  };
  res.finished = new Promise((r) => { res.done = r; });
  res.text = () => (res.body ? res.body.toString('utf8') : '');
  res.json = () => JSON.parse(res.text());
  return res;
}
/* Streams are piped, so wait for the end rather than the handler. */
async function call(handler, init) {
  const req = makeReq(init); const res = makeRes();
  await handler(req, res);
  await Promise.race([res.finished, new Promise((r) => setTimeout(r, 2000))]);
  return res;
}
async function personWith(code, grants) {
  const h = await hash(code, { algorithm: Algorithm.Argon2id });
  const { rows } = await pool.query('insert into people (name, passcode_hash, is_admin) values ($1,$2,false) returning id', [code, h]);
  for (const g of grants) await pool.query('insert into grants (person_id, business_slug, level) values ($1,$2,$3)', [rows[0].id, g, 'manage']);
  const raw = (await call(login, { url: '/api/auth/login', body: { code } })).getHeader('set-cookie');
  return (Array.isArray(raw) ? raw.join('; ') : String(raw)).split(';')[0];
}
const job = async (cookie, site = 'roofing') => (await call(quoted, { url: '/api/admin/quoted', body: { op: 'save', site, customerName: 'Mrs Patel', customerPostcode: 'BR6 0AA', status: 'completed' }, headers: { cookie } })).json().job;
const upload = (cookie, query, bytes) => call(photos, { url: '/api/admin/photos?' + query, body: bytes, headers: { cookie, 'content-type': 'image/jpeg' } });
const change = (cookie, body) => call(photos, { body, headers: { cookie } });

before(async () => { await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')); });
beforeEach(async () => {
  store.clear();
  await pool.query('truncate leads, events, rate_hits, jobs, people, audit, job_costs, job_owner_days, job_payments, payouts, quote_lines, job_messages, job_photos restart identity cascade');
});
after(async () => { await pool.end(); });


const pages = await import('../lib/job-pages.js');
const insights = (await import('../lib/routes/admin/insights.js')).default;

const WRITEUP = Array.from({ length: 14 }, (_, i) => `The old concrete tiles had reached the end of their life and section ${i} was stripped back.`).join(' ')
  + '\n\nWe fitted new breathable membrane, treated battens and natural slate, with new lead flashings to the chimney.';
const save = (cookie, jobId, extra = {}) => change(cookie, { op: 'page', job: jobId, title: 'Re-roof', town: 'Orpington', writeup: WRITEUP, publish: true, ...extra });
const publicPhoto = async (cookie, jobId, stage = 'after') => {
  const id = (await upload(cookie, `job=${jobId}&stage=${stage}&w=2000&h=1500`, JPEG)).json().photo.id;
  await change(cookie, { op: 'update', id, stage, public: true, publicCaption: 'New natural slate roof', area: 'Orpington' });
  return id;
};
const get = (url) => call(gallery, { method: 'GET', url });

test('the rules: words, photos, a finished job, and nothing that identifies the customer', () => {
  const ok = { title: 'Re-roof', town: 'Orpington', writeup: WRITEUP, photos: 1, status: 'completed', customerName: 'Mrs Patel', postcode: 'BR6 0AA' };
  assert.deepEqual(pages.pageProblems(ok), {});
  assert.ok(pages.pageProblems({ ...ok, writeup: 'Too short to be a page.' }).writeup);
  assert.ok(pages.pageProblems({ ...ok, photos: 0 }).photos);
  assert.ok(pages.pageProblems({ ...ok, status: 'booked' }).status);
  assert.ok(pages.pageProblems({ ...ok, town: 'BR6 0AA' }).town);
  assert.ok(pages.pageProblems({ ...ok, writeup: WRITEUP + ' Mrs Patel was delighted.' }).writeup, 'the name');
  assert.ok(pages.pageProblems({ ...ok, writeup: WRITEUP + ' At BR6 0AA.' }).writeup, 'the postcode');
  assert.ok(pages.pageProblems({ ...ok, writeup: WRITEUP + ' At 12 Acacia Avenue.' }).writeup, 'the street');
  assert.equal(pages.slugFor({ id: 42, title: 'Re-roof', town: 'Orpington', district: 'BR6' }), 're-roof-in-orpington-br6-42');
  assert.equal(pages.areaOf('EC1A'), 'EC');
});

test('a Google post is under 1500 characters, with the link and a call to action', () => {
  const job = { page_title: 'Re-roof', page_town: 'Orpington', page_district: 'BR6', page_slug: 're-roof-in-orpington-br6-1', page_writeup: WRITEUP.repeat(10) };
  const post = pages.googlePost(job, { name: 'Verge Roofing', origin: 'https://vergeroofing.com', phoneLabel: '020 3432 4561' });
  assert.ok(post.length < 1500, `${post.length} characters`);
  assert.match(post, /^Re-roof in Orpington, BR6/);
  assert.match(post, /https:\/\/vergeroofing\.com\/our-work\/re-roof-in-orpington-br6-1/);
  assert.match(post, /free quote/);
});

test('staff publish a job page; it renders with meta, schema and links, and leaks nothing', async () => {
  const verge = await personWith('verge-code', ['roofing']);
  const j = await job(verge);
  const thin = await save(verge, j.id);
  assert.equal(thin.statusCode, 400, 'no public photo yet');
  assert.ok(thin.json().errors.photos);
  assert.equal(thin.json().page.writeup.length > 0, true, 'the words are kept anyway');

  await publicPhoto(verge, j.id, 'before');
  await publicPhoto(verge, j.id, 'after');
  const out = await save(verge, j.id);
  assert.equal(out.statusCode, 200);
  const page = out.json().page;
  assert.equal(page.live, true);
  assert.equal(page.url, `https://vergeroofing.com/our-work/re-roof-in-orpington-br6-${j.id}`);
  assert.ok(page.googlePost.length < 1500);

  const html = (await get(`/api/gallery?site=roofing&job=re-roof-in-orpington-br6-${j.id}`)).text();
  assert.match(html, /<title>Re-roof in Orpington, BR6 \| Verge Roofing<\/title>/);
  assert.match(html, new RegExp(`<link rel="canonical" href="https://vergeroofing.com/our-work/re-roof-in-orpington-br6-${j.id}"`));
  assert.match(html, /<meta name="description" content="Re-roof in Orpington, BR6: The old concrete/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /"@type":"Article"/);
  assert.match(html, /href="\/roofing-in\/kent-and-south-east-london"/, 'links its region');
  assert.match(html, /href="\/our-work"/);
  assert.ok(!html.includes('@@JOB_'), 'every token filled');
  for (const secret of ['Patel', '0AA']) assert.ok(!html.includes(secret), `leaks ${secret}`);

  const listing = (await get('/api/gallery?site=roofing')).text();
  assert.match(listing, new RegExp(`<a href="/our-work/re-roof-in-orpington-br6-${j.id}">`), 'the gallery links to it');
  const map = (await get('/api/gallery?site=roofing&sitemap=1')).text();
  assert.match(map, new RegExp(`<loc>https://vergeroofing.com/our-work/re-roof-in-orpington-br6-${j.id}</loc>`));
  const near = (await get('/api/gallery?site=roofing&near=BR,DA')).json();
  assert.deepEqual(near.jobs, [{ href: `/our-work/re-roof-in-orpington-br6-${j.id}`, title: 'Re-roof in Orpington, BR6' }]);
  assert.deepEqual((await get('/api/gallery?site=roofing&near=SW')).json().jobs, []);

  /* Another business cannot touch it, and unpublishing takes it down. */
  const cool = await personWith('cool-code', ['ac']);
  assert.equal((await save(cool, j.id)).statusCode, 404);
  await save(verge, j.id, { publish: false });
  assert.equal((await get(`/api/gallery?site=roofing&job=re-roof-in-orpington-br6-${j.id}`)).statusCode, 404);
  assert.ok(!(await get('/api/gallery?site=roofing&sitemap=1')).text().includes('<loc>'));
  assert.equal((await get('/api/gallery?site=dampscan&job=anything')).statusCode, 404);
});

test('a page comes down by itself when its job is no longer finished', async () => {
  const verge = await personWith('verge-code', ['roofing']);
  const j = await job(verge);
  await publicPhoto(verge, j.id);
  assert.equal((await save(verge, j.id)).statusCode, 200);
  await pool.query(`update jobs set status = 'cancelled' where id = $1`, [j.id]);
  assert.equal((await get(`/api/gallery?site=roofing&job=re-roof-in-orpington-br6-${j.id}`)).statusCode, 404);
});
