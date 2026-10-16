/**
 * Adding people, changing what they hold, and their passcodes: the one copy
 * of the rules, used by the command line (db/create-person.js) and by the
 * owner's assistant (lib/mcp/people-tools.js).
 *
 * The passcode is the identity, so it must be unique across people: two
 * people with the same six digits would be one login. Hashes cannot be
 * compared with each other, so uniqueness is checked by verifying the new
 * passcode against every existing hash. Only the argon2id hash is stored.
 */
import { randomInt } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { query, queryOne } from './db.js';

export const LEVELS = ['work', 'manage'];

/** The person already using this passcode, or null. */
export async function passcodeInUse(passcode, { exceptId = null } = {}) {
  const existing = await query('select id, name, passcode_hash from people');
  for (const p of existing) {
    if (exceptId != null && Number(p.id) === Number(exceptId)) continue;
    if (await verify(p.passcode_hash, passcode)) return { id: Number(p.id), name: p.name };
  }
  return null;
}

export const hashPasscode = (passcode) => hash(passcode, { algorithm: Algorithm.Argon2id });

/** Six random digits nobody else has, from the system's secure generator. */
export async function newPasscode() {
  for (let i = 0; i < 25; i += 1) {
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    if (!(await passcodeInUse(code))) return code;
  }
  throw new Error('Could not find an unused passcode.');
}

/** Slugs that are not active businesses, so a typo is refused, not stored. */
export async function unknownBusinesses(slugs) {
  const known = (await query('select slug from businesses where active')).map((r) => r.slug);
  return { known, unknown: slugs.filter((g) => !known.includes(g)) };
}

/** Everyone with that name, ignoring case and spaces at the ends. */
export function peopleNamed(name) {
  return query('select id, name, is_admin, active from people where lower(trim(name)) = lower(trim($1)) order by id', [String(name || '')]);
}

/** A person as the owner reads them: never anything about the passcode. */
export async function describe(id) {
  const p = await queryOne('select id, name, is_admin, active, created_at, last_login_at from people where id = $1', [id]);
  if (!p) return null;
  const grants = await query('select business_slug, level from grants where person_id = $1 order by business_slug', [id]);
  return { id: Number(p.id), name: p.name, isAdmin: Boolean(p.is_admin), active: Boolean(p.active), createdAt: p.created_at,
    lastLoginAt: p.last_login_at, businesses: grants.map((g) => ({ slug: g.business_slug, level: g.level })) };
}

export async function createPerson({ name, grants, level = 'work', isAdmin = false, ratePence = 0, passcodeHash }) {
  const person = await queryOne(
    'insert into people (name, passcode_hash, is_admin, hourly_rate_pence) values ($1, $2, $3, $4) returning id',
    [name, passcodeHash, isAdmin, ratePence]
  );
  await setGrants(person.id, grants, isAdmin ? 'manage' : level);
  return Number(person.id);
}

/** Replaces what a person holds with exactly these businesses at this level. */
export async function setGrants(personId, grants, level) {
  await query('delete from grants where person_id = $1 and not (business_slug = any($2::text[]))', [personId, grants]);
  for (const slug of grants) {
    await query(
      `insert into grants (person_id, business_slug, level) values ($1, $2, $3)
       on conflict (person_id, business_slug) do update set level = excluded.level`,
      [personId, slug, level]
    );
  }
}

export async function setPasscodeHash(personId, passcodeHash) {
  await query('update people set passcode_hash = $2 where id = $1', [personId, passcodeHash]);
}

/* Scope is read from people on every request, so their browser session and
   their assistant stop working on the next click; nothing else to revoke. */
export async function deactivate(personId) {
  await query('update people set active = false where id = $1', [personId]);
}
