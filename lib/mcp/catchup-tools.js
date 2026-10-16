/**
 * catch_up: "what's happened since I last checked?"
 *
 * Each person has their own bookmark (lib/catch-up.js keeps it in catchups),
 * so a morning "catch me up" covers exactly what they have not heard yet, and
 * asking twice in a row says nothing new the second time. peek looks without
 * moving the bookmark, and since looks further back on request.
 */
import { digest, parseSince, lastCatchUp, markCaughtUp } from '../catch-up.js';
import { read, fail } from './shared.js';

const DAY = 86400000;

async function catchUp(scope, { since, include_mine: includeMine = false, peek = false } = {}) {
  const until = new Date();
  let from;
  if (since != null && String(since).trim()) {
    from = parseSince(since, until);
    if (!from) return fail('since should be "yesterday", "today", a number of hours, a number of days ("3 days") or a date (YYYY-MM-DD).');
  } else {
    from = (await lastCatchUp(scope)) || new Date(until.getTime() - DAY);
  }
  const out = await digest(scope, { since: from, until, includeMine: Boolean(includeMine) });
  if (!peek) await markCaughtUp(scope, until);
  return { status: 200, data: { ok: true, said: out.summary, ...out, peek: Boolean(peek),
    tip: 'Say the summary first, then each group in a sentence or two, naming who did what for which customer and when. Offer to open any of them.' } };
}

/* A read for the assistant (it changes no work), though it moves the person's own bookmark. */
export const CATCHUP_TOOLS = [
  read('catch_up', 'Catch me up', 'What has happened in the person\'s businesses since they last asked: new enquiries, bookings and moves, payments and ticks, reports sent, quotes and invoices, deletions and closures, to-dos set for them by others, and anything else, each saying who did it (a person, "ChatGPT via" a person, or the website), for which customer and when. Leaves out their own changes unless include_mine. The first time covers the last 24 hours. since overrides: "yesterday", "today", hours ("12"), days ("3 days") or a date. peek true looks without marking it as caught up.',
    { since: { type: 'string', description: '"yesterday", "today", a number of hours, "N days" or YYYY-MM-DD. Leave out for since the last catch up.' },
      include_mine: { type: 'boolean', description: 'Include the person\'s own changes too.' },
      peek: { type: 'boolean', description: 'true to look without moving the "last checked" mark.' } },
    catchUp)
];
