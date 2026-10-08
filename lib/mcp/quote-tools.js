/**
 * Assistant tools for building a quote on a Verge or CoolRight job.
 *
 * The owner talks ("40 square metres of Redland 49, two days labour,
 * scaffold front and back"); the assistant does the understanding, matches
 * what it can to the price book, and sends structured lines. This side only
 * prices and adds them, each through the quote route's own 'qline' op, so a
 * line added here is a line added on the screen: same checks, same audit
 * row, and the job's price follows the quote while it is still a quote.
 */
import pricebook from '../routes/admin/pricebook.js';
import quoted from '../routes/admin/quoted.js';
import { QUOTE_KINDS } from '../quote.js';
import { callRoute, read, write, fail, notFound, jobInScope, ID } from './shared.js';

const KINDS = Object.keys(QUOTE_KINDS);
const op = (scope, body) => callRoute(quoted, scope, { method: 'POST', url: '/api/admin/quoted', body });

async function book(scope, site) {
  const r = await callRoute(pricebook, scope, { url: '/api/admin/pricebook?site=' + encodeURIComponent(site) });
  return r.status === 200 ? { items: r.data.items, templates: r.data.templates } : null;
}

async function quotedJob(scope, id) {
  const found = await jobInScope(scope, id);
  if (!found) return { error: notFound() };
  if (found.business.payout_model === 'damp') return { error: fail('Quotes are for Verge Roofing and CoolRight jobs.') };
  return found;
}

const gbp = (pence) => `£${(pence / 100).toFixed(2)}`;
const tidy = (n) => String(Math.round(n * 100) / 100);

/** One spoken line as a quote line, priced from the book unless a price was given. */
export function priceLine(line, items) {
  const qty = line.qty === undefined || line.qty === null ? 1 : Number(line.qty);
  if (!(qty > 0 && qty < 100000)) return { error: 'Each line needs a quantity above nought.' };
  const item = line.price_book_item_id != null ? items.find((i) => i.id === Number(line.price_book_item_id)) : null;
  if (line.price_book_item_id != null && !item) return { error: `Price book item ${line.price_book_item_id} is not in this business's book.` };
  const unitPence = line.unit_price_pounds != null ? Math.round(Number(line.unit_price_pounds) * 100) : item ? item.costPence : NaN;
  if (!(unitPence >= 0)) return { error: `Give a unit price for "${line.label || 'that line'}": it is not in the price book.` };
  const label = String(line.label || (item && item.description) || '').trim();
  if (!label) return { error: 'Each line needs a price book item or a label.' };
  const kind = KINDS.includes(line.kind) ? line.kind : item ? item.kind : 'other';
  const unit = item && item.unit ? ` ${item.unit}` : '';
  const description = (qty === 1 && !unit ? label : `${label}, ${tidy(qty)}${unit} at ${gbp(unitPence)}`).slice(0, 160);
  return { kind, description, costPence: Math.round(qty * unitPence) };
}

async function addLines(scope, id, lines) {
  let last = null;
  for (const l of lines) {
    last = await op(scope, { op: 'qline', id, ...l });
    if (last.status !== 200) return last;
  }
  return last;
}

async function listBook(scope, { site }) {
  if (!scope.businesses.includes(site)) return fail('You do not hold that business.');
  const b = await book(scope, site);
  return b ? { status: 200, data: { ok: true, site, ...b } } : fail('That business has no price book.');
}

async function buildQuote(scope, { id, lines = [] }) {
  const found = await quotedJob(scope, id);
  if (found.error) return found.error;
  const b = await book(scope, found.job.site);
  const items = b ? b.items : [];
  if (!lines.length) return { status: 200, data: { ok: true, added: 0, priceBook: b, hint: 'Match the description to these items, then call again with lines.' } };
  const priced = lines.map((l) => priceLine(l, items));
  const bad = priced.find((p) => p.error);
  /* All or nothing: a half-added quote is worse than none. */
  if (bad) return { status: 400, data: { ok: false, error: bad.error, priceBook: b } };
  const r = await addLines(scope, id, priced);
  return r.status === 200 ? { status: 200, data: { ok: true, added: priced.length, quote: r.data.job.quote, priceBook: b } } : r;
}

async function addLine(scope, { id, kind, description, cost_pounds: pounds }) {
  const found = await quotedJob(scope, id);
  if (found.error) return found.error;
  return op(scope, { op: 'qline', id, kind, description, costPence: Math.round(Number(pounds) * 100) });
}

async function removeLine(scope, { id, line_id: lineId }) {
  const found = await quotedJob(scope, id);
  if (found.error) return found.error;
  return op(scope, { op: 'unqline', id, lineId });
}

async function fromTemplate(scope, { id, template_id: templateId, template_name: name }) {
  const found = await quotedJob(scope, id);
  if (found.error) return found.error;
  let tid = templateId;
  if (tid == null && name) {
    const b = await book(scope, found.job.site);
    const t = b && b.templates.find((x) => x.name.toLowerCase() === String(name).trim().toLowerCase());
    if (!t) return { status: 400, data: { ok: false, error: 'No template by that name.', templates: b ? b.templates : [] } };
    tid = t.id;
  }
  return op(scope, { op: 'fromtemplate', id, templateId: tid });
}

const LINE = {
  type: 'object', additionalProperties: false,
  properties: {
    price_book_item_id: { type: 'integer', description: 'The matching price book item, when there is one.' },
    label: { type: 'string', description: 'What it is, when it is not in the price book (or to word it differently).' },
    qty: { type: 'number', description: 'How many of the item\'s unit (square metres, days, metres...). Default 1.' },
    unit_price_pounds: { type: 'number', description: 'Cost per unit in pounds. Leave out to use the price book.' },
    kind: { type: 'string', enum: KINDS }
  }
};

export const QUOTE_TOOLS = [
  read('list_price_book', 'Price book', 'The business\'s price book items (id, kind, description, unit, cost per unit) and quote templates.', { site: { type: 'string', enum: ['roofing', 'ac'] } }, listBook),
  write('build_quote_from_words', 'Build a quote from a description', 'Adds lines to a job\'s quote from what the person described, for example "40 square metres of Redland 49, two days labour, scaffold front and back". YOU do the understanding: call it first with no lines to get the price book, match each part to an item (or give a label and unit price), then call again with the lines. Costs are before markup; the quote adds the markup.',
    { id: ID, lines: { type: 'array', items: LINE } }, ['id'], buildQuote),
  write('add_quote_line', 'Add a quote line', 'Adds one line to a job\'s quote: its type, description and what it costs in pounds before markup.',
    { id: ID, kind: { type: 'string', enum: KINDS }, description: { type: 'string' }, cost_pounds: { type: 'number' } }, ['id', 'kind', 'description', 'cost_pounds'], addLine),
  write('remove_quote_line', 'Remove a quote line', 'Takes one line off a job\'s quote. The line ids are in get_job under quote.lines.', { id: ID, line_id: { type: 'integer' } }, ['id', 'line_id'], removeLine),
  write('create_quote_from_template', 'Quote from a template', 'Adds a saved template\'s lines to a job\'s quote, by template id or name.',
    { id: ID, template_id: { type: 'integer' }, template_name: { type: 'string' } }, ['id'], fromTemplate)
];
