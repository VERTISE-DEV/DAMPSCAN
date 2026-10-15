/* The planner on a Verge job: the pipeline stage with its next move, then
   scaffold, materials and skip (status, date, supplier, cost) and the crew,
   then the start date and expected days. A cost typed here becomes one line
   in "What it cost" and is updated in place, never added twice (see
   lib/roofing-plan.js). Once the roof is done, the finishing checklist. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var R = global.DSROOF;
  var Q = global.DSQ;
  var KINDS = [['scaffold', 'Scaffold'], ['materials', 'Materials'], ['skip', 'Skip']];
  var STATUSES = {
    scaffold: [['needed', 'Not booked'], ['booked', 'Booked'], ['up', 'Up'], ['down', 'Down'], ['not_needed', 'Not needed']],
    materials: [['needed', 'Not ordered'], ['ordered', 'Ordered'], ['delivered', 'Delivered'], ['not_needed', 'Not needed']],
    skip: [['needed', 'Not booked'], ['booked', 'Booked'], ['on_site', 'On site'], ['collected', 'Collected'], ['not_needed', 'Not needed']]
  };
  var current = null;
  var lastStatus = null;
  var block = U.node('section', 'client-block rp-block');
  block.setAttribute('aria-labelledby', 'rf-plan');
  var h = U.node('h3', null, 'Job planner');
  h.id = 'rf-plan';
  block.appendChild(h);
  var body = U.node('div');
  var err = U.node('span', 'err');
  err.setAttribute('role', 'alert');
  block.appendChild(body);
  block.appendChild(err);
  var glance = document.querySelector('.rq-block') || document.querySelector('.work-figure');
  glance.parentNode.insertBefore(block, glance.nextSibling);

  function fail(m) { err.textContent = m; err.classList.add('is-shown'); }
  function field(tag, attrs) { var i = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { i[k] = attrs[k]; }); return i; }
  function labelled(text, input) { input.setAttribute('aria-label', text); input.title = text; return input; }

  /* Every write here comes back with the card, the plan and the job, so the
     costs and the figure above move with it. */
  async function send(payload, words) {
    err.classList.remove('is-shown');
    try {
      var data = await R.write(payload, words, function () { load(current, true); });
      if (data.job) { Q.replace(data.job); global.DSQJOB.fill(data.job); }
      draw(data.card, data.plan || null);
    } catch (e) { fail(e.message); }
  }

  function stageRow(card) {
    var row = U.node('div', 'rp-row');
    row.appendChild(U.node('span', 'sv-badge', R.NAMES[card.stage]));
    row.appendChild(U.node('strong', null, card.next));
    (card.badges || []).forEach(function (b) { row.appendChild(R.badge(b)); });
    row.appendChild(R.weatherChips(card));
    var acts = U.node('div', 'rp-row');
    var go = function (to, text, cls) {
      var b = U.node('button', 'btn btn--sm ' + (cls || 'btn--ghost'), text);
      b.type = 'button';
      b.addEventListener('click', async function () {
        try { var d = await R.move(card, to, function () { load(current, true); }); if (d) { if (d.job) { Q.replace(d.job); global.DSQJOB.fill(d.job); } load(current, true); } } catch (e) { fail(e.message); }
      });
      acts.appendChild(b);
    };
    if (R.NEXT[card.stage] && !card.frozen) go(R.NEXT[card.stage][0], R.NEXT[card.stage][1], 'btn--primary');
    if (card.stage === 'quoted') go('visit', 'Book a site visit');
    if (R.BACK[card.stage] && !card.frozen) go(R.BACK[card.stage], 'Back to ' + R.NAMES[R.BACK[card.stage]].toLowerCase());
    var board = U.node('a', 'btn btn--ghost btn--sm', 'On the board');
    board.href = '/staff/roofing.html?area=roofing#job-' + card.id;
    acts.appendChild(board);
    var wrap = U.node('div', 'rp-item');
    wrap.appendChild(row);
    wrap.appendChild(acts);
    return wrap;
  }

  function taskItem(card, plan, kind, name) {
    var t = plan[kind] || {};
    var item = U.node('div', 'rp-item');
    item.appendChild(U.node('h4', null, name + (t.costLine ? ' · in What it cost' : '')));
    var row = U.node('div', 'rp-row');
    var status = labelled(name + ' status', field('select'));
    STATUSES[kind].forEach(function (s) { status.appendChild(new Option(s[1], s[0], false, s[0] === (t.status || 'needed'))); });
    var date = labelled(name + ' date', field('input', { type: 'date', value: t.date || '' }));
    var supplier = labelled(name + ' supplier', field('input', { type: 'text', value: t.supplier || '', placeholder: 'Supplier', autocomplete: 'off' }));
    var cost = labelled(name + ' cost in pounds', field('input', { type: 'text', inputMode: 'decimal', className: 'rp-cost', value: t.costPence != null ? String(t.costPence / 100) : '', placeholder: 'Cost £' }));
    var save = U.node('button', 'btn btn--ghost btn--sm', 'Save');
    save.type = 'button';
    save.addEventListener('click', function () {
      var p = cost.value.trim() === '' ? null : U.toPence(cost.value);
      if (p === null && cost.value.trim() !== '') { fail('Enter the cost in pounds.'); return; }
      send({ op: 'task', id: card.id, kind: kind, status: status.value, date: date.value || null, supplier: supplier.value, costPence: p }, name + ' saved.');
    });
    [status, date, supplier, cost, save].forEach(function (n) { row.appendChild(n); });
    item.appendChild(row);
    return item;
  }

  function crewItem(card, plan) {
    var item = U.node('div', 'rp-item');
    item.appendChild(U.node('h4', null, 'Crew'));
    var row = U.node('div', 'rp-row');
    plan.crew.forEach(function (c) {
      var chip = U.node('button', 'pill', c.name + ' ✕');
      chip.type = 'button';
      chip.setAttribute('aria-label', 'Take ' + c.name + ' off this job');
      chip.addEventListener('click', function () { send({ op: 'task', id: card.id, kind: 'crew', personId: c.personId, remove: true }, c.name + ' taken off.'); });
      row.appendChild(chip);
    });
    if (!plan.crew.length) row.appendChild(U.node('span', 'who', 'Nobody yet.'));
    var pick = labelled('Add to the crew', field('select'));
    pick.appendChild(new Option('Add someone…', ''));
    (Q.state.people || []).filter(function (p) {
      return p.active !== false && p.businesses.some(function (b) { return b.slug === card.site; }) && !plan.crew.some(function (c) { return c.personId === p.id; });
    }).forEach(function (p) { pick.appendChild(new Option(p.name, String(p.id))); });
    pick.addEventListener('change', function () { if (pick.value) send({ op: 'task', id: card.id, kind: 'crew', personId: Number(pick.value), status: 'confirmed' }, 'Crew added.'); });
    row.appendChild(pick);
    item.appendChild(row);
    var days = U.node('div', 'rp-row');
    days.appendChild(U.node('span', 'who', card.jobDate ? 'Starts ' + R.shortDate(card.jobDate) : 'No start date yet'));
    var exp = labelled('Expected days on the roof', field('input', { type: 'text', inputMode: 'decimal', className: 'rp-cost', value: card.expectedDays || '', placeholder: 'Days' }));
    var save = U.node('button', 'btn btn--ghost btn--sm', 'Set days');
    save.type = 'button';
    save.addEventListener('click', function () { send({ op: 'plan', id: card.id, expectedDays: exp.value.trim() === '' ? null : Number(exp.value) }, 'Expected days saved.'); });
    [exp, save].forEach(function (n) { days.appendChild(n); });
    item.appendChild(days);
    return item;
  }

  function draw(card, plan) {
    if (!card) return;
    if (!plan) { load(card.id, true); return; }
    body.textContent = '';
    body.appendChild(stageRow(card));
    if (card.finish) {
      var fin = U.node('div', 'rp-item');
      fin.appendChild(U.node('h4', null, 'Finishing off'));
      fin.appendChild(R.finishList(card, function () { load(card.id, true); }, function (c, kind) { R.messageDialog(c, kind, function () { load(card.id, true); }); }));
      body.appendChild(fin);
    }
    var list = U.node('div', 'rp-list');
    KINDS.forEach(function (k) { list.appendChild(taskItem(card, plan, k[0], k[1])); });
    list.appendChild(crewItem(card, plan));
    body.appendChild(list);
  }

  async function load(id, force) {
    if (!force && current === id) return;
    current = id;
    try {
      var data = await U.get('/api/admin/roofing?view=job&id=' + id);
      if (current === id) draw(data.card, data.plan);
    } catch (e) { fail('The planner could not be loaded.'); }
  }

  function fill(j) {
    block.hidden = j.site !== 'roofing' || ['declined', 'cancelled', 'refunded'].indexOf(j.status) !== -1;
    if (block.hidden) return;
    /* A status saved in the details form moves the stage, so it reloads. */
    var moved = lastStatus !== null && lastStatus !== j.status && current === j.id;
    lastStatus = j.status;
    load(j.id, moved);
  }

  document.getElementById('job-dialog').addEventListener('close', function () { current = null; lastStatus = null; body.textContent = ''; });
  global.DSQPLAN = { fill: fill };
})(window);
