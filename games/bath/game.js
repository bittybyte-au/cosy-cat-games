/* Bath Time – a toddler game. A muddy kitten sits in the bath. Rub it with the sponge (the mud turns to bubbles),
   wash the bubbles off with the shower, then rub it dry with the towel. It shakes, fluffs up, purrs, and the next
   muddy kitten hops in. The tool to use next gives a little wiggle, but any tool works any time. The rubber duck
   squeaks. No words, nothing to get wrong. Saves a count to GG.setProgress('bath', { washed }). */
(function () {
  'use strict';

  var INK = '#2A2340';
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
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

  /* ================= saved count ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('bath') || {}; } catch (e) {} if (typeof p.washed !== 'number') p.washed = 0; return p; })();
  function save() { try { GG.setProgress('bath', P); } catch (e) {} }

  /* ================= the tools (drawn centred, about 100 wide) ================= */
  var TOOLS = {
    sponge: function (c) {
      rr(c, -42, -28, 84, 56, 16); fillInk(c, '#FFD23F', 4.5);
      c.fillStyle = '#E8B100'; [[-24, -10], [-6, 8], [14, -14], [26, 10], [-22, 14], [6, -4]].forEach(function (q) { circle(c, q[0], q[1], 4.5); c.fill(); });
      rr(c, -42, 14, 84, 14, 6); c.fillStyle = '#7BD389'; c.fill(); ink(c, 3.5);
    },
    shower: function (c) {
      c.beginPath(); c.moveTo(30, 44); c.quadraticCurveTo(30, -10, -2, -16); c.strokeStyle = INK; c.lineWidth = 14; c.stroke(); c.strokeStyle = '#C9C2D6'; c.lineWidth = 8; c.stroke();
      c.save(); c.translate(-14, -22); c.rotate(-0.6);
      rr(c, -30, -16, 44, 32, 12); fillInk(c, '#C9C2D6', 4.5);
      ell(c, -30, 0, 8, 18); fillInk(c, '#7CC4FF', 4);
      c.restore();
      c.fillStyle = '#7CC4FF'; [[-46, 6], [-38, 22], [-54, 22], [-30, 36]].forEach(function (q) { c.beginPath(); c.moveTo(q[0], q[1] - 7); c.quadraticCurveTo(q[0] + 5, q[1] + 2, q[0], q[1] + 5); c.quadraticCurveTo(q[0] - 5, q[1] + 2, q[0], q[1] - 7); c.fill(); });
    },
    towel: function (c) {
      c.beginPath(); c.moveTo(-40, -34); c.lineTo(40, -34); c.quadraticCurveTo(46, 0, 38, 36); c.lineTo(-38, 36); c.quadraticCurveTo(-46, 0, -40, -34); c.closePath(); fillInk(c, '#FF8FAB', 4.5);
      c.strokeStyle = '#fff'; c.lineWidth = 6; [-16, 18].forEach(function (y) { c.beginPath(); c.moveTo(-40, y); c.lineTo(40, y); c.stroke(); });
      c.strokeStyle = 'rgba(42,35,64,.25)'; c.lineWidth = 3; [-24, -6, 12, 28].forEach(function (x) { c.beginPath(); c.moveTo(x, 36); c.lineTo(x, 44); c.stroke(); });
    }
  };
  function toolImg(id) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 140;
    var c = cv.getContext('2d'); c.translate(70, 70); c.scale(1.2, 1.2); c.lineJoin = 'round'; c.lineCap = 'round';
    TOOLS[id](c); return cv.toDataURL();
  }
  document.querySelectorAll('.tool').forEach(function (b) { b.innerHTML = '<img alt="" src="' + toolImg(b.dataset.tool) + '">'; });
  var tool = 'sponge';
  function setTool(t) {
    tool = t;
    document.querySelectorAll('.tool').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
  }
  $('tools').addEventListener('click', function (e) { var b = e.target.closest('[data-tool]'); if (!b) return; Sound.init(); Sound.pop(); setTool(b.dataset.tool); });

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar'), toolsEl = $('tools');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 640;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6, bottom = toolsEl.getBoundingClientRect().top - 8;
    var aw = cw - 16, ah = Math.max(120, bottom - top);
    var tall = aw / ah < 1.05;
    var nW = tall ? 600 : 1000, nH = tall ? clamp(Math.round(600 * ah / aw), 700, 1000) : clamp(Math.round(1000 * ah / aw), 560, 720);
    if (kit && (nW !== W || nH !== H)) { W = nW; H = nH; placeCat(); } else { W = nW; H = nH; }
    K = Math.min(aw / W, ah / H);
    OX = (cw - W * K) / 2; OY = top + (ah - H * K) / 2;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  /* ================= the kitten ================= */
  var LOOKS = [{ preset: 'ginger' }, { preset: 'white' }, { preset: 'pink' }, { preset: 'blue' }, { preset: 'purple' }, { color: '#C9C2D6', markings: 'tabby' }, { color: '#FFFFFF', markings: 'calico' }, { preset: 'black' }];
  var kit = null, lastLook = -1;
  var CAT_S = 270;   // kitten size
  function tub() { var w = Math.min(W * 0.84, 620), h = Math.min(230, H * 0.34); return { x: W / 2, y: Math.min(H - 70, H * 0.6 + h * 0.6), w: w, h: h }; }
  function placeCat() {
    var T = tub(), top = T.y - T.h + 10;
    var k = Math.min(CAT_S / 88, (top - 26) / 114);   // the whole head fits above the rim on any screen
    kit.size = k * 88;
    kit.x = W / 2; kit.y = T.y - T.h + 10 - 40 * k;   // head centre: head and shoulders above the rim, the rest in the tub
    kit.k = k;
  }
  function newKitten() {
    var li; do { li = Math.floor(Math.random() * LOOKS.length); } while (li === lastLook && LOOKS.length > 1); lastLook = li;
    kit = { look: LOOKS[li], mud: [], suds: [], wet: 0, washed: false, state: 'in', t: 0, shake: 0, fluff: 0, happy: 0 };
    placeCat();
    var k = kit.k;
    // mud: on the head and the chest
    // mud on the head and the top of the chest: all above the tub's rim so every bit can be seen
    var rim = (tub().y - tub().h + 10 - kit.y) / k - 14;
    var spots = [[-28, -22], [28, -30], [0, 10], [-38, 14], [36, 8], [-14, -46], [16, -50]];
    spots.forEach(function (s) { if (Math.random() < 0.85) kit.mud.push({ x: (s[0] + rand(-6, 6)) * k, y: Math.min(rim, s[1] + rand(-5, 5)) * k, r: rand(11, 16) * k, amt: 1, seed: Math.random() * 10 }); });
    nextHint();
  }
  function nextHint() {
    var want = kit.mud.some(function (m) { return m.amt > 0.05; }) ? 'sponge' : kit.suds.length ? 'shower' : kit.wet > 0.05 ? 'towel' : null;
    document.querySelectorAll('.tool').forEach(function (b) { b.classList.toggle('next', b.dataset.tool === want); });
  }

  /* ================= rubbing ================= */
  var parts = [], drops = [], time = 0, held = null, duck = { x: 0, y: 0, bob: 0, squeak: 0 }, scrubT = 0, waterT = 0;
  function onCat(p) { return Math.hypot(p.x - kit.x, (p.y - kit.y) * 0.8) < 125 * kit.k / 1.5 + 60; }
  function useTool(p, dist) {
    if (!kit || kit.state !== 'bath') return;
    var lx = p.x - kit.x, ly = p.y - kit.y;
    if (tool === 'sponge') {
      if (!onCat(p) || dist <= 0) return;
      var R = 46;
      kit.mud.forEach(function (m) {
        if (m.amt <= 0) return;
        if (Math.hypot(m.x - lx, m.y - ly) < R + m.r) { m.amt = Math.max(0, m.amt - dist / 160); if (m.amt === 0) Sound.bubble(); }
      });
      // bubbles where you rub
      if (Math.random() < Math.min(1, dist / 18) && kit.suds.length < 70) kit.suds.push({ x: lx + rand(-26, 26), y: ly + rand(-22, 22), r: rand(9, 18), t: 0 });
      scrubT -= dist; if (scrubT < 0) { scrubT = 60; Sound.scrub(); }
    } else if (tool === 'shower') {
      // water falls from the shower head on to where you point
      for (var i = 0; i < 3; i++) drops.push({ x: p.x + rand(-34, 34), y: p.y - 60 + rand(-10, 10), vy: rand(380, 520), life: 0 });
      waterT -= 1; if (waterT < 0) { waterT = 5; Sound.water(); }
      var popped = 0;
      kit.suds = kit.suds.filter(function (s) { var hit = Math.abs(s.x - lx) < 70 && s.y > ly - 40 && s.y < ly + 140; if (hit) { popped++; parts.push({ x: kit.x + s.x, y: kit.y + s.y, vx: rand(-60, 60), vy: rand(-80, 0), life: 0, max: 0.4, r: s.r, kind: 'pop' }); } return !hit; });
      if (popped && Math.random() < 0.3) Sound.bubble();
      if (onCat(p)) { kit.wet = Math.min(1, kit.wet + 0.02); kit.washed = kit.washed || kit.mud.every(function (m) { return m.amt <= 0.05; }); }
      // the mud washes off too, just more slowly
      kit.mud.forEach(function (m) { if (Math.abs(m.x - lx) < 70 && m.y > ly - 40 && m.y < ly + 140) m.amt = Math.max(0, m.amt - 0.006); });
    } else if (tool === 'towel') {
      if (!onCat(p) || dist <= 0) return;
      if (kit.wet > 0) { kit.wet = Math.max(0, kit.wet - dist / 1400); if (Math.random() < 0.25) drops.push({ x: p.x + rand(-20, 20), y: p.y + 10, vy: rand(80, 160), life: 0 }); }
      kit.suds = kit.suds.filter(function (s) { return Math.hypot(s.x - lx, s.y - ly) > 50; });
      scrubT -= dist; if (scrubT < 0) { scrubT = 80; Sound.rub(); }
    }
    nextHint();
    checkDone();
  }
  function checkDone() {
    if (kit.state !== 'bath') return;
    var clean = kit.mud.every(function (m) { return m.amt <= 0.05; });
    if (clean && !kit.suds.length && kit.wet <= 0.05 && kit.washed) {
      kit.state = 'shake'; kit.t = 0; kit.mud = [];
      Sound.shake(); buzz(30);
      P.washed++; save(); if (GG.stat) GG.stat('bath', 'washed', 1);
    }
  }

  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    var p = toScene(e.clientX, e.clientY);
    if (Math.hypot(p.x - duck.x, p.y - duck.y) < 60) { duck.squeak = 0.5; Sound.squeak(); return; }
    held = { id: e.pointerId, x: p.x, y: p.y };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    useTool(p, 12);
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = toScene(e.clientX, e.clientY);
    hover = p;
    if (!held || held.id !== e.pointerId) return;
    var d = Math.hypot(p.x - held.x, p.y - held.y);
    held.x = p.x; held.y = p.y;
    useTool(p, d);
  });
  var hover = null;
  function up(e) { if (held && held.id === e.pointerId) held = null; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', function () { hover = null; });

  /* ================= update ================= */
  function update(dt) {
    time += dt;
    if (!kit) return;
    kit.t += dt;
    if (kit.state === 'in' && kit.t > 0.7) { kit.state = 'bath'; kit.t = 0; }
    if (held && tool === 'shower') useTool({ x: held.x, y: held.y }, 0);
    kit.suds.forEach(function (s) { s.t += dt; });
    if (kit.state === 'shake' && kit.t > 1.0) { kit.state = 'fluffy'; kit.t = 0; Sound.chime(); Sound.purr(); for (var i = 0; i < 3; i++) sparkle(kit.x + rand(-80, 80), kit.y + rand(-80, 40), pick(['#FFD23F', '#FF8FAB', '#7CC4FF']), 10, 1); }
    if (kit.state === 'fluffy' && kit.t > 2.2) { kit.state = 'out'; kit.t = 0; }
    if (kit.state === 'out' && kit.t > 0.7) newKitten();
    duck.squeak = Math.max(0, duck.squeak - dt);
    for (var j = drops.length - 1; j >= 0; j--) { var d = drops[j]; d.life += dt; d.y += d.vy * dt; d.vy += 600 * dt; if (d.y > tub().y - tub().h + 30 || d.life > 1.2) drops.splice(j, 1); }
    for (var i2 = parts.length - 1; i2 >= 0; i2--) { var p = parts[i2]; p.life += dt; if (p.life >= p.max) { parts.splice(i2, 1); continue; } p.vy += (p.g !== undefined ? p.g : 300) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    // wet kittens drip
    if (kit.wet > 0.1 && Math.random() < dt * 6 * kit.wet) drops.push({ x: kit.x + rand(-90, 90), y: kit.y + rand(-40, 60), vy: 40, life: 0 });
  }

  /* ================= drawing ================= */
  function drawRoom(c) {
    c.fillStyle = '#DDF3FF'; c.fillRect(0, 0, W, H);
    // tiles
    c.strokeStyle = '#BFE3F5'; c.lineWidth = 3;
    for (var x = 0; x < W; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (var y = 0; y < H; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // floor
    var fy = tub().y + 24; c.fillStyle = '#C9E7F5'; c.fillRect(0, fy, W, H - fy); c.beginPath(); c.moveTo(0, fy); c.lineTo(W, fy); ink(c, 4);
    // a shelf with bottles
    var sx = W < 700 ? 60 : 110, sy = W < 700 ? 90 : 120;
    rr(c, sx - 60, sy, 150, 14, 5); fillInk(c, '#E6B98A', 3.5);
    [['#FF8FAB', -36], ['#B48CFF', 4], ['#7BD389', 44]].forEach(function (b) { rr(c, sx + b[1] - 12, sy - 52, 26, 52, 8); fillInk(c, b[0], 3.5); rr(c, sx + b[1] - 6, sy - 64, 14, 14, 4); fillInk(c, '#fff', 3); });
  }
  function drawTub(c, front) {
    var T = tub();
    if (!front) {
      // back rim and water
      ell(c, T.x, T.y - T.h + 10, T.w / 2, 34); fillInk(c, '#FFFFFF', 5);
      ell(c, T.x, T.y - T.h + 18, T.w / 2 - 22, 22); c.fillStyle = '#9EDCFF'; c.fill();
      return;
    }
    // the front of the tub, over the kitten's tummy
    c.beginPath(); c.moveTo(T.x - T.w / 2, T.y - T.h + 10); c.lineTo(T.x + T.w / 2, T.y - T.h + 10); c.quadraticCurveTo(T.x + T.w / 2, T.y, T.x + T.w / 2 - 50, T.y); c.lineTo(T.x - T.w / 2 + 50, T.y); c.quadraticCurveTo(T.x - T.w / 2, T.y, T.x - T.w / 2, T.y - T.h + 10); c.closePath();
    fillInk(c, '#FFFFFF', 5);
    c.beginPath(); c.moveTo(T.x - T.w / 2 + 30, T.y - T.h + 50); c.quadraticCurveTo(T.x - T.w / 2 + 34, T.y - 30, T.x - T.w / 2 + 70, T.y - 20); c.strokeStyle = '#E3F1F6'; c.lineWidth = 10; c.stroke();
    // feet
    [-1, 1].forEach(function (s) { rr(c, T.x + s * (T.w / 2 - 80) - 18, T.y - 4, 36, 30, 10); fillInk(c, '#FFD23F', 4); });
    // foam along the rim
    c.fillStyle = '#FFFFFF'; for (var i = 0; i < 9; i++) { var fx = T.x - T.w / 2 + 40 + i * (T.w - 80) / 8; circle(c, fx, T.y - T.h + 12 + Math.sin(time * 2 + i) * 2, 16 + (i % 3) * 4); c.fill(); c.lineWidth = 2.5; c.strokeStyle = 'rgba(42,35,64,.35)'; c.stroke(); }
    // the duck floats on the foam
    duck.x = T.x + T.w / 2 - 90; duck.y = T.y - T.h + 2 + Math.sin(time * 2.2) * 4;
    c.save(); c.translate(duck.x, duck.y); var sq = duck.squeak > 0 ? 1 + Math.sin(duck.squeak * 30) * 0.08 : 1; c.scale(sq, 2 - sq);
    c.beginPath(); c.moveTo(-34, 0); c.quadraticCurveTo(-34, 24, 0, 24); c.quadraticCurveTo(30, 24, 34, 4); c.quadraticCurveTo(16, 8, 8, -2); c.closePath(); fillInk(c, '#FFD23F', 4);
    circle(c, 10, -16, 17); fillInk(c, '#FFD23F', 4);
    c.beginPath(); c.moveTo(24, -16); c.lineTo(40, -11); c.lineTo(24, -6); c.closePath(); fillInk(c, '#FF9A2E', 3);
    circle(c, 14, -21, 3.5); c.fillStyle = INK; c.fill();
    c.restore();
  }
  function drawKitten(c) {
    var k = kit.k, dy = 0, sx = 1, a = 1;
    if (kit.state === 'in') dy = (1 - easeOut(kit.t / 0.7)) * 260;
    if (kit.state === 'out') { dy = -easeOut(kit.t / 0.7) * 40; a = 1 - kit.t / 0.7; }
    if (kit.state === 'shake') { sx = 1 + Math.sin(kit.t * 50) * 0.06 * (1 - kit.t); }
    var face = kit.state === 'fluffy' || kit.state === 'shake' ? 'happy' : kit.wet > 0.4 ? 'surprised' : (held && onCat(held) ? 'happy' : (Math.sin(time * 0.9) > 0.985 ? 'blink' : 'open'));
    var T = tub();
    c.save(); c.beginPath(); c.rect(kit.x - 54 * k, 0, 108 * k, T.y - T.h + 14); c.clip();
    c.globalAlpha = a; c.translate(kit.x, kit.y + dy); c.scale(sx, 1);
    // fluffed-up fur once dry
    if (kit.state === 'fluffy' || kit.state === 'out') {
      c.save(); c.fillStyle = 'rgba(255,255,255,.55)';
      for (var i = 0; i < 14; i++) { var an = i / 14 * TAU; circle(c, Math.cos(an) * 58 * k, -8 * k + Math.sin(an) * 50 * k, 9 * k); c.fill(); }
      c.restore();
    }
    var o = {}; for (var key in kit.look) o[key] = kit.look[key]; o.pose = 'sit'; o.size = kit.size; o.face = face;
    try { GGCat.draw(c, o); } catch (e) { circle(c, 0, 0, 100); fillInk(c, '#FFA94D', 5); }
    // wet: a blue sheen and flat little drips of fur
    if (kit.wet > 0.02) {
      c.globalAlpha = a * Math.min(1, kit.wet * 1.5); c.fillStyle = '#5BB4F0';
      [[-30, -36], [24, -44], [-40, 6], [38, 0], [-8, 22], [14, -60], [30, 26]].forEach(function (d) { var x = d[0] * k, y = d[1] * k + (time * 20 % 6); c.beginPath(); c.moveTo(x, y - 9); c.quadraticCurveTo(x + 6, y + 2, x, y + 5); c.quadraticCurveTo(x - 6, y + 2, x, y - 9); c.fill(); });
      c.globalAlpha = a;
    }
    // mud
    kit.mud.forEach(function (m) {
      if (m.amt <= 0) return;
      c.save(); c.globalAlpha = a * Math.min(1, m.amt * 1.3);
      var sz = m.r * (0.5 + 0.5 * m.amt);
      c.fillStyle = '#8A5A34';
      circle(c, m.x, m.y, sz); c.fill();
      for (var j = 0; j < 4; j++) { var an2 = m.seed + j * 1.7; circle(c, m.x + Math.cos(an2) * sz * 0.85, m.y + Math.sin(an2) * sz * 0.85, sz * (0.38 + 0.12 * (j % 2))); c.fill(); }
      circle(c, m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.2); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill();
      c.restore();
    });
    // bubbles
    kit.suds.forEach(function (s) {
      var g = easeOut(s.t / 0.25), w = Math.sin(time * 3 + s.x) * 1.5;
      circle(c, s.x, s.y + w, s.r * g); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = 'rgba(126,196,255,.9)'; c.stroke();
      circle(c, s.x - s.r * 0.35, s.y - s.r * 0.35 + w, s.r * 0.22 * g); c.fillStyle = '#fff'; c.fill();
    });
    c.restore();
  }
  function drawHeldTool(c) {
    var p = held || hover; if (!p) return;
    c.save(); c.translate(p.x, p.y - (tool === 'shower' ? 70 : 0)); c.rotate(held ? Math.sin(time * 18) * 0.12 : 0); c.scale(0.9, 0.9);
    c.globalAlpha = held ? 1 : 0.6; c.lineJoin = 'round'; c.lineCap = 'round';
    TOOLS[tool](c);
    c.restore();
  }
  function drawDrops(c) {
    c.fillStyle = '#5BB4F0';
    drops.forEach(function (d) { c.beginPath(); c.moveTo(d.x, d.y - 9); c.quadraticCurveTo(d.x + 5, d.y + 1, d.x, d.y + 4); c.quadraticCurveTo(d.x - 5, d.y + 1, d.x, d.y - 9); c.fill(); });
  }
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.6, 1), r: rand(6, 10), color: Math.random() < 0.3 ? '#fff' : color, kind: 'star', spin: rand(-5, 5) }); }
  }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y);
      if (p.kind === 'pop') { circle(c, 0, 0, p.r * (1 + (1 - k))); c.strokeStyle = 'rgba(126,196,255,.9)'; c.lineWidth = 2.5; c.stroke(); }
      else { c.rotate(p.life * p.spin); star(c, p.r * 1.3); c.fillStyle = p.color; c.fill(); ink(c, 2); }
      c.restore();
    });
  }

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
      scrub: function () { noise({ type: 'bandpass', freq: rand(1500, 2600), q: 1.2, attack: 0.01, dur: 0.07, gain: 0.05 }); },
      bubble: function () { var p = rand(0.8, 1.4); tone({ f: 500 * p, to: 1200 * p, dur: 0.06, gain: 0.05, slide: 0.04 }); },
      water: function () { noise({ type: 'highpass', freq: 2200, q: 0.5, attack: 0.02, dur: 0.14, gain: 0.04 }); },
      rub: function () { noise({ type: 'lowpass', freq: 900, q: 0.7, attack: 0.02, dur: 0.1, gain: 0.05 }); },
      squeak: function () { tone({ f: 900, to: 1500, dur: 0.12, gain: 0.08, type: 'triangle' }); tone({ f: 1500, to: 1000, dur: 0.1, gain: 0.06, type: 'triangle', delay: 0.12 }); },
      shake: function () { for (var i = 0; i < 6; i++) noise({ type: 'bandpass', freq: 1800, q: 0.8, attack: 0.01, dur: 0.05, gain: 0.06, delay: i * 0.06 }); },
      chime: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.7, gain: 0.12, delay: i * 0.1 }); tone({ f: f * 2, dur: 0.3, gain: 0.03, delay: i * 0.1, type: 'triangle' }); }); },
      purr: function () { for (var i = 0; i < 6; i++) noise({ type: 'lowpass', freq: 160, q: 2, attack: 0.03, dur: 0.07, gain: 0.22, delay: i * 0.085 }); },
      mrrp: function () { var p = rand(0.9, 1.2); tone({ f: 520 * p, to: 820 * p, dur: 0.12, gain: 0.06, type: 'triangle', slide: 0.1 }); tone({ f: 820 * p, to: 640 * p, dur: 0.14, gain: 0.05, type: 'triangle', delay: 0.1, slide: 0.12 }); },
      brush: function () { noise({ freq: 1600, q: 0.6, attack: 0.04, dur: 0.18, gain: 0.08 }); }
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
    drawRoom(ctx);
    drawTub(ctx, false);
    if (kit) drawKitten(ctx);
    drawTub(ctx, true);
    drawDrops(ctx);
    drawParts(ctx);
    drawHeldTool(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, W * K, H * K, 24); ink(ctx, 5);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(topbar); ro.observe(toolsEl); }
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  newKitten();
  requestAnimationFrame(frame);

  /* test hook */
  window.__bath = {
    state: function () { return kit && { state: kit.state, mud: kit.mud.filter(function (m) { return m.amt > 0.05; }).length, suds: kit.suds.length, wet: kit.wet, washed: P.washed, x: kit.x, y: kit.y, k: kit.k }; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    setTool: setTool
  };
})();
