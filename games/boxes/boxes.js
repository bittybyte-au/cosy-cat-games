/* Cardboard boxes and the surprises inside them, shared by Peekaboo Boxes and Kitten in a Box.
   window.GGBoxes = { drawBack, drawFront, drawSurprise, pickSurprise, kitten, room, bits, KITTEN_COLS, BOX_COLS, dims }
   A box is drawn from the middle of its bottom edge, `w` wide; `open` is 0 (flaps shut) .. 1 (flaps wide open).
   Draw order for a box with something inside: drawBack (inside + back flaps), the thing, drawFront (front + front flap).
   Drawn in the house style with the shared kit (shared/draw.js, loaded first): details and shading inside each
   shape, outline last. room() is the room both games play in; bits() makes their sparkles and hearts. */
(function () {
  'use strict';
  var D = window.GGDraw, INK = D.INK, TAU = Math.PI * 2;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fillInk(c, col, w) { c.fillStyle = col; c.fill(); D.ink(c, w); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function poly(pts) { var p = new Path2D(); pts.forEach(function (q, i) { if (i) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); }); p.closePath(); return p; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  var BOX_COLS = ['#E8B577', '#E2A866', '#EDC08A', '#D9A066'];
  var TAPE = 'rgba(255,255,255,.35)';
  /* box proportions: the body is w wide, h = w * 0.78 tall */
  function dims(w) { return { h: w * 0.78, top: w * 0.18 }; }

  function drawBack(c, x, y, w, open, col) {
    var d = dims(w), top = y - d.h, i = d.top * 0.6;
    col = col || BOX_COLS[0];
    // the dark inside of the box
    D.shape(c, poly([[x - w / 2, top], [x - w / 2 + i, top - d.top], [x + w / 2 - i, top - d.top], [x + w / 2, top]]), D.darker(col, 0.45), { lw: D.LW.mid, depth: 0 });
    // the back flap folds up and back as the box opens; it starts at the back edge, under the opening's outline
    var a = open;
    if (a > 0.02) D.shape(c, poly([[x - w / 2 + i, top - d.top], [x + w / 2 - i, top - d.top], [x + w / 2 - i, top - d.top - w * 0.32 * a], [x - w / 2 + i, top - d.top - w * 0.32 * a]]), D.darker(col, 0.12), { lw: D.LW.mid, depth: 5 });
  }
  function drawFront(c, x, y, w, open, col, wob) {
    var d = dims(w), top = y - d.h, i = d.top * 0.6;
    col = col || BOX_COLS[0];
    c.save();
    if (wob) { c.translate(x, y); c.rotate(wob); c.translate(-x, -y); }
    // side flaps swing out from the box's top corners (drawn first, so the front covers where they join)
    var a = open;
    if (a > 0.02) [-1, 1].forEach(function (s) {
      var bx = x + s * w / 2;
      D.shape(c, poly([[bx, top], [bx - s * i, top - d.top], [bx - s * i + s * w * 0.38 * a, top - d.top - w * 0.12 * a], [bx + s * w * 0.36 * a, top + w * 0.04 * a]]), D.darker(col, 0.08), { lw: D.LW.mid, depth: 5 });
    });
    // the front: a fold line and the tape inside it, the soft crescent, then the outline
    D.shape(c, D.rrPath(x - w / 2, top, w, d.h, 6), col, { lw: D.LW.big, depth: Math.max(6, w * 0.05), inside: function (c) {
      c.beginPath(); c.moveTo(x - w / 2 + 10, top + d.h * 0.18); c.lineTo(x + w / 2 - 10, top + d.h * 0.18); c.strokeStyle = D.darker(col, 0.18); c.lineWidth = 5; c.lineCap = 'round'; c.stroke();
      c.fillStyle = TAPE; c.fillRect(x - w * 0.08, top - 2, w * 0.16, d.h * 0.32);
    } });
    // front flap: lies flat over the top when shut, folds down over the front when open
    var fh = d.top * 1.15, pts;
    if (a < 0.5) {
      var k = 1 - a * 2;   // 1 = shut (pointing back over the opening) .. 0 = straight up
      var ty = top - fh * (k ? 0.9 : 1) - (1 - k) * fh * 0.4;
      pts = [[x - w / 2, top], [x + w / 2, top], [x + w / 2 - i * k, ty], [x - w / 2 + i * k, ty]];
    } else {
      var k2 = (a - 0.5) * 2;   // 0 = straight up .. 1 = hanging down the front
      var tipY = top - fh * 1.4 * (1 - k2) + fh * 1.0 * k2;
      pts = [[x - w / 2, top], [x + w / 2, top], [x + w / 2 + 4 * k2, tipY], [x - w / 2 - 4 * k2, tipY]];
    }
    // the tape carries on over the flap, so a shut box looks taped up
    D.shape(c, poly(pts), D.darker(col, 0.05), { lw: D.LW.mid, depth: 3, inside: function (c) { c.fillStyle = TAPE; c.fillRect(x - w * 0.08, top - fh * 2, w * 0.16, fh * 4); } });
    c.restore();
  }

  /* surprises (drawn from where they'd sit in the box: x, y = the box opening; size ~ box width) */
  var KITTEN_COLS = [{ preset: 'ginger' }, { preset: 'pink' }, { preset: 'blue' }, { preset: 'purple' }, { preset: 'white' }, { preset: 'black' }, { color: '#C9C2D6', markings: 'tabby' }, { color: '#FFFFFF', markings: 'calico' }];
  function kitten(c, x, y, size, look, face, pose) {
    var o = {}; for (var k in look) o[k] = look[k]; o.size = size; o.face = face || 'happy'; if (pose) o.pose = pose;
    c.save(); c.translate(x, y); try { GGCat.draw(c, o); } catch (e) { circle(c, 0, 0, size / 2); fillInk(c, '#FFA94D', 4); } c.restore();
  }
  // shapes for the toys, made once (in their own units; each surprise scales them)
  var MOUSE_BODY = (function () { var p = new Path2D(); p.moveTo(-34, 18); p.quadraticCurveTo(-34, -24, 4, -24); p.quadraticCurveTo(40, -20, 42, 14); p.quadraticCurveTo(10, 24, -34, 18); p.closePath(); return p; })();
  var MOUSE_TAIL = (function () { var p = new Path2D(); p.moveTo(-26, 10); p.quadraticCurveTo(-52, 4, -50, -16); return p; })();
  var FISH = (function () { var p = new Path2D(); p.moveTo(-44, 0); p.quadraticCurveTo(-8, -34, 26, -6); p.lineTo(46, -24); p.lineTo(42, 4); p.lineTo(48, 26); p.lineTo(26, 8); p.quadraticCurveTo(-8, 32, -44, 0); p.closePath(); return p; })();
  var WING_UP = D.ellPath(22, -14, 22, 18, -0.4), WING_DOWN = D.ellPath(18, 18, 15, 13, 0.4), BUG = D.rrPath(-6, -26, 12, 52, 6);
  var SURPRISES = {
    kitten: function (c, x, y, w, t, s) { kitten(c, x, y - w * 0.18 - Math.abs(Math.sin(t * 6)) * w * 0.04, w * 0.62, s.look, t % 2 < 0.15 ? 'blink' : 'happy', 'peek'); },
    two: function (c, x, y, w, t, s) { kitten(c, x - w * 0.2, y - w * 0.12, w * 0.46, s.look, 'happy', 'peek'); kitten(c, x + w * 0.2, y - w * 0.16 - Math.abs(Math.sin(t * 5)) * w * 0.04, w * 0.46, s.look2, 'open', 'peek'); },
    sleepy: function (c, x, y, w, t, s) { kitten(c, x, y - w * 0.12, w * 0.58, s.look, 'sleep', 'peek'); c.font = '800 ' + Math.round(w * 0.16) + 'px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#7A6F8E'; c.textAlign = 'center'; c.fillText('z', x + w * 0.3, y - w * 0.55 - (t * 20 % 20)); },
    wave: function (c, x, y, w, t, s) { kitten(c, x, y - w * 0.32, w * 0.5, s.look, 'happy', 'wave'); },
    yarn: function (c, x, y, w, t) {
      var r = w * 0.2, cy = y - w * 0.18 - Math.abs(Math.sin(t * 5)) * w * 0.12;
      // wool strands and shading inside the ball, outline on top
      D.shape(c, D.ellPath(x, cy, r, r), '#FF5A7A', { lw: D.LW.mid, depth: r * 0.22, shine: [x - r * 0.4, cy - r * 0.45, r * 0.22, r * 0.14, -0.5, 0.4], inside: function (c) {
        c.strokeStyle = 'rgba(42,35,64,.3)'; c.lineWidth = 3;
        for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x - r, cy + i * r * 0.35 - r * 0.3); c.quadraticCurveTo(x, cy + i * r * 0.35 + r * 0.3, x + r, cy + i * r * 0.35 - r * 0.3); c.stroke(); }
      } });
    },
    mouse: function (c, x, y, w, t) {
      var cy = y - w * 0.16, s = w / 200 * 1.4;
      c.save(); c.translate(x + Math.sin(t * 3) * w * 0.05, cy); c.scale(s, s);
      // tail and ear start inside the body and go first, so the body covers the joins
      c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 9; c.stroke(MOUSE_TAIL); c.strokeStyle = '#FF8FAB'; c.lineWidth = 4; c.stroke(MOUSE_TAIL);
      D.shape(c, D.ellPath(4, -24, 13, 13), '#FFB3C7', { lw: D.LW.mid, depth: 3 });
      D.shape(c, MOUSE_BODY, '#C9C2D6', { lw: D.LW.mid, depth: 6, inside: function (c) { circle(c, 24, -4, 4.5); c.fillStyle = INK; c.fill(); } });
      circle(c, 42, 12, 5); c.fillStyle = "#FF7FA6"; c.fill(); D.ink(c, 2.5);
      c.restore();
    },
    butterfly: function (c, x, y, w, t) {
      var cx = x + Math.sin(t * 2) * w * 0.3, cy = y - w * 0.3 - t * w * 0.35, flap = Math.abs(Math.sin(t * 14));
      c.save(); c.translate(cx, cy); c.scale(w / 220, w / 220);
      [-1, 1].forEach(function (s) {
        c.save(); c.scale(s * (0.4 + 0.6 * flap), 1);
        D.shape(c, WING_DOWN, '#FF8FAB', { lw: D.LW.mid, depth: 3 }); D.shape(c, WING_UP, '#B48CFF', { lw: D.LW.mid, depth: 4 });
        c.restore();
      });
      D.shape(c, BUG, '#3D3650', { lw: D.LW.fine, depth: 0 });
      c.restore();
    },
    stars: function (c, x, y, w, t) {
      for (var i = 0; i < 7; i++) {
        var a = -Math.PI / 2 + (i - 3) * 0.32, d = w * (0.2 + t * 0.6), sx = x + Math.cos(a) * d, sy = y - w * 0.1 + Math.sin(a) * d;
        c.save(); c.translate(sx, sy); c.rotate(t * 3 + i); c.beginPath(); for (var k = 0; k < 10; k++) { var b = k * Math.PI / 5 - Math.PI / 2, r = (k % 2 ? 0.45 : 1) * w * 0.06; c.lineTo(Math.cos(b) * r, Math.sin(b) * r); } c.closePath();
        fillInk(c, ['#FFD23F', '#FF8FAB', '#7CC4FF', '#7BD389'][i % 4], 2.5); c.restore();
      }
    },
    fish: function (c, x, y, w, t) {
      var cy = y - w * 0.2 - Math.abs(Math.sin(t * 5)) * w * 0.1;
      c.save(); c.translate(x, cy); c.rotate(Math.sin(t * 6) * 0.2); c.scale(w / 230, w / 230);
      D.shape(c, FISH, '#7CC4FF', { lw: D.LW.big, depth: 7, shine: [-20, -12, 10, 4, -0.3, 0.45], inside: function (c) { circle(c, -26, -4, 5); c.fillStyle = INK; c.fill(); } });
      c.restore();
    }
  };
  /* a fresh surprise: mostly kittens, sometimes a toy, a butterfly or a burst of stars */
  function pickSurprise(rnd) {
    rnd = rnd || Math.random;
    var bag = ['kitten', 'kitten', 'kitten', 'two', 'sleepy', 'wave', 'wave', 'yarn', 'mouse', 'butterfly', 'stars', 'fish'];
    var kind = bag[Math.floor(rnd() * bag.length)];
    var l1 = KITTEN_COLS[Math.floor(rnd() * KITTEN_COLS.length)], l2;
    do { l2 = KITTEN_COLS[Math.floor(rnd() * KITTEN_COLS.length)]; } while (l2 === l1);
    return { kind: kind, look: l1, look2: l2 };
  }
  function drawSurprise(c, s, x, y, w, t) { (SURPRISES[s.kind] || SURPRISES.kitten)(c, x, y, w, t, s); }

  /* the room both games play in: striped wallpaper and a wooden floor (scenery from shared/scene.js, loaded first) */
  function room(c, W, H) {
    var fy = H * 0.62;
    GGScene.wall(c, 20 - 64, 0, W + 64, fy, { pattern: 'stripes', col: '#FFF1DC', col2: '#FFE4C4', size: 64 });
    GGScene.floor(c, 0, fy, W, H - fy, { kind: 'planks', col: '#E6B98A', col2: '#D9A877', size: 50 });
  }
  /* sparkles and hearts: var fx = GGBoxes.bits(); fx.sparkle(...), fx.heart(...), then fx.update(dt) and fx.draw(c) each frame */
  function bits() {
    var parts = [];
    return {
      sparkle: function (x, y, color, n, spd) {
        if (reduceMotion) n = Math.ceil(n / 3);
        for (var i = 0; i < n; i++) { var a = rand(0, TAU), sp = rand(60, 220) * (spd || 1); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90, life: 0, max: rand(0.6, 1.0), r: rand(6, 10), color: Math.random() < 0.3 ? '#fff' : color, spin: rand(-5, 5) }); }
      },
      heart: function (x, y) { parts.push({ x: x, y: y, vx: rand(-20, 20), vy: -90, life: 0, max: 1.2, r: 18, color: '#FF7EB6', heart: true, g: -10 }); },
      update: function (dt) { for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life += dt; if (p.life >= p.max) { parts.splice(i, 1); continue; } p.vy += (p.g !== undefined ? p.g : 380) * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; } },
      draw: function (c) {
        parts.forEach(function (p) {
          var k = 1 - p.life / p.max;
          c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.translate(p.x, p.y);
          if (p.heart) { var r = p.r; c.beginPath(); c.moveTo(0, r * 0.4); c.bezierCurveTo(-r * 1.2, -r * 0.4, -r * 0.5, -r * 1.2, 0, -r * 0.5); c.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.2, -r * 0.4, 0, r * 0.4); fillInk(c, p.color, 2); }
          else { c.rotate(p.life * p.spin); c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? p.r * 0.6 : p.r * 1.3; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); fillInk(c, p.color, 2); }
          c.restore();
        });
      }
    };
  }

  window.GGBoxes = { drawBack: drawBack, drawFront: drawFront, drawSurprise: drawSurprise, pickSurprise: pickSurprise, kitten: kitten, room: room, bits: bits, KITTEN_COLS: KITTEN_COLS, BOX_COLS: BOX_COLS, dims: dims };
})();
