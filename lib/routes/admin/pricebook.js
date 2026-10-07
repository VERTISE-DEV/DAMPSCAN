/**
 * /api/admin/pricebook
 *
 *   GET   ?site=                         the business's price book and templates
 *   POST  {op, site, ...}                one change, audited:
 *     item        {id?, kind, description, unit, costPence}   add or update an item
 *     unitem      {id}                                         retire one
 *     template    {jobId, name}                                save a job's quote lines
 *     untemplate  {id}                                         delete a template
 *
 * Reading needs the business; changing it needs manage, because a price
 * book entry is what every later quote is built from. Applying a template to
 * a job is a quote op ('fromtemplate', lib/quote-store.js), so it runs with the
 * job's own checks.
 */
import { query, queryOne } from '../../db.js';
import { json, requireMethod, readJson, str } from '../../http.js';
import { requireScope } from '../../access.js';
import { normaliseSite } from '../../site.js';
import { record } from '../../audit.js';
import { QUOTE_KINDS } from '../../quote.js';

export const config = { runtime: 'nodejs' };

const N = (v) => Number(v) || 0;
const canManage = (scope, site) => scope.isAdmin || scope.levels[site] === 'manage';

async function load(site) {
  const [items, templates] = await Promise.all([
    query('select id, kind, description, unit, cost_pence from price_items where business_slug = $1 and active order by kind, description', [site]),
    query('select id, name, lines, markup_bp from quote_templates where business_slug = $1 order by name', [site])
  ]);
  return {
    items: items.map((r) => ({ id: Number(r.id), kind: r.kind, description: r.description, unit: r.unit, costPence: N(r.cost_pence) })),
    templates: templates.map((r) => ({
      id: Number(r.id), name: r.name, markupBp: r.markup_bp == null ? null : N(r.markup_bp),
      lineCount: Array.isArray(r.lines) ? r.lines.length : 0,
      costPence: (Array.isArray(r.lines) ? r.lines : []).reduce((s, l) => s + N(l.costPence), 0)
    }))
  };
}

const bad = (res, key, message) => json(res, 400, { ok: false, errors: { [key]: message } });

async function change(res, body, scope, site) {
  const op = body.op;
  if (op === 'item') {
    const kind = Object.hasOwn(QUOTE_KINDS, body.kind) ? body.kind : null;
    const description = str(body.description, 160);
    const unit = str(body.unit, 20) || 'each';
    const cost = Math.round(Number(body.costPence));
    if (!kind || !description || !Number.isFinite(cost) || cost < 0) return bad(res, 'item', 'An item needs a type, a description and what one unit costs you.');
    const id = body.id == null ? null : Number(body.id);
    const row = id
      ? await queryOne(`update price_items set kind = $3, description = $4, unit = $5, cost_pence = $6, updated_at = now()
                         where id = $1 and business_slug = $2 and active returning id`, [id, site, kind, description, unit, cost])
      : await queryOne('insert into price_items (business_slug, kind, description, unit, cost_pence) values ($1, $2, $3, $4, $5) returning id',
        [site, kind, description, unit, cost]);
    if (!row) return json(res, 404, { ok: false, error: 'not_found' });
    await record({ scope, business: site, entity: 'price_item', entityId: row.id, action: id ? 'price_item_update' : 'price_item_create', before: null, after: { kind, description, unit, cost } });
  } else if (op === 'unitem') {
    await query('update price_items set active = false, updated_at = now() where id = $1 and business_slug = $2', [Number(body.id), site]);
    await record({ scope, business: site, entity: 'price_item', entityId: Number(body.id), action: 'price_item_retire', before: null, after: null });
  } else if (op === 'template') {
    const name = str(body.name, 80);
    if (!name) return bad(res, 'template', 'Give the template a name, such as "Re-roof, semi, concrete tile".');
    const job = await queryOne('select id, markup_bp from jobs where id = $1 and site = $2', [Number(body.jobId), site]);
    if (!job) return json(res, 404, { ok: false, error: 'not_found' });
    const lines = (await query('select kind, description, cost_pence from quote_lines where job_id = $1 order by id', [job.id]))
      .map((l) => ({ kind: l.kind, description: l.description, costPence: N(l.cost_pence) }));
    if (!lines.length) return bad(res, 'template', 'This quote has no lines to save yet.');
    const row = await queryOne('insert into quote_templates (business_slug, name, lines, markup_bp) values ($1, $2, $3::jsonb, $4) returning id',
      [site, name, JSON.stringify(lines), job.markup_bp]);
    await record({ scope, business: site, entity: 'quote_template', entityId: row.id, action: 'template_create', before: null, after: { name, lines: lines.length } });
  } else if (op === 'untemplate') {
    await query('delete from quote_templates where id = $1 and business_slug = $2', [Number(body.id), site]);
    await record({ scope, business: site, entity: 'quote_template', entityId: Number(body.id), action: 'template_delete', before: null, after: null });
  } else {
    return json(res, 400, { ok: false, error: 'unknown_op' });
  }
  json(res, 200, { ok: true, ...(await load(site)) });
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  const scope = await requireScope(req, res);
  if (!scope) return;
  try {
    const body = req.method === 'POST' ? await readJson(req) : {};
    const site = normaliseSite(req.method === 'POST' ? body.site : new URL(req.url, 'http://localhost').searchParams.get('site'));
    if (!site || !scope.businesses.includes(site)) return json(res, 403, { ok: false, error: 'forbidden' });
    if (req.method === 'GET') return json(res, 200, { ok: true, site, canManage: canManage(scope, site), ...(await load(site)) });
    if (!canManage(scope, site)) return json(res, 403, { ok: false, error: 'forbidden' });
    return await change(res, body, scope, site);
  } catch (err) {
    console.error('pricebook request failed:', err.message);
    json(res, 500, { ok: false, error: 'pricebook_failed' });
  }
}
