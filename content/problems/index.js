/**
 * Every "common problem" page: one per problem per business, written from
 * what the customer sees (a leak, a noise, a smell) rather than from the
 * service we sell. Each one links on to the service pages that do the work.
 *
 * The directory is the list, as with the other content folders. A problem a
 * service or guide page already answers in full is not written again here:
 * the damp brands' service pages are already one page per problem (rising
 * damp, penetrating damp, condensation and mould, wet and dry rot, woodworm,
 * basements), so they have no files in this folder.
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const files = (await readdir(HERE))
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .sort();

export const problems = await Promise.all(
  files.map((f) => import(`./${f}`).then((m) => m.default))
);
