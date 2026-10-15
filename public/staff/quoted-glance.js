/* The quote at a glance, at the top of a Verge job: the price and whether it
   is fixed, what the job has cost so far and, for whoever manages the
   business, the live profit (price less costs less clocked labour, the same
   sum as lib/profit.js). Beside it the job's photos, the one-tap Send the
   quote, and the customer's accept-online link to copy. The price book,
   lines and markup stay in the Quote block below; this is the summary a
   roofer reads standing in front of the customer. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var el = function (id) { return document.getElementById(id); };
  var box = U.node('section', 'client-block rq-block');
  box.setAttribute('aria-labelledby', 'h-glance');
  var h = U.node('h3', null, 'The quote at a glance');
  h.id = 'h-glance';
  box.appendChild(h);
  var tiles = U.node('div', 'rq-glance');
  var fixed = U.node('p', 'rq-fixed');
  var thumbs = U.node('div', 'rq-thumbs');
  var send = U.node('div', 'rq-send');
  var bar = U.node('div', 'top-end');
  [tiles, fixed, thumbs, send, bar].forEach(function (n) { box.appendChild(n); });
  var figure = document.querySelector('.work-figure');
  figure.parentNode.insertBefore(box, figure.nextSibling);
  var shownPhotos = null;

  function tile(label, value, sub, key) {
    var d = U.node('div', 'tile' + (key ? ' is-key' : ''));
    d.appendChild(U.node('span', 'k', label));
    d.appendChild(U.node('span', 'v', value));
    if (sub) d.appendChild(U.node('span', 's', sub));
    tiles.appendChild(d);
  }
  function jump(text, id) {
    var b = U.node('button', 'btn btn--ghost btn--sm', text);
    b.type = 'button';
    b.addEventListener('click', function () { var t = el(id); if (t) { t.scrollIntoView({ block: 'start' }); } });
    return b;
  }

  async function photos(id) {
    if (shownPhotos === id) return;
    shownPhotos = id;
    thumbs.textContent = '';
    var data;
    try { data = await U.get('/api/admin/photos?job=' + id); } catch (e) { return; }
    var list = data.photos || [];
    if (!list.length) { thumbs.appendChild(U.node('span', 'who', 'No photos yet: add them in Photos below.')); return; }
    list.slice(0, 8).forEach(function (p) {
      var img = document.createElement('img');
      img.src = '/api/admin/photos?img=' + p.id + '&size=' + (p.hasThumb ? 'thumb' : 'full');
      img.alt = p.caption || 'Job photo';
      img.loading = 'lazy';
      thumbs.appendChild(img);
    });
  }

  function fill(j) {
    box.hidden = j.site !== 'roofing';
    if (box.hidden) return;
    tiles.textContent = '';
    var costs = j.costs.reduce(function (s, c) { return s + c.amountPence; }, 0);
    var lines = j.quote && j.quote.lines ? j.quote.lines.length : 0;
    tile('Price, net of VAT', U.money(j.invoiceNetPence), lines ? lines + (lines === 1 ? ' quote line' : ' quote lines') : 'no lines yet', true);
    tile('Costs so far', U.money(costs), j.costs.length + (j.costs.length === 1 ? ' line' : ' lines'));
    if (j.canSeeProfit && j.profit) {
      tile('Labour', U.money(j.profit.labourPence), j.profit.labourHours + ' hours clocked');
      tile(j.profit.profitPence < 0 ? 'Loss so far' : 'Profit so far', U.money(j.profit.profitPence),
        j.profit.spentBp == null ? '' : Math.round(j.profit.spentBp / 100) + '% of the price spent', true);
    }
    /* The fixed price rule (lib/quote-store.js): a typed price, or any price
       once the job is won, stays put; lines added after it are costs. */
    var follows = j.status === 'quoted' && !(j.quote && (j.quote.accepted || j.quote.fixed));
    fixed.textContent = follows ? 'The price follows the quote lines until you type one, or the customer accepts.'
      : 'Fixed price: ' + U.money(j.invoiceNetPence) + ' is what the customer pays. Lines added now are costs, not a new price.';
    photos(j.id);
    send.textContent = '';
    var q = j.messages && j.messages.ready && j.messages.ready.quote;
    if (q && global.DSMSG) {
      send.appendChild(U.node('p', 'sv-msg-title', global.DSMSG.label(q) + (j.quoteSentAt ? ' again' : '')));
      send.appendChild(global.DSMSG.buttons(j.id, q, function (job) { global.DSQ.replace(job); global.DSQJOB.fill(job); }));
    }
    bar.textContent = '';
    if (j.quote && j.quote.url) {
      var copy = U.node('button', 'btn btn--primary btn--sm', 'Copy the accept-online link');
      copy.type = 'button';
      copy.addEventListener('click', function () {
        var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy the accept-online link'; }, 2000); };
        if (navigator.clipboard) navigator.clipboard.writeText(j.quote.url).then(done, function () { global.prompt('Copy this link', j.quote.url); });
        else global.prompt('Copy this link', j.quote.url);
      });
      bar.appendChild(copy);
    } else if (el('w-quote-link')) {
      bar.appendChild(jump('Make the customer link', 'w-quote-link'));
    }
    bar.appendChild(jump('Price book and lines', 'h-quote'));
    bar.appendChild(jump('Planner', 'rf-plan'));
  }

  document.getElementById('job-dialog').addEventListener('close', function () { shownPhotos = null; });
  global.DSQGLANCE = { fill: fill };
})(window);
