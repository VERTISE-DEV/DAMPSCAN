/* The job pop-up on Today: tap a job on the timeline or in a list and this
   sheet shows everything about it, with every action on it, without leaving
   the page. It reads one job (/api/admin/calendar?view=job) and reuses what
   already acts on jobs elsewhere: the client card's ticks and date (the
   clients route, as client-dialog.js writes them), the quoted board's status
   change for a Verge or CoolRight date, the "Action needed" rows of
   calendar-actions.js (messages, ticks, snooze, each with Undo), the survey
   message words, and the to-do ticks. The full card or job page is one tap
   away for anything bigger (photos, quote lines, payments). */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var W = global.DSWORK;
  var ctx = { id: null, work: null, onChange: null };

  var dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.setAttribute('aria-labelledby', 'pop-name');
  var head = U.node('header', 'sheet-head');
  var name = U.node('h2', null, '');
  name.id = 'pop-name';
  var shut = U.node('button', 'btn btn--ghost btn--sm sheet-close', 'Close');
  shut.type = 'button';
  shut.addEventListener('click', function () { dlg.close(); });
  var top = U.node('div', 'sheet-top');
  top.appendChild(name);
  top.appendChild(shut);
  head.appendChild(top);
  var sub = U.node('p', 'sheet-sub');
  head.appendChild(sub);
  var body = U.node('div', 'sheet-body');
  var foot = U.node('footer', 'sheet-foot');
  dlg.appendChild(head);
  dlg.appendChild(body);
  dlg.appendChild(foot);
  document.body.appendChild(dlg);
  /* A tap on the dimmed backdrop closes it, as on any phone sheet. */
  dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });

  function section(title) {
    var s = U.node('section', 'sheet-sec');
    if (title) s.appendChild(U.node('h3', null, title));
    body.appendChild(s);
    return s;
  }
  function link(text, href, cls) {
    var a = U.node('a', 'pill act ' + (cls || ''), text);
    a.href = href;
    if (/^https:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function changed() { Promise.resolve(ctx.onChange && ctx.onChange()).then(load, load); }
  function shortDate(s) { return new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); }

  /* A damp tick: one write to the client card's route, five seconds to undo. */
  function tick(j, field, label, on, words) {
    var l = U.node('label', 'sheet-tick');
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = on;
    box.addEventListener('change', async function () {
      var b = { id: j.id }; b[field] = box.checked;
      box.disabled = true;
      var r = await U.send('/api/admin/clients', b);
      box.disabled = false;
      if (!r.ok) { box.checked = !box.checked; return; }
      var back = { id: j.id }; back[field] = !box.checked;
      W.offerUndo(box.checked ? words : label + ' unticked.', function () { return U.send('/api/admin/clients', back); }, changed);
      changed();
    });
    l.appendChild(box);
    l.appendChild(U.node('span', null, label));
    return l;
  }

  function dateForm(j) {
    var s = section(j.dateSet ? 'Date and time' : 'Book it in');
    var f = U.node('form', 'sheet-row');
    var d = document.createElement('input'); d.type = 'date'; d.required = true; d.value = j.dateSet ? j.date : ''; d.setAttribute('aria-label', 'Date');
    var t = document.createElement('input'); t.type = 'time'; t.value = j.time || ''; t.setAttribute('aria-label', 'Time');
    var save = U.node('button', 'btn btn--primary btn--sm', j.dateSet ? 'Move' : 'Set date');
    save.type = 'submit';
    f.appendChild(d); f.appendChild(t); f.appendChild(save);
    var note = U.node('p', 'panel-note');
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var it = { jobId: j.id, quoted: j.quoted, status: j.status };
      var r = await U.send('/api/admin/' + (j.quoted ? 'quoted' : 'clients'), W.moveBody(it, d.value, t.value));
      if (!r.ok) { note.textContent = (r.data && (r.data.message || JSON.stringify(r.data.errors || {}))) || 'Not saved'; return; }
      if (j.dateSet) W.offerUndo('Moved. Remember to let the customer know.', function () { return U.send('/api/admin/' + (j.quoted ? 'quoted' : 'clients'), W.moveBody(it, j.date, j.time)); }, changed);
      changed();
    });
    s.appendChild(f);
    s.appendChild(note);
  }

  function notes(j) {
    var s = section('Notes');
    if (j.quoted && !j.money) { s.appendChild(U.node('p', 'sheet-note', j.note || 'No notes.')); return; }
    var f = U.node('form', 'sheet-notes');
    var ta = document.createElement('textarea');
    ta.rows = 3; ta.maxLength = 2000; ta.value = j.note || ''; ta.setAttribute('aria-label', 'Notes');
    var save = U.node('button', 'btn btn--ghost btn--sm', 'Save notes');
    save.type = 'submit';
    var said = U.node('span', 'panel-note');
    f.appendChild(ta); f.appendChild(save); f.appendChild(said);
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      /* A quoted job's notes are part of its whole save, so the rest goes back as it was. */
      var r = j.quoted
        ? await U.send('/api/admin/quoted', { op: 'save', id: j.id, site: j.site, customerName: j.customerName, customerPostcode: j.postcode, note: ta.value,
          invoiceNetPence: j.money.pricePence, status: j.status, jobDate: j.date, jobTime: j.time || '' })
        : await U.send('/api/admin/clients', { id: j.id, note: ta.value });
      said.textContent = r.ok ? 'Saved.' : 'Not saved.';
    });
    s.appendChild(f);
  }

  async function dampMessages(j, s) {
    try {
      var data = await U.get('/api/admin/surveys?view=messages&id=' + j.id);
      var m = data.messages || {};
      var add = function (msg, title) { if (msg && global.DSMSG) { s.appendChild(U.node('p', 'sheet-label', title)); s.appendChild(global.DSMSG.buttons(j.id, msg, null)); } };
      add(m.confirm, 'Booking confirmation');
      if (!j.depositPaid) add(m.deposit, 'Deposit request');
      if (j.awaitingAgent) add(m.chase, 'Ask the agent for a time');
      if (j.reportSent) add(m.remedial, 'Offer to quote the remedial work');
    } catch (e) { /* the full card still has them */ }
  }

  function draw(j) {
    body.textContent = '';
    foot.textContent = '';
    name.textContent = j.customerName || 'No name';
    sub.textContent = '';
    sub.appendChild(U.node('span', 'tl-biz', W.NAME[j.site] || j.business));
    sub.appendChild(U.node('span', 'sheet-status', j.status === 'quoted' && j.accepted ? 'accepted' : j.status));
    sub.appendChild(U.node('span', 'sheet-when', !j.dateSet ? 'Not booked in yet' : shortDate(j.date) + (j.time ? ', ' + j.time : ', time to confirm')));

    var items = [];
    (((ctx.work && ctx.work()) || {}).groups || []).forEach(function (g) { g.items.forEach(function (it) { if (it.jobId === j.id) items.push(it); }); });
    var out = section('Outstanding' + (items.length ? ' (' + items.length + ')' : ''));
    if (!items.length) out.appendChild(U.node('p', 'panel-note', 'Nothing outstanding on this job.'));
    var ul = U.node('ul', 'act-list');
    items.forEach(function (it) { ul.appendChild(W.itemRow(it, changed)); });
    out.appendChild(ul);

    if (!j.quoted) {
      var t = section('Ticks');
      if (j.money) {
        t.appendChild(tick(j, 'depositPaid', 'Deposit paid (' + U.money(j.money.depositPence) + ')', j.depositPaid, 'Deposit marked paid.'));
        t.appendChild(tick(j, 'paid', 'Paid in full (' + U.money(j.money.pricePence) + ')', j.paid, 'Marked paid in full.'));
      }
      t.appendChild(tick(j, 'surveySent', 'Report sent', j.reportSent, 'Report marked sent.'));
      t.appendChild(tick(j, 'awaitingAgent', 'Awaiting estate agent', j.awaitingAgent, 'Marked awaiting the agent.'));
    } else if (j.money) {
      var p = section('Payments');
      p.appendChild(U.node('p', 'sheet-note', U.money(j.money.receivedPence) + ' received of ' + U.money(j.money.pricePence) + (j.money.pricePence > j.money.receivedPence ? ', ' + U.money(j.money.pricePence - j.money.receivedPence) + ' to collect' : '')));
      p.appendChild(link('Record a payment', W.jobHref(j.site, j.id, true), 'act-main'));
    }

    if (j.coolright && global.DSPOPAC) global.DSPOPAC.render(j, section, changed);

    var c = section('Contact');
    var row = U.node('div', 'act-bar');
    if (j.phone) row.appendChild(link('Call ' + j.phone, 'tel:' + String(j.phone).replace(/[^\d+]/g, '')));
    if (j.email) row.appendChild(link('Email', 'mailto:' + j.email));
    if (j.address.length) row.appendChild(link('Directions', 'https://www.waze.com/ul?q=' + encodeURIComponent(j.address.join(', ')) + '&navigate=yes'));
    if (!row.children.length) row.appendChild(U.node('span', 'panel-note', 'No phone or email on file.'));
    c.appendChild(row);
    if (j.address.length) c.appendChild(U.node('p', 'sheet-note', j.address.join(', ')));
    if (!j.quoted) dampMessages(j, c);

    if (j.status !== 'paid') dateForm(j);
    notes(j);

    var td = section('To-dos for this job');
    if (!j.todos.length) td.appendChild(U.node('p', 'panel-note', 'None.'));
    j.todos.forEach(function (x) {
      var l = U.node('label', 'sheet-tick');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.addEventListener('change', async function () {
        await U.send('/api/admin/todos', { op: 'done', id: x.id });
        W.offerUndo('To-do ticked off.', function () { return U.send('/api/admin/todos', { op: 'reopen', id: x.id }); }, changed);
        changed();
      });
      l.appendChild(box);
      l.appendChild(U.node('span', null, x.text + (x.forName ? ' (' + x.forName + ')' : '')));
      td.appendChild(l);
    });

    foot.appendChild(link(j.quoted ? 'Open job page' : 'Open full card', W.jobHref(j.site, j.id, j.quoted), 'act-main'));
    var close = U.node('button', 'btn btn--ghost btn--sm', 'Close');
    close.type = 'button';
    close.addEventListener('click', function () { dlg.close(); });
    foot.appendChild(close);
  }

  async function load() {
    try {
      var data = await U.get('/api/admin/calendar?view=job&id=' + ctx.id);
      draw(data.job);
    } catch (e) {
      body.textContent = '';
      body.appendChild(U.node('p', 'panel-note', e.message || 'Could not load this job.'));
    }
  }

  function open(id, opts) {
    ctx.id = id;
    ctx.work = (opts && opts.work) || null;
    ctx.onChange = opts && opts.onChange;
    name.textContent = 'Loading…';
    sub.textContent = '';
    body.textContent = '';
    foot.textContent = '';
    if (!dlg.open) dlg.showModal();
    load();
  }

  global.DSPOP = { open: open };
})(window);
