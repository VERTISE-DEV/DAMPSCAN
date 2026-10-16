/**
 * Who is making the current request, for the rows written while it runs.
 *
 * A notification is written deep inside a route (a payment, a moved job) by
 * code that was never handed the person's scope, and threading it through
 * every call would touch dozens of files. So the request carries it: the
 * route wrapper opens a store, requireScope fills it once it knows the person,
 * and notify() and record() read it. catch_up then knows who did what, and
 * can leave out a person's own changes.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export const actorStore = new AsyncLocalStorage();

/** Notes the person once they are known. Does nothing outside a request. */
export function noteActor(scope) {
  const s = actorStore.getStore();
  if (s && scope) s.scope = scope;
}

/* The shared owners' code has no people row, so the owners share one key. */
export const actorKey = (scope) => (scope.personId != null ? String(scope.personId) : 'owners');

/** "Tom", "ChatGPT via Tom", or nulls when nobody is signed in (the website, a cron). */
export function currentActor(scope = actorStore.getStore() && actorStore.getStore().scope) {
  if (!scope) return { key: null, name: null };
  const name = scope.name || 'The owners';
  return { key: actorKey(scope), name: scope.viaAssistant ? `ChatGPT via ${name}` : name };
}
