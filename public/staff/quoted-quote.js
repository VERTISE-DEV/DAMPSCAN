/* The quote on the working screen: its cost lines, the markup, the price that
   follows, and the customer's link. Each change sends one op, and the job the
   server returns is what everything is redrawn from, as with every other form
   here. Loads before quoted-lines.js, which fires the first load. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var Q = global.DSQ;
  var el = function (id) { return document.getElementById(id); };
  var KIND = { materials: 'Materials', labour: 'Labour', scaffolding: 'Scaffolding', waste: 'Waste and skip', other: 'Other' };

  function fail(message) {
    var err = el('w-quote-error');
    err.textContent = message;
    err.classList.add('is-shown');
  }

  async function op(body, fallback) {
    el('w-quote-error').classList.remove('is-shown');
    el('w-quote-saved').textContent = '';
    var res;
    try {
      res = await U.send('/api/admin/quoted', Object.assign({ id: Q.state.open.id }, body));
    } catch (e) {
      fail(e.message || fallback);
      return null;
    }
    if (!res.ok) {
      var errors = (res.data && res.data.errors) || {};
      fail(errors[Object.keys(errors)[0]] || fallback);
      return null;
    }
    Q.replace(res.data.job);
    global.DSQJOB.fill(res.data.job);
    return res.data.job;
  }

  var pct = function (bp) { return (bp / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 }) + '%'; };

  function fill(j) {
    var q = j.quote;
    if (!q) return;
    U.table(el('w-quote'), [
      { label: 'Type', get: function (l) { return KIND[l.kind] || l.kind; } },
      { label: 'Description', wrap: true, get: function (l) { return l.description; } },
      { label: 'Cost £', numeric: true, get: function (l) { return U.money(l.costPence); } },
      { label: 'Remove', sr: true, get: function (l) {
          var b = U.node('button', 'pill', 'Remove');
          b.type = 'button';
          b.addEventListener('click', function () {
            if (!global.confirm('Remove ' + l.description + ', ' + U.money(l.costPence) + '?')) return;
            op({ op: 'unqline', lineId: l.id }, 'That line could not be removed.');
          });
          return b;
        } }
    ], q.lines, { empty: 'No quote lines yet. Add what the job will cost you, line by line.' });

    el('w-markup').value = q.markupBp ? String(q.markupBp / 100) : '';
    var tiles = el('w-quote-totals');
    tiles.textContent = '';
    [['Costs', U.money(q.costPence)], ['Markup ' + pct(q.markupBp), U.money(q.markupPence)],
     ['Price net', U.money(q.netPence), true], (q.vatRegistered ? ['VAT ' + pct(q.vatBp), U.money(q.vatPence)] : ['VAT', 'Not registered']), ['Customer pays', U.money(q.totalPence), true]]
      .forEach(function (t) {
        var tile = U.node('div', 'tile' + (t[2] ? ' is-key' : ''));
        tile.appendChild(U.node('span', 'k', t[0]));
        tile.appendChild(U.node('span', 'v', t[1]));
        tiles.appendChild(tile);
      });

    var note = el('w-quote-note');
    if (q.accepted) note.textContent = 'Accepted online by ' + q.accepted.name + ' on ' + U.when(q.accepted.at) + ', at ' + U.money(j.invoiceNetPence) + ' net. That price is agreed: lines added now change your margin, not the price. Book a start date to move it on.';
    else if (!q.lines.length) note.textContent = 'With no lines, the job keeps the price typed under "The job".';
    else if (q.driving) note.textContent = 'While the job is Quoted, its price follows these lines. Once it is booked, the agreed price stays fixed.';
    else note.textContent = 'This job is ' + j.status + ', so its agreed price of ' + U.money(j.invoiceNetPence) + ' stays fixed. Lines added now change your margin, not the price.';

    el('w-quote-link').textContent = q.url ? 'Copy customer link' : 'Make customer link';
    var open = el('w-quote-open');
    open.hidden = !q.url;
    if (q.url) open.href = q.url;
    el('w-quote-costs').hidden = !q.lines.some(function (l) { return l.kind !== 'labour'; });
    el('w-quote-error').classList.remove('is-shown');
    fillInvoice(j);
  }

  el('w-quote-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var cost = U.toPence(el('w-quote-cost').value);
    var description = el('w-quote-desc').value.trim();
    if (cost === null || !description || !el('w-quote-cost').value.trim()) { fail('A quote line needs a description and what it costs you, in pounds.'); return; }
    var job = await op({ op: 'qline', kind: el('w-quote-kind').value, description: description, costPence: cost }, 'That line could not be added.');
    if (job) { el('w-quote-desc').value = ''; el('w-quote-cost').value = ''; el('w-quote-desc').focus(); }
  });

  el('w-markup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var n = Number(String(el('w-markup').value).replace('%', '').trim() || 0);
    if (!(n >= 0)) { fail('Enter the markup as a percentage, 0 or more.'); return; }
    var job = await op({ op: 'markup', markupBp: Math.round(n * 100) }, 'The markup could not be saved.');
    if (job) el('w-quote-saved').textContent = 'Markup saved';
  });

  /* ---------- the invoice ---------- */
  var inv = U.node('div', 'invoice-row');
  var invNote = U.node('p', 'panel-note');
  var invDue = document.createElement('select');
  invDue.id = 'w-invoice-due';
  [['0', 'Due on receipt'], ['7', 'Due in 7 days'], ['14', 'Due in 14 days'], ['30', 'Due in 30 days']].forEach(function (o) {
    var opt = document.createElement('option'); opt.value = o[0]; opt.textContent = o[1]; invDue.appendChild(opt);
  });
  invDue.value = '14';
  invDue.setAttribute('aria-label', 'When payment is due');
  var invBtn = U.node('button', 'btn btn--ghost btn--sm', 'Issue invoice');
  invBtn.type = 'button';
  var invOpen = document.createElement('a');
  invOpen.className = 'btn btn--ghost btn--sm';
  invOpen.target = '_blank';
  invOpen.rel = 'noopener';
  invOpen.textContent = 'Open the invoice';
  [invNote, invDue, invBtn, invOpen].forEach(function (n) { inv.appendChild(n); });
  el('w-quote-error').parentNode.insertBefore(inv, el('w-quote-error'));
  invBtn.addEventListener('click', async function () {
    var open = Q.state.open;
    if (!open.quote.invoice && !global.confirm('Issue an invoice for ' + U.money(open.invoiceNetPence) + (open.quote.vatRegistered ? ' plus VAT' : '') + '? It takes the next invoice number and cannot be undone.')) return;
    var job = await op({ op: 'invoice', dueDays: Number(invDue.value) }, 'The invoice could not be issued.');
    if (job) el('w-quote-saved').textContent = 'Invoice ' + job.quote.invoice.number + ' issued. Send it from Messages.';
  });

  function fillInvoice(j) {
    var q = j.quote;
    var ready = ['booked', 'completed', 'paid'].indexOf(j.status) !== -1 && j.invoiceNetPence > 0;
    inv.hidden = !ready && !q.invoice;
    invOpen.hidden = !(q.invoice && q.invoice.url);
    if (q.invoice && q.invoice.url) invOpen.href = q.invoice.url;
    invBtn.textContent = q.invoice ? 'Change due date' : 'Issue invoice';
    invBtn.disabled = !q.canInvoice;
    invNote.textContent = !q.canInvoice ? q.invoiceBlocker
      : q.invoice ? 'Invoice ' + q.invoice.number + ', issued ' + U.when(q.invoice.issuedAt) + (q.invoice.dueOn ? ', due ' + new Date(q.invoice.dueOn + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '') + '.'
        : 'Ready to invoice: ' + U.money(j.invoiceNetPence) + (q.vatRegistered ? ' plus VAT.' : ', no VAT.');
  }

  el('w-quote-link').addEventListener('click', async function () {
    var job = Q.state.open;
    if (!job.quote.url) job = await op({ op: 'quotelink' }, 'The link could not be made.');
    if (!job || !job.quote.url) return;
    try {
      await navigator.clipboard.writeText(job.quote.url);
      el('w-quote-saved').textContent = 'Link copied. Paste it into a text or email to the customer.';
    } catch (e) {
      global.prompt('Copy this link for the customer:', job.quote.url);
    }
  });

  el('w-quote-costs').addEventListener('click', async function () {
    if (!global.confirm('Copy the materials, scaffolding, waste and other lines into "What it cost"? Labour is left out, because it is paid as owners\' days. A line already copied is not copied again.')) return;
    var job = await op({ op: 'costsfromquote' }, 'The costs could not be copied.');
    if (job) el('w-quote-saved').textContent = 'Costs copied';
  });

  global.DSQQUOTE = { fill: fill };
})(window);
