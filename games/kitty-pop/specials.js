/* Kitty Match – special cats (optional add-on).

   ON/OFF SWITCH: set ENABLED to false below to turn special cats off.
   You can also delete the specials.js <script> line in index.html; the game works the same without this file.

   - Line up 4 in a row      → ZOOMY cat: zooms along its row (or column) and pops every cat it passes.
   - Make an L or T shape     → BIG YAWN cat: yawns and pops the cats around it.
   - Line up 5 in a row      → RAINBOW cat: swap it with any cat to pop every cat of that colour.
   Swapping two special cats sets both off. Two rainbow cats together pop the whole board. */
(function () {
  'use strict';

  var ENABLED = true;

  var TAU = Math.PI * 2;
  var api = null;
  var effects = [];
  var time = 0;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function hue(i) { return 'hsl(' + ((i * 360) % 360) + ',95%,72%)'; }
  /* A diagonal rainbow that slowly drifts, so the rainbow cat never looks like a plain one. */
  function rainbowFill(c, s, now) {
    var g = c.createLinearGradient(-s * 0.45, -s * 0.4, s * 0.45, s * 0.4);
    for (var i = 0; i <= 6; i++) g.addColorStop(i / 6, 'hsl(' + ((i * 55 + now * 90) % 360) + ',95%,74%)');
    return g;
  }

  /* ---------- making specials from matches ---------- */
  function creations(groups, swapped) {
    var out = [];
    groups.forEach(function (g) {
      var longest = g.runs[0], hasH = false, hasV = false;
      g.runs.forEach(function (run) {
        if (run.cells.length > longest.cells.length) longest = run;
        if (run.dir === 'h') hasH = true; else hasV = true;
      });
      var len = longest.cells.length;
      var special = len >= 5 ? 'rainbow' : (hasH && hasV) ? 'yawn' : len === 4 ? 'zoomy' : null;
      if (!special) return;

      function usable(p) { var t = api.get(p.r, p.c); return t && !t.special; }
      var pos = null;
      // put it where the player moved, if that cat is part of the match
      (swapped || []).forEach(function (s) { if (!pos && g.keys[s.r + ',' + s.c] && usable(s)) pos = s; });
      if (!pos && special === 'yawn') {
        // where the two lines cross
        var hKeys = {};
        g.runs.forEach(function (run) { if (run.dir === 'h') run.cells.forEach(function (p) { hKeys[p.r + ',' + p.c] = true; }); });
        g.runs.forEach(function (run) { if (run.dir === 'v') run.cells.forEach(function (p) { if (!pos && hKeys[p.r + ',' + p.c] && usable(p)) pos = p; }); });
      }
      if (!pos) { var mid = longest.cells[Math.floor(len / 2)]; if (usable(mid)) pos = mid; }
      if (!pos) g.cells.forEach(function (p) { if (!pos && usable(p)) pos = p; });
      if (!pos) return;
      out.push({ r: pos.r, c: pos.c, special: special, kind: special === 'rainbow' ? -1 : g.kind, dir: longest.dir });
    });
    return out;
  }

  /* ---------- setting specials off ---------- */
  function rowOrColumn(r, c, dir) {
    var list = [];
    if (dir === 'v') { for (var rr = 0; rr < api.ROWS; rr++) if (rr !== r) list.push({ r: rr, c: c, delay: 0.06 + Math.abs(rr - r) * 0.045 }); }
    else { for (var cc = 0; cc < api.COLS; cc++) if (cc !== c) list.push({ r: r, c: cc, delay: 0.06 + Math.abs(cc - c) * 0.045 }); }
    return list;
  }
  function around(r, c) {
    var list = [];
    for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
      var d = Math.abs(dr) + Math.abs(dc);
      if (d === 0 || d > 2) continue;
      var rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= api.ROWS || cc >= api.COLS) continue;
      list.push({ r: rr, c: cc, delay: 0.12 + d * 0.07 });
    }
    return list;
  }
  function allOfKind(kind, r, c) {
    var list = [];
    for (var rr = 0; rr < api.ROWS; rr++) for (var cc = 0; cc < api.COLS; cc++) {
      var t = api.get(rr, cc);
      if (t && !t.pop && t.kind === kind && !(rr === r && cc === c)) list.push({ r: rr, c: cc, d: Math.hypot(rr - r, cc - c) });
    }
    list.sort(function (a, b) { return a.d - b.d; });
    list.forEach(function (p, i) { p.delay = 0.3 + i * 0.035; });
    return list;
  }
  function mostCommonKind() {
    var best = -1, n = -1;
    api.coloursInPlay().forEach(function (k) { var m = api.countKind(k); if (m > n) { n = m; best = k; } });
    return best;
  }

  function blast(t, r, c, delay) {
    if (t.spent) return [];
    t.spent = true;
    var p = api.cellCenter(r, c);
    if (t.special === 'zoomy') {
      effects.push({ type: 'zoom', r: r, c: c, dir: t.dir, kind: t.kind, t: -delay });
      api.sound.noise({ freq: 900, toFreq: 4200, q: 0.9, attack: 0.04, dur: 0.3, gain: 0.12, delay: delay });
      api.sound.tone({ f: 380, to: 900, dur: 0.25, gain: 0.06, type: 'triangle', delay: delay });
      return rowOrColumn(r, c, t.dir);
    }
    if (t.special === 'yawn') {
      effects.push({ type: 'yawn', x: p.x, y: p.y, kind: t.kind, t: -delay });
      api.sound.tone({ f: 520, to: 210, dur: 0.55, gain: 0.08, type: 'triangle', slide: 0.5, delay: delay });
      api.sound.noise({ type: 'lowpass', freq: 600, q: 0.7, attack: 0.15, dur: 0.4, gain: 0.08, delay: delay });
      return around(r, c);
    }
    if (t.special === 'rainbow') {
      var targets = allOfKind(mostCommonKind(), r, c);
      rainbowEffect(p, targets, delay);
      return targets;
    }
    return [];
  }

  function rainbowEffect(p, targets, delay) {
    effects.push({ type: 'rainbow', x: p.x, y: p.y, t: -delay, targets: targets.map(function (q, i) { var cp = api.cellCenter(q.r, q.c); return { x: cp.x, y: cp.y, delay: q.delay, i: i }; }) });
    [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { api.sound.tone({ f: f, dur: 0.25, gain: 0.05, type: 'triangle', delay: delay + i * 0.07 }); });
  }

  /* Swaps that work even without a line of three. */
  function swapActivates(a, b) {
    return a.special === 'rainbow' || b.special === 'rainbow' || (!!a.special && !!b.special);
  }
  function onSwap(a, ra, ca, b, rb, cb) {
    if (!swapActivates(a, b)) return null;
    var list = [{ r: ra, c: ca, delay: 0 }, { r: rb, c: cb, delay: 0 }];
    if (a.special === 'rainbow' && b.special === 'rainbow') {
      a.spent = b.spent = true;
      var all = [];
      for (var r = 0; r < api.ROWS; r++) for (var c = 0; c < api.COLS; c++) {
        if ((r === ra && c === ca) || (r === rb && c === cb)) continue;
        all.push({ r: r, c: c, delay: 0.3 + Math.hypot(r - ra, c - ca) * 0.06 });
      }
      rainbowEffect(api.cellCenter(ra, ca), all.filter(function (q, i) { return i % 2 === 0; }), 0);
      return list.concat(all);
    }
    if (a.special === 'rainbow' || b.special === 'rainbow') {
      var rain = a.special === 'rainbow' ? a : b, other = rain === a ? b : a;
      var rp = rain === a ? { r: ra, c: ca } : { r: rb, c: cb };
      rain.spent = true;
      var kind = other.kind >= 0 ? other.kind : mostCommonKind();
      var targets = allOfKind(kind, rp.r, rp.c);
      rainEffectAt(rp, targets);
      return list.concat(targets);
    }
    return list; // two zoomy / yawn cats: both go off
  }
  function rainEffectAt(rp, targets) { rainbowEffect(api.cellCenter(rp.r, rp.c), targets, 0); }

  function madeSound() {
    api.sound.tone({ f: 1318.5, dur: 0.18, gain: 0.07, type: 'triangle', delay: 0.05 });
    api.sound.tone({ f: 1760, dur: 0.25, gain: 0.06, type: 'triangle', delay: 0.13 });
  }

  /* ---------- drawing special cats on the board ----------
     The context is already moved to the cat's centre. Return true when we drew the whole cat. */
  function drawTile(c, t, size, face, now) {
    var ink = '#2A2340';
    if (t.special === 'rainbow') {
      c.save();
      c.rotate(Math.sin(now * 3) * 0.08);
      api.drawCat(c, 0, face === 'blink' ? 'blink' : 'happy', size, rainbowFill(c, size, now));
      // little orbiting stars
      for (var i = 0; i < 3; i++) {
        var a = now * 2.2 + i * TAU / 3;
        c.save(); c.translate(Math.cos(a) * size * 0.5, Math.sin(a) * size * 0.42);
        star(c, size * 0.08); c.fillStyle = hue(i / 3 + now * 0.2); c.fill(); c.lineWidth = 1.5; c.strokeStyle = ink; c.stroke();
        c.restore();
      }
      c.restore();
      return true;
    }
    if (t.special === 'yawn') {
      // a soft pulsing ring behind the cat
      var pr = 0.5 + Math.sin(now * 4) * 0.04;
      c.beginPath(); c.arc(0, 0, size * pr, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
      c.lineWidth = Math.max(2, size * 0.05); c.setLineDash([size * 0.09, size * 0.07]); c.lineDashOffset = -now * 20; c.strokeStyle = api.CATS[t.kind].dark; c.stroke(); c.setLineDash([]);
      var yawning = (now + t.id * 0.37) % 3.2 < 0.7;
      api.blitCat(c, t.kind, yawning ? 'yawn' : face, 0, 0, size * 0.92);
      return true;
    }
    if (t.special === 'zoomy') {
      // speed lines either side, showing which way it will zoom
      var col = api.CATS[t.kind].dark;
      c.save();
      if (t.dir === 'v') c.rotate(Math.PI / 2);
      c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = Math.max(2, size * 0.06);
      var off = (now * 1.6) % 1;
      [-1, 1].forEach(function (side) {
        for (var k = 0; k < 2; k++) {
          var o = size * (0.44 + ((off + k * 0.5) % 1) * 0.12);
          var len = size * 0.12;
          c.globalAlpha = 0.9;
          c.beginPath(); c.moveTo(side * o, -size * 0.1 + k * size * 0.2); c.lineTo(side * (o + len), -size * 0.1 + k * size * 0.2); c.stroke();
        }
        // chevron
        c.beginPath();
        c.moveTo(side * size * 0.48, -size * 0.17); c.lineTo(side * size * 0.58, 0); c.lineTo(side * size * 0.48, size * 0.17);
        c.lineWidth = Math.max(2, size * 0.07); c.stroke();
      });
      c.restore();
      api.blitCat(c, t.kind, face, 0, 0, size * 0.86);
      return true;
    }
    return false;
  }

  function star(c, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath();
  }

  /* ---------- the blast animations ---------- */
  function update(dt) {
    time += dt;
    for (var i = effects.length - 1; i >= 0; i--) {
      var e = effects[i];
      e.t += dt;
      if (e.t > (e.type === 'rainbow' ? 1.6 + (e.targets.length * 0.035) : 0.9)) effects.splice(i, 1);
    }
  }

  function draw(c) {
    var T = api.tileSize();
    effects.forEach(function (e) {
      if (e.t < 0) return;
      if (e.type === 'zoom') drawZoom(c, e, T);
      else if (e.type === 'yawn') drawYawn(c, e, T);
      else if (e.type === 'rainbow') drawRainbow(c, e, T);
    });
  }

  function drawZoom(c, e, T) {
    var o = api.cellCenter(e.r, e.c);
    var span = e.dir === 'v' ? api.ROWS : api.COLS;
    var speed = 1 / 0.045; // cells per second, matching the pop timing
    var travel = e.t * speed;
    var fade = clamp(1 - (travel - span) / 2, 0, 1);
    [-1, 1].forEach(function (side) {
      var dx = e.dir === 'v' ? 0 : side, dy = e.dir === 'v' ? side : 0;
      var x = o.x + dx * travel * T, y = o.y + dy * travel * T;
      c.save();
      c.globalAlpha = fade;
      // speed trail
      var grad = c.createLinearGradient(o.x, o.y, x, y);
      grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(255,255,255,.85)');
      c.strokeStyle = grad; c.lineCap = 'round'; c.lineWidth = T * 0.5;
      c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(x, y); c.stroke();
      c.strokeStyle = api.CATS[e.kind].dark; c.lineWidth = Math.max(2, T * 0.05);
      for (var k = -1; k <= 1; k++) {
        var px = e.dir === 'v' ? k * T * 0.2 : 0, py = e.dir === 'v' ? 0 : k * T * 0.2;
        c.beginPath(); c.moveTo(x - dx * T * 0.9 + px, y - dy * T * 0.9 + py); c.lineTo(x - dx * T * 0.45 + px, y - dy * T * 0.45 + py); c.stroke();
      }
      c.translate(x, y);
      if (e.dir !== 'v') c.scale(side, 1);
      c.rotate(e.dir === 'v' ? 0 : 0.18);
      api.blitCat(c, e.kind, 'happy', 0, 0, T * 0.8);
      c.restore();
    });
  }

  function drawYawn(c, e, T) {
    var p = clamp(e.t / 0.8, 0, 1);
    c.save();
    // expanding ring
    c.globalAlpha = 1 - p;
    c.beginPath(); c.arc(e.x, e.y, T * (0.4 + easeOut(p) * 2.3), 0, TAU);
    c.lineWidth = T * 0.35 * (1 - p) + 2; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
    c.lineWidth = Math.max(2, T * 0.06); c.strokeStyle = api.CATS[e.kind].fill; c.stroke();
    // the cat stretching into a big yawn
    c.globalAlpha = clamp(1.4 - p * 1.4, 0, 1);
    c.translate(e.x, e.y);
    var s = 1 + Math.sin(Math.min(1, p * 1.6) * Math.PI) * 0.7;
    c.scale(s, s);
    api.blitCat(c, e.kind, 'yawn', 0, 0, T * 0.86);
    c.restore();
  }

  function drawRainbow(c, e, T) {
    c.save();
    c.lineCap = 'round';
    e.targets.forEach(function (q) {
      var start = q.delay - 0.28;
      var p = clamp((e.t - start) / 0.28, 0, 1);
      if (p <= 0) return;
      var after = clamp((e.t - q.delay) / 0.4, 0, 1);
      c.globalAlpha = 1 - after;
      var x = lerp(e.x, q.x, easeOut(p)), y = lerp(e.y, q.y, easeOut(p));
      c.strokeStyle = hue(q.i / 7 + e.t * 0.3); c.lineWidth = Math.max(2, T * 0.07);
      c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(x, y); c.stroke();
      c.save(); c.translate(x, y); c.rotate(e.t * 6);
      star(c, T * 0.14); c.fillStyle = '#FFF6B0'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#2A2340'; c.stroke();
      c.restore();
    });
    // the rainbow cat spins and fades at the centre
    var p0 = clamp(e.t / 0.6, 0, 1);
    c.globalAlpha = clamp(1.5 - p0 * 1.5, 0, 1);
    c.translate(e.x, e.y); c.rotate(easeOut(p0) * TAU); c.scale(1 + p0 * 0.5, 1 + p0 * 0.5);
    api.drawCat(c, 0, 'happy', T * 0.86, rainbowFill(c, T * 0.86, e.t * 3));
    c.restore();
  }

  window.KittySpecials = {
    enabled: ENABLED,
    setup: function (a) { api = a; },
    creations: creations,
    blast: blast,
    swapActivates: swapActivates,
    onSwap: onSwap,
    madeSound: madeSound,
    drawTile: drawTile,
    update: update,
    draw: draw
  };
})();
