/**
 * /api/admin/oauth?step=...
 *
 * How an AI assistant such as ChatGPT signs in to the staff area, by the
 * standard the Model Context Protocol uses: OAuth 2.1, authorisation code with
 * PKCE, and dynamic client registration.
 *
 *   resource   /.well-known/oauth-protected-resource     where to sign in
 *   meta       /.well-known/oauth-authorization-server   the endpoints below
 *   register   POST   the assistant registers itself and its return address
 *   authorize  GET    our page asking for a staff code; POST checks it
 *   token      POST   swaps the one-time code, or a refresh token, for tokens
 *
 * middleware.js maps the two well-known addresses here. The staff code is
 * typed on our own page, never given to the assistant, and is checked with
 * the same throttles as the staff login. Return addresses are limited to the
 * assistants we expect (MCP_REDIRECT_HOSTS), so somebody registering their
 * own "assistant" cannot collect a code by sending a member of staff a link.
 */
import { randomBytes, createHash } from 'node:crypto';
import { query, queryOne } from '../../db.js';
import { json, ipHash, str } from '../../http.js';
import { countHits, recordHit, clearHits, LIMITS } from '../../ratelimit.js';
import { codeMatches, personFor } from '../auth/login.js';

export const config = { runtime: 'nodejs' };

const ACCESS_SECONDS = 60 * 60;
const REFRESH_SECONDS = 30 * 24 * 60 * 60;
const CODE_SECONDS = 5 * 60;
const SCOPES = 'staff';
const DEFAULT_HOSTS = 'chatgpt.com,chat.openai.com,claude.ai,claude.com';

export const sha = (v) => createHash('sha256').update(String(v)).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function originOf(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${local ? 'http' : 'https'}://${host}`;
}

