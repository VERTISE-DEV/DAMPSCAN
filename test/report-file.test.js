/** The report link for the final email works for a week and only as signed. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'report-file-secret-long-enough-xxxxxxxx';
const { reportLink, signedOk } = await import('../lib/report-file.js');

test('a signed report link opens its own job only, and runs out', () => {
  const u = new URL(reportLink('https://dampscan.co.uk', 42));
  const [id, exp, sig] = ['report', 'exp', 'sig'].map((k) => u.searchParams.get(k));
  assert.equal(signedOk(id, exp, sig), true);
  assert.equal(signedOk('43', exp, sig), false, 'another job');
  assert.equal(signedOk(id, String(Number(exp) + 1), sig), false, 'a longer life');
  assert.equal(signedOk(id, exp, sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a')), false);
  const old = new URL(reportLink('https://dampscan.co.uk', 42, Date.now() - 8 * 86400000));
  assert.equal(signedOk('42', old.searchParams.get('exp'), old.searchParams.get('sig')), false, 'over a week old');
});
