/* The Calendar: the place to work from. A Today panel (today's visits in time
   order and everything outstanding, grouped, with one-tap actions from
   calendar-actions.js), then the calendar itself as a month, a week or one
   day. Each job on the calendar carries small badges for what is still
   outstanding on it; a day opens as an agenda with those actions inline.
   Jobs move by dragging on a desktop, or with Move on a phone, through the
   same routes the job screens use. "Add to my calendar" writes the visible
   range as an .ics file, so it reaches a phone or Outlook without the staff
   area holding anybody's calendar login. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var W = global.DSWORK;
  var el = function (id) { return document.getElementById(id); };
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var BADGE = { messages: 'Message', deposits: 'Deposit', payments: 'Unpaid', invoices: 'Overdue', payouts: 'Payout', reports: 'Report', remedial: 'Remedial', agent: 'Agent', quotes: 'Chase', budget: 'Budget', todos: 'To-do', prep: 'Prep', finish: 'Finish' };
  var today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  var VIEW_KEY = 'ds_cal_view';
  var stored = function () { try { return global.localStorage.getItem(VIEW_KEY); } catch (e) { return null; } };
  var state = { view: ['month', 'week', 'day'].indexOf(stored()) !== -1 ? stored() : 'month', cursor: today, area: (['damp', 'roofing', 'ac'].indexOf(new URLSearchParams(location.search).get('area')) !== -1 ? new URLSearchParams(location.search).get('area') : ''), events: [], todayEvents: [], work: null };

  /* Dates are YYYY-MM-DD strings read at noon UTC, so no clock change can
     move an event onto the next or previous day. */
  function at(iso) { return new Date(iso + 'T12:00:00Z'); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = at(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function monday(s) { return addDays(s, -((at(s).getUTCDay() + 6) % 7)); }
  function longDay(s) { return at(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); }

  function range() {
    if (state.view === 'day') return { from: state.cursor, to: state.cursor };
    if (state.view === 'week') return { from: monday(state.cursor), to: addDays(monday(state.cursor), 6) };
    var first = state.cursor.slice(0, 7) + '-01';
    var next = at(first); next.setUTCMonth(next.getUTCMonth() + 1);
    var last = addDays(iso(next), -1);
    return { from: monday(first), to: addDays(monday(last), 6) };
  }

  function title() {
    var r = range();
    if (state.view === 'day') return state.cursor === today ? 'Today, ' + longDay(today) : longDay(state.cursor);
    if (state.view === 'week') return 'Week of ' + at(r.from).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return at(state.cursor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  function hrefFor(e) { return e.kind === 'service' ? W.jobHref(e.site, e.jobId, true) : W.jobHref(e.site, e.id, e.quoted); }
  function movable(e) { return e.kind === 'job' && e.status !== 'paid'; }

  /* One event: its colour, time, first name and postcode, and a badge for
     each kind of thing still outstanding on the job. */
  function chip(e, long) {
    var href = hrefFor(e);
    var a = document.createElement(href ? 'a' : 'span');
    if (href) a.href = href;
    a.className = 'ev ev--' + e.site + (e.kind === 'service' ? ' ev--service' : '') + (e.status === 'completed' || e.status === 'paid' ? ' ev--done' : '');
    var who = [String(e.customerName || 'No name').split(' ')[0], e.postcode].filter(Boolean).join(', ');
    a.appendChild(U.node('span', 'ev-text', (e.time ? e.time + ' ' : '') + (e.kind === 'service' ? 'Service: ' : '') + (long ? W.NAME[e.site] + ': ' : '') + who));
    /* In a month cell the badges are dots, so the name keeps the room; the
       word is the dot's tooltip and the day view spells it out. */
    var flags = (e.flags || []).filter(function (f) { return BADGE[f]; });
    if (e.awaitingAgent && flags.indexOf('agent') === -1) flags.push('agent');
    flags.forEach(function (f) {
      var b = U.node('span', (long ? 'badge' : 'dot') + ' badge--' + f, long ? BADGE[f] : '');
      b.title = BADGE[f];
      a.appendChild(b);
    });
    if (!long && flags.length) a.setAttribute('aria-label', a.textContent + ', outstanding: ' + flags.map(function (f) { return BADGE[f]; }).join(', '));
    a.title = W.NAME[e.site] + ': ' + (e.customerName || '') + ' (' + e.status + ')';
    if (movable(e)) {
      a.draggable = true;
      a.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/plain', String(e.id)); ev.dataTransfer.effectAllowed = 'move'; });
    }
    return a;
  }
  function byDay() {
    var map = {};
    state.events.forEach(function (e) { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  }
  function items() {
    var all = [];
    ((state.work && state.work.groups) || []).forEach(function (g) { all = all.concat(g.items); });
    return all;
  }

  function move(e, date, time) {
    var it = { jobId: e.id, quoted: e.quoted, status: e.status };
    return U.send('/api/admin/' + (e.quoted ? 'quoted' : 'clients'), W.moveBody(it, date, time)).then(function (r) {
      if (!r.ok) throw new Error('Not moved');
      return load();
    }).catch(function (err) { el('state').hidden = false; el('state').textContent = err.message; });
  }

  function dropTarget(node, date) {
    node.addEventListener('dragover', function (ev) { ev.preventDefault(); node.classList.add('is-target'); });
    node.addEventListener('dragleave', function () { node.classList.remove('is-target'); });
    node.addEventListener('drop', function (ev) {
      ev.preventDefault();
      node.classList.remove('is-target');
      var id = Number(ev.dataTransfer.getData('text/plain'));
      var e = state.events.find(function (x) { return x.kind === 'job' && x.id === id; });
      if (e && e.date !== date) move(e, date, e.time);
    });
  }

  function openDay(date) { state.view = 'day'; state.cursor = date; remember(); load(); }

  function drawMonth(mount) {
    var r = range();
    var days = byDay();
    var grid = U.node('div', 'cal');
    grid.setAttribute('role', 'grid');
    DOW.forEach(function (d) { grid.appendChild(U.node('div', 'cal-dow', d)); });
    for (var d = r.from; d <= r.to; d = addDays(d, 1)) {
      var list = days[d] || [];
      var cell = U.node('div', 'cal-day' + (d.slice(0, 7) !== state.cursor.slice(0, 7) ? ' is-out' : '') + (d === today ? ' is-today' : '') + (d < today ? ' is-past' : ''));
      cell.setAttribute('role', 'gridcell');
      var num = U.node('button', 'cal-num', String(Number(d.slice(8))));
      num.type = 'button';
      num.setAttribute('aria-label', longDay(d) + ', ' + list.length + ' on');
      num.addEventListener('click', openDay.bind(null, d));
      cell.appendChild(num);
      if (list.length) cell.appendChild(U.node('span', 'cal-count', String(list.length)));
      list.forEach(function (e) { cell.appendChild(chip(e, false)); });
      if (list.some(function (e) { return (e.flags || []).length; })) cell.classList.add('has-flags');
      cell.addEventListener('click', function (date, ev) { if (ev.target === ev.currentTarget) openDay(date); }.bind(null, d));
      dropTarget(cell, d);
      grid.appendChild(cell);
    }
    mount.appendChild(grid);
  }

  /* One day as an agenda: each event with Move, and under it the actions on
     that job; then anything else dated that day. */
  function dayBlock(date, withActions) {
    var box = U.node('section', 'day-block' + (date === today ? ' is-today' : ''));
    var h = U.node('h3', null, date === today ? 'Today' : longDay(date));
    if (state.view !== 'day') { h.className = 'day-link'; h.tabIndex = 0; h.addEventListener('click', openDay.bind(null, date)); }
    box.appendChild(h);
    dropTarget(box, date);
    var list = (byDay()[date] || []);
    var used = {};
    var all = withActions ? items() : [];
    list.forEach(function (e) {
      var row = U.node('div', 'day-ev');
      row.appendChild(chip(e, true));
      if (movable(e)) {
        var b = U.node('button', 'pill act', 'Move');
        b.type = 'button';
        b.addEventListener('click', function () { askMove(e); });
        row.appendChild(b);
      }
      box.appendChild(row);
      if (e.kind === 'job') all.filter(function (it) { return it.jobId === e.id; }).forEach(function (it) {
        used[it.key] = true;
        box.appendChild(wrapItem(it));
      });
    });
    all.filter(function (it) { return !used[it.key] && it.date === date; }).forEach(function (it) { box.appendChild(wrapItem(it)); });
    if (box.children.length === 1) box.appendChild(U.node('p', 'panel-note', 'Nothing on.'));
    return box;
  }

  function wrapItem(it) { var ul = U.node('ul', 'act-list act-list--inline'); ul.appendChild(W.itemRow(it, refreshSoon)); return ul; }

  function drawWeek(mount) {
    var r = range();
    var wrap = U.node('div', 'week');
    for (var d = r.from; d <= r.to; d = addDays(d, 1)) wrap.appendChild(dayBlock(d, false));
    mount.appendChild(wrap);
  }

  /* The move dialog: a date and an optional time, for phones that cannot drag. */
  function askMove(e) {
    var dlg = el('move-dialog');
    el('move-who').textContent = (e.customerName || 'No name') + (e.postcode ? ', ' + e.postcode : '');
    el('move-date').value = e.date;
    el('move-time').value = e.time || '';
    dlg.onsubmit = function (ev) {
      if (ev.submitter && ev.submitter.value === 'cancel') return;
      ev.preventDefault();
      dlg.close();
      move(e, el('move-date').value, el('move-time').value);
    };
    dlg.showModal();
  }

  function strip(id, list) {
    var box = el(id);
    box.hidden = !list.length;
    var ul = box.querySelector('ul');
    ul.textContent = '';
    box.querySelector('.strip-count').textContent = String(list.length);
    list.forEach(function (it) { ul.appendChild(W.itemRow(it, refreshSoon)); });
  }

  function drawToday() {
    var visits = el('today-visits');
    visits.textContent = '';
    var list = state.todayEvents.slice().sort(function (a, b) { return String(a.time || '99').localeCompare(String(b.time || '99')); });
    if (!list.length) visits.appendChild(U.node('p', 'panel-note', 'Nothing booked today.'));
    list.forEach(function (e) { visits.appendChild(chip(e, true)); });
    var total = state.work ? state.work.total : 0;
    el('act-total').textContent = total ? String(total) : '';
    W.render(el('actions'), state.work, refreshSoon);
  }

  function render() {
    el('title').textContent = title();
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)); });
    document.querySelectorAll('[data-area-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-area-filter') === state.area)); });
    drawToday();
    strip('overdue', items().filter(function (it) { return it.overdue; }));
    strip('confirm', items().filter(function (it) { return it.group === 'agent'; }));
    var mount = el('cal-view');
    mount.textContent = '';
    if (state.view === 'month') drawMonth(mount);
    else if (state.view === 'week') drawWeek(mount);
    else mount.appendChild(dayBlock(state.cursor, true));
  }

  var timer = null;
  /* After an action the item has already gone; the counts and badges catch
     up a moment later, once, however many things were ticked in a row. */
  function refreshSoon() { clearTimeout(timer); timer = setTimeout(load, 1200); }

  async function load() {
    var r = range();
    try {
      var data = await U.get('/api/admin/calendar?view=work&from=' + r.from + '&to=' + r.to + (state.area ? '&area=' + state.area : ''));
      state.events = data.events || [];
      state.todayEvents = data.todayEvents || [];
      state.work = data.work;
      el('state').hidden = true;
      el('content').hidden = false;
      render();
    } catch (e) {
      el('state').hidden = false;
      el('state').textContent = e.message || 'Could not load.';
    }
  }

  function remember() { try { global.localStorage.setItem(VIEW_KEY, state.view); } catch (e) {} }

  function shift(n) {
    if (state.view === 'day') state.cursor = addDays(state.cursor, n);
    else if (state.view === 'week') state.cursor = addDays(state.cursor, 7 * n);
    else { var d = at(state.cursor.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() + n); state.cursor = iso(d); }
    load();
  }

  function ics() {
    var esc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n'); };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Staff area//Calendar//EN', 'CALSCALE:GREGORIAN'];
    state.events.forEach(function (e) {
      lines.push('BEGIN:VEVENT', 'UID:' + e.kind + '-' + e.id + '-' + e.date + '@staff', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + e.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''),
        'SUMMARY:' + esc(W.NAME[e.site] + ': ' + (e.time ? e.time + ' ' : '') + [e.customerName, e.postcode].filter(Boolean).join(', ')), 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    a.download = 'calendar-' + range().from + '.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  document.querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); remember(); load(); });
  });
  document.querySelectorAll('[data-area-filter]').forEach(function (b) {
    b.addEventListener('click', function () { state.area = b.getAttribute('data-area-filter'); load(); });
  });
  el('prev').addEventListener('click', function () { shift(-1); });
  el('next').addEventListener('click', function () { shift(1); });
  el('today').addEventListener('click', function () { state.cursor = today; load(); });
  el('ics').addEventListener('click', ics);
  el('refresh').addEventListener('click', load);
  el('logout').addEventListener('click', async function () {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.replace('/staff');
  });
  /* Company filters for the companies this person holds; one company needs none. */
  U.get('/api/admin/me').catch(function () { return null; }).then(function (me) {
    if (!me || !me.businesses) return;
    var held = me.businesses.map(function (b) { return W.AREA_OF[b.slug]; });
    document.querySelectorAll('[data-area-filter]').forEach(function (b) {
      var a = b.getAttribute('data-area-filter');
      if (a && held.indexOf(a) === -1) b.remove();
    });
    if (document.querySelectorAll('[data-area-filter]').length <= 2) el('filters').hidden = true;
  });
  global.DSTODAY = { refresh: load };
  load();
})(window);
