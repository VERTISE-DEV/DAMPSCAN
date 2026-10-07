/**
 * VAT and invoicing rules for a business, from its businesses row.
 *
 * VAT is charged only by a registered business, so the rate a quote or an
 * invoice uses is nought until vat_registered is switched on. An invoice needs
 * the business's address always, and its VAT number only once it is
 * registered: an unregistered business issues a plain invoice with no VAT.
 */
export const effectiveVatBp = (b) => (b && b.vat_registered ? Number(b.vat_bp == null ? 2000 : b.vat_bp) : 0);

export const canInvoice = (b) => Boolean(b && b.trading_address && (!b.vat_registered || b.vat_number));

/** Why invoicing is not available yet, in words for the staff screen. */
export function invoiceBlocker(b) {
  if (!b || !b.trading_address) return 'Add the business address under Insights, Business details, before issuing invoices.';
  if (b.vat_registered && !b.vat_number) return 'VAT is switched on, so add the VAT number under Insights, Business details, before issuing invoices.';
  return null;
}

/* The UK registration threshold on taxable turnover over any rolling twelve
   months, as it stood when this was written. HMRC moves it occasionally, so
   check gov.uk/vat-registration; it is only used for the warning meter. */
export const VAT_THRESHOLD_PENCE = 90000 * 100;
