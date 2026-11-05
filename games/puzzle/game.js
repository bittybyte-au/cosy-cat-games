/* Cat Puzzles – a toddler game. A picture of a cat (in a teacup, on a rocket, in a boat...) is cut into a few
   big pieces with wobbly edges. The board shows a faint copy; drag each piece to its place and it clicks in.
   Finish the picture and it bounces and sparkles, then the next one comes. Picture buttons at the top choose 2, 4 or 6
   pieces (remembered).
   A piece dropped in the wrong place just stays there. A piece wiggles as a hint after a quiet while.
   Saves a count to GG.setProgress('puzzle', { done }). */
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
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
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
  function cat(c, x, y, o) { c.save(); c.translate(x, y); try { GGCat.draw(c, o); } catch (e) {} c.restore(); }
  function stars(c, n, col) { c.fillStyle = col; for (var i = 0; i < n; i++) { var x = (i * 97) % 400, y = (i * 53) % 260; c.beginPath(); for (var k = 0; k < 10; k++) { var a = k * Math.PI / 5, r = k % 2 ? 2.5 : 6; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.fill(); } }

  /* ================= pictures (each 400 x 400) ================= */
  var PICTURES = [
    function teacup(c) {
      c.fillStyle = '#FFE0EC'; c.fillRect(0, 0, 400, 400);
      c.fillStyle = '#FFC2DA'; for (var i = 0; i < 400; i += 50) for (var j = 0; j < 400; j += 50) { circle(c, i + 25, j + 25, 6); c.fill(); }
      ell(c, 200, 352, 170, 30); fillInk(c, '#FFFFFF', 5);
      cat(c, 200, 186, { preset: 'ginger', size: 190, face: 'happy' });
      c.beginPath(); c.moveTo(60, 230); c.lineTo(340, 230); c.quadraticCurveTo(330, 350, 200, 352); c.quadraticCurveTo(70, 350, 60, 230); c.closePath(); fillInk(c, '#7CC4FF', 5);
      c.beginPath(); c.arc(342, 270, 34, -1.2, 1.2); c.strokeStyle = INK; c.lineWidth = 16; c.stroke(); c.strokeStyle = '#7CC4FF'; c.lineWidth = 8; c.stroke();
      c.fillStyle = '#fff'; [[110, 280], [200, 300], [290, 280]].forEach(function (q) { circle(c, q[0], q[1], 14); c.fill(); });
    },
    function rocket(c) {
      c.fillStyle = '#2E2A5E'; c.fillRect(0, 0, 400, 400); stars(c, 22, '#FFE14D');
      circle(c, 330, 70, 36); fillInk(c, '#FFD9A8', 4);
      c.save(); c.translate(200, 210); c.rotate(0.5);
      c.beginPath(); c.moveTo(0, -150); c.quadraticCurveTo(70, -80, 60, 90); c.lineTo(-60, 90); c.quadraticCurveTo(-70, -80, 0, -150); c.closePath(); fillInk(c, '#FFFFFF', 5);
      c.beginPath(); c.moveTo(-60, 40); c.lineTo(-100, 110); c.lineTo(-56, 100); c.closePath(); fillInk(c, '#FF5A5F', 4.5);
      c.beginPath(); c.moveTo(60, 40); c.lineTo(100, 110); c.lineTo(56, 100); c.closePath(); fillInk(c, '#FF5A5F', 4.5);
      c.beginPath(); c.moveTo(-34, 96); c.quadraticCurveTo(0, 170, 34, 96); c.closePath(); fillInk(c, '#FFD23F', 4);
      circle(c, 0, -20, 48); fillInk(c, '#9EDCFF', 5);
      cat(c, 0, -14, { preset: 'purple', size: 76, face: 'happy' });
      c.restore();
    },
    function boat(c) {
      c.fillStyle = '#BFE6FF'; c.fillRect(0, 0, 400, 400);
      circle(c, 70, 70, 34); fillInk(c, '#FFE14D', 4);
      c.fillStyle = '#4DB6E8'; c.fillRect(0, 300, 400, 100);
      c.beginPath(); c.moveTo(0, 300); for (var x = 0; x <= 400; x += 25) c.lineTo(x, 300 + Math.sin(x / 25 * Math.PI) * 6); ink(c, 4);
      c.beginPath(); c.moveTo(205, 70); c.lineTo(205, 250); ink(c, 6);
      c.beginPath(); c.moveTo(212, 80); c.lineTo(320, 230); c.lineTo(212, 230); c.closePath(); fillInk(c, '#FFFFFF', 4.5);
      c.beginPath(); c.moveTo(198, 100); c.lineTo(120, 230); c.lineTo(198, 230); c.closePath(); fillInk(c, '#FF8FAB', 4.5);
      cat(c, 150, 238, { preset: 'white', size: 84, face: 'happy', pose: 'peek' });
      c.beginPath(); c.moveTo(60, 256); c.lineTo(340, 256); c.quadraticCurveTo(320, 318, 280, 318); c.lineTo(120, 318); c.quadraticCurveTo(80, 318, 60, 256); c.closePath(); fillInk(c, '#FF9F43', 5);
      c.beginPath(); c.moveTo(70, 276); c.lineTo(330, 276); c.strokeStyle = '#fff'; c.lineWidth = 7; c.stroke();
    },
    function balloon(c) {
      c.fillStyle = '#C7EBD2'; c.fillRect(0, 0, 400, 400);
      c.fillStyle = '#9FD8B2'; c.fillRect(0, 330, 400, 70); c.beginPath(); c.moveTo(0, 330); c.lineTo(400, 330); ink(c, 4);
      c.beginPath(); c.moveTo(250, 250); c.quadraticCurveTo(290, 190, 280, 140); ink(c, 3);
      c.beginPath(); c.ellipse(282, 90, 58, 66, 0.15, 0, TAU); fillInk(c, '#FF5A5F', 5);
      c.beginPath(); c.moveTo(276, 154); c.lineTo(268, 168); c.lineTo(290, 166); c.closePath(); fillInk(c, '#FF5A5F', 3);
      ell(c, 262, 66, 12, 22, 0.4); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
      cat(c, 170, 200, { preset: 'blue', size: 160, face: 'happy', pose: 'wave' });
    },
    function box(c) {
      c.fillStyle = '#FFF1DC'; c.fillRect(0, 0, 400, 400);
      c.fillStyle = '#E6B98A'; c.fillRect(0, 320, 400, 80); c.beginPath(); c.moveTo(0, 320); c.lineTo(400, 320); ink(c, 4);
      cat(c, 200, 176, { preset: 'black', size: 170, face: 'happy', pose: 'peek' });
      c.beginPath(); c.moveTo(70, 210); c.lineTo(20, 160); c.lineTo(70, 160); c.closePath(); fillInk(c, '#D9A066', 4.5);
      c.beginPath(); c.moveTo(330, 210); c.lineTo(380, 160); c.lineTo(330, 160); c.closePath(); fillInk(c, '#D9A066', 4.5);
      rr(c, 70, 210, 260, 150, 6); fillInk(c, '#E8B577', 5);
      c.beginPath(); c.moveTo(70, 236); c.lineTo(330, 236); c.strokeStyle = '#C98B5B'; c.lineWidth = 5; c.stroke();
      c.font = '800 40px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#C98B5B'; c.textAlign = 'center'; c.fillText('♥', 200, 310);
    },
    function moon(c) {
      c.fillStyle = '#3A3470'; c.fillRect(0, 0, 400, 400); stars(c, 26, '#FFF3B0');
      c.beginPath(); c.arc(200, 230, 140, 0.4, Math.PI * 2 - 0.4); c.arc(250, 190, 120, Math.PI * 2 - 0.62, 0.62, true); c.closePath(); fillInk(c, '#FFE14D', 5);
      cat(c, 150, 248, { preset: 'pink', size: 120, face: 'sleep', pose: 'lie' });
      c.font = '800 34px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#FFF3B0'; c.textAlign = 'center'; c.fillText('z', 250, 120); c.font = '800 24px "Baloo 2", system-ui, sans-serif'; c.fillText('z', 274, 92);
    }
  ];
  var picCache = {};
  function pictureCanvas(i) {
    if (picCache[i]) return picCache[i];
    var cv = document.createElement('canvas'); cv.width = cv.height = 800;
    var c = cv.getContext('2d'); c.scale(2, 2); c.lineJoin = 'round'; c.lineCap = 'round';
    PICTURES[i](c);
    return (picCache[i] = cv);
  }

  /* ================= cutting a picture into pieces =================
     A grid of cols x rows; each inside edge gets a gentle bump in or out, so pieces only fit their own place. */
  var GRIDS = { 2: [2, 1], 4: [2, 2], 6: [3, 2] };
  function edge(x0, y0, x1, y1, bump) {
    // points from (x0,y0) to (x1,y1) with a rounded bump in the middle (bump = +1 / -1 / 0)
    var pts = [], n = 24, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
    for (var i = 0; i <= n; i++) {
      var t = i / n, off = 0;
      if (bump) { var u = (t - 0.5) / 0.17; off = Math.abs(u) < 1 ? bump * 26 * Math.sqrt(1 - u * u) : 0; off += bump * 6 * Math.sin(Math.PI * t); }
      pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]);
    }
    return pts;
  }
  function cut(n) {
    var g = GRIDS[n], cols = g[0], rows = g[1], cwid = 400 / cols, chei = 400 / rows;
    var vb = [], hb = [];   // bump directions for inside edges
    for (var c = 1; c < cols; c++) { vb[c] = []; for (var r = 0; r < rows; r++) vb[c][r] = Math.random() < 0.5 ? 1 : -1; }
    for (var r2 = 1; r2 < rows; r2++) { hb[r2] = []; for (var c2 = 0; c2 < cols; c2++) hb[r2][c2] = Math.random() < 0.5 ? 1 : -1; }
    var pieces = [];
    for (var r3 = 0; r3 < rows; r3++) for (var c3 = 0; c3 < cols; c3++) {
      var x0 = c3 * cwid, x1 = x0 + cwid, y0 = r3 * chei, y1 = y0 + chei;
      var pts = []
        // a shared edge is walked one way by one piece and the other way by its neighbour (which flips which side the
        // bump goes), so top and left edges take the opposite sign: both pieces then follow exactly the same line
        .concat(edge(x0, y0, x1, y0, r3 > 0 ? hb[r3][c3] : 0))
        .concat(edge(x1, y0, x1, y1, c3 < cols - 1 ? -vb[c3 + 1][r3] : 0))
        .concat(edge(x1, y1, x0, y1, r3 < rows - 1 ? -hb[r3 + 1][c3] : 0))
        .concat(edge(x0, y1, x0, y0, c3 > 0 ? vb[c3][r3] : 0));
      var path = new Path2D(); pts.forEach(function (p, i) { if (i) path.lineTo(p[0], p[1]); else path.moveTo(p[0], p[1]); }); path.closePath();
      pieces.push({ path: path, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: cwid, h: chei });
    }
    return pieces;
  }

  /* ================= layout ================= */
  var canvas = $('stage'), ctx = canvas.getContext('2d'), topbar = $('topbar');
  var cw = 0, ch = 0, dpr = 1, K = 1, OX = 0, OY = 0, W = 1000, H = 640, BOARD = { x: 0, y: 0, s: 1 }, TRAY = null;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var top = topbar.getBoundingClientRect().bottom + 6;
    var aw = cw - 16, ah = Math.max(120, ch - top - 12);
    var tall = aw / ah < 1.1;
    var nW = tall ? 600 : 1000, nH = tall ? clamp(Math.round(600 * ah / aw), 760, 1100) : clamp(Math.round(1000 * ah / aw), 560, 720);
    var old = { W: W, H: H, B: { x: BOARD.x, y: BOARD.y, s: BOARD.s } };
    W = nW; H = nH;
    // the board, and the tray area the pieces start in
    if (tall) { var s = Math.min(1.25, (H * 0.5) / 400); BOARD = { x: (W - 400 * s) / 2, y: 30, s: s }; TRAY = { x: 30, y: 60 + 400 * s, w: W - 60, h: H - 90 - 400 * s }; }
    else { var s2 = Math.min(1.3, (H - 60) / 400, (W * 0.55) / 400); BOARD = { x: 40, y: (H - 400 * s2) / 2, s: s2 }; TRAY = { x: 80 + 400 * s2, y: 30, w: W - 110 - 400 * s2, h: H - 60 }; }
    if (pieces.length && (old.W !== W || old.H !== H)) {
      // keep pieces in sensible places when the screen changes shape
      pieces.forEach(function (p) { if (p.placed) { p.px = homeX(p); p.py = homeY(p); } else scatter(p); });
    }
    K = Math.min(aw / W, ah / H);
    OX = (cw - W * K) / 2; OY = top + (ah - H * K) / 2;
  }
  function toScene(x, y) { return { x: (x - OX) / K, y: (y - OY) / K }; }

  /* ================= a puzzle ================= */
  var P = (function () { var p = {}; try { p = GG.getProgress('puzzle') || {}; } catch (e) {} if (typeof p.done !== 'number') p.done = 0; if ([2, 4, 6].indexOf(p.size) < 0) p.size = 2; return p; })();
  function save() { try { GG.setProgress('puzzle', P); } catch (e) {} }
  var pieces = [], pic = 0, lastPic = -1, time = 0, parts = [], drag = null, idleT = 0, done = 0, round = 0;
  /* A piece is the whole picture clipped to its shape, drawn around its middle (px, py). While it waits in the
     tray it's shrunk a bit (sc) so they all fit; it grows to full size as you pick it up. */
  var TRAY_SC = 0.6;
  function homeX(p) { return BOARD.x + p.cx * BOARD.s; }
  function homeY(p) { return BOARD.y + p.cy * BOARD.s; }
  /* waiting pieces sit in a loose grid in the tray, one per cell, with a little wobble so it looks tipped out */
  function scatter(p) {
    var n = pieces.length, a = TRAY.w / TRAY.h;
    var cols = clamp(Math.round(Math.sqrt(n * a)), 1, n), rows = Math.ceil(n / cols);
    var cell = p.cell !== undefined ? p.cell : 0, cx = cell % cols, cy = Math.floor(cell / cols);
    var cwid = TRAY.w / cols, chei = TRAY.h / rows;
    p.sc = Math.min(TRAY_SC, (cwid * 0.9) / (p.w * BOARD.s), (chei * 0.9) / (p.h * BOARD.s));
    p.px = TRAY.x + (cx + 0.5) * cwid + rand(-0.06, 0.06) * cwid;
    p.py = TRAY.y + (cy + 0.5) * chei + rand(-0.06, 0.06) * chei;
    p.traySc = p.sc;
  }
  function renderSizes() { document.querySelectorAll('.size').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.n === P.size)); }); }
  document.querySelector('.sizes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-n]'); if (!b) return;
    Sound.init();
    P.size = +b.dataset.n; save(); renderSizes();
    drag = null; done = 0; doneFx = false; newPuzzle();
  });
  function newPuzzle() {
    var n = GRIDS[P.size] ? P.size : 2;
    do { pic = Math.floor(Math.random() * PICTURES.length); } while (pic === lastPic);
    lastPic = pic;
    pieces = cut(n);
    pieces.forEach(function (p) { p.px = undefined; });
    var cells = shuffle(pieces.map(function (p, i) { return i; }));
    pieces.forEach(function (p, i) { p.cell = cells[i]; scatter(p); p.placed = false; p.t = 0; p.wig = 0; });
    done = 0; idleT = 0;
    Sound.pop();
  }

  /* ================= dragging ================= */
  function pieceAt(x, y) {
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i]; if (p.placed) continue;
      var k = BOARD.s * p.sc, lx = (x - p.px) / k + p.cx, ly = (y - p.py) / k + p.cy;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); var inside = ctx.isPointInPath(p.path, lx, ly); ctx.restore();
      if (inside) return p;
      // a little extra room around small fingers
      if (Math.abs(lx - p.cx) < p.w * 0.5 + 10 && Math.abs(ly - p.cy) < p.h * 0.5 + 10) return p;
    }
    return null;
  }
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    if (done) return;
    var r = toScene(e.clientX, e.clientY), p = pieceAt(r.x, r.y);
    if (!p) return;
    idleT = 0;
    pieces.splice(pieces.indexOf(p), 1); pieces.push(p);   // on top
    drag = { p: p, id: e.pointerId, ox: p.px - r.x, oy: p.py - r.y };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    Sound.lift();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var r = toScene(e.clientX, e.clientY);
    drag.p.px = clamp(r.x + drag.ox, 20, W - 20); drag.p.py = clamp(r.y + drag.oy, 20, H - 20);
  });
  function drop(e) {
    if (!drag || drag.id !== e.pointerId) return;
    var p = drag.p; drag = null;
    // close enough to home? (generous, for little hands)
    var d = Math.hypot(p.px - homeX(p), p.py - homeY(p));
    if (d < 80 * BOARD.s + 30) {
      p.placed = true; p.t = 0; p.fx = p.px; p.fy = p.py;
      Sound.snap(); buzz(15);
      sparkle(BOARD.x + p.cx * BOARD.s, BOARD.y + p.cy * BOARD.s, '#FFD23F', 8, 0.8);
      if (pieces.every(function (q) { return q.placed; })) { done = 0.01; round++; P.done++; save(); if (GG.stat) GG.stat('puzzle', 'done', 1); }
    } else {
      Sound.drop();
      // dropped somewhere else: it shrinks back down where it is (kept on screen)
      p.sc = p.traySc || TRAY_SC;
    }
  }
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);

  /* ================= update and draw ================= */
  function update(dt) {
    time += dt;
    pieces.forEach(function (p) {
      p.t += dt; if (p.wig > 0) p.wig -= dt;
      if (p.placed && p.t < 0.25) { var k = easeOut(p.t / 0.25); p.px = lerp(p.fx, homeX(p), k); p.py = lerp(p.fy, homeY(p), k); p.sc = 1; }
      else if (p.placed) { p.px = homeX(p); p.py = homeY(p); p.sc = 1; }
      else if (drag && drag.p === p) p.sc = Math.min(1, p.sc + dt * 4);
    });
    if (done) {
      done += dt;
      if (done > 0.35 && !doneFx) { doneFx = true; Sound.win(); Sound.purr(); for (var i = 0; i < 4; i++) sparkle(BOARD.x + rand(40, 360) * BOARD.s, BOARD.y + rand(40, 360) * BOARD.s, pick(['#FFD23F', '#FF8FAB', '#7CC4FF', '#7BD389']), 12, 1.2); }
      if (done > 2.6) { doneFx = false; newPuzzle(); }
    } else {
      idleT += dt;
      if (idleT > 8) { idleT = 4; var left = pieces.filter(function (p) { return !p.placed; }); if (left.length) { var p = pick(left); p.wig = 1; p.glow = 1.6; } }
    }
    pieces.forEach(function (p) { if (p.glow > 0) p.glow -= dt; });
    for (var j = parts.length - 1; j >= 0; j--) { var q = parts[j]; q.life += dt; if (q.life >= q.max) { parts.splice(j, 1); continue; } q.vy += 300 * dt; q.vx *= 0.97; q.x += q.vx * dt; q.y += q.vy * dt; }
  }
  var doneFx = false;
  function drawPiece(c, p, lift) {
    var s = BOARD.s, img = pictureCanvas(pic);
    c.save(); c.translate(p.px, p.py); c.scale(s * p.sc, s * p.sc);
    if (p.wig > 0) c.rotate(Math.sin(p.wig * 20) * 0.08);
    c.translate(-p.cx, -p.cy); s = s * p.sc;
    if (lift) { c.save(); c.translate(6, 10); c.fillStyle = 'rgba(42,35,64,.22)'; c.fill(p.path); c.restore(); }
    c.save(); c.clip(p.path); c.drawImage(img, 0, 0, 400, 400); c.restore();
    c.lineWidth = (done ? 0 : 4) / s + 0.01; c.strokeStyle = INK; c.lineJoin = 'round';
    if (!done) c.stroke(p.path);
    c.restore();
  }
  function drawBoard(c) {
    var s = BOARD.s, B = 400 * s;
    // table
    c.fillStyle = '#F2DDC0'; c.fillRect(0, 0, W, H);
    rr(c, TRAY.x - 10, TRAY.y - 10, TRAY.w + 20, TRAY.h + 20, 28); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
    // the board with a faint copy of the picture
    var bounce = done ? 1 + Math.sin(Math.min(done, 1) * Math.PI * 3) * 0.03 * (1 - Math.min(done, 1)) : 1;
    c.save(); c.translate(BOARD.x + B / 2, BOARD.y + B / 2); c.scale(bounce, bounce); c.translate(-(BOARD.x + B / 2), -(BOARD.y + B / 2));
    rr(c, BOARD.x - 14, BOARD.y - 14, B + 28, B + 28, 26); c.fillStyle = INK; c.fill(); rr(c, BOARD.x - 14, BOARD.y - 18, B + 28, B + 28, 26); c.fillStyle = '#C98B5B'; c.fill(); ink(c, 4);
    c.save(); rr(c, BOARD.x, BOARD.y, B, B, 10); c.clip();
    c.fillStyle = '#FFF8EC'; c.fillRect(BOARD.x, BOARD.y, B, B);
    c.globalAlpha = 0.28; c.drawImage(pictureCanvas(pic), BOARD.x, BOARD.y, B, B); c.globalAlpha = 1;
    c.restore();
    // empty places: dotted outlines, glowing for a hint
    pieces.forEach(function (p) {
      if (p.placed) return;
      c.save(); c.translate(BOARD.x, BOARD.y); c.scale(s, s);
      if (p.glow > 0) { c.fillStyle = 'rgba(255,225,77,' + (0.35 + 0.25 * Math.sin(time * 8)) + ')'; c.fill(p.path); }
      c.setLineDash([10, 8]); c.lineWidth = 3 / s; c.strokeStyle = 'rgba(42,35,64,.45)'; c.stroke(p.path);
      c.restore();
    });
    // placed pieces are drawn as one shape, so there's no hairline gap where two pieces meet
    var placed = pieces.filter(function (p) { return p.placed; });
    if (placed.length) {
      var u = new Path2D(); placed.forEach(function (p) { u.addPath(p.path); });
      c.save(); c.translate(BOARD.x, BOARD.y); c.scale(s, s);
      // any piece still sliding home is drawn on its own until it lands
      var settled = placed.filter(function (p) { return p.t >= 0.25; }), su = new Path2D(); settled.forEach(function (p) { su.addPath(p.path); });
      c.save(); c.clip(su); c.drawImage(pictureCanvas(pic), 0, 0, 400, 400); c.restore();
      if (!done) { c.lineWidth = 4 / s; c.strokeStyle = INK; c.lineJoin = 'round'; settled.forEach(function (p) { c.stroke(p.path); }); }
      c.restore();
      placed.forEach(function (p) { if (p.t < 0.25) drawPiece(c, p, false); });
    }
    // once it's finished, the whole picture is shown in one go
    if (done) c.drawImage(pictureCanvas(pic), BOARD.x, BOARD.y, B, B);
    if (done) { rr(c, BOARD.x, BOARD.y, B, B, 10); ink(c, 5); }
    c.restore();
    pieces.forEach(function (p) { if (!p.placed) drawPiece(c, p, drag && drag.p === p); });
  }
  function sparkle(x, y, color, n, spd) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 200) * (spd || 1); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0, max: rand(0.6, 1), r: rand(6, 10), color: Math.random() < 0.3 ? '#fff' : color, spin: rand(-5, 5) }); }
  }
  function drawParts(c) {
    parts.forEach(function (p) {
      var k = 1 - p.life / p.max;
      c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y); c.rotate(p.life * p.spin);
      c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? p.r * 0.6 : p.r * 1.3; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath();
      c.fillStyle = p.color; c.fill(); ink(c, 2);
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
      lift: function () { tone({ f: 500, to: 700, dur: 0.07, gain: 0.07, type: 'triangle' }); },
      snap: function () { tone({ f: 784, dur: 0.18, gain: 0.12 }); tone({ f: 1175, dur: 0.22, gain: 0.08, delay: 0.06 }); noise({ type: 'lowpass', freq: 600, q: 1, attack: 0.002, dur: 0.05, gain: 0.12 }); },
      drop: function () { tone({ f: 330, to: 280, dur: 0.08, gain: 0.06, type: 'triangle' }); },
      win: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.45, gain: 0.1, delay: i * 0.09 }); }); },
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
    drawBoard(ctx);
    drawParts(ctx);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rr(ctx, OX, OY, W * K, H * K, 24); ink(ctx, 5);
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 200); });
  document.addEventListener('visibilitychange', function () { last = performance.now(); });

  layout();
  renderSizes();
  newPuzzle();
  requestAnimationFrame(frame);

  /* test hook */
  window.__puzzle = {
    state: function () { return { n: pieces.length, placed: pieces.filter(function (p) { return p.placed; }).length, done: done, round: round, saved: P.done,
      pieces: pieces.map(function (p) { return { x: p.px, y: p.py, hx: homeX(p), hy: homeY(p), placed: p.placed }; }) }; },
    toScreen: function (x, y) { return { x: OX + x * K, y: OY + y * K }; }
  };
})();
