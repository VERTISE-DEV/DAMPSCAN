/**
 * GET /api/admin/search?q=
 *
 * The search box in the header of every staff page: a name, postcode, phone
 * or email across the jobs and enquiries of every business this person
 * holds. It is the assistant's find_client (lib/mcp/client-tools.js), so the
 * box and "find Mrs Patel" in ChatGPT give the same people, grouped the same
 * way. The page turns each hit into a link to that business's own screen.
 */
import { json, requireMethod } from '../../http.js';
import { requireScope } from '../../access.js';
import { findClient } from '../../mcp/client-tools.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  const q = String(new URL(req.url, 'http://localhost').searchParams.get('q') || '').trim();
  if (q.length < 2) return json(res, 200, { ok: true, clients: [] });
  try {
    const out = await findClient(scope, { text: q });
    return json(res, 200, { ok: true, clients: (out.data && out.data.clients) || [] });
  } catch (err) {
    console.error('search request failed:', err.message);
    return json(res, 500, { ok: false, error: 'search_failed' });
  }
}
