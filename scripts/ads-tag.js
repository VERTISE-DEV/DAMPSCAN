/**
 * The Google Ads tag, per site.
 *
 * One place rather than pasted into a head, because there are two sites and
 * about eighty pages, and a measurement tag that is on some of them and not
 * others reports numbers nobody can trust. Keyed by site so DampScan can have
 * its own without touching anything but this map, and so that ATi's tag can
 * never end up on a DampScan page.
 *
 * This is the base tag only. It records page views for the account, which is
 * what remarketing and enhanced conversions need, but it does not by itself
 * record a booking as a conversion: that needs a second call naming a
 * conversion action, gtag('event', 'conversion', { send_to: 'AW-x/label' }),
 * fired when the form succeeds. The label comes from the conversion action in
 * the Google Ads account and is not something that can be guessed here.
 *
 * Note for whoever adds that: the booking form already pushes a lead event into
 * window.dataLayer from pushLeadToCRM in public/assets/book.js, at both the
 * partial and complete stages. That is the hook, and complete is the one that
 * means a booking.
 */

/* Site key to Google Ads conversion ID. A site with no entry gets no tag, and
   that is the whole opt in: nothing is added anywhere by default. */
const TAGS = {
  ati: 'AW-18231740318'
};

/**
 * @param {string} siteKey 'ati' or 'dampscan'
 * @returns {string} the script tags, or '' for a site with no tag configured
 */
export function adsTag(siteKey) {
  const id = TAGS[siteKey];
  if (!id) return '';
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${id}');
</script>`;
}

export const taggedSites = Object.keys(TAGS);
