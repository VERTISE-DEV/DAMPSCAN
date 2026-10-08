/**
 * Every /api/admin/* route, as one serverless function.
 *
 * Vercel counts one function per file under api/, and a Hobby plan deployment
 * takes twelve. Six separate admin files put the whole deployment over that
 * ceiling on its own. A dynamic route collapses them into one function without
 * changing a single URL: Vercel maps this file to /api/admin/:action, so
 * /api/admin/jobs and /api/admin/leads still answer exactly as they did, and
 * nothing in the staff dashboard had to change.
 *
 * The handlers themselves did not move logic, only location: they live under
 * lib/routes/admin/ now, purely so that Vercel stops treating each one as a
 * function of its own. Each is still a plain (req, res) handler and is still
 * imported directly by the tests, which is where their behaviour is covered.
 * This file is only a lookup.
 */
import { json, requireMethod, actionFrom } from '../../lib/http.js';
import attachment from '../../lib/routes/admin/attachment.js';
import bank from '../../lib/routes/admin/bank.js';
import business from '../../lib/routes/admin/business.js';
import calendar from '../../lib/routes/admin/calendar.js';
import clients from '../../lib/routes/admin/clients.js';
import contracts from '../../lib/routes/admin/contracts.js';
import due from '../../lib/routes/admin/due.js';
import insights from '../../lib/routes/admin/insights.js';
import jobs from '../../lib/routes/admin/jobs.js';
import leads from '../../lib/routes/admin/leads.js';
import mcp from '../../lib/routes/admin/mcp.js';
import me from '../../lib/routes/admin/me.js';
import oauth from '../../lib/routes/admin/oauth.js';
import people from '../../lib/routes/admin/people.js';
import photos from '../../lib/routes/admin/photos.js';
import push from '../../lib/routes/admin/push.js';
import pricebook from '../../lib/routes/admin/pricebook.js';
import quoted from '../../lib/routes/admin/quoted.js';
import rates from '../../lib/routes/admin/rates.js';
import summary from '../../lib/routes/admin/summary.js';
import todos from '../../lib/routes/admin/todos.js';

export const config = { runtime: 'nodejs' };

const ROUTES = { attachment, bank, business, calendar, clients, contracts, due, insights, jobs, leads, mcp, me, oauth, people, photos, pricebook, push, quoted, rates, summary, todos };

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST', 'DELETE'])) return;

  /* The sign-in addresses an AI assistant looks for (/.well-known/...) are
     rewritten here by middleware.js, but on Vercel the function still sees
     the address that was asked for, not the rewrite. So they are recognised
     by path and sent to the sign-in route with the step it needs. */
  const path = new URL(req.url || '/', 'http://x').pathname;
  if (path.startsWith('/.well-known/oauth-protected-resource')) { req.url = '/api/admin/oauth?step=resource'; return oauth(req, res); }
  if (path.startsWith('/.well-known/oauth-authorization-server') || path === '/.well-known/openid-configuration') {
    req.url = '/api/admin/oauth?step=meta';
    return oauth(req, res);
  }
  const route = ROUTES[actionFrom(req.url)];
  if (!route) {
    json(res, 404, { ok: false, error: 'not_found' });
    return;
  }
  return route(req, res);
}
