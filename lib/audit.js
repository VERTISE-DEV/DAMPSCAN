/**
 * The audit trail.
 *
 * One row per write to something that matters: a payout, a paid tick, a job's
 * price, a client's date. The before and after are stored whole rather than as
 * a diff, because a year later the question is "what did this say before" and
 * a diff answers "what changed" instead.
 *
 * Failures are logged and swallowed. An audit row that cannot be written must
 * not stop the write it describes, or the staff area goes down the first time
 * the table has a problem. That is a deliberate choice and it is worth knowing
 * about: the trail is best effort, the write is not.
 */
import { query } from './db.js';
import { currentActor } from './actor.js';

export async function record({ scope, business, entity, entityId, action, before, after }) {
  /* Who, as catch_up says it: the scope given, else whoever this request is for. */
  const who = scope ? currentActor(scope) : currentActor();
  try {
    await query(
      `insert into audit (person_id, business_slug, entity, entity_id, action, before_json, after_json, actor_key, actor_name)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
      [
        scope && scope.personId != null ? scope.personId : null,
        business || null,
        entity,
        entityId == null ? null : Number(entityId),
        action,
        before === undefined ? null : JSON.stringify(before),
        after === undefined ? null : JSON.stringify(after),
        who.key, who.name
      ]
    );
  } catch (err) {
    console.warn('audit write failed:', err.message);
  }
}
