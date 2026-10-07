/**
 * Contact details for the businesses that send quotes: the name, number,
 * address and site a customer's quote carries, and the review link their
 * review requests send.
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
    phoneLabel: '020 3432 4561',
    /* The Business Profile link the review request sends. A direct
       write-a-review link from the profile is better, when one is issued. */
    reviewUrl: 'https://share.google/p2JjORGy8UdZUpQnV',
    /* Invoice numbers run VR-0001, VR-0002 and so on. */
    invoicePrefix: 'VR'
  },
  ac: {
    name: 'CoolRight',
    origin: 'https://coolright.co.uk',
    email: 'team@coolright.co.uk',
    phone: '+442034324559',
    phoneLabel: '020 3432 4559',
    reviewUrl: 'https://share.google/MFCiCldTnpS3VMcVW',
    invoicePrefix: 'CR'
  }
};

export const brandFor = (site) => BRANDS[site] || null;
