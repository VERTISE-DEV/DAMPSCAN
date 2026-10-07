/* The staff site's two levels of navigation.

   Across the top: the companies, ATi & DampScan, Verge Roofing and CoolRight,
   and the Calendar, which is one view of every company's work together.
   Underneath, once a company is chosen: its own sections (Due, Leads,
   Pipeline and the rest), which differ because the businesses work
   differently. Every page shows only the chosen company's data.

   The company comes from ?area= in the address, then from the last one used
   on this device, then the first the signed in person holds. A person sees
   only the companies their grants cover; the shared owners' code and an
   admin see all three.

   Loaded straight after ui.js on every staff page and before the page's own
   script, so the navigation and the brand pills are right before anything
   loads, and DSUI.get adds the company to every request that takes one. */
(function (global) {
  'use strict';

  var AREAS = {
    damp: {
      name: 'ATi & DampScan', sites: ['dampscan', 'ati-london'], books: 'damp',
      tabs: [['Due', 'due.html'], ['Leads', 'dashboard.html'], ['Jobs', 'jobs.html'], ['Clients', 'clients.html'], ['Insights', 'insights.html'], ['Bank', 'bank.html']]
    },
    roofing: {
      name: 'Verge Roofing', sites: ['roofing'], books: 'roofing',
      tabs: [['Due', 'due.html'], ['Leads', 'dashboard.html'], ['Pipeline', 'pipeline.html'], ['Quotes and jobs', 'quoted.html'], ['Insights', 'insights.html'], ['Bank', 'bank.html']]
    },
    ac: {
      name: 'CoolRight', sites: ['ac'], books: 'ac',
      tabs: [['Due', 'due.html'], ['Leads', 'dashboard.html'], ['Pipeline', 'pipeline.html'], ['Quotes and jobs', 'quoted.html'], ['Insights', 'insights.html'], ['Bank', 'bank.html']]
    }
  };
  var ORDER = ['damp', 'roofing', 'ac'];
  var KEY = 'ds_staff_area';
  var CALENDAR = 'calendar.html';

  function stored() { try { return global.localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(a) { try { global.localStorage.setItem(KEY, a); } catch (e) {} }

  var page = global.location.pathname.split('/').pop() || 'due.html';
  /* The calendar belongs to no one company: it shows them all together. */
  var overall = page === CALENDAR;
  var fromUrl = new URLSearchParams(global.location.search).get('area');
  var area = AREAS[fromUrl] ? fromUrl : (AREAS[stored()] ? stored() : 'damp');
  if (!overall) remember(area);

  function href(a, file) { return '/staff/' + file + '?area=' + a; }
  function hasPage(a, file) { return AREAS[a].tabs.some(function (t) { return t[1] === file; }); }

  /* A page this company does not have, such as Jobs under Verge, goes to the
     company's first section rather than showing another business's screen. */
  if (!overall && !hasPage(area, page)) { global.location.replace(href(area, AREAS[area].tabs[0][1])); return; }

  var root = document.documentElement;
  if (!overall) root.setAttribute('data-area', area);

  function link(text, to, current, cls) {
    var a = document.createElement('a');
    a.href = to;
    a.textContent = text;
    if (cls) a.className = cls;
    if (current) a.setAttribute('aria-current', 'page');
    return a;
  }

  /* The top bar: one link per company, then the Calendar. */
  function drawCompanies(allowed) {
    var nav = document.querySelector('nav.tabs');
    if (!nav) return;
    nav.textContent = '';
    nav.setAttribute('aria-label', 'Companies');
    allowed.forEach(function (a) { nav.appendChild(link(AREAS[a].name, href(a, 'due.html'), !overall && a === area, 'co-tab co-tab--' + a)); });
    nav.appendChild(link('Calendar', '/staff/' + CALENDAR, overall, 'co-tab co-tab--calendar'));
  }

  /* The row under it: the chosen company's own sections. */
  function drawSections() {
    if (overall) return;
    var header = document.querySelector('header.top');
    if (!header) return;
    var bar = document.createElement('nav');
    bar.className = 'section-tabs';
    bar.setAttribute('aria-label', AREAS[area].name + ' sections');
    AREAS[area].tabs.forEach(function (t) { bar.appendChild(link(t[0], href(area, t[1]), t[1] === page, 'section-tab')); });
    header.parentNode.insertBefore(bar, header.nextSibling);
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

  /* Which companies this person holds, once /api/admin/me says. Until then
     the top bar shows all three, which is what most people with access see. */
  async function trimCompanies() {
    var me;
    try { me = await global.DSUI.get('/api/admin/me'); } catch (e) { return; }
    var held = {};
    (me.businesses || []).forEach(function (b) { held[b.slug] = true; });
    var allowed = ORDER.filter(function (a) { return AREAS[a].sites.some(function (s) { return held[s]; }); });
    if (!allowed.length) return;
    if (!overall && allowed.indexOf(area) === -1) { remember(allowed[0]); global.location.replace(href(allowed[0], 'due.html')); return; }
    drawCompanies(allowed);
  }

  drawCompanies(ORDER);
  drawSections();
  if (!overall) { drawLogo(); trimPills(); }
  trimCompanies();

  global.DSAREA = {
    area: overall ? null : area,
    name: overall ? 'All companies' : AREAS[area].name,
    sites: overall ? [] : AREAS[area].sites.slice(),
    books: overall ? null : AREAS[area].books,
    /* The routes that narrow by company. The calendar asks for every company
       the person holds, so nothing is added to its requests. */
    scoped: overall ? /(?!)/ : /^\/api\/admin\/(leads|summary|due|clients|jobs|quoted|contracts|calendar|insights)\b/
  };
})(window);
