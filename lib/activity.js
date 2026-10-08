/**
 * One phone alert for each change made in the staff area.
 *
 * Every admin route is wrapped here, both where the browser reaches it (the
 * dispatcher) and where the assistant does (callRoute), so a change made
 * through ChatGPT is announced the same way and marked as such. One request
 * is one alert: a save is one request however many fields it carried, and a
 * request that already sent its own alert (a payment, a new job, a to-do) is
 * left alone, so nothing is said twice.
 *
 * The lock screen rule from notify.js holds: business, job number, amounts
 * and who did it. Nothing from the request body is quoted except numbers,
 * because a note, a name or an address may be a customer's.
 */
import { queryOne } from './db.js';
import { notify, requestAlerts } from './notify.js';
import { actionFrom } from './http.js';

const pounds = (p) => `£${(Number(p) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* Routes that change nothing worth saying, or are plumbing. */
const QUIET = new Set(['mcp', 'oauth', 'push', 'me', 'due', 'summary', 'insights', 'calendar', 'todos']);

const QUOTED = {
  save: (b) => (b.id ? 'edited' : 'added'), cost: 'added a cost to', uncost: 'removed a cost from', days: 'changed owners\' days on',
  unpay: 'removed a payment from', clockin: 'clocked in on', clockout: 'clocked out of', untime: 'removed clocked time from',
  hours: 'logged hours on', miles: 'logged miles on', rate: 'changed an hourly rate', message: 'marked a message sent on',
  status: 'moved', qline: 'added a quote line to', unqline: 'removed a quote line from', markup: 'changed the markup on',
  quotelink: 'made the quote link for', costsfromquote: 'copied quote costs on', fromtemplate: 'used a template on',
  invoice: 'issued the invoice for', pricefromlines: 'set the price from the lines on'
};

/** What happened, in words, or null to say nothing. */
export function describe(action, method, body = {}, data = {}) {
  const op = body.op;
  const jobId = body.id ?? body.jobId ?? (data && data.job && data.job.id);
  const job = jobId != null && /^\d+$/.test(String(jobId)) ? `job #${jobId}` : 'a job';
  const amount = [body.amountPence, body.costPence].map(Number).find((n) => Number.isFinite(n) && n > 0);
  const money = amount ? ` (${pounds(amount)})` : '';
  if (action === 'quoted') {
    const w = QUOTED[op];
    if (!w) return null;
    const verb = typeof w === 'function' ? w(body) : w;
    return op === 'rate' ? verb : `${verb} ${op === 'save' && !body.id ? 'a job' : job}${money}`;
  }
  if (action === 'jobs') return method === 'DELETE' ? `deleted ${job}` : body.id ? `edited ${job}` : 'added a job';
  if (action === 'clients') return `updated the client card on ${job}`;
  if (action === 'photos') return op === 'page' ? `changed the project page on ${job}` : op === 'delete' ? `removed a photo from ${job}` : op ? `changed photos on ${job}` : `added photos to ${job}`;
  if (action === 'attachment') return method === 'DELETE' ? `removed a file from ${job}` : `added a file to ${job}`;
  if (action === 'bank') return op === 'import' ? 'uploaded a bank statement' : method === 'DELETE' ? 'removed a bank statement' : op === 'feed' ? 'changed the bank feed' : 'matched bank payments';
  if (action === 'people') return 'changed the people list';
  if (action === 'rates') return 'changed rates';
  if (action === 'business') return 'changed the business details';
  if (action === 'pricebook') return 'changed the price book';
  if (action === 'contracts') return op === 'serviced' ? 'recorded a maintenance visit' : op === 'remove' ? 'ended a maintenance plan' : 'changed a maintenance plan';
  if (action === 'leads') return 'updated an enquiry';
  return null;
}

async function businessOf(slug) {
  if (!slug) return null;
  try { return await queryOne('select slug, name from businesses where slug = $1', [slug]); } catch { return null; }
}

const DAMP = { damp: 'ATi & DampScan', roofing: 'Verge Roofing', ac: 'CoolRight' };

/** Wraps a route handler so a successful change is announced. Never throws for the alert. */
export function withActivity(handler, { via = null } = {}) {
  return async (req, res) => {
    const method = req.method || 'GET';
    const action = actionFrom(req.url || '');
    if (method === 'GET' || QUIET.has(action)) return handler(req, res);
    let out = '';
    const end = res.end;
    res.end = function (chunk, ...rest) { if (chunk && out.length < 200000) out += chunk; return end.call(this, chunk, ...rest); };
    const told = { sent: false };
    const result = await requestAlerts.run(told, () => handler(req, res));
    try {
      if (told.sent || (res.statusCode || 200) >= 300) return result;
      let data = {};
      try { data = out ? JSON.parse(out) : {}; } catch { data = {}; }
      const url = new URL(req.url || '/', 'http://x');
      const body = { ...(req.body && typeof req.body === 'object' ? req.body : {}) };
      if (!body.op && url.searchParams.get('op')) body.op = url.searchParams.get('op');
      const what = describe(action, method, body, data);
      if (!what) return result;
      const scope = req.scope || req.mcpScope || {};
      const slug = body.site || (data.job && data.job.site) || url.searchParams.get('site');
      const biz = await businessOf(slug);
      const books = url.searchParams.get('books') || body.books;
      const name = biz ? biz.name : DAMP[books] || 'Staff area';
      const who = `${scope.name || 'Someone'}${via || scope.viaAssistant ? ' (via ChatGPT)' : ''}`;
      await notify({ business: biz ? biz.slug : null, kind: 'activity', ref: null, tags: 'pencil',
        title: `${name}: change by ${scope.name || 'staff'}`.slice(0, 120), message: `${who} ${what}.` });
    } catch (err) {
      console.warn('activity alert failed:', err.message);
    }
    return result;
  };
}
