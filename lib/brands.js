/**
 * Contact details for the businesses that send quotes: the name, number,
 * address and site a customer's quote carries.
 *
 * Kept once, here, and read by the page build as well, so the number on a
 * quote can never be different from the number on the website.
 */
export const BRANDS = {
  roofing: {
    name: 'Verge Roofing',
    origin: 'https://vergeroofing.com',
    email: 'team@vergeroofing.com',
    phone: '+442034324561',
    phoneLabel: '020 3432 4561'
  },
  ac: {
    name: 'CoolRight',
    origin: 'https://coolright.co.uk',
    email: 'team@coolright.co.uk',
    phone: '+442034324559',
    phoneLabel: '020 3432 4559'
  }
};

export const brandFor = (site) => BRANDS[site] || null;
