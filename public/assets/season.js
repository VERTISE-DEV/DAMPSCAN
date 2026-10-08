/* Swaps the in-season feature for the month it is now, in the visitor's own
   browser. The page was built with whatever was in season on the day of the
   build; the list of every season is in the markup (scripts/season.js), so
   the feature follows the calendar without the site being rebuilt. */
(function () {
  'use strict';
  var month = new Date().getMonth() + 1;
  var nodes = document.querySelectorAll('[data-season-pick]');
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var list;
    try { list = JSON.parse(el.getAttribute('data-season-pick')); } catch (e) { continue; }
    var hit = null;
    for (var j = 0; j < list.length; j++) if (list[j].m.indexOf(month) !== -1) { hit = list[j]; break; }
    if (!hit) { el.hidden = true; continue; }
    var a = el.querySelector('a');
    if (a) a.href = hit.href;
    var label = el.querySelector('[data-season-label]') || a;
    if (label) label.textContent = hit.label;
    var text = el.querySelector('[data-season-text]');
    if (text) text.textContent = hit.text;
    el.hidden = false;
  }
})();
