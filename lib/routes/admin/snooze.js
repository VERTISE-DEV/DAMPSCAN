/**
 * /api/admin/snooze
 *
 *   POST    {kind, ref, until}   hide one action item from my Today until that day
 *   DELETE  {kind, ref}          bring it back (the Undo on the toast)
 *
 * An item is its group and id in lib/work.js ("payments", "123"). Snoozes are
 * per person, so putting a chase off till next week hides it from my list
 * and nobody else's. The calendar route drops snoozed items before it
 * answers; the assistant's what_needs_doing is not filtered, on purpose, so
 * asking still tells the whole truth.
 */
import { query } from '../../db.js';
import { json, requireMethod, readJson, str } from '../../http.js';
import { requireScope } from '../../access.js';
import { londonToday } from '../../pipeline.js';

export const config = { runtime: 'nodejs' };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KIND = /^[a-z]{2,20}$/;
const keyOf = (scope) => scope.personId || 0;

/** "kind-ref" for each item this person has snoozed past today. */
export async function snoozedFor(scope, today = londonToday()) {
  const rows = await query('select kind, ref from action_snoozes where person_key = $1 and until_on > $2::date', [keyOf(scope), today]);
  return new Set(rows.map((r) => `${r.kind}-${r.ref}`));
}

/** The work list without what this person has snoozed, counts and total redone. */
export function withoutSnoozed(work, hidden) {
  if (!hidden.size) return work;
  const groups = work.groups.map((g) => {
    const items = g.items.filter((i) => !hidden.has(`${g.key}-${i.id}`));
    return { ...g, items, count: items.length };
  }).filter((g) => g.count);
  return { ...work, groups, total: groups.reduce((s, g) => s + g.count, 0) };
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST', 'DELETE'])) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  const body = await readJson(req);
  const kind = str(body.kind, 20);
  const ref = str(String(body.ref ?? ''), 40);
  if (!KIND.test(kind || '') || !ref) return json(res, 400, { ok: false, error: 'bad_item' });
  try {
    if (req.method === 'DELETE') {
      await query('delete from action_snoozes where kind = $1 and ref = $2 and person_key = $3', [kind, ref, keyOf(scope)]);
      return json(res, 200, { ok: true });
    }
    const until = str(body.until, 10);
    if (!DATE.test(until || '') || until <= londonToday()) return json(res, 400, { ok: false, error: 'bad_date', message: 'Snooze to a day after today.' });
    await query(
      `insert into action_snoozes (kind, ref, person_key, until_on) values ($1, $2, $3, $4::date)
       on conflict (kind, ref, person_key) do update set until_on = excluded.until_on, created_at = now()`, [kind, ref, keyOf(scope), until]);
    return json(res, 200, { ok: true, until });
  } catch (err) {
    console.error('snooze request failed:', err.message);
    return json(res, 500, { ok: false, error: 'snooze_failed' });
  }
}
