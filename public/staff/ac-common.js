/* What the CoolRight board, the service round and the job screen share: the
   stage names, the badge words, a write to /api/admin/coolright with its Undo
   toast, and the moves (a survey asks for its day, an install date for its
   day and time). The rules live on the server (lib/coolright.js); FROM here
   only decides where a dragged card may land, and the server checks again.
   Needs roof-common.js loaded first for its date question. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var R = global.DSROOF;
  var STAGES = [['enquiry', 'Enquiry'], ['survey', 'Survey'], ['quoted', 'Quoted'], ['accepted', 'Accepted'], ['installed', 'Installed'],
    ['commissioned', 'Commissioned'], ['paid', 'Paid']];
  var NAMES = {};
  STAGES.forEach(function (s) { NAMES[s[0]] = s[1]; });
  var FROM = { survey: ['quoted'], quoted: ['survey', 'accepted'], accepted: ['survey', 'quoted', 'installed'], installed: ['accepted', 'commissioned'], commissioned: ['installed'] };
  var NEXT = { survey: ['quoted', 'Survey done'], quoted: ['accepted', 'Accepted'], accepted: ['installed', 'Installed'], installed: ['commissioned', 'Commissioned'] };
  var BACK = { accepted: 'quoted', installed: 'accepted', commissioned: 'installed' };
  var BADGES = { survey: 'Survey not booked', quote: 'Quote not sent', deposit: 'Deposit due', kit: 'Kit not ordered', late: 'Install date passed',
    commission: 'Not commissioned', fgas: 'F-gas record missing', unpaid: 'Unpaid', plan: 'Service plan not offered', warranty: 'Warranty ending' };
  var URGENT = { late: 1, unpaid: 1, fgas: 1, warranty: 1 };
  var API = '/api/admin/coolright';

  function canMove(card, to) { return Boolean(card && FROM[to] && FROM[to].indexOf(card.stage) !== -1 && !card.frozen); }
  function jobHref(id) { return '/staff/quoted.html?area=ac#job-' + id; }

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
        try { await U.send(API, undoBody); } catch (e) { /* the refresh shows the truth */ }
        if (done) done();
      });
      box.appendChild(b);
    }
    document.body.appendChild(box);
  }

  /* One write, then the toast. Returns the response data or throws the reason. */
  async function write(body, words, done) {
    var r = await U.send(API, body);
    if (!r.ok) throw new Error((r.data && (r.data.message || r.data.error)) || 'Not saved');
    if (words) offerUndo(words, r.data.undo, done);
    return r.data;
  }

  /** Move a card, asking for the survey day when it needs one. */
  async function move(card, to, done) {
    var body = { op: 'stage', id: card.id, to: to };
    if (to === 'survey') {
      var got = await R.askDate('When is the survey?', card.siteVisitOn || '', false);
      if (!got) return null;
      body.date = got.date;
    }
    return write(body, (card.firstName || 'Job') + ' moved to ' + NAMES[to] + '.', done);
  }

  /** Book or move the install date. */
  async function installDate(card, done) {
    var got = await R.askDate('Install date for ' + (card.firstName || 'this job'), card.status === 'booked' ? card.jobDate : '', true);
    if (!got) return null;
    return write({ op: 'date', id: card.id, date: got.date, time: got.time }, 'Install booked for ' + R.shortDate(got.date) + '.', done);
  }

  function badge(key) { return U.node('span', 'sv-badge' + (URGENT[key] ? ' sv-badge--late' : ''), BADGES[key] || key); }

  global.DSAC = { STAGES: STAGES, NAMES: NAMES, NEXT: NEXT, BACK: BACK, BADGES: BADGES, canMove: canMove, move: move, installDate: installDate,
    write: write, offerUndo: offerUndo, badge: badge, jobHref: jobHref };
})(window);
