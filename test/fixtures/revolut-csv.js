/**
 * A Revolut Business CSV, built line by line, with the real column names. Only
 * the fields a test names are filled in; the rest are blank, as they often are
 * in a real export. Shared by the unit and the route tests, and kept out of
 * both so importing it does not run either file's tests a second time.
 */
const BUSINESS_HEADER = 'Date started (UTC),Date completed (UTC),Date started (Europe/London),Date completed (Europe/London),ID,Type,State,Description,Reference,Payer,Card number,Card label,Card state,Orig currency,Orig amount,Payment currency,Amount,Total amount,Exchange rate,Fee,Fee currency,Balance,Account,Beneficiary account number,Beneficiary sort code or routing number,Beneficiary IBAN,Beneficiary BIC,MCC,Related transaction id,Spend program';

/** One Business-format line. Only the fields a test cares about are named. */
export function businessLine(o) {
  const started = `${o.date} 09:00:00`;
  const completed = o.state && o.state !== 'COMPLETED' ? '' : `${o.date} 09:05:00`;
  const fee = o.fee || 0;
  const amount = Number(o.amount);
  const cells = [started, completed, started, completed, o.id || '', o.type || 'CARD_PAYMENT',
    o.state || 'COMPLETED', o.description || '', o.reference || '', o.payer || '', '', '', '',
    o.currency || 'GBP', amount.toFixed(2), o.currency || 'GBP', amount.toFixed(2),
    (amount - fee).toFixed(2), '', fee.toFixed(2), o.currency || 'GBP', o.balance == null ? '' : o.balance,
    o.account || 'Main', '', '', '', '', o.mcc || '', '', ''];
  return cells.map((c) => (/[,"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(',');
}

export const businessCsv = (lines) => [BUSINESS_HEADER, ...lines.map(businessLine)].join('\r\n') + '\r\n';

