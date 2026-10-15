/**
 * ATi's "damp proofing in <borough>" copy, one file per borough. Only the
 * boroughs with the most Search Console impressions have one; the rest of the
 * borough's details come from its area file in content/areas/.
 *
 * Shape: { slug, material, intro, oversold, walls, right[4], areas[2]{name,text}, faq[6] }
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const files = (await readdir(HERE)).filter((f) => f.endsWith('.js') && f !== 'index.js').sort();

export const londonProofing = await Promise.all(files.map((f) => import(`./${f}`).then((m) => m.default)));
