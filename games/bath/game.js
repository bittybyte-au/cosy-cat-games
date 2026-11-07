/* Bath Time – a toddler game. A muddy kitten sits in the bath. Rub it with the sponge (the mud turns to bubbles),
   wash the bubbles off with the shower, then rub it dry with the towel. It shakes, fluffs up, purrs, and the next
   muddy kitten hops in. The tool to use next gives a little wiggle, but any tool works any time. The rubber duck
   squeaks. No words, nothing to get wrong. Saves a count to GG.setProgress('bath', { washed }). */
(function () {
  'use strict';

  var D = window.GGDraw, INK = D.INK, LW = D.LW;
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  /* a round bubble: white, a soft shade low down, a shine, outline last */
  function bubble(c, x, y, r) {
    if (r < 1) return;
    D.shape(c, D.ellPath(x, y, r, r), '#FFFFFF', { lw: LW.fine, depth: r * 0.3, shade: 'rgba(91,180,240,.22)', shine: [x - r * 0.38, y - r * 0.4, r * 0.24, r * 0.16, -0.6, 0.9] });
  }

  /* ================= saved count ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('bath') || {}; } catch (e) {} if (typeof p.washed !== 'number') p.washed = 0; return p; })();
  function save() { try { GG.setProgress('bath', P); } catch (e) {} }

  /* ================= the tools (drawn centred, about 100 wide) ================= */
  var TOOLS = {
    sponge: function (c) {
      // holes and the green scourer layer are drawn inside the sponge, then its outline goes on last
      D.shape(c, D.rrPath(-42, -28, 84, 56, 16), D.tone(c, '#FFD23F', -28, 28), { lw: LW.mid, depth: 7, shine: [-22, -18, 13, 5, -0.15, 0.55], inside: function (c) {
        c.fillStyle = '#E8B100'; [[-24, -10], [-4, 4], [14, -14], [26, 2], [-22, 6], [4, -14]].forEach(function (q) { circle(c, q[0], q[1], 4.5); c.fill(); });
        c.fillStyle = '#7BD389'; c.fillRect(-50, 14, 100, 20);
        c.beginPath(); c.moveTo(-50, 14); c.lineTo(50, 14); D.ink(c, LW.fine);
      } });
    },
    shower: function (c) {
      // the hose tucks into the back of the head, which is drawn over it
      c.beginPath(); c.moveTo(30, 44); c.quadraticCurveTo(30, -10, -10, -20); c.strokeStyle = INK; c.lineWidth = 15; c.stroke(); c.strokeStyle = '#C9C2D6'; c.lineWidth = 7; c.stroke();
      c.save(); c.translate(-14, -22); c.rotate(-0.6);
      D.shape(c, D.rrPath(-30, -16, 44, 32, 12), D.tone(c, '#C9C2D6', -16, 16), { lw: LW.mid, depth: 6, shine: [-10, -9, 10, 3.5, 0, 0.6], inside: function (c) {
        D.shape(c, D.ellPath(-30, 0, 9, 18), '#7CC4FF', { lw: LW.fine, depth: 0 });
      } });
      c.restore();
      c.fillStyle = '#7CC4FF'; [[-46, 6], [-38, 22], [-54, 22], [-30, 36]].forEach(function (q) { c.beginPath(); c.moveTo(q[0], q[1] - 7); c.quadraticCurveTo(q[0] + 5, q[1] + 2, q[0], q[1] + 5); c.quadraticCurveTo(q[0] - 5, q[1] + 2, q[0], q[1] - 7); c.fill(); });
    },
    towel: function (c) {
      // the fringe starts under the towel, so the towel covers where it's sewn on
      c.strokeStyle = '#E86F92'; c.lineWidth = LW.fine; c.lineCap = 'round'; [-24, -6, 12, 28].forEach(function (x) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x, 44); c.stroke(); });
      D.shape(c, function (p) { p.moveTo(-40, -34); p.lineTo(40, -34); p.quadraticCurveTo(46, 0, 38, 36); p.lineTo(-38, 36); p.quadraticCurveTo(-46, 0, -40, -34); p.closePath(); },
        D.tone(c, '#FF8FAB', -34, 36), { lw: LW.mid, depth: 8, inside: function (c) {
          c.fillStyle = '#FFFFFF'; [-16, 18].forEach(function (y) { c.fillRect(-50, y - 3.5, 100, 7); });
        } });
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
  var kit = null, lastLook = -1, kitIds = 0;
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
    kit = { id: ++kitIds, look: LOOKS[li], mud: [], suds: [], wet: 0, washed: false, state: 'in', t: 0, shake: 0, fluff: 0, happy: 0 };
    placeCat();
    var k = kit.k;
    // mud on the head, all above the water so every bit can be seen. The mud is only drawn on the cat
    // (see drawMud), so the spots sit well inside the head and ears, where they show in full.
    var rim = (tub().y - tub().h + 10 - kit.y) / k - 14;
    var spots = [[-24, -14], [24, -18], [0, 22], [-30, 14], [30, 12], [-29, -32], [29, -32]];
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
      // lots of bubbles is the fun part: up to two per rub, and plenty before it stops adding more
      for (var b = 0; b < 2; b++) {
        if (Math.random() < Math.min(1, dist / 14) && kit.suds.length < 240) kit.suds.push({ x: lx + rand(-30, 30), y: ly + rand(-26, 26), r: rand(9, 18), t: 0 });
      }
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
    var fy = tub().y + 24; c.fillStyle = D.tone(c, '#C9E7F5', fy, H); c.fillRect(0, fy, W, H - fy); c.beginPath(); c.moveTo(-5, fy); c.lineTo(W + 5, fy); D.ink(c, LW.mid);
    // a shelf with bottles standing on it (each cap tucks into its bottle, which covers the join)
    var sx = W < 700 ? 60 : 110, sy = W < 700 ? 90 : 120;
    D.shape(c, D.rrPath(sx - 60, sy, 150, 14, 5), D.tone(c, '#E6B98A', sy, sy + 14), { lw: LW.fine, depth: 4 });
    [['#FF8FAB', -36], ['#B48CFF', 4], ['#7BD389', 44]].forEach(function (b) {
      var bx = sx + b[1];
      D.shape(c, D.rrPath(bx - 6, sy - 64, 14, 18, 4), '#FFFFFF', { lw: LW.fine, depth: 0 });
      D.shape(c, D.rrPath(bx - 12, sy - 52, 26, 52, 8), D.tone(c, b[0], sy - 52, sy), { lw: LW.fine, depth: 5, shine: [bx - 5, sy - 40, 3, 8, 0, 0.5] });
    });
  }

  /* The tub, seen from the front: the back of the rim, the water inside it, and the front (body, feet and the
     near side of the rim) that hides whatever floats low in the water. */
  function tubGeom() {
    var T = tub(), rimY = T.y - T.h + 10;
    return { T: T, rimY: rimY, rx: T.w / 2, ry: 34, wx: T.x, wy: rimY + 2, wrx: T.w / 2 - 18, wry: 22, waterY: rimY + 4 };
  }
  function drawTubBack(c, G) {
    D.shape(c, D.ellPath(G.T.x, G.rimY, G.rx, G.ry), '#FFFFFF', { lw: LW.big, depth: 0 });
    drawWater(c, G);
  }
  /* the water; drawn again over the kitten's lower half (front = true), so it sits in the water rather than being cut off */
  function drawWater(c, G, front) {
    if (front) { c.save(); c.beginPath(); c.rect(G.wx - G.wrx - 10, G.waterY, G.wrx * 2 + 20, G.wry * 2); c.clip(); }
    D.shape(c, D.ellPath(G.wx, G.wy, G.wrx, G.wry), D.tone(c, '#9EDCFF', G.wy - G.wry, G.wy + G.wry), { lw: LW.mid, depth: 0, inside: function (c) {
      // the tub's inside wall shows as a pale band at the back of the water
      c.fillStyle = '#E9F6FB'; c.beginPath(); c.ellipse(G.wx, G.wy - G.wry * 0.55, G.wrx * 1.02, G.wry * 0.75, 0, Math.PI, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(G.wx - G.wrx * 0.45, G.wy + G.wry * 0.25, G.wrx * 0.18, 3, 0, 0, Math.PI); c.stroke();
      c.beginPath(); c.ellipse(G.wx + G.wrx * 0.2, G.wy + G.wry * 0.5, G.wrx * 0.14, 3, 0, 0, Math.PI); c.stroke();
    } });
    if (front) c.restore();
  }
  function drawTubFront(c, G) {
    var T = G.T, x0 = T.x - T.w / 2, x1 = T.x + T.w / 2;
    // feet first, so the tub covers where they join it
    [-1, 1].forEach(function (s) { D.shape(c, D.rrPath(T.x + s * (T.w / 2 - 80) - 18, T.y - 10, 36, 36, 10), D.tone(c, '#FFD23F', T.y - 10, T.y + 26), { lw: LW.mid, depth: 6 }); });
    // the front: the body of the tub up to the near edge of the water
    D.shape(c, function (p) {
      p.moveTo(x0, G.rimY); p.quadraticCurveTo(x0, T.y, x0 + 50, T.y); p.lineTo(x1 - 50, T.y); p.quadraticCurveTo(x1, T.y, x1, G.rimY);
      p.lineTo(G.wx + G.wrx, G.wy); p.ellipse(G.wx, G.wy, G.wrx, G.wry, 0, 0, Math.PI); p.lineTo(x0, G.rimY); p.closePath();
    }, D.tone(c, '#FFFFFF', G.rimY, T.y), { lw: LW.big, depth: 16, inside: function (c) {
      // the rolled lip of the rim, and a soft highlight down the left side
      c.beginPath(); c.ellipse(T.x, G.rimY, G.rx, G.ry, 0, 0.04, Math.PI - 0.04); D.ink(c, LW.mid);
      c.beginPath(); c.moveTo(x0 + 30, G.rimY + G.ry + 16); c.quadraticCurveTo(x0 + 34, T.y - 30, x0 + 70, T.y - 20); c.strokeStyle = '#E3F1F6'; c.lineWidth = 10; c.lineCap = 'round'; c.stroke();
    } });
  }

  /* bubbles and the duck float on the water, scattered; the ones nearer the front dip behind the tub's edge */
  var floatKey = '', floaters = [];
  function makeFloaters(G) {
    var key = W + 'x' + H;
    if (key === floatKey) return floaters;
    floatKey = key; floaters = [];
    var rnd = D.seeded(11);
    var duck0 = { kind: 'duck', x: G.wx + G.wrx * 0.58, y: G.wy + G.wry * 0.3, r: 34, ph: 0 };
    floaters.push(duck0);
    for (var tries = 0; tries < 400 && floaters.length < 15; tries++) {
      var r = 9 + rnd() * 12;
      var f = { kind: 'bubble', x: G.wx + (rnd() * 2 - 1) * G.wrx, y: G.wy + (rnd() * 2 - 1) * G.wry, r: r, ph: rnd() * TAU };
      var e = Math.pow((f.x - G.wx) / (G.wrx - r * 0.5), 2) + Math.pow((f.y - G.wy) / G.wry, 2);
      if (e > 0.9) continue;
      // keep clear of the kitten's chin and the duck, and don't pile up
      if (Math.abs(f.x - G.wx) < 70 && f.y < G.wy + G.wry * 0.5) continue;
      if (floaters.some(function (o) { return Math.hypot(o.x - f.x, (o.y - f.y) * 1.6) < (o.r + f.r) * (o.kind === 'duck' ? 1.3 : 0.85); })) continue;
      floaters.push(f);
    }
    floaters.sort(function (a, b) { return a.y - b.y; });
    return floaters;
  }
  function drawDuck(c, x, y) {
    var sq = duck.squeak > 0 ? 1 + Math.sin(duck.squeak * 30) * 0.08 : 1;
    var m = new DOMMatrix().translate(x, y).scale(sq, 2 - sq);
    // beak first, then the head over its base, then the body over the neck
    D.shape(c, function (p) { p.moveTo(18, -17); p.lineTo(40, -11); p.lineTo(18, -5); p.closePath(); }, '#FF9A2E', { m: m, lw: LW.fine, depth: 0 });
    D.shape(c, D.ellPath(10, -16, 17, 17), '#FFD23F', { m: m, lw: LW.mid, depth: 4, shine: [4, -24, 5, 3, -0.5, 0.6], inside: function (c) { circle(c, 14, -20, 3.5); c.fillStyle = INK; c.fill(); } });
    D.shape(c, function (p) { p.moveTo(-34, 0); p.quadraticCurveTo(-34, 24, 0, 24); p.quadraticCurveTo(30, 24, 34, 4); p.quadraticCurveTo(16, 8, 4, 0); p.quadraticCurveTo(-14, -6, -34, 0); p.closePath(); }, '#FFD23F', { m: m, lw: LW.mid, depth: 6,
      inside: function (c) { c.beginPath(); c.moveTo(-14, 6); c.quadraticCurveTo(0, 14, 12, 8); c.strokeStyle = '#E8B100'; c.lineWidth = LW.fine; c.stroke(); } });
  }
  function drawFloaters(c, G, front) {
    makeFloaters(G).forEach(function (f) {
      if ((f.y >= G.waterY) !== front) return;
      var bob = reduceMotion ? 0 : Math.sin(time * 2 + f.ph) * 2.5;
      if (f.kind === 'duck') { duck.x = f.x; duck.y = f.y - 10 + bob; drawDuck(c, f.x, f.y + bob); }
      else bubble(c, f.x, f.y + bob * 0.6, f.r);
    });
  }

  /* Mud only ever shows on the kitten: it's drawn on a layer that's masked by the kitten's own shape (head, ears,
     body, tail), pulled in by half an outline so the ink line stays on top. The mask is made once per kitten. */
  var CBOX = [-66, -72, 134, 172];   // the sitting cat's picture box (GGCat, 100-unit space)
  var mask = { key: '', cv: null }, mudLayer = document.createElement('canvas'), mudCtx = mudLayer.getContext('2d');
  function mudPx() { return Math.min(K * dpr, 2.2); }
  function kittenMask(o) {
    var px = mudPx(), s = kit.k * px, w = Math.ceil(CBOX[2] * s), h = Math.ceil(CBOX[3] * s);
    var key = kit.id + ':' + w + 'x' + h;
    if (mask.key === key) return mask.cv;
    var full = document.createElement('canvas'); full.width = w; full.height = h;
    var f = full.getContext('2d'); f.setTransform(px, 0, 0, px, -CBOX[0] * s, -CBOX[1] * s);
    var mo = {}; for (var k2 in o) mo[k2] = o[k2]; mo.face = 'open';
    GGCat.draw(f, mo);
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var e = cv.getContext('2d'); e.drawImage(full, 0, 0);
    e.globalCompositeOperation = 'destination-in';
    var r = 2.5 * s;   // half of the cat's 5-unit outline
    for (var i = 0; i < 12; i++) { var a = i / 12 * TAU; e.drawImage(full, Math.cos(a) * r, Math.sin(a) * r); }
    mask.key = key; mask.cv = cv;
    return cv;
  }
  function drawMud(c, o, a) {
    var k = kit.k, any = kit.wet > 0.02 || kit.mud.some(function (m) { return m.amt > 0; });
    if (!any) return;
    var mk = kittenMask(o), px = mudPx(), s = k * px;
    if (mudLayer.width !== mk.width || mudLayer.height !== mk.height) { mudLayer.width = mk.width; mudLayer.height = mk.height; }
    var m = mudCtx;
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
    m.clearRect(0, 0, mudLayer.width, mudLayer.height);
    m.setTransform(px, 0, 0, px, -CBOX[0] * s, -CBOX[1] * s);
    // wet: flat little drips of fur
    if (kit.wet > 0.02) {
      m.globalAlpha = Math.min(1, kit.wet * 1.5); m.fillStyle = '#5BB4F0';
      [[-30, -36], [24, -44], [-40, 6], [38, 0], [-8, 22], [14, -60], [30, 26]].forEach(function (d) { var x = d[0] * k, y = d[1] * k + (time * 20 % 6); m.beginPath(); m.moveTo(x, y - 9); m.quadraticCurveTo(x + 6, y + 2, x, y + 5); m.quadraticCurveTo(x - 6, y + 2, x, y - 9); m.fill(); });
    }
    kit.mud.forEach(function (sp) {
      if (sp.amt <= 0) return;
      m.globalAlpha = Math.min(1, sp.amt * 1.3);
      var sz = sp.r * 0.82 * (0.5 + 0.5 * sp.amt);
      m.fillStyle = '#8A5A34';
      circle(m, sp.x, sp.y, sz); m.fill();
      for (var j = 0; j < 4; j++) { var an2 = sp.seed + j * 1.7; circle(m, sp.x + Math.cos(an2) * sz * 0.85, sp.y + Math.sin(an2) * sz * 0.85, sz * (0.38 + 0.12 * (j % 2))); m.fill(); }
      circle(m, sp.x - sp.r * 0.3, sp.y - sp.r * 0.3, sp.r * 0.2); m.fillStyle = 'rgba(255,255,255,.25)'; m.fill();
    });
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalAlpha = 1;
    m.globalCompositeOperation = 'destination-in'; m.drawImage(mk, 0, 0); m.globalCompositeOperation = 'source-over';
    c.save(); c.globalAlpha = a;
    c.drawImage(mudLayer, CBOX[0] * k, CBOX[1] * k, mudLayer.width / px, mudLayer.height / px);
    c.restore();
  }

  function drawKitten(c, G) {
    var k = kit.k, dy = 0, sx = 1, a = 1;
    if (kit.state === 'in') dy = (1 - easeOut(kit.t / 0.7)) * 260;
    if (kit.state === 'out') { dy = -easeOut(kit.t / 0.7) * 40; a = 1 - kit.t / 0.7; }
    if (kit.state === 'shake') { sx = 1 + Math.sin(kit.t * 50) * 0.06 * (1 - kit.t); }
    var face = kit.state === 'fluffy' || kit.state === 'shake' ? 'happy' : kit.wet > 0.4 ? 'surprised' : (held && onCat(held) ? 'happy' : (Math.sin(time * 0.9) > 0.985 ? 'blink' : 'open'));
    // the kitten sits in the water: everything under the water line is hidden, nothing is cut off at the sides
    c.save(); c.beginPath(); c.rect(-W, -H, W * 3, G.waterY + H + 6); c.clip();
    c.globalAlpha = a; c.translate(kit.x, kit.y + dy); c.scale(sx, 1);
    // fluffed-up fur once dry
    if (kit.state === 'fluffy' || kit.state === 'out') {
      c.save(); c.fillStyle = 'rgba(255,255,255,.55)';
      for (var i = 0; i < 14; i++) { var an = i / 14 * TAU; circle(c, Math.cos(an) * 58 * k, -8 * k + Math.sin(an) * 50 * k, 9 * k); c.fill(); }
      c.restore();
    }
    var o = {}; for (var key in kit.look) o[key] = kit.look[key]; o.pose = 'sit'; o.size = kit.size; o.face = face;
    GGCat.draw(c, o);
    drawMud(c, o, a);
    c.globalAlpha = a;
    // bubbles from the sponge
    kit.suds.forEach(function (s) { bubble(c, s.x, s.y + Math.sin(time * 3 + s.x) * 1.5, s.r * easeOut(s.t / 0.25)); });
    c.restore();
    drawWater(c, G, true);
    // a ripple where the kitten meets the water
    c.save(); c.globalAlpha = 0.85 * a; c.beginPath(); c.ellipse(kit.x, G.waterY, 46 * k, 7, 0, 0.15, Math.PI - 0.15);
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 4; c.lineCap = 'round'; c.stroke(); c.restore();
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
      else { c.rotate(p.life * p.spin); star(c, p.r * 1.3); c.fillStyle = p.color; c.fill(); D.ink(c, LW.fine); }
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
    D.rr(ctx, OX, OY, W * K, H * K, 24); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var G = tubGeom();
    drawRoom(ctx);
    drawTubBack(ctx, G);
    drawFloaters(ctx, G, false);
    if (kit) drawKitten(ctx, G);
    drawFloaters(ctx, G, true);
    drawTubFront(ctx, G);
    drawDrops(ctx);
    drawParts(ctx);
    drawHeldTool(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    D.rr(ctx, OX, OY, W * K, H * K, 24); D.ink(ctx, LW.big);
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
