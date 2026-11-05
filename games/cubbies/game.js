/* Cosy Cubbies – sleepy cats in beds ride along a conveyor belt; drag each one into the cubby of its colour.
   Three cats fill a cubby, which then slides away and a new one arrives. Fill enough cubbies to finish the level.
   Cats that reach the end of the belt wait on a mat (5 spots). If a cat arrives when the mat is full, the level starts again.
   Each level the belt runs a little faster and the cats come a little closer together.
   Everything is drawn in code on one canvas; sounds are made with Web Audio (no files). */
(function () {
  'use strict';

  var D = window.GGDraw, INK = D.INK, LW = D.LW;
  var TAU = Math.PI * 2;
  var MAT_SPOTS = 5;
  /* The belt is always this many cat-widths long, on every screen, so cats take the same time to cross
     on a phone, a tablet or a computer. */
  var BELT_CATS = 6.0;
  var DOOR_CATS = 0.5;  // the cat house at the start overlaps the belt by this much
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  var seeded = D.seeded, rr = D.rr;
  function shuffle(a, rnd) { rnd = rnd || Math.random; for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* The six cats, shared with Kitty Match (copied so each game stands alone). */
  /* ---------- the six cats ----------
     Each colour has its own face detail so they can be told apart without relying on colour. */
  var CATS = [
    { id: 'ginger', name: 'ginger', fill: '#FFA94D', dark: '#E07B1F', inner: '#FFC7A0', line: INK },
    { id: 'pink',   name: 'pink',   fill: '#FF9EC4', dark: '#E8558E', inner: '#FFD3E4', line: INK },
    { id: 'blue',   name: 'blue',   fill: '#7CC4FF', dark: '#3B8FD6', inner: '#CDE8FF', line: INK },
    { id: 'purple', name: 'purple', fill: '#B48CFF', dark: '#7E55D6', inner: '#E2D3FF', line: INK },
    { id: 'black',  name: 'black',  fill: '#4A4160', dark: '#2E2840', inner: '#8E7FA8', line: '#F3EEFF' },
    { id: 'white',  name: 'white',  fill: '#FFFFFF', dark: '#D9D3E6', inner: '#FFC4D6', line: INK }
  ];

  /* Draw one cat head centred on (0,0), about `s` wide. face: open | blink | happy | surprised | yawn.
     fillOverride lets the add-on draw a rainbow cat with the same shape. */
  function drawCat(c, kind, face, s, fillOverride) {
    // the shared cat (shared/cat.js): same head, ears and face as every cat on the site.
    // `s` is this game's cat size; the shared cat's size is its head width (0.88 of that).
    GGCat.draw(c, { preset: GGCat.GAME_ORDER[kind] || 'ginger', face: face, size: s * 0.88, color: fillOverride || undefined, plain: !!fillOverride });
  }


  /* A cat asleep in a round bed, centred on (0,0), about `s` wide: the shared lying cat (shared/cat.js),
     between the back of the bed and its front rim. Lines use the cat's own weights, so bed and cat match. */
  function drawBedCat(c, kind, face, s) {
    var size = s * 0.76, u = size / 88;
    // back of the bed, with its hollow
    D.shape(c, D.ellPath(0, s * 0.3, s * 0.56, s * 0.24), D.tone(c, '#F2DCC3', s * 0.06, s * 0.54), { lw: LW.big * u, depth: 0, inside: function (c) {
      c.beginPath(); c.ellipse(0, s * 0.32, s * 0.44, s * 0.15, 0, 0, TAU); c.fillStyle = '#E2C2A2'; c.fill();
    } });
    // the cat, curled up with its paws under its chin, tail over the side
    c.save(); c.translate(11 * u, s * 0.33 - 43 * u);
    GGCat.draw(c, { preset: GGCat.GAME_ORDER[kind] || 'ginger', face: face, pose: 'lie', size: size });
    c.restore();
    // front rim of the bed, tucked over the cat's tummy
    D.shape(c, function (p) {
      p.moveTo(-s * 0.56, s * 0.3);
      p.bezierCurveTo(-s * 0.5, s * 0.62, s * 0.5, s * 0.62, s * 0.56, s * 0.3);
      p.bezierCurveTo(s * 0.4, s * 0.44, -s * 0.4, s * 0.44, -s * 0.56, s * 0.3);
      p.closePath();
    }, D.tone(c, '#F7E6D2', s * 0.3, s * 0.54), { lw: LW.big * u, depth: s * 0.05, shine: [-s * 0.3, s * 0.42, s * 0.1, s * 0.025, 0.25, 0.6] });
  }

  /* Cached sprites keep things smooth on older tablets. */
  var FACES = ['open', 'blink', 'happy', 'surprised'];
  var bedSprites = {}, headSprites = {}, bedPx = 0, headPx = 0;
  /* a sprite's canvas is `room` cat sizes across (1.3, or more for the sleeping cat's tail and whiskers) */
  function makeSprite(px, fn, room) {
    var cv = document.createElement('canvas');
    cv.room = room || 1.3;
    cv.width = cv.height = Math.ceil(px * cv.room);
    var c = cv.getContext('2d');
    c.translate(cv.width / 2, cv.height / 2);
    fn(c);
    return cv;
  }
  function buildSprites(bed, head) {
    bed = Math.max(24, Math.round(bed)); head = Math.max(16, Math.round(head));
    if (bed !== bedPx) {
      bedPx = bed; bedSprites = {};
      for (var k = 0; k < CATS.length; k++) FACES.forEach(function (f) { bedSprites[k + ':' + f] = makeSprite(bed, function (c) { drawBedCat(c, k, f, bed); }, 1.5); });
    }
    if (head !== headPx) {
      headPx = head; headSprites = {};
      for (var k2 = 0; k2 < CATS.length; k2++) FACES.forEach(function (f) { headSprites[k2 + ':' + f] = makeSprite(head, function (c) { c.translate(0, head * 0.03); drawCat(c, k2, f, head); }); });
    }
  }
  function blit(c, map, kind, face, x, y, size) {
    var img = map[kind + ':' + face];
    if (!img) return;
    var w = size * img.room;
    c.drawImage(img, x - w / 2, y - w / 2, w, w);
  }
  function catImageURL(kind, face, px) {
    return makeSprite(px, function (c) { c.translate(0, px * 0.03); drawCat(c, kind, face || 'open', px); }).toDataURL('image/png');
  }

  /* ---------- sound (synthesised, soft) ---------- */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null;
    var on = GG.getSetting('sound', true);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function ready() { return ac && on; }
    function env(g, t, a, peak, dec) {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    function noise(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 1;
      if (o.toFreq) f.frequency.exponentialRampToValueAtTime(o.toFreq, t + (o.attack || 0.003) + (o.dur || 0.08));
      var g = ac.createGain(); env(g, t, o.attack || 0.003, o.gain || 0.2, o.dur || 0.08);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t, Math.random()); src.stop(t + (o.attack || 0.003) + (o.dur || 0.08) + 0.05);
    }
    function tone(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var osc = ac.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || o.dur || 0.1));
      var g = ac.createGain(); env(g, t, o.attack || 0.005, o.gain || 0.15, o.dur || 0.15);
      osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + (o.attack || 0.005) + (o.dur || 0.15) + 0.05);
    }
    return {
      init: init,
      isOn: function () { return on; },
      setOn: function (v) { on = v; if (GG.setSetting) GG.setSetting('sound', v); if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.02); },
      mrrp: function (delay) {
        var p = rand(0.9, 1.2);
        tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1, delay: delay });
        tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', slide: 0.12, delay: (delay || 0) + 0.1 });
      },
      pick: function () { tone({ f: 600, to: 820, dur: 0.07, gain: 0.08, type: 'triangle', slide: 0.05 }); },
      plop: function (n) {
        var f = [392, 523.25, 659.25][Math.min(2, n || 0)];
        tone({ f: f * 0.7, to: f, dur: 0.12, gain: 0.14, slide: 0.06 });
        noise({ type: 'lowpass', freq: 600, dur: 0.05, gain: 0.08 });
      },
      purr: function (delay) {
        for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.22, delay: (delay || 0) + i * 0.085 });
      },
      nope: function () { tone({ f: 330, to: 260, dur: 0.1, gain: 0.08, type: 'triangle' }); tone({ f: 300, to: 240, dur: 0.1, gain: 0.07, type: 'triangle', delay: 0.12 }); },
      boing: function () { tone({ f: 220, to: 520, dur: 0.14, gain: 0.08, type: 'triangle', slide: 0.12 }); },
      whoosh: function () { noise({ freq: 1200, toFreq: 2600, q: 0.8, attack: 0.05, dur: 0.18, gain: 0.07 }); },
      chime: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 });
          tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' });
        });
      },
      ding: function () { tone({ f: 1046.5, dur: 0.3, gain: 0.08, type: 'triangle' }); tone({ f: 1318.5, dur: 0.35, gain: 0.07, type: 'triangle', delay: 0.09 }); },
      uhoh: function () { tone({ f: 523.25, to: 392, dur: 0.25, gain: 0.1, type: 'triangle', slide: 0.2 }); tone({ f: 392, to: 311, dur: 0.35, gain: 0.1, type: 'triangle', delay: 0.28, slide: 0.3 }); },
      tick: function () { noise({ type: 'highpass', freq: 3000, dur: 0.015, gain: 0.03 }); }
    };
  })();

  /* ---------- levels ----------
     Speeds are in "cat widths per second"; gaps are the space between cats, in cat widths. */
  function levelDef(n) {
    var colours = n <= 2 ? 3 : n <= 5 ? 4 : n <= 9 ? 5 : 6;
    var cubbies = colours <= 3 ? 3 : 4;
    var rnd = seeded(n * 104729 + 7);
    return {
      n: n,
      colours: shuffle([0, 1, 2, 3, 4, 5], rnd).slice(0, colours),
      cubbies: cubbies,
      goal: Math.min(16, 4 + (n - 1)),          // cubbies to fill (3 cats each)
      speed: Math.min(2.0, 0.8 * Math.pow(1.08, n - 1)),
      gap: Math.max(1.05, 1.7 - (n - 1) * 0.07),
      // how often a new cat matches a cubby that's on the shelf right now
      fair: Math.max(0.62, 0.86 - (n - 1) * 0.02)
    };
  }

  /* ---------- layout ---------- */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1;
  var L = { catS: 70, cubW: 150, cubH: 140, cubPos: [], beltY: 600, beltH: 100, beltX0: 0, beltX1: 400, matY: 480, matX: [], spotGap: 80 };

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var n = level ? level.cubbies : 3;
    var top = topbar.getBoundingClientRect().bottom + 14;
    var bottom = ch - 14;
    var availW = Math.min(cw - 24, 980);
    var gap = Math.max(10, Math.min(22, availW * 0.025));
    // four cubbies on a narrow screen go in a 2 x 2 grid so they're bigger targets
    var cols = n === 4 && cw < 600 ? 2 : n, rows = Math.ceil(n / cols);
    var cubW = Math.min((availW - gap * (cols - 1)) / cols, cols === 2 ? 175 : 200);
    var catS = clamp(Math.min((cw - 14) / (BELT_CATS + DOOR_CATS), rows === 1 ? cubW * 0.66 : 100), 40, 100);
    var rowGap = gap * 1.8, gapA = catS * 0.75, cubH, matH, beltH, blockH;
    // fit everything vertically: cubbies, a gap, the mat, the belt
    for (var tries = 0; tries < 14; tries++) {
      cubH = cubW * 0.92; matH = catS * 1.15; beltH = catS * 1.25;
      blockH = rows * cubH + (rows - 1) * rowGap;
      if (blockH + gapA + matH + beltH + catS * 0.4 <= bottom - top) break;
      cubW *= 0.93; catS = Math.max(36, catS * 0.95); gapA = catS * 0.75;
    }
    L.catS = catS; L.cubW = cubW; L.cubH = cubH;
    L.beltH = beltH;
    var beltLen = BELT_CATS * catS;
    L.beltX0 = (cw - beltLen - DOOR_CATS * catS) / 2 + DOOR_CATS * catS; L.beltX1 = L.beltX0 + beltLen;
    // keep cubbies, mat and belt close together (short drags), a little below the middle of the screen
    var group = blockH + gapA + matH + beltH;
    var spare = Math.max(0, (bottom - top) - group);
    var gTop = top + spare * 0.6;
    var rowW = cols * cubW + (cols - 1) * gap;
    L.cubPos = [];
    for (var i = 0; i < n; i++) {
      var col = i % cols, row = Math.floor(i / cols);
      L.cubPos.push({ x: (cw - rowW) / 2 + cubW / 2 + col * (cubW + gap), y: gTop + cubH / 2 + row * (cubH + rowGap) });
    }
    L.matY = gTop + blockH + gapA + matH / 2;
    L.beltY = L.matY + matH / 2 + beltH / 2 + catS * 0.12;
    L.spotGap = Math.min(catS * 1.2, (beltLen - catS * 0.4) / MAT_SPOTS);
    L.matX = [];
    for (var s = 0; s < MAT_SPOTS; s++) L.matX.push((L.beltX0 + L.beltX1) / 2 + (s - (MAT_SPOTS - 1) / 2) * L.spotGap);
    L.matH = matH;
    buildSprites(catS * dpr, cubW * 0.34 * dpr);
    // cubbies that are resting snap to their new places
    cubbies.forEach(function (cb, i) { if (cb.state === 'in' && L.cubPos[i]) { cb.x = L.cubPos[i].x; cb.y = L.cubPos[i].y; } });
    mat.forEach(function (cat, i) { if (cat && cat.where === 'mat') { cat.x = L.matX[i]; cat.y = L.matY; } });
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(topbar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  /* ---------- state ---------- */
  var level = null;
  var cats = [];          // every cat in play (belt, mat, held, flying, cubby)
  var cubbies = [];       // { kind, cats: [], x, y, state: in|leaving|entering, t, shake }
  var mat = [];           // MAT_SPOTS entries, cat or null
  var held = null;        // { cat, x, y, from }
  var tucked = 0;          // cats in cubbies (for pacing the belt)
  var filled = 0;          // cubbies filled this level: the goal
  var mode = 'play';      // play | won | full | ready
  var spawnDist = 0, nextGap = 0;
  var idle = 0, time = 0, readyT = 0;
  var nextId = 1;
  var parts = [];

  function newCat(kind) { return { id: nextId++, kind: kind, where: 'belt', x: 0, y: 0, bx: 0, face: 'blink', wake: 0, wig: 0, zT: rand(0, 3), fly: null }; }

  /* ---------- cubbies ---------- */
  function shownKinds() { return cubbies.filter(function (c) { return c.state !== 'leaving'; }).map(function (c) { return c.kind; }); }
  function pickCubbyKind() {
    // prefer a colour that's already waiting on the mat or belt, so nobody is stuck for long
    var shown = shownKinds();
    var waiting = {};
    cats.forEach(function (c) { if ((c.where === 'mat' || c.where === 'belt' || c.where === 'held') && shown.indexOf(c.kind) < 0) waiting[c.kind] = (waiting[c.kind] || 0) + (c.where === 'mat' ? 3 : 1); });
    var best = -1, bestN = 0;
    Object.keys(waiting).forEach(function (k) { if (waiting[k] > bestN) { bestN = waiting[k]; best = +k; } });
    if (best >= 0) return best;
    var free = level.colours.filter(function (k) { return shown.indexOf(k) < 0; });
    if (!free.length) free = level.colours;
    return free[Math.floor(Math.random() * free.length)];
  }
  function makeCubby(i, kind, entering) {
    var cb = { kind: kind, cats: [], x: L.cubPos[i].x, y: L.cubPos[i].y, state: entering ? 'entering' : 'in', t: 0, shake: 0, glow: 0 };
    if (entering) cb.y = L.cubPos[i].y - L.cubH * 1.6;
    return cb;
  }
  function cubbyRect(cb) { return { x: cb.x - L.cubW / 2, y: cb.y - L.cubH / 2, w: L.cubW, h: L.cubH }; }
  function slotPos(cb, i) {
    var r = cubbyRect(cb);
    return { x: cb.x + (i - 1) * L.cubW * 0.29, y: r.y + r.h * 0.66 };
  }

  /* ---------- belt ---------- */
  var recentKinds = [];
  function spawnCat(forceKind) {
    var shown = shownKinds();
    var kind;
    function choose() {
      if (shown.length && Math.random() < level.fair) return shown[Math.floor(Math.random() * shown.length)];
      return level.colours[Math.floor(Math.random() * level.colours.length)];
    }
    if (forceKind !== undefined) kind = forceKind;
    else {
      // no colour more than twice in a row
      for (var tries = 0; tries < 8; tries++) {
        kind = choose();
        if (!(recentKinds.length >= 2 && recentKinds[0] === kind && recentKinds[1] === kind)) break;
      }
    }
    recentKinds.unshift(kind); recentKinds.length = Math.min(recentKinds.length, 2);
    var c = newCat(kind);
    c.bx = L.beltX0 - L.catS * 0.05;
    cats.push(c);
  }
  function beltSpeed() {
    var v = level.speed * L.catS;
    if (held) v *= 0.5; // the belt eases off while you're carrying a cat
    return v;
  }
  function freeMatSpot() { for (var i = 0; i < MAT_SPOTS; i++) if (!mat[i]) return i; return -1; }
  function matCount() { var n = 0; for (var i = 0; i < MAT_SPOTS; i++) if (mat[i]) n++; return n; }

  /* ---------- flying (hops between places) ---------- */
  function fly(cat, x1, y1, dur, arc, done) {
    cat.fly = { x0: cat.x, y0: cat.y, x1: x1, y1: y1, t: 0, dur: reduceMotion ? Math.min(dur, 0.15) : dur, arc: arc, done: done };
    cat.where = 'flying';
  }

  /* ---------- particles ---------- */
  function sparkle(x, y, color, n) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(80, 240) * (L.catS / 70);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: rand(0.4, 0.75), r: rand(2.5, 6) * (L.catS / 70), color: Math.random() < 0.35 ? '#FFFFFF' : color, star: Math.random() < 0.45, spin: rand(-6, 6) });
    }
  }
  function star(c, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
    c.closePath();
  }

  /* ---------- speech bubble ---------- */
  var sayTimer = 0;
  function say(text, secs) {
    var el = $('say');
    el.textContent = text;
    el.classList.remove('hide');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { el.classList.add('hide'); }, (secs || 1.6) * 1000);
  }

  /* ---------- tally ---------- */
  function renderTally(bump) {
    $('tallyNum').textContent = Math.min(filled, level.goal);
    $('tallyGoal').textContent = level.goal;
    $('tallyBar').style.width = (100 * Math.min(1, filled / level.goal)) + '%';
    $('tally').setAttribute('aria-label', filled + ' of ' + level.goal + ' cubbies filled');
    if (bump && !reduceMotion) { var t = $('tally'); t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }
  }

  /* ---------- level flow ---------- */
  function progress() { var p = GG.getProgress('cubbies'); p.level = p.level || 1; return p; }

  function startLevel(n) {
    level = levelDef(n);
    cats = []; mat = []; held = null; parts = [];
    for (var i = 0; i < MAT_SPOTS; i++) mat.push(null);
    tucked = 0; filled = 0; spawnDist = 0; nextGap = 0; idle = 0; recentKinds = [];
    $('levelLabel').textContent = 'Level ' + n;
    $('cardWrap').hidden = true;
    layout();
    cubbies = [];
    var kinds = level.colours.slice(0, level.cubbies);
    for (var k = 0; k < level.cubbies; k++) { var cb = makeCubby(k, kinds[k], true); cb.t = -k * 0.12; cubbies.push(cb); }
    renderTally(false);
    mode = 'ready'; readyT = 0;
    say(n === 1 ? 'Drag each sleepy cat to its bed!' : 'Level ' + n + (n > 1 ? ': a bit faster!' : ''), 2.2);
  }

  function celebrate() {
    mode = 'won';
    if (held) dropHeldBack();
    Sound.chime(); Sound.purr(0.4); buzz(30);
    var p = progress();
    p.level = Math.max(p.level, level.n + 1);
    p.done = (p.done || 0) + 1;
    GG.setProgress('cubbies', p);
    if (GG.stat) GG.stat('cubbies', 'levels', 1);
    cubbies.forEach(function (cb, i) { cb.glow = 1; sparkle(cb.x, cb.y, CATS[cb.kind].fill, 12); });
    cats.forEach(function (c) { c.face = 'happy'; });
    setTimeout(function () {
      showCard('Hooray!', 'Level ' + level.n + ': all ' + level.goal + ' cubbies filled', 'Next level', false, 'happy');
    }, 1100);
  }

  function tooFull() {
    mode = 'full';
    if (held) dropHeldBack();
    Sound.uhoh();
    cats.forEach(function (c) { c.face = 'surprised'; c.wake = 9; });
    setTimeout(function () {
      showCard('Too many cats!', 'The mat got full. Let’s try that again.', 'Try again', true, 'surprised');
    }, 900);
  }

  function showCard(title, note, label, again, face) {
    $('cardTitle').textContent = title;
    $('cardNote').textContent = note;
    $('cardBtnLabel').textContent = label;
    $('cardBtn').classList.toggle('again', again);
    var faces = $('cardFaces'); faces.innerHTML = '';
    level.colours.slice(0, 5).forEach(function (k) { var im = document.createElement('img'); im.alt = ''; im.src = catImageURL(k, face, 64); faces.appendChild(im); });
    $('cardWrap').hidden = false;
    $('cardBtn').focus();
  }
  $('cardBtn').addEventListener('click', function () {
    Sound.init(); Sound.pick();
    startLevel(mode === 'won' ? level.n + 1 : level.n);
  });

  /* ---------- putting cats places ---------- */
  function placeInCubby(cat, cb) {
    var slot = cb.cats.length;
    cb.cats.push(cat);
    var p = slotPos(cb, slot);
    cat.cubby = cb;
    if (cat.spot !== undefined && mat[cat.spot] === cat) mat[cat.spot] = null;
    cat.spot = undefined;
    fly(cat, p.x, p.y, 0.22, L.catS * 0.3, function () {
      cat.where = 'cubby'; cat.face = 'blink';
      tucked++;
      Sound.plop(slot);
      sparkle(p.x, p.y, CATS[cat.kind].fill, 6);
      if (cb.cats.length >= 3) finishCubby(cb);
    });
  }

  function finishCubby(cb) {
    cb.glow = 1;
    filled++;
    renderTally(true);
    cb.cats.forEach(function (c) { c.face = 'happy'; });
    if (filled >= level.goal && mode === 'play') { celebrate(); return; }
    Sound.purr(0.1);
    setTimeout(function () { if (mode === 'play' || mode === 'won') Sound.ding(); }, 250);
    setTimeout(function () {
      if (mode !== 'play') return;
      cb.state = 'leaving'; cb.t = 0;
      Sound.whoosh();
    }, 650);
  }

  function returnCat(cat, from) {
    // back to the belt (where its spot has moved along to) or back to its mat spot
    if (from && from.where === 'mat') {
      var i = from.spot;
      fly(cat, L.matX[i], L.matY, 0.25, L.catS * 0.4, function () { cat.where = 'mat'; cat.spot = i; });
    } else {
      cat.returning = true;
      fly(cat, cat.bx, L.beltY - L.catS * 0.12, 0.25, L.catS * 0.4, function () { cat.where = 'belt'; cat.returning = false; });
    }
  }

  /* Find a clear spot on the belt for a cat, away from the cats already riding it. */
  function freeBeltX(near) {
    var taken = cats.filter(function (c) { return c.where === 'belt' || c.where === 'held' || (c.where === 'flying' && c.returning); }).map(function (c) { return c.bx; });
    var minGap = L.catS * 1.05;
    var lo = L.beltX0 + L.catS * 0.9, hi = L.beltX0 + (L.beltX1 - L.beltX0) * 0.7;
    var best = null, bestD = Infinity;
    for (var x = lo; x <= hi; x += L.catS * 0.25) {
      if (taken.some(function (t) { return Math.abs(t - x) < minGap; })) continue;
      var d = Math.abs(x - near);
      if (d < bestD) { bestD = d; best = x; }
    }
    if (best === null) {
      // belt is crowded: queue up just before the start
      var first = taken.length ? Math.min.apply(null, taken) : lo;
      best = Math.min(first, lo) - minGap;
    }
    return best;
  }

  function emptyCubby(cb, delay) {
    var out = cb.cats.slice();
    cb.cats = [];
    tucked = Math.max(0, tucked - out.length);
    out.forEach(function (c, i) {
      c.cubby = null; c.face = 'surprised'; c.wake = 1.2;
      c.bx = freeBeltX(cb.x + (i - 1) * L.catS);
      c.returning = true;
      setTimeout(function () { Sound.boing(); }, 120 + (delay + i * 0.09) * 1000);
      fly(c, c.bx, L.beltY - L.catS * 0.12, 0.45 + delay + i * 0.08, L.catS * 1.1, function () { c.where = 'belt'; c.returning = false; });
      sparkle(c.x, c.y, CATS[c.kind].fill, 5);
    });
  }

  function dropHeldBack() {
    var h = held; held = null;
    h.cat.x = h.x; h.cat.y = h.y;
    returnCat(h.cat, h.from);
  }

  function cubbyAt(x, y) {
    var pad = L.catS * 0.3;
    for (var i = 0; i < cubbies.length; i++) {
      var cb = cubbies[i];
      if (cb.state !== 'in') continue;
      var r = cubbyRect(cb);
      if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return cb;
    }
    return null;
  }

  /* ---------- input ---------- */
  var pointerId = null, downAt = null;
  function catAt(x, y) {
    var best = null, bd = L.catS * 0.62;
    cats.forEach(function (c) {
      if (c.where !== 'belt' && c.where !== 'mat') return;
      var d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (pointerId !== null || mode !== 'play') return;
    idle = 0;
    var c = catAt(e.clientX, e.clientY);
    if (!c) return;
    pointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    var from = { where: c.where, spot: c.spot };
    c.where = 'held'; c.face = 'surprised'; c.wake = 0.35;
    held = { cat: c, x: c.x, y: c.y, offX: c.x - e.clientX, offY: c.y - e.clientY, from: from };
    downAt = { x: e.clientX, y: e.clientY, t: time };
    Sound.pick(); buzz(8);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== pointerId || !held) return;
    idle = 0;
    // the cat lifts a little above the finger so it isn't hidden under it
    held.x = e.clientX + held.offX * 0.4;
    held.y = e.clientY + held.offY * 0.4 - L.catS * 0.25;
  });
  function release(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (!held) return;
    var h = held; held = null;
    var cat = h.cat;
    cat.x = h.x; cat.y = h.y;
    var moved = downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10;
    var cb = cubbyAt(e.clientX, e.clientY) || cubbyAt(h.x, h.y);
    if (cb && cb.kind === cat.kind && cb.cats.length < 3) { placeInCubby(cat, cb); return; }
    if (cb) {
      cb.shake = 0.45; Sound.nope(); cat.wig = 0.45; Sound.mrrp(0.15);
      // levels 2-4: a wrong cat wakes up that cubby and its cats go back on the belt.
      // level 5 on: it wakes up every cubby.
      if (level.n >= 5) {
        var woke = cubbies.filter(function (k) { return k.state === 'in' && k.cats.length && k.cats.length < 3; });
        woke.forEach(function (k, i) { k.shake = 0.45; emptyCubby(k, i * 0.12); });
        if (woke.length) say(woke.length > 1 ? 'Oh no! Everyone woke up!' : 'Oops! Everyone back on the belt!', 1.8);
      } else if (level.n >= 2 && cb.cats.length && cb.cats.length < 3) {
        emptyCubby(cb, 0);
        say('Oops! Everyone back on the belt!', 1.6);
      }
    }
    else if (!moved) { cat.wig = 0.4; Sound.mrrp(); showHintFor = cat; hintT = 0; }
    returnCat(cat, h.from);
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

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

  /* ---------- hints: a ghost paw shows where a cat goes ---------- */
  var showHintFor = null, hintT = 0;
  function hintTarget() {
    var cand = showHintFor && (showHintFor.where === 'belt' || showHintFor.where === 'mat') ? showHintFor : null;
    var list = cand ? [cand] : cats.filter(function (c) { return (c.where === 'mat' || (c.where === 'belt' && c.bx > L.beltX0 + L.catS * 0.6 && c.bx < L.beltX1 - L.catS)); });
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      for (var j = 0; j < cubbies.length; j++) {
        var cb = cubbies[j];
        if (cb.state === 'in' && cb.kind === c.kind && cb.cats.length < 3) return { cat: c, cb: cb };
      }
    }
    return null;
  }

  /* ---------- update ---------- */
  /* The belt stops bringing cats once enough have come to fill the level (goal x 3, plus a few spare).
     But cats sitting in half-full cubbies of other colours use up that allowance, and with four cubbies they
     can use up all of it: then nothing on the belt or the mat fits anywhere and no more cats come, so the
     level can't be finished. So whenever no waiting cat fits a cubby, the belt keeps bringing cats. */
  function loose() { return cats.filter(function (c) { return c.where !== 'cubby' && !(c.where === 'flying' && c.cubby); }); }
  function someCatFits() {
    var open = cubbies.filter(function (cb) { return cb.state !== 'leaving' && cb.cats.length < 3; }).map(function (cb) { return cb.kind; });
    return loose().some(function (c) { return open.indexOf(c.kind) >= 0; });
  }
  var beltOffset = 0;
  function update(dt) {
    time += dt;
    if (mode === 'ready') {
      readyT += dt;
      if (readyT > 1.2) {
        mode = 'play';
        // start with a few cats already riding along, so there's something to do straight away
        var x = L.beltX0 + Math.min((L.beltX1 - L.beltX0) * 0.55, L.catS * (0.6 + level.gap * 2.2));
        // the first three are one of each cubby's colour, in a random order
        var opening = shuffle(shownKinds().slice()).slice(0, 3);
        for (var k = 0; k < 3; k++) { spawnCat(opening[k]); cats[cats.length - 1].bx = x; x -= rand(level.gap, level.gap * 1.3) * L.catS; }
        spawnDist = 0; nextGap = rand(level.gap, level.gap * 1.3);
      }
    }
    var playing = mode === 'play';
    var v = playing ? beltSpeed() : 0;
    beltOffset = (beltOffset + v * dt) % (L.catS * 0.5);
    if (!held && playing) idle += dt;

    if (playing && (tucked + cats.filter(function (c) { return c.where !== 'cubby'; }).length < level.goal * 3 + 4 || !someCatFits())) {
      spawnDist += v * dt;
      // wait for a clear space at the start of the belt (cats sent back from cubbies can be sitting there)
      var startClear = !cats.some(function (c) { return (c.where === 'belt' || (c.where === 'flying' && c.returning)) && c.bx < L.beltX0 + L.catS * 0.85 && c.bx > L.beltX0 - L.catS * 2; });
      if (spawnDist >= nextGap * L.catS && startClear) {
        spawnDist = 0;
        nextGap = rand(level.gap, level.gap * 1.3);
        spawnCat();
      }
    }

    // cats on the belt move along; at the end they hop onto the mat
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      if (c.where === 'belt' || c.where === 'held' || (c.where === 'flying' && c.returning)) c.bx += v * dt;
      if (c.where === 'belt') {
        c.x = c.bx; c.y = L.beltY - L.catS * 0.12;
        if (playing && c.bx > L.beltX1 - L.catS * 0.55) {
          var spot = freeMatSpot();
          if (spot < 0) { c.bx = L.beltX1 - L.catS * 0.55; tooFull(); break; }
          mat[spot] = c; c.spot = spot;
          Sound.boing();
          fly(c, L.matX[spot], L.matY, 0.45, L.catS * 0.9, (function (cc, sp) { return function () { cc.where = 'mat'; cc.spot = sp; }; })(c, spot));
          if (matCount() === MAT_SPOTS - 1) say('The mat is nearly full!', 1.8);
        }
      }
      if (c.fly) {
        c.fly.t += dt;
        var p = Math.min(1, c.fly.t / c.fly.dur);
        var tx = c.returning ? c.bx : c.fly.x1;
        var q = easeInOut(p);
        c.x = lerp(c.fly.x0, tx, q);
        c.y = lerp(c.fly.y0, c.fly.y1, q) - Math.sin(p * Math.PI) * c.fly.arc;
        if (p >= 1) { var done = c.fly.done; c.fly = null; c.land = 0; if (done) done(); }
      }
      if (c.land !== undefined && c.land < 1) c.land = Math.min(1, c.land + dt * 3.5);
      if (c.wig > 0) c.wig = Math.max(0, c.wig - dt);
      if (c.wake > 0) { c.wake -= dt; if (c.wake <= 0 && mode === 'play') c.face = 'blink'; }
      c.zT += dt;
    }
    if (held) { held.cat.x = held.x; held.cat.y = held.y; }

    // cubbies arriving and leaving
    cubbies.forEach(function (cb, idx) {
      if (cb.shake > 0) cb.shake = Math.max(0, cb.shake - dt);
      if (cb.glow > 0 && cb.state === 'in' && mode !== 'won') cb.glow = Math.max(0.6, cb.glow - dt * 0.5);
      if (cb.state === 'entering') {
        cb.t += dt;
        var p = clamp(cb.t / 0.55, 0, 1);
        var home = L.cubPos[idx];
        cb.x = home.x;
        cb.y = lerp(home.y - L.cubH * 1.6, home.y, easeBack(p));
        if (p >= 1) { cb.state = 'in'; cb.y = home.y; }
      } else if (cb.state === 'leaving') {
        cb.t += dt;
        var pl = clamp(cb.t / 0.5, 0, 1);
        cb.y = lerp(L.cubPos[idx].y, L.cubPos[idx].y - L.cubH * 2, pl * pl);
        cb.cats.forEach(function (c, s) { var sp = slotPos(cb, s); c.x = sp.x; c.y = sp.y; });
        if (pl >= 1) {
          cats = cats.filter(function (c) { return cb.cats.indexOf(c) < 0; });
          var fresh = makeCubby(idx, pickCubbyKind(), true);
          cubbies[idx] = fresh;
          if (mode === 'play') Sound.boing();
        }
      }
    });

    // particles
    for (var j = parts.length - 1; j >= 0; j--) {
      var pp = parts[j]; pp.life += dt;
      if (pp.life >= pp.max) { parts.splice(j, 1); continue; }
      pp.vy += 420 * dt; pp.vx *= 0.97; pp.x += pp.vx * dt; pp.y += pp.vy * dt;
    }
    if (showHintFor) { hintT += dt; if (hintT > 2.6) showHintFor = null; }
  }

  /* ---------- drawing ---------- */
  function drawCubby(c, cb) {
    var r = cubbyRect(cb);
    var sx = cb.shake > 0 ? Math.sin(cb.shake * 50) * L.cubW * 0.03 * (cb.shake / 0.45) : 0;
    c.save();
    c.translate(sx, 0);
    var K = CATS[cb.kind];
    // glow when full
    if (cb.glow > 0) {
      c.save(); c.globalAlpha = cb.glow * (0.6 + Math.sin(time * 6) * 0.2);
      rr(c, r.x - 8, r.y - 8, r.w + 16, r.h + 16, L.cubW * 0.2); c.fillStyle = '#FFE58A'; c.fill(); c.restore();
    }
    // wooden frame on its ink base, with the inside panel, the cushion and the pips all inside it
    var inset = L.cubW * 0.08, ix = r.x + inset, iy = r.y + inset * 1.9, iw = r.w - inset * 2, ih = r.h - inset * 2.9;
    rr(c, r.x, r.y + 5, r.w, r.h, L.cubW * 0.14); c.fillStyle = INK; c.fill();
    D.shape(c, D.rrPath(r.x, r.y, r.w, r.h, L.cubW * 0.14), D.tone(c, '#E6B98A', r.y, r.y + r.h), { lw: LW.mid, depth: L.cubW * 0.04, inside: function (c) {
      // the inside, a little shadowed under the top of the frame
      D.shape(c, D.rrPath(ix, iy, iw, ih, L.cubW * 0.1), '#FFF3E4', { lw: LW.fine, depth: L.cubW * 0.05, dx: L.cubW * 0.035, dy: L.cubW * 0.05, shade: 'rgba(42,35,64,.08)', inside: function (c) {
        // a cushion in the cubby's colour, resting on the floor of the cubby
        D.shape(c, D.ellPath(cb.x, r.y + r.h * 0.8, r.w * 0.4, r.h * 0.11), D.tone(c, K.fill, r.y + r.h * 0.69, r.y + r.h * 0.91), { lw: LW.fine, depth: r.h * 0.04,
          shine: [cb.x - r.w * 0.06, r.y + r.h * 0.765, r.w * 0.22, r.h * 0.03, 0, 0.4] });
      } });
      // three little pips on the frame, filled in as cats arrive
      for (var s = 0; s < 3; s++) {
        var px = cb.x + (s - 1) * L.cubW * 0.16, py = r.y + r.h - inset * 0.5;
        D.shape(c, D.ellPath(px, py, Math.max(3.5, L.cubW * 0.035), Math.max(3.5, L.cubW * 0.035)), cb.cats[s] && cb.cats[s].where === 'cubby' ? K.fill : '#FFF3E4', { lw: 2.5, depth: 0 });
      }
    } });
    // name tag with the cat's face, hanging on the top edge
    var tagR = L.cubW * 0.16, ty = r.y + inset * 0.6;
    D.shape(c, D.ellPath(cb.x, ty, tagR, tagR), '#FFFFFF', { lw: LW.fine, depth: tagR * 0.12, inside: function (c) {
      blit(c, headSprites, cb.kind, 'open', cb.x, ty, tagR * 1.55);
    } });
    c.restore();
  }

  function drawCubbyCats(c, cb) {
    var sx = cb.shake > 0 ? Math.sin(cb.shake * 50) * L.cubW * 0.03 * (cb.shake / 0.45) : 0;
    cb.cats.forEach(function (cat) {
      if (cat.where !== 'cubby') return;
      var sz = L.cubW * 0.34;
      var bob = cat.face === 'happy' ? Math.abs(Math.sin(time * 7 + cat.id)) * sz * 0.1 : Math.sin(time * 1.6 + cat.id) * sz * 0.02;
      var sq = cat.land < 1 ? Math.sin(cat.land * Math.PI) * (1 - cat.land) * 0.3 : 0;
      c.save(); c.translate(cat.x + sx, cat.y - bob); c.scale(1 + sq, 1 - sq);
      blit(c, headSprites, cat.kind, cat.face, 0, 0, sz);
      c.restore();
    });
  }

  function drawMat(c) {
    var w = L.spotGap * MAT_SPOTS + L.catS * 0.3, h = L.matH * 0.62;
    var x = (L.beltX0 + L.beltX1) / 2 - w / 2, y = L.matY - h / 2 + L.catS * 0.22;
    var full = matCount();
    rr(c, x, y + 4, w, h, h / 2); c.fillStyle = INK; c.fill();
    D.shape(c, D.rrPath(x, y, w, h, h / 2), D.tone(c, full >= MAT_SPOTS - 1 ? '#FFD2C8' : '#D8F0D5', y, y + h), { lw: LW.fine, depth: h * 0.1, inside: function (c) {
      // a stitched edge, and soft dents where the cats go
      c.save(); c.setLineDash([6, 6]); c.lineWidth = 2; c.strokeStyle = 'rgba(42,35,64,.3)';
      rr(c, x + 7, y + 7, w - 14, h - 14, (h - 14) / 2); c.stroke(); c.restore();
      for (var i = 0; i < MAT_SPOTS; i++) {
        if (mat[i]) continue;
        c.beginPath(); c.ellipse(L.matX[i], L.matY + L.catS * 0.22, L.catS * 0.3, L.catS * 0.12, 0, 0, TAU);
        c.fillStyle = 'rgba(42,35,64,.08)'; c.fill();
      }
    } });
  }

  function drawBelt(c) {
    var y = L.beltY, h = L.beltH * 0.42;
    var top = y + L.catS * 0.18;
    var x0 = L.beltX0 - L.catS * 0.3, x1 = L.beltX1 + L.catS * 0.05, bw = x1 - x0;
    // legs, tucked up under the belt (drawn first, so the belt covers their tops)
    for (var lx = x0 + L.catS * 0.6; lx < x1 - L.catS * 0.3; lx += L.catS * 2.2) D.shape(c, D.rrPath(lx, top + h - 6, 10, L.beltH * 0.5 + 2, 4), '#9C8FB3', { lw: 0, depth: 3 });
    // belt body on its ink base; the moving stripes and the rollers sit inside it
    rr(c, x0, top + 4, bw, h, h / 2); c.fillStyle = INK; c.fill();
    D.shape(c, D.rrPath(x0, top, bw, h, h / 2), D.tone(c, '#6E6487', top, top + h), { lw: LW.mid, depth: 0, inside: function (c) {
      c.save();
      rr(c, x0 + 4, top + 5, bw - 8, h * 0.45, h * 0.2); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = L.catS * 0.08;
      var step = L.catS * 0.5;
      for (var sx = x0 - step + beltOffset; sx < x1 + step; sx += step) { c.beginPath(); c.moveTo(sx, top); c.lineTo(sx - h * 0.4, top + h); c.stroke(); }
      c.restore();
      for (var rx = x0 + L.catS * 0.5; rx < x1 - L.catS * 0.2; rx += L.catS * 1.2) {
        c.save(); c.translate(rx, top + h * 0.72); c.rotate((beltOffset / (L.catS * 0.5)) * TAU);
        D.shape(c, D.ellPath(0, 0, h * 0.18, h * 0.18), '#B9AED0', { lw: 2.5, depth: 0, inside: function (c) {
          c.beginPath(); c.moveTo(-h * 0.2, 0); c.lineTo(h * 0.2, 0); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
        } });
        c.restore();
      }
    } });
  }

  /* The little house at the start of the belt that cats come out of (drawn over the cats). */
  function drawCatDoor(c) {
    var s = L.catS;
    var w = s * 0.92, h = s * 1.05;
    var x = L.beltX0 - s * 0.5, y = L.beltY + s * 0.18 + L.beltH * 0.42 - h - 2;
    // house on its ink base, with the round doorway (facing the belt) inside its wall
    rr(c, x, y + 4, w, h, s * 0.12); c.fillStyle = INK; c.fill();
    D.shape(c, D.rrPath(x, y, w, h, s * 0.12), D.tone(c, '#F2C38E', y, y + h), { lw: LW.mid, depth: s * 0.06, inside: function (c) {
      D.shape(c, function (p) { p.moveTo(x + w * 0.56, y + h + 4); p.lineTo(x + w * 0.56, y + h * 0.5); p.arc(x + w * 0.76, y + h * 0.5, w * 0.2, Math.PI, 0); p.lineTo(x + w * 0.96, y + h + 4); p.closePath(); }, '#5B4E78', { lw: LW.fine, depth: 0 });
    } });
    // roof on top
    D.shape(c, function (p) { p.moveTo(x - s * 0.1, y + s * 0.08); p.lineTo(x + w / 2, y - s * 0.32); p.lineTo(x + w + s * 0.1, y + s * 0.08); p.closePath(); }, D.tone(c, '#FF8FAB', y - s * 0.32, y + s * 0.08), { lw: LW.mid, depth: s * 0.05 });
  }

  function drawBeltCat(c2, cat) {
    var s = L.catS;
    var x = cat.x, y = cat.y, sc = 1, rot = 0;
    if (cat.where === 'held') { sc = 1.18; rot = Math.sin(time * 9) * 0.05; }
    if (cat.where === 'flying') sc = cat.cubby ? lerp(1.08, 0.62, easeOut(cat.fly ? cat.fly.t / cat.fly.dur : 1)) : 1.08;
    if (cat.wig > 0) rot += Math.sin(cat.wig * 40) * 0.15 * (cat.wig / 0.45);
    var sqx = 1, sqy = 1;
    if (cat.land !== undefined && cat.land < 1 && !reduceMotion) { var kk = Math.sin(cat.land * Math.PI) * (1 - cat.land); sqx = 1 + kk * 0.3; sqy = 1 - kk * 0.3; }
    // shadow
    c2.save();
    c2.beginPath(); c2.ellipse(x, (cat.where === 'held' ? y + s * 0.75 : y + s * 0.42), s * 0.45 * (cat.where === 'held' ? 0.8 : 1), s * 0.1, 0, 0, TAU);
    c2.fillStyle = 'rgba(42,35,64,' + (cat.where === 'held' ? 0.12 : 0.2) + ')'; c2.fill();
    c2.restore();
    c2.save();
    c2.translate(x, y); c2.rotate(rot); c2.scale(sc * sqx, sc * sqy);
    blit(c2, bedSprites, cat.kind, cat.face, 0, 0, s);
    c2.restore();
    // little z's drifting up from sleepy cats
    if (cat.face === 'blink' && (cat.where === 'belt' || cat.where === 'mat') && !reduceMotion) {
      var ph = (cat.zT * 0.45) % 1;
      c2.save(); c2.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
      c2.font = '800 ' + Math.round(s * 0.24) + 'px "Baloo 2", ui-rounded, sans-serif';
      c2.fillStyle = '#6E6080'; c2.fillText('z', x + s * 0.25 + ph * s * 0.2, y - s * 0.3 - ph * s * 0.35);
      c2.restore();
    }
  }

  function drawHint(c) {
    var h = null;
    if (showHintFor) h = hintTarget();
    else if (mode === 'play' && !held && idle > 4) h = hintTarget();
    if (!h) return;
    var t = ((showHintFor ? hintT : idle - 4) % 1.6) / 1.2;
    if (t > 1) return;
    var q = easeInOut(t);
    var x = lerp(h.cat.x, h.cb.x, q), y = lerp(h.cat.y, h.cb.y + L.cubH * 0.15, q) - Math.sin(q * Math.PI) * L.catS * 0.6;
    c.save();
    c.globalAlpha = Math.sin(t * Math.PI) * 0.85;
    c.beginPath(); c.arc(x, y, L.catS * 0.3, 0, TAU); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
    // a paw
    c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.ellipse(x, y + L.catS * 0.05, L.catS * 0.14, L.catS * 0.12, 0, 0, TAU); c.fill(); c.stroke();
    [-1.1, -0.38, 0.38, 1.1].forEach(function (a, i) {
      c.beginPath(); c.arc(x + Math.sin(a * 0.9) * L.catS * 0.17, y - L.catS * (i === 0 || i === 3 ? 0.06 : 0.13), L.catS * 0.055, 0, TAU); c.fill(); c.stroke();
    });
    c.restore();
  }

  function drawParts(c) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y); c.rotate(p.life * p.spin);
      if (p.star) star(c, p.r * 1.4); else { c.beginPath(); c.arc(0, 0, p.r, 0, TAU); }
      c.fillStyle = p.color; c.fill();
      c.restore();
    }
  }

  /* ---------- main loop ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (level) update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (level) {
      cubbies.forEach(function (cb) { drawCubby(ctx, cb); });
      cubbies.forEach(function (cb) { drawCubbyCats(ctx, cb); });
      drawMat(ctx);
      drawBelt(ctx);
      // cats come out of the cat house: nothing of them shows to the left of it
      cats.forEach(function (cat) { if (cat.where === 'mat') drawBeltCat(ctx, cat); });
      ctx.save(); ctx.beginPath(); ctx.rect(L.beltX0 - L.catS * 0.45, 0, cw, ch); ctx.clip();
      cats.forEach(function (cat) { if (cat.where === 'belt') drawBeltCat(ctx, cat); });
      ctx.restore();
      drawCatDoor(ctx);
      cats.forEach(function (cat) { if (cat.where === 'flying') drawBeltCat(ctx, cat); });
      drawHint(ctx);
      if (held) drawBeltCat(ctx, held.cat);
      drawParts(ctx);
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  $('tallyImg').src = catImageURL(1, 'blink', 64);
  layout();
  startLevel(progress().level);
  requestAnimationFrame(frame);

  /* test hook for automated checks */
  window.__cubbies = {
    state: function () {
      return { mode: mode, tucked: tucked, filled: filled, goal: level.goal, n: level.n, mat: mat.map(function (c) { return c ? c.kind : -1; }),
        matX: L.matX.slice(), matY: L.matY, matReady: mat.map(function (c) { return !!c && c.where === 'mat'; }),
        cubbies: cubbies.map(function (cb) { return { kind: cb.kind, n: cb.cats.length, state: cb.state, x: cb.x, y: cb.y }; }),
        belt: cats.filter(function (c) { return c.where === 'belt'; }).map(function (c) { return { kind: c.kind, x: c.x, y: c.y }; }) };
    },
    start: function (n) { startLevel(n); },
    fill: function (k) { for (var i = 0; i < MAT_SPOTS; i++) if (!mat[i]) { var c = newCat(k); c.where = 'mat'; c.spot = i; c.x = L.matX[i]; c.y = L.matY; mat[i] = c; cats.push(c); } },
    tuckAlmost: function () { filled = level.goal - 1; renderTally(false); }
  };
})();
