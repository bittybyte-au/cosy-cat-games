/* Cat Fashion Studio – dress your own cat up and do a photoshoot.
   Tabs along the bottom: Hats, Glasses, Neck, Tops (pick a piece, then its colour and pattern) and Photo (pick a
   backdrop, a pose, a face and sparkles, then take the picture). A photo can be hung in Cosy Home (it goes into the
   shared collection as { type: 'photo' } and Cosy Home shows it under Things) or saved as a picture.
   The dice button picks a random outfit. Clothes and photos are drawn by shared/fashion.js, so Cosy Home draws the
   same photo. Nothing to win or lose. Saves the current outfit to GG.setProgress('fashion', { outfit, bg, pose, face, fx, shots }). */
(function () {
  'use strict';

  var D = GGDraw, INK = D.INK, F = GGFashion;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function track(n, d) { if (window.GG && GG.track) GG.track(n, d); }

  // which pieces have a pattern as well as a colour
  var PATTERNED = { beanie: 1, cap: 1, beret: 1, sunhat: 1, bow: 1, bowtie: 1, scarf: 1, bandana: 1, tie: 1, tee: 1, hoodie: 1, sweater: 1, dress: 1, jacket: 1, overalls: 1 };
  var NO_COLOUR = { flowers: 1, pearls: 1 };
  var FACES = [{ id: 'happy', name: 'Big smile' }, { id: 'open', name: 'Cool' }, { id: 'blink', name: 'Dreamy' }, { id: 'surprised', name: 'Wow!' }];

  /* ================= saved state ================= */
  var S = (function () {
    var p = {}; try { p = GG.getProgress('fashion') || {}; } catch (e) {}
    var o = p.outfit && typeof p.outfit === 'object' ? p.outfit : {};
    ['hat', 'glasses', 'neck', 'top'].forEach(function (k) { if (!o[k] || typeof o[k] !== 'object') o[k] = { id: 'none', col: F.COLOURS[k === 'top' ? 5 : 0], pat: 'plain' }; });
    return { outfit: o, bg: p.bg || 'studio', pose: p.pose || 'sit', face: p.face || 'happy', fx: p.fx ? 1 : 0, shots: p.shots || 0 };
  })();
  function save() { try { GG.setProgress('fashion', S); } catch (e) {} }

  /* ================= your cat ================= */
  var LOOK = { preset: 'ginger' };
  function catSetup() {
    var p = null; try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) { LOOK = { color: '#FFA94D', markings: 'tabby' }; }
    else {
      var av = GGAvatar.normalise(p.avatar, p.color);
      LOOK = { color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
        build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
        markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none' };
    }
    thumbs = {}; if (window.__fsReady) renderPanel();
  }
  function model(over) {
    var m = { look: LOOK, pose: S.pose, face: S.face, outfit: S.outfit };
    for (var k in over || {}) m[k] = over[k];
    return m;
  }

  /* ================= the panel ================= */
  var tab = 'hat', thumbs = {};
  function pieceThumb(slot, id) {
    var it = S.outfit[slot], key = slot + id + it.col + it.pat + JSON.stringify(LOOK);
    if (thumbs[key]) return thumbs[key];
    var cv = document.createElement('canvas'); cv.width = cv.height = 124;
    var c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    var of = { hat: { id: 'none' }, glasses: { id: 'none' }, neck: { id: 'none' }, top: { id: 'none' } };
    of[slot] = { id: id, col: it.col, pat: it.pat };
    // the part of the cat that shows the piece best: the head for hats and glasses, the whole cat for the rest
    if (slot === 'hat') { c.translate(62, 78); F.drawModel(c, { look: LOOK, pose: 'sit', face: 'happy', outfit: of }, 104); }
    else if (slot === 'glasses') { c.translate(62, 58); c.scale(1.5, 1.5); F.drawModel(c, { look: LOOK, pose: 'sit', face: 'open', outfit: of }, 76); }
    else { c.translate(62, 16); F.drawModel(c, { look: LOOK, pose: 'sit', face: 'happy', outfit: of }, 62); }
    return (thumbs[key] = cv.toDataURL());
  }
  function patThumb(pat, col) {
    var key = 'pat' + pat + col; if (thumbs[key]) return thumbs[key];
    var cv = document.createElement('canvas'); cv.width = 72; cv.height = 56;
    F.swatch(cv.getContext('2d'), 0, 0, 72, 56, { col: col, pat: pat });
    return (thumbs[key] = cv.toDataURL());
  }
  function bgThumb(id) {
    var key = 'bg' + id; if (thumbs[key]) return thumbs[key];
    var cv = document.createElement('canvas'); cv.width = cv.height = 124; var c = cv.getContext('2d');
    F.drawBackdrop(c, id, 124, 124);
    return (thumbs[key] = cv.toDataURL());
  }
  function renderPanel() {
    document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    var r1 = '', r2 = '';
    if (tab === 'photo') {
      r1 = F.BACKDROPS.map(function (b) { return '<button class="pick" type="button" data-bg="' + b.id + '" aria-label="' + b.name + '" aria-pressed="' + (S.bg === b.id) + '"><img alt="" src="' + bgThumb(b.id) + '"></button>'; }).join('');
      r2 = '<button class="snap" type="button" id="snapBtn"><svg viewBox="0 0 32 32"><rect x="3" y="9" width="26" height="18" rx="5" fill="#FFFFFF" stroke="#2A2340" stroke-width="2.6"/><path d="M11 9 L13 5 H19 L21 9" fill="#FFFFFF" stroke="#2A2340" stroke-width="2.6" stroke-linejoin="round"/><circle cx="16" cy="18" r="5.5" fill="#BFE6FF" stroke="#2A2340" stroke-width="2.6"/></svg>Snap!</button><span class="sep"></span>' +
        ['sit', 'wave'].map(function (p) { return '<button class="chip" type="button" data-pose="' + p + '" aria-pressed="' + (S.pose === p) + '">' + (p === 'sit' ? 'Sit' : 'Wave') + '</button>'; }).join('') +
        '<span class="sep"></span>' + FACES.map(function (f) { return '<button class="chip" type="button" data-face="' + f.id + '" aria-pressed="' + (S.face === f.id) + '">' + f.name + '</button>'; }).join('') +
        '<span class="sep"></span><button class="chip" type="button" data-fx="1" aria-pressed="' + !!S.fx + '">✨ Sparkles</button>';
    } else {
      var it = S.outfit[tab];
      r1 = F.SLOTS[tab].map(function (p) {
        if (p.id === 'none') return '<button class="pick none" type="button" data-piece="none" aria-label="' + p.name + '" aria-pressed="' + (it.id === 'none') + '">' + p.name + '</button>';
        return '<button class="pick" type="button" data-piece="' + p.id + '" aria-label="' + p.name + '" aria-pressed="' + (it.id === p.id) + '"><img alt="" src="' + pieceThumb(tab, p.id) + '"></button>';
      }).join('');
      if (it.id !== 'none' && !NO_COLOUR[it.id]) {
        r2 = F.COLOURS.map(function (col) { return '<button class="sw" type="button" data-col="' + col + '" aria-label="Colour ' + col + '" aria-pressed="' + (it.col === col) + '" style="background:' + col + '"></button>'; }).join('');
        if (PATTERNED[it.id]) r2 += '<span class="sep"></span>' + F.PATTERNS.map(function (p) { return '<button class="pat" type="button" data-pat="' + p.id + '" aria-label="' + p.name + '" aria-pressed="' + (it.pat === p.id) + '"><img alt="" src="' + patThumb(p.id, it.col) + '"></button>'; }).join('');
      } else r2 = '<span class="chip" style="cursor:default;border-style:dashed;background:transparent">' + (it.id === 'none' ? 'Pick something to wear!' : 'This one comes as it is') + '</span>';
    }
    $('row1').innerHTML = r1; $('row2').innerHTML = r2;
    if (canvas) layout();
  }
  window.__fsReady = true;
  catSetup(); window.addEventListener('gg-change', catSetup);
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return;
    Sound.init(); Sound.click(); tab = b.dataset.tab; renderPanel();
    if (tab === 'photo') say('Pick a backdrop and a pose, then Snap!', 2.2);
  });
  $('panel').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.classList.contains('tab')) return;
    Sound.init();
    var it = tab !== 'photo' ? S.outfit[tab] : null;
    if (b.dataset.piece) {
      it.id = b.dataset.piece; Sound.pop(); hop(); buzz(6);
      if (it.id !== 'none') track('Wear', { game: 'fashion', piece: it.id });
    } else if (b.dataset.col) { it.col = b.dataset.col; Sound.swish(); }
    else if (b.dataset.pat) { it.pat = b.dataset.pat; Sound.swish(); }
    else if (b.dataset.bg) { S.bg = b.dataset.bg; Sound.pop(); }
    else if (b.dataset.pose) { S.pose = b.dataset.pose; Sound.pop(); hop(); }
    else if (b.dataset.face) { S.face = b.dataset.face; Sound.pop(); }
    else if (b.dataset.fx) { S.fx = S.fx ? 0 : 1; Sound.twinkle(); }
    else if (b.id === 'snapBtn') { snap(); return; }
    else return;
    save(); renderPanel();
  });
  $('shuffleBtn').addEventListener('click', function () {
    Sound.init(); Sound.shuffle(); hop(); buzz(10);
    ['hat', 'glasses', 'neck', 'top'].forEach(function (k) {
      var pieces = F.SLOTS[k].filter(function (p) { return p.id !== 'none'; });
      var it = S.outfit[k];
      it.id = Math.random() < (k === 'glasses' ? 0.45 : 0.75) ? pickOne(pieces).id : 'none';
      it.col = pickOne(F.COLOURS); it.pat = Math.random() < 0.5 ? 'plain' : pickOne(F.PATTERNS).id;
    });
    // keep the colours friendly: the top and the hat in different colours
    if (S.outfit.top.col === S.outfit.hat.col) S.outfit.hat.col = pickOne(F.COLOURS);
    sparkleAt(0.5, 0.45, 12);
    save(); renderPanel();
    track('Shuffle', { game: 'fashion' });
  });

  /* ================= the photoshoot ================= */
  var lastPhoto = null;
  function photoData() {
    var o = {}; ['hat', 'glasses', 'neck', 'top'].forEach(function (k) { var it = S.outfit[k]; if (it.id !== 'none') o[k] = { id: it.id, col: it.col, pat: it.pat }; });
    return { bg: S.bg, fx: S.fx, m: { look: LOOK, pose: S.pose, face: S.face, outfit: o } };
  }
  function snap() {
    Sound.shutter(); buzz([10, 40, 10]);
    var fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    lastPhoto = photoData();
    S.shots++; save();
    track('Take photo', { game: 'fashion', bg: S.bg });
    setTimeout(function () {
      var c = $('photoPic').getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 480, 580);
      c.translate(240, 560); F.drawPhoto(c, lastPhoto, 420);
      $('cardTitle').textContent = pickOne(['Gorgeous!', 'Stunning!', 'Picture perfect!', 'Fabulous!', 'What a look!']);
      $('cardNote').textContent = 'Hang it on a wall in your Cosy Home, or save it.';
      $('hangBtn').disabled = false; $('hangBtn').textContent = 'Hang it in Cosy Home';
      $('cardWrap').hidden = false;
    }, reduceMotion ? 50 : 350);
  }
  $('hangBtn').addEventListener('click', function () {
    Sound.init();
    if (!lastPhoto) return;
    var uid = null; try { uid = GG.collect('fashion', { type: 'photo', id: lastPhoto.bg, data: lastPhoto }); } catch (e) {}
    if (uid) {
      Sound.chime(); buzz(15);
      $('hangBtn').disabled = true; $('hangBtn').textContent = 'In your Cosy Home ✓';
      $('cardNote').textContent = 'Find it in Cosy Home, under Things, and drag it onto a wall.';
      if (GG.stat) GG.stat('fashion', 'photos', 1);
      track('Hang photo', { game: 'fashion' });
    } else $('cardNote').textContent = 'Sorry, that didn’t save. Try again?';
  });
  $('saveBtn').addEventListener('click', function () {
    Sound.init(); Sound.click();
    if (!lastPhoto) return;
    var cv = document.createElement('canvas'); cv.width = 900; cv.height = 1080;
    var c = cv.getContext('2d'); c.fillStyle = '#FFE3EE'; c.fillRect(0, 0, 900, 1080);
    c.translate(450, 1040); F.drawPhoto(c, lastPhoto, 780);
    var name = 'cat-fashion-' + (S.shots || 1) + '.png';
    function go(url) { var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 100); }
    try {
      if (cv.toBlob) cv.toBlob(function (b) { if (!b) return; var url = URL.createObjectURL(b); go(url); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); });
      else go(cv.toDataURL('image/png'));
    } catch (e) {}
    track('Save photo', { game: 'fashion' });
  });
  $('backBtn').addEventListener('click', function () { Sound.init(); Sound.click(); $('cardWrap').hidden = true; });

  /* ================= the studio (canvas) ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, area = { x: 0, y: 0, w: 1, h: 1 };
  var hopT = 0, parts = [];
  function hop() { hopT = 0.45; }
  function sparkleAt(fx, fy, n) {
    for (var i = 0; i < (reduceMotion ? Math.ceil(n / 3) : n); i++) { var a = rand(0, TAU), sp = rand(60, 220); parts.push({ x: area.x + area.w * fx, y: area.y + area.h * fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.5, 0.9), r: rand(5, 9), col: pickOne(['#FFD23F', '#FF8FAB', '#FFFFFF', '#7CC4FF']) }); }
  }
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = ($('topbar').getBoundingClientRect().bottom || 64) + 8, bottom = $('panel').getBoundingClientRect().top - 10;
    var ah = Math.max(120, bottom - top), aw = Math.min(cw - 24, ah * 1.25);
    area = { x: (cw - aw) / 2, y: top, w: aw, h: ah };
    $('say').style.bottom = (ch - bottom + 14) + 'px';
  }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    var x = e.clientX, y = e.clientY;
    if (x > area.x && x < area.x + area.w && y > area.y && y < area.y + area.h) { hop(); Sound.mrrp(); sparkleAt((x - area.x) / area.w, (y - area.y) / area.h, 6); }
  });
  function draw(c, dt) {
    c.fillStyle = '#FFE3EE'; c.fillRect(0, 0, cw, ch);
    // the studio backdrop, framed like a little set
    c.save(); D.rr(c, area.x, area.y, area.w, area.h, 22); c.clip();
    c.translate(area.x, area.y);
    var ph = photoData();
    ph.fx = 0;
    F.drawBackdrop(c, ph.bg, area.w, area.h);
    var size = Math.min(area.w * 0.42, area.h * 0.44), k = size / 88;   // room above for a tall hat
    var h = hopT > 0 ? Math.sin(clamp(hopT / 0.45, 0, 1) * Math.PI) * size * 0.12 : 0;
    var sway = reduceMotion ? 0 : Math.sin(time * 1.6) * 0.015;
    c.save(); c.translate(area.w / 2, area.h * 0.93 - 96 * k);
    D.shadow(c, 0, 96 * k, 46 * k * (1 - h / size), 8 * k);
    c.translate(0, -h); c.rotate(sway);
    F.drawModel(c, ph.m, size);
    c.restore();
    if (S.fx) { var R = D.seeded(3); for (var i = 0; i < 9; i++) { var x = R() * area.w, y = R() * area.h * 0.7, r = area.w * (0.015 + R() * 0.025) * (0.8 + 0.3 * Math.sin(time * 3 + i)); starPath(c, x, y, r); c.fillStyle = i % 2 ? '#FFFFFF' : '#FFE27A'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); } }
    c.restore();
    D.rr(c, area.x, area.y, area.w, area.h, 22); D.ink(c, 4);
    parts.forEach(function (p) { var kk = 1 - p.life / p.max; c.save(); c.globalAlpha = kk; c.translate(p.x, p.y); c.rotate(p.life * 6); starPath(c, 0, 0, p.r); c.fillStyle = p.col; c.fill(); D.ink(c, 1.5); c.restore(); });
  }
  function starPath(c, x, y, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }

  /* ================= messages ================= */
  var sayT = 0;
  function say(t, s) { var el = $('say'); el.textContent = t; el.classList.remove('hide'); sayT = s || 2; }

  /* ================= sound ================= */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null;
    var on = GG.getSetting('sound', true);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function ready() { return ac && on; }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function tone(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0), osc = ac.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.005, o.gain || 0.12, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.005) + (o.dur || 0.15) + 0.05);
    }
    function noise(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0), src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
      var g = ac.createGain(); env(g, t, o.attack || 0.003, o.gain || 0.15, o.dur || 0.08);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + (o.attack || 0.003) + (o.dur || 0.08) + 0.05);
    }
    return {
      init: init, isOn: function () { return on; },
      setOn: function (v) { on = v; GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      click: function () { tone({ f: 900, dur: 0.04, gain: 0.06, type: 'triangle' }); },
      pop: function () { tone({ f: 420, to: 900, dur: 0.1, gain: 0.09, slide: 0.06 }); },
      swish: function () { noise({ type: 'bandpass', freq: 2200, q: 0.8, attack: 0.02, dur: 0.1, gain: 0.05 }); },
      twinkle: function () { [1568, 2093, 2637].forEach(function (f, i) { tone({ f: f, dur: 0.12, gain: 0.04, delay: i * 0.06, type: 'triangle' }); }); },
      shuffle: function () { for (var i = 0; i < 5; i++) tone({ f: 500 + i * 120, dur: 0.05, gain: 0.05, delay: i * 0.04, type: 'triangle' }); },
      shutter: function () { noise({ type: 'highpass', freq: 3000, q: 0.7, dur: 0.05, gain: 0.12 }); noise({ type: 'bandpass', freq: 1200, q: 1, dur: 0.06, gain: 0.1, delay: 0.07 }); },
      chime: function () { [784, 988, 1175, 1568].forEach(function (f, i) { tone({ f: f, dur: 0.2, gain: 0.06, delay: i * 0.08, type: 'triangle' }); }); },
      mrrp: function () { var p = rand(0.9, 1.2); tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', delay: 0.1, slide: 0.12 }); }
    };
  })();
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function (e) { e.stopPropagation(); Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.click(); });
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= loop ================= */
  var time = 0, last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    hopT = Math.max(0, hopT - dt);
    sayT -= dt; if (sayT <= 0 && !$('say').classList.contains('hide')) $('say').classList.add('hide');
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; } p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    draw(ctx, dt);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe($('panel')); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });
  renderPanel();
  layout();
  requestAnimationFrame(frame);
  track('Open studio', { game: 'fashion' });

  window.__fs = { state: function () { return { tab: tab, outfit: S.outfit, bg: S.bg, shots: S.shots, photos: (GG.collection ? GG.collection({ type: 'photo' }).length : -1) }; }, snap: snap };
})();
