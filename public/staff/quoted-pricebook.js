/* The price book and quote templates, inside the Quote block of the job
   screen. A line from the price book is a pick and a quantity; a template is
   a whole quote from before. Both are per business, loaded when a job of that
   business is opened, and only someone who manages it can change them. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var Q = global.DSQ;
  var KIND = { materials: 'Materials', labour: 'Labour', scaffolding: 'Scaffolding', waste: 'Waste and skip', other: 'Other' };
  var cache = {};
  var current = null;

  function opt(value, text) { var o = document.createElement('option'); o.value = value; o.textContent = text; return o; }
  function field(label, input) {
    var row = U.node('div', 'form-row');
    var l = U.node('label', null, label);
    l.htmlFor = input.id;
    row.appendChild(l);
    row.appendChild(input);
    return row;
  }
  function input(id, type, extra) { var i = document.createElement(type === 'select' ? 'select' : 'input'); i.id = id; if (type !== 'select') { i.type = type; i.autocomplete = 'off'; } Object.assign(i, extra || {}); return i; }
  function button(text, cls, type) { var b = U.node('button', 'btn btn--ghost btn--sm' + (cls ? ' ' + cls : ''), text); b.type = type || 'button'; return b; }

  /* ---------- the controls, built once ---------- */
  var box = U.node('div', 'pb');
  var addForm = U.node('form', 'work-add');
  var itemSel = input('pb-item', 'select');
  var qty = input('pb-qty', 'text', { inputMode: 'decimal', value: '1' });
  addForm.appendChild(field('From the price book', itemSel));
  addForm.appendChild(field('How many', qty));
  addForm.appendChild(button('Add', null, 'submit'));
  var tplRow = U.node('div', 'work-add');
  var tplSel = input('pb-template', 'select');
  var useTpl = button('Use template');
  var saveTpl = button('Save these lines as a template');
  tplRow.appendChild(field('Start from a template', tplSel));
  tplRow.appendChild(useTpl);
  tplRow.appendChild(saveTpl);
  var manage = document.createElement('details');
  manage.className = 'pb-manage';
  manage.appendChild(U.node('summary', null, 'Price book and templates'));
  var list = U.node('div', 'lines');
  var itemForm = U.node('form', 'work-add');
  var kindSel = input('pb-kind', 'select');
  Object.keys(KIND).forEach(function (k) { kindSel.appendChild(opt(k, KIND[k])); });
  var desc = input('pb-desc', 'text', { placeholder: 'Redland 49 tile, Breckland Black' });
  var unit = input('pb-unit', 'text', { placeholder: 'm², each, day', value: 'each' });
  var cost = input('pb-cost', 'text', { inputMode: 'decimal' });
  [['Type', kindSel], ['Item', desc], ['Unit', unit], ['Cost to you per unit £', cost]].forEach(function (f) { itemForm.appendChild(field(f[0], f[1])); });
  itemForm.appendChild(button('Add to the price book', null, 'submit'));
  var tplList = U.node('div', 'lines');
  manage.appendChild(list);
  manage.appendChild(itemForm);
  manage.appendChild(U.node('h4', 'pb-sub', 'Templates'));
  manage.appendChild(tplList);
  var err = U.node('span', 'err');
  err.setAttribute('role', 'alert');
  [addForm, tplRow, manage, err].forEach(function (n) { box.appendChild(n); });
  var anchor = document.getElementById('w-markup-form');
  anchor.parentNode.insertBefore(box, anchor);

  function fail(message) { err.textContent = message; err.classList.add('is-shown'); }
  function clear() { err.classList.remove('is-shown'); }
  var fmtQty = function (n) { return String(Math.round(n * 100) / 100); };

  /* ---------- drawing ---------- */
  function draw(book) {
    itemSel.textContent = '';
    itemSel.appendChild(opt('', book.items.length ? 'Choose an item' : 'Nothing in the price book yet'));
    Object.keys(KIND).forEach(function (k) {
      var mine = book.items.filter(function (i) { return i.kind === k; });
      if (!mine.length) return;
      var group = document.createElement('optgroup');
      group.label = KIND[k];
      mine.forEach(function (i) { group.appendChild(opt(String(i.id), i.description + ', ' + U.money(i.costPence) + ' per ' + i.unit)); });
      itemSel.appendChild(group);
    });
    tplSel.textContent = '';
    tplSel.appendChild(opt('', book.templates.length ? 'Choose a template' : 'No templates yet'));
    book.templates.forEach(function (t) { tplSel.appendChild(opt(String(t.id), t.name + ' (' + t.lineCount + (t.lineCount === 1 ? ' line, ' : ' lines, ') + U.money(t.costPence) + ')')); });

    saveTpl.hidden = !book.canManage;
    itemForm.hidden = !book.canManage;
    U.table(list, [
      { label: 'Type', get: function (i) { return KIND[i.kind]; } },
      { label: 'Item', wrap: true, get: function (i) { return i.description; } },
      { label: 'Per', get: function (i) { return i.unit; } },
      { label: 'Cost £', numeric: true, get: function (i) { return U.money(i.costPence); } },
      { label: 'Remove', sr: true, get: function (i) {
          if (!book.canManage) return '';
          var b = U.node('button', 'pill', 'Remove');
          b.type = 'button';
          b.addEventListener('click', function () { if (global.confirm('Take ' + i.description + ' out of the price book?')) change({ op: 'unitem', id: i.id }); });
          return b;
        } }
    ], book.items, { empty: 'Add the things you price most often, at what they cost you per unit.' });
    U.table(tplList, [
      { label: 'Template', wrap: true, get: function (t) { return t.name; } },
      { label: 'Lines', numeric: true, get: function (t) { return String(t.lineCount); } },
      { label: 'Costs £', numeric: true, get: function (t) { return U.money(t.costPence); } },
      { label: 'Delete', sr: true, get: function (t) {
          if (!book.canManage) return '';
          var b = U.node('button', 'pill', 'Delete');
          b.type = 'button';
          b.addEventListener('click', function () { if (global.confirm('Delete the template ' + t.name + '?')) change({ op: 'untemplate', id: t.id }); });
          return b;
        } }
    ], book.templates, { empty: 'Save a finished quote as a template from the button above.' });
  }

  async function load(site, force) {
    if (!cache[site] || force) cache[site] = await U.get('/api/admin/pricebook?site=' + encodeURIComponent(site));
    return cache[site];
  }

  async function change(body) {
    clear();
    var res = await U.send('/api/admin/pricebook', Object.assign({ site: current }, body));
    if (!res.ok) { var e = (res.data && res.data.errors) || {}; fail(e[Object.keys(e)[0]] || 'That could not be saved.'); return false; }
    cache[current] = Object.assign({ canManage: true, site: current }, res.data);
    draw(cache[current]);
    return true;
  }

  async function jobOp(body, message) {
    clear();
    var res = await U.send('/api/admin/quoted', Object.assign({ id: Q.state.open.id }, body));
    if (!res.ok) { var e = (res.data && res.data.errors) || {}; fail(e[Object.keys(e)[0]] || message); return null; }
    Q.replace(res.data.job);
    global.DSQJOB.fill(res.data.job);
    return res.data.job;
  }

  /* ---------- actions ---------- */
  addForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var item = (cache[current].items || []).filter(function (i) { return String(i.id) === itemSel.value; })[0];
    var n = Number(String(qty.value).replace(',', '.'));
    if (!item) { fail('Choose an item from the price book.'); return; }
    if (!(n > 0)) { fail('Enter how many, more than nought.'); return; }
    var description = n === 1 && item.unit === 'each' ? item.description : fmtQty(n) + ' ' + item.unit + ' ' + item.description;
    var job = await jobOp({ op: 'qline', kind: item.kind, description: description.slice(0, 160), costPence: Math.round(n * item.costPence) }, 'That line could not be added.');
    if (job) { itemSel.value = ''; qty.value = '1'; }
  });

  useTpl.addEventListener('click', function () {
    if (!tplSel.value) { fail('Choose a template first.'); return; }
    jobOp({ op: 'fromtemplate', templateId: Number(tplSel.value) }, 'The template could not be used.');
  });

  saveTpl.addEventListener('click', function () {
    if (!Q.state.open.quote.lines.length) { fail('Add some quote lines first, then save them as a template.'); return; }
    var name = global.prompt('Name this template, for example "Re-roof, semi, concrete tile":');
    if (name && name.trim()) change({ op: 'template', jobId: Q.state.open.id, name: name.trim() });
  });

  itemForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var pence = U.toPence(cost.value);
    if (!desc.value.trim() || pence === null || !cost.value.trim()) { fail('An item needs a description and what one unit costs you.'); return; }
    if (await change({ op: 'item', kind: kindSel.value, description: desc.value.trim(), unit: unit.value.trim() || 'each', costPence: pence })) {
      desc.value = ''; cost.value = ''; desc.focus();
    }
  });

  async function fill(j) {
    current = j.site;
    clear();
    try { draw(await load(j.site)); } catch (e) { fail('The price book could not be loaded.'); }
  }

  global.DSQPB = { fill: fill };
})(window);
