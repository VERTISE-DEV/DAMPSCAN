/**
 * Moving a quoted-trade job along, and the messages that go with each step.
 *
 * Two ops for /api/admin/quoted, kept here so that route stays readable:
 *   status   {id, status, jobDate?, jobTime?}  quoted, booked, completed, declined
 *                                        or cancelled; paid only comes from
 *                                        the freeze, which checks the money
 *   message  {id, kind, channel}         records that a message was tapped
 *                                        to send; see lib/messages.js
 *
 * The board drags a card with the first, and every message button on the
 * Due list and the job screen calls the second.
 */
import { query } from './db.js';
import { str } from './http.js';
import { MESSAGE_KINDS, CHANNELS, messageFor, dueMessage } from './messages.js';

export const PIPELINE_OPS = new Set(['status', 'message']);
const MOVABLE = ['quoted', 'booked', 'completed', 'declined', 'cancelled'];

/** Today in London, as YYYY-MM-DD, which is the day a customer lives in. */
export const londonToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

export async function loadMessages(jobId) {
  return query('select kind, channel, sent_at from job_messages where job_id = $1 order by sent_at, id', [jobId]);
}

/**
 * The messages block of a presented job: what has gone, each message ready
 * to send now, and the one the Due list is waiting on.
 */
export function presentMessages(job, rows, today = londonToday()) {
  const sent = rows.map((r) => ({ kind: r.kind, channel: r.channel, sentAt: r.sent_at }));
  const followups = sent.filter((m) => m.kind === 'followup').length;
  return {
    sent,
    /* Each message belongs to a stage: chasing a quote on a booked job, or
       asking a quoted customer for a review, would read as a mistake. The
       quote itself can always be sent again. */
    ready: {
      quote: messageFor('quote', job),
      followup: job.status === 'quoted' ? messageFor('followup', job, Math.min(followups + 1, 2)) : null,
      reminder: job.status === 'booked' ? messageFor('reminder', job) : null,
      review: job.status === 'completed' || job.status === 'paid' ? messageFor('review', job) : null,
      invoice: messageFor('invoice', job)
    },
    due: dueMessage(job, sent, today)
  };
}

const fail = (json, res, key, message) => { json(res, 400, { ok: false, errors: { [key]: message } }); return false; };

/** One pipeline change. True when made; false when a 400 has been sent. */
export async function pipelineOp({ op, job, body, scope, res, json }) {
  if (op === 'status') {
    if (!MOVABLE.includes(body.status)) return fail(json, res, 'status', 'That is not a stage a job can be moved to.');
    if (job.payout_frozen_at || job.status === 'paid' || job.status === 'refunded') {
      return fail(json, res, 'status', 'This job is paid and its payout is frozen, so its stage cannot move from here.');
    }
    const jobDate = str(body.jobDate, 10) || null;
    if (jobDate && !/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) return fail(json, res, 'jobDate', 'Enter a date as YYYY-MM-DD.');
    const jobTime = str(body.jobTime, 5) || null;
    if (jobTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(jobTime)) return fail(json, res, 'jobTime', 'Enter a time as HH:MM.');
    await query('update jobs set status = $2, job_date = coalesce($3::date, job_date), job_time = coalesce($4::time, job_time), updated_at = now() where id = $1',
      [job.id, body.status, jobDate, jobTime]);
    return true;
  }
  if (op === 'message') {
    if (!MESSAGE_KINDS.includes(body.kind) || !CHANNELS.includes(body.channel)) return fail(json, res, 'message', 'Unknown message or channel.');
    await query('insert into job_messages (job_id, kind, channel, sent_by) values ($1, $2, $3, $4)', [job.id, body.kind, body.channel, scope.personId]);
    /* The follow-ups count from the first time the quote went. */
    if (body.kind === 'quote') await query('update jobs set quote_sent_at = coalesce(quote_sent_at, now()) where id = $1', [job.id]);
    return true;
  }
  return fail(json, res, 'op', 'Unknown change.');
}
