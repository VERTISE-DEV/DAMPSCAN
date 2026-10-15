/* The ATi and DampScan survey board: Enquiry, Booked, Surveyed, Paid, then
   Report sent (finished, folded away). Columns come from the server
   (lib/surveys.js); a card moves by dragging to a neighbouring column or by
   its buttons, and every change offers Undo. A survey waiting on the estate
   agent stays in Booked with a badge: it is the exception, not a stage. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var S = global.DSSV;
  var COLS = [['enquiry', 'Enquiry'], ['booked', 'Booked'], ['surveyed', 'Surveyed'], ['paid', 'Paid'], ['sent', 'Report sent']];
  var NEXT = { booked: ['surveyed', 'Mark surveyed'], surveyed: ['paid', 'Paid in full'], paid: ['sent', 'Report sent'] };
  var PREV = { surveyed: 'booked', paid: 'surveyed', sent: 'paid' };
  var state = { data: null, site: '', surveyor: '', q: '', agentOnly: false, dragging: null, focus: null };
  var el = function (id) { return document.getElementById(id); };

  function matches(s) {
    if (state.site && s.site !== state.site) return false;
    if (state.surveyor && s.surveyor && s.surveyor !== state.surveyor) return false;
    if (state.agentOnly && !s.awaitingAgent) return false;
    if (!state.q) return true;
    var hay = [s.name, s.postcode, s.street, s.phone, s.email, s.agent && s.agent.name].join(' ').toLowerCase();
    return hay.indexOf(state.q) !== -1;
  }

  function tick(s, what, label, on) {
    var b = U.node('button', 'sv-tick' + (on ? ' is-on' : ''), (on ? '✓ ' : '') + label);
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', function () { run(b, { op: 'tick', id: s.id, what: what, on: !on }, label + (on ? ' unticked.' : ' ticked.')); });
    return b;
  }

  async function run(node, body, words) {
    var card = node.closest('.sv-card');
    if (card) card.classList.add('is-busy');
    try { await S.write(body, words, load); load(); } catch (e) {
      if (card) { card.classList.remove('is-busy'); (card.querySelector('.act-err') || card.appendChild(U.node('p', 'act-err'))).textContent = e.message; }
    }
  }

  function remedialPrompt(s) {
    var box = U.node('div', 'sv-remedial');
    var r = s.remedial;
    if (r.status === 'won') { box.appendChild(U.node('p', 'card-meta', 'Remedial work won: ' + U.money(r.wonPence))); return box; }
    if (r.status === 'declined') { box.appendChild(U.node('p', 'card-meta', 'No remedial work wanted.')); return box; }
    box.appendChild(U.node('p', 'sv-msg-title', r.status === 'quoting' ? 'Quoting remedial work' + (r.quotePence ? ': ' + U.money(r.quotePence) : '') : 'Quote remedial work?'));
    var amount = document.createElement('input');
    amount.type = 'number'; amount.min = '0'; amount.step = '1'; amount.inputMode = 'decimal'; amount.placeholder = '£ amount';
    amount.className = 'sv-input sv-amount';
    amount.setAttribute('aria-label', 'Remedial amount in pounds');
    if (r.quotePence) amount.value = String(r.quotePence / 100);
    var send = function (status, words) {
      var p = amount.value === '' ? null : Math.round(Number(amount.value) * 100);
      run(box, { op: 'remedial', id: s.id, status: status, amountPence: p }, words);
    };
    var row = U.node('div', 'card-actions');
    row.appendChild(amount);
    row.appendChild(S.button('Quoting', function () { send('quoting', 'Marked quoting.'); }));
    row.appendChild(S.button('Won', function () { send('won', 'Remedial work won.'); }, 'act-main'));
    row.appendChild(S.button('Not wanted', function () { send('declined', 'Marked not wanted.'); }));
    box.appendChild(row);
    if (r.nudge) box.classList.add('is-nudge');
    return box;
  }

  function surveyCard(s) {
    var c = U.node('article', 'sv-card ev--' + s.site);
    c.id = 'job-' + s.id;
    c.draggable = true;
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('span', 'card-name', [s.firstName || 'No name', s.postcode].filter(Boolean).join(', ')));
    top.appendChild(U.node('span', 'act-biz', S.BRAND[s.site]));
    c.appendChild(top);
    c.appendChild(U.node('p', 'card-meta', [s.surveyLabel, S.cap(s.surveyor), s.date ? S.shortDate(s.date) + (s.time ? ' ' + s.time : '') : ''].filter(Boolean).join(' · ')));
    if (s.awaitingAgent) c.appendChild(U.node('p', 'sv-badge sv-badge--agent', 'Time to confirm with ' + (s.agent ? s.agent.name : 'the agent')));
    else if (s.agent) c.appendChild(U.node('p', 'card-meta', 'Agent: ' + s.agent.name + (s.agent.branch ? ', ' + s.agent.branch : '')));
    if (s.reportDays != null) c.appendChild(U.node('p', 'sv-badge' + (s.reportLate ? ' sv-badge--late' : ''), 'Report owed ' + s.reportDays + ' day' + (s.reportDays === 1 ? '' : 's')));
    var ticks = U.node('div', 'sv-ticks');
    ticks.appendChild(tick(s, 'deposit', 'Deposit', s.deposit));
    ticks.appendChild(tick(s, 'paid', 'Paid', s.paid));
    ticks.appendChild(tick(s, 'report', 'Report', s.reportSent));
    c.appendChild(ticks);
    var bar = U.node('div', 'card-actions');
    if (NEXT[s.stage]) bar.appendChild(S.button(NEXT[s.stage][1], function () { run(bar, { op: 'move', id: s.id, to: NEXT[s.stage][0] }, 'Moved on.'); }, 'act-main'));
    if (s.stage === 'booked') bar.appendChild(S.button(s.awaitingAgent ? 'Agent confirmed' : 'Waiting on agent', function () {
      run(bar, { op: 'agent', id: s.id, awaitingAgent: !s.awaitingAgent }, s.awaitingAgent ? 'Agent wait cleared.' : 'Marked waiting on the agent.');
    }));
    if (s.phone) bar.appendChild(S.link('Call', S.tel(s.phone)));
    bar.appendChild(S.button('Messages', function () { openMessages(s.id); }));
    if (PREV[s.stage]) bar.appendChild(S.button('Back', function () { run(bar, { op: 'move', id: s.id, to: PREV[s.stage] }, 'Moved back.'); }, 'sv-back'));
    c.appendChild(bar);
    if (s.stage === 'sent') c.appendChild(remedialPrompt(s));
    c.addEventListener('dragstart', function (e) { state.dragging = s; c.classList.add('is-dragging'); e.dataTransfer.setData('text/plain', String(s.id)); });
    c.addEventListener('dragend', function () { state.dragging = null; c.classList.remove('is-dragging'); });
    if (state.focus === s.id) c.classList.add('is-focus');
    return c;
  }

  function enquiryCard(e) {
    var c = U.node('article', 'sv-card ev--' + e.site);
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('span', 'card-name', [e.firstName || 'No name', e.postcode].filter(Boolean).join(', ')));
    top.appendChild(U.node('span', 'act-biz', S.BRAND[e.site]));
    c.appendChild(top);
    c.appendChild(U.node('p', 'card-meta', 'Enquired ' + U.when(e.createdAt) + (e.issues.length ? ' · ' + e.issues.join(', ') : '')));
    var bar = U.node('div', 'card-actions');
    bar.appendChild(S.button('Book survey', function () { global.DSBOOK.open(e, load); }, 'act-main'));
    if (e.phone) bar.appendChild(S.link('Call', S.tel(e.phone)));
    c.appendChild(bar);
    return c;
  }

  function canDrop(s, to) { return s && ((NEXT[s.stage] && NEXT[s.stage][0] === to) || PREV[s.stage] === to); }

  function draw() {
    var board = el('board');
    board.textContent = '';
    var d = state.data;
    COLS.forEach(function (col) {
      var items = col[0] === 'enquiry' ? d.enquiries.filter(function (e) { return matches(e); })
        : d.surveys.filter(function (s) { return s.stage === col[0] && matches(s); });
      var box = document.createElement('details');
      box.className = 'sv-col col';
      box.open = col[0] !== 'sent' || items.some(function (s) { return s.id === state.focus || s.remedial.nudge; });
      var head = U.node('summary', 'col-head');
      head.appendChild(U.node('h2', null, col[1]));
      head.appendChild(U.node('span', null, String(items.length)));
      box.appendChild(head);
      items.forEach(function (it) { box.appendChild(col[0] === 'enquiry' ? enquiryCard(it) : surveyCard(it)); });
      if (!items.length) box.appendChild(U.node('p', 'card-meta', 'Nothing here.'));
      box.addEventListener('dragover', function (e) { if (canDrop(state.dragging, col[0])) { e.preventDefault(); box.classList.add('is-target'); } });
      box.addEventListener('dragleave', function () { box.classList.remove('is-target'); });
      box.addEventListener('drop', function (e) {
        e.preventDefault();
        box.classList.remove('is-target');
        var s = state.dragging;
        if (canDrop(s, col[0])) run(board, { op: 'move', id: s.id, to: col[0] }, 'Moved to ' + col[1] + '.');
      });
      board.appendChild(box);
    });
    var f = state.focus && el('job-' + state.focus);
    if (f) { f.scrollIntoView({ block: 'center' }); state.focus = null; }
  }

  async function openMessages(id) {
    var dlg = el('msg-dialog');
    dlg.textContent = 'Loading…';
    dlg.showModal();
    var data = await U.get('/api/admin/surveys?view=messages&id=' + id);
    global.DSBOOK.drawMessages(dlg, data);
  }

  async function load() {
    try {
      state.data = await U.get('/api/admin/surveys');
      el('state').hidden = true;
      el('content').hidden = false;
      draw();
    } catch (e) { el('state').textContent = 'Could not load the surveys. ' + e.message; }
  }

  document.querySelectorAll('.sv-bar [data-site]').forEach(function (p) {
    p.addEventListener('click', function () {
      state.site = p.getAttribute('data-site');
      document.querySelectorAll('.sv-bar [data-site]').forEach(function (x) { x.classList.toggle('is-on', x === p); });
      draw();
    });
  });
  el('sv-surveyor').addEventListener('change', function () { state.surveyor = this.value; draw(); });
  el('sv-q').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); draw(); });
  el('sv-agent').addEventListener('change', function () { state.agentOnly = this.checked; draw(); });
  el('sv-new').addEventListener('click', function () { global.DSBOOK.open(null, load); });
  var refresh = el('refresh');
  if (refresh) refresh.addEventListener('click', load);
  var m = /^#job-(\d+)/.exec(global.location.hash);
  if (m) state.focus = Number(m[1]);
  if (global.location.hash === '#new') global.DSBOOK.open(null, load);
  load();
})(window);
