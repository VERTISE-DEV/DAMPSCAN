/**
 * /api/admin/push
 *
 *   GET                       {ok, publicKey}  null when push is not set up,
 *                             which is how the page knows to hide the button
 *   POST  {subscription}      keep this browser's subscription for the person
 *   DELETE {endpoint}         forget it
 *
 * The subscription is the browser's, the person is the session's: nothing in
 * the body says who it is for, so nobody can sign somebody else up. What each
 * person is then told about is decided at send time from their grants, in
 * lib/push.js.
 */
import { json, requireMethod, readJson } from '../../http.js';
import { requireScope } from '../../access.js';
import { vapidConfig } from '../../webpush.js';
import { saveSubscription, removeSubscription } from '../../push.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST', 'DELETE'])) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  const vapid = vapidConfig();
  if (req.method === 'GET') return json(res, 200, { ok: true, publicKey: vapid ? vapid.publicKey : null });
  if (!vapid) return json(res, 404, { ok: false, error: 'not_configured' });
  try {
    const body = await readJson(req);
    if (req.method === 'DELETE') {
      await removeSubscription(scope, body.endpoint);
      return json(res, 200, { ok: true });
    }
    if (!(await saveSubscription(scope, body.subscription))) return json(res, 400, { ok: false, error: 'bad_subscription' });
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('push request failed:', err.message);
    return json(res, 500, { ok: false, error: 'push_failed' });
  }
}
