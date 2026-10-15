/**
 * Every Kent town page DampScan publishes. One file per town; the directory
 * is the list, as with content/areas/. See content/kent-towns.js for the
 * shape of an entry.
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const files = (await readdir(HERE))
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .sort();

export const towns = await Promise.all(files.map((f) => import(`./${f}`).then((m) => m.default)));
