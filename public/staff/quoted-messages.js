/* The Messages block on the job screen: every message the job can send now,
   with when each last went. Built here rather than written into quoted.html,
   which is the page that has to stay under the size the project keeps to. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var M = global.DSMSG;
  var ORDER = ['quote', 'followup', 'reminder', 'invoice', 'review'];

  var block = document.createElement('section');
  block.className = 'client-block msg-block';
  block.setAttribute('aria-labelledby', 'h-messages');
  block.appendChild(U.node('h3', null, 'Messages'));
  block.firstChild.id = 'h-messages';
  var intro = U.node('p', 'panel-note', 'Opens on your phone with the words written. You send it; tapping a button records that it went.');
  var list = U.node('div', 'msg-list');
  block.appendChild(intro);
  block.appendChild(list);
  var quote = document.querySelector('#job-dialog .quote-block');
  quote.parentNode.insertBefore(block, quote.nextSibling);

  function fill(j) {
    list.textContent = '';
    var m = j.messages;
    if (!m) return;
    var any = false;
    ORDER.forEach(function (kind) {
      var msg = m.ready[kind];
      if (!msg) return;
      any = true;
      var item = U.node('div', 'msg-item' + (m.due && m.due.kind === kind ? ' is-due' : ''));
      var head = U.node('div', 'msg-head');
      head.appendChild(U.node('strong', null, M.label(msg)));
      if (m.due && m.due.kind === kind) head.appendChild(U.node('span', 'tag', 'Due now'));
      var when = M.lastSent(m.sent, kind);
      if (when) head.appendChild(U.node('span', 'who', when));
      item.appendChild(head);
      item.appendChild(M.buttons(j.id, msg, function (job) { global.DSQ.replace(job); global.DSQJOB.fill(job); }));
      list.appendChild(item);
    });
    if (!any) list.appendChild(U.node('p', 'panel-note', 'Make the customer link under Quote to send the quote. Follow-ups, the booking reminder and the review request appear here at their stage.'));
  }

  global.DSQMSG = { fill: fill };
})(window);
