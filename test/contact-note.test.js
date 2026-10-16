/** A phone or email kept only in a job's notes still reaches the cards. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactFromNote, contactOf } from '../lib/contact-note.js';

test('a phone and email in the notes are found, and the proper fields win', () => {
  assert.deepEqual(contactFromNote('Jason, phone 07814 663729, jason@example.com, gate code 44'), { phone: '07814 663729', email: 'jason@example.com' });
  assert.deepEqual(contactOf('07700 900123', null, 'call 07814 663729, j@x.co'), { phone: '07700 900123', email: 'j@x.co' });
  assert.deepEqual(contactOf(null, null, 'Deposit £107.50 paid'), { phone: null, email: null });
});
