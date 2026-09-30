/**
 * The staff scripts are plain browser files with no build step, so nothing
 * catches a name that only exists in Node until a page stops working.
 *
 * dashboard.js reached for `global`, which browsers do not have, and threw
 * before its first load: the Dashboard tab sat on "Loading" with no leads.
 * The bank files use the name legitimately, as the parameter of the function
 * they are wrapped in, which is the one form allowed here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIRS = ['public/staff', 'public/assets'].map((d) => new URL(`../${d}/`, import.meta.url).pathname);

test('no browser script uses a Node global it was not handed', async () => {
  for (const dir of DIRS) {
    for (const name of (await readdir(dir)).filter((f) => f.endsWith('.js'))) {
      const src = await readFile(join(dir, name), 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const handed = /function\s*\w*\s*\(\s*global\s*\)/.test(code);
      if (!handed) assert.ok(!/\bglobal\./.test(code), `${name} uses global without being handed it`);
      assert.ok(!/\b(process|require)\s*[.(]/.test(code), `${name} uses a Node-only name`);
    }
  }
});
