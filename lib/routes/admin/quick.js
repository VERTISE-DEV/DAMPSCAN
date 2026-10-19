/**
 * POST /api/admin/quick?job=&do=&exp=&sig=
 *
 * The phone alert's buttons (lib/quick-action.js). No session: the signed
 * ticket is the permission, for that job and that change only. The change
 * goes through the client card's route as the owners, and ntfy shows the
 * answer as the button's result.
 */
import { json } from '../../http.js';
import { scopeFor } from '../../access.js';
import { readTicket, QUICK } from '../../quick-action.js';
import { callRoute } from '../../mcp/shared.js';
import clients from './clients.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST' });
  const ticket = readTicket(new URL(req.url, 'https://x').searchParams);
  if (!ticket) return json(res, 403, { ok: false, error: 'This button has run out. Open the staff area instead.' });
  const scope = await scopeFor({ person: false, name: 'Owners' });
  const out = await callRoute(clients, { ...scope, viaAlert: true }, { method: 'POST', url: '/api/admin/clients', body: ticket.body });
  const done = out.status < 400 && !(out.data && out.data.ok === false);
  return json(res, done ? 200 : 400, done ? { ok: true, said: `${QUICK[ticket.act].label}: done.` } : { ok: false, error: (out.data && out.data.error) || 'That did not go through.' });
}
