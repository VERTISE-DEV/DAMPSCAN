#!/usr/bin/env node
/**
 * Creates a person who can sign in to the staff area with their own passcode.
 *
 *   npm run create-person -- --name="Steve" --grants=roofing
 *   npm run create-person -- --name="Ben" --grants=dampscan,ati-london,roofing
 *   npm run create-person -- --name="Scott" --admin --grants=dampscan,ati-london,roofing,ac
 *   npm run create-person -- --name="Dan" --grants=roofing --rate=18.50
 *
 * --rate is the hourly rate in pounds that prices their clocked time on a
 * job. It can be changed later on any job screen by whoever manages it.
 *
 * The passcode is prompted for and never passed on the command line, where it
 * would sit in shell history. It is hashed with argon2id and only the hash is
 * stored.
 *
 * The passcode is the identity, so it must be unique across people: two people
 * with the same six digits would be one login. That is checked here against
 * every existing hash, which is the only place it can be, since the hashes
 * cannot be compared to each other.
 */
import 'dotenv/config';
import { passcodeInUse, hashPasscode, unknownBusinesses, createPerson } from '../lib/people-admin.js';
import { ask, askHidden, parseArgs } from './prompt.js';

const MIN_LENGTH = 6;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const name = (args.name || (await ask('Name: '))).trim();
  if (!name) {
    console.error('A name is required.');
    process.exit(1);
  }

  const grants = String(args.grants || (await ask('Businesses, comma separated (dampscan, ati-london, roofing, ac): ')))
    .split(',').map((g) => g.trim()).filter(Boolean);
  const { known, unknown } = await unknownBusinesses(grants);
  if (unknown.length) {
    console.error(`Unknown business: ${unknown.join(', ')}. Known: ${known.join(', ')}`);
    process.exit(1);
  }
  const isAdmin = Boolean(args.admin);
  if (!grants.length && !isAdmin) {
    console.error('A person with no businesses and no admin flag could sign in and see nothing. Refusing.');
    process.exit(1);
  }

  const passcode = await askHidden(`Passcode (${MIN_LENGTH} characters or more, not shown): `);
  if (passcode.length < MIN_LENGTH) {
    console.error(`Passcode must be ${MIN_LENGTH} characters or more.`);
    process.exit(1);
  }
  const again = await askHidden('Confirm passcode: ');
  if (passcode !== again) {
    console.error('Passcodes did not match.');
    process.exit(1);
  }

  /* Uniqueness, shared with the assistant's add_person (lib/people-admin.js). */
  const taken = await passcodeInUse(passcode);
  if (taken) {
    console.error(`That passcode is already in use by ${taken.name} (id ${taken.id}). Choose another.`);
    process.exit(1);
  }

  const rate = args.rate === undefined ? 0 : Math.round(Number(args.rate) * 100);
  if (!(rate >= 0)) {
    console.error('--rate is an hourly rate in pounds, such as 18.50.');
    process.exit(1);
  }
  const id = await createPerson({ name, grants, isAdmin, ratePence: rate, passcodeHash: await hashPasscode(passcode) });
  const person = { id };
  console.log(`Created ${name} (id ${person.id})${isAdmin ? ', admin' : ''}: ${grants.join(', ') || 'no businesses'}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
