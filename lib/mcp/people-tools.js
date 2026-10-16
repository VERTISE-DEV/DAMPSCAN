/**
 * The owner adding and managing staff from ChatGPT, since the command line
 * (db/create-person.js) needs the production database and the owner does
 * not run it. Admin only, every one of them.
 *
 * A passcode is made here, never chosen in chat: six random digits checked
 * against every existing hash (lib/people-admin.js), stored only as its
 * argon2id hash, and handed back exactly once in the tool's answer for the
 * owner to pass on. It is never in an audit row, a failure note or anything
 * a later call can read back, so a lost one is reset, not recovered.
 */
import { record } from '../audit.js';
import { read, write, fail } from './shared.js';
import { LEVELS, newPasscode, hashPasscode, unknownBusinesses, peopleNamed, describe, createPerson, setGrants, setPasscodeHash, deactivate } from '../people-admin.js';
import { query } from '../db.js';

const refused = () => ({ status: 403, data: { ok: false, error: 'Only an admin can add or change people.' } });
const ONCE = 'Show this passcode to the owner exactly once, so they can give it to the person. Never repeat it, write it into a note, a to-do or a message, or keep it anywhere: if it is lost, use reset_passcode.';

const NAME = { type: 'string', description: 'The person\'s name as they are known, e.g. "Ronnie".' };
const BUSINESSES = { type: 'array', items: { type: 'string', enum: ['dampscan', 'ati-london', 'roofing', 'ac'] }, description: 'dampscan is DampScan, ati-london is ATi Damp Survey, roofing is Verge Roofing, ac is CoolRight.' };
const LEVEL = { type: 'string', enum: LEVELS, description: 'work (default): sees the jobs, the calendar and what needs doing, never money, and can only mark surveys done and reports sent. manage: everything for that business, money included.' };

async function checkBusinesses(businesses) {
  const list = [...new Set((businesses || []).map((b) => String(b).trim()).filter(Boolean))];
  if (!list.length) return { error: 'Give at least one business.' };
  const { unknown, known } = await unknownBusinesses(list);
  if (unknown.length) return { error: `Unknown business: ${unknown.join(', ')}. Known: ${known.join(', ')}.` };
  return { list };
}

/* One active-or-not person by name, or a sentence saying why not. */
async function onePerson(name) {
  const found = await peopleNamed(name);
  if (!found.length) return { error: `Nobody called ${name}. list_people shows everyone.` };
  if (found.length > 1) return { error: `${found.length} people are called ${name}. Rename one in the staff area first.` };
  return { person: found[0] };
}

async function addPerson(scope, { name, businesses, level = 'work', confirm_duplicate: dup = false }) {
  if (!scope.isAdmin) return refused();
  const clean = String(name || '').trim().slice(0, 80);
  if (!clean) return fail('Give the person\'s name.');
  if (!LEVELS.includes(level)) return fail('level is work or manage.');
  const b = await checkBusinesses(businesses);
  if (b.error) return fail(b.error);
  const same = await peopleNamed(clean);
  if (same.length && !dup) return fail(`There is already somebody called ${same[0].name}${same[0].active ? '' : ' (deactivated)'}. To add a second person with that name, ask the owner to confirm and call again with confirm_duplicate true; to change what they hold, use set_person_access.`);
  const passcode = await newPasscode();
  const id = await createPerson({ name: clean, grants: b.list, level, passcodeHash: await hashPasscode(passcode) });
  const after = await describe(id);
  await record({ scope, entity: 'person', entityId: id, action: 'person_create', before: null, after });
  return { status: 200, data: { ok: true, said: `Added ${clean} (${level}) to ${b.list.join(', ')}. Their passcode is ${passcode}.`, person: after, passcode, instruction: ONCE } };
}

async function listPeople(scope) {
  if (!scope.isAdmin) return refused();
  const rows = await query('select id from people order by active desc, lower(name), id');
  return { status: 200, data: { ok: true, people: await Promise.all(rows.map((r) => describe(r.id))) } };
}

