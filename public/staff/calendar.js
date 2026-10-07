/* A month of booked work and service visits, for every company you hold,
   each in its own colour. On a
   phone the grid becomes a list of days with something on them. "Add to my
   calendar" writes the month as an .ics file, which is how it gets into a
   phone or Outlook calendar without the staff area holding anyone's login. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var el = function (id) { return document.getElementById(id); };
  var NAME = { dampscan: 'DampScan', 'ati-london': 'ATi', roofing: 'Verge Roofing', ac: 'CoolRight' };
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  var state = { month: today.slice(0, 7), events: [] };

  /* Dates are handled as YYYY-MM-DD strings at noon UTC, so no clock change
     or time zone can move an event onto the next or previous day. */
  function at(iso) { return new Date(iso + 'T12:00:00Z'); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = at(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }

  function windowFor(month) {
    var first = month + '-01';
    var start = addDays(first, -((at(first).getUTCDay() + 6) % 7));
    var next = at(first); next.setUTCMonth(next.getUTCMonth() + 1);
    var last = addDays(iso(next), -1);
    var end = addDays(last, 6 - ((at(last).getUTCDay() + 6) % 7));
    return { from: start, to: end };
  }

  function hrefFor(e) {
    if (e.kind === 'service') return e.jobId ? '/staff/quoted.html#job-' + e.jobId : null;
    return e.quoted ? '/staff/quoted.html#job-' + e.id : '/staff/jobs.html#job-' + e.id;
  }

  function label(e) {
    var who = [e.customerName || 'No name', e.postcode].filter(Boolean).join(', ');
    return (e.time ? e.time + ' ' : '') + (e.kind === 'service' ? 'Service: ' : '') + who;
  }

  function chip(e, long) {
    var href = hrefFor(e);
    var a = document.createElement(href ? 'a' : 'span');
    if (href) a.href = href;
    a.className = 'ev ev--' + e.site + (e.kind === 'service' ? ' ev--service' : '') + (e.status === 'completed' || e.status === 'paid' ? ' ev--done' : '');
    a.textContent = (long ? NAME[e.site] + ': ' : '') + label(e);
    a.title = NAME[e.site] + ': ' + label(e) + ' (' + e.status + ')';
    return a;
  }

  /* Which colour is which company, for the companies with something on. */
  function drawKey() {
    var key = el('cal-key');
    key.textContent = '';
    var seen = {};
    state.events.forEach(function (e) { seen[e.site] = true; });
    Object.keys(NAME).filter(function (s) { return seen[s]; }).forEach(function (s) {
      var item = U.node('span', 'ev ev--' + s + ' cal-key-item', NAME[s]);
      key.appendChild(item);
    });
  }

  function render() {
    drawKey();
    var win = windowFor(state.month);
    el('month').textContent = at(state.month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    var byDay = {};
    state.events.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });

    var cal = el('cal');
    cal.textContent = '';
    DOW.forEach(function (d) { cal.appendChild(U.node('div', 'cal-dow', d)); });
    for (var d = win.from; d <= win.to; d = addDays(d, 1)) {
      var cell = U.node('div', 'cal-day' + (d.slice(0, 7) !== state.month ? ' is-out' : '') + (d === today ? ' is-today' : ''));
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', at(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }));
      cell.appendChild(U.node('span', 'cal-num', String(Number(d.slice(8)))));
      (byDay[d] || []).forEach(function (e) { cell.appendChild(chip(e, false)); });
      cal.appendChild(cell);
    }

    var agenda = el('agenda');
    agenda.textContent = '';
    var days = Object.keys(byDay).filter(function (k) { return k.slice(0, 7) === state.month; }).sort();
    days.forEach(function (k) {
      agenda.appendChild(U.node('h3', null, k === today ? 'Today' : at(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })));
      byDay[k].forEach(function (e) { agenda.appendChild(chip(e, true)); });
    });
    if (!days.length) agenda.appendChild(U.node('p', 'panel-note', 'Nothing booked this month.'));
  }

  async function load() {
    var win = windowFor(state.month);
    el('state').textContent = 'Loading…';
    el('state').hidden = false;
    try {
      var data = await U.get('/api/admin/calendar?from=' + win.from + '&to=' + win.to);
      state.events = data.events || [];
      render();
      el('state').hidden = true;
      el('content').hidden = false;
    } catch (e) {
      el('state').textContent = e.message || 'Could not load.';
    }
  }

  function shift(n) {
    var d = at(state.month + '-01');
    d.setUTCMonth(d.getUTCMonth() + n);
    state.month = iso(d).slice(0, 7);
    load();
  }

  /* All-day events: a roof is not booked to the hour, and a time, where there
     is one, goes in the title. Text is escaped as RFC 5545 asks. */
  function ics() {
    var esc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n'); };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Staff area//Calendar//EN', 'CALSCALE:GREGORIAN'];
    state.events.filter(function (e) { return e.date.slice(0, 7) === state.month; }).forEach(function (e) {
      lines.push('BEGIN:VEVENT', 'UID:' + e.kind + '-' + e.id + '-' + e.date + '@staff', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + e.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''),
        'SUMMARY:' + esc(NAME[e.site] + ': ' + label(e)), 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    a.download = 'calendar-' + state.month + '.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  el('prev').addEventListener('click', function () { shift(-1); });
  el('next').addEventListener('click', function () { shift(1); });
  el('today').addEventListener('click', function () { state.month = today.slice(0, 7); load(); });
  el('ics').addEventListener('click', ics);
  el('refresh').addEventListener('click', load);
  el('logout').addEventListener('click', async function () {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.replace('/staff');
  });
  load();
})(window);
