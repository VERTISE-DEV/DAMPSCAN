/**
 * Writes the problem and seasonal pages, run by build-pages.js. Split out so
 * that file stays readable; the pattern is the same as the guides: check
 * every page first, refuse to build if any fails, then clear and rewrite.
 *
 * Output: public/problem-pages/<site>/<slug>.html and
 * public/seasonal-pages/<site>/<slug>.html, served at /problems/<slug> and
 * /seasonal/<slug> on the brand's host by middleware.js.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { problems } from '../content/problems/index.js';
import { seasonal } from '../content/seasonal/index.js';
import { services } from '../content/services/index.js';
import { guides } from '../content/guides/index.js';
import { areas } from '../content/areas/index.js';
import { regions } from '../content/regions/index.js';
import { pricing } from '../content/pricing.js';
import { render, TOPIC_HUBS } from './problem-template.js';
import { checkTopic } from './content-checks.js';

export const TOPICS = { problems, seasonal };

/** Problems with the content, one line each; empty when all are ready. */
export function checkTopics() {
  const failures = [];
  for (const [kind, list] of Object.entries(TOPICS)) {
    const seen = new Set();
    for (const page of list) {
      const found = checkTopic(page, seen);
      if (found.length) failures.push(`${kind} ${page.slug || '(no slug)'}: ${found.join(', ')}`);
    }
  }
  return failures;
}

export async function writeTopicPages(root) {
  const counts = {};
  for (const [kind, list] of Object.entries(TOPICS)) {
    const out = join(root, 'public', TOPIC_HUBS[kind].dir);
    await rm(out, { recursive: true, force: true });
    for (const page of list) {
      await mkdir(join(out, page.site), { recursive: true });
      const links = { services, guides, areas: [...areas, ...regions], hasPricing: Boolean(pricing[page.site]) };
      await writeFile(join(out, page.site, `${page.slug}.html`), render(page, kind, links), 'utf8');
    }
    counts[kind] = list.length;
  }
  return counts;
}
