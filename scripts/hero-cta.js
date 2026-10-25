/**
 * The price and the way to book, in the first screen of every generated page:
 * most visitors decide before they scroll. "From" so it never disagrees with
 * the price list as that changes. The quoted trades get the button only.
 */
export function heroCta(site) {
  const damp = site === 'dampscan' || site === 'ati';
  const label = site === 'ati' ? 'Request a survey' : damp ? 'Book a survey' : 'Get a free quote';
  return `<p class="hero-cta"><a class="btn btn--primary" href="#book">${label}</a>${damp ? '\n      <span class="hero-price">Fixed-price surveys from £215, report included</span>' : ''}</p>`;
}
