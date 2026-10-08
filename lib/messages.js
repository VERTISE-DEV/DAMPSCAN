/**
 * The messages a quoted-trade job sends its customer, and when each is due.
 *
 * Nothing here sends anything. Each message is words plus three links, a
 * WhatsApp chat, a text and an email, that open on the staff member's own
 * phone with the words already in. They read it, tap send, and the tap is
 * recorded so the Due list moves on. That keeps every message coming from a
 * number the customer already knows, and keeps any message provider out of it.
 *
 * Kinds, in the order a job meets them:
 *   quote      the customer's link to their printable quote
 *   followup   three days after the quote went, and again at seven
 *   reminder   the day before the work starts
 *   review     a direct link to the Business Profile, kept for staff to use
 *   rating     once the job is finished, the "how did we do" page, chased
 *              once a week later if no stars came back
 *   yearly     about eleven months after the work, time for its yearly check,
 *              unless the customer is on a maintenance plan already
 *   onmyway    staff leaving for the job, with roughly how long they will be
 */
import { brandFor } from './brands.js';

export const MESSAGE_KINDS = ['quote', 'followup', 'reminder', 'review', 'invoice', 'service', 'rating', 'yearly', 'onmyway'];
/* A week with no stars earns one gentle chase, and only one. */
export const RATING_CHASE_DAYS = 7;
export const RATING_WINDOW_DAYS = 60;
/* The yearly check falls due in the last month of each year since the work:
   from day 335 to the anniversary, then again a year on. */
export const YEARLY_FROM_DAY = 335;
/* The trades that sell a yearly check; a damp survey has nothing to revisit. */
export const YEARLY_SITES = ['roofing', 'ac'];
export const ON_MY_WAY_MINUTES = [10, 20, 30, 45, 60];
export const CHANNELS = ['whatsapp', 'sms', 'email'];
/* Days after the quote went that each follow-up falls due. Two, then stop:
   a third chaser is the point where a customer stops answering the phone. */
export const FOLLOWUP_DAYS = [3, 7];

/** A UK mobile as 447..., the form wa.me and sms: both take, or null. */
export function mobileFor(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0044')) d = d.slice(2);
  if (d.startsWith('07')) d = '44' + d.slice(1);
  return /^447\d{9}$/.test(d) ? d : null;
}

