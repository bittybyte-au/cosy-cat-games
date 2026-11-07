/* Cosy Cat Games – the "You finished all N levels!" card (window.GGLevels), for level games without a level list
   of their own (Kitty Match, Cosy Cubbies, Yarn Sort, Yarn Dash). Each level game has a set number of levels
   (`levels:` in shared/games.js; the game keeps the same number as a constant, as game pages don't load games.js).
   After the last level the game shows this card: a warm well done, and every level as a button to play again.
   Nothing new beyond the last level, and nothing to earn.
     GGLevels.finished({ total: 20, word: 'levels', faces: [img urls], onPick: function (n) {} })
     GGLevels.hide(), GGLevels.isOpen()
   Styles: shared/game.css (.gg-levels). The card is a .card-wrap straight under <body>, so the top bar rests while
   it is open, like every other game card. */
(function () {
  var TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#2A2340" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var wrap = null, pick = null;

  function build() {
    wrap = document.createElement('div');
    wrap.className = 'card-wrap gg-levels';
    wrap.hidden = true;
    wrap.innerHTML = '<div class="card" role="dialog" aria-modal="true" aria-labelledby="ggLevelsTitle">' +
      '<div class="faces" id="ggLevelsFaces"></div>' +
      '<h2 id="ggLevelsTitle"></h2>' +
      '<p id="ggLevelsNote"></p>' +
      '<div class="gg-levels-grid" id="ggLevelsGrid"></div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('.gg-levels-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]'); if (!b) return;
      var n = +b.dataset.n, f = pick;
      wrap.hidden = true;
      if (f) f(n);
    });
  }

  window.GGLevels = {
    finished: function (o) {
      if (!wrap) build();
      var total = o.total | 0, word = o.word || 'levels';
      pick = o.onPick || null;
      wrap.querySelector('#ggLevelsTitle').textContent = 'You finished all ' + total + ' ' + word + '!';
      wrap.querySelector('#ggLevelsNote').textContent = 'Well done! Tap a number to play that ' + word.replace(/s$/, '') + ' again.';
      var faces = wrap.querySelector('#ggLevelsFaces');
      faces.innerHTML = (o.faces || []).map(function (src) { return '<img alt="" src="' + src + '">'; }).join('');
      faces.hidden = !faces.innerHTML;
      var html = '';
      for (var n = 1; n <= total; n++) html += '<button class="gg-lv" type="button" data-n="' + n + '" aria-label="Play ' + word.replace(/s$/, '') + ' ' + n + ' again">' + n + '<span class="tick">' + TICK + '</span></button>';
      wrap.querySelector('#ggLevelsGrid').innerHTML = html;
      wrap.hidden = false;
      var first = wrap.querySelector('.gg-lv'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    },
    hide: function () { if (wrap) wrap.hidden = true; },
    isOpen: function () { return !!wrap && !wrap.hidden; }
  };
})();
