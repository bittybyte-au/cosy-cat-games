/* Colour Me – colouring pages. Tap a shape to fill it, add stickers, then pick a frame.
   Finished pictures can be hung on the wall in Cosy Home (it reads them from this game's save).
   Pictures save as they're coloured, so nothing is lost. Up to 12 are kept; the oldest goes first.
   Saved as small JSON in GG.setProgress('colour', { pics, next }); see pages.js for the picture format. */
(function () {
  'use strict';

  var CP = window.ColourPages;
  var MAX_PICS = 12, MAX_STICKERS = 30;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- saved pictures ---------- */
  var S = (function () {
    var p = {};
    try { p = GG.getProgress('colour') || {}; } catch (e) {}
    if (!Array.isArray(p.pics)) p.pics = [];
    if (typeof p.next !== 'number') p.next = p.pics.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
    // the pages coloured and hung at least once (kept even when an old picture is deleted); the games list counts these
    if (!Array.isArray(p.pages)) p.pages = [];
    p.pics.forEach(function (x) { if (x && x.done && p.pages.indexOf(x.page) < 0) p.pages.push(x.page); });
    return p;
  })();
  function save() { try { GG.setProgress('colour', S); } catch (e) {} }
  function findPic(id) { for (var i = 0; i < S.pics.length; i++) if (S.pics[i].id === id) return S.pics[i]; return null; }

  /* ---------- sound ---------- */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null;
    var on = GG.getSetting('sound', true);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function ready() { return ac && on; }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function noise(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
      var g = ac.createGain(); env(g, t, o.attack || 0.003, o.gain || 0.2, o.dur || 0.08);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random()); src.stop(t + (o.attack || 0.003) + (o.dur || 0.08) + 0.05);
    }
    function tone(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var osc = ac.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.005, o.gain || 0.15, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.005) + (o.dur || 0.15) + 0.05);
    }
    var NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    return {
      init: init,
      isOn: function () { return on; },
      setOn: function (v) { on = v; if (GG.setSetting) GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      splat: function () { noise({ type: 'lowpass', freq: rand(500, 800), q: 1.2, attack: 0.005, dur: 0.12, gain: 0.22 }); tone({ f: NOTES[Math.floor(Math.random() * NOTES.length)], dur: 0.12, gain: 0.05, type: 'triangle', delay: 0.02 }); },
      pick: function () { tone({ f: 660, to: 820, dur: 0.06, gain: 0.07, type: 'triangle', slide: 0.04 }); },
      sparkle: function () { [1318.5, 1568, 2093].forEach(function (f, i) { tone({ f: f, dur: 0.12, gain: 0.04, type: 'triangle', delay: i * 0.05 }); }); },
      boop: function () { tone({ f: 400, to: 700, dur: 0.1, gain: 0.12, slide: 0.06 }); },
      undo: function () { tone({ f: 700, to: 450, dur: 0.1, gain: 0.07, type: 'triangle' }); },
      chime: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 }); tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' }); }); }
    };
  })();

  /* ---------- layout ---------- */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var topbar = $('topbar'), tools = $('tools');
  var cw = 0, ch = 0, dpr = 1, PX = 0, PY = 0, PS = 300;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 8;
    var bottom = tools.hidden ? ch - 12 : tools.getBoundingClientRect().top - 12;
    document.documentElement.style.setProperty('--bar-h', Math.round(ch - (tools.hidden ? ch : tools.getBoundingClientRect().top)) + 'px');
    PS = Math.max(160, Math.min(cw - 24, bottom - top, 760));
    PX = (cw - PS) / 2; PY = top + Math.max(0, (bottom - top - PS) / 2);
    var zb = $('zoomBox'); if (zb) { zb.style.top = (PY + 8) + 'px'; zb.style.right = Math.max(8, cw - (PX + PS) + 8) + 'px'; }
  }
  /* ---------- zoom: the view shows the page at view.z times, centred on page point (cx, cy) ---------- */
  var view = { z: 1, cx: 200, cy: 200 };
  var ZMAX = 4;
  function clampView() {
    view.z = clamp(view.z, 1, ZMAX);
    var h = 200 / view.z;
    view.cx = clamp(view.cx, h, 400 - h); view.cy = clamp(view.cy, h, 400 - h);
    renderZoom();
  }
  function vScale() { return PS * view.z / 400; }                 // screen px per page unit
  function toPage(x, y) { var k = vScale(); return { x: view.cx + (x - PX - PS / 2) / k, y: view.cy + (y - PY - PS / 2) / k }; }
  function onPage(x, y) { return x >= PX && x <= PX + PS && y >= PY && y <= PY + PS; }
  // zoom to z keeping the page point under screen (sx, sy) where it is
  function zoomAt(z, sx, sy) {
    var before = toPage(sx, sy);
    view.z = clamp(z, 1, ZMAX);
    var k = vScale();
    view.cx = before.x - (sx - PX - PS / 2) / k; view.cy = before.y - (sy - PY - PS / 2) / k;
    clampView();
  }
  function resetZoom() { view.z = 1; view.cx = view.cy = 200; renderZoom(); }
  function renderZoom() {
    if (!$('zoomIn')) return;
    $('zoomIn').disabled = view.z >= ZMAX - 0.01; $('zoomOut').disabled = view.z <= 1.01;
  }

  /* ---------- state ---------- */
  var mode = 'pick';               // pick | colour
  var pic = null;                  // the picture being coloured
  var isNew = false;
  var tool = 'fill';
  /* Toddler mode (set on the games page): only the simple pages, ten big colours, tap to fill and a big undo;
     Done hangs the picture straight away in a frame of its own. Same pictures and save as always. */
  var TODDLER = false;
  try { TODDLER = !!(GG.getSetting && GG.getSetting('toddler', false)); } catch (e) {}
  if (TODDLER) document.body.classList.add('toddler');
  function myPages() { return CP.PAGES.filter(function (p) { return !!p.toddler === TODDLER; }); }
  var current = (TODDLER ? CP.TODDLER_COLOURS : CP.COLOURS)[0], sticker = 'heart';
  var history = [];
  var anim = null;
  var drag = null;
  var parts = [];
  var time = 0;

  /* ---------- picker ---------- */
  var thumbs = {};
  function pageThumb(id) {
    if (thumbs[id]) return thumbs[id];
    var cv = document.createElement('canvas'); cv.width = cv.height = 240;
    CP.drawPage(cv.getContext('2d'), { page: id, f: {}, st: [] }, 240);
    return (thumbs[id] = cv.toDataURL('image/png'));
  }
  function picThumb(p) {
    var cv = document.createElement('canvas'); cv.width = 240; cv.height = 240;
    var c = cv.getContext('2d');
    if (p.done) { c.translate(120, 236); CP.drawFramed(c, p, 204); }
    else CP.drawPage(c, p, 240);
    return cv.toDataURL('image/png');
  }
  function renderPicker() {
    var mine = myPages(), hung = mine.filter(function (p) { return S.pages.indexOf(p.id) >= 0; }).length;
    $('pages').innerHTML = mine.map(function (p) {
      var done = S.pages.indexOf(p.id) >= 0;
      return '<button class="pg" type="button" data-page="' + p.id + '"><img alt="" src="' + pageThumb(p.id) + '">' + esc(p.name) +
        (done ? '<span class="tick" aria-label="coloured"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5 L8.5 14 L15 6.5" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' : '') + '</button>';
    }).join('');
    $('pagesCount').textContent = hung >= mine.length ? 'You\u2019ve coloured every picture! Colour them again any time.' : hung + ' of ' + mine.length + ' pictures coloured';
    var list = S.pics.slice().reverse();
    $('gallery').innerHTML = list.length ? list.map(function (p) {
      var pg = CP.get(p.page);
      return '<div class="pg" role="button" tabindex="0" data-pic="' + p.id + '" aria-label="Keep colouring ' + esc(pg.name) + '"><img alt="" src="' + picThumb(p) + '">' + esc(pg.name) +
        '<small>' + (p.done ? 'Ready to hang' : 'Still colouring') + '</small>' +
        '<button class="del" type="button" data-del="' + p.id + '" aria-label="Delete this picture"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5 L15 15 M15 5 L5 15" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/></svg><span>Delete?</span></button></div>';
    }).join('') : '<p class="empty">Pictures you colour will be saved here.</p>';
  }
  $('pages').addEventListener('click', function (e) {
    var b = e.target.closest('[data-page]'); if (!b) return;
    Sound.init(); Sound.pick();
    openPic({ id: 0, page: b.dataset.page, f: {}, st: [], fr: 0, at: Date.now() }, true);
  });
  $('gallery').addEventListener('click', function (e) {
    var d = e.target.closest('.del');
    if (d) {
      e.stopPropagation(); Sound.init();
      if (!d.classList.contains('ask')) {
        $('gallery').querySelectorAll('.del.ask').forEach(function (o) { o.classList.remove('ask'); });
        d.classList.add('ask'); Sound.pick();
        clearTimeout(d._t); d._t = setTimeout(function () { d.classList.remove('ask'); }, 3000);
        return;
      }
      S.pics = S.pics.filter(function (p) { return p.id !== +d.dataset.del; });
      save(); Sound.undo(); renderPicker();
      return;
    }
    var b = e.target.closest('[data-pic]'); if (!b) return;
    Sound.init(); Sound.pick();
    var p = findPic(+b.dataset.pic); if (p) openPic(p, false);
  });

  /* ---------- palette ---------- */
  var tileURL = {};
  function renderPalette() {
    var box = $('palette'), html = '';
    if (TODDLER) {
      CP.TODDLER_COLOURS.forEach(function (c) { html += '<button class="sw" type="button" data-fill="' + c + '" style="background-color:' + c + '" aria-label="Colour" aria-pressed="' + (current === c) + '"></button>'; });
    } else if (tool === 'fill') {
      CP.COLOURS.forEach(function (c) { html += '<button class="sw" type="button" data-fill="' + c + '" style="background-color:' + c + '" aria-label="Colour" aria-pressed="' + (current === c) + '"></button>'; });
      html += '<span class="sep" aria-hidden="true"></span>';
      CP.SPECIALS.forEach(function (s) {
        var bg = s.id === 'rainbow' ? 'background-image:linear-gradient(135deg,#FF5A5F,#FF9F43,#FFD93F,#5CCB75,#4D8BFF,#A77BFF)' : 'background-image:url(' + (tileURL[s.id] || (tileURL[s.id] = CP.tile(s.id).toDataURL())) + ')';
        html += '<button class="sw" type="button" data-fill="' + s.id + '" style="' + bg + '" aria-label="' + s.name + '" aria-pressed="' + (current === s.id) + '"></button>';
      });
    } else {
      CP.STICKERS.forEach(function (s) {
        var k = 'st-' + s;
        if (!tileURL[k]) { var cv = document.createElement('canvas'); cv.width = cv.height = 72; var c = cv.getContext('2d'); c.translate(36, 36); CP.drawSticker(c, s, 60); tileURL[k] = cv.toDataURL(); }
        html += '<button class="sw sticker" type="button" data-sticker="' + s + '" aria-label="' + s + ' sticker" aria-pressed="' + (sticker === s) + '"><img alt="" src="' + tileURL[k] + '"></button>';
      });
    }
    box.innerHTML = html;
  }
  $('palette').addEventListener('click', function (e) {
    var b = e.target.closest('.sw'); if (!b) return;
    Sound.init(); Sound.pick();
    if (b.dataset.fill) current = b.dataset.fill;
    if (b.dataset.sticker) sticker = b.dataset.sticker;
    $('palette').querySelectorAll('.sw').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  });
  function setTool(t) {
    tool = t;
    $('fillTool').setAttribute('aria-pressed', String(t === 'fill'));
    $('stickerTool').setAttribute('aria-pressed', String(t === 'sticker'));
    renderPalette();
  }
  $('fillTool').addEventListener('click', function () { Sound.init(); Sound.pick(); setTool('fill'); });
  $('stickerTool').addEventListener('click', function () { Sound.init(); Sound.pick(); setTool('sticker'); say('Tap the picture to add a sticker', 1.8); });

  /* ---------- screens ---------- */
  function openPic(p, fresh) {
    if (window.GG && GG.track) GG.track('Pick picture', { game: 'colour', picture: p.page, kind: fresh ? 'new' : 'again', mode: TODDLER ? 'toddler' : 'kids' });
    pic = JSON.parse(JSON.stringify(p));
    isNew = fresh;
    history = [];
    mode = 'colour';
    $('picker').hidden = true; tools.hidden = false; $('zoomBox').hidden = false;
    $('homeBtn').hidden = true; $('backBtn').hidden = false;
    $('titleLabel').textContent = CP.get(pic.page).name;
    setTool('fill');
    renderButtons();
    resetZoom();
    layout();
    if (fresh && !TODDLER) say('Tap a shape to colour it in!', 2);
  }
  function showPicker() {
    mode = 'pick'; pic = null;
    $('picker').hidden = false; tools.hidden = true; $('zoomBox').hidden = true;
    $('homeBtn').hidden = false; $('backBtn').hidden = true;
    $('titleLabel').textContent = 'Colour Me';
    renderPicker(); layout();
  }
  $('backBtn').addEventListener('click', function () { Sound.init(); Sound.pick(); showPicker(); });

  /* every change is saved straight away (a new picture is added on its first change) */
  function commit() {
    pic.at = Date.now();
    if (isNew) {
      pic.id = S.next++;
      S.pics.push(pic);
      while (S.pics.length > MAX_PICS) S.pics.shift();
      isNew = false;
    } else {
      for (var i = 0; i < S.pics.length; i++) if (S.pics[i].id === pic.id) S.pics[i] = pic;
    }
    save();
    renderButtons();
  }
  function snapshot() { history.push(JSON.stringify({ f: pic.f, st: pic.st })); if (history.length > 40) history.shift(); }
  function renderButtons() {
    $('undoBtn').disabled = !history.length;
    $('doneBtn').disabled = !pic || (!Object.keys(pic.f).length && !pic.st.length);
  }
  $('undoBtn').addEventListener('click', function () {
    if (!history.length) return;
    Sound.init(); Sound.undo();
    var h = JSON.parse(history.pop()); pic.f = h.f; pic.st = h.st; anim = null;
    commit();
  });

  /* ---------- colouring and stickers ---------- */
  function stickerAt(x, y) {
    for (var i = pic.st.length - 1; i >= 0; i--) if (Math.hypot(pic.st[i][1] - x, pic.st[i][2] - y) < 24) return i;
    return -1;
  }
  /* Pointers: a tap colours a shape (or adds a sticker); two fingers pinch to zoom and move the page; when zoomed
     in, one finger dragging (in Colour mode) moves the page. Toddler mode has no zoom and colours on touch. */
  var ptrs = {}, gesture = null, tapDown = null;
  function ptrList() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
  function fillAt(p) {
    var r = CP.hit(pic.page, p.x, p.y);
    if (r < 0 || pic.f[r] === current) { if (r >= 0) { Sound.pick(); } return; }
    snapshot();
    anim = { region: r, x: p.x, y: p.y, r: 0, from: pic.f[r] || '#FFFFFF' };
    pic.f[r] = current;
    if (current.charAt(0) !== '#') { Sound.sparkle(); sparkle(p.x, p.y, 8); } else Sound.splat();
    buzz(6);
    commit();
  }
  function startPinch() {
    var l = ptrList(); if (l.length < 2) return;
    var a = l[0], b = l[1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    gesture = { kind: 'pinch', d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), z0: view.z, m: toPage(mx, my) };
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (mode !== 'colour') return;
    Sound.init();
    if (!onPage(e.clientX, e.clientY) && !Object.keys(ptrs).length) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (!TODDLER && Object.keys(ptrs).length >= 2) {
      // a second finger: this is a pinch, so the first finger's tap or sticker drag is called off
      tapDown = null;
      if (drag) { if (drag.fresh) { history.pop(); pic.st.splice(drag.i, 1); commit(); } else if (drag.moved && drag.snap) { var h = JSON.parse(drag.snap); pic.st = h.st; } drag = null; }
      startPinch(); return;
    }
    var p = toPage(e.clientX, e.clientY);
    if (p.x < 0 || p.y < 0 || p.x > 400 || p.y > 400) return;
    if (tool === 'fill') {
      if (TODDLER) { fillAt(p); return; }
      tapDown = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, panning: false };
    } else {
      var i = stickerAt(p.x, p.y);
      if (i >= 0) { drag = { i: i, id: e.pointerId, moved: false, sx: p.x, sy: p.y, snap: JSON.stringify({ f: pic.f, st: pic.st }) }; }
      else {
        if (pic.st.length >= MAX_STICKERS) { say('That’s lots of stickers!', 1.6); return; }
        snapshot();
        pic.st.push([sticker, Math.round(p.x), Math.round(p.y)]);
        drag = { i: pic.st.length - 1, id: e.pointerId, moved: true, fresh: true };
        Sound.boop(); buzz(6);
        commit();
      }
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId].x = e.clientX; ptrs[e.pointerId].y = e.clientY;
    if (gesture && gesture.kind === 'pinch') {
      var l = ptrList(); if (l.length < 2) return;
      var a = l[0], b = l[1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      view.z = clamp(gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0, 1, ZMAX);
      var k = vScale();
      view.cx = gesture.m.x - (mx - PX - PS / 2) / k; view.cy = gesture.m.y - (my - PY - PS / 2) / k;
      clampView(); e.preventDefault(); return;
    }
    if (tapDown && tapDown.id === e.pointerId) {
      var dx = e.clientX - tapDown.x, dy = e.clientY - tapDown.y;
      if (!tapDown.panning && Math.hypot(dx, dy) > (view.z > 1.01 ? 10 : 30)) tapDown.panning = true;   // a wobbly tap still colours
      if (tapDown.panning && view.z > 1.01) { var k2 = vScale(); view.cx = tapDown.cx - dx / k2; view.cy = tapDown.cy - dy / k2; clampView(); }
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    var p = toPage(e.clientX, e.clientY);
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 6) return;
    if (!drag.moved) { history.push(drag.snap); drag.moved = true; }
    pic.st[drag.i][1] = Math.round(clamp(p.x, -30, 430)); pic.st[drag.i][2] = Math.round(clamp(p.y, -30, 430));
  }, { passive: false });
  function endDrag(e) {
    var had = !!ptrs[e.pointerId];
    delete ptrs[e.pointerId];
    if (gesture) { if (Object.keys(ptrs).length < 2) gesture = null; return; }
    if (tapDown && tapDown.id === e.pointerId) {
      var t = tapDown; tapDown = null;
      if (!t.panning && e.type === 'pointerup' && mode === 'colour') { var p = toPage(t.x, t.y); if (p.x >= 0 && p.y >= 0 && p.x <= 400 && p.y <= 400) fillAt(p); }
      return;
    }
    if (!had || !drag || drag.id !== e.pointerId) return;
    var s = pic.st[drag.i];
    // dragged off the page: the sticker is peeled off
    if (s && (s[1] < 0 || s[2] < 0 || s[1] > 400 || s[2] > 400)) { pic.st.splice(drag.i, 1); Sound.undo(); }
    if (drag.moved) commit();
    drag = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  // mouse wheel and trackpad pinch zoom around the pointer
  canvas.addEventListener('wheel', function (e) {
    if (mode !== 'colour' || TODDLER || !onPage(e.clientX, e.clientY)) return;
    e.preventDefault();
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey && e.deltaMode === 0 && Math.abs(e.deltaY) >= 40 || e.deltaMode !== 0) {
      zoomAt(view.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX, e.clientY);
    } else {
      var k = vScale(); view.cx += e.deltaX / k; view.cy += e.deltaY / k; clampView();   // two-finger trackpad scroll moves the page
    }
  }, { passive: false });
  function zoomStep(f) { Sound.init(); Sound.pick(); zoomAt(view.z * f, PX + PS / 2, PY + PS / 2); }
  $('zoomIn').addEventListener('click', function () { zoomStep(1.6); });
  $('zoomOut').addEventListener('click', function () { if (view.z / 1.6 < 1.15) { Sound.init(); Sound.pick(); resetZoom(); } else zoomStep(1 / 1.6); });

  function sparkle(x, y, n) {
    if (reduceMotion) n = 3;
    for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 180); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: rand(0.4, 0.7), r: rand(5, 10) }); }
  }

  /* ---------- frames and hanging ---------- */
  var frameSel = 0;
  function renderFrames() {
    $('frames').innerHTML = CP.FRAMES.map(function (f, i) {
      var col = f.col === 'rainbow' ? 'transparent; border-image: linear-gradient(135deg,#FF5A5F,#FFD93F,#5CCB75,#4D8BFF,#A77BFF) 1' : f.col;
      return '<button class="fr" type="button" data-fr="' + i + '" aria-label="' + f.name + ' frame" aria-pressed="' + (i === frameSel) + '"><span style="border-color:' + col + '"></span></button>';
    }).join('');
    var cv = $('framePrev'), c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.translate(cv.width / 2, cv.height - 20);
    var p = JSON.parse(JSON.stringify(pic)); p.fr = frameSel;
    CP.drawFramed(c, p, 400);
  }
  $('frames').addEventListener('click', function (e) {
    var b = e.target.closest('.fr'); if (!b) return;
    Sound.init(); Sound.pick(); frameSel = +b.dataset.fr; renderFrames();
  });
  $('doneBtn').addEventListener('click', function () {
    if (!pic) return;
    Sound.init(); Sound.boop();
    if (TODDLER) { frameSel = pic.done ? (pic.fr || 0) : Math.floor(Math.random() * (CP.FRAMES.length - 1)); $('hangBtn').click(); return; }
    frameSel = pic.fr || 0;
    renderFrames();
    $('frameWrap').hidden = false;
    $('hangBtn').focus();
  });
  $('hangBtn').addEventListener('click', function () {
    var first = !pic.done;
    pic.fr = frameSel; pic.done = true;
    if (S.pages.indexOf(pic.page) < 0) S.pages.push(pic.page);
    commit();
    if (first && GG.stat) GG.stat('colour', 'pictures', 1);
    $('frameWrap').hidden = true;
    Sound.chime(); buzz(25);
    showPicker();
    say('It’s ready to hang in your Cosy Home!', 2.6);
  });
  $('frameWrap').addEventListener('click', function (e) { if (e.target === $('frameWrap')) $('frameWrap').hidden = true; });

  /* ---------- speech bubble ---------- */
  var sayTimer = 0;
  function say(text, secs) {
    var el = $('say'); el.textContent = text; el.classList.remove('hide');
    clearTimeout(sayTimer); sayTimer = setTimeout(function () { el.classList.add('hide'); }, (secs || 1.6) * 1000);
  }

  /* ---------- sound button ---------- */
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.pick(); });
  renderSound();

  /* ---------- main loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    if (anim) { anim.r += dt * (reduceMotion ? 6000 : 1500); if (anim.r > 600) anim = null; }
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (mode === 'colour' && pic) {
      ctx.save();
      // the page sits on the table like a raised card: a soft shadow, then an ink edge, thicker at the bottom
      ctx.fillStyle = 'rgba(42,35,64,.14)'; GGDraw.rr(ctx, PX - 2, PY + 10, PS + 8, PS + 8, 22); ctx.fill();
      ctx.fillStyle = GGDraw.INK; GGDraw.rr(ctx, PX - 4, PY - 4, PS + 8, PS + 10, 22); ctx.fill();
      GGDraw.rr(ctx, PX, PY, PS, PS, 18); ctx.clip();
      var vk = vScale();
      ctx.translate(PX + PS / 2 - view.cx * vk, PY + PS / 2 - view.cy * vk);
      CP.drawPage(ctx, pic, PS * view.z, { anim: anim });
      // sparkles
      ctx.scale(vk, vk);
      parts.forEach(function (p) {
        var k = 1 - p.life / p.max; ctx.save(); ctx.globalAlpha = k; ctx.translate(p.x, p.y); ctx.rotate(p.life * 6);
        ctx.beginPath(); for (var j = 0; j < 8; j++) { var a = j * Math.PI / 4, r = j % 2 ? p.r * 0.35 : p.r; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath();
        ctx.fillStyle = '#FFF6C2'; ctx.fill(); ctx.restore();
      });
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(tools); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  showPicker();
  requestAnimationFrame(frame);

  /* test hook */
  window.__colour = {
    pic: function () { return pic && JSON.parse(JSON.stringify(pic)); },
    saved: function () { return JSON.parse(JSON.stringify(S)); },
    toScreen: function (x, y) { var k = vScale(); return { x: PX + PS / 2 + (x - view.cx) * k, y: PY + PS / 2 + (y - view.cy) * k }; },
    view: function () { return { z: view.z, cx: view.cx, cy: view.cy }; },
    regionCentre: function (i) { // a point inside region i (for tests)
      var pg = CP.get(pic.page);
      for (var y = 4; y < 400; y += 6) for (var x = 4; x < 400; x += 6) if (CP.hit(pic.page, x, y) === i) return { x: x, y: y };
      return null;
    }
  };
})();
