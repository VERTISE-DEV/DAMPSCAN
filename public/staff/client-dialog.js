/* The big, simple view of one client: filling the dialog from a card.
   Split from clients.js, which holds the grid, the search and the save, when
   the search took that file past the 300 line limit the rest of the project
   keeps to. Everything here reads a card and writes the dialog; nothing here
   knows how the list was fetched or what happens on save. Loaded before
   clients.js, which takes what it needs from window.DSCLIENTDIALOG. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var el = function (id) { return document.getElementById(id); };

  var SITE = { 'ati-london': 'London', dampscan: 'Kent', roofing: 'Roofing', ac: 'CoolRight' };

  function addressLines(c) {
    return [c.address.line1, c.address.line2, c.address.town, c.address.postcode].filter(Boolean);
  }

  function displayName(path) {
    return path.split('/').pop().replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '');
  }

  /* ---------- the dialog ---------- */
  function lines(mount, items) {
    mount.textContent = '';
    items.forEach(function (item, i) {
      if (i) mount.appendChild(document.createElement('br'));
      if (typeof item === 'string') mount.appendChild(document.createTextNode(item));
      else mount.appendChild(item);
    });
  }

  function link(href, text) {
    var a = document.createElement('a');
    a.href = href; a.textContent = text;
    return a;
  }

  /* The finished report, straight from the phone or laptop to storage, then
     saved on the job (lib/report-file.js). */
  async function uploadReport(c, file, status) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { status.textContent = 'That file is over 25MB.'; return; }
    var type = /\.docx$/i.test(file.name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
    status.textContent = 'Uploading…';
    try {
      var ticket = await U.send('/api/admin/clients', { id: c.id, reportUpload: { name: file.name, type: type } });
      if (!ticket.ok) throw new Error(ticket.data && ticket.data.error);
      var put = await fetch(ticket.data.url, { method: 'PUT', headers: { 'Content-Type': type }, body: file });
      if (!put.ok) throw new Error('The upload did not finish. Try again.');
      var saved = await U.send('/api/admin/clients', { id: c.id, reportPath: ticket.data.path, reportName: file.name });
      if (!saved.ok) throw new Error(saved.data && saved.data.error);
      c.reportFile = saved.data.reportFile;
      fillDialog(c);
      status.textContent = 'Report saved.';
    } catch (e) {
      status.textContent = (e && e.message && !/Request failed/.test(e.message)) ? e.message : 'Could not upload the report. Try again.';
    }
  }

  /* The card's to-dos come from the same job view the Today pop-up uses. */
  async function loadTodos(c) {
    var mount = el('c-todos');
    if (!mount || !global.DSTODOS) return;
    mount.textContent = '';
    try {
      var data = await U.get('/api/admin/calendar?view=job&id=' + c.id);
      global.DSTODOS.render(mount, c.id, (data.job && data.job.todos) || [], function () { loadTodos(c); });
    } catch (e) { mount.appendChild(U.node('p', 'panel-note', 'Could not load the to-dos.')); }
  }

  function fillDialog(c) {
    loadTodos(c);
    el('c-name').textContent = c.name || 'No name';
    el('c-sub').textContent = c.survey.label + ' survey' + (c.survey.pricePence == null ? '' : ', ' + U.money(c.survey.pricePence))
      + (c.survey.remedialPence ? ' plus ' + U.money(c.survey.remedialPence) + ' remedial' : '')
      + ' · surveyed by ' + (c.survey.surveyor || 'unassigned').replace(/^./, function (m) { return m.toUpperCase(); })
      + ' · ' + (SITE[c.site] || c.site);

    var contact = [];
    if (c.phone) contact.push(link('tel:' + c.phone.replace(/\s+/g, ''), c.phone));
    if (c.email) contact.push(link('mailto:' + c.email, c.email));
    lines(el('c-contact'), contact.length ? contact : ['No contact details on the enquiry']);

    var addr = addressLines(c);
    lines(el('c-address'), addr.length ? addr : ['No address on file. Add one on the Jobs page or ask the client.']);
    var maps = el('c-maps');
    maps.hidden = !addr.length;
    /* Waze's universal link. On a phone with the app installed it opens the
       app and starts navigating; anywhere else it opens Waze on the web. */
    if (addr.length) maps.href = 'https://www.waze.com/ul?q=' + encodeURIComponent(addr.join(', ')) + '&navigate=yes';

    var enquiry = [];
    if (c.issues.length) enquiry.push('Dealing with: ' + c.issues.join(', '));
    if (c.previousSurvey !== null && c.previousSurvey !== undefined) enquiry.push(c.previousSurvey ? 'Has had a survey before' : 'No previous survey');
    if (c.leadNotes) enquiry.push('They said: ' + c.leadNotes);
    if (!c.leadId) enquiry.push('Recorded by hand on the Jobs page, not from the website form.');
    lines(el('c-enquiry'), enquiry.length ? enquiry : ['Nothing beyond the booking itself.']);

    var files = el('c-files');
    files.textContent = '';
    /* The finished report, saved through the assistant (attach_report). */
    if (c.reportFile) {
      var rli = document.createElement('li');
      var ra = link('/api/admin/attachment?report=' + c.id, 'Report: ' + c.reportFile);
      ra.className = 'pill';
      rli.appendChild(ra);
      files.appendChild(rli);
    }
    var row = el('c-report-row');
    row.hidden = !(c.site === 'dampscan' || c.site === 'ati-london');
    row.querySelector('label').textContent = c.reportFile ? 'Replace report' : 'Upload report';
    el('c-report').value = '';
    el('c-report-status').textContent = '';
    el('c-report').onchange = function () { uploadReport(c, this.files[0], el('c-report-status')); };
    if (!c.files.length && !c.reportFile) files.appendChild(U.node('li', 'empty', 'None attached'));
    c.files.forEach(function (path) {
      var li = document.createElement('li');
      var a = link('/api/admin/attachment?path=' + encodeURIComponent(path), displayName(path));
      a.className = 'pill';
      li.appendChild(a);
      files.appendChild(li);
    });

    el('c-deposit').checked = Boolean(c.money.depositPaidAt);
    /* No amounts for somebody who only works on the business (lib/figures.js);
       they may not tick payments either, so those boxes are locked for them. */
    var figures = c.money.depositPence != null;
    el('c-deposit').disabled = !figures;
    el('c-paid').disabled = !figures;
    el('c-deposit-amt').textContent = figures ? U.money(c.money.depositPence) + ', half the survey price' : '';
    el('c-deposit-when').textContent = c.money.depositPaidAt ? 'on ' + U.when(c.money.depositPaidAt) : '';
    el('c-paid').checked = Boolean(c.money.paidAt);
    el('c-paid-amt').textContent = figures ? U.money(c.survey.pricePence) + ' in total' : '';
    el('c-paid-when').textContent = c.money.paidAt ? 'on ' + U.when(c.money.paidAt) : '';
    el('c-sent').checked = Boolean(c.surveySentAt);
    el('c-sent-when').textContent = c.surveySentAt ? 'on ' + U.when(c.surveySentAt) : '';

    el('c-date').value = c.surveyDate || '';
    el('c-time').value = c.surveyTime || '';
    el('c-agent').checked = Boolean(c.awaitingAgent);
    el('c-note').value = c.note || '';
    /* What the card shows, the job's own or else the enquiry's. A changed
       value is kept on the job, for jobs booked by phone with no enquiry. */
    el('c-address').value = c.fullAddress || [c.address.line1, c.address.line2, c.address.town].filter(Boolean).join(', ');
    el('c-postcode').value = c.address.postcode || '';
    el('c-phone').value = c.phone || '';
    el('c-email').value = c.email || '';
    el('c-edit').href = '/staff/jobs.html#job-' + c.id;
    el('client-error').classList.remove('is-shown');
    el('c-saved').textContent = '';
  }

  global.DSCLIENTDIALOG = { fill: fillDialog, addressLines: addressLines, SITE: SITE };
})(window);
