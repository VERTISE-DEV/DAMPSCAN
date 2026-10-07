/**
 * Typical price ranges, per brand and per service page, for the "What it
 * usually costs" block on that page.
 *
 * Empty until the owners give real figures, and that is deliberate: a range
 * on a website is a promise people hold you to, so nothing here is estimated
 * or borrowed from another firm. A service with no entry shows no block.
 *
 * Each entry, keyed by the service page's slug:
 *   from, to   pounds, including VAT, for a typical job of that kind
 *   typical    what "typical" means, e.g. 'a three-bedroom semi, scaffold included'
 *
 * For example, once the owners confirm it:
 *   're-roofs': { from: 9000, to: 14000, typical: 'a three-bedroom semi in concrete tile, scaffold and skip included' }
 */
export const priceGuide = {
  roofing: {},
  ac: {}
};
