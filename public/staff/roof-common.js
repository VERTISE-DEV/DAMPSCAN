/* What the Verge pipeline, the week board and the job screen share: the stage
   names, the badge words, a write to /api/admin/roofing with its Undo toast,
   the date question a move to Site visit or Booked asks, the weather chips
   and the finishing checklist. The rules themselves live on the server
   (lib/roofing.js); FROM below only decides where a dragged card may land,
   and the server checks it again. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var STAGES = [['enquiry', 'Enquiry'], ['visit', 'Site visit'], ['quoted', 'Quoted'], ['accepted', 'Accepted'], ['booked', 'Booked'],
    ['in_progress', 'In progress'], ['done', 'Done'], ['paid', 'Paid'], ['reviewed', 'Reviewed']];
  var NAMES = {};
  STAGES.forEach(function (s) { NAMES[s[0]] = s[1]; });
  var FROM = {
    visit: ['quoted'], quoted: ['visit', 'accepted'], accepted: ['visit', 'quoted', 'booked'],
    booked: ['visit', 'quoted', 'accepted', 'in_progress'], in_progress: ['booked', 'done'], done: ['booked', 'in_progress']
  };
  var NEXT = { visit: ['quoted', 'Visit done'], quoted: ['accepted', 'Accepted'], accepted: ['booked', 'Book a date'], booked: ['in_progress', 'Start'], in_progress: ['done', 'Finished'] };
  var BACK = { accepted: 'quoted', booked: 'accepted', in_progress: 'booked', done: 'in_progress' };
  var BADGES = { quote: 'Quote not sent', deposit: 'Deposit due', scaffold: 'Scaffold not booked', materials: 'Materials not ordered',
    late: 'Should have started', unpaid: 'Unpaid', review: 'Rating due', weather: 'Weather' };
  var URGENT = { late: 1, unpaid: 1, weather: 1 };

  function canMove(card, to) { return Boolean(card && FROM[to] && FROM[to].indexOf(card.stage) !== -1 && !card.frozen); }
  function shortDate(iso) {
    return iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
  }
  function londonToday() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function jobHref(id) { return '/staff/quoted.html?area=roofing#job-' + id; }

  var toast = null;
  function offerUndo(words, undoBody, done) {
    if (toast) toast.remove();
    var box = toast = U.node('div', 'undo-toast');
    box.setAttribute('role', 'status');
    box.appendChild(U.node('span', null, words));
    var timer = setTimeout(function () { box.remove(); }, 6000);
    if (undoBody) {
      var b = U.node('button', null, 'Undo');
      b.type = 'button';
      b.addEventListener('click', async function () {
        clearTimeout(timer);
        box.remove();
        try { await U.send('/api/admin/roofing', undoBody); } catch (e) { /* the refresh shows the truth */ }
        if (done) done();
      });
      box.appendChild(b);
    }
    document.body.appendChild(box);
  }

  /* One write, then the toast. Returns the response data or throws the reason. */
  async function write(body, words, done) {
    var r = await U.send('/api/admin/roofing', body);
    if (!r.ok) throw new Error((r.data && (r.data.message || r.data.error)) || 'Not saved');
    if (words) offerUndo(words, r.data.undo, done);
    return r.data;
  }

  /* Site visit and Booked need a day; everything else is one tap. */
  function askDate(title, initial, withTime) {
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog');
      dlg.className = 'book-dialog rf-dialog';
      var form = U.node('form', 'sv-form');
      form.method = 'dialog';
      form.appendChild(U.node('h2', null, title));
      var row = U.node('div', 'form-row');
      var lab = U.node('label', null, 'Date');
      lab.htmlFor = 'rf-ask-date';
      var input = document.createElement('input');
      input.type = 'date'; input.id = 'rf-ask-date'; input.required = true; input.value = initial || '';
      row.appendChild(lab); row.appendChild(input); form.appendChild(row);
      var time = null;
      if (withTime) {
        var trow = U.node('div', 'form-row');
        var tlab = U.node('label', null, 'Time (optional)');
        tlab.htmlFor = 'rf-ask-time';
        time = document.createElement('input');
        time.type = 'time'; time.id = 'rf-ask-time'; time.step = '300';
        trow.appendChild(tlab); trow.appendChild(time); form.appendChild(trow);
      }
      var bar = U.node('div', 'top-end sv-actions');
      var ok = U.node('button', 'btn btn--primary btn--sm', 'Save');
      ok.type = 'submit'; ok.value = 'ok';
      var no = U.node('button', 'btn btn--ghost btn--sm', 'Cancel');
      no.type = 'submit'; no.value = 'cancel'; no.formNoValidate = true;
      bar.appendChild(ok); bar.appendChild(no); form.appendChild(bar);
      dlg.appendChild(form);
      document.body.appendChild(dlg);
      form.addEventListener('submit', function (e) {
        if (e.submitter && e.submitter.value === 'ok' && !input.value) { e.preventDefault(); input.focus(); }
      });
      dlg.addEventListener('close', function () {
        var v = dlg.returnValue === 'ok' && input.value ? { date: input.value, time: time && time.value ? time.value : undefined } : null;
        dlg.remove();
        resolve(v);
      });
      dlg.showModal();
      input.focus();
    });
  }

  /** Move a card to a stage, asking for a date when the stage needs one. */
  async function move(card, to, done) {
    var body = { op: 'stage', id: card.id, to: to };
    if (to === 'visit' || to === 'booked') {
      var got = await askDate(to === 'visit' ? 'When is the site visit?' : 'Start date for ' + (card.firstName || 'this job'),
        to === 'visit' ? card.siteVisitOn : (card.jobDate && card.jobDate >= londonToday() ? card.jobDate : ''), to === 'booked');
      if (!got) return null;
      body.date = got.date;
      if (got.time) body.time = got.time;
    }
    return write(body, (card.firstName || 'Job') + ' moved to ' + NAMES[to] + '.', done);
  }

  function badge(key) { return U.node('span', 'sv-badge rf-badge' + (URGENT[key] ? ' sv-badge--late' : ''), BADGES[key] || key); }

  function weatherChips(card) {
    var box = U.node('span', 'rf-weather');
    (card.weather || []).forEach(function (w) {
      var chip = U.node('span', 'rf-wx' + (w.warn ? ' is-warn' : ''), w.icon);
      var words = shortDate(w.date) + ': ' + w.word + (w.rainChance != null ? ', ' + w.rainChance + '% rain' : '') + (w.gustMph != null ? ', gusts ' + w.gustMph + 'mph' : '');
      chip.title = words;
      chip.setAttribute('aria-label', words);
      box.appendChild(chip);
    });
    return box;
  }

  function crewChips(card) {
    var box = U.node('span', 'rf-crew');
    (card.crew || []).forEach(function (c) { var s = U.node('span', 'rf-initials', c.initials || '?'); s.title = c.name; box.appendChild(s); });
    return box;
  }

  /* The steps after a roof is finished, each one tap: open the job for the
     photos and the page, the message for the rating and the yearly check,
     a tick for the Google post. */
  function finishList(card, done, openMessages) {
    var box = U.node('div', 'rf-finish');
    (card.finish || []).forEach(function (f) {
      var b = U.node(f.key === 'photos' || f.key === 'page' ? 'a' : 'button', 'sv-tick' + (f.done ? ' is-on' : ''), (f.done ? '✓ ' : '') + f.label);
      if (b.tagName === 'A') b.href = jobHref(card.id) + (f.key === 'photos' ? '-photos' : '-page');
      else {
        b.type = 'button';
        b.addEventListener('click', function () {
          if (f.key === 'google') {
            write({ op: 'finish', id: card.id, step: 'google', on: !f.done }, f.done ? 'Google post unticked.' : 'Google post ticked.', done).then(done).catch(function (e) { global.alert(e.message); });
          } else openMessages(card, f.key);
        });
      }
      box.appendChild(b);
    });
    return box;
  }

  /* The rating or yearly-check message for one job, in a dialog. */
  async function messageDialog(card, kind, done) {
    var dlg = document.createElement('dialog');
    dlg.className = 'book-dialog sv-dialog rf-dialog';
    dlg.textContent = 'Loading…';
    document.body.appendChild(dlg);
    dlg.addEventListener('close', function () { dlg.remove(); if (done) done(); });
    dlg.showModal();
    var data;
    try { data = await U.get('/api/admin/roofing?view=job&id=' + card.id); } catch (e) { dlg.textContent = 'Could not load the message.'; return; }
    dlg.textContent = '';
    dlg.appendChild(U.node('h2', null, (kind === 'yearly' ? 'Offer the yearly check to ' : 'Ask ') + (card.firstName || 'the customer') + (kind === 'rating' ? ' how we did' : '')));
    var m = data.messages[kind];
    if (m && global.DSMSG) dlg.appendChild(global.DSMSG.buttons(card.id, m, function () {}));
    else dlg.appendChild(U.node('p', 'panel-note', 'This message is not ready for this job yet.'));
    if (kind === 'yearly') {
      var plan = U.node('a', 'pill act', 'Start a maintenance plan');
      plan.href = jobHref(card.id) + '-contract';
      dlg.appendChild(plan);
    }
    var close = U.node('button', 'btn btn--ghost btn--sm', 'Close');
    close.type = 'button';
    close.addEventListener('click', function () { dlg.close(); });
    var bar = U.node('div', 'top-end sv-actions');
    bar.appendChild(close);
    dlg.appendChild(bar);
  }

  global.DSROOF = {
    STAGES: STAGES, NAMES: NAMES, NEXT: NEXT, BACK: BACK, BADGES: BADGES, canMove: canMove, move: move, write: write, offerUndo: offerUndo,
    askDate: askDate, badge: badge, weatherChips: weatherChips, crewChips: crewChips, finishList: finishList, messageDialog: messageDialog,
    shortDate: shortDate, londonToday: londonToday, addDays: addDays, jobHref: jobHref
  };
})(window);
