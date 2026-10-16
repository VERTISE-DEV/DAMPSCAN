/**
 * Money is for whoever manages a business. Somebody granted 'work' on it
 * (a surveyor, a crew member) sees the work: who, where, when, what is
 * outstanding, and never what any of it is worth.
 *
 * Routes used to decide this one by one, and the ones that forgot leaked a
 * price or a deposit to a surveyor's phone. So it is decided once more, at
 * the edge, for every staff route (api/admin/[action].js) and every
 * assistant tool (lib/mcp/shared.js): the answer is walked and any key that
 * names money is dropped from rows of a business the viewer does not manage.
 * A row says its business by `site` (or `business_slug`, `slug`); anything
 * that does not say is treated as belonging to every business the person
 * holds, so a total across a business they only work on is dropped too.
 *
 * Only figures go: a number, a numeric string, or a structure of them (a
 * payout, a list of payments). A tick such as `deposit: true` or a date such
 * as `paidAt` stays, because "deposit paid" is work to know about and the
 * amount is not.
 */

/* Keys that name money. Deliberately broad: a false positive hides a figure
   from a worker, a false negative shows one. */
const MONEY = /pence$|price|amount|owed|balance|profit|^fees?$|fee(Base|Percent|s)?$|earn|invoice|cost|deposit(?!PaidAt|_paid_at|Paid$|_paid$)|^pay$|^pay_|^payouts?$|^payoutRows$|^payments$|^frozen$|bp$|^rates$|takings|turnover|revenue|income/i;
const SLUGS = ['dampscan', 'ati-london', 'roofing', 'ac'];

/** Whether this person sees money for this business. */
export function seesMoney(scope, site) {
  return Boolean(scope && (scope.isAdmin || (scope.levels || {})[site] === 'manage'));
}

/** Whether anything at all needs hiding from this person. */
export function hidesAny(scope) {
  return Boolean(scope && !scope.isAdmin && (scope.businesses || []).some((s) => !seesMoney(scope, s)));
}

const isFigure = (v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()))
  || (Array.isArray(v) && v.length > 0) || (v !== null && typeof v === 'object' && !Array.isArray(v));

function siteOf(obj) {
  const s = obj.site || obj.business_slug || obj.businessSlug || obj.slug;
  return SLUGS.includes(s) ? s : null;
}

function walk(value, scope, managed) {
  if (Array.isArray(value)) return value.map((v) => walk(v, scope, managed));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const site = siteOf(value);
  const here = site ? seesMoney(scope, site) : managed;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (!here && MONEY.test(k) && isFigure(v)) continue;
    out[k] = walk(v, scope, here);
  }
  return out;
}

/** The answer with every figure the person may not see taken out. */
export function hideFigures(data, scope) {
  if (!hidesAny(scope)) return data;
  return walk(data, scope, false);
}

/**
 * A route handler whose JSON answer passes through hideFigures for whoever
 * asked. The scope is the one requireScope resolved for the request, so this
 * adds no query of its own.
 */
export function withFigures(handler) {
  return async (req, res) => {
    const end = res.end.bind(res);
    res.end = (chunk, ...rest) => {
      const scope = req.scope || req.mcpScope;
      const type = String((res.getHeader && res.getHeader('content-type')) || '');
      if (chunk && hidesAny(scope) && type.includes('application/json')) {
        try { chunk = JSON.stringify(hideFigures(JSON.parse(String(chunk)), scope)); } catch { /* not JSON after all: sent as it was */ }
      }
      return end(chunk, ...rest);
    };
    return handler(req, res);
  };
}
