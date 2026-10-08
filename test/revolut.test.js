/** Revolut's API transactions read into the same rows a statement upload makes. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsFrom, revolutConfigured } from '../lib/bank/revolut.js';
import { fingerprint } from '../lib/bank/csv.js';

test('completed GBP legs on the account become rows, with the same fingerprint an upload would give', () => {
  delete process.env.REVOLUT_CLIENT_ID;
  assert.equal(revolutConfigured(), false);
  const { rows, skipped } = rowsFrom([
    { id: 'tx-1', type: 'transfer', state: 'completed', completed_at: '2026-08-21T23:30:00Z', reference: 'Priya',
      legs: [{ leg_id: 'l1', account_id: 'acc', amount: 107.5, currency: 'GBP', description: 'Payment from P SHARMA', balance: 1200, counterparty: { name: 'P SHARMA' } }] },
    { id: 'tx-2', type: 'card_payment', state: 'pending', created_at: '2026-08-22T10:00:00Z', legs: [{ leg_id: 'l2', account_id: 'acc', amount: -5, currency: 'GBP' }] },
    { id: 'tx-3', type: 'card_payment', state: 'completed', completed_at: '2026-08-22T10:00:00Z', legs: [{ leg_id: 'l3', account_id: 'other', amount: -9, currency: 'GBP' }] }
  ], 'acc');
  assert.equal(rows.length, 1);
  assert.equal(skipped.pending, 1);
  const r = rows[0];
  assert.equal(r.postedOn, '2026-08-22', 'the London day');
  assert.equal(r.amountPence, 10750);
  assert.equal(r.reference, 'Priya');
  assert.equal(r.counterparty, 'P SHARMA');
  assert.equal(fingerprint(r), fingerprint({ externalId: 'tx-1', currency: 'GBP', amountPence: 10750 }));
});
