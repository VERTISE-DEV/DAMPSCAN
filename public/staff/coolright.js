/* The CoolRight install pipeline: Enquiry, Survey, Quoted, Accepted,
   Installed, Commissioned, Paid. Each card says who and where, what the job
   is worth, the one next thing to do, how long it has sat there and what is
   missing. Above the board, what the service plans bring in. A card moves by
   dragging or by its buttons, and every move offers Undo. On a phone the
   columns stack and fold, with Paid folded. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var A = global.DSAC;
  var R = global.DSROOF;
  var state = { data: null, q: '', badge: '', dragging: null, focus: null };
  var el = function (id) { return document.getElementById(id); };
  var FOLDED = { paid: 1 };

  function matches(c) {
    if (state.badge === 'any' && !(c.badges || []).length) return false;
    if (state.badge && state.badge !== 'any' && (c.badges || []).indexOf(state.badge) === -1) return false;
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
    var card = U.node('article', 'sv-card rf-card');
    card.id = 'job-' + c.id;
    card.draggable = !c.frozen && Boolean(A.NEXT[c.stage] || A.BACK[c.stage]);
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('span', 'card-name', [c.firstName || 'No name', c.postcode].filter(Boolean).join(', ')));
    top.appendChild(U.node('span', 'card-value', U.money(c.valuePence)));
    card.appendChild(top);
    card.appendChild(U.node('p', 'rf-next', c.next));
    var meta = [c.stageDays + (c.stageDays === 1 ? ' day' : ' days') + ' in ' + A.NAMES[c.stage].toLowerCase()];
    if (c.stage === 'accepted' && c.status === 'booked') meta.push('Install ' + R.shortDate(c.jobDate) + (c.jobTime ? ' ' + c.jobTime : ''));
    if (c.stage === 'survey' && c.siteVisitOn) meta.push('Survey ' + R.shortDate(c.siteVisitOn));
    if (c.units) meta.push(c.units + (c.units === 1 ? ' unit' : ' units'));
    if (c.onPlan) meta.push('On a plan');
    card.appendChild(U.node('p', 'card-meta rf-meta', meta.join(' · ')));
    if ((c.badges || []).length) {
      var badges = U.node('div', 'rf-badges');
      c.badges.forEach(function (b) { badges.appendChild(A.badge(b)); });
      card.appendChild(badges);
    }
    var bar = U.node('div', 'card-actions');
    if (A.NEXT[c.stage] && !c.frozen) bar.appendChild(button(A.NEXT[c.stage][1], function () { run(bar, function () { return A.move(c, A.NEXT[c.stage][0], load); }); }, 'act-main'));
    else if (c.stage === 'accepted') bar.appendChild(button(c.status === 'booked' ? 'Move install' : 'Book install', function () { run(bar, function () { return A.installDate(c, load); }); }, 'act-main'));
    /* One next step on the card; the rest (call, plan, back, lost, money)
       is in the job sheet a tap away, or on the job page it links to. */
    card.classList.add('is-compact');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    var open = function () { if (global.DSPOP) global.DSPOP.open(c.id, { onChange: load }); else global.location.href = A.jobHref(c.id); };
    card.addEventListener('click', function (e) { if (!e.target.closest('button,a,input,select,label,textarea')) open(); });
    card.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); open(); } });
    if (bar.children.length) card.appendChild(bar);
    card.addEventListener('dragstart', function (e) { state.dragging = c; card.classList.add('is-dragging'); e.dataTransfer.setData('text/plain', String(c.id)); });
    card.addEventListener('dragend', function () { state.dragging = null; card.classList.remove('is-dragging'); });
    if (state.focus === c.id) card.classList.add('is-focus');
    return card;
  }

  /* A web enquiry becomes a job here: a survey with a date, or straight to a quote. */
  async function fromLead(lead, survey, node) {
    var when = null;
    if (survey) { when = await R.askDate('When is the survey?', '', false); if (!when) return; }
    run(node, async function () {
      var res = await U.send('/api/admin/quoted', { op: 'save', site: lead.site, leadId: lead.leadId, customerName: lead.firstName, customerPostcode: lead.postcode, status: 'quoted', note: lead.issues.join(', ') });
      if (!res.ok) throw new Error('The job could not be started.');
      if (!survey) { global.location.href = A.jobHref(res.data.job.id); return; }
      await A.write({ op: 'stage', id: res.data.job.id, to: 'survey', date: when.date }, (lead.firstName || 'Enquiry') + ' booked for a survey.', load);
    });
  }

  function enquiryCard(e) {
    var card = U.node('article', 'sv-card rf-card');
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('span', 'card-name', [e.firstName || 'No name', e.postcode].filter(Boolean).join(', ')));
    card.appendChild(top);
    card.appendChild(U.node('p', 'rf-next', 'Call back and book a survey'));
    card.appendChild(U.node('p', 'card-meta', e.stageDays + (e.stageDays === 1 ? ' day' : ' days') + ' waiting' + (e.issues.length ? ' · ' + e.issues.join(', ') : '')));
    var bar = U.node('div', 'card-actions');
    bar.appendChild(button('Book survey', function () { fromLead(e, true, bar); }, 'act-main'));
    bar.appendChild(button('Quote now', function () { fromLead(e, false, bar); }));
    if (e.phone) bar.appendChild(link('Call', 'tel:' + String(e.phone).replace(/[^\d+]/g, '')));
    card.appendChild(bar);
    return card;
  }

  function tileRow(box, list) {
    box.textContent = '';
    list.forEach(function (t) {
      var tile = U.node('div', 'tile');
      tile.appendChild(U.node('span', 'k', t[0]));
      tile.appendChild(U.node('span', 'v', t[1]));
      if (t[2]) tile.appendChild(U.node('span', 's', t[2]));
      box.appendChild(tile);
    });
  }

  function tiles(d) {
    var jobs = d.jobs;
    var sum = function (stages) { return jobs.filter(function (j) { return stages.indexOf(j.stage) !== -1; }).reduce(function (s, j) { return s + j.valuePence; }, 0); };
    var inc = d.income;
    el('income').hidden = !inc;
    if (inc) {
      tileRow(el('income'), [['Service plans', String(inc.plans), inc.plans > inc.priced ? (inc.plans - inc.priced) + ' with no price' : 'Active'],
        ['Plan income a month', U.money(inc.monthlyPence)], ['Plan income a year', U.money(inc.annualPence)],
        ['Warranties ending', String((d.warranties || []).length), 'In the next 60 days']]);
    }
    tileRow(el('tiles'), [['Quoted, waiting', U.money(sum(['quoted']))], ['Won, to fit', U.money(sum(['accepted']))],
      ['Fitted, to collect', U.money(jobs.filter(function (j) { return j.stage === 'installed' || j.stage === 'commissioned'; }).reduce(function (s, j) { return s + Math.max(0, j.valuePence - j.receivedPence); }, 0))],
      ['Needs something', String(jobs.filter(function (j) { return (j.badges || []).length; }).length)]]);
  }

  function draw() {
    var board = el('board');
    board.textContent = '';
    var d = state.data;
    var phone = global.matchMedia && global.matchMedia('(max-width:759px)').matches;
    tiles(d);
    A.STAGES.forEach(function (st) {
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
      col.addEventListener('dragover', function (e) { if (A.canMove(state.dragging, key)) { e.preventDefault(); col.classList.add('is-target'); } });
      col.addEventListener('dragleave', function () { col.classList.remove('is-target'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('is-target');
        var c = state.dragging;
        if (A.canMove(c, key)) run(board, function () { return A.move(c, key, load); });
      });
      board.appendChild(col);
    });
    var f = state.focus && el('job-' + state.focus);
    if (f) { f.scrollIntoView({ block: 'center' }); state.focus = null; }
  }

  async function load() {
    try {
      state.data = await U.get('/api/admin/coolright');
      el('state').hidden = true;
      el('content').hidden = false;
      draw();
    } catch (e) { el('state').textContent = 'Could not load the board. ' + e.message; el('state').hidden = false; }
  }

  el('ac-q').addEventListener('input', function () { state.q = this.value.trim().toLowerCase(); if (state.data) draw(); });
  el('ac-badge').addEventListener('change', function () { state.badge = this.value; if (state.data) draw(); });
  var refresh = el('refresh');
  if (refresh) refresh.addEventListener('click', load);
  var out = el('logout');
  if (out) out.addEventListener('click', async function () { await fetch('/api/auth/logout', { method: 'POST' }); location.replace('/staff'); });
  var m = /^#job-(\d+)/.exec(global.location.hash);
  if (m) { state.focus = Number(m[1]); if (global.DSPOP) global.DSPOP.open(state.focus, { onChange: load }); }
  load();
})(window);
