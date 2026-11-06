/* Kitten Kitchen – a toddler game. Pick a pizza, a stack of pancakes or a birthday cake, then pick a topping from
   the tray and tap (or drag) on the food to put it on. Ring the bell and your cat gets it: a cake with candles gets
   the birthday tune and the candles are blown out (tap the flames to help), then the cat has a happy munch and a
   new plate comes. No words, no counters, nothing to get wrong. Saves a count to GG.setProgress('kittenkitchen'). */
(function () {
  'use strict';

  var INK = '#2A2340';
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeBack(t) { t = clamp(t, 0, 1); var s = 1.9; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ink(c, w) { c.lineWidth = w || 4; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function fillInk(c, col, w) { c.fillStyle = col; c.fill(); ink(c, w || 4); }
  function seeded(seed) { var s = Math.floor(seed * 2147483646) + 1; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function heartPath(c, r) { c.beginPath(); c.moveTo(0, r * 0.75); c.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.4); c.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.3, -r * 0.1, 0, r * 0.75); c.closePath(); }
  function blob(c, r, seed, n) {
    var R = seeded(seed); n = n || 9; var pts = [];
    for (var i = 0; i < n; i++) { var a = i / n * TAU, q = r * (0.78 + R() * 0.3); pts.push([Math.cos(a) * q, Math.sin(a) * q]); }
    c.beginPath();
    for (var j = 0; j < n; j++) { var p0 = pts[j], p1 = pts[(j + 1) % n], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2; if (j === 0) c.moveTo(mx, my); else c.quadraticCurveTo(p0[0], p0[1], mx, my); }
    var f = pts[0], s = pts[1]; c.quadraticCurveTo(f[0], f[1], (f[0] + s[0]) / 2, (f[1] + s[1]) / 2); c.closePath();
  }

  /* ================= saved count ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('kittenkitchen') || {}; } catch (e) {} if (typeof p.made !== 'number') p.made = 0; return p; })();
  function save() { try { GG.setProgress('kittenkitchen', P); } catch (e) {} }

  /* ================= the toppings (design units: the food is about 400 across) ================= */
  var CANDLE_COLS = ['#FF8FAB', '#7CC4FF', '#7BD389', '#B48CFF', '#FFD23F'];
  var SPRINKLE_COLS = ['#FF5C8A', '#7CC4FF', '#FFD23F', '#7BD389', '#B48CFF', '#FF9A2E'];
  function strawberry(c) {
    c.beginPath(); c.moveTo(0, 22); c.bezierCurveTo(-26, 4, -24, -18, 0, -14); c.bezierCurveTo(24, -18, 26, 4, 0, 22); c.closePath(); fillInk(c, '#FF4F6D', 3.5);
    c.fillStyle = '#FFE27A'; [[-8, -4], [8, -4], [0, 4], [-6, 10], [6, 10], [0, -8]].forEach(function (q) { ell(c, q[0], q[1], 1.8, 2.6); c.fill(); });
    c.beginPath(); c.moveTo(-12, -16); c.lineTo(-4, -12); c.lineTo(0, -20); c.lineTo(4, -12); c.lineTo(12, -16); c.lineTo(6, -9); c.lineTo(-6, -9); c.closePath(); fillInk(c, '#4DB36A', 2.5);
  }
  var TOPS = {
    // pizza
    sauce: { clip: true, gap: 30, draw: function (c, t) { blob(c, 46, t.seed, 10); c.fillStyle = '#E0452F'; c.fill(); blob(c, 30, t.seed + 0.3, 8); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill(); } },
    cheese: { clip: true, gap: 30, draw: function (c, t) {
      var R = seeded(t.seed);
      for (var i = 0; i < 8; i++) {
        var a = R() * TAU, d = R() * 30, x = Math.cos(a) * d, y = Math.sin(a) * d, r = R() * TAU;
        c.save(); c.translate(x, y); c.rotate(r);
        c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.lineCap = 'round'; c.lineWidth = 11; c.strokeStyle = INK; c.stroke(); c.lineWidth = 6.5; c.strokeStyle = '#FFD54A'; c.stroke();
        c.restore();
      }
    } },
    pepperoni: { draw: function (c) { circle(c, 0, 0, 24); fillInk(c, '#D9473A', 3.5); c.fillStyle = '#A92F27'; [[-9, -7], [8, -9], [2, 8], [-10, 9], [11, 5]].forEach(function (q) { circle(c, q[0], q[1], 3.2); c.fill(); }); } },
    mushroom: { draw: function (c) {
      c.beginPath(); c.moveTo(-26, 2); c.bezierCurveTo(-26, -24, 26, -24, 26, 2); c.quadraticCurveTo(14, 4, 9, 2); c.lineTo(9, 18); c.quadraticCurveTo(0, 24, -9, 18); c.lineTo(-9, 2); c.quadraticCurveTo(-14, 4, -26, 2); c.closePath();
      fillInk(c, '#F3E6D2', 3.5);
      c.beginPath(); c.moveTo(-26, 2); c.bezierCurveTo(-26, -24, 26, -24, 26, 2); c.quadraticCurveTo(0, -4, -26, 2); c.closePath(); fillInk(c, '#B98458', 3.5);
    } },
    olive: { draw: function (c) { circle(c, 0, 0, 14); c.lineWidth = 15; c.strokeStyle = INK; c.stroke(); c.lineWidth = 9; c.strokeStyle = '#4A4361'; c.stroke(); } },
    basil: { draw: function (c) {
      c.beginPath(); c.moveTo(-26, 4); c.quadraticCurveTo(-4, -26, 26, -4); c.quadraticCurveTo(4, 26, -26, 4); c.closePath(); fillInk(c, '#3FAE5E', 3.5);
      c.beginPath(); c.moveTo(-22, 4); c.quadraticCurveTo(0, 0, 22, -4); c.strokeStyle = '#2C8A47'; c.lineWidth = 2.5; c.stroke();
    } },
    // pancakes
    syrup: { clip: true, gap: 30, draw: function (c, t) {
      var R = seeded(t.seed);
      blob(c, 38, t.seed, 9); c.fillStyle = '#C8771C'; c.fill();
      for (var i = 0; i < 3; i++) { var x = -22 + i * 22 + R() * 8, l = 30 + R() * 34; rr(c, x - 7, 0, 14, l, 7); c.fill(); }
      ell(c, -12, -12, 12, 6, -0.4); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
    } },
    butter: { draw: function (c) { c.save(); c.rotate(-0.15); rr(c, -20, -16, 40, 32, 8); fillInk(c, '#FFE27A', 3.5); rr(c, -13, -10, 14, 6, 3); c.fillStyle = '#FFF6C8'; c.fill(); c.restore(); } },
    strawberry: { draw: strawberry },
    blueberry: { draw: function (c) {
      [[-11, 4], [11, 4], [0, -12]].forEach(function (q) { circle(c, q[0], q[1], 13); fillInk(c, '#4C6FFF', 3); c.save(); c.translate(q[0], q[1] - 3); star(c, 4.5); c.fillStyle = '#2A3B9E'; c.fill(); c.restore(); });
    } },
    banana: { draw: function (c) { circle(c, 0, 0, 19); fillInk(c, '#FFF1B0', 3.5); circle(c, 0, 0, 11); c.strokeStyle = '#F0D46A'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#B88A3A'; for (var i = 0; i < 3; i++) { var a = i / 3 * TAU + 0.5; circle(c, Math.cos(a) * 5, Math.sin(a) * 5, 1.8); c.fill(); } } },
    cream: { draw: function (c) {
      ell(c, 0, 10, 26, 13); fillInk(c, '#FFFFFF', 3.5);
      ell(c, 0, -2, 19, 11); fillInk(c, '#FFFFFF', 3.5);
      ell(c, 0, -12, 12, 8); fillInk(c, '#FFFFFF', 3.5);
      c.beginPath(); c.moveTo(-6, -17); c.quadraticCurveTo(0, -30, 4, -26); c.quadraticCurveTo(6, -20, 6, -16); c.closePath(); fillInk(c, '#FFFFFF', 3);
    } },
    // cake
    candle: { candle: true, gap: 999, draw: function (c, t) {
      var col = CANDLE_COLS[t.v % CANDLE_COLS.length];
      rr(c, -8, -72, 16, 72, 5); fillInk(c, col, 3.5);
      c.save(); rr(c, -8, -72, 16, 72, 5); c.clip(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 5; for (var y = -66; y < 8; y += 16) { c.beginPath(); c.moveTo(-10, y + 6); c.lineTo(10, y - 4); c.stroke(); } c.restore();
      c.beginPath(); c.moveTo(0, -72); c.lineTo(0, -80); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      if (t.lit) {
        var f = 1 + Math.sin(time * 14 + t.seed * 30) * 0.08, sw = Math.sin(time * 9 + t.seed * 20) * 2;
        c.save(); c.translate(0, -84); c.scale(f, 1 / f);
        c.beginPath(); c.moveTo(sw, -26); c.quadraticCurveTo(13, -6, 0, 4); c.quadraticCurveTo(-13, -6, sw, -26); c.closePath(); fillInk(c, '#FFC93C', 3);
        c.beginPath(); c.moveTo(sw * 0.6, -14); c.quadraticCurveTo(6, -2, 0, 2); c.quadraticCurveTo(-6, -2, sw * 0.6, -14); c.closePath(); c.fillStyle = '#FF7A2E'; c.fill();
        c.restore();
      }
    } },
    sprinkles: { gap: 34, draw: function (c, t) {
      var R = seeded(t.seed);
      for (var i = 0; i < 10; i++) { var a = R() * TAU, d = R() * 30; c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d); c.rotate(R() * TAU); rr(c, -7, -2.6, 14, 5.2, 2.6); c.fillStyle = SPRINKLE_COLS[Math.floor(R() * SPRINKLE_COLS.length)]; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke(); c.restore(); }
    } },
    cakeberry: { draw: strawberry },
    cherry: { draw: function (c) { c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(4, -28, 16, -32); ink(c, 3); ell(c, 14, -32, 7, 3.5, -0.4); fillInk(c, '#4DB36A', 2.5); circle(c, 0, 4, 16); fillInk(c, '#E2223C', 3.5); ell(c, -6, -2, 4, 6, 0.6); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill(); } },
    star: { draw: function (c) { star(c, 24); fillInk(c, '#FFD23F', 3.5); } },
    heart: { draw: function (c) { heartPath(c, 22); fillInk(c, '#FF8FAB', 3.5); } }
  };

  /* ================= the foods ================= */
  var FOODS = {
    pizza: { tops: ['sauce', 'cheese', 'pepperoni', 'mushroom', 'olive', 'basil'], h: [-200, 200] },
    pancakes: { tops: ['syrup', 'butter', 'strawberry', 'blueberry', 'banana', 'cream'], h: [-90, 140] },
    cake: { tops: ['candle', 'sprinkles', 'cakeberry', 'cherry', 'star', 'heart'], h: [-170, 150] }
  };
  var ORDER = ['pizza', 'pancakes', 'cake'];
  // the food's outline, used for clipping sauce and syrup and for "is this on the food?"
  function foodPath(c, kind, grow) {
    var g = grow || 0;
    if (kind === 'pizza') { circle(c, 0, 0, 152 + g); return; }
    c.beginPath();
    if (kind === 'pancakes') { c.ellipse(0, -27, 165 + g, 44 + g, 0, Math.PI, 0); c.lineTo(165 + g, 87); c.ellipse(0, 87, 165 + g, 44 + g, 0, 0, Math.PI); c.closePath(); return; }
    c.ellipse(0, -50, 150 + g, 36 + g, 0, Math.PI, 0); c.lineTo(150 + g, 100); c.ellipse(0, 100, 150 + g, 36 + g, 0, 0, Math.PI); c.closePath();
  }
  var hitCtx = document.createElement('canvas').getContext('2d');
  function onFood(kind, x, y, grow) { foodPath(hitCtx, kind, grow); return hitCtx.isPointInPath(x, y); }

  function drawPlate(c, y, rx, ry) { ell(c, 0, y, rx, ry); fillInk(c, '#FFFFFF', 4.5); ell(c, 0, y - 2, rx * 0.78, ry * 0.7); c.strokeStyle = '#E8E1EE'; c.lineWidth = 4; c.stroke(); }
  function drawFoodBase(c, kind) {
    if (kind === 'pizza') {
      circle(c, 0, 0, 196); fillInk(c, '#FFFFFF', 4.5); circle(c, 0, 0, 184); c.strokeStyle = '#E8E1EE'; c.lineWidth = 4; c.stroke();
      circle(c, 0, 0, 172); fillInk(c, '#E9A95B', 4.5);
      circle(c, 0, 0, 152); fillInk(c, '#FFD9A0', 3);
      c.fillStyle = 'rgba(176,112,50,.35)'; [[-150, 30], [120, -90], [40, 162], [-90, -138], [158, 50]].forEach(function (q) { var a = Math.atan2(q[1], q[0]); ell(c, Math.cos(a) * 162, Math.sin(a) * 162, 7, 4, a + Math.PI / 2); c.fill(); });
    } else if (kind === 'pancakes') {
      drawPlate(c, 110, 205, 46);
      [75, 35, -5].forEach(function (yc, i) {
        var top = yc - 22, bot = yc + 14;
        c.beginPath(); c.ellipse(0, top, 165, 44, 0, Math.PI, 0); c.lineTo(165, bot); c.ellipse(0, bot, 165, 44, 0, 0, Math.PI); c.closePath(); fillInk(c, '#D98E3E', 4);
        ell(c, 0, top, 165, 44); fillInk(c, i === 2 ? '#F5C27A' : '#E9A85A', 4);
        if (i === 2) { ell(c, -40, top - 6, 60, 14, -0.1); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill(); }
      });
    } else {
      drawPlate(c, 118, 205, 46);
      c.beginPath(); c.ellipse(0, -50, 150, 36, 0, Math.PI, 0); c.lineTo(150, 100); c.ellipse(0, 100, 150, 36, 0, 0, Math.PI); c.closePath(); fillInk(c, '#FFB3CB', 4.5);
      // a cream layer in the middle
      c.beginPath(); c.ellipse(0, 28, 150, 36, 0, 0, Math.PI); c.lineWidth = 12; c.strokeStyle = '#FFF4E6'; c.stroke();
      // icing on top, dripping down the front
      c.beginPath(); c.ellipse(0, -50, 150, 36, 0, Math.PI, 0);
      var drips = [[150, 0], [118, 22], [86, 8], [52, 34], [16, 12], [-20, 30], [-58, 10], [-92, 26], [-124, 8], [-150, 0]];
      drips.forEach(function (d) { var x = d[0], baseY = -50 + 36 * Math.sqrt(Math.max(0, 1 - (x / 150) * (x / 150))); c.lineTo(x, baseY + d[1]); });
      c.closePath(); fillInk(c, '#FFF8FB', 4);
    }
  }
  function fixCandle(x, y) {
    var cx = clamp(x, -122, 122), dy = 36 * Math.sqrt(1 - (cx / 150) * (cx / 150)) * 0.72;
    var cy = y > -50 + dy ? -50 + rand(-dy * 0.4, dy * 0.85) : clamp(y, -50 - dy, -50 + dy);
    return { x: cx, y: cy };
  }
  function drawToppings(c, kind, list) {
    c.save(); foodPath(c, kind); c.clip();
    list.forEach(function (t) { if (TOPS[t.id].clip) drawTop(c, t); });
    c.restore();
    list.forEach(function (t) { if (!TOPS[t.id].clip && !TOPS[t.id].candle) drawTop(c, t); });
    list.filter(function (t) { return TOPS[t.id].candle; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (t) { drawTop(c, t); });
  }
  function drawTop(c, t) {
    var s = t.age === undefined ? 1 : easeBack(t.age / 0.3);
    c.save(); c.translate(t.x, t.y); if (!TOPS[t.id].candle) c.rotate(t.rot || 0); c.scale(s, s);
    TOPS[t.id].draw(c, t);
    c.restore();
  }

  /* ================= tray buttons ================= */
  function topImg(id) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 140;
    var c = cv.getContext('2d'); c.translate(70, 70); c.lineJoin = 'round'; c.lineCap = 'round';
    var t = { id: id, x: 0, y: 0, seed: 0.37, v: 0, lit: true };
    if (TOPS[id].candle) { c.translate(0, 46); c.scale(1.15, 1.15); }
    else if (TOPS[id].clip) { circle(c, 0, 0, 58); c.fillStyle = id === 'syrup' ? '#F5C27A' : '#FFD9A0'; c.fill(); c.save(); circle(c, 0, 0, 58); c.clip(); c.scale(1.3, 1.3); if (id === 'syrup') c.translate(0, -14); TOPS[id].draw(c, t); c.restore(); circle(c, 0, 0, 58); ink(c, 4); return cv.toDataURL(); }
    else c.scale(2, 2);
    TOPS[id].draw(c, t); return cv.toDataURL();
  }
  var IMG = {}; Object.keys(TOPS).forEach(function (id) { IMG[id] = topImg(id); });
  var TOP_NAMES = { sauce: 'Tomato sauce', cheese: 'Cheese', pepperoni: 'Pepperoni', mushroom: 'Mushrooms', olive: 'Olives', basil: 'Basil leaves', syrup: 'Syrup', butter: 'Butter', strawberry: 'Strawberries', blueberry: 'Blueberries', banana: 'Banana', cream: 'Cream', candle: 'Candles', sprinkles: 'Sprinkles', cakeberry: 'Strawberries', cherry: 'Cherries', star: 'Stars', heart: 'Hearts' };
  var tray = $('tray'), bell = $('bell'), foodsBtn = $('foodsBtn'), topbar = $('topbar');
  var sel = null;
  function renderTray() {
    if (!food) { tray.hidden = true; return; }
    tray.hidden = false;
    tray.innerHTML = FOODS[food.kind].tops.map(function (id) {
      return '<button class="top" type="button" data-top="' + id + '" aria-label="' + TOP_NAMES[id] + '" aria-pressed="' + (id === sel) + '"><img alt="" src="' + IMG[id] + '"></button>';
    }).join('');
  }
  tray.addEventListener('click', function (e) {
    var b = e.target.closest('[data-top]'); if (!b) return;
    Sound.init(); Sound.pop(); sel = b.dataset.top;
    tray.querySelectorAll('.top').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.top === sel)); });
  });

  /* ================= your cat ================= */
  var CAT = { preset: 'ginger' };
  function catSetup() {
    var p = null;
    try { p = GG.current ? GG.current() : null; } catch (e) {}
    if (!p || !window.GGAvatar) { CAT = { preset: 'ginger' }; return; }
    var av = GGAvatar.normalise(p.avatar, p.color);
    CAT = { color: av.type === 'calico' ? '#FFFFFF' : av.type === 'tuxedo' ? '#3D3650' : av.color,
      build: av.type === 'chubby' || av.type === 'fluffy' ? av.type : 'short',
      markings: av.type === 'tabby' || av.type === 'calico' || av.type === 'tuxedo' ? av.type : 'none' };
  }
  catSetup();
  window.addEventListener('gg-change', catSetup);
  var cat = { happy: 0, blink: 3, hop: 0 };

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 640, tall = false;
  var L = {};   // food origin and scale, cat spot, picker spots
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6, bottom = (tray.hidden ? ch - 10 : tray.getBoundingClientRect().top - 8);
    var aw = cw - 16, ah = Math.max(120, bottom - top);
    tall = aw / ah < 1.05;
    W = tall ? 600 : 1000; H = tall ? clamp(Math.round(600 * ah / aw), 640, 1000) : clamp(Math.round(1000 * ah / aw), 520, 720);
    K = Math.min(aw / W, ah / H);
    OX = (cw - W * K) / 2; OY = top + (ah - H * K) / 2;
    if (tall) {
      var feet = Math.max(220, H * 0.27);
      L.cat = { x: 120, y: feet, s: 118 };
      L.shelf = { x0: 30, x1: 230, y: feet };
      var room = H - feet - 30;
      L.fs = Math.min(W * 0.86 / 400, room / 340);
      L.fx = W / 2; L.fy = feet + 30 + room / 2 - L.fs * ((FOODS[food ? food.kind : 'cake'].h[0] + FOODS[food ? food.kind : 'cake'].h[1]) / 2) + 6;
      L.counter = H - 70;
      L.picks = [{ x: W * 0.28, y: H * 0.47 }, { x: W * 0.72, y: H * 0.47 }, { x: W * 0.5, y: H * 0.77 }]; L.ps = 0.6;
    } else {
      L.counter = H - 90;
      L.cat = { x: W * 0.15, y: L.counter + 16, s: 128 };
      L.shelf = null;
      var fk = FOODS[food ? food.kind : 'cake'];
      L.fs = Math.min(1.25, (H - 90) / (fk.h[1] - fk.h[0]), (W * 0.62) / 420);
      L.fx = W * 0.56; L.fy = Math.min(L.counter + 30 - fk.h[1] * L.fs, (H + 40) / 2 - (fk.h[0] + fk.h[1]) / 2 * L.fs);
      L.picks = [{ x: W * 0.2, y: H * 0.52 }, { x: W * 0.5, y: H * 0.52 }, { x: W * 0.8, y: H * 0.52 }]; L.ps = Math.min(0.7, (H * 0.55) / 360);
    }
    // the bell: bottom-right of the room on wide screens, top-right on tall ones (out of the food's way)
    var bw = bell.offsetWidth || 96;
    bell.style.right = Math.max(14, cw - (OX + W * K) + 14) + 'px';
    if (tall) { bell.style.top = (OY + 14) + 'px'; bell.style.bottom = 'auto'; }
    else { bell.style.top = 'auto'; bell.style.bottom = (ch - (OY + H * K) + 14) + 'px'; }
    void bw;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }
  function toFood(p) { return { x: (p.x - L.fx) / L.fs, y: (p.y - L.fy) / L.fs }; }

  /* ================= state ================= */
  // mode: 'pick' (choose a food), 'make' (decorate), 'serve' (the cat gets it)
  var mode = 'pick', food = null, time = 0, parts = [], held = null, pickIn = 0;
  var SAMPLES = {
    pizza: [['sauce', -50, -40], ['sauce', 50, 30], ['sauce', 40, -60], ['sauce', -60, 60], ['sauce', 0, 0], ['sauce', -100, 0], ['sauce', 100, -10], ['sauce', 0, 100], ['sauce', 0, -100], ['cheese', -40, -30], ['cheese', 50, 40], ['cheese', -50, 70], ['cheese', 60, -60], ['pepperoni', -60, -60], ['pepperoni', 70, 10], ['pepperoni', -10, 70], ['basil', 10, -20]],
    pancakes: [['syrup', 10, -40], ['butter', 0, -40], ['strawberry', -80, -30], ['blueberry', 80, -26]],
    cake: [['candle', -60, -50], ['candle', 0, -66], ['candle', 60, -48], ['sprinkles', -70, 40], ['sprinkles', 70, 50], ['heart', 0, 60]]
  };
  function sampleList(kind) { return SAMPLES[kind].map(function (q, i) { return { id: q[0], x: q[1], y: q[2], seed: (i * 0.137 + 0.21) % 1, v: i, lit: true, rot: 0 }; }); }
  var picks = ORDER.map(function (k) { return { kind: k, tops: sampleList(k), wig: 0 }; });

  function startFood(kind) {
    if (window.GG && GG.track) GG.track('Pick food', { game: 'kitten-kitchen', food: kind });
    food = { kind: kind, tops: [], t: 0, slide: 0, out: 0 };
    sel = FOODS[kind].tops[kind === 'pizza' ? 0 : kind === 'cake' ? 0 : 2];
    mode = 'make'; cat.hop = 0.6;
    renderTray(); tray.classList.remove('off');
    foodsBtn.hidden = false; bell.hidden = true; bell.classList.remove('ready');
    layout();
    Sound.pick(); Sound.mrrp();
  }
  function backToPick() {
    food = null; mode = 'pick'; pickIn = 0; held = null;
    renderTray(); foodsBtn.hidden = true; bell.hidden = true;
    layout();
  }
  foodsBtn.addEventListener('click', function () { Sound.init(); Sound.pop(); backToPick(); });

  var candleN = 0;
  function addTop(fp) {
    var def = TOPS[sel];
    var t = { id: sel, x: fp.x, y: fp.y, seed: Math.random(), v: 0, rot: def.clip ? rand(0, TAU) : rand(-0.5, 0.5), age: 0, lit: true };
    if (def.candle) {
      var q = fixCandle(fp.x, fp.y); t.x = q.x; t.y = q.y; t.v = candleN++;
      var candles = food.tops.filter(function (o) { return TOPS[o.id].candle; });
      if (candles.length >= 7) food.tops.splice(food.tops.indexOf(candles[0]), 1);
    }
    food.tops.push(t);
    if (food.tops.length > 120) food.tops.shift();
    if (def.clip) Sound.squish(); else if (def.candle) Sound.ting(); else Sound.plop();
    buzz(8);
    cat.happy = Math.max(cat.happy, 0.5);
    if (!def.clip && Math.random() < 0.5) sparkle(L.fx + t.x * L.fs, L.fy + t.y * L.fs, '#FFD23F', 4, 0.5);
    bell.hidden = false;
    bell.classList.toggle('ready', food.tops.length >= 5);
  }

  /* ================= serving ================= */
  var NOTES = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
  var TUNE = [['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2], ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2]];
  var BEAT = 0.3;
  function tuneLength() { return TUNE.reduce(function (s, n) { return s + n[1]; }, 0) * BEAT; }
  function litCandles() { return food.tops.filter(function (t) { return TOPS[t.id].candle && t.lit; }); }
  bell.addEventListener('click', function () {
    if (mode !== 'make' || !food) return;
    Sound.init(); Sound.ding(); buzz(15);
    mode = 'serve'; food.t = 0; held = null;
    if (window.GG && GG.track) GG.track('Serve food', { game: 'kitten-kitchen', food: food.kind, toppings: Math.min(food.tops.length, 50) });
    tray.classList.add('off'); bell.hidden = true;
    cat.happy = 1.2; cat.hop = 0.6; heart(L.cat.x, L.cat.y - L.cat.s * 2);
    var cake = food.kind === 'cake' && litCandles().length;
    food.sing = cake ? 0.5 : -1;
    food.blowAt = cake ? 0.5 + tuneLength() + 0.3 : -1;
    food.cheerAt = cake ? -1 : 0.4;
    food.eatAt = cake ? -1 : 1.4;
    food.blown = false; food.cheered = false; food.munch = 0;
  });
  function blowOut(t, puff) {
    if (!t.lit) return;
    t.lit = false;
    var x = L.fx + t.x * L.fs, y = L.fy + (t.y - 100) * L.fs;
    for (var i = 0; i < (reduceMotion ? 2 : 5); i++) parts.push({ x: x + rand(-4, 4), y: y, vx: rand(-14, 14), vy: rand(-60, -30), life: 0, max: rand(0.9, 1.4), r: rand(6, 10), kind: 'smoke', g: -10 });
    if (puff) Sound.puff();
  }
  function cheer() {
    if (food.cheered) return; food.cheered = true;
    Sound.chime(); buzz(25);
    var cols = ['#FFD23F', '#FF8FAB', '#7CC4FF', '#7BD389', '#B48CFF'];
    for (var i = 0; i < (reduceMotion ? 12 : 46); i++) parts.push({ x: rand(0, W), y: rand(-40, 0), vx: rand(-40, 40), vy: rand(80, 220), life: 0, max: rand(1.8, 2.6), r: rand(6, 10), color: pick(cols), kind: 'confetti', spin: rand(-8, 8), g: 40 });
    sparkle(L.fx, L.fy - 60 * L.fs, '#FFD23F', 14, 1.4);
    cat.happy = 1.4; cat.hop = 0.6;
    P.made++; save(); if (GG.stat) GG.stat('kittenkitchen', 'made', 1);
  }
  function updateServe(dt) {
    var f = food; f.t += dt;
    if (f.sing >= 0 && f.t >= f.sing) { Sound.tune(); f.sing = -1; }
    if (f.blowAt >= 0) {
      if (!litCandles().length && f.t < f.blowAt - 0.2 && f.t > 0.6) f.blowAt = f.t + 0.2;   // the toddler blew them all out already
      if (f.t >= f.blowAt - 0.5 && !f.blowing) { f.blowing = true; Sound.whoosh(); }
      if (f.t >= f.blowAt) {
        var lit = litCandles();
        if (lit.length && f.t - (f.lastBlow || 0) > 0.08) { blowOut(lit[0], false); f.lastBlow = f.t; }
        if (!lit.length && !f.blown) { f.blown = true; f.cheerAt = f.t + 0.25; f.eatAt = f.t + 1.4; }
      }
    }
    if (f.cheerAt >= 0 && f.t >= f.cheerAt) cheer();
    if (f.eatAt >= 0 && f.t >= f.eatAt) {
      var e = f.t - f.eatAt;
      if (e < 1.8) {
        f.munch -= dt;
        if (f.munch <= 0) { f.munch = 0.32; Sound.munch(); for (var i = 0; i < 3; i++) parts.push({ x: L.fx + rand(-80, 80) * L.fs, y: L.fy + rand(-60, 20) * L.fs, vx: rand(-60, 60), vy: rand(-160, -60), life: 0, max: 0.7, r: rand(4, 7), color: f.kind === 'pizza' ? '#E9A95B' : f.kind === 'cake' ? '#FFB3CB' : '#D98E3E', kind: 'crumb' }); }
        cat.happy = 0.5;
      } else if (e < 1.9) { if (!f.purred) { f.purred = true; Sound.purr(); heart(L.cat.x, L.cat.y - L.cat.s * 2); } }
      else { f.out += dt; if (f.out > 0.7) backToPick(); }
    }
  }

  /* ================= input ================= */
  function catHit(p) { return Math.abs(p.x - L.cat.x) < L.cat.s * 0.7 && p.y < L.cat.y + 10 && p.y > L.cat.y - L.cat.s * 2.1; }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    var p = toScene(e.clientX, e.clientY);
    if (mode !== 'pick' && catHit(p)) { cat.happy = 1; cat.hop = 0.5; Sound.mrrp(); heart(L.cat.x, L.cat.y - L.cat.s * 2); buzz(8); return; }
    if (mode === 'pick') {
      var best = null;
      picks.forEach(function (k, i) { var s = L.picks[i], d = Math.hypot(p.x - s.x, p.y - s.y); if (d < 230 * L.ps && (!best || d < best.d)) best = { d: d, kind: k.kind }; });
      if (best) startFood(best.kind);
      return;
    }
    if (!food) return;
    var fp = toFood(p);
    if (mode === 'serve') {
      // tap a flame to blow it out
      var hit = null;
      litCandles().forEach(function (t) { if (Math.hypot(fp.x - t.x, fp.y - (t.y - 96)) < 48) hit = t; });
      if (hit) { blowOut(hit, true); buzz(10); }
      return;
    }
    if (!onFood(food.kind, fp.x, fp.y, TOPS[sel].candle ? 40 : 6)) { held = null; return; }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    addTop(fp);
    held = { id: e.pointerId, x: fp.x, y: fp.y };
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!held || held.id !== e.pointerId || mode !== 'make') return;
    var fp = toFood(toScene(e.clientX, e.clientY));
    var gap = TOPS[sel].gap || 52;
    if (Math.hypot(fp.x - held.x, fp.y - held.y) >= gap && onFood(food.kind, fp.x, fp.y, 6)) { addTop(fp); held.x = fp.x; held.y = fp.y; }
  });
  function up(e) { if (held && held.id === e.pointerId) held = null; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  /* ================= particles ================= */
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.5, 0.9), r: rand(6, 10), color: Math.random() < 0.3 ? '#fff' : color, kind: 'star', spin: rand(-5, 5) }); }
  }
  function heart(x, y) { parts.push({ x: x, y: y, vx: rand(-20, 20), vy: -70, life: 0, max: 1.3, r: 16, color: '#FF7EB6', kind: 'heart', g: -10 }); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y);
      if (p.kind === 'smoke') { circle(c, 0, 0, p.r * (1 + (1 - k) * 1.5)); c.fillStyle = 'rgba(160,150,175,.55)'; c.fill(); }
      else if (p.kind === 'heart') { heartPath(c, p.r); fillInk(c, p.color, 2.5); }
      else if (p.kind === 'confetti') { c.rotate(p.life * p.spin); rr(c, -p.r, -p.r * 0.4, p.r * 2, p.r * 0.8, 2); c.fillStyle = p.color; c.fill(); }
      else if (p.kind === 'crumb') { circle(c, 0, 0, p.r); fillInk(c, p.color, 2); }
      else { c.rotate(p.life * p.spin); star(c, p.r * 1.3); c.fillStyle = p.color; c.fill(); ink(c, 2); }
      c.restore();
    });
  }

  /* ================= drawing ================= */
  function drawKitchen(c) {
    c.fillStyle = '#FFF1E2'; c.fillRect(0, 0, W, H);
    // tiles up the wall
    c.strokeStyle = '#FBDCC0'; c.lineWidth = 3;
    for (var y = 0; y < L.counter; y += 56) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); var off = (y / 56) % 2 ? 28 : 0; for (var x = off; x < W; x += 56) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 56); c.stroke(); } }
    // bunting
    var cols = ['#FF8FAB', '#FFD23F', '#7CC4FF', '#7BD389', '#B48CFF'];
    c.beginPath(); c.moveTo(0, 26); c.quadraticCurveTo(W / 2, 70, W, 26); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    for (var i = 1; i < 12; i++) {
      var tt = i / 12, bx = tt * W, by = 26 + 2 * (1 - tt) * tt * 44 * 2 * 0.5 * 2;
      c.beginPath(); c.moveTo(bx - 16, by); c.lineTo(bx + 16, by); c.lineTo(bx, by + 30); c.closePath(); fillInk(c, cols[i % cols.length], 3);
    }
    // counter
    c.fillStyle = '#E6B98A'; c.fillRect(0, L.counter, W, H - L.counter);
    c.beginPath(); c.moveTo(0, L.counter); c.lineTo(W, L.counter); ink(c, 4.5);
    c.fillStyle = '#D9A574'; c.fillRect(0, L.counter + 18, W, 6);
    if (L.shelf && mode !== 'pick') { rr(c, L.shelf.x0, L.shelf.y, L.shelf.x1 - L.shelf.x0, 16, 6); fillInk(c, '#E6B98A', 4); }
  }
  function drawCat(c) {
    var s = L.cat.s, k = s / 88;
    var face = cat.happy > 0 ? 'happy' : (cat.blink < 0 ? 'blink' : 'open');
    if (food && food.blowing && !food.blown) face = 'surprised';
    var hop = cat.hop > 0 ? Math.sin(clamp(cat.hop / 0.6, 0, 1) * Math.PI) * s * 0.3 : 0;
    ell(c, L.cat.x, L.cat.y + 2, s * 0.5, s * 0.1); c.fillStyle = 'rgba(42,35,64,.18)'; c.fill();
    c.save(); c.translate(L.cat.x, L.cat.y - 100 * k - hop);
    var o = {}; for (var key in CAT) o[key] = CAT[key]; o.pose = 'sit'; o.size = s; o.face = face;
    try { GGCat.draw(c, o); } catch (e) { circle(c, 0, 0, 40); fillInk(c, '#FFA94D', 4); }
    c.restore();
    // a puff of air when blowing out the candles
    if (food && food.blowing && !food.blown) {
      c.save(); c.strokeStyle = '#9BD6F5'; c.lineWidth = 6; c.lineCap = 'round';
      var bx = L.cat.x + s * 0.5, by = L.cat.y - 100 * k + 10 * k;
      for (var i = 0; i < 3; i++) { var ph = (time * 2 + i / 3) % 1; c.globalAlpha = 1 - ph; c.beginPath(); c.moveTo(bx + ph * 120, by - 14 + i * 14); c.quadraticCurveTo(bx + ph * 120 + 30, by - 20 + i * 14, bx + ph * 120 + 60, by - 14 + i * 14); c.stroke(); }
      c.restore();
    }
  }
  function drawFood(c, kind, list, x, y, s, extra) {
    c.save(); c.translate(x, y); c.scale(s, s); if (extra) extra(c);
    drawFoodBase(c, kind); drawToppings(c, kind, list);
    c.restore();
  }
  function drawPicker(c) {
    pickIn += 0;
    picks.forEach(function (k, i) {
      var sp = L.picks[i], e = easeBack(clamp((time - pickStart - i * 0.08) / 0.4, 0, 1));
      var bob = reduceMotion ? 0 : Math.sin(time * 2 + i * 1.3) * 6;
      var mid = (FOODS[k.kind].h[0] + FOODS[k.kind].h[1]) / 2;
      drawFood(c, k.kind, k.tops, sp.x, sp.y + bob - mid * L.ps * e, L.ps * e);
    });
  }
  var pickStart = 0;

  /* ================= sound ================= */
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
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
    function noise(o) {
      if (!ready()) return;
      var t = ac.currentTime + (o.delay || 0);
      var src = ac.createBufferSource(); src.buffer = noiseBuf;
      var f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 1000; f.Q.value = o.q || 1;
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
      pop: function () { tone({ f: 420, to: 920, dur: 0.1, gain: 0.12, slide: 0.06 }); },
      pick: function () { tone({ f: 660, to: 990, dur: 0.12, gain: 0.1, type: 'triangle', slide: 0.08 }); },
      plop: function () { var p = rand(0.85, 1.2); tone({ f: 300 * p, to: 640 * p, dur: 0.09, gain: 0.14, slide: 0.05 }); },
      squish: function () { noise({ type: 'lowpass', freq: rand(500, 800), q: 2, attack: 0.01, dur: 0.12, gain: 0.12 }); tone({ f: 180, to: 120, dur: 0.1, gain: 0.05 }); },
      ting: function () { tone({ f: 1320, dur: 0.25, gain: 0.07, type: 'triangle' }); tone({ f: 1980, dur: 0.15, gain: 0.03 }); },
      ding: function () { tone({ f: 1046.5, dur: 0.9, gain: 0.14 }); tone({ f: 2093, dur: 0.5, gain: 0.05, type: 'triangle' }); tone({ f: 1318.5, dur: 0.8, gain: 0.06, delay: 0.02 }); },
      tune: function () {
        if (!ready()) return;
        var at = 0;
        TUNE.forEach(function (n) { var f = NOTES[n[0]], d = n[1] * BEAT; tone({ f: f, dur: d * 0.9, gain: 0.12, type: 'triangle', delay: at }); tone({ f: f * 2, dur: d * 0.5, gain: 0.025, delay: at }); at += d; });
      },
      whoosh: function () { noise({ type: 'bandpass', freq: 900, q: 0.6, attack: 0.15, dur: 0.5, gain: 0.12 }); },
      puff: function () { noise({ type: 'bandpass', freq: 1400, q: 0.8, attack: 0.02, dur: 0.15, gain: 0.1 }); },
      munch: function () { noise({ type: 'bandpass', freq: rand(600, 1100), q: 1.5, attack: 0.005, dur: 0.06, gain: 0.14 }); noise({ type: 'bandpass', freq: rand(600, 1100), q: 1.5, attack: 0.005, dur: 0.05, gain: 0.1, delay: 0.09 }); },
      chime: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 }); tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' }); }); },
      purr: function () { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.22, delay: i * 0.085 }); },
      mrrp: function () { var p = rand(0.9, 1.2); tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', delay: 0.1, slide: 0.12 }); }
    };
  })();

  /* ================= sound button ================= */
  var soundBtn = $('soundBtn');
  function renderSound() {
    var on = Sound.isOn();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    soundBtn.innerHTML = '<svg viewBox="0 0 32 32"><path d="M5 12 H11 L18 6 V26 L11 20 H5 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="3" stroke-linejoin="round"/>' +
      (on ? '<path d="M22 11 Q26 16 22 21 M25 7 Q32 16 25 25" fill="none" stroke="#2A2340" stroke-width="3" stroke-linecap="round"/>' : '<path d="M22 12 L29 20 M29 12 L22 20" stroke="#FF6B57" stroke-width="3.5" stroke-linecap="round"/>') + '</svg>';
  }
  soundBtn.addEventListener('click', function () { Sound.init(); Sound.setOn(!Sound.isOn()); renderSound(); if (Sound.isOn()) Sound.pop(); });
  window.addEventListener('gg-change', renderSound);
  renderSound();

  /* ================= main loop ================= */
  function update(dt) {
    time += dt;
    cat.happy = Math.max(0, cat.happy - dt); cat.hop = Math.max(0, cat.hop - dt);
    cat.blink -= dt; if (cat.blink < -0.15) cat.blink = rand(2, 6);
    if (food) { food.tops.forEach(function (t) { if (t.age !== undefined) { t.age += dt; if (t.age > 0.4) delete t.age; } }); }
    if (mode === 'serve' && food) updateServe(dt);
    for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 300) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  }
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    rr(ctx, OX, OY, W * K, H * K, 24); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawKitchen(ctx);
    if (mode === 'pick') drawPicker(ctx);
    else if (food) {
      drawCat(ctx);
      var slide = food.out > 0 ? easeOut(food.out / 0.6) * W : 0, inT = easeBack(clamp((time - foodStart) / 0.45, 0, 1));
      var wob = mode === 'serve' && food.eatAt >= 0 && food.t > food.eatAt && food.t < food.eatAt + 1.8 ? Math.sin(time * 30) * 0.01 : 0;
      drawFood(ctx, food.kind, food.tops, L.fx + slide, L.fy, L.fs * (0.6 + 0.4 * inT), function (c) { c.rotate(wob); });
    }
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, W * K, H * K, 24); ink(ctx, 5);
    requestAnimationFrame(frame);
  }
  var foodStart = 0;
  var _start = startFood; startFood = function (k) { _start(k); foodStart = time; };
  var _back = backToPick; backToPick = function () { _back(); pickStart = time; };
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(tray); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  requestAnimationFrame(frame);

  /* test hook */
  window.__kk = {
    state: function () { return { mode: mode, kind: food && food.kind, tops: food ? food.tops.length : 0, lit: food ? litCandles().length : 0, made: P.made, sel: sel }; },
    foodToScreen: function (x, y) { return { x: OX + (L.fx + x * L.fs) * K, y: OY + (L.fy + y * L.fs) * K }; },
    pickToScreen: function (i) { return { x: OX + L.picks[i].x * K, y: OY + L.picks[i].y * K }; },
    L: function () { return L; }
  };
})();
