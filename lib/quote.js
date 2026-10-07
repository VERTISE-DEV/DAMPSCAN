/**
 * A quote, worked out from its cost lines and a markup.
 *
 * The lines are what each part of the job costs the business. The price net
 * of VAT is their total plus the markup, and VAT goes on top. The customer
 * never sees a cost or the markup: the quote they get spreads the net price
 * across the same lines in proportion to their cost, so "Materials" on the
 * customer's quote is the materials cost marked up by the same percentage as
 * everything else, and the lines add up to the net price to the penny.
 *
 * Pure arithmetic in integer pence, using the rounding in lib/splits.js so
 * there is one rounding rule in the codebase.
 */
import { bpOf } from './splits.js';

export const QUOTE_KINDS = {
  materials: 'Materials',
  labour: 'Labour',
  scaffolding: 'Scaffolding',
  waste: 'Waste and skip',
  other: 'Other'
};

const N = (v) => Number(v) || 0;

/**
 * Shares `total` across `weights` in proportion, whole pence, adding back to
 * `total` exactly. Each share is rounded down and the pennies left over go to
 * the lines with the largest remainders, earliest line first on a tie.
 */
export function spread(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const shares = exact.map(Math.floor);
  let left = total - shares.reduce((s, v) => s + v, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) shares[order[k][1]] += 1;
  return shares;
}

/**
 * @param {Array<{kind:string, description:string, costPence:number}>} lines
 * @param {number} markupBp  e.g. 3000 for 30%
 * @param {number} vatBp     e.g. 2000 for 20%
 */
export function quoteTotals(lines, markupBp, vatBp) {
  const costs = lines.map((l) => Math.max(0, Math.round(N(l.costPence))));
  const costPence = costs.reduce((s, c) => s + c, 0);
  const markupPence = bpOf(costPence, N(markupBp));
  const netPence = costPence + markupPence;
  const vatPence = bpOf(netPence, N(vatBp));
  const prices = spread(netPence, costs);
  return {
    costPence,
    markupBp: N(markupBp),
    markupPence,
    netPence,
    vatBp: N(vatBp),
    vatPence,
    totalPence: netPence + vatPence,
    /* What the customer's quote shows: no cost and no markup anywhere. */
    customerLines: lines.map((l, i) => ({
      kind: l.kind,
      label: QUOTE_KINDS[l.kind] || 'Other',
      description: l.description,
      pricePence: prices[i]
    }))
  };
}