async function setAccess(scope, { name, businesses, level = 'work' }) {
  if (!scope.isAdmin) return refused();
  if (!LEVELS.includes(level)) return fail('level is work or manage.');
  const p = await onePerson(name);
  if (p.error) return fail(p.error);
  if (p.person.is_admin) return fail(`${p.person.name} is an admin and holds everything; that is changed on the command line.`);
  const b = await checkBusinesses(businesses);
  if (b.error) return fail(b.error);
  const before = await describe(p.person.id);
  await setGrants(p.person.id, b.list, level);
  const after = await describe(p.person.id);
  await record({ scope, entity: 'person', entityId: p.person.id, action: 'person_access', before, after });
  return { status: 200, data: { ok: true, said: `${p.person.name} now holds ${b.list.join(', ')} at ${level}.`, person: after } };
}

async function deactivatePerson(scope, { name }) {
  if (!scope.isAdmin) return refused();
  const p = await onePerson(name);
  if (p.error) return fail(p.error);
  if (scope.personId != null && Number(p.person.id) === scope.personId) return fail('You cannot deactivate yourself.');
  if (!p.person.active) return fail(`${p.person.name} is already deactivated.`);
  const before = await describe(p.person.id);
  await deactivate(p.person.id);
  await record({ scope, entity: 'person', entityId: p.person.id, action: 'person_deactivate', before, after: await describe(p.person.id) });
  return { status: 200, data: { ok: true, said: `${p.person.name} is deactivated: their passcode and their ChatGPT stop working now.` } };
}

async function resetPasscode(scope, { name }) {
  if (!scope.isAdmin) return refused();
  const p = await onePerson(name);
  if (p.error) return fail(p.error);
  if (!p.person.active) return fail(`${p.person.name} is deactivated. Nothing to reset.`);
  const passcode = await newPasscode();
  await setPasscodeHash(p.person.id, await hashPasscode(passcode));
  /* The row says it happened and by whom; the code itself is never in it. */
  await record({ scope, entity: 'person', entityId: p.person.id, action: 'person_passcode_reset', before: null, after: { id: Number(p.person.id), name: p.person.name } });
  return { status: 200, data: { ok: true, said: `${p.person.name}'s new passcode is ${passcode}. The old one no longer works.`, passcode, instruction: ONCE } };
}

export const PEOPLE_TOOLS = [
  read('list_people', 'List people', 'Admin only. Everyone who can sign in, deactivated people last: name, admin or not, active or not, last sign in, and each business they hold with its level (work or manage). Never a passcode.', {}, listPeople),
  write('add_person', 'Add a person', 'Admin only. Adds a member of staff who signs in with their own six digit passcode, made here at random and unique. level work (default) sees jobs, calendar and what needs doing, never money, and can only mark surveys done and reports sent; manage sees everything for those businesses. The answer holds the passcode once: show it to the owner exactly once and never repeat or store it. Refuses a name already in use unless confirm_duplicate is true after the owner confirms.',
    { name: NAME, businesses: BUSINESSES, level: LEVEL, confirm_duplicate: { type: 'boolean', description: 'Only after the owner confirms a second person with the same name.' } }, ['name', 'businesses'], addPerson),
  write('set_person_access', 'Change what a person holds', 'Admin only. Replaces the businesses a person holds, all at the one level given (work by default). Businesses left out are taken away.',
    { name: NAME, businesses: BUSINESSES, level: LEVEL }, ['name', 'businesses'], setAccess, { idempotent: true }),
  write('deactivate_person', 'Deactivate a person', 'Admin only. Stops a person signing in, on the staff screens and in their own ChatGPT, from now. Their history stays.', { name: NAME }, ['name'], deactivatePerson),
  write('reset_passcode', 'New passcode', 'Admin only. Gives a person a new random six digit passcode; the old one stops working. The answer holds it once: show it to the owner exactly once and never repeat or store it.', { name: NAME }, ['name'], resetPasscode)
];
