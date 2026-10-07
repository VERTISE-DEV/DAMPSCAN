/* The pipeline: every quoted-trade job as a card in the stage it is at, from
   a new web enquiry to paid. A card moves by dragging or by its buttons, and
   each move is the same 'status' op the job screen would send, so the board
   is a view of the jobs and never a second copy of them. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var el = function (id) { return document.getElementById(id); };
  var state = { jobs: [], enquiries: [], dragging: null, pending: null };

  var STAGES = [
    { key: 'enquiry', name: 'New enquiries' },
    { key: 'quoted', name: 'Quoted' },
    { key: 'booked', name: 'Booked' },
    { key: 'completed', name: 'Done, not paid' },
    { key: 'paid', name: 'Paid, last 30 days' }
  ];
  /* Where a card at each stage may go, and the button that sends it there. */
  var MOVES = {
    quoted: [['booked', 'Won, book it'], ['declined', 'Lost']],
    booked: [['completed', 'Finished'], ['quoted', 'Not booked after all'], ['cancelled', 'Cancelled']],
    completed: [['booked', 'Not finished']]
  };
  var DUE = { followup: 'Follow-up due', reminder: 'Reminder due', review: 'Ask for a review' };
  var DAY = 86400000;
  var today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

  function daysSince(iso) { return iso ? Math.floor((Date.parse(today) - Date.parse(String(iso).slice(0, 10))) / DAY) : null; }
  function short(iso) { return new Date(String(iso).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function canMove(job, to) { return (MOVES[job.status] || []).some(function (m) { return m[0] === to; }); }

  function stageOf(job) {
    if (job.status === 'paid') return daysSince(job.money.lastPaidOn) <= 30 ? 'paid' : null;
    return MOVES[job.status] ? job.status : null;
  }

  function meta(job) {
    if (job.status === 'quoted') {
      var out = daysSince(job.quoteSentAt);
      return out === null ? 'Quote not sent yet' : 'Quote out ' + out + (out === 1 ? ' day' : ' days');
    }
    if (job.status === 'booked') return short(job.jobDate) + (job.jobTime ? ' at ' + job.jobTime : '');
    if (job.status === 'completed') return U.money(Math.max(0, job.money.outstandingPence)) + ' still to come in';
    return job.money.lastPaidOn ? 'Paid ' + short(job.money.lastPaidOn) : 'Paid';
  }

  function jobCard(job) {
    var card = U.node('article', 'card');
    card.draggable = Boolean(MOVES[job.status]);
    card.dataset.id = String(job.id);
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('span', 'card-name', job.customerName || 'No name'));
    top.appendChild(U.node('span', 'card-value', U.money(job.invoiceNetPence)));
    card.appendChild(top);
    card.appendChild(U.node('span', 'card-meta', [job.customerPostcode, meta(job)].filter(Boolean).join(' · ')));
    if (job.quote && job.quote.accepted) card.appendChild(U.node('span', 'tag tag--good', 'Accepted online, book a date'));
    else if (job.messages && job.messages.due) card.appendChild(U.node('span', 'tag tag--accent', DUE[job.messages.due.kind]));
    var actions = U.node('div', 'card-actions');
    var open = document.createElement('a');
    open.className = 'pill';
    open.href = '/staff/quoted.html#job-' + job.id;
    open.textContent = 'Open';
    actions.appendChild(open);
    (MOVES[job.status] || []).forEach(function (m) {
      var b = U.node('button', 'pill', m[1]);
      b.type = 'button';
      b.addEventListener('click', function () { move(job, m[0]); });
      actions.appendChild(b);
    });
    card.appendChild(actions);
    card.addEventListener('dragstart', function (e) { state.dragging = job; card.classList.add('is-dragging'); e.dataTransfer.setData('text/plain', String(job.id)); });
    card.addEventListener('dragend', function () { state.dragging = null; card.classList.remove('is-dragging'); });
    return card;
  }

  function enquiryCard(lead) {
    var card = U.node('article', 'card');
    var top = U.node('div', 'card-top');
    top.appendChild(U.node('span', 'card-name', lead.firstName || 'No name'));
    card.appendChild(top);
    card.appendChild(U.node('span', 'card-meta', [lead.postcode, 'In ' + U.when(lead.createdAt)].filter(Boolean).join(' · ')));
    if (lead.issues.length) card.appendChild(U.node('span', 'card-meta', lead.issues.join(', ')));
    var actions = U.node('div', 'card-actions');
    var start = U.node('button', 'pill', 'Start a quote');
    start.type = 'button';
    start.addEventListener('click', function () { startQuote(lead, start); });
    actions.appendChild(start);
    card.appendChild(actions);
    return card;
  }

  function column(stage, cards, valuePence) {
    var col = U.node('section', 'col');
    col.dataset.stage = stage.key;
    col.setAttribute('aria-label', stage.name);
    var head = U.node('div', 'col-head');
    head.appendChild(U.node('h2', null, stage.name));
    head.appendChild(U.node('span', null, String(cards.length)));
    col.appendChild(head);
    if (valuePence !== null) col.appendChild(U.node('span', 'col-value', U.money(valuePence)));
    cards.forEach(function (c) { col.appendChild(c); });
    if (!cards.length) col.appendChild(U.node('p', 'panel-note', 'Nothing here.'));
    col.addEventListener('dragover', function (e) {
      if (state.dragging && canMove(state.dragging, stage.key)) { e.preventDefault(); col.classList.add('is-target'); }
    });
    col.addEventListener('dragleave', function () { col.classList.remove('is-target'); });
    col.addEventListener('drop', function (e) {
      e.preventDefault();
      col.classList.remove('is-target');
      if (state.dragging && canMove(state.dragging, stage.key)) move(state.dragging, stage.key);
    });
    return col;
  }

  function render() {
    var by = { quoted: [], booked: [], completed: [], paid: [] };
    var lost = 0;
    var cancelled = 0;
    state.jobs.forEach(function (j) {
      var s = stageOf(j);
      if (s) by[s].push(j);
      else if (j.status === 'declined' && daysSince(j.jobDate) <= 90) lost += 1;
      else if (j.status === 'cancelled' && daysSince(j.jobDate) <= 90) cancelled += 1;
    });
    by.booked.sort(function (a, b) { return String(a.jobDate).localeCompare(String(b.jobDate)); });
    var sum = function (list) { return list.reduce(function (s, j) { return s + j.invoiceNetPence; }, 0); };
    var board = el('board');
    board.textContent = '';
    board.appendChild(column(STAGES[0], state.enquiries.map(enquiryCard), null));
    STAGES.slice(1).forEach(function (stage) { board.appendChild(column(stage, by[stage.key].map(jobCard), sum(by[stage.key]))); });

    /* The conversion rate counts quotes that have had an answer, so a
       quote sent yesterday does not count against it. */
    var won = state.jobs.filter(function (j) { return ['booked', 'completed', 'paid'].indexOf(j.status) !== -1 && daysSince(j.jobDate) <= 90; }).length;
    var tiles = el('tiles');
    tiles.textContent = '';
    [['Quoted, waiting', U.money(sum(by.quoted))], ['Booked in', U.money(sum(by.booked))],
     ['Won in 90 days', won + (won + lost ? ' (' + Math.round((100 * won) / (won + lost)) + '%)' : '')],
     ['Messages due', String(state.jobs.filter(function (j) { return j.messages && j.messages.due; }).length)]]
      .forEach(function (t) {
        var tile = U.node('div', 'tile');
        tile.appendChild(U.node('span', 'k', t[0]));
        tile.appendChild(U.node('span', 'v', t[1]));
        tiles.appendChild(tile);
      });
    el('foot').textContent = lost + ' lost and ' + cancelled + ' cancelled in the last 90 days.';
  }

  async function send(job, body) {
    var res = await U.send('/api/admin/quoted', Object.assign({ id: job.id }, body));
    if (!res.ok) {
      var errors = (res.data && res.data.errors) || {};
      global.alert(errors[Object.keys(errors)[0]] || 'That could not be saved.');
      return null;
    }
    state.jobs = state.jobs.map(function (j) { return j.id === res.data.job.id ? res.data.job : j; });
    render();
    return res.data.job;
  }

  /* Booking needs a start date, so it asks; every other move is one tap. */
  function move(job, to) {
    if (to !== 'booked' || job.status === 'completed') { send(job, { op: 'status', status: to }); return; }
    state.pending = job;
    el('book-date').value = job.status === 'quoted' ? '' : String(job.jobDate || '').slice(0, 10);
    el('book-time').value = job.jobTime || '';
    el('book-error').classList.remove('is-shown');
    el('book-dialog').showModal();
  }

  el('book-form').addEventListener('submit', async function (e) {
    var choice = e.submitter && e.submitter.value;
    if (choice !== 'book') return;
    e.preventDefault();
    var date = el('book-date').value;
    if (!date) { el('book-error').textContent = 'Choose the start date.'; el('book-error').classList.add('is-shown'); return; }
    var job = state.pending;
    el('book-dialog').close();
    await send(job, { op: 'status', status: 'booked', jobDate: date, jobTime: el('book-time').value || undefined });
  });

  async function startQuote(lead, button) {
    button.disabled = true;
    var res = await U.send('/api/admin/quoted', {
      op: 'save', site: lead.site, leadId: lead.id, customerName: lead.firstName, customerPostcode: lead.postcode,
      status: 'quoted', note: lead.issues.join(', ')
    });
    if (!res.ok) { button.disabled = false; global.alert('The quote could not be started.'); return; }
    global.location.href = '/staff/quoted.html#job-' + res.data.job.id;
  }

  async function refresh() {
    try {
      var both = await Promise.all([U.get('/api/admin/quoted?range=all'), U.get('/api/admin/due')]);
      state.jobs = both[0].jobs || [];
      state.enquiries = both[1].enquiries || [];
      render();
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
