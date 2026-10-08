/* Fills the "Recent jobs in this region" section of a regional page with the
   finished job pages in its postcode areas. The regional page is static and
   the jobs are published from the staff area, so the list is fetched; with
   nothing to show, the section stays hidden. */
(function () {
  'use strict';
  var box = document.querySelector('[data-work-near]');
  if (!box || !window.fetch) return;
  var site = document.documentElement.getAttribute('data-site');
  var areas = box.getAttribute('data-work-near').split(/\s+/).join(',');
  fetch('/api/gallery?site=' + encodeURIComponent(site) + '&near=' + encodeURIComponent(areas), { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.jobs || !data.jobs.length) return;
      var list = box.querySelector('ul');
      data.jobs.forEach(function (j) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = j.href;
        a.textContent = j.title;
        li.appendChild(a);
        list.appendChild(li);
      });
      box.hidden = false;
    })
    .catch(function () {});
})();
