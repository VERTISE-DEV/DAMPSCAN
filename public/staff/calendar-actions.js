/* The "Action needed" list on the Calendar: every outstanding thing, grouped
   and counted, each with the one-tap actions that clear it right where it
   sits. The list comes from the server (lib/work.js, the same list the
   assistant reads), and every action posts to the route the rest of the
   staff area already uses for it, so a tick here is the same tick as on the
   client card or the job screen. After an action the item leaves the list
   at once and the page refreshes its counts in the background. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var NAME = { dampscan: 'DampScan', 'ati-london': 'ATi', roofing: 'Verge', ac: 'CoolRight' };
  var AREA_OF = { dampscan: 'damp', 'ati-london': 'damp', roofing: 'roofing', ac: 'ac' };

  function jobHref(site, id, quoted) {
    if (!id) return null;
    return quoted || site === 'roofing' || site === 'ac' ? '/staff/quoted.html?area=' + AREA_OF[site] + '#job-' + id : '/staff/jobs.html?area=damp#job-' + id;
  }

  function shortDate(iso) {
    return iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  }

  function linkBtn(text, href, cls) {
    var a = document.createElement('a');
    a.className = 'pill act ' + (cls || '');
    a.href = href;
    a.textContent = text;
    if (/^https:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  function button(text, onClick, cls) {
    var b = U.node('button', 'pill act ' + (cls || ''), text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  /* One write, then the item goes. A refused write puts the reason on the
     item rather than in an alert, which a phone shows as a page-wide popup. */
  async function act(row, path, body, done) {
    row.classList.add('is-busy');
    try {
      var r = await U.send(path, body);
      if (!r.ok) throw new Error((r.data && (r.data.message || r.data.error || JSON.stringify(r.data.errors || {}))) || 'Not saved');
      row.classList.add('is-done');
      setTimeout(function () { row.remove(); if (done) done(); }, 250);
    } catch (e) {
      row.classList.remove('is-busy');
      var note = row.querySelector('.act-err') || row.appendChild(U.node('p', 'act-err'));
      note.textContent = e.message || 'Not saved';
    }
  }

  /* A small date and time picker inside the item, for "set a date". */
  function datePicker(row, it, onDone) {
    var form = U.node('form', 'act-date');
    var d = document.createElement('input'); d.type = 'date'; d.required = true; d.value = it.date || ''; d.setAttribute('aria-label', 'Date');
    var t = document.createElement('input'); t.type = 'time'; t.value = it.time || ''; t.setAttribute('aria-label', 'Time');
    form.appendChild(d); form.appendChild(t);
    form.appendChild(button('Save', function () {}, 'act-main'));
    form.lastChild.type = 'submit';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      act(row, '/api/admin/' + (it.quoted ? 'quoted' : 'clients'), moveBody(it, d.value, t.value), onDone);
    });
    return form;
  }

  /* The quoted trades move a date through the board's status change, keeping
     the stage; a damp survey through its client card, which also clears an
     estate agent wait when a time arrives. */
  function moveBody(it, date, time) {
    if (!it.quoted) return { id: it.jobId || it.id, jobDate: date, jobTime: time || undefined };
    return { op: 'status', id: it.jobId || it.id, status: it.status === 'quoted' ? 'booked' : (it.status || 'booked'), jobDate: date, jobTime: time || undefined };
  }

  function actionsRow(row, it, onDone) {
    var bar = U.node('div', 'act-bar');
    var add = function (n) { if (n) bar.appendChild(n); };
    it.actions.forEach(function (a) {
      if (a === 'open') add(it.jobId ? linkBtn('Open', jobHref(it.site, it.jobId, it.quoted)) : null);
      if (a === 'leads') add(linkBtn('Open', '/staff/dashboard.html?area=' + AREA_OF[it.site]));
      if (a === 'call' && it.phone) {
        add(linkBtn('Call', 'tel:' + String(it.phone).replace(/[^\d+]/g, '')));
        if (it.whatsapp) add(linkBtn('WhatsApp', it.whatsapp, 'msg-whatsapp'));
      }
      if (a === 'deposit') add(button('Deposit paid', function () { act(row, '/api/admin/clients', { id: it.jobId, depositPaid: true }, onDone); }, 'act-main'));
      if (a === 'paid') add(button('Paid in full', function () { act(row, '/api/admin/clients', { id: it.jobId, paid: true }, onDone); }));
      if (a === 'report') add(button('Report sent', function () { act(row, '/api/admin/clients', { id: it.jobId, surveySent: true }, onDone); }, 'act-main'));
      if (a === 'todo') add(button('Done', function () { act(row, '/api/admin/todos', { op: 'done', id: it.id }, onDone); }, 'act-main'));
      if (a === 'contacted') add(button('Reminded', function () { act(row, '/api/admin/contracts', { op: 'contacted', id: it.id }, onDone); }));
      if (a === 'date') add(button('Set date', function () {
        var open = row.querySelector('.act-date');
        if (open) { open.remove(); return; }
        row.appendChild(datePicker(row, it, onDone));
        row.querySelector('.act-date input').focus();
      }));
    });
    return bar;
  }

  function itemRow(it, onDone) {
    var row = U.node('li', 'act-item ev--' + it.site + (it.overdue ? ' is-overdue' : ''));
    var head = U.node('div', 'act-head');
    var who = it.group === 'todos' && !it.firstName ? 'To-do' + (it.forName ? ' for ' + it.forName : '') : [it.firstName || 'No name', it.postcode].filter(Boolean).join(', ');
    head.appendChild(U.node('span', 'act-who', who));
    head.appendChild(U.node('span', 'act-biz', NAME[it.site] || (it.forName ? 'For ' + it.forName : 'General')));
    row.appendChild(head);
    var what = it.what + (it.owedPence ? ' (' + U.money(it.owedPence) + ')' : '') + (it.date && it.group !== 'enquiries' ? ' · ' + shortDate(it.date) + (it.time ? ' ' + it.time : '') : '');
    row.appendChild(U.node('p', 'act-what', what));
    /* A message is its words plus the WhatsApp, text and email links; tapping
       one records it as sent (messages.js) and the item can go. */
    if (it.message && it.actions.indexOf('message') !== -1) {
      row.appendChild(global.DSMSG.buttons(it.jobId, it.message, function () { row.remove(); if (onDone) onDone(); }));
    }
    row.appendChild(actionsRow(row, it, onDone));
    return row;
  }

  /** The grouped list into `mount`; `onDone` runs after any item is cleared. */
  function render(mount, work, onDone, filter) {
    mount.textContent = '';
    var groups = (work && work.groups) || [];
    if (filter) groups = groups.map(function (g) { var items = g.items.filter(filter); return { key: g.key, label: g.label, items: items, count: items.length }; }).filter(function (g) { return g.count; });
    if (!groups.length) { mount.appendChild(U.node('p', 'panel-note', 'Nothing outstanding. Well done.')); return; }
    groups.forEach(function (g, i) {
      var box = document.createElement('details');
      box.className = 'act-group';
      if (i < 3 || g.items.some(function (x) { return x.overdue; })) box.open = true;
      var sum = U.node('summary', null, g.label);
      sum.appendChild(U.node('span', 'act-count', String(g.count)));
      box.appendChild(sum);
      var list = U.node('ul', 'act-list');
      g.items.forEach(function (it) { list.appendChild(itemRow(it, onDone)); });
      box.appendChild(list);
      mount.appendChild(box);
    });
  }

  global.DSWORK = { render: render, itemRow: itemRow, jobHref: jobHref, moveBody: moveBody, NAME: NAME, AREA_OF: AREA_OF };
})(window);