const clean = (w) => String(w || '').replace(/[^\p{L}'-]/gu, '');
const TITLES = /^(mr|mrs|ms|miss|mx|dr)\.?$/i;
/* "Mrs Anita Patel" is greeted as Mrs Patel, the way she wrote her name;
   "Anita Patel" as Anita. A title alone, or nothing usable, is "Hello". */
export function greeting(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && TITLES.test(words[0])) return `Hi ${clean(words[0])} ${clean(words[words.length - 1])},`;
  const first = words.length && !TITLES.test(words[0]) ? clean(words[0]) : '';
  return first ? `Hi ${first},` : 'Hello,';
}
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** The words for one message, or null when the job cannot send it yet. */
export function wordsFor(kind, job, followupNumber = 1) {
  const brand = brandFor(job.site);
  if (!brand) return null;
  const sign = `Thanks, ${brand.name}, ${brand.phoneLabel}`;
  const url = job.quoteUrl;
  if (kind === 'quote') {
    if (!url) return null;
    return { subject: `Your quote from ${brand.name}`,
      text: `${greeting(job.customerName)} here is your quote from ${brand.name}. It sets out the work and the price, and you can print it or save it as a PDF: ${url}\n\nAny questions at all, just reply or give us a call.\n\n${sign}` };
  }
  if (kind === 'followup') {
    const body = followupNumber > 1
      ? 'just a last check on the quote we sent. If the timing is not right or you have gone another way, that is no problem at all, a quick reply saves us chasing you.'
      : 'just checking the quote we sent came through, and whether you have any questions about it. Happy to go through it with you.';
    return { subject: `Your quote from ${brand.name}`,
      text: `${greeting(job.customerName)} ${body}${url ? `\n\nHere it is again: ${url}` : ''}\n\n${sign}` };
  }
  if (kind === 'reminder') {
    if (!job.jobDate) return null;
    const when = `${longDate(job.jobDate)}${job.jobTime ? ` at ${job.jobTime}` : ''}`;
    return { subject: `${brand.name}: see you ${longDate(job.jobDate)}`,
      text: `${greeting(job.customerName)} a reminder that we are booked with you on ${when}${job.customerPostcode ? ` at ${job.customerPostcode}` : ''}. If anything has changed, just reply or give us a call.\n\n${sign}` };
  }
  if (kind === 'invoice') {
    if (!job.invoiceUrl) return null;
    return { subject: `Invoice ${job.invoiceNumber} from ${brand.name}`,
      text: `${greeting(job.customerName)} thank you again for having us. Here is your invoice, ${job.invoiceNumber}, which you can print or save as a PDF: ${job.invoiceUrl}\n\nAny questions about it, just reply or give us a call.\n\n${sign}` };
  }
  if (kind === 'service') {
    if (!job.serviceDueOn) return null;
    const what = job.site === 'roofing' ? 'your yearly roof and gutter check' : 'your air conditioning service';
    const month = new Date(`${job.serviceDueOn}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { subject: `${brand.name}: ${what} is due`,
      text: `${greeting(job.customerName)} ${what} is due in ${month}. Let us know a day or two that suit you and we will book it in.\n\n${sign}` };
  }
  if (kind === 'rating') {
    if (!job.ratingUrl) return null;
    const body = followupNumber > 1
      ? `just a gentle nudge in case it got buried: if you have ten seconds, we would love to know how we did.`
      : `thank you for choosing ${brand.name}. How did we do? It is one tap to tell us: pick a number of stars.`;
    return { subject: `How did we do? ${brand.name}`, text: `${greeting(job.customerName)} ${body} ${job.ratingUrl}\n\n${sign}` };
  }
  if (kind === 'yearly') {
    const what = job.site === 'roofing'
      ? 'it is nearly a year since we worked on your roof. A quick yearly check of the roof and gutters catches small problems before they let water in.'
      : 'it is nearly a year since we fitted or serviced your air conditioning, so it is due its yearly service to keep it efficient and the warranty in order.';
    return { subject: `${brand.name}: time for your yearly check`,
      text: `${greeting(job.customerName)} ${what} Let us know a day or two that suit you and we will book it in.\n\n${sign}` };
  }
  if (kind === 'onmyway') {
    const who = String(job.staffName || '').trim().split(/\s+/)[0];
    const mins = ON_MY_WAY_MINUTES.includes(Number(job.minutes)) ? Number(job.minutes) : 20;
    return { subject: `${brand.name}: on my way`,
      text: `${greeting(job.customerName)} it's ${who ? `${who} from ` : ''}${brand.name}, on my way, about ${mins} minutes.` };
  }
  if (kind === 'review') {
    if (!brand.reviewUrl) return null;
    return { subject: `Thank you from ${brand.name}`,
      text: `${greeting(job.customerName)} thank you for choosing ${brand.name}. If you are happy with the work, a short Google review would help us a great deal: ${brand.reviewUrl}\n\n${sign}` };
  }
  return null;
}

/** The three ways to send some words, each null where the job has no number or address. */
export function linksFor(words, phone, email) {
  const mobile = mobileFor(phone);
  const enc = encodeURIComponent;
  return {
    whatsapp: mobile ? `https://wa.me/${mobile}?text=${enc(words.text)}` : null,
    /* "?&body=" is the one form both iPhone and Android Messages read. */
    sms: mobile ? `sms:+${mobile}?&body=${enc(words.text)}` : null,
    email: email ? `mailto:${encodeURIComponent(email)}?subject=${enc(words.subject)}&body=${enc(words.text)}` : null
  };
}

/** One message, ready to show: kind, words and links, or null. */
export function messageFor(kind, job, followupNumber) {
  const words = wordsFor(kind, job, followupNumber);
  if (!words) return null;
  return { kind, followupNumber: kind === 'followup' || kind === 'rating' ? followupNumber : undefined, ...words, links: linksFor(words, job.customerPhone, job.customerEmail) };
}

const DAY = 86400000;
const dayOf = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Which message, if any, this job is waiting on today.
 *
 * `sent` is the job's message rows. `today` is a YYYY-MM-DD in London. A job
 * waits on at most one message: the earliest one that is due and not sent.
 */
export function dueMessage(job, sent, today) {
  const count = (kind, after) => sent.filter((m) => m.kind === kind && (!after || new Date(m.sentAt) >= new Date(after))).length;
  if (job.status === 'quoted' && job.quoteSentAt) {
    const age = Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${dayOf(job.quoteSentAt)}T12:00:00Z`)) / DAY);
    const done = count('followup', job.quoteSentAt);
    if (done < FOLLOWUP_DAYS.length && age >= FOLLOWUP_DAYS[done]) return messageFor('followup', job, done + 1);
  }
  if (job.status === 'booked' && job.jobDate) {
    const tomorrow = dayOf(Date.parse(`${today}T12:00:00Z`) + DAY);
    /* A reminder sent in the last three days covers this booking; a job moved
       to a new date a week later earns a fresh one. */
    const recent = sent.some((m) => m.kind === 'reminder' && Date.parse(`${today}T12:00:00Z`) - Date.parse(m.sentAt) < 3 * DAY);
    if (job.jobDate === tomorrow && !recent) return messageFor('reminder', job);
  }
  if (job.status !== 'completed' && job.status !== 'paid') return null;
  const yearly = yearlyDue(job, sent, today);
  if (yearly) return yearly;
  /* A review link sent by hand already asked; asking for stars as well would nag. */
  if (count('review')) return null;
  if (!job.ratingUrl) return messageFor('review', job);
  if (job.rated) return null;
  /* Asking how a job went a season later reads as an afterthought. */
  if (job.jobDate && Date.parse(`${today}T12:00:00Z`) - Date.parse(`${job.jobDate}T12:00:00Z`) > RATING_WINDOW_DAYS * DAY) return null;
  const asks = sent.filter((m) => m.kind === 'rating').map((m) => Date.parse(m.sentAt)).sort((a, b) => a - b);
  if (!asks.length) return messageFor('rating', job, 1);
  if (asks.length === 1 && Date.parse(`${today}T23:59:59Z`) - asks[0] >= RATING_CHASE_DAYS * DAY) return messageFor('rating', job, 2);
  return null;
}

/** The yearly check, if this job is in the last month of a year since the work. */
function yearlyDue(job, sent, today) {
  if (!YEARLY_SITES.includes(job.site) || !job.jobDate || job.onPlan) return null;
  const age = Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${job.jobDate}T12:00:00Z`)) / DAY);
  if (age < YEARLY_FROM_DAY || age % 365 < YEARLY_FROM_DAY) return null;
  /* One ask per year: anything sent in the last three months covers it. */
  const recent = sent.some((m) => m.kind === 'yearly' && Date.parse(`${today}T12:00:00Z`) - Date.parse(m.sentAt) < 90 * DAY);
  return recent ? null : messageFor('yearly', job);
}
