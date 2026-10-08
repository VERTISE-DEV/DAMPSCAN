/**
 * Every seasonal page. They are live all year, because a page that comes and
 * goes never builds up any standing with Google; what changes with the season
 * is only which one the home page and the menu feature (content/seasons.js).
 *
 * Same shape and template as the problem pages. The directory is the list.
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const files = (await readdir(HERE))
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .sort();

export const seasonal = await Promise.all(
  files.map((f) => import(`./${f}`).then((m) => m.default))
);
