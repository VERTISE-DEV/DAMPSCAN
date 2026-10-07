/**
 * Each person's statement on the Bank page: what their paid jobs earned them,
 * less their share of costs, less what they have taken out, plus anything
 * they put in, which leaves what is still theirs in the account.
 *
 *   left = earned + put in + costs + taken      (costs and taken are negative)
 *
 * "Left" is exactly the balance the reconciliation already uses, broken into
 * the parts a person recognises, and every amount taken is listed with its
 * date and what the bank called it. Only bank lines count: this is the
 * account, not an estimate. A line waiting to be split counts for nobody
 * until somebody splits it, and the page says how many are waiting.
 */
import { query } from '../db.js';

const FROM = `coalesce($1::date, (select min(posted_on) from bank_transactions where books = $2), '-infinity'::date)`;
const N = (v) => Number(v) || 0;

/* Money handed to a person: a transfer to them, or cash they drew. */
const TAKEN = ['drawings', 'cash'];

/* A line's shares as a map, including lines written before the map existed,
   which carry the damp partners' shares in their own columns. */
const SHARES = `coalesce(nullif(t.shares, '{}'::jsonb), jsonb_build_object(
  'scott', t.share_scott_pence, 'tom', t.share_tom_pence, 'ben', t.share_ben_pence, 'tax', t.share_tax_pence))`;

/**
 * @param {string|null} from   the reconcile-from date, as the rest of the page
 * @param {object} books       the books, with its targets
 * @param {Array<{key:string,name:string,earnedPence:number}>} people
 */
export async function personStatements(from, books, people) {
  const keys = people.map((p) => p.key);
  if (!keys.length) return [];
  const sums = await query(
    `select s.key,
            coalesce(sum(s.value::bigint) filter (where t.category = any($4::text[]) and s.value::bigint < 0), 0) as taken,
            coalesce(sum(s.value::bigint) filter (where s.value::bigint > 0), 0) as put_in,
            coalesce(sum(s.value::bigint) filter (where not (t.category = any($4::text[])) and s.value::bigint < 0), 0) as costs
       from bank_transactions t, jsonb_each_text(${SHARES}) s
      where t.books = $2 and t.category <> 'transfer' and t.posted_on >= ${FROM} and s.key = any($3::text[])
      group by s.key`,
    [from, books.key, keys, TAKEN]);
  const lines = await query(
    `select s.key, t.id, t.posted_on::text as posted_on, t.category, s.value::bigint as pence,
            coalesce(nullif(t.counterparty, ''), t.description) as said
       from bank_transactions t, jsonb_each_text(${SHARES}) s
      where t.books = $2 and t.category <> 'transfer' and t.posted_on >= ${FROM} and s.key = any($3::text[])
        and t.category = any($4::text[]) and s.value::bigint < 0
      order by t.posted_on desc, t.id desc`,
    [from, books.key, keys, TAKEN]);

  const by = Object.fromEntries(sums.map((r) => [r.key, r]));
  return people.map((p) => {
    const r = by[p.key] || {};
    const taken = N(r.taken);
    const costs = N(r.costs);
    const putIn = N(r.put_in);
    return {
      key: p.key,
      name: p.name,
      earnedPence: p.earnedPence,
      costsPence: costs,
      putInPence: putIn,
      takenPence: taken,
      leftPence: p.earnedPence + putIn + costs + taken,
      taken: lines.filter((l) => l.key === p.key).slice(0, 60).map((l) => ({
        id: Number(l.id), postedOn: l.posted_on, amountPence: -N(l.pence), how: l.category === 'cash' ? 'Cash' : 'Transfer', said: l.said
      }))
    };
  });
}
