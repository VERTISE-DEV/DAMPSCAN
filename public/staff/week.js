/* The Verge week board: Monday to Saturday, each day's roofs with the crew's
   initials, the forecast, the planner's state and what the job is waiting
   on. A job shows on every working day it covers. Dragging it to another
   day (or Move, on a phone) changes its start date, with Undo. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var R = global.DSROOF;
  var el = function (id) { return document.getElementById(id); };
  var state = { from: null, data: null, dragging: null };
  var PLAN = [['scaffold', 'Scaffold'], ['materials', 'Materials'], ['skip', 'Skip']];
  var GOOD = { booked: 1, up: 1, down: 1, ordered: 1, delivered: 1, on_site: 1, collected: 1, not_needed: 1 };
  var WORDS = { needed: 'not sorted', not_needed: 'not needed', booked: 'booked', up: 'up', down: 'down', ordered: 'ordered', delivered: 'delivered', on_site: 'on site', collected: 'collected' };

  function monday(iso) { var d = new Date(iso + 'T12:00:00Z'); return R.addDays(iso, -((d.getUTCDay() + 6) % 7)); }

  /* What a job is waiting on, in the words a crew uses. */
  function waits(c, day) {
    var out = [];
    if (c.plan.materials === 'needed' || c.plan.materials === 'ordered') out.push('Waiting on materials');
    var w = (c.weather || []).filter(function (x) { return x.date === day && x.warn; })[0];
    if (w) out.push('Weather: ' + w.warn);
    return out;
  }

  function jobCard(c, day) {
    var card = U.node('article', 'sv-card rf-card wk-card rf-' + c.stage);
    card.draggable = c.days[0] === day && !c.frozen;
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('a', 'card-name', [c.firstName || 'No name', c.postcode].filter(Boolean).join(', ')));
    top.firstChild.href = R.jobHref(c.id) + '-plan';
    var wx = (c.weather || []).filter(function (x) { return x.date === day; })[0];
    if (wx) {
      var chip = U.node('span', 'rf-wx' + (wx.warn ? ' is-warn' : ''), wx.icon);
      chip.title = wx.word + (wx.rainChance != null ? ', ' + wx.rainChance + '% rain' : '') + (wx.gustMph != null ? ', gusts ' + wx.gustMph + 'mph' : '');
      chip.setAttribute('aria-label', chip.title);
      top.appendChild(chip);
    }
    card.appendChild(top);
    var dayNo = c.days.indexOf(day) + 1;
    var meta = U.node('p', 'card-meta rf-meta', (c.jobTime && dayNo === 1 ? c.jobTime + ' · ' : '') + (c.expectedDays > 1 ? 'Day ' + dayNo + ' of ' + Math.ceil(c.expectedDays) : R.NAMES[c.stage]));
    meta.appendChild(R.crewChips(c));
    if (!c.crew.length) meta.appendChild(U.node('span', 'rf-nocrew', 'No crew'));
    card.appendChild(meta);
    var plan = U.node('div', 'wk-plan');
    PLAN.forEach(function (p) {
      var s = c.plan[p[0]];
      if (s === 'not_needed') return;
      plan.appendChild(U.node('span', 'wk-step' + (GOOD[s] ? ' is-ok' : ''), (GOOD[s] ? '✓ ' : '') + p[1] + ' ' + WORDS[s]));
    });
    card.appendChild(plan);
    waits(c, day).forEach(function (w) { card.appendChild(U.node('span', 'sv-badge sv-badge--late', w)); });
    if (card.draggable) {
      var bar = U.node('div', 'card-actions');
      var mv = U.node('button', 'pill act', 'Move');
      mv.type = 'button';
      mv.addEventListener('click', async function () {
        var got = await R.askDate('New start date for ' + (c.firstName || 'this job'), c.jobDate, false);
        if (got) moveTo(c, got.date);
      });
      bar.appendChild(mv);
      card.appendChild(bar);
      card.addEventListener('dragstart', function (e) { state.dragging = c; card.classList.add('is-dragging'); e.dataTransfer.setData('text/plain', String(c.id)); });
      card.addEventListener('dragend', function () { state.dragging = null; card.classList.remove('is-dragging'); });
    }
    return card;
  }

  async function moveTo(c, date) {
    if (date === c.jobDate) return;
    try { await R.write({ op: 'date', id: c.id, date: date }, (c.firstName || 'Job') + ' moved to ' + R.shortDate(date) + '.', load); } catch (e) { global.alert(e.message); }
    load();
  }

  function draw() {
    var d = state.data;
    var board = el('board');
    board.textContent = '';
    el('wk-title').textContent = 'Week of ' + R.shortDate(d.from);
    d.days.forEach(function (day) {
      var col = U.node('section', 'col wk-day' + (day === d.today ? ' is-today' : ''));
      col.setAttribute('aria-label', R.shortDate(day));
      var head = U.node('div', 'col-head');
      head.appendChild(U.node('h2', null, R.shortDate(day)));
      var jobs = d.jobs.filter(function (j) { return j.days.indexOf(day) !== -1; });
      head.appendChild(U.node('span', null, jobs.length ? String(jobs.length) : ''));
      col.appendChild(head);
      jobs.forEach(function (j) { col.appendChild(jobCard(j, day)); });
      if (!jobs.length) col.appendChild(U.node('p', 'card-meta', 'Nothing booked.'));
      col.addEventListener('dragover', function (e) { if (state.dragging) { e.preventDefault(); col.classList.add('is-target'); } });
      col.addEventListener('dragleave', function () { col.classList.remove('is-target'); });
      col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('is-target'); if (state.dragging) moveTo(state.dragging, day); });
      board.appendChild(col);
    });
  }

  async function load() {
    try {
      state.data = await U.get('/api/admin/roofing?view=week&from=' + state.from);
      el('state').hidden = true;
      el('content').hidden = false;
      draw();
    } catch (e) { el('state').textContent = 'Could not load the week. ' + e.message; el('state').hidden = false; }
  }

  function go(from) {
    state.from = from;
    try { history.replaceState(null, '', location.pathname + '?area=roofing&from=' + from); } catch (e) { /* the address is a convenience */ }
    load();
  }

  var asked = new URLSearchParams(location.search).get('from');
  state.from = monday(/^\d{4}-\d{2}-\d{2}$/.test(asked || '') ? asked : R.londonToday());
  el('wk-prev').addEventListener('click', function () { go(R.addDays(state.from, -7)); });
  el('wk-next').addEventListener('click', function () { go(R.addDays(state.from, 7)); });
  el('wk-today').addEventListener('click', function () { go(monday(R.londonToday())); });
  var refresh = el('refresh');
  if (refresh) refresh.addEventListener('click', load);
  var out = el('logout');
  if (out) out.addEventListener('click', async function () { await fetch('/api/auth/logout', { method: 'POST' }); location.replace('/staff'); });
  load();
})(window);
