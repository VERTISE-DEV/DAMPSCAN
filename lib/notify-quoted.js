/**
 * What a change to a quoted job is worth saying out loud.
 *
 * Given the op and the job before and after, returns the notification to send
 * or null when the change is routine. A cost line is routine: it moves the
 * figure but the working screen is where that is read. A job appearing, a
 * job changing state, money arriving and a payout freezing are the moments
 * the owner wants on a phone.
 *
 * Every message obeys the rule in notify.js: the job is named by the
 * customer's first name and district ("Sarah, BR6"), never more of them.
 */
import { money, customer, day, clock, shortBrand, jobPage } from './alert-words.js';

/* What a status reads as after "is" or "now". */
const STATE = { quoted: 'quoted', booked: 'booked', completed: 'done', paid: 'paid', declined: 'declined', cancelled: 'cancelled' };
const TITLE = { quoted: 'Quoted', booked: 'Booked', completed: 'Job done', paid: 'Paid', declined: 'Declined', cancelled: 'Cancelled' };
const TAG = { quoted: 'clipboard', booked: 'calendar', completed: 'white_check_mark', paid: 'moneybag', declined: 'x', cancelled: 'x' };

/* "Sat 18 Oct at 9:30am", "Sat 18 Oct", or nothing. */
const when = (job) => (job.jobDate ? `${day(job.jobDate)}${job.jobTime ? ` at ${clock(job.jobTime)}` : ''}` : '');
const price = (job) => (Number(job.invoiceNetPence) > 0 ? money(job.invoiceNetPence) : 'no price yet');

/* The sentence for a job now in a state, the same whether it is new or moved. */
function stateLine(who, job) {
  const at = when(job);
  if (job.status === 'booked') return `${who} is booked${at ? ` for ${at}` : ', no date yet'}, ${price(job)}.`;
  if (job.status === 'quoted') return `${who} has been quoted ${price(job)}.`;
  return `${who} is now ${STATE[job.status] || job.status}, ${price(job)}.`;
}

export function quotedEvent(op, business, before, after) {
  const name = business.name;
  const who = customer(after.customerName, after.customerPostcode);
  const path = jobPage(after.site || business.slug, after.id);
  if (op === 'save' && !before) {
    return { kind: 'job_created', tags: TAG[after.status] || 'clipboard', path, title: `${TITLE[after.status] || 'New job'}: ${name}`, message: stateLine(who, after) };
  }
  if ((op === 'save' || op === 'status') && before && before.status !== after.status) {
    return { kind: 'job_status', tags: TAG[after.status] || 'arrows_counterclockwise', path, title: `${TITLE[after.status] || 'Job moved'}: ${name}`, message: stateLine(who, after) };
  }
  if (op === 'payment') {
    const m = after.money;
    const last = after.payments[after.payments.length - 1];
    const amount = last ? money(last.amountPence) : 'A payment';
    const head = `${amount} from ${who} (${shortBrand(name)}).`;
    if (m.paidInFull) {
      return { kind: 'payment', tags: 'tada', path, title: `Paid in full: ${name}`, message: `${who} has paid in full, ${money(m.receivedPence)}. Last payment ${amount}.` };
    }
    /* A payment can land before the job has a price, so never report a minus figure still to come. */
    const rest = !m.invoicePence ? 'No price on the job yet.'
      : m.outstandingPence < 0 ? `${money(-m.outstandingPence)} more than the price.`
      : `${money(m.outstandingPence)} left to pay.`;
    return { kind: 'payment', tags: 'moneybag', path, title: `Payment in: ${name}`, message: `${head} ${rest}` };
  }
  if (op === 'freeze' && after.frozen) {
    const total = after.frozen.rows.reduce((s, r) => s + r.amountPence, 0);
    const people = after.frozen.rows.length;
    return {
      kind: 'payout_frozen', tags: 'lock', path, title: `Payout locked: ${name}`,
      message: `${who}: ${money(total)} to pay out to ${people} ${people === 1 ? 'person' : 'people'}.`
    };
  }
  if (op === 'unfreeze') {
    return { kind: 'payout_reopened', tags: 'unlock', path, title: `Payout reopened: ${name}`, message: `${who} is open for changes again. Open the job to see why.` };
  }
  return null;
}