/** A return address we will send a code to: https, on an expected assistant's domain. */
export function redirectAllowed(uri) {
  let u;
  try { u = new URL(uri); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const hosts = (process.env.MCP_REDIRECT_HOSTS || DEFAULT_HOSTS).split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return hosts.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
}

function metadata(req) {
  const o = originOf(req);
  return {
    issuer: o,
    authorization_endpoint: `${o}/api/admin/oauth?step=authorize`,
    token_endpoint: `${o}/api/admin/oauth?step=token`,
    registration_endpoint: `${o}/api/admin/oauth?step=register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: [SCOPES]
  };
}

/* A token request arrives form encoded; the platform may or may not have
   parsed it already. */
async function readForm(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!raw && req.body === undefined) { for await (const c of req) { raw += c; if (raw.length > 16384) break; } }
  const t = raw.trim();
  if (t.startsWith('{')) { try { return JSON.parse(t); } catch { return {}; } }
  return Object.fromEntries(new URLSearchParams(t));
}

const oauthError = (res, status, error, description) => json(res, status, { error, error_description: description });

async function register(req, res) {
  const body = await readForm(req);
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!uris.length || !uris.every(redirectAllowed)) {
    return oauthError(res, 400, 'invalid_redirect_uri', 'Only the expected assistants may connect to this staff area.');
  }
  const id = 'mcp_' + randomBytes(12).toString('hex');
  const method = ['client_secret_post', 'client_secret_basic'].includes(body.token_endpoint_auth_method) ? body.token_endpoint_auth_method : 'none';
  const secret = method === 'none' ? null : token();
  await query('insert into mcp_clients (id, name, redirect_uris, secret_hash) values ($1, $2, $3, $4)',
    [id, str(body.client_name, 80) || 'Assistant', uris, secret ? sha(secret) : null]);
  json(res, 201, {
    client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: str(body.client_name, 80) || 'Assistant',
    redirect_uris: uris, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    token_endpoint_auth_method: method, ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {})
  });
}

function page(res, status, params, client, message) {
  const hidden = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource']
    .map((k) => `<input type="hidden" name="${k}" value="${esc(params[k])}" />`).join('');
  const host = (() => { try { return new URL(params.redirect_uri).hostname; } catch { return ''; } })();
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(`<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" /><title>Connect an assistant</title>
<style>body{margin:0;background:#0c1a2b;color:#f5f8fc;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px}
main{max-width:440px;width:100%;background:#14243a;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:26px}h1{font-size:22px;margin:0 0 10px}
p{color:#aebbcc;margin:0 0 12px}ul{color:#aebbcc;padding-left:20px;margin:0 0 16px}label{display:block;font-weight:600;margin:14px 0 6px}
input[type=password]{width:100%;box-sizing:border-box;font:inherit;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#0c1a2b;color:#fff}
button{margin-top:16px;width:100%;font:inherit;font-weight:700;padding:13px;border:0;border-radius:999px;background:#4fa8e8;color:#06121f;cursor:pointer}
.err{color:#f0a08b;font-weight:600}</style></head><body><main>
<h1>Connect ${esc(client ? client.name : 'an assistant')}</h1>
<p>${esc(client ? client.name : 'An assistant')} at <strong>${esc(host)}</strong> is asking to use the staff area as you. It will be able to:</p>
<ul><li>read everything you can see in the staff area, for the businesses you hold</li><li>mark a deposit paid, a job paid in full, and a report sent</li></ul>
<p>Nothing else can be changed through it. Enter your staff code to allow it.</p>
${message ? `<p class="err" role="alert">${esc(message)}</p>` : ''}
<form method="post" action="/api/admin/oauth?step=authorize">${hidden}
<label for="code">Your staff code</label><input id="code" name="code" type="password" autocomplete="current-password" required autofocus />
<button type="submit">Allow</button></form></main></body></html>`);
}

async function authorize(req, res) {
  const params = req.method === 'POST' ? await readForm(req) : Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const client = await queryOne('select id, name, redirect_uris from mcp_clients where id = $1', [str(params.client_id, 64) || '']);
  /* Without a known client and one of its own return addresses there is
     nowhere safe to send an answer, so the page says so and goes no further. */
  if (!client || !client.redirect_uris.includes(params.redirect_uri) || !redirectAllowed(params.redirect_uri)) {
    return page(res, 400, {}, null, 'This connection request is not valid. Start again from the assistant.');
  }
  if (params.response_type && params.response_type !== 'code') return page(res, 400, params, client, 'Unsupported request.');
  if (!params.code_challenge || (params.code_challenge_method || 'S256') !== 'S256') {
    return page(res, 400, params, client, 'This assistant did not send a secure sign-in request (PKCE S256).');
  }
  if (req.method !== 'POST') return page(res, 200, params, client);

  const perIp = { bucket: LIMITS.login.bucket, ipHash: ipHash(req) };
  if (await countHits({ ...perIp, windowSeconds: LIMITS.login.windowSeconds }) >= LIMITS.login.limit) {
    return page(res, 429, params, client, 'Too many attempts. Try again in 15 minutes.');
  }
  const submitted = str(params.code, 64) || '';
  const expected = process.env.STAFF_ACCESS_CODE || '';
  const shared = expected.length >= 4 && submitted && codeMatches(submitted, expected);
  const person = shared || !submitted ? null : await personFor(submitted);
  if (!shared && !person) {
    await recordHit(perIp);
    return page(res, 401, params, client, 'That code was not recognised.');
  }
  await clearHits(perIp);
  const code = token();
  await query(
    `insert into mcp_codes (code_hash, client_id, redirect_uri, challenge, person_id, shared, expires_at)
     values ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7))`,
    [sha(code), client.id, params.redirect_uri, params.code_challenge, person ? person.id : null, Boolean(shared), CODE_SECONDS]);
  const back = new URL(params.redirect_uri);
  back.searchParams.set('code', code);
  if (params.state) back.searchParams.set('state', params.state);
  res.statusCode = 302;
  res.setHeader('Location', back.toString());
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

async function issue(res, clientId, personId, shared) {
  const access = token();
  const refresh = token();
  await query(
    `insert into mcp_tokens (token_hash, kind, client_id, person_id, shared, expires_at) values
       ($1, 'access', $3, $4, $5, now() + make_interval(secs => $6)),
       ($2, 'refresh', $3, $4, $5, now() + make_interval(secs => $7))`,
    [sha(access), sha(refresh), clientId, personId, shared, ACCESS_SECONDS, REFRESH_SECONDS]);
  json(res, 200, { access_token: access, token_type: 'Bearer', expires_in: ACCESS_SECONDS, refresh_token: refresh, scope: SCOPES });
}

async function tokenStep(req, res) {
  const body = await readForm(req);
  let clientId = str(body.client_id, 64) || '';
  let secret = body.client_secret ? String(body.client_secret) : '';
  const basic = /^Basic\s+(.+)$/i.exec(String(req.headers.authorization || ''));
  if (basic) {
    const [id, sec] = Buffer.from(basic[1], 'base64').toString('utf8').split(':');
    clientId = decodeURIComponent(id || '');
    secret = decodeURIComponent(sec || '');
  }
  const client = await queryOne('select id, secret_hash from mcp_clients where id = $1', [clientId]);
  if (!client || (client.secret_hash && sha(secret) !== client.secret_hash)) return oauthError(res, 401, 'invalid_client', 'Unknown client.');

  if (body.grant_type === 'authorization_code') {
    /* One use only, and only within five minutes: the update claims it. */
    const row = await queryOne(
      `update mcp_codes set used_at = now() where code_hash = $1 and client_id = $2 and used_at is null and expires_at > now() returning *`,
      [sha(body.code || ''), client.id]);
    if (!row || row.redirect_uri !== body.redirect_uri) return oauthError(res, 400, 'invalid_grant', 'The code is not valid.');
    const verifier = String(body.code_verifier || '');
    if (createHash('sha256').update(verifier).digest('base64url') !== row.challenge) return oauthError(res, 400, 'invalid_grant', 'PKCE check failed.');
    return issue(res, client.id, row.person_id, row.shared);
  }
  if (body.grant_type === 'refresh_token') {
    /* Rotated on every use, so a stolen refresh token works once at most. */
    const row = await queryOne(
      `update mcp_tokens set revoked_at = now() where token_hash = $1 and kind = 'refresh' and client_id = $2 and revoked_at is null and expires_at > now() returning *`,
      [sha(body.refresh_token || ''), client.id]);
    if (!row) return oauthError(res, 400, 'invalid_grant', 'The refresh token is not valid.');
    return issue(res, client.id, row.person_id, row.shared);
  }
  return oauthError(res, 400, 'unsupported_grant_type', 'Use authorization_code or refresh_token.');
}

export default async function handler(req, res) {
  const step = new URL(req.url, 'http://x').searchParams.get('step');
  try {
    if (step === 'resource') {
      const o = originOf(req);
      return json(res, 200, { resource: `${o}/api/admin/mcp`, authorization_servers: [o], scopes_supported: [SCOPES], bearer_methods_supported: ['header'] });
    }
    if (step === 'meta') return json(res, 200, metadata(req));
    if (step === 'register' && req.method === 'POST') return await register(req, res);
    if (step === 'authorize' && (req.method === 'GET' || req.method === 'POST')) return await authorize(req, res);
    if (step === 'token' && req.method === 'POST') return await tokenStep(req, res);
    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    console.error('oauth request failed:', err.message);
    return oauthError(res, 500, 'server_error', 'Something went wrong.');
  }
}
