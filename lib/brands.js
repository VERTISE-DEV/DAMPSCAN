/**
 * Contact details for the businesses that send quotes: the name, number,
 * address and site a customer's quote carries, and the review link their
 * review requests send.
 *
 * Kept once, here, and read by the page build as well, so the number on a
 * quote can never be different from the number on the website.
 */
/* What a UK VAT invoice has to carry beyond the name: the registered or
   trading address and the VAT number, and the company number if it is a
   limited company. Not known yet, so null, and an invoice cannot be issued
   until they are filled in: an invoice without them is not a valid VAT
   invoice. `payment` is how to pay (bank details), printed on the invoice. */
function invoiceDetails(prefix) {
  return { invoicePrefix: prefix, address: null, vatNumber: null, companyNumber: null, payment: null };
}

/** Whether a brand has what a VAT invoice needs. */
export const canInvoice = (brand) => Boolean(brand && brand.address && brand.vatNumber);

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
    ...invoiceDetails('VR')
  },
  ac: {
    name: 'CoolRight',
    origin: 'https://coolright.co.uk',
    email: 'team@coolright.co.uk',
    phone: '+442034324559',
    phoneLabel: '020 3432 4559',
    reviewUrl: 'https://share.google/MFCiCldTnpS3VMcVW',
    ...invoiceDetails('CR')
  }
};

export const brandFor = (site) => BRANDS[site] || null;
