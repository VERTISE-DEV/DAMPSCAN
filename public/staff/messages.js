/* One-tap customer messages: the words already written, opened in WhatsApp,
   Messages or the mail app on the staff member's own phone. Nothing is sent
   from here. Tapping a channel records that the message went, which is what
   takes it off the Due list, and then the link opens as normal.

   The words and links are built on the server by lib/messages.js, so the Due
   list and the job screen always offer the same message. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var LABEL = { quote: 'Send the quote', followup: 'Follow up the quote', reminder: 'Remind them of the booking', review: 'Ask for a review', invoice: 'Send the invoice' };
  var CHANNELS = [['whatsapp', 'WhatsApp'], ['sms', 'Text'], ['email', 'Email']];
  var SENT = { whatsapp: 'WhatsApp', sms: 'text', email: 'email' };

  function label(m) {
    return m.kind === 'followup' && m.followupNumber > 1 ? 'Last follow-up' : LABEL[m.kind];
  }

  /* keepalive, because tapping Text or Email navigates away from the page and
     an ordinary request would be cancelled with it. */
  function record(jobId, kind, channel) {
    return fetch('/api/admin/quoted', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ op: 'message', id: jobId, kind: kind, channel: channel })
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  /** The buttons and a readable copy of the words, for one message. */
  function buttons(jobId, m, onSent) {
    var wrap = U.node('div', 'msg');
    var row = U.node('div', 'msg-actions');
    CHANNELS.forEach(function (c) {
      var href = m.links[c[0]];
      if (!href) return;
      var a = document.createElement('a');
      a.className = 'pill msg-' + c[0];
      a.href = href;
      a.textContent = c[1];
      if (c[0] === 'whatsapp') { a.target = '_blank'; a.rel = 'noopener'; }
      a.addEventListener('click', function () {
        record(jobId, m.kind, c[0]).then(function (data) { if (data && data.job && onSent) onSent(data.job); });
      });
      row.appendChild(a);
    });
    if (!row.children.length) row.appendChild(U.node('span', 'who', 'Add a mobile number or an email address to send this.'));
    var more = document.createElement('details');
    more.className = 'msg-words';
    more.appendChild(U.node('summary', null, 'Read the message'));
    more.appendChild(U.node('p', null, m.text));
    wrap.appendChild(row);
    wrap.appendChild(more);
    return wrap;
  }

  /** "Sent by WhatsApp on 3 Oct", for the last time this kind went. */
  function lastSent(sent, kind) {
    var mine = sent.filter(function (s) { return s.kind === kind; });
    if (!mine.length) return '';
    var last = mine[mine.length - 1];
    return 'Sent by ' + SENT[last.channel] + ' on ' + new Date(last.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' }) +
      (mine.length > 1 ? ' (' + mine.length + ' times)' : '');
  }

  global.DSMSG = { buttons: buttons, label: label, lastSent: lastSent };
})(window);
