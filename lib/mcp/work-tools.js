/**
 * Assistant tools for the rest of the day's work: customer messages, the
 * job's page on the website and its Google post, matching bank payments, and
 * the short answers to "how are we doing" that Insights and Due already hold.
 *
 * Messages are never sent from here. As on the screen, a message is words
 * plus WhatsApp, text and email links that open on the person's own phone;
 * the assistant shows them, the person taps one, and mark_message_sent
 * records it so the Due list moves on.
 */
import { present } from '../quoted.js';
import { forViewer } from '../profit.js';
import { onMyWay } from '../job-time.js';
import { ON_MY_WAY_MINUTES, CHANNELS } from '../messages.js';
import { record } from '../audit.js';
import quoted from '../routes/admin/quoted.js';
import photos from '../routes/admin/photos.js';
import bank from '../routes/admin/bank.js';
import insights from '../routes/admin/insights.js';
import due from '../routes/admin/due.js';
import { callRoute, qs, read, write, fail, notFound, jobInScope, AREA, SITE, ID } from './shared.js';

const KINDS = ['onmyway', 'rating', 'followup', 'reminder', 'invoice', 'yearly', 'quote', 'review'];
const BOOKS = { type: 'string', enum: ['damp', 'roofing', 'ac'], description: 'Whose bank account. Default damp.' };

async function quotedJob(scope, id) {
  const found = await jobInScope(scope, id);
  if (!found) return { error: notFound() };
  if (found.business.payout_model === 'damp') return { error: fail('Customer messages, pages and posts are for Verge Roofing and CoolRight jobs.') };
  return found;
}

async function getMessage(scope, { id, kind, minutes }) {
  const found = await quotedJob(scope, id);
  if (found.error) return found.error;
  const job = forViewer(await present(found.job, found.business), scope, onMyWay);
  let msg;
  if (kind === 'onmyway') {
    const m = ON_MY_WAY_MINUTES.includes(Number(minutes)) ? Number(minutes) : ON_MY_WAY_MINUTES.reduce((a, b) => (Math.abs(b - Number(minutes || 20)) < Math.abs(a - Number(minutes || 20)) ? b : a));
    msg = job.onMyWay && job.onMyWay[m];
  } else {
    msg = job.messages.ready[kind];
  }
  if (!msg) return fail(`There is no ${kind} message for job #${id} at this stage (it is ${job.status}).`);
  return { status: 200, data: { ok: true, id, kind, subject: msg.subject, words: msg.text, links: msg.links,
    tip: 'Show the person these links to tap. Once they have sent it, call mark_message_sent with the channel used.' } };
}

async function markSent(scope, { id, kind, channel }) {
  const found = await quotedJob(scope, id);
  if (found.error) return found.error;
  return callRoute(quoted, scope, { method: 'POST', url: '/api/admin/quoted', body: { op: 'message', id, kind, channel } });
}

async function setPage(scope, { id, title, town, writeup, publish }) {
  const found = await quotedJob(scope, id);
  if (found.error) return found.error;
  return callRoute(photos, scope, { method: 'POST', url: '/api/admin/photos', body: { op: 'page', job: id, title, town, writeup, publish: publish === true } });
}

async function googlePost(scope, { id }) {
  const found = await quotedJob(scope, id);
  if (found.error) return found.error;
  const r = await callRoute(photos, scope, { url: '/api/admin/photos?job=' + id });
  if (r.status !== 200) return r;
  const page = r.data.page;
  if (!page.googlePost) return { status: 200, data: { ok: false, error: 'The page is not live yet, so there is no post.', problems: page.problems } };
  return { status: 200, data: { ok: true, id, post: page.googlePost, pageUrl: page.url } };
}

async function unmatched(scope, { books = 'damp', from }) {
  const r = await callRoute(bank, scope, { url: '/api/admin/bank' + qs({ books, view: 'in', from }, ['books', 'view', 'from']) });
  if (r.status !== 200) return r;
  const lines = r.data.transactions.filter((t) => t.amountPence > 0 && t.jobId == null && !(t.split || []).length)
    .map(({ id, postedOn, description, reference, counterparty, amountPence }) => ({ id, postedOn, description, reference, counterparty, amountPence }));
  return { status: 200, data: { ok: true, books, payments: lines, jobs: r.data.jobs } };
}

