/**
 * GET /api/cron/digest
 *
 * The morning digest, on the schedule in vercel.json, behind the same bearer
 * secret as every cron route. One push per business with something to say;
 * see lib/digest.js for what that is. It first runs any switched-on Revolut
 * feed, so the digest already knows about yesterday's payments, and on a
 * plan that limits scheduled jobs this needs no schedule of its own.
 */
import { json, requireMethod } from '../../http.js';
import { requireCron } from '../../cron-guard.js';
import { runDigest } from '../../digest.js';
import { syncFeeds } from '../../bank/revolut.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  if (!requireCron(req, res)) return;
  try {
    const feeds = await syncFeeds().catch((err) => ({ error: err.message }));
    const result = { ...(await runDigest()), feeds };
    console.log(`digest: ${result.sent.length} pushed`);
    json(res, 200, result);
  } catch (err) {
    console.error('digest failed:', err.message);
    json(res, 500, { ok: false, error: 'digest_failed' });
  }
}
