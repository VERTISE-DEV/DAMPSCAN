/* Insights for the area you are in: money at a glance, the last twelve
   months as bars, the last ninety days as a funnel, and where enquiries come
   from. All of it from /api/admin/insights, scoped like every other page;
   the money parts only appear for someone who manages the business. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var el = function (id) { return document.getElementById(id); };
  var CHANNEL = { organic: 'Google search', paid: 'Ads', direct: 'Direct or typed in', referral: 'Another website', social: 'Social media', email: 'Email' };

  function tiles(mount, list) {
    mount.textContent = '';
    list.forEach(function (t) {
      var tile = U.node('div', 'tile' + (t[3] ? ' is-key' : ''));
      tile.appendChild(U.node('span', 'k', t[0]));
      tile.appendChild(U.node('span', 'v', t[1]));
      if (t[2]) tile.appendChild(U.node('span', 's', t[2]));
      mount.appendChild(tile);
    });
  }

  function change(now, before) {
    if (!before) return now ? 'Nothing last month' : '';
    var pct = Math.round(((now - before) / before) * 100);
    return (pct >= 0 ? 'Up ' : 'Down ') + Math.abs(pct) + '% on last month';
  }

  /* Two series side by side per month, each scaled to its own largest value
     so a count and a sum of money can share one chart. */
  function chart(mount, months, a, b) {
    mount.textContent = '';
    var maxA = Math.max.apply(null, months.map(function (m) { return m[a.key]; })) || 1;
    var maxB = Math.max.apply(null, months.map(function (m) { return m[b.key]; })) || 1;
    var title = U.node('div', 'chart-title');
    [[a, 'bar-a'], [b, 'bar-b']].forEach(function (s) {
      var key = U.node('span', 'chart-key');
      key.appendChild(U.node('i', s[1]));
      key.appendChild(document.createTextNode(s[0].label));
      title.appendChild(key);
    });
    mount.appendChild(title);
    var bars = U.node('div', 'chart-bars');
    var labels = U.node('div', 'chart-labels');
    var said = [];
    months.forEach(function (m) {
      var col = U.node('div', 'chart-col');
      var name = new Date(m.month + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
      [[a, maxA, 'bar-a'], [b, maxB, 'bar-b']].forEach(function (s) {
        var bar = U.node('span', s[2]);
        bar.style.height = Math.round((m[s[0].key] / s[1]) * 100) + '%';
        bar.title = name + ': ' + s[0].label + ' ' + s[0].show(m[s[0].key]);
        col.appendChild(bar);
      });
      bars.appendChild(col);
      labels.appendChild(U.node('span', null, name));
      said.push(name + ' ' + a.show(m[a.key]) + ' and ' + b.show(m[b.key]));
    });
    mount.setAttribute('aria-label', a.label + ' and ' + b.label + ' by month: ' + said.join('; '));
    mount.appendChild(bars);
    mount.appendChild(labels);
  }

  var BRAND = { dampscan: 'DampScan', 'ati-london': 'ATi Damp Survey', roofing: 'Verge Roofing', ac: 'CoolRight' };

  /* Search Console, one block per brand: the last 28 settled days against the
     28 before, then the searches and pages that brought people. */
  function renderSearch(d) {
    var mount = el('search');
    mount.textContent = '';
    if (!d.searchConnected) {
      mount.appendChild(U.node('p', 'panel-note', 'Not connected yet. Once a Google service account key is added to the site and the account is given access to each site in Search Console, this shows how often each business appears in Google, how often it is clicked, and the searches behind it.'));
      return;
    }
    d.search.forEach(function (s) {
      var box = U.node('div', 'search-site');
      box.appendChild(U.node('h3', 'search-title', BRAND[s.site] || s.site));
      if (s.error) {
        box.appendChild(U.node('p', 'panel-note', s.error === 'not_shared'
          ? 'Search Console has not given the service account access to ' + s.property + ' yet. Add it as a user on that property.'
          : 'Search Console could not be reached just now.'));
        mount.appendChild(box);
        return;
      }
      var t = document.createElement('div');
      t.className = 'tiles';
      box.appendChild(t);
      var pos = s.now.position && s.before.position ? (s.now.position < s.before.position ? 'Up from ' : s.now.position > s.before.position ? 'Down from ' : 'Same as ') + s.before.position : '';
      tiles(t, [
        ['Clicks from Google', U.num(s.now.clicks), change(s.now.clicks, s.before.clicks), true],
        ['Times shown in Google', U.num(s.now.impressions), change(s.now.impressions, s.before.impressions)],
        ['Click rate', s.now.ctr + '%'],
        ['Average position', s.now.position ? String(s.now.position) : 'None yet', pos]
      ]);
      var q = document.createElement('div');
      var p = document.createElement('div');
      box.appendChild(U.node('h4', 'search-sub', 'Searches'));
      box.appendChild(q);
      box.appendChild(U.node('h4', 'search-sub', 'Pages'));
      box.appendChild(p);
      var cols = function (first) {
        return [
          { label: first, wrap: true, get: function (r) { return first === 'Page' ? r.key.replace(/^https?:\/\/[^/]+/, '') || '/' : r.key; } },
          { label: 'Clicks', numeric: true, get: function (r) { return U.num(r.clicks); } },
          { label: 'Shown', numeric: true, get: function (r) { return U.num(r.impressions); } },
          { label: 'Position', numeric: true, get: function (r) { return String(r.position); } }
        ];
      };
      U.table(q, cols('Search'), s.queries, { empty: 'No searches yet.' });
      U.table(p, cols('Page'), s.pages, { empty: 'No pages yet.' });
      box.appendChild(U.node('p', 'panel-note', s.from + ' to ' + s.to + ', compared with the 28 days before. Google settles these figures about three days late.'));
      mount.appendChild(box);
    });
  }

  function render(d) {
    el('p-money').hidden = !d.money;
    if (d.money) {
      var t = d.money.thisMonth;
      var l = d.money.lastMonth;
      tiles(el('money'), [
        ['Work done this month', U.money(t.workPence), change(t.workPence, l.workPence), true],
        ['Money in this month', U.money(t.receivedPence), change(t.receivedPence, l.receivedPence), true],
        ['Costs this month', U.money(t.costsPence), 'Last month ' + U.money(l.costsPence)],
        ['Owed on finished work', U.money(d.money.owedPence)],
        ['Booked in', U.money(d.money.bookedPence)],
        ['Quoted, waiting', U.money(d.money.quotedPence)]
      ]);
    }
    var count = function (n) { return U.num(n); };
    chart(el('chart-leads'), d.months, { key: 'enquiries', label: 'Enquiries', show: count }, { key: 'won', label: 'Jobs won', show: count });
    el('chart-money').hidden = !d.money;
    if (d.money) chart(el('chart-money'), d.months, { key: 'workPence', label: 'Work done', show: U.money }, { key: 'receivedPence', label: 'Money in', show: U.money });

    var f = d.funnel;
    tiles(el('funnel'), [
      ['Enquiries', U.num(f.enquiries)],
      ['Jobs started', U.num(f.jobs), f.fromEnquiries + ' from web enquiries'],
      ['Won', U.num(f.won), null, true],
      ['Lost', U.num(f.lost)],
      ['Win rate', f.winRate === null ? 'No answers yet' : f.winRate + '%', 'Of quotes with an answer', true],
      ['Average job', f.avgJobPence ? U.money(f.avgJobPence) : 'None yet'],
      ['Enquiry to job', f.daysToJob === null ? 'None yet' : f.daysToJob + ' days', 'Average, for web enquiries']
    ]);

    renderSearch(d);
    var rate = function (r) { return r.enquiries ? Math.round((100 * r.won) / r.enquiries) + '%' : ''; };
    U.table(el('channels'), [
      { label: 'Channel', get: function (r) { return CHANNEL[r.channel] || r.channel; } },
      { label: 'Enquiries', numeric: true, get: function (r) { return U.num(r.enquiries); } },
      { label: 'Won', numeric: true, get: function (r) { return U.num(r.won); } },
      { label: 'Rate', numeric: true, get: rate }
    ], d.channels, { empty: 'No enquiries in the last year.' });
    U.table(el('places'), [
      { label: 'District', get: function (r) { return r.district; } },
      { label: 'Enquiries', numeric: true, get: function (r) { return U.num(r.enquiries); } },
      { label: 'Won', numeric: true, get: function (r) { return U.num(r.won); } },
      { label: 'Rate', numeric: true, get: rate }
    ], d.places, { empty: 'No enquiries in the last year.' });
    U.table(el('issues'), [
      { label: 'Asked about', wrap: true, get: function (r) { return r.issue; } },
      { label: 'Enquiries', numeric: true, get: function (r) { return U.num(r.count); } }
    ], d.issues, { empty: 'Nothing yet.' });
  }

  async function refresh() {
    try {
      render(await U.get('/api/admin/insights'));
      el('state').hidden = true;
      el('content').hidden = false;
    } catch (e) {
      el('state').textContent = e.message || 'Could not load.';
      el('state').hidden = false;
    }
  }

  el('refresh').addEventListener('click', refresh);
  el('logout').addEventListener('click', async function () {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.replace('/staff');
  });
  refresh();
})(window);
