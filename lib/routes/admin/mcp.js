/**
 * POST /api/admin/mcp
 *
 * The staff area as a Model Context Protocol server, for ChatGPT, Claude or
 * any assistant that speaks it. Streamable HTTP, answered as plain JSON: one
 * JSON-RPC request in, one answer out, nothing kept between calls, which is
 * what a serverless function can do and all the protocol needs here.
 *
 * Every call carries a bearer token from the sign-in in oauth.js. The token
 * is turned into the person's scope exactly as a browser session is, so the
 * assistant sees what that person sees and nothing else. Without a valid
 * token the answer is 401 with the address of the sign-in instructions, which
 * is how the assistant knows to start the sign-in.
 *
 * Changes are limited to the three tools marked as writes in lib/mcp/tools.js,
 * and each is audited under the person's name like a change from the screen.
 */
import { queryOne } from '../../db.js';
import { json } from '../../http.js';
import { scopeFor } from '../../access.js';
import { TOOLS } from '../../mcp/tools.js';
import { sha, originOf } from './oauth.js';

export const config = { runtime: 'nodejs' };

const PROTOCOL = '2025-06-18';
const INSTRUCTIONS = 'The staff area for ATi Damp Survey and DampScan (damp surveys), Verge Roofing (roofing) and CoolRight (air conditioning). ' +
  'Amounts ending in Pence are pennies: divide by 100 for pounds. Dates are London time. Customer details are private: do not repeat them outside this conversation. ' +
  'You can read everything this person can see, and mark a deposit paid, a job paid in full or a report sent; confirm the job number with the person before marking.';

function unauthorised(req, res) {
  res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${originOf(req)}/.well-known/oauth-protected-resource"`);
  json(res, 401, { error: 'invalid_token', error_description: 'Sign in to the staff area to connect.' });
}

/** The person behind a bearer token, as a scope, or null. */
export async function scopeFromToken(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization || ''));
  if (!m) return null;
  const row = await queryOne(
    `update mcp_tokens set last_used_at = now() where token_hash = $1 and kind = 'access' and revoked_at is null and expires_at > now()
     returning person_id, shared`, [sha(m[1])]);
  if (!row) return null;
  const scope = await scopeFor(row.shared ? { person: false, name: 'Owners' } : { person: true, sub: Number(row.person_id) });
  return scope && (scope.isAdmin || scope.businesses.length) ? scope : null;
}

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function callTool(scope, params) {
  const tool = TOOLS.find((t) => t.name === params.name);
  if (!tool) return { content: [{ type: 'text', text: `There is no tool called ${params.name}.` }], isError: true };
  const { status, data } = await tool.run(scope, params.arguments || {});
  const failed = status >= 400 || (data && data.ok === false);
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    ...(data && typeof data === 'object' && !Array.isArray(data) ? { structuredContent: data } : {}),
    isError: failed
  };
}

async function answer(scope, msg) {
  const { id, method, params = {} } = msg || {};
  if (!method) return err(id ?? null, -32600, 'Invalid request');
  if (id === undefined || id === null) return null; // a notification: nothing to say back
  if (method === 'initialize') {
    return ok(id, { protocolVersion: params.protocolVersion || PROTOCOL, capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'staff-area', title: 'Staff area', version: '1.0.0' }, instructions: INSTRUCTIONS });
  }
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS.map(({ run, ...t }) => t) });
  if (method === 'tools/call') {
    try { return ok(id, await callTool(scope, params)); } catch (e) {
      console.error('mcp tool failed:', params.name, e.message);
      return ok(id, { content: [{ type: 'text', text: 'That did not work. Try again in a moment.' }], isError: true });
    }
  }
  return err(id, -32601, `Method not found: ${method}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Use POST' });
  }
  const scope = await scopeFromToken(req);
  if (!scope) return unauthorised(req, res);
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (body === undefined) {
    let raw = '';
    for await (const c of req) { raw += c; if (raw.length > 65536) break; }
    try { body = JSON.parse(raw); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') return json(res, 400, err(null, -32700, 'Parse error'));
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => answer(scope, m)))).filter(Boolean);
    if (!out.length) { res.statusCode = 202; return res.end(); }
    return json(res, 200, out);
  }
  const one = await answer(scope, body);
  if (!one) { res.statusCode = 202; return res.end(); }
  return json(res, 200, one);
}