async function matchPayment(scope, { transaction_id: id, job_id: jobId, books = 'damp' }) {
  const found = await jobInScope(scope, jobId);
  if (!found) return notFound();
  const r = await callRoute(bank, scope, { method: 'POST', url: '/api/admin/bank?books=' + encodeURIComponent(books), body: { id, jobId } });
  /* The bank screen keeps no trail of its own; a change made by an
     assistant does, so "who matched that" has an answer. */
  if (r.status === 200) await record({ scope, business: found.job.site, entity: 'bank_transaction', entityId: id, action: 'assistant_match', before: null, after: { jobId } });
  return r;
}

const insightsPart = (pick) => async (scope, args) => {
  const r = await callRoute(insights, scope, { url: '/api/admin/insights' + qs(args, ['area', 'site']) });
  return r.status === 200 ? { status: 200, data: { ok: true, ...pick(r.data) } } : r;
};

async function dueToday(scope, args) {
  const r = await callRoute(due, scope, { url: '/api/admin/due' + qs(args, ['area', 'site']) });
  return r.status === 200 ? { status: 200, data: { ok: true, messages: r.data.messages } } : r;
}

const Q = { area: AREA, site: SITE };
export const WORK_TOOLS = [
  read('get_message', 'Customer message', 'The words of one customer message for a Verge or CoolRight job, with WhatsApp, text and email links the person can tap to send it from their own phone. Kinds: onmyway (with minutes), rating, followup, reminder, invoice, yearly, quote, review.',
    { id: ID, kind: { type: 'string', enum: KINDS }, minutes: { type: 'integer', description: `On my way only: ${ON_MY_WAY_MINUTES.join(', ')}.` } }, getMessage),
  write('mark_message_sent', 'Mark message sent', 'Records that a customer message was sent, so the Due list stops asking for it.',
    { id: ID, kind: { type: 'string', enum: KINDS.concat('service') }, channel: { type: 'string', enum: CHANNELS } }, ['id', 'kind', 'channel'], markSent),
  write('set_project_page', 'Project page', 'Saves the job\'s own page on the website (title, town, write-up) and publishes it if publish is true. Publishing is refused with the reasons until the job is finished, has public photos and enough words; never put the customer\'s name or street in it.',
    { id: ID, title: { type: 'string' }, town: { type: 'string' }, writeup: { type: 'string' }, publish: { type: 'boolean' } }, ['id'], setPage),
  read('get_google_post', 'Google post', 'The ready-made Google Business Profile post for a job whose page is live, with the page link.', { id: ID }, googlePost),
  read('list_unmatched_payments', 'Unmatched payments', 'Money in on the bank statement not yet matched to a job, with the jobs it could belong to. Admin only.', { books: BOOKS, from: { type: 'string', description: 'YYYY-MM-DD' } }, unmatched),
  write('match_payment', 'Match a payment', 'Matches a bank payment to a job, which records the money on that job. Admin only.',
    { transaction_id: { type: 'integer' }, job_id: ID, books: BOOKS }, ['transaction_id', 'job_id'], matchPayment, { idempotent: true }),
  read('insights_summary', 'How are we doing', 'Money this month and last (managers only), the ninety-day win rate and average job, and the last two months.', Q,
    insightsPart((d) => ({ money: d.money, funnel: d.funnel, months: (d.months || []).slice(-2) }))),
  read('ratings', 'Ratings', 'Customers\' stars from the last year: the average, how many, and the low ones with what they said.', Q, insightsPart((d) => ({ ratings: d.ratings }))),
  read('over_budget_jobs', 'Over budget jobs', 'Verge and CoolRight jobs whose costs and labour have passed the set share of the price. Managers only.', Q,
    insightsPart((d) => ({ overBudget: d.overBudget, overBudgetBp: d.overBudgetBp }))),
  read('pages_to_write', 'Pages to write', 'The postcode districts enquiries come from that have no area page on the website yet, busiest first.', Q, insightsPart((d) => ({ pagesToWrite: d.pagesToWrite }))),
  read('due_messages_today', 'Messages due today', 'Customer messages waiting to go today (follow-ups, reminders, rating asks, yearly checks), each with its words and links.', Q, dueToday)
];
