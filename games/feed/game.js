/* Feed the Cat – a toddler game (about age 3). Three cats in three very different colours peek over the table,
   each with a placemat in its colour. A bowl in one of those colours waits at the front: tap the cat that matches
   (or drag the bowl to it). The cat eats and curls up for a nap. Feed all three for a little party, then three new
   cats come. A wrong cat just shakes its head kindly; after a couple of tries the right cat bounces to help.
   No words, no timers, nothing to lose. Saves a count to GG.setProgress('feed', { fed, rounds }). */
(function () {
  'use strict';

  var INK = '#2A2340';
  var TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeBack(t) { t = clamp(t, 0, 1); var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ink(c, w) { c.lineWidth = w || 4; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * (1 - k)); g = Math.round(g * (1 - k)); b = Math.round(b * (1 - k));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* very different colours; red never with orange, blue never with purple */
  var COLOURS = [
    { id: 'red', c: '#FF4D4D' }, { id: 'blue', c: '#3D8BFF' }, { id: 'yellow', c: '#FFD23F' },
    { id: 'green', c: '#3FC46A' }, { id: 'purple', c: '#A86BFF' }, { id: 'orange', c: '#FF9A2E' }
  ];
  var CLASH = { red: 'orange', orange: 'red', blue: 'purple', purple: 'blue' };
  function pickColours(prev) {
    for (var tries = 0; tries < 50; tries++) {
      var set = shuffle(COLOURS.slice()), out = [];
      for (var i = 0; i < set.length && out.length < 3; i++) {
        var ok = out.every(function (o) { return CLASH[o.id] !== set[i].id; });
        if (ok) out.push(set[i]);
      }
      // try not to bring back exactly the same three
      var same = prev && out.every(function (o) { return prev.indexOf(o.id) >= 0; });
      if (out.length === 3 && !same) return out;
    }
    return [COLOURS[0], COLOURS[1], COLOURS[2]];
  }

  /* ================= saved count ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('feed') || {}; } catch (e) {} if (typeof p.fed !== 'number') p.fed = 0; if (typeof p.rounds !== 'number') p.rounds = 0; return p; })();
  function save() { try { GG.setProgress('feed', P); } catch (e) {} }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, L = null;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var bottom = ch - Math.max(10, parseFloat(getComputedStyle(document.body).paddingBottom) || 0) - 6;
    var availW = cw - 16, availH = Math.max(120, bottom - top);
    var tallH = clamp(Math.round(600 * availH / availW), 860, 1150);
    L = availW / availH < 1.1
      ? { W: 600, H: tallH, tableY: Math.round(tallH * 0.58), cats: [110, 300, 490], size: 158, matY: Math.round(tallH * 0.58) + 60, matRX: 84, bowl: { x: 300, y: tallH - 120 }, bowlW: 210 }
      : { W: 1000, H: 640, tableY: 400, cats: [210, 500, 790], size: 196, matY: 456, matRX: 118, bowl: { x: 500, y: 570 }, bowlW: 170 };
    K = Math.min(availW / L.W, availH / L.H);
    OX = (cw - L.W * K) / 2; OY = top + (availH - L.H * K) / 2;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  /* ================= state ================= */
  var time = 0, parts = [];
  var cats = [], order = [], bowl = null, phase = 'play', phaseT = 0, misses = 0, idleT = 0, lastSet = null;
  function newRound() {
    var set = pickColours(lastSet); lastSet = set.map(function (s) { return s.id; });
    cats = set.map(function (s, i) { return { col: s.c, name: s.id, state: 'pop', t: -i * 0.15, shake: 0, hop: 0 }; });
    order = shuffle([0, 1, 2]);
    phase = 'play'; phaseT = 0;
    bowl = null;
    setTimeout(nextBowl, 700);
  }
  function nextBowl() {
    if (!order.length) return;
    var i = order.shift();
    bowl = { target: i, col: cats[i].col, state: 'in', t: 0, x: L.bowl.x, y: L.bowl.y };
    misses = 0; idleT = 0;
    Sound.pop();
  }
  function catHead(i) { var k = L.size / 88; return { x: L.cats[i], y: L.tableY - 50 * k, r: 52 * k }; }
  function matXY(i) { return { x: L.cats[i], y: L.matY }; }

  function attempt(i) {
    var cat = cats[i];
    if (!bowl || bowl.state === 'fly') {
      if (cat.state === 'full') { Sound.purr(); var h = catHead(i); heart(h.x, h.y - 60); }
      return;
    }
    if (cat.state !== 'hungry') {
      if (cat.state === 'full') { Sound.purr(); var q = catHead(i); heart(q.x, q.y - 60); }
      bowl.state = 'back'; bowl.t = 0; bowl.fx = bowl.x; bowl.fy = bowl.y;
      return;
    }
    if (i === bowl.target) {
      bowl.state = 'fly'; bowl.t = 0; bowl.fx = bowl.x; bowl.fy = bowl.y;
      Sound.whoosh();
    } else {
      cat.shake = 0.7; misses++;
      Sound.boop(); buzz(15);
      bowl.state = 'back'; bowl.t = 0; bowl.fx = bowl.x; bowl.fy = bowl.y; bowl.wig = 0.5;
      if (misses >= 2) cats[bowl.target].hop = 1.6;
    }
  }

  function update(dt) {
    cats.forEach(function (cat, i) {
      cat.t += dt;
      if (cat.shake > 0) cat.shake -= dt;
      if (cat.hop > 0) cat.hop -= dt;
      if (cat.state === 'pop' && cat.t > 0.5) { cat.state = 'hungry'; cat.t = rand(0, 2); }
      if (cat.state === 'hungry' && Math.random() < dt * 0.12 && !cat.meowT) { cat.meowT = 0.6; Sound.meow(); }
      if (cat.meowT > 0) { cat.meowT -= dt; if (cat.meowT <= 0) cat.meowT = 0; }
      if (cat.state === 'eat' && cat.t > 1.6) {
        cat.state = 'full'; cat.t = 0; Sound.purr();
        if (order.length) setTimeout(nextBowl, 350);
        else { phase = 'party'; phaseT = 0; }
      }
      if (cat.state === 'out' && cat.t > 0.5) cat.gone = true;
    });
    if (bowl) {
      bowl.t += dt;
      if (bowl.wig > 0) bowl.wig -= dt;
      if (bowl.state === 'in' && bowl.t > 0.5) { bowl.state = 'idle'; bowl.t = 0; }
      if (bowl.state === 'idle') {
        idleT += dt;
        // a gentle nudge if nothing happens for a while
        if (idleT > 7) { cats[bowl.target].hop = 1.2; idleT = 3.5; }
      }
      if (bowl.state === 'back') {
        var k = easeOut(bowl.t / 0.35);
        bowl.x = lerp(bowl.fx, L.bowl.x, k); bowl.y = lerp(bowl.fy, L.bowl.y, k);
        if (bowl.t > 0.35) { bowl.state = 'idle'; bowl.t = 0; }
      }
      if (bowl.state === 'fly') {
        var m = matXY(bowl.target), f = easeOut(bowl.t / 0.45);
        bowl.x = lerp(bowl.fx, m.x, f); bowl.y = lerp(bowl.fy, m.y, f) - Math.sin(f * Math.PI) * 80;
        if (bowl.t > 0.45) {
          var cat = cats[bowl.target];
          cat.state = 'eat'; cat.t = 0; cat.bowlCol = bowl.col;
          P.fed++; save(); if (GG.stat) GG.stat('feed', 'fed', 1);
          Sound.munch(); buzz(20);
          var h = catHead(bowl.target); sparkle(h.x, h.y - 40, bowl.col, 10, 0.9); heart(h.x + 40, h.y - 70);
          bowl = null;
        }
      }
    }
    if (phase === 'party') {
      phaseT += dt;
      if (phaseT > 0.3 && !partyDone) { partyDone = true; Sound.chime(); P.rounds++; save(); for (var i = 0; i < 3; i++) { var hh = catHead(i); sparkle(hh.x, hh.y - 80, cats[i].col, 22, 1.4); } }
      if (phaseT > 0.9 && phaseT < 2.2 && Math.random() < dt * 8) sparkle(rand(80, L.W - 80), rand(60, L.tableY - 160), cats[Math.floor(rand(0, 3))].col, 6, 0.8);
      if (phaseT > 2.6) { phase = 'swap'; phaseT = 0; cats.forEach(function (c) { c.state = 'out'; c.t = 0; }); }
    } else if (phase === 'swap') {
      phaseT += dt;
      if (phaseT > 0.55) { partyDone = false; newRound(); }
    }
    for (var j = parts.length - 1; j >= 0; j--) { var p = parts[j]; p.life += dt; if (p.life >= p.max) { parts.splice(j, 1); continue; } p.vy += (p.g !== undefined ? p.g : 380) * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; }
  }
  var partyDone = false;

  /* ---------- curtains for the window: two tied-back curtains on a rod (copied into each game that has a window) ---------- */
  var curtainTiles = {};
  function curtainTile(st) {
    var key = st.pat + st.col + st.col2;
    if (curtainTiles[key]) return curtainTiles[key];
    var cv = document.createElement('canvas'); cv.width = cv.height = 28;
    var c = cv.getContext('2d');
    c.fillStyle = st.col; c.fillRect(0, 0, 28, 28);
    c.fillStyle = st.col2;
    if (st.pat === 'gingham') { c.globalAlpha = 0.55; c.fillRect(0, 0, 14, 28); c.fillRect(0, 0, 28, 14); c.globalAlpha = 1; }
    else if (st.pat === 'stripes') { c.fillRect(0, 0, 10, 28); }
    else if (st.pat === 'dots') { c.beginPath(); c.arc(7, 7, 4, 0, Math.PI * 2); c.arc(21, 21, 4, 0, Math.PI * 2); c.fill(); }
    else if (st.pat === 'stars') {
      [[7, 8], [21, 22]].forEach(function (q) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 2.4 : 5.5; c.lineTo(q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r); } c.closePath(); c.fill(); });
    }
    return (curtainTiles[key] = cv);
  }
  function drawCurtains(c, x, y, w, h, st) {
    var pad = Math.min(26, w * 0.12), top = y - 12, bot = y + h + 14, cwid = w * 0.28 + pad;
    var fill = c.createPattern(curtainTile(st), 'repeat');
    [-1, 1].forEach(function (side) {
      var xo = side < 0 ? x - pad : x + w + pad;           // the outer edge
      var xi = xo - side * cwid;                           // the inner edge at the top
      var tieX = xo - side * cwid * 0.38, tieY = y + h * 0.6;
      c.beginPath();
      c.moveTo(xo, top); c.lineTo(xi, top);
      c.quadraticCurveTo(xi, y + h * 0.4, tieX, tieY);
      c.quadraticCurveTo(xo - side * cwid * 0.5, tieY + (bot - tieY) * 0.5, xo - side * cwid * 0.72, bot);
      c.lineTo(xo, bot); c.closePath();
      c.fillStyle = fill; c.fill(); ink(c, 3.5);
      // a couple of soft folds
      c.strokeStyle = 'rgba(42,35,64,.22)'; c.lineWidth = 3;
      [0.3, 0.62].forEach(function (f) { var fx = xo - side * cwid * f; c.beginPath(); c.moveTo(fx, top + 4); c.quadraticCurveTo(fx + side * cwid * 0.12, y + h * 0.35, tieX + side * cwid * (f - 0.3) * 0.4, tieY - 4); c.stroke(); });
      // the tie
      c.save(); c.translate(tieX + side * cwid * 0.18, tieY); c.rotate(side * 0.25);
      rr(c, -cwid * 0.3, -6, cwid * 0.6, 12, 6); c.fillStyle = st.tie; c.fill(); ink(c, 3);
      c.restore();
    });
    // the rod with round ends
    rr(c, x - pad - 14, top - 9, w + pad * 2 + 28, 10, 5); c.fillStyle = st.rod; c.fill(); ink(c, 3);
    [x - pad - 16, x + w + pad + 16].forEach(function (rx) { c.beginPath(); c.arc(rx, top - 4, 8, 0, Math.PI * 2); c.fillStyle = st.rod; c.fill(); ink(c, 3); });
  }

  /* ================= drawing ================= */
  function drawRoom(c) {
    var W = L.W, H = L.H, T = L.tableY;
    c.fillStyle = '#FFF1DC'; c.fillRect(0, 0, W, T);
    c.fillStyle = '#FFE4C4'; for (var x = 30; x < W; x += 70) for (var y = 30; y < T; y += 70) { circle(c, x + ((y / 70) % 2 ? 35 : 0), y, 7); c.fill(); }
    // a window with a sunny sky
    var wx = W / 2 - 110, wy = L.W < 700 ? Math.max(40, T - 480) : 26, ww = 220, wh = L.W < 700 ? 220 : 120;
    if (L.W < 700) { rr(c, wx, wy, ww, wh, 16); c.fillStyle = '#9EDCFF'; c.fill(); circle(c, wx + 170, wy + 50, 24); c.fillStyle = '#FFE14D'; c.fill(); rr(c, wx, wy, ww, wh, 16); ink(c, 5); c.strokeStyle = '#fff'; c.lineWidth = 7; c.beginPath(); c.moveTo(wx + ww / 2, wy + 4); c.lineTo(wx + ww / 2, wy + wh - 4); c.stroke();
      drawCurtains(c, wx, wy, ww, wh, { pat: 'gingham', col: '#FFD23F', col2: '#FFFFFF', tie: '#FF8FAB', rod: '#C98B5B' }); }
    // the table
    c.fillStyle = '#E6B98A'; c.fillRect(0, T, W, H - T);
    c.fillStyle = '#DDAE7C'; for (var yy = T + 50; yy < H; yy += 70) c.fillRect(0, yy, W, 4);
    c.beginPath(); c.moveTo(0, T); c.lineTo(W, T); ink(c, 5);
  }
  function drawMat(c, i) {
    var m = matXY(i), col = cats[i].col;
    var glow = bowl && bowl.state === 'drag' && hitCat(bowl.x, bowl.y) === i;
    ell(c, m.x, m.y + 8, L.matRX, L.matRX * 0.3); c.fillStyle = col; c.fill(); ink(c, glow ? 8 : 4);
    ell(c, m.x, m.y + 8, L.matRX * 0.78, L.matRX * 0.22); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.setLineDash([10, 9]); c.stroke(); c.setLineDash([]);
  }
  /* a bowl, centred on its bottom middle, `w` wide; `food` 0..1 */
  function drawBowl(c, x, y, w, col, food, rot) {
    var k = w / 160;
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(k, k);
    ell(c, 0, 4, 76, 14); c.fillStyle = 'rgba(42,35,64,.15)'; c.fill();
    // food first (it pokes out of the top)
    if (food > 0) {
      c.save(); c.translate(0, -56 + (1 - food) * 26);
      // a fish
      c.beginPath(); c.moveTo(-40, 0); c.quadraticCurveTo(-10, -30, 26, -6); c.lineTo(46, -22); c.lineTo(42, 4); c.lineTo(48, 24); c.lineTo(26, 6); c.quadraticCurveTo(-10, 26, -40, 0); c.closePath();
      c.fillStyle = '#FFB26B'; c.fill(); ink(c, 4);
      circle(c, -24, -4, 4); c.fillStyle = INK; c.fill();
      c.beginPath(); c.moveTo(-6, -12); c.quadraticCurveTo(0, 0, -6, 12); c.strokeStyle = '#E07B1F'; c.lineWidth = 3; c.stroke();
      c.restore();
      c.fillStyle = '#B5793F'; [[-46, -42], [-30, -46], [34, -44], [50, -40], [-14, -40], [14, -42]].forEach(function (q) { circle(c, q[0], q[1] + (1 - food) * 20, 7); c.fill(); });
    }
    c.beginPath(); c.moveTo(-72, -44); c.quadraticCurveTo(-70, 0, -40, 0); c.lineTo(40, 0); c.quadraticCurveTo(70, 0, 72, -44); c.closePath();
    c.fillStyle = col; c.fill(); ink(c, 5);
    rr(c, -78, -52, 156, 16, 8); c.fillStyle = shade(col, 0.15); c.fill(); ink(c, 4.5);
    c.beginPath(); c.moveTo(-50, -26); c.quadraticCurveTo(-46, -10, -30, -8); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 6; c.stroke();
    // a paw print on the front
    c.fillStyle = 'rgba(255,255,255,.75)'; circle(c, 18, -20, 7); c.fill(); circle(c, 8, -30, 3.2); c.fill(); circle(c, 18, -33, 3.2); c.fill(); circle(c, 28, -30, 3.2); c.fill();
    c.restore();
  }
  function drawCat(c, i) {
    var cat = cats[i]; if (cat.gone) return;
    var k = L.size / 88, x = L.cats[i], y = L.tableY - 50 * k, dy = 0;
    if (cat.state === 'pop') dy = (1 - easeBack(clamp(cat.t / 0.5, 0, 1))) * L.size * 1.3;
    if (cat.state === 'out') dy = easeOut(cat.t / 0.5) * L.size * 1.4;
    if (cat.hop > 0) dy -= Math.abs(Math.sin(cat.hop * 9)) * 22;
    if (cat.state === 'eat') dy += Math.abs(Math.sin(cat.t * 10)) * 8;
    if (phase === 'party') dy -= Math.abs(Math.sin(phaseT * 7 + i)) * 18;
    var dx = cat.shake > 0 ? Math.sin(cat.shake * 28) * 10 * (cat.shake / 0.7) : 0;
    var face = 'open';
    if (cat.state === 'eat' || phase === 'party') face = 'happy';
    else if (cat.state === 'full') face = 'sleep';

    else if (Math.sin(time * 0.9 + i * 2.1) > 0.985) face = 'blink';
    c.save(); c.translate(x + dx, y + dy);
    if (cat.shake > 0) c.rotate(Math.sin(cat.shake * 28) * 0.06);
    try { var o = { color: cat.col, pose: 'peek', size: L.size, face: face }; if (cat.meowT > 0 && face === 'open') o.mouth = 'o'; GGCat.draw(c, o); } catch (e) { circle(c, 0, 0, L.size / 2); c.fillStyle = cat.col; c.fill(); ink(c, 5); }
    c.restore();
    if (cat.state === 'full' && phase === 'play') {
      c.font = '800 ' + Math.round(L.size * 0.24) + 'px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#7A6F8E'; c.textAlign = 'left';
      var zt = (time * 0.6 + i * 0.3) % 1; c.globalAlpha = 1 - zt;
      c.fillText('z', x + 40 * k, y - 50 * k - zt * 30); c.globalAlpha = 1;
    }
  }
  function frameScene(c) {
    drawRoom(c);
    // cats peek over the table: clip so they rise from behind it
    c.save(); c.beginPath(); c.rect(0, 0, L.W, L.tableY + 16); c.clip();
    for (var i = 0; i < cats.length; i++) drawCat(c, i);
    c.restore();
    for (var j = 0; j < cats.length; j++) {
      if (cats[j].gone) continue;
      drawMat(c, j);
      var cat = cats[j], m = matXY(j);
      if (cat.state === 'eat') drawBowl(c, m.x, m.y + 4, L.bowlW * 0.8, cat.bowlCol, 1 - clamp(cat.t / 1.4, 0, 1));
      else if (cat.state === 'full' || (cat.state === 'out' && cat.bowlCol)) drawBowl(c, m.x, m.y + 4, L.bowlW * 0.8, cat.bowlCol, 0);
    }
    if (bowl) {
      var s = 1, rot = 0;
      if (bowl.state === 'in') s = easeBack(bowl.t / 0.5);
      if (bowl.state === 'idle') { s = 1 + Math.sin(time * 3) * 0.03; }
      if (bowl.state === 'fly') s = lerp(1, 0.8, easeOut(bowl.t / 0.45));
      if (bowl.wig > 0) rot = Math.sin(bowl.wig * 30) * 0.12;
      if (bowl.state === 'drag') { s = 1.08; rot = Math.sin(time * 8) * 0.04; }
      c.save(); c.translate(bowl.x, bowl.y); c.scale(s, s);
      if (bowl.state === 'idle') { c.globalAlpha = 0.35 + 0.15 * Math.sin(time * 3); ell(c, 0, -30, L.bowlW * 0.62, L.bowlW * 0.42); c.fillStyle = '#FFFFFF'; c.fill(); c.globalAlpha = 1; }
      drawBowl(c, 0, 0, L.bowlW, bowl.col, 1, rot);
      c.restore();
    }
    drawParts(c);
  }

  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(60, 220) * (spd || 1);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90, life: 0, max: rand(0.6, 1.1), r: rand(6, 11), color: Math.random() < 0.3 ? '#fff' : color, kind: Math.random() < 0.6 ? 'star' : 'dot', spin: rand(-5, 5) });
    }
  }
  function heart(x, y) { parts.push({ x: x, y: y, vx: rand(-20, 20), vy: -80, life: 0, max: 1.3, r: 18, color: '#FF7EB6', kind: 'heart', g: -10 }); }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y); c.rotate(p.kind === 'heart' ? 0 : p.life * p.spin);
      if (p.kind === 'star') star(c, p.r * 1.3);
      else if (p.kind === 'heart') { c.beginPath(); c.moveTo(0, p.r * 0.4); c.bezierCurveTo(-p.r * 1.2, -p.r * 0.4, -p.r * 0.5, -p.r * 1.2, 0, -p.r * 0.5); c.bezierCurveTo(p.r * 0.5, -p.r * 1.2, p.r * 1.2, -p.r * 0.4, 0, p.r * 0.4); }
      else { c.beginPath(); c.arc(0, 0, p.r * 0.6, 0, TAU); }
      c.fillStyle = p.color; c.fill();
      if (p.kind !== 'dot') ink(c, 2);
      c.restore();
    });
  }

  /* ================= input: tap a cat, or drag the bowl ================= */
  function hitCat(x, y) {
    var half = (L.cats[1] - L.cats[0]) / 2;
    var top = L.tableY - L.size * 1.45;
    for (var i = 0; i < 3; i++) if (Math.abs(x - L.cats[i]) < half && y > top && y < L.matY + 60) return i;
    return -1;
  }
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (phase !== 'play') return;
    var r = toScene(e.clientX, e.clientY);
    if (bowl && bowl.state !== 'fly' && bowl.state !== 'drag' && Math.hypot(r.x - bowl.x, r.y - (bowl.y - 40)) < L.bowlW * 0.65) {
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: bowl.x - r.x, oy: bowl.y - r.y, moved: false };
      bowl.state = 'drag'; idleT = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    var i = hitCat(r.x, r.y);
    if (i >= 0) { idleT = 0; attempt(i); }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId || !bowl) return;
    var r = toScene(e.clientX, e.clientY);
    bowl.x = r.x + drag.ox; bowl.y = r.y + drag.oy;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.moved = true;
  });
  function up(e) {
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    if (!bowl || bowl.state !== 'drag') return;
    if (!d.moved) { bowl.state = 'idle'; bowl.wig = 0.4; Sound.pop(); return; }
    var i = hitCat(bowl.x, bowl.y - 40);
    if (i >= 0) attempt(i);
    else { bowl.state = 'back'; bowl.t = 0; bowl.fx = bowl.x; bowl.fy = bowl.y; }
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

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
      pop: function () { tone({ f: 420, to: 920, dur: 0.11, gain: 0.14, slide: 0.06 }); },
      boop: function () { tone({ f: 330, to: 260, dur: 0.14, gain: 0.1, type: 'triangle' }); },
      whoosh: function () { noise({ type: 'bandpass', freq: 1400, q: 0.6, attack: 0.04, dur: 0.18, gain: 0.08 }); },
      munch: function () { for (var i = 0; i < 4; i++) noise({ type: 'lowpass', freq: 700, q: 1.2, attack: 0.005, dur: 0.05, gain: 0.18, delay: i * 0.22 }); },
      meow: function () { var p = rand(0.95, 1.25); tone({ f: 600 * p, to: 900 * p, dur: 0.16, gain: 0.06, type: 'triangle', slide: 0.12 }); tone({ f: 900 * p, to: 560 * p, dur: 0.22, gain: 0.05, type: 'triangle', delay: 0.14, slide: 0.2 }); },
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
    var dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    rr(ctx, OX, OY, L.W * K, L.H * K, 26); ctx.clip();
    ctx.setTransform(dpr * K, 0, 0, dpr * K, dpr * OX, dpr * OY);
    frameScene(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, L.W * K, L.H * K, 26); ink(ctx, 5);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  newRound();
  requestAnimationFrame(frame);

  /* test hook */
  window.__feed = {
    state: function () { return { phase: phase, cats: cats.map(function (c) { return { name: c.name, state: c.state }; }), bowl: bowl && { target: bowl.target, state: bowl.state, x: bowl.x, y: bowl.y }, saved: JSON.parse(JSON.stringify(P)) }; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; },
    layout: function () { return L; }
  };
})();
