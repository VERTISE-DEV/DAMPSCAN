/* My hours: five weeks of days, each with the windows this surveyor can do
   and a quick way to add or remove one. A manager can pick whose hours. */
(function (global) {
  'use strict';
  var U = global.DSUI;
  var el = function (id) { return document.getElementById(id); };
  var who = null;
  var TIMES = [];
  for (var h = 7; h <= 21; h += 1) TIMES.push((h < 10 ? '0' : '') + h + ':00');

  function sel(value) {
    var s = document.createElement('select');
    TIMES.forEach(function (t) { var o = document.createElement('option'); o.value = t; o.textContent = t; if (t === value) o.selected = true; s.appendChild(o); });
    return s;
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function label(d) { return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }); }

  async function send(body) {
    var r = await U.send('/api/admin/hours', Object.assign({ surveyor: who }, body));
    el('note').textContent = r.ok ? '' : (r.data && r.data.error) || 'That did not save.';
    load();
  }

  function render(data) {
    var days = el('days');
    days.textContent = '';
    var start = new Date(); start.setUTCHours(12, 0, 0, 0);
    for (var i = 1; i <= 35; i += 1) {
      var d = iso(new Date(start.getTime() + i * 86400000));
      var li = U.node('li', 'hours-day');
      li.appendChild(U.node('span', 'hours-date', label(d)));
      var mine = data.hours.filter(function (x) { return x.date === d; });
      var wins = U.node('div', 'hours-wins');
      if (!mine.length) wins.appendChild(U.node('span', 'panel-note', 'Not available'));
      mine.forEach(function (x) {
        var chip = U.node('span', 'tag', x.start + ' to ' + x.end + ' ');
        var rm = U.node('button', 'link-btn', 'Remove');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + x.start + ' to ' + x.end + ' on ' + label(d));
        rm.addEventListener('click', function () { send({ op: 'remove', id: x.id }); });
        chip.appendChild(rm);
        wins.appendChild(chip);
      });
      li.appendChild(wins);
      var add = U.node('div', 'hours-add');
      var a = sel('17:00'), b = sel('18:00');
      a.setAttribute('aria-label', 'From'); b.setAttribute('aria-label', 'To');
      var go = U.node('button', 'btn btn--ghost btn--sm', 'Add');
      go.type = 'button';
      (function (day, from, to) { go.addEventListener('click', function () { send({ op: 'add', date: day, start: from.value, end: to.value }); }); })(d, a, b);
      add.appendChild(a); add.appendChild(U.node('span', null, 'to')); add.appendChild(b); add.appendChild(go);
      li.appendChild(add);
      days.appendChild(li);
    }
  }

  async function load() {
    try {
      var data = await U.get('/api/admin/hours' + (who ? '?surveyor=' + who : ''));
      if (who === null) who = data.me;
      if (data.manager && el('who').options.length === 0) {
        data.surveyors.forEach(function (s) { var o = document.createElement('option'); o.value = s; o.textContent = s.charAt(0).toUpperCase() + s.slice(1); el('who').appendChild(o); });
        el('who-row').hidden = false;
      }
      if (who) el('who').value = who;
      if (data.note && !who) { el('note').textContent = 'Pick whose hours to set.'; }
      render(data);
    } catch (e) { if (e.message !== 'unauthorised') el('note').textContent = 'Could not load your hours.'; }
  }

  el('who').addEventListener('change', function () { who = el('who').value; load(); });
  el('usual').addEventListener('click', function () { send({ op: 'usual' }); });
  var r = el('refresh'); if (r) r.addEventListener('click', load);
  var o = el('logout'); if (o) o.addEventListener('click', async function () { await fetch('/api/auth/logout', { method: 'POST' }); location.replace('/staff'); });
  load();
})(window);
