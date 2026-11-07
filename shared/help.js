/* Cosy Cat Games – "How to play" help, the same on every game page (window.GGHelp).
   shared/store.js loads this file, so no game page needs a line of its own. It works out the game from the address
   (/games/<id>/); if that game has help below, a round "?" button goes into the top bar just before the sound button.
   Tapping it opens a panel (site.css .overlay + .panel, extras in game.css .gg-help) with the game's name, a few
   short lines and a big "Got it". Escape, the backdrop or Got it closes it, and focus goes back to the "?".
   While it is open the game gets no taps or keys (the panel covers the canvas and stops them), and games that pause
   when the tab is hidden (Sneaky Cat, Rooftop Run, Yarn Defence) are paused by briefly reporting the page as hidden.
   Toddler-only games with nothing to learn have no help. Games with a toddler profile (GG setting 'toddler') can
   give simpler toddler lines.
   GGHelp.open(), GGHelp.close(), GGHelp.isOpen(), GGHelp.text(id) for tests. */
(function () {
  var HELP = {
    /* ---------- toddler games: one or two lines for a grown-up to read out ---------- */
    bath: { name: 'Bath Time', lines: [
      'Rub the kitten with the sponge to make bubbles.',
      'Use the shower to wash the bubbles off.',
      'Rub with the towel to dry the kitten.'] },
    crossing: { name: 'Kitten Crossing', lines: [
      'Tap the road.',
      'The cars stop, and the lollipop cat walks out with the sign.',
      'Then the kittens can cross to the park.'] },
    feed: { name: 'Feed the Cat', lines: [
      'Look at the colour of the bowl.',
      'Tap the cat with the same colour, or drag the bowl to it.'] },
    'kitten-kitchen': { name: 'Topping Time', lines: [
      'Pick a pizza, pancakes or a cake.',
      'Pick a topping, then tap the food to put it on.',
      'Ring the bell to give it to your cat.'] },
    puzzle: { name: 'Cat Puzzles', lines: [
      'Drag each piece to its place in the picture.',
      'It clicks in when it fits.'] },
    seek: { name: 'Hide and Seek', lines: [
      'The cards at the bottom show what to find.',
      'Tap them in the picture.'] },
    stack: { name: 'Stack the Cats', lines: [
      'Move the cat left and right with your finger.',
      'Let go to drop it on the tower.'] },

    /* ---------- everyone else ---------- */
    cooking: { name: 'Cosy Kitchen', lines: [
      'Pick a dish to cook.',
      'The words at the top say what to do next.',
      'Tap, hold, drag or swipe, just like real cooking!',
      'Your dishes can go on show in Cosy Home.'] },
    'kitty-pop': { name: 'Kitty Match', lines: [
      'Swap two cats that are next to each other: drag one, or tap one then the other.',
      'Line up three or more of the same cat to match them.',
      'Match the cats shown at the top to finish the level.',
      'Four in a row, an L or T shape, or five in a row make special cats.',
      'No move limit, so take your time.'] },
    cubbies: { name: 'Cosy Cubbies', lines: [
      'Drag each sleepy cat into the cubby of its colour.',
      'Three cats fill a cubby.',
      'Cats that reach the end of the belt wait on the mat.',
      'If the mat is full, the level starts again.'] },
    yarn: { name: 'Yarn Sort', lines: [
      'Tap a tube, then another, to move the yarn on top.',
      'Yarn can only go on the same colour, or into an empty tube.',
      'Sort every tube into one colour.',
      'Stuck? Undo as much as you like, or add one extra tube.'] },
    home: { name: 'Cosy Home', lines: [
      'Drag things from the drawer up into your room.',
      'They sit on the nearest shelf, table or floor. Pictures hang on the wall.',
      'Drag something back down to the drawer to put it away.',
      'Play the other games to get more things.'],
      toddler: [
      'Tap a thing in the drawer to put it in your room.',
      'Tap it again to put it away.'] },
    colour: { name: 'Colour Me', lines: [
      'Pick a picture.',
      'Pick a colour, then tap a shape to fill it in.',
      'Add stickers, then pick a frame.',
      'Hang your picture on the wall in Cosy Home.'],
      toddler: [
      'Pick a picture, then pick a colour.',
      'Tap the picture to colour it in.'] },
    grow: { name: 'Grow', lines: [
      'Pick a pot and a seed.',
      'Tap the soil bag, then the pot to plant the seed.',
      'Drag the watering can over the pot.',
      'Pick a flower colour, then tap the sun to grow it!',
      'Your plants go on show in Cosy Home.'],
      toddler: [
      'Pick a pot, then a seed.',
      'Watch it grow!'] },
    pottery: { name: 'Pottery', lines: [
      'Shape: drag the spinning clay in, out, up or down.',
      'Paint: pick a colour, then touch the pot to paint it.',
      'Fire: tap your pot to put it in the kiln, then tap the door.',
      'Your pots can be used in Grow.'] },
    cafe: { name: 'Cat Café', lines: [
      'Look at what each cat wants in its bubble.',
      'Tap the ingredients onto the tray, then ring the bell.',
      'Drag the dish to the cat who ordered it (or tap the dish, then the cat).',
      'In Challenge, cats won’t wait forever!'] },
    'yarn-dash': { name: 'Yarn Dash', lines: [
      'Press and hold where you want your cat to run, or use the arrow keys.',
      'Catch the yarn balls before they fade away.',
      'Gold yarn is worth 3, a toy mouse is worth 5.',
      'Fill the basket to finish the level.'] },
    slide: { name: 'Slide Puzzle', lines: [
      'Tap a square in the same row or column as the gap to slide it.',
      'Put the picture back together.',
      'Hold the eye button to peek at the picture.',
      'The 123 button puts numbers on the squares.'] },
    rescue: { name: 'Cat Rescue', lines: [
      'Swap two pieces next to each other to make a line of three.',
      'Match three next to a box to break it open and free the kitten.',
      'Match in the top row to knock out a brick. The water (or leaves, or socks) pours in through the gap: clear the pieces under it to drain it out of the bottom.',
      'Reach the goal before the moves run out to save the cat.',
      'Four in a row, an L or T shape, or five in a row make special pieces.'] },
    hotpaws: { name: 'Hot Paws', lines: [
      'Swipe, tap a tile or use the arrow keys to walk.',
      'Green tiles are always safe for the whole round.',
      'Red is lava! Orange means lava is coming, so step off.',
      'Collect the blue diamonds to finish the round.'] },
    'kitten-box': { name: 'Kitten in a Box', lines: [
      'Watch the kitten hop into a box.',
      'Keep your eye on that box as they slide about.',
      'Tap the box you think the kitten is in.'] },
    laser: { name: 'Laser Bounce', lines: [
      'Tap a mirror to turn it.',
      'Bounce the laser dot to every sleeping cat.',
      'Grey bolted mirrors can’t turn, and furniture stops the beam.',
      'Later: glass splits the beam, and loose mirrors drag in from the tray.'] },
    rooftop: { name: 'Rooftop Run', lines: [
      'Tap to jump. Tap again in the air for one more jump.',
      'Hold for a higher jump.',
      'Don’t fall in a gap or run into the side of a chimney. Landing on top is fine!',
      'Grab the fish. Gold fish are worth 5.'] },
    sneaky: { name: 'Sneaky Cat', lines: [
      'Press and hold where you want to go, and your cat walks there. A quick tap sends it to that spot. Arrow keys work too.',
      'When a dog’s ear goes up, it’s about to look. Its glow shows everything it can see.',
      'Sofas, tables, shelves, plants and boxes block its view: hide behind them!',
      'Seen? Your cat scurries back to the last safe spot. Walk around squeaky toys: they wake the dogs.',
      'Reach the midnight snack. Grab the fish too!'] },
    'yarn-defence': { name: 'Yarn Defence', lines: [
      'Mice run along the path to steal your yarn.',
      'Pick a cat below, then tap a spot beside the path to put it there.',
      'Cats cost fish. Every mouse you send home gives you more.',
      'Tap a cat you placed to make it better, or send it home.'] },
    fashion: { name: 'Cat Fashion Studio', lines: [
      'Pick a tab at the bottom: hats, glasses, neck or tops.',
      'Pick something to wear, then its colour and pattern.',
      'The dice picks a surprise outfit.',
      'In Photo, pick a backdrop and a pose, then Snap!'] }
  };

  var INK = '#2A2340';
  var ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="#7CC4FF" stroke="' + INK + '" stroke-width="2.6"/>' +
    '<path d="M12.2 12.6 Q12.2 8.6 16 8.6 Q19.8 8.6 19.8 12.2 Q19.8 14.6 17 15.9 Q16 16.4 16 18.4" fill="none" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="16" cy="23" r="2.1" fill="' + INK + '"/></svg>';

  function gameId() {
    var m = /\/games\/([^\/]+)\//.exec(location.pathname);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function toddler() { try { return !!(window.GG && GG.getSetting && GG.getSetting('toddler', false)); } catch (e) { return false; } }
  function linesFor(id) {
    var h = HELP[id];
    if (!h) return null;
    return (toddler() && h.toddler) ? h.toddler : h.lines;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var id = gameId(), btn = null, wrap = null, lastFocus = null, fakedHidden = false;

  /* pause games that stop when the tab is hidden: report hidden while help is open, then put the real values back */
  function fakeHidden(on) {
    try {
      if (on && !document.hidden) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return true; } });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: function () { return 'hidden'; } });
        fakedHidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      } else if (!on && fakedHidden) {
        delete document.hidden; delete document.visibilityState;
        fakedHidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
      }
    } catch (e) {}
    try { if (window.__hotpaws && __hotpaws.pause) __hotpaws.pause(on); } catch (e) {}
  }

  function build() {
    wrap = document.createElement('div');
    wrap.className = 'overlay gg-help';
    wrap.hidden = true;
    wrap.innerHTML = '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="ggHelpTitle" aria-describedby="ggHelpLines">' +
      '<h2 id="ggHelpTitle"></h2><p class="gg-help-sub">How to play</p><ul class="gg-help-lines" id="ggHelpLines"></ul>' +
      '<button class="big gg-help-ok" type="button">Got it</button></div>';
    document.body.appendChild(wrap);
    // nothing in here reaches the game underneath (games listen on the canvas, window or document)
    ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend',
      'click', 'dblclick', 'contextmenu', 'wheel', 'keyup', 'keypress'].forEach(function (t) {
      wrap.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    wrap.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {   // keep focus in the panel (the only stop is Got it)
        e.preventDefault(); wrap.querySelector('.gg-help-ok').focus();
      }
    });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('.gg-help-ok').addEventListener('click', close);
  }

  function open() {
    var lines = linesFor(id);
    if (!lines) return;
    if (!wrap) build();
    wrap.querySelector('#ggHelpTitle').textContent = HELP[id].name;
    wrap.querySelector('#ggHelpLines').innerHTML = lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
    lastFocus = document.activeElement;
    wrap.hidden = false;
    document.body.classList.add('gg-help-open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    fakeHidden(true);
    try { wrap.querySelector('.gg-help-ok').focus({ preventScroll: true }); } catch (e) { wrap.querySelector('.gg-help-ok').focus(); }
    try { if (window.GG && GG.track) GG.track('Open help', { game: id }); } catch (e) {}
  }
  function close() {
    if (!wrap || wrap.hidden) return;
    wrap.hidden = true;
    document.body.classList.remove('gg-help-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    fakeHidden(false);
    var to = btn && shown(btn) ? btn : (lastFocus && document.contains(lastFocus) && lastFocus !== document.body ? lastFocus : null);
    try { if (to) to.focus({ preventScroll: true }); } catch (e) {}
  }

  function addButton() {
    if (btn || !id || !HELP[id]) return;
    var bar = document.getElementById('topbar') || document.querySelector('.topbar');
    if (!bar) return;
    btn = document.createElement('button');
    btn.className = 'round gg-help-btn';
    btn.type = 'button';
    btn.id = 'helpBtn';
    btn.setAttribute('aria-label', 'How to play');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.title = 'How to play';
    btn.innerHTML = ICON;
    btn.addEventListener('click', function (e) { e.stopPropagation(); open(); });
    btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    var sound = document.getElementById('soundBtn');
    if (sound && bar.contains(sound)) sound.parentNode.insertBefore(btn, sound);
    else bar.appendChild(btn);
    document.body.classList.add('gg-has-help');
    watchFit(bar);
  }

  /* Keep the top bar on one line with no overlaps now it has one more button: if it doesn't fit, add .gg-tight
     (game.css: smaller round buttons, smaller gaps), and if the game's middle bits still don't fit, zoom them down. */
  function widthOf(el) { return el.getBoundingClientRect().width; }
  function shown(el) { return el.offsetParent !== null || getComputedStyle(el).position === 'fixed'; }
  function gapOf(el) { var g = parseFloat(getComputedStyle(el).columnGap); return isNaN(g) ? 0 : g; }
  function fit(bar) {
    var mid = bar.querySelector(':scope > .middle');
    bar.classList.remove('gg-tight', 'gg-tighter');
    if (mid) mid.style.zoom = '';
    function measure() {
      var cs = getComputedStyle(bar), avail = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var kids = [].filter.call(bar.children, function (k) { return shown(k) && getComputedStyle(k).position !== 'absolute'; });
      var other = 0, midNeed = 0;
      kids.forEach(function (k) {
        if (k === mid) {
          var mk = [].filter.call(mid.children, function (c) { return shown(c) && getComputedStyle(c).position !== 'absolute'; });
          // all on one row (a middle that can wrap, like Slide's, would otherwise stack over the game)
          mk.forEach(function (c) { midNeed += widthOf(c); });
          midNeed += Math.max(0, mk.length - 1) * gapOf(mid);
        } else other += widthOf(k);
      });
      other += Math.max(0, kids.length - 1) * gapOf(bar);
      return { avail: avail, other: other, mid: midNeed };
    }
    var m = measure();
    if (m.other + m.mid <= m.avail + 0.5) return;
    bar.classList.add('gg-tight');
    m = measure();
    // the middle would have to shrink a lot: make the round buttons smaller still, so it shrinks less
    if (m.other + m.mid > m.avail + 0.5 && (!mid || m.mid <= 0 || (m.avail - m.other) / m.mid < 0.9)) { bar.classList.add('gg-tighter'); m = measure(); }
    if (mid && m.mid > 0 && m.other + m.mid > m.avail + 0.5) {
      var z = Math.max(0.6, Math.floor(((m.avail - m.other - 3) / m.mid) * 100) / 100);
      mid.style.zoom = String(z);
    }
  }
  function watchFit(bar) {
    var queued = false;
    function soon() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; try { fit(bar); } catch (e) {} }); }
    soon();
    window.addEventListener('resize', soon);
    window.addEventListener('load', soon);
    try { document.fonts.ready.then(soon); } catch (e) {}
    // level numbers change, buttons come and go
    try { new MutationObserver(soon).observe(bar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] }); } catch (e) {}
  }

  window.GGHelp = {
    open: open, close: close,
    isOpen: function () { return !!(wrap && !wrap.hidden); },
    text: function (gid) { var h = HELP[gid || id]; return h ? { name: h.name, lines: linesFor(gid || id) } : null; },
    games: function () { return Object.keys(HELP); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton);
  else addButton();
})();
