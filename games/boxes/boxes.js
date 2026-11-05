/* Cardboard boxes and the surprises inside them, shared by Peekaboo Boxes and Kitten in a Box.
   window.GGBoxes = { drawBack, drawFront, drawSurprise, SURPRISES, BOX_COLS }
   A box is drawn from the middle of its bottom edge, `w` wide; `open` is 0 (flaps shut) .. 1 (flaps wide open).
   Draw order for a box with something inside: drawBack (inside + back flaps), the thing, drawFront (front + front flap). */
(function () {
  'use strict';
  var INK = '#2A2340', TAU = Math.PI * 2;
  function ink(c, w) { c.lineWidth = w || 4; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  function fillInk(c, col, w) { c.fillStyle = col; c.fill(); ink(c, w); }
  function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.round(r * (1 - k)); g = Math.round(g * (1 - k)); b = Math.round(b * (1 - k)); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }

  var BOX_COLS = ['#E8B577', '#E2A866', '#EDC08A', '#D9A066'];
  /* box proportions: the body is w wide, h = w * 0.78 tall */
  function dims(w) { return { h: w * 0.78, top: w * 0.18 }; }

  function drawBack(c, x, y, w, open, col) {
    var d = dims(w), top = y - d.h;
    col = col || BOX_COLS[0];
    // the dark inside of the box
    c.beginPath(); c.moveTo(x - w / 2, top); c.lineTo(x - w / 2 + d.top * 0.6, top - d.top); c.lineTo(x + w / 2 - d.top * 0.6, top - d.top); c.lineTo(x + w / 2, top); c.closePath();
    fillInk(c, shade(col, 0.45), 4);
    // the back flap folds up and back as the box opens
    var a = open;
    c.beginPath(); c.moveTo(x - w / 2 + d.top * 0.6, top - d.top); c.lineTo(x + w / 2 - d.top * 0.6, top - d.top);
    c.lineTo(x + w / 2 - d.top * 0.6, top - d.top - w * 0.32 * a); c.lineTo(x - w / 2 + d.top * 0.6, top - d.top - w * 0.32 * a); c.closePath();
    if (a > 0.02) fillInk(c, shade(col, 0.12), 4);
  }
  function drawFront(c, x, y, w, open, col, wob) {
    var d = dims(w), top = y - d.h;
    col = col || BOX_COLS[0];
    c.save();
    if (wob) { c.translate(x, y); c.rotate(wob); c.translate(-x, -y); }
    // side flaps swing out
    var a = open;
    [-1, 1].forEach(function (s) {
      var bx = x + s * w / 2, bt = top;
      c.beginPath(); c.moveTo(bx, bt); c.lineTo(bx - s * d.top * 0.6, bt - d.top);
      c.lineTo(bx - s * d.top * 0.6 + s * w * 0.38 * a, bt - d.top - w * 0.12 * a + (1 - a) * w * 0.0);
      c.lineTo(bx + s * w * 0.36 * a - s * w * 0.0 * (1 - a), bt + w * 0.04 * a); c.closePath();
      if (a > 0.02) fillInk(c, shade(col, 0.08), 4);
    });
    // the front of the box
    rr(c, x - w / 2, top, w, d.h, 6); fillInk(c, col, 5);
    c.beginPath(); c.moveTo(x - w / 2 + 10, top + d.h * 0.18); c.lineTo(x + w / 2 - 10, top + d.h * 0.18); c.strokeStyle = shade(col, 0.18); c.lineWidth = 5; c.stroke();
    // tape
    rr(c, x - w * 0.08, top, w * 0.16, d.h * 0.32, 3); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
    // front flap: lies flat over the top when shut, folds down over the front when open
    var fh = d.top * 1.15;
    c.beginPath();
    if (a < 0.5) {
      var k = 1 - a * 2;   // 1 = shut (pointing back over the opening) .. 0 = straight up
      c.moveTo(x - w / 2, top); c.lineTo(x + w / 2, top); c.lineTo(x + w / 2 - d.top * 0.6 * k, top - fh * (k ? 0.9 : 1) - (1 - k) * fh * 0.4); c.lineTo(x - w / 2 + d.top * 0.6 * k, top - fh * (k ? 0.9 : 1) - (1 - k) * fh * 0.4); c.closePath();
    } else {
      var k2 = (a - 0.5) * 2;   // 0 = straight up .. 1 = hanging down the front
      var tipY = top - fh * 1.4 * (1 - k2) + fh * 1.0 * k2;
      c.moveTo(x - w / 2, top); c.lineTo(x + w / 2, top); c.lineTo(x + w / 2 + 4 * k2, tipY); c.lineTo(x - w / 2 - 4 * k2, tipY); c.closePath();
    }
    fillInk(c, shade(col, 0.05), 4);
    c.restore();
  }

  /* surprises (drawn from where they'd sit in the box: x, y = the box opening; size ~ box width) */
  var KITTEN_COLS = [{ preset: 'ginger' }, { preset: 'pink' }, { preset: 'blue' }, { preset: 'purple' }, { preset: 'white' }, { preset: 'black' }, { color: '#C9C2D6', markings: 'tabby' }, { color: '#FFFFFF', markings: 'calico' }];
  function kitten(c, x, y, size, look, face, pose) {
    var o = {}; for (var k in look) o[k] = look[k]; o.size = size; o.face = face || 'happy'; if (pose) o.pose = pose;
    c.save(); c.translate(x, y); try { GGCat.draw(c, o); } catch (e) { circle(c, 0, 0, size / 2); fillInk(c, '#FFA94D', 4); } c.restore();
  }
  var SURPRISES = {
    kitten: function (c, x, y, w, t, s) { kitten(c, x, y - w * 0.18 - Math.abs(Math.sin(t * 6)) * w * 0.04, w * 0.62, s.look, t % 2 < 0.15 ? 'blink' : 'happy', 'peek'); },
    two: function (c, x, y, w, t, s) { kitten(c, x - w * 0.2, y - w * 0.12, w * 0.46, s.look, 'happy', 'peek'); kitten(c, x + w * 0.2, y - w * 0.16 - Math.abs(Math.sin(t * 5)) * w * 0.04, w * 0.46, s.look2, 'open', 'peek'); },
    sleepy: function (c, x, y, w, t, s) { kitten(c, x, y - w * 0.12, w * 0.58, s.look, 'sleep', 'peek'); c.font = '800 ' + Math.round(w * 0.16) + 'px "Baloo 2", system-ui, sans-serif'; c.fillStyle = '#7A6F8E'; c.textAlign = 'center'; c.fillText('z', x + w * 0.3, y - w * 0.55 - (t * 20 % 20)); },
    wave: function (c, x, y, w, t, s) { kitten(c, x, y - w * 0.32, w * 0.5, s.look, 'happy', 'wave'); },
    yarn: function (c, x, y, w, t) {
      var r = w * 0.2, cy = y - w * 0.18 - Math.abs(Math.sin(t * 5)) * w * 0.12;
      circle(c, x, cy, r); fillInk(c, '#FF5A7A', 4);
      c.save(); circle(c, x, cy, r - 1); c.clip(); c.strokeStyle = 'rgba(42,35,64,.35)'; c.lineWidth = 3; for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x - r, cy + i * r * 0.35 - r * 0.3); c.quadraticCurveTo(x, cy + i * r * 0.35 + r * 0.3, x + r, cy + i * r * 0.35 - r * 0.3); c.stroke(); } c.restore();
    },
    mouse: function (c, x, y, w, t) {
      var cy = y - w * 0.16, s = w / 200;
      c.save(); c.translate(x + Math.sin(t * 3) * w * 0.05, cy); c.scale(s * 1.4, s * 1.4);
      c.beginPath(); c.moveTo(-30, 10); c.quadraticCurveTo(-52, 4, -50, -16); c.strokeStyle = '#FF8FAB'; c.lineWidth = 5; c.stroke();
      c.beginPath(); c.moveTo(-34, 18); c.quadraticCurveTo(-34, -24, 4, -24); c.quadraticCurveTo(40, -20, 42, 14); c.quadraticCurveTo(10, 24, -34, 18); c.closePath(); fillInk(c, '#C9C2D6', 4.5);
      circle(c, 6, -26, 13); fillInk(c, '#FFB3C7', 4); circle(c, 26, -2, 4.5); c.fillStyle = INK; c.fill(); circle(c, 44, 12, 5); c.fillStyle = '#FF7FA6'; c.fill();
      c.restore();
    },
    butterfly: function (c, x, y, w, t) {
      var cx = x + Math.sin(t * 2) * w * 0.3, cy = y - w * 0.3 - t * w * 0.35, flap = Math.abs(Math.sin(t * 14));
      c.save(); c.translate(cx, cy); c.scale(w / 220, w / 220);
      [-1, 1].forEach(function (s) { c.save(); c.scale(s * (0.4 + 0.6 * flap), 1); ell(c, 22, -14, 22, 18, -0.4); fillInk(c, '#B48CFF', 4); ell(c, 18, 18, 15, 13, 0.4); fillInk(c, '#FF8FAB', 4); c.restore(); });
      rr(c, -6, -26, 12, 52, 6); fillInk(c, '#3D3650', 3.5);
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
      c.beginPath(); c.moveTo(-44, 0); c.quadraticCurveTo(-8, -34, 26, -6); c.lineTo(46, -24); c.lineTo(42, 4); c.lineTo(48, 26); c.lineTo(26, 8); c.quadraticCurveTo(-8, 32, -44, 0); c.closePath(); fillInk(c, '#7CC4FF', 4.5);
      circle(c, -26, -4, 5); c.fillStyle = INK; c.fill();
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

  window.GGBoxes = { drawBack: drawBack, drawFront: drawFront, drawSurprise: drawSurprise, pickSurprise: pickSurprise, kitten: kitten, KITTEN_COLS: KITTEN_COLS, BOX_COLS: BOX_COLS, dims: dims };
})();
