/* The Verge Roofing pipeline: Enquiry, Site visit, Quoted, Accepted, Booked,
   In progress, Done, Paid, Reviewed. Each card says who and where, what the
   job is worth, the one next thing to do, how long it has sat there and what
   is missing. Columns come from the server (lib/roofing.js); a card moves by
   dragging or by its buttons, and every move offers Undo. On a phone the
   columns stack and fold, with the finished ones folded. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var R = global.DSROOF;
  var state = { data: null, q: '', badge: '', dragging: null, focus: null };
  var el = function (id) { return document.getElementById(id); };
  var FOLDED = { paid: 1, reviewed: 1 };

  function matches(c) {
    if (state.badge === 'any' && !(c.badges || []).length) return false;
    if (state.badge === 'finish' && !(c.finish || []).some(function (f) { return !f.done; })) return false;
    if (state.badge && state.badge !== 'any' && state.badge !== 'finish' && (c.badges || []).indexOf(state.badge) === -1) return false;
    if (!state.q) return true;
    return [c.name, c.firstName, c.postcode, c.phone, c.email, c.note, (c.issues || []).join(' ')].join(' ').toLowerCase().indexOf(state.q) !== -1;
  }

  async function run(node, fn) {
    var card = node.closest('.sv-card');
    if (card) card.classList.add('is-busy');
    try { await fn(); } catch (e) {
      if (card) { card.classList.remove('is-busy'); (card.querySelector('.act-err') || card.appendChild(U.node('p', 'act-err'))).textContent = e.message; }
      return;
    }
    load();
  }

  function button(text, onClick, cls) {
    var b = U.node('button', 'pill act ' + (cls || ''), text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function link(text, href, cls) { var a = U.node('a', 'pill act ' + (cls || ''), text); a.href = href; return a; }

  function jobCard(c) {
    var card = U.node('article', 'sv-card rf-card rf-' + c.stage);
    card.id = 'job-' + c.id;
    card.draggable = !c.frozen && Boolean(R.NEXT[c.stage] || R.BACK[c.stage]);
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('span', 'card-name', [c.firstName || 'No name', c.postcode].filter(Boolean).join(', ')));
    if (c.valuePence != null) top.appendChild(U.node('span', 'card-value', U.money(c.valuePence)));
    card.appendChild(top);
    card.appendChild(U.node('p', 'rf-next', c.next));
    var meta = [c.stageDays + (c.stageDays === 1 ? ' day' : ' days') + ' in ' + R.NAMES[c.stage].toLowerCase()];
    if (['booked', 'in_progress', 'done'].indexOf(c.stage) !== -1 && c.jobDate) meta.push(R.shortDate(c.jobDate) + (c.expectedDays ? ', ' + c.expectedDays + ' days' : ''));
    if (c.stage === 'visit' && c.siteVisitOn) meta.push('Visit ' + R.shortDate(c.siteVisitOn));
    if (c.acceptedOnline) meta.push('Accepted online');
    var line = U.node('p', 'card-meta rf-meta', meta.join(' · '));
    line.appendChild(R.crewChips(c));
    line.appendChild(R.weatherChips(c));
    card.appendChild(line);
    if ((c.badges || []).length) {
      var badges = U.node('div', 'rf-badges');
      c.badges.forEach(function (b) { badges.appendChild(R.badge(b)); });
      card.appendChild(badges);
    }
    if (c.finish) card.appendChild(R.finishList(c, load, function (job, kind) { R.messageDialog(job, kind, load); }));
    var bar = U.node('div', 'card-actions');
    if (R.NEXT[c.stage] && !c.frozen) bar.appendChild(button(R.NEXT[c.stage][1], function () { run(bar, function () { return R.move(c, R.NEXT[c.stage][0], load); }); }, 'act-main'));
    /* One next step on the card; the rest (call, plan, back, lost, money)
       is in the job sheet a tap away, or on the job page it links to. */
    card.classList.add('is-compact');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    var open = function () { if (global.DSPOP) global.DSPOP.open(c.id, { onChange: load }); else global.location.href = R.jobHref(c.id); };
    card.addEventListener('click', function (e) { if (!e.target.closest('button,a,input,select,label,textarea')) open(); });
    card.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); open(); } });
    if (bar.children.length) card.appendChild(bar);
    card.addEventListener('dragstart', function (e) { state.dragging = c; card.classList.add('is-dragging'); e.dataTransfer.setData('text/plain', String(c.id)); });
    card.addEventListener('dragend', function () { state.dragging = null; card.classList.remove('is-dragging'); });
    if (state.focus === c.id) card.classList.add('is-focus');
    return card;
  }

  /* A web enquiry becomes a job here: a site visit with a date, or straight
     to a quote on the job screen. */
  async function fromLead(lead, visit, node) {
    var when = null;
    if (visit) { when = await R.askDate('When is the site visit?', '', false); if (!when) return; }
    run(node, async function () {
      var res = await U.send('/api/admin/quoted', { op: 'save', site: lead.site, leadId: lead.leadId, customerName: lead.firstName, customerPostcode: lead.postcode, status: 'quoted', note: lead.issues.join(', ') });
      if (!res.ok) throw new Error('The job could not be started.');
      if (!visit) { global.location.href = R.jobHref(res.data.job.id); return; }
      await R.write({ op: 'stage', id: res.data.job.id, to: 'visit', date: when.date }, (lead.firstName || 'Enquiry') + ' booked for a site visit.', load);
    });
  }

  function enquiryCard(e) {
    var card = U.node('article', 'sv-card rf-card rf-enquiry');
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('span', 'card-name', [e.firstName || 'No name', e.postcode].filter(Boolean).join(', ')));
    card.appendChild(top);
    card.appendChild(U.node('p', 'rf-next', 'Call back and book a site visit'));
    card.appendChild(U.node('p', 'card-meta', e.stageDays + (e.stageDays === 1 ? ' day' : ' days') + ' waiting' + (e.issues.length ? ' · ' + e.issues.join(', ') : '')));
    var bar = U.node('div', 'card-actions');
    bar.appendChild(button('Book site visit', function () { fromLead(e, true, bar); }, 'act-main'));
    bar.appendChild(button('Quote now', function () { fromLead(e, false, bar); }));
    if (e.phone) bar.appendChild(link('Call', 'tel:' + String(e.phone).replace(/[^\d+]/g, '')));
    card.appendChild(bar);
    return card;
  }

  function tiles(jobs) {
    var sum = function (stages) { return jobs.filter(function (j) { return stages.indexOf(j.stage) !== -1; }).reduce(function (s, j) { return s + j.valuePence; }, 0); };
    var box = el('tiles');
    box.textContent = '';
    [['Quoted, waiting', U.money(sum(['quoted']))], ['Won, to do', U.money(sum(['accepted', 'booked', 'in_progress']))],
     ['Done, to collect', U.money(jobs.filter(function (j) { return j.stage === 'done'; }).reduce(function (s, j) { return s + Math.max(0, j.valuePence - j.receivedPence); }, 0))],
     ['Needs something', String(jobs.filter(function (j) { return (j.badges || []).length; }).length)]].forEach(function (t) {
      var tile = U.node('div', 'tile');
      tile.appendChild(U.node('span', 'k', t[0]));
      tile.appendChild(U.node('span', 'v', t[1]));
      box.appendChild(tile);
    });
  }

  function draw() {
    var board = el('board');
    board.textContent = '';
    var d = state.data;
    var phone = global.matchMedia && global.matchMedia('(max-width:759px)').matches;
    tiles(d.jobs);
    R.STAGES.forEach(function (st) {
      var key = st[0];
      var items = key === 'enquiry' ? d.enquiries.filter(matches) : d.jobs.filter(function (j) { return j.stage === key && matches(j); });
      var col = document.createElement('details');
      col.className = 'sv-col col rf-col';
      col.dataset.stage = key;
      col.open = !(phone && FOLDED[key]) || items.some(function (j) { return j.id === state.focus; }) || Boolean(state.q || state.badge);
      var head = U.node('summary', 'col-head');
      head.appendChild(U.node('h2', null, st[1]));
      var value = key === 'enquiry' ? 0 : items.reduce(function (s, j) { return s + j.valuePence; }, 0);
      head.appendChild(U.node('span', null, items.length + (value ? ' · ' + U.money(value) : '')));
      col.appendChild(head);
      items.forEach(function (it) { col.appendChild(key === 'enquiry' ? enquiryCard(it) : jobCard(it)); });
      if (!items.length) col.appendChild(U.node('p', 'card-meta', 'Nothing here.'));
      col.addEventListener('dragover', function (e) { if (R.canMove(state.dragging, key)) { e.preventDefault(); col.classList.add('is-target'); } });
      col.addEventListener('dragleave', function () { col.classList.remove('is-target'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('is-target');
        var c = state.dragging;
        if (R.canMove(c, key)) run(board, function () { return R.move(c, key, load); });
      });
      board.appendChild(col);
    });
    var f = state.focus && el('job-' + state.focus);
    if (f) { f.scrollIntoView({ block: 'center' }); state.focus = null; }
  }

  async function load() {
    try {
      state.data = await U.get('/api/admin/roofing');
      el('state').hidden = true;
      el('content').hidden = false;
      draw();
    } catch (e) { el('state').textContent = 'Could not load the pipeline. ' + e.message; el('state').hidden = false; }
  }

  el('rf-q').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); if (state.data) draw(); });
  el('rf-badge').addEventListener('change', function () { state.badge = this.value; if (state.data) draw(); });
  var refresh = el('refresh');
  if (refresh) refresh.addEventListener('click', load);
  var out = el('logout');
  if (out) out.addEventListener('click', async function () { await fetch('/api/auth/logout', { method: 'POST' }); location.replace('/staff'); });
  var m = /^#job-(\d+)/.exec(global.location.hash);
  if (m) { state.focus = Number(m[1]); if (global.DSPOP) global.DSPOP.open(state.focus, { onChange: load }); }
  load();
})(window);
