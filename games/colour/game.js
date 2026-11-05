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
  }
  function toPage(x, y) { return { x: (x - PX) / PS * 400, y: (y - PY) / PS * 400 }; }

  /* ---------- state ---------- */
  var mode = 'pick';               // pick | colour
  var pic = null;                  // the picture being coloured
  var isNew = false;
  var tool = 'fill';
  var current = CP.COLOURS[0], sticker = 'heart';
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
    $('pages').innerHTML = CP.PAGES.map(function (p) {
      return '<button class="pg" type="button" data-page="' + p.id + '"><img alt="" src="' + pageThumb(p.id) + '">' + esc(p.name) + '</button>';
    }).join('');
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
    if (tool === 'fill') {
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
    pic = JSON.parse(JSON.stringify(p));
    isNew = fresh;
    history = [];
    mode = 'colour';
    $('picker').hidden = true; tools.hidden = false;
    $('homeBtn').hidden = true; $('backBtn').hidden = false;
    $('titleLabel').textContent = CP.get(pic.page).name;
    setTool('fill');
    renderButtons();
    layout();
    if (fresh) say('Tap a shape to colour it in!', 2);
  }
  function showPicker() {
    mode = 'pick'; pic = null;
    $('picker').hidden = false; tools.hidden = true;
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
  canvas.addEventListener('pointerdown', function (e) {
    if (mode !== 'colour') return;
    Sound.init();
    var p = toPage(e.clientX, e.clientY);
    if (p.x < 0 || p.y < 0 || p.x > 400 || p.y > 400) return;
    if (tool === 'fill') {
      var r = CP.hit(pic.page, p.x, p.y);
      if (r < 0 || pic.f[r] === current) { if (r >= 0) { Sound.pick(); } return; }
      snapshot();
      anim = { region: r, x: p.x, y: p.y, r: 0, from: pic.f[r] || '#FFFFFF' };
      pic.f[r] = current;
      if (current.charAt(0) !== '#') { Sound.sparkle(); sparkle(p.x, p.y, 8); } else Sound.splat();
      buzz(6);
      commit();
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
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var p = toPage(e.clientX, e.clientY);
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 6) return;
    if (!drag.moved) { history.push(drag.snap); drag.moved = true; }
    pic.st[drag.i][1] = Math.round(clamp(p.x, -30, 430)); pic.st[drag.i][2] = Math.round(clamp(p.y, -30, 430));
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    var s = pic.st[drag.i];
    // dragged off the page: the sticker is peeled off
    if (s && (s[1] < 0 || s[2] < 0 || s[1] > 400 || s[2] > 400)) { pic.st.splice(drag.i, 1); Sound.undo(); }
    if (drag.moved) commit();
    drag = null;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

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
    frameSel = pic.fr || 0;
    renderFrames();
    $('frameWrap').hidden = false;
    $('hangBtn').focus();
  });
  $('hangBtn').addEventListener('click', function () {
    var first = !pic.done;
    pic.fr = frameSel; pic.done = true;
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
      ctx.fillStyle = '#2A2340';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(PX - 4, PY + 2, PS + 8, PS + 8, 22) : ctx.rect(PX - 4, PY + 2, PS + 8, PS + 8); ctx.fill();
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(PX, PY, PS, PS, 18) : ctx.rect(PX, PY, PS, PS); ctx.clip();
      ctx.translate(PX, PY);
      CP.drawPage(ctx, pic, PS, { anim: anim });
      // sparkles
      ctx.scale(PS / 400, PS / 400);
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
    toScreen: function (x, y) { return { x: PX + x / 400 * PS, y: PY + y / 400 * PS }; },
    regionCentre: function (i) { // a point inside region i (for tests)
      var pg = CP.get(pic.page);
      for (var y = 4; y < 400; y += 6) for (var x = 4; x < 400; x += 6) if (CP.hit(pic.page, x, y) === i) return { x: x, y: y };
      return null;
    }
  };
})();
