/* The dashboard's pieces in plain words: the one-line story, tiles with the
   change on the period before, "worth a look" tips worked out from the
   numbers, and bar lists that read on a phone where the old tables were cut
   off past the first column. dashboard.js loads the data and calls these. */
(function (global) {
  'use strict';
  var U = global.DSUI;
  var node = U.node, num = U.num, pct = U.pct;

  var CHANNEL = { organic: 'Google and other search', direct: 'Typed in or saved', referral: 'Other websites', paid: 'Paid ads', social: 'Social media', email: 'Email' };
  var DEVICE = { mobile: 'Phone', desktop: 'Computer', tablet: 'Tablet' };
  var PERIOD = { today: 'today', '7d': 'in the last 7 days', '30d': 'in the last 30 days', all: 'since records began' };
  var CAME = { organic: 'Google and other search', direct: 'typing the address or a saved link', referral: 'other websites', paid: 'paid ads', social: 'social media', email: 'email' };
  var BEFORE = { today: 'yesterday by now', '7d': 'the 7 days before', '30d': 'the 30 days before' };

  var cap = function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; };
  var words = function (slug) { return slug.split('-').map(cap).join(' '); };

  /* "/damp-survey/edenbridge?utm..." to "Damp survey: Edenbridge". */
  function pageName(path) {
    var p = String(path || '').split(/[?#]/)[0].replace(/\/+$/, '');
    if (!p) return 'Home page';
    var parts = p.replace(/^\//, '').split('/');
    if (parts.length === 1) return words(parts[0]);
    var rest = words(parts.slice(1).join('-'));
    if (parts[0] === 'services' || parts[0] === 'guides') return rest;
    var first = parts[0].replace(/-/g, ' ');
    return cap(first) + ': ' + rest;
  }

  function plural(n, one, many) { return num(n) + ' ' + (Number(n) === 1 ? one : many || one + 's'); }

  /* The change on the period before, as "+3" or "-2", and which way is good. */
  function change(now, before) {
    if (before == null) return null;
    var d = Number(now) - Number(before);
    if (!d) return { text: 'same as before', cls: 'is-flat' };
    return { text: (d > 0 ? '+' : '') + num(d) + ' on before', cls: d > 0 ? 'is-up' : 'is-down' };
  }

  function story(sum, range) {
    var c = sum.counters;
    var top = (sum.sources.byChannel || []).slice().sort(function (a, b) { return b.sessions - a.sessions; })[0];
    var s = plural(c.sessions, 'person', 'people') + ' visited ' + PERIOD[range] + ', ' + num(c.callClicks) + ' tapped to call and ' + num(c.bookings) + ' booked online.';
    if (top && c.sessions) s += ' Most came from ' + (CAME[top.key] || top.key) + ' (' + Math.round((top.sessions / c.sessions) * 100) + '%).';
    if (sum.previous && BEFORE[range]) {
      var b = sum.previous.bookings + sum.previous.callClicks, n = c.bookings + c.callClicks;
      s += n === b ? ' Calls and bookings are level with ' + BEFORE[range] + '.' : ' That is ' + Math.abs(n - b) + (n > b ? ' more' : ' fewer') + (Math.abs(n - b) === 1 ? ' call or booking' : ' calls and bookings') + ' than ' + BEFORE[range] + '.';
    }
    return s;
  }

  function tiles(mount, sum) {
    var c = sum.counters, p = sum.previous;
    var enquiries = c.callClicks + c.bookings;
    var list = [
      { k: 'Visitors', v: num(c.sessions), ch: p && change(c.sessions, p.sessions) },
      { k: 'Tapped to call', v: num(c.callClicks), ch: p && change(c.callClicks, p.callClicks) },
      { k: 'Booked online', v: num(c.bookings), ch: p && change(c.bookings, p.bookings), key: true },
      { k: 'Visitors who got in touch', v: c.sessions ? pct((enquiries / c.sessions) * 100) : '0%', s: num(enquiries) + ' calls and bookings', key: true },
      { k: 'Started but stopped', v: num(c.partials), s: 'left their number, did not finish' }
    ];
    mount.textContent = '';
    list.forEach(function (t) {
      var d = node('div', 'tile' + (t.key ? ' is-key' : ''));
      d.appendChild(node('span', 'k', t.k));
      d.appendChild(node('span', 'v', t.v));
      if (t.ch) d.appendChild(node('span', 's dash-change ' + t.ch.cls, t.ch.text));
      else if (t.s) d.appendChild(node('span', 's', t.s));
      mount.appendChild(d);
    });
  }

  /* A row per thing: its name, a bar for visitors, and what they did. */
  function bars(mount, rows, name, opts) {
    opts = opts || {};
    mount.textContent = '';
    rows = (rows || []).filter(function (r) { return r.sessions > 0 || r.callClicks > 0 || r.bookings > 0; });
    if (!rows.length) { mount.appendChild(node('p', 'empty', opts.empty || 'Nothing in this period.')); return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r.sessions; }).concat(1));
    var limit = opts.limit || rows.length;
    var list = node('ul', 'dash-bars');
    rows.forEach(function (r, i) {
      var li = node('li', i >= limit ? 'is-extra' : null);
      if (i >= limit) li.hidden = true;
      var head = node('div', 'dash-bar-head');
      head.appendChild(node('span', 'dash-bar-name', name(r.key)));
      head.appendChild(node('span', 'dash-bar-num', plural(r.sessions, 'visitor')));
      li.appendChild(head);
      var bar = node('div', 'dash-bar'); var fill = node('span');
      fill.style.width = Math.max(2, Math.round((r.sessions / max) * 100)) + '%';
      bar.appendChild(fill); li.appendChild(bar);
      var did = [r.callClicks ? plural(r.callClicks, 'call') : null, r.bookings ? plural(r.bookings, 'booking') : null].filter(Boolean);
      li.appendChild(node('span', 'dash-bar-did' + (did.length ? ' is-good' : ''), did.length ? did.join(', ') + ' (' + pct(r.bookingRate) + ' booked)' : 'No calls or bookings'));
      list.appendChild(li);
    });
    mount.appendChild(list);
    if (rows.length > limit) {
      var more = node('button', 'btn btn--ghost btn--sm', 'Show all ' + rows.length);
      more.type = 'button';
      more.addEventListener('click', function () { list.querySelectorAll('.is-extra').forEach(function (li) { li.hidden = false; }); more.remove(); });
      mount.appendChild(more);
    }
  }

  function funnel(mount, f) {
    mount.textContent = '';
    var steps = [['Opened the form', f.step1], ['Got to step 2', f.step2], ['Got to step 3', f.step3], ['Booked', f.submitted]];
    if (!f.step1) { mount.appendChild(node('p', 'empty', 'Nobody opened the booking form in this period.')); return; }
    var list = node('ol', 'dash-funnel');
    steps.forEach(function (s, i) {
      var li = node('li');
      var kept = Math.round((s[1] / f.step1) * 100);
      li.appendChild(node('span', 'dash-bar-name', s[0]));
      li.appendChild(node('span', 'dash-bar-num', num(s[1]) + (i ? ' (' + kept + '%)' : '')));
      var bar = node('div', 'dash-bar'); var fill = node('span');
      fill.style.width = Math.max(2, kept) + '%';
      bar.appendChild(fill); li.appendChild(bar);
      list.appendChild(li);
    });
    mount.appendChild(list);
  }

  /* Up to four things the numbers say are worth doing something about. */
  function tips(sum) {
    var out = [], c = sum.counters, f = sum.funnel;
    var drops = [['between step 1 and 2', f.step1 - f.step2, f.step1], ['between step 2 and 3', f.step2 - f.step3, f.step2], ['on the last step', f.step3 - f.submitted, f.step3]]
      .filter(function (d) { return d[2] >= 5; }).sort(function (a, b) { return b[1] - a[1]; });
    if (drops.length && drops[0][1] > 0) out.push('Most people who give up on the form do it ' + drops[0][0] + ' (' + plural(drops[0][1], 'person', 'people') + '). That step is the one to make simpler.');
    var err = (f.errorsByField || [])[0];
    if (err && err.sessions >= 2) out.push(plural(err.sessions, 'person', 'people') + ' got the "' + err.field + '" box wrong. A clearer hint there would save some bookings.');
    var pages = (sum.landingPages || []).filter(function (r) { return r.sessions >= 10 && !r.callClicks && !r.bookings; }).sort(function (a, b) { return b.sessions - a.sessions; });
    if (pages[0]) out.push(pageName(pages[0].key) + ' had ' + plural(pages[0].sessions, 'visitor') + ' and nobody called or booked. Check the page has a clear price and Book button near the top.');
    var best = (sum.landingPages || []).filter(function (r) { return r.bookings > 0; }).sort(function (a, b) { return b.bookings - a.bookings; })[0];
    if (best) out.push(pageName(best.key) + ' brought the most bookings (' + num(best.bookings) + '). More pages like it would help.');
    var dev = {}; (sum.devices || []).forEach(function (d) { dev[d.key] = d; });
    if (dev.mobile && dev.desktop && dev.mobile.sessions >= 20 && dev.desktop.sessions >= 10 && dev.mobile.bookingRate < dev.desktop.bookingRate / 2)
      out.push('People on phones book far less than on computers (' + pct(dev.mobile.bookingRate) + ' against ' + pct(dev.desktop.bookingRate) + '). Worth trying the form on a phone.');
    if (!out.length && c.sessions) out.push('Nothing stands out. Keep going.');
    return out.slice(0, 4);
  }

  global.DSDASH = { story: story, tiles: tiles, bars: bars, funnel: funnel, tips: tips, pageName: pageName, CHANNEL: CHANNEL, DEVICE: DEVICE };
})(window);
