/* Two more Insights panels, from the same /api/admin/insights answer: what
   customers said on the "how did we do" page, and the jobs whose costs and
   clocked labour have eaten past the set share of their price. Kept out of
   insights.js so that file stays a size someone can read in one sitting. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var el = function (id) { return document.getElementById(id); };
  var link = function (id) {
    var a = U.node('a', 'pill', 'Open');
    a.href = '/staff/quoted.html#job-' + id;
    return a;
  };
  var stars = function (n) { return '★'.repeat(n) + '☆'.repeat(5 - n); };

  function render(d) {
    var r = d.ratings;
    var mount = el('ratings');
    if (r && mount) {
      mount.textContent = '';
      var tiles = U.node('div', 'tiles');
      [['Average', r.average === null ? 'None yet' : r.average + ' of 5', 'The last year', true],
        ['Ratings', U.num(r.count)],
        ['Five stars', U.num(r.five), r.count ? Math.round((100 * r.five) / r.count) + '% of them' : '']].forEach(function (t) {
        var tile = U.node('div', 'tile' + (t[3] ? ' is-key' : ''));
        tile.appendChild(U.node('span', 'k', t[0]));
        tile.appendChild(U.node('span', 'v', t[1]));
        if (t[2]) tile.appendChild(U.node('span', 's', t[2]));
        tiles.appendChild(tile);
      });
      mount.appendChild(tiles);
      var low = U.node('div');
      mount.appendChild(U.node('h3', 'search-sub', 'Low ratings to look at'));
      mount.appendChild(low);
      U.table(low, [
        { label: 'Customer', get: function (x) { return x.customerName || 'Not given'; } },
        { label: 'Stars', get: function (x) { return stars(x.stars); } },
        { label: 'What they said', wrap: true, get: function (x) { return x.comment || 'No comment'; } },
        { label: 'Open', sr: true, get: function (x) { return link(x.id); } }
      ], r.low, { empty: 'No low ratings in the last year.' });
    }

    var panel = el('p-budget');
    if (!panel) return;
    panel.hidden = !d.overBudget;
    if (!d.overBudget) return;
    el('budget-note').textContent = 'Jobs from the last year where costs and clocked labour came to more than ' + (d.overBudgetBp / 100) + '% of the price.';
    U.table(el('budget'), [
      { label: 'Customer', get: function (x) { return x.customerName || 'Not given'; } },
      { label: 'Price', numeric: true, get: function (x) { return U.money(x.pricePence); } },
      { label: 'Costs', numeric: true, get: function (x) { return U.money(x.costsPence); } },
      { label: 'Labour', numeric: true, get: function (x) { return U.money(x.labourPence) + ' (' + x.labourHours + 'h)'; } },
      { label: 'Profit', numeric: true, get: function (x) { return U.money(x.profitPence); } },
      { label: 'Used', numeric: true, get: function (x) { return Math.round(x.spentBp / 100) + '%'; } },
      { label: 'Open', sr: true, get: function (x) { return link(x.id); } }
    ], d.overBudget, { empty: 'Nothing over budget. Clock in on jobs to see labour here.' });
  }

  global.DSINSJOBS = { render: render };
})(window);
