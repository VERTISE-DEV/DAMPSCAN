/* The three staff areas: ATi and DampScan, Verge Roofing, CoolRight.

   One staff site, three businesses that work differently, so each gets its own
   tabs and every page shows only that business. The area comes from ?area= in
   the address, then from the last one used on this device, then the first
   business the signed in person holds. A person sees only the areas their
   grants cover; the shared owners' code and an admin see all three.

   Loaded straight after ui.js on every staff page and before the page's own
   script, so the tabs and the brand pills are right before anything loads,
   and DSUI.get adds the area to every request that takes one. */
(function (global) {
  'use strict';

  var AREAS = {
    damp: {
      name: 'ATi & DampScan', sites: ['dampscan', 'ati-london'], books: 'damp',
      tabs: [['Due', 'due.html'], ['Leads', 'dashboard.html'], ['Jobs', 'jobs.html'], ['Clients', 'clients.html'], ['Calendar', 'calendar.html'], ['Insights', 'insights.html'], ['Bank', 'bank.html']]
    },
    roofing: {
      name: 'Verge Roofing', sites: ['roofing'], books: 'roofing',
      tabs: [['Due', 'due.html'], ['Leads', 'dashboard.html'], ['Pipeline', 'pipeline.html'], ['Quotes and jobs', 'quoted.html'], ['Calendar', 'calendar.html'], ['Insights', 'insights.html'], ['Bank', 'bank.html']]
    },
    ac: {
      name: 'CoolRight', sites: ['ac'], books: 'ac',
      tabs: [['Due', 'due.html'], ['Leads', 'dashboard.html'], ['Pipeline', 'pipeline.html'], ['Quotes and jobs', 'quoted.html'], ['Calendar', 'calendar.html'], ['Insights', 'insights.html'], ['Bank', 'bank.html']]
    }
  };
  var ORDER = ['damp', 'roofing', 'ac'];
  var KEY = 'ds_staff_area';

  function stored() { try { return global.localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(a) { try { global.localStorage.setItem(KEY, a); } catch (e) {} }

  var fromUrl = new URLSearchParams(global.location.search).get('area');
  var area = AREAS[fromUrl] ? fromUrl : (AREAS[stored()] ? stored() : 'damp');
  remember(area);
  var page = global.location.pathname.split('/').pop() || 'due.html';

  function href(a, file) { return '/staff/' + file + '?area=' + a; }
  function hasPage(a, file) { return AREAS[a].tabs.some(function (t) { return t[1] === file; }); }

  /* A page this area does not have, such as Jobs under Verge, goes to the
     area's first tab rather than showing another business's screen. */
  if (!hasPage(area, page)) { global.location.replace(href(area, AREAS[area].tabs[0][1])); return; }

  var root = document.documentElement;
  root.setAttribute('data-area', area);

  function drawTabs() {
    var nav = document.querySelector('nav.tabs');
    if (!nav) return;
    nav.textContent = '';
    AREAS[area].tabs.forEach(function (t) {
      var a = document.createElement('a');
      a.href = href(area, t[1]);
      a.textContent = t[0];
      if (t[1] === page) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
  }

  /* The header lockup is the business you are working in. The damp area keeps
     the hostname's DampScan or ATi mark; the other two wear their own. */
  function drawLogo() {
    if (area === 'damp') return;
    var logos = document.querySelectorAll('header.top > a.logo');
    if (!logos.length) return;
    var a = document.createElement('a');
    a.href = area === 'roofing' ? 'https://vergeroofing.com/' : 'https://coolright.co.uk/';
    a.className = 'logo logo--' + area;
    a.setAttribute('aria-label', AREAS[area].name + ' website');
    if (area === 'roofing') {
      var img = document.createElement('img');
      img.src = '/assets/verge-logo.png'; img.alt = ''; img.width = 103; img.height = 32;
      a.appendChild(img);
    } else {
      var word = document.createElement('span');
      word.className = 'logo-word';
      word.appendChild(document.createTextNode('Cool'));
      var right = document.createElement('span');
      right.className = 'scan';
      right.textContent = 'Right';
      word.appendChild(right);
      a.appendChild(word);
    }
    logos[0].parentNode.insertBefore(a, logos[0]);
    logos.forEach(function (l) { l.remove(); });
    document.title = document.title.replace(/DampScan|ATi Damp Survey/, AREAS[area].name);
  }

  /* Brand pills outside the area come off the page. An area of one brand has
     no use for brand pills at all, so the row goes. */
  function trimPills() {
    var sites = AREAS[area].sites;
    document.querySelectorAll('[data-site]').forEach(function (pill) {
      var s = pill.getAttribute('data-site');
      if (s && sites.indexOf(s) === -1) pill.remove();
      else if (!s && sites.length > 1) pill.textContent = 'Both brands';
    });
    if (sites.length === 1) {
      document.querySelectorAll('[data-site]').forEach(function (pill) {
        var row = pill.closest('.pills, [role="group"]');
        if (row) row.hidden = true; else pill.remove();
      });
    }
  }

  /* The switcher, once we know which areas this person holds. */
  async function drawSwitcher() {
    var me;
    try { me = await global.DSUI.get('/api/admin/me'); } catch (e) { return; }
    var held = {};
    (me.businesses || []).forEach(function (b) { held[b.slug] = true; });
    var allowed = ORDER.filter(function (a) { return AREAS[a].sites.some(function (s) { return held[s]; }); });
    if (!allowed.length) return;
    if (allowed.indexOf(area) === -1) { remember(allowed[0]); global.location.replace(href(allowed[0], 'due.html')); return; }
    if (allowed.length < 2) return;
    var header = document.querySelector('header.top');
    var bar = document.createElement('nav');
    bar.className = 'area-switch';
    bar.setAttribute('aria-label', 'Business');
    allowed.forEach(function (a) {
      var link = document.createElement('a');
      link.href = href(a, hasPage(a, page) ? page : 'due.html');
      link.textContent = AREAS[a].name;
      link.className = 'area-pill area-pill--' + a;
      if (a === area) link.setAttribute('aria-current', 'true');
      bar.appendChild(link);
    });
    header.parentNode.insertBefore(bar, header.nextSibling);
  }

  drawTabs();
  drawLogo();
  trimPills();
  drawSwitcher();

  global.DSAREA = {
    area: area,
    name: AREAS[area].name,
    sites: AREAS[area].sites.slice(),
    books: AREAS[area].books,
    /* The routes that narrow by area. Others ignore it, so adding it is safe,
       but keeping the list honest makes a missing one obvious. */
    scoped: /^\/api\/admin\/(leads|summary|due|clients|jobs|quoted|contracts|calendar|insights)\b/
  };
})(window);
