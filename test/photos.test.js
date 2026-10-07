/**
 * Job photographs and the public gallery.
 *
 * The file handling first: only a JPEG is accepted, and its metadata, GPS
 * included, is gone before it is stored. Then the rules: photos belong to a
 * job in the person's scope, publishing needs a caption and a town (never a
 * postcode), and the public page and files show only what was published and
 * nothing from the job itself.
 */
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hash, Algorithm } from '@node-rs/argon2';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://dampscan@127.0.0.1:55432/dampscan';
process.env.SESSION_SECRET = 'photos-test-secret-long-enough-xxxxx';
process.env.IP_SALT = 'photos-test-salt-long-enough';
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

test('metadata is stripped from a JPEG, the image data kept, and anything else refused', () => {
  const clean = stripMetadata(JPEG);
  assert.ok(isJpeg(clean));
  assert.ok(!clean.toString('latin1').includes('GPS'), 'no location left in it');
  assert.ok(clean.toString('latin1').includes('JFIF'), 'the JFIF header stays');
  assert.deepEqual(clean.subarray(-15), JPEG.subarray(-15), 'the scan is untouched');
  assert.equal(stripMetadata(Buffer.from('%PDF-1.7 not a photo')), null);
  assert.equal(stripMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])), null, 'a truncated segment');
});

test('a photo is added to a job in scope, stored without its metadata, and nobody else can reach it', async () => {
  const verge = await personWith('verge-code', ['roofing']);
  const cool = await personWith('cool-code', ['ac']);
  const j = await job(verge);
  const added = await upload(verge, `job=${j.id}&stage=before&w=2000&h=1500`, JPEG);
  assert.equal(added.statusCode, 200);
  const photo = added.json().photo;
  assert.equal(photo.stage, 'before');
  assert.equal(photo.public, false);
  const [path] = [...store.keys()];
  assert.match(path, new RegExp(`^jobs/${j.id}/[0-9a-f-]{36}-full\\.jpg$`));
  assert.ok(!store.get(path).toString('latin1').includes('GPS'));

  assert.equal((await upload(verge, `photo=${photo.id}&size=thumb`, JPEG)).json().photo.hasThumb, true);
  assert.equal((await upload(cool, `job=${j.id}`, JPEG)).statusCode, 404, 'another business cannot add to it');
  assert.equal((await call(photos, { method: 'GET', url: `/api/admin/photos?img=${photo.id}`, headers: { cookie: cool } })).statusCode, 404);
  const mine = await call(photos, { method: 'GET', url: `/api/admin/photos?img=${photo.id}&size=full`, headers: { cookie: verge } });
  assert.equal(mine.statusCode, 200);
  assert.equal(mine.getHeader('cache-control'), 'private, max-age=3600');
  assert.equal((await upload(verge, `job=${j.id}`, Buffer.from('<svg/>'))).statusCode, 400, 'only photographs');
});

test('publishing needs a caption and a town, never a postcode, and the gallery shows only that', async () => {
  const verge = await personWith('verge-code', ['roofing']);
  const j = await job(verge);
  const ids = [];
  for (const stage of ['before', 'after']) ids.push((await upload(verge, `job=${j.id}&stage=${stage}&w=2000&h=1500`, JPEG)).json().photo.id);

  const page = async () => (await call(gallery, { method: 'GET', url: '/api/gallery?site=roofing' })).text();
  assert.match(await page(), /We are adding photographs/);
  assert.match(await page(), /noindex/);
  assert.equal((await call(gallery, { method: 'GET', url: `/api/gallery?img=${ids[0]}` })).statusCode, 404, 'not published, not served');

  const refuse = await change(verge, { op: 'update', id: ids[0], stage: 'before', public: true, publicCaption: 'Old roof' });
  assert.equal(refuse.statusCode, 400, 'no town');
  assert.equal((await change(verge, { op: 'update', id: ids[0], stage: 'before', public: true, publicCaption: 'Old roof', area: 'BR6 0AA' })).statusCode, 400, 'no postcode');
  for (const [id, stage, caption] of [[ids[0], 'before', 'Tired concrete tile'], [ids[1], 'after', 'New natural slate roof']]) {
    assert.equal((await change(verge, { op: 'update', id, stage, caption: 'Customer wants it quick', public: true, publicCaption: caption, area: 'Petts Wood' })).statusCode, 200);
  }

  const html = await page();
  assert.match(html, /<h2>New natural slate roof<\/h2>/, 'the after photo names the job');
  assert.match(html, /Petts Wood/);
  assert.match(html, /"@type":"ImageGallery"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/vergeroofing\.com\/our-work"/);
  for (const secret of ['Patel', 'BR6', 'Customer wants it quick']) assert.ok(!html.includes(secret), `leaks ${secret}`);
  assert.ok(html.indexOf('stage--before') < html.indexOf('stage--after'), 'before comes first');

  const file = await call(gallery, { method: 'GET', url: `/api/gallery?img=${ids[1]}&size=full` });
  assert.equal(file.statusCode, 200);
  assert.match(file.getHeader('cache-control'), /^public, /);

  await change(verge, { op: 'update', id: ids[1], stage: 'after', public: false });
  assert.equal((await call(gallery, { method: 'GET', url: `/api/gallery?img=${ids[1]}` })).statusCode, 404, 'unpublished is gone');
  assert.equal((await call(gallery, { method: 'GET', url: '/api/gallery?site=dampscan' })).statusCode, 404, 'no gallery, no page');

  await change(verge, { op: 'delete', id: ids[0] });
  assert.equal([...store.keys()].length, 1, 'the deleted photo left the store');
});
