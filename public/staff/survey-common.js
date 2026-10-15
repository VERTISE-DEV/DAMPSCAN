/* What the survey board, the day sheet and the agents page share: names and
   dates the way staff say them, the Undo toast, the WhatsApp / text / email
   buttons for a message, call and map links, and the header's Sign out. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var BRAND = { dampscan: 'DampScan', 'ati-london': 'ATi' };

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function shortDate(iso) {
    return iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  }
  function londonToday() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  function link(text, href, cls) {
    var a = U.node('a', 'pill act ' + (cls || ''), text);
    a.href = href;
    if (/^https:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function button(text, onClick, cls) {
    var b = U.node('button', 'pill act ' + (cls || ''), text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function tel(phone) { return 'tel:' + String(phone).replace(/[^\d+]/g, ''); }
  function maps(address) { return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address); }

  /* Five seconds to take a change back. The server returned the body that
     undoes it exactly, so there is no "are you sure" first. */
  var toast = null;
  function offerUndo(words, undoBody, done) {
    if (toast) toast.remove();
    var box = toast = U.node('div', 'undo-toast');
    box.setAttribute('role', 'status');
    box.appendChild(U.node('span', null, words));
    var timer = setTimeout(function () { box.remove(); }, 5000);
    if (undoBody) {
      var b = U.node('button', null, 'Undo');
      b.type = 'button';
      b.addEventListener('click', async function () {
        clearTimeout(timer);
        box.remove();
        try { await U.send('/api/admin/surveys', undoBody); } catch (e) { /* the refresh shows the truth */ }
        if (done) done();
      });
      box.appendChild(b);
    }
    document.body.appendChild(box);
  }

  /* One write to the survey route, then the toast. Returns the survey or throws the reason. */
  async function write(body, words, done) {
    var r = await U.send('/api/admin/surveys', body);
    if (!r.ok) throw new Error((r.data && (r.data.message || r.data.error || JSON.stringify(r.data.errors || {}))) || 'Not saved');
    offerUndo(words, r.data.undo, done);
    return r.data.survey;
  }

  /* The three ways to send some words, and the words to read first. */
  function message(m, title) {
    var wrap = U.node('div', 'msg');
    if (title) wrap.appendChild(U.node('p', 'sv-msg-title', title));
    var row = U.node('div', 'msg-actions');
    [['whatsapp', 'WhatsApp'], ['sms', 'Text'], ['email', 'Email']].forEach(function (c) {
      if (m.links[c[0]]) row.appendChild(link(c[1], m.links[c[0]], 'msg-' + c[0]));
    });
    if (!row.children.length) row.appendChild(U.node('span', 'who', 'Add a mobile number or an email address to send this.'));
    wrap.appendChild(row);
    var more = document.createElement('details');
    more.className = 'msg-words';
    more.appendChild(U.node('summary', null, 'Read the message'));
    more.appendChild(U.node('p', null, m.text));
    wrap.appendChild(more);
    return wrap;
  }

  var logout = document.getElementById('logout');
  if (logout) logout.addEventListener('click', async function () {
    await fetch('/api/auth/logout', { method: 'POST' });
    global.location.replace('/staff');
  });

  global.DSSV = { BRAND: BRAND, cap: cap, shortDate: shortDate, londonToday: londonToday, addDays: addDays, link: link, button: button,
    tel: tel, maps: maps, offerUndo: offerUndo, write: write, message: message };
})(window);
