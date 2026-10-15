/* The To-do drawer on Today: the shared to-do list (lib/todos.js) without
   leaving the calendar. Mine, Set by me, Failed and Done, an add form, and a
   tick that can be undone for five seconds. It talks to /api/admin/todos,
   the same route as todo.html, which still works for old links.
   Opened by the To-do button, or by #todo in the address (where alerts about
   a to-do now land); #todo-add opens it with the add form ready to type. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var W = global.DSWORK;
  var NAME = { dampscan: 'DampScan', 'ati-london': 'ATi', roofing: 'Verge Roofing', ac: 'CoolRight' };
  var VIEWS = [['open', 'Mine'], ['set', 'Set by me'], ['failed', 'Failed'], ['done', 'Done']];
  var state = { view: 'open', filled: false };

  var drawer = U.node('aside', 'todo-drawer');
  drawer.id = 'todo-drawer';
  drawer.hidden = true;
  drawer.setAttribute('aria-label', 'To-do list');
  var head = U.node('div', 'todo-drawer-head');
  head.appendChild(U.node('h2', null, 'To-do'));
  var close = U.node('button', 'btn btn--ghost btn--sm', 'Close');
  close.type = 'button';
  head.appendChild(close);
  drawer.appendChild(head);

  var form = U.node('form', 'todo-add');
  var text = document.createElement('textarea');
  text.rows = 2; text.maxLength = 2000; text.required = true;
  var forSel = document.createElement('select');
  forSel.appendChild(new Option('Everyone', ''));
  var due = document.createElement('input');
  due.type = 'date';
  function label(words, field, cls) { var l = U.node('label', cls, words + ' '); l.appendChild(field); return l; }
  form.appendChild(label('What needs doing', text, 'todo-text'));
  form.appendChild(label('For', forSel));
  form.appendChild(label('Due', due));
  var addBtn = U.node('button', 'btn btn--primary btn--sm', 'Add');
  addBtn.type = 'submit';
  form.appendChild(addBtn);
  var note = U.node('p', 'panel-note');
  note.setAttribute('role', 'status');
  form.appendChild(note);
  drawer.appendChild(form);

  var pills = U.node('div', 'pills');
  pills.setAttribute('role', 'group');
  pills.setAttribute('aria-label', 'Show');
  VIEWS.forEach(function (v) {
    var b = U.node('button', 'pill', v[1]);
    b.type = 'button';
    b.dataset.todoView = v[0];
    b.setAttribute('aria-pressed', String(v[0] === state.view));
    b.addEventListener('click', function () {
      state.view = v[0];
      pills.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      load();
    });
    pills.appendChild(b);
  });
  drawer.appendChild(pills);
  var list = U.node('ul', 'todo-list');
  drawer.appendChild(list);
  var empty = U.node('p', 'panel-note', 'Loading…');
  drawer.appendChild(empty);
  document.body.appendChild(drawer);

  function day(iso) { return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); }

  function row(t) {
    var li = U.node('li', t.doneAt ? 'is-done' : null);
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = Boolean(t.doneAt);
    box.setAttribute('aria-label', (t.doneAt ? 'Reopen: ' : 'Done: ') + t.text.slice(0, 60));
    box.addEventListener('change', async function () {
      var op = box.checked ? 'done' : 'reopen';
      box.disabled = true;
      try {
        await U.send('/api/admin/todos', { op: op, id: t.id });
        W.offerUndo(op === 'done' ? 'To-do ticked off.' : 'To-do reopened.', function () {
          return U.send('/api/admin/todos', { op: op === 'done' ? 'reopen' : 'done', id: t.id });
        }, changed);
      } catch (e) { box.checked = !box.checked; }
      changed();
    });
    var body = U.node('div');
    body.appendChild(U.node('p', 'todo-words', t.text));
    var bits = [];
    if (state.view !== 'open') bits.push('For ' + t.forName);
    bits.push((t.source === 'failed' ? 'Assistant could not do this for ' : 'Set by ') + t.setBy);
    if (t.site) bits.push(NAME[t.site] || t.site);
    if (t.customer) bits.push(t.customer);
    if (t.dueOn && !t.doneAt) bits.push((t.overdue ? 'Overdue: ' : 'Due ') + day(t.dueOn));
    body.appendChild(U.node('p', 'todo-meta' + (t.overdue && !t.doneAt ? ' is-overdue' : ''), bits.join(' · ')));
    if (t.jobId && W.jobHref(t.site, t.jobId)) {
      var a = U.node('a', 'todo-meta', 'Open the job');
      a.href = W.jobHref(t.site, t.jobId);
      body.appendChild(a);
    }
    li.appendChild(box);
    li.appendChild(body);
    return li;
  }

  function fillPeople(people, me, owners) {
    if (state.filled) return;
    state.filled = true;
    if (owners) { forSel.insertBefore(new Option(owners + ' (me)', 'owners'), forSel.firstChild); forSel.value = 'owners'; }
    people.forEach(function (p) { forSel.appendChild(new Option(p.id === me ? p.name + ' (me)' : p.name, p.id)); });
  }

  async function load() {
    try {
      var data = await U.get('/api/admin/todos?view=' + state.view);
      fillPeople(data.people || [], data.me, data.owners);
      list.textContent = '';
      (data.todos || []).forEach(function (t) { list.appendChild(row(t)); });
      empty.textContent = 'Nothing here.';
      empty.hidden = (data.todos || []).length > 0;
    } catch (e) {
      empty.hidden = false;
      empty.textContent = e.message || 'Could not load.';
    }
  }

  /* A tick here changes the Action needed list too, so the page refreshes. */
  function changed() { load(); if (global.DSTODAY && global.DSTODAY.refresh) global.DSTODAY.refresh(); }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    try {
      var r = await U.send('/api/admin/todos', { op: 'add', text: text.value, forPersonId: forSel.value || null, dueOn: due.value || null });
      if (!r.ok) { note.textContent = (r.data && r.data.error) || 'Could not add that.'; return; }
      note.textContent = 'Added.';
      text.value = '';
      due.value = '';
      changed();
    } catch (e) { note.textContent = e.message || 'Could not add that.'; }
  });

  var opener = null;
  function open(focusAdd) {
    opener = document.activeElement;
    drawer.hidden = false;
    load();
    (focusAdd ? text : close).focus();
  }
  function shut() {
    drawer.hidden = true;
    if (/^#todo/.test(global.location.hash)) global.history.replaceState(null, '', global.location.pathname + global.location.search);
    if (opener && opener.focus) opener.focus();
  }
  close.addEventListener('click', shut);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !drawer.hidden) shut(); });
  var btn = document.getElementById('todo-open');
  if (btn) btn.addEventListener('click', function () { open(false); });
  if (global.location.hash === '#todo') open(false);
  if (global.location.hash === '#todo-add') open(true);
})(window);
