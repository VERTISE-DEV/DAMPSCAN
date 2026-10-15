/**
 * Reading a clipped review in full.
 *
 * reviews.css clamps a long review to eight lines so one three paragraph
 * review stops making every card in the marquee as tall as it. This is the way
 * back to the rest of it: the cards that are actually cut get a button, and the
 * button opens the whole review in a dialog.
 *
 * Measured rather than assumed. Whether a review is clipped depends on the
 * font, the viewport and the card width, so the only honest test is to ask the
 * browser whether the paragraph overflows. Cards that fit are left alone, which
 * is why a short review never carries a button it does not need.
 *
 * Nothing here is the source of any text. The dialog is filled from the card,
 * which was filled by the build from content/reviews or by the page's own
 * renderer from /api/reviews, both of which escape as they write. So this file
 * moves already escaped markup and never composes any.
 */
(function reviewPopouts(){
  const tracks = Array.from(document.querySelectorAll('.carousel-track'));
  if (!tracks.length) return;

  const root = document.documentElement;
  let dialog = null;
  let opener = null;

  /* Built once, on first use. A page whose reviews all fit never creates it. */
  function ensureDialog(){
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'review-dialog';
    dialog.innerHTML =
      '<div class="review-dialog-body">' +
        '<div class="stars"></div>' +
        '<div class="review-dialog-text"></div>' +
        '<div class="review-attr"><span class="who"></span>' +
        '<span class="src">Google review</span></div>' +
        '<button type="button" class="review-close">Close</button>' +
      '</div>';
    dialog.querySelector('.review-close').addEventListener('click', () => dialog.close());
    /* Native dialog fires close for Escape and for the button alike, so the
       tidying up lives in one place. */
    dialog.addEventListener('close', () => {
      root.classList.remove('reviews-open');
      if (opener && document.contains(opener)) opener.focus();
      opener = null;
    });
    /* A click on the backdrop lands on the dialog element itself rather than
       on anything inside it. */
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
    return dialog;
  }

  function open(card, button){
    const d = ensureDialog();
    const stars = card.querySelector('.stars');
    const who = card.querySelector('.review-attr span');
    const text = card.querySelector('p');

    d.querySelector('.stars').textContent = stars ? stars.textContent : '';
    d.querySelector('.stars').setAttribute('aria-label', stars ? stars.getAttribute('aria-label') || '' : '');
    /* innerHTML rather than textContent, to keep the line breaks the reviewer
       typed. Both writers of this markup escape first, so the only tag in it
       is the <br /> they put there. */
    d.querySelector('.review-dialog-text').innerHTML = text ? text.innerHTML : '';
    d.querySelector('.who').textContent = who ? who.textContent : '';

    opener = button;
    root.classList.add('reviews-open');
    d.showModal();
    d.querySelector('.review-dialog-text').scrollTop = 0;
  }

  /**
   * The loop copies (see loop() below) are the same content again, so only the
   * real cards are reachable by tab.
   */
  function focusable(track, card){
    return !card.hasAttribute('data-clone');
  }

  function scan(){
    for (const track of tracks) {
      for (const card of Array.from(track.children)) {
        const text = card.querySelector('p');
        if (!text) continue;

        const clipped = text.scrollHeight > text.clientHeight + 1;
        text.classList.toggle('is-clipped', clipped);

        const existing = card.querySelector('.review-more');
        if (!clipped) { if (existing) existing.remove(); continue; }
        if (existing) continue;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'review-more';
        button.textContent = 'Read full review';
        const who = card.querySelector('.review-attr span');
        button.setAttribute('aria-label', who ? `Read ${who.textContent}'s full review` : 'Read the full review');
        if (!focusable(track, card)) button.tabIndex = -1;
        button.addEventListener('click', () => open(card, button));
        /* Above the attribution, which is pinned to the bottom of the card. */
        card.insertBefore(button, card.querySelector('.review-attr'));
      }
    }
  }

  /* ---------- The loop ----------
     Owners saw it run too fast, flash, and leave the second row empty. The
     causes: a fixed duration (so speed depended on how many reviews there
     were), exactly two copies (a wide screen could see past the end of them),
     and tracks rebuilt on every resize, which mobile Safari fires each time
     the address bar moves, restarting the animation mid scroll.

     Now each row holds its real cards once, plus as many hidden copies as it
     takes to cover the window twice, and moves by exactly one set's width at
     a steady speed. It is only rebuilt when the cards change or the window
     width really changes. Someone who has asked for less motion gets a still
     row they can swipe instead, which is all CSS. */
  const SPEED = 32; /* px per second, slow enough to read along */
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  function loop(track){
    track.querySelectorAll('[data-clone]').forEach((n) => n.remove());
    const real = Array.from(track.children);
    const box = track.parentElement;
    box.hidden = box.hidden || !real.length;
    track.classList.remove('is-looping');
    if (!real.length || still.matches) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const set = real.reduce((w, n) => w + n.getBoundingClientRect().width + gap, 0);
    if (!set) return;
    const copies = Math.ceil(box.clientWidth / set) + 1;
    for (let c = 0; c < copies; c++) {
      for (const n of real) {
        const k = n.cloneNode(true);
        k.setAttribute('data-clone', '');
        k.setAttribute('aria-hidden', 'true');
        k.inert = true;
        track.appendChild(k);
      }
    }
    track.style.setProperty('--shift', set + 'px');
    track.style.setProperty('--dur', Math.max(20, set / SPEED) + 's');
    track.classList.add('is-looping');
  }

  /* Mutation records arrive after the fact, so the copies this adds would
     trigger another build forever; they are taken off the queue instead. */
  let watch = null;
  function build(){ tracks.forEach(loop); scan(); if (watch) watch.takeRecords(); }

  /* A finger on a row holds it, and it carries on a moment after lifting, so
     a review can be read or its button tapped without chasing it. */
  for (const track of tracks) {
    const box = track.parentElement;
    let t = null;
    box.addEventListener('pointerdown', () => { clearTimeout(t); box.classList.add('is-held'); });
    const release = () => { clearTimeout(t); t = setTimeout(() => box.classList.remove('is-held'), 2500); };
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
  }

  /* Fonts land after first paint and change where the text wraps, so a single
     measurement on load can be taken against the fallback font and be wrong.
     A second pass once the real fonts are in costs nothing. */
  build();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);

  /* Width only: a height change is the phone's address bar, and rebuilding
     for it is exactly the restart that read as flashing. */
  let timer = null;
  let width = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - width) < 40) return;
    width = window.innerWidth;
    clearTimeout(timer);
    timer = setTimeout(build, 200);
  });
  if (still.addEventListener) still.addEventListener('change', build);

  /* The page replaces the whole track when /api/reviews returns a live set.
     Watching for that beats asking the page's own script to call us, which
     would mean the same call written into both home pages by hand. */
  watch = new MutationObserver(build);
  for (const track of tracks) watch.observe(track, { childList: true });
})();
