/* CoolRight's part of Today's job pop-up (calendar-pop.js): the units fitted,
   the commissioning and F-gas record, and the service plan, with "Add service
   plan" one tap away on a fitted job. Editing a unit or the commissioning is
   on the job page's CoolRight block, one link down. */
(function (global) {
  'use strict';

  var U = global.DSUI;
  var W = global.DSWORK;

  function unitLine(u) {
    var bits = [(u.side === 'outdoor' ? 'Outdoor: ' : 'Indoor: ') + ([u.make, u.model].filter(Boolean).join(' ') || 'make not recorded')];
    if (u.location) bits.push(u.location);
    if (u.serial) bits.push('serial ' + u.serial);
    if (u.refrigerant || u.chargeKg != null) bits.push([u.refrigerant, u.chargeKg != null ? u.chargeKg + ' kg' : null].filter(Boolean).join(' '));
    if (u.warrantyUntil) bits.push('warranty to ' + u.warrantyUntil);
    return bits.join(' · ');
  }

  function planForm(j, mount, changed) {
    var f = U.node('form', 'sheet-row');
    var every = document.createElement('select');
    every.setAttribute('aria-label', 'How often');
    [['12', 'Every year'], ['6', 'Every 6 months'], ['24', 'Every 2 years']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; every.appendChild(op); });
    var price = document.createElement('input');
    price.type = 'text'; price.inputMode = 'decimal'; price.placeholder = 'Price per service £'; price.setAttribute('aria-label', 'Price per service in pounds');
    var go = U.node('button', 'btn btn--primary btn--sm', 'Add service plan');
    go.type = 'submit';
    var note = U.node('p', 'panel-note');
    f.appendChild(every); f.appendChild(price); f.appendChild(go);
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      go.disabled = true;
      var r = await U.send('/api/admin/coolright', { op: 'plan', id: j.id, intervalMonths: Number(every.value), pricePence: price.value.trim() ? U.toPence(price.value) : null });
      go.disabled = false;
      if (!r.ok) { note.textContent = (r.data && r.data.message) || 'Not saved.'; return; }
      W.offerUndo('Service plan added.', r.data.undo ? function () { return U.send('/api/admin/coolright', r.data.undo); } : null, changed);
      changed();
    });
    mount.appendChild(f);
    mount.appendChild(note);
  }

  function render(j, section, changed) {
    var c = j.coolright;
    var eq = section('Equipment');
    if (!c.units.length) eq.appendChild(U.node('p', 'panel-note', 'No units recorded yet.'));
    c.units.forEach(function (u) { eq.appendChild(U.node('p', 'sheet-note', unitLine(u))); });
    var m = c.commission;
    eq.appendChild(U.node('p', 'sheet-label', 'Commissioning and F-gas'));
    eq.appendChild(U.node('p', 'sheet-note', m.commissionedOn
      ? 'Commissioned ' + m.commissionedOn + (m.engineer ? ' by ' + m.engineer : '') + '. ' + (m.fgasRef ? 'F-gas ref ' + m.fgasRef : 'F-gas record missing') +
        (m.leakCheckOn ? ', leak check ' + m.leakCheckOn : '') + (m.pressureTest ? ', pressure test: ' + m.pressureTest : '') + '.'
      : 'Not commissioned yet.'));
    var edit = U.node('a', 'pill act', 'Edit units and commissioning');
    edit.href = W.jobHref(j.site, j.id, true) + '-coolright';
    eq.appendChild(edit);

    var p = section('Service plan');
    if (c.plan && c.plan.status === 'active') {
      p.appendChild(U.node('p', 'sheet-note', 'Every ' + c.plan.intervalMonths + ' months' + (c.plan.pricePence != null ? ', ' + U.money(c.plan.pricePence) + ' a service' : '') +
        '. Next due ' + c.plan.nextDueOn + (c.plan.bookedOn ? ', booked for ' + c.plan.bookedOn + (c.plan.bookedTime ? ' at ' + c.plan.bookedTime : '') : '') + '.'));
      var round = U.node('a', 'pill act', 'Service round');
      round.href = '/staff/service.html?area=ac';
      p.appendChild(round);
    } else if (['completed', 'paid'].indexOf(j.status) !== -1) {
      p.appendChild(U.node('p', 'panel-note', 'Not on a service plan.'));
      planForm(j, p, changed);
    } else p.appendChild(U.node('p', 'panel-note', 'A plan can be added once the kit is fitted.'));
  }

  global.DSPOPAC = { render: render };
})(window);
