/**
 * Regional pages for the brands that write them by region rather than by
 * town. Verge Roofing covers the whole South East with its own team, so a page
 * per district would be thirty copies of one paragraph; a page per region can
 * say something true about the roofs there instead.
 *
 * They share the service page shape and template, served under the brand's
 * areas path (/roofing-in/<slug>) rather than /services. The directory is the
 * list, as with the other content folders.
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const files = (await readdir(HERE))
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .sort();

export const regions = await Promise.all(
  files.map((f) => import(`./${f}`).then((m) => m.default))
);
