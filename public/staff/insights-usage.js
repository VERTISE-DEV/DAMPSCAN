/* "Most used pages (last 30 days)" on Insights, for an admin: which staff
   screens people actually open, from the page-view count shell.js sends.
   Anyone else is refused by the route, and the panel stays hidden. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var AREA = { damp: 'ATi & DampScan', roofing: 'Verge Roofing', ac: 'CoolRight' };
  var PAGE = { 'calendar.html': 'Today', 'dashboard.html': 'Leads', 'jobs.html': 'Jobs', 'clients.html': 'Clients', 'pipeline.html': 'Pipeline',
    'quoted.html': 'Quotes and jobs', 'insights.html': 'Insights', 'bank.html': 'Money', 'settings.html': 'Settings', 'due.html': 'Due (old)', 'todo.html': 'To-do (old)' };

  U.get('/api/admin/usage?days=30').then(function (d) {
    var box = document.getElementById('p-usage');
    if (!box || !d || !d.ok) return;
    box.hidden = false;
    U.table(document.getElementById('usage'), [
      { label: 'Page', get: function (r) { return PAGE[r.page] || r.page; } },
      { label: 'Company', get: function (r) { return r.area ? AREA[r.area] : 'All'; } },
      { label: 'Views', numeric: true, get: function (r) { return U.num(r.views); } },
      { label: 'People', numeric: true, get: function (r) { return U.num(r.people); } },
      { label: 'Last', get: function (r) { return U.when(r.lastAt); } }
    ], d.pages || [], { empty: 'No staff pages opened yet.' });
  }).catch(function () { /* not an admin: the panel stays hidden */ });
})(window);
