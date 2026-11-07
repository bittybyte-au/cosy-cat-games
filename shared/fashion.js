/* Cosy Cat Games: cat outfits and photos (Cat Fashion Studio makes them, Cosy Home hangs the photos on its walls).
   Needs shared/draw.js and shared/cat.js first.

     GGFashion.SLOTS                        the wardrobe: { hat, glasses, neck, top } -> [{ id, name }] ('none' first)
     GGFashion.COLOURS, PATTERNS, BACKDROPS the choices
     GGFashion.drawModel(ctx, m, size)      a dressed cat at the origin, the same origin and size as GGCat.draw
                                            m = { look: { color, build, markings }, pose: 'sit'|'wave', face,
                                                  outfit: { hat: { id, col, pat }, glasses: {...}, neck: {...}, top: {...} } }
     GGFashion.swatch(ctx, x, y, w, h, item) a patch of an item's colour and pattern
     GGFashion.drawBackdrop(ctx, id, w, h)  a photo background filling 0..w, 0..h
     GGFashion.drawShot(ctx, photo, w, h)   the picture itself: backdrop and the dressed cat, filling 0..w, 0..h
     GGFashion.drawPhoto(ctx, photo, w)     a hanging instant photo for a wall: bottom centre at (0,0), about w wide
                                            photo = { m: model, bg: backdrop id, fx: sparkles 0/1 }
   Clothes are drawn in the cat's own 100-unit space (head centred near 0,6, about 88 wide; GGCat.draw's scale). */
(function () {
  'use strict';
  var D = window.GGDraw, INK = D.INK, TAU = Math.PI * 2;

  var COLOURS = ['#FF5C8A', '#FF9F43', '#FFD23F', '#7BD389', '#4FC3B8', '#7CC4FF', '#5B6BD6', '#B48CFF', '#FFFFFF', '#3D3650', '#E9D8C4', '#C9354F'];
  var PATTERNS = [{ id: 'plain', name: 'Plain' }, { id: 'stripes', name: 'Stripes' }, { id: 'dots', name: 'Dots' }, { id: 'stars', name: 'Stars' }, { id: 'hearts', name: 'Hearts' }, { id: 'checks', name: 'Checks' }];
  var SLOTS = {
    hat: [{ id: 'none', name: 'No hat' }, { id: 'beanie', name: 'Beanie' }, { id: 'cap', name: 'Cap' }, { id: 'beret', name: 'Beret' }, { id: 'crown', name: 'Crown' }, { id: 'sunhat', name: 'Sun hat' }, { id: 'headphones', name: 'Headphones' }, { id: 'flowers', name: 'Flower crown' }, { id: 'bow', name: 'Big bow' }],
    glasses: [{ id: 'none', name: 'No glasses' }, { id: 'round', name: 'Round' }, { id: 'shades', name: 'Sunnies' }, { id: 'star', name: 'Stars' }, { id: 'heart', name: 'Hearts' }, { id: 'cateye', name: 'Cat-eye' }],
    neck: [{ id: 'none', name: 'Nothing' }, { id: 'bowtie', name: 'Bow tie' }, { id: 'scarf', name: 'Scarf' }, { id: 'pearls', name: 'Pearls' }, { id: 'bandana', name: 'Bandana' }, { id: 'tie', name: 'Tie' }],
    top: [{ id: 'none', name: 'No top' }, { id: 'tee', name: 'T-shirt' }, { id: 'hoodie', name: 'Hoodie' }, { id: 'sweater', name: 'Jumper' }, { id: 'dress', name: 'Dress' }, { id: 'jacket', name: 'Jacket' }, { id: 'overalls', name: 'Overalls' }]
  };
  var BACKDROPS = [
    { id: 'studio', name: 'Studio' }, { id: 'city', name: 'City lights' }, { id: 'beach', name: 'Beach' },
    { id: 'flowers', name: 'Flower wall' }, { id: 'space', name: 'Space' }, { id: 'confetti', name: 'Party' }
  ];

  /* ---------- little helpers ---------- */
  function path(build) { var p = new Path2D(); build(p); return p; }
  function ell(cx, cy, rx, ry, rot) { return path(function (p) { p.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU); }); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function isDark(col) { var h = String(col).replace('#', ''); if (h.length !== 6) return false; var v = parseInt(h, 16); return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) < 120; }
  function trim(col) { return isDark(col) ? D.lighter(col, 0.35) : D.darker(col, 0.22); }
  function star(c, x, y, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
  function heart(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r * 0.8); c.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.4); c.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.3, y - r * 0.1, x, y + r * 0.8); c.closePath(); }
  /* fill a piece of clothing with its colour and pattern, then outline it */
  function cloth(c, p, item, lw, extraInside) {
    var col = item.col || COLOURS[0], pat = item.pat || 'plain', tc = trim(col);
    D.shape(c, p, col, { lw: lw || 3.5, depth: 4, inside: function (c) {
      c.fillStyle = tc; c.strokeStyle = tc;
      if (pat === 'stripes') { c.lineWidth = 4.5; for (var y = -120; y < 140; y += 11) { c.beginPath(); c.moveTo(-120, y); c.lineTo(120, y); c.stroke(); } }
      else if (pat === 'dots') { for (var yy = -120, r = 0; yy < 140; yy += 11, r++) for (var xx = -120 + (r % 2) * 6; xx < 120; xx += 12) { circle(c, xx, yy, 2.4); c.fill(); } }
      else if (pat === 'stars') { for (var ys = -120, rs = 0; ys < 140; ys += 15, rs++) for (var xs = -120 + (rs % 2) * 8; xs < 120; xs += 16) { star(c, xs, ys, 4.2); c.fill(); } }
      else if (pat === 'hearts') { for (var yh = -120, rh = 0; yh < 140; yh += 15, rh++) for (var xh = -120 + (rh % 2) * 8; xh < 120; xh += 16) { heart(c, xh, yh, 3.8); c.fill(); } }
      else if (pat === 'checks') { c.globalAlpha = 0.55; for (var yc = -120; yc < 140; yc += 10) { c.fillRect(-120, yc, 240, 4); } for (var xc = -120; xc < 120; xc += 10) c.fillRect(xc, -120, 4, 260); c.globalAlpha = 1; }
      if (extraInside) extraInside(c, tc);
    } });
  }

  /* ---------- hats (head top at about y -31, ears up to -72 around x ±30) ---------- */
  var HATS = {
    beanie: function (c, it) {
      cloth(c, path(function (p) { p.moveTo(-31, -20); p.bezierCurveTo(-31, -58, 31, -58, 31, -20); p.closePath(); }), it, 3.5);
      cloth(c, D.rrPath(-35, -27, 70, 14, 7), { col: it.col, pat: 'plain' }, 3.5, function (c, tc) { c.strokeStyle = tc; c.lineWidth = 2.5; for (var x = -30; x < 34; x += 7) { c.beginPath(); c.moveTo(x, -26); c.lineTo(x, -14); c.stroke(); } });
      D.shape(c, ell(0, -55, 10, 10), trim(it.col), { lw: 3, depth: 3 });
    },
    cap: function (c, it) {
      cloth(c, path(function (p) { p.moveTo(-33, -22); p.bezierCurveTo(-33, -56, 33, -56, 33, -22); p.closePath(); }), it, 3.5);
      D.shape(c, path(function (p) { p.moveTo(-34, -24); p.quadraticCurveTo(0, -30, 34, -24); p.quadraticCurveTo(46, -18, 34, -12); p.quadraticCurveTo(0, -18, -34, -12); p.quadraticCurveTo(-46, -18, -34, -24); p.closePath(); }), trim(it.col), { lw: 3.5, depth: 0 });
      D.shape(c, ell(0, -50, 5, 3.5), trim(it.col), { lw: 2.5, depth: 0 });
    },
    beret: function (c, it) {
      cloth(c, ell(-6, -36, 40, 13, -0.18), it, 3.5);
      D.shape(c, D.rrPath(-10, -55, 6, 9, 3), trim(it.col), { lw: 2.5, depth: 0 });
    },
    crown: function (c, it) {
      var col = it.col === '#FFFFFF' || !it.col ? '#FFD23F' : it.col;
      D.shape(c, path(function (p) { p.moveTo(-24, -22); p.lineTo(-27, -50); p.lineTo(-14, -38); p.lineTo(0, -58); p.lineTo(14, -38); p.lineTo(27, -50); p.lineTo(24, -22); p.closePath(); }), D.tone(c, col, -58, -22), { lw: 3.5, depth: 4 });
      [[-27, -50], [0, -58], [27, -50]].forEach(function (q) { D.shape(c, ell(q[0], q[1], 4, 4), '#FFFFFF', { lw: 2.2, depth: 0 }); });
      [[-12, -28, '#FF5C8A'], [0, -29, '#7CC4FF'], [12, -28, '#7BD389']].forEach(function (q) { D.shape(c, ell(q[0], q[1], 3.6, 3.6), q[2], { lw: 2, depth: 0 }); });
    },
    sunhat: function (c, it) {
      cloth(c, ell(0, -26, 68, 15), { col: it.col, pat: 'plain' }, 3.5);
      cloth(c, path(function (p) { p.moveTo(-30, -26); p.bezierCurveTo(-30, -60, 30, -60, 30, -26); p.closePath(); }), it, 3.5);
      D.shape(c, D.rrPath(-30, -36, 60, 9, 3), trim(it.col), { lw: 3, depth: 0 });
      D.shape(c, path(function (p) { p.moveTo(22, -32); p.lineTo(34, -40); p.lineTo(34, -24); p.closePath(); }), trim(it.col), { lw: 2.5, depth: 0 });
    },
    headphones: function (c, it) {
      c.beginPath(); c.ellipse(0, -4, 50, 46, 0, Math.PI * 1.08, Math.PI * 1.92); c.lineCap = 'round';
      c.strokeStyle = INK; c.lineWidth = 12; c.stroke(); c.strokeStyle = it.col || '#3D3650'; c.lineWidth = 6; c.stroke();
      [-1, 1].forEach(function (s) { cloth(c, D.rrPath(s * 48 - 9, -12, 18, 30, 8), it, 3.5); D.shape(c, D.rrPath(s * 48 - 4, -6, 8, 18, 4), trim(it.col), { lw: 0, depth: 0 }); });
    },
    flowers: function (c) {
      var cols = ['#FF8FAB', '#FFD23F', '#B48CFF', '#7CC4FF', '#FF9F43', '#FF8FAB', '#7BD389'];
      for (var i = 0; i < 7; i++) {
        var t = i / 6, x = -40 + t * 80, y = -24 - Math.sin(t * Math.PI) * 10;
        if (i % 2) D.shape(c, ell(x + 4, y + 4, 6, 3.5, 0.6), '#5EA47E', { lw: 2, depth: 0 });
        for (var k = 0; k < 5; k++) { var a = k / 5 * TAU; D.shape(c, ell(x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 4, 4), cols[i], { lw: 1.8, depth: 0 }); }
        D.shape(c, ell(x, y, 3, 3), '#FFF1C9', { lw: 1.6, depth: 0 });
      }
    },
    bow: function (c, it) {
      c.save(); c.translate(24, -32); c.rotate(0.35);
      cloth(c, path(function (p) { p.moveTo(0, 0); p.quadraticCurveTo(-14, -22, -26, -10); p.quadraticCurveTo(-30, 4, -18, 12); p.quadraticCurveTo(-8, 10, 0, 0); p.closePath(); }), it, 3.2);
      cloth(c, path(function (p) { p.moveTo(0, 0); p.quadraticCurveTo(14, -22, 26, -10); p.quadraticCurveTo(30, 4, 18, 12); p.quadraticCurveTo(8, 10, 0, 0); p.closePath(); }), it, 3.2);
      D.shape(c, ell(0, 0, 6, 6), trim(it.col), { lw: 3, depth: 0 });
      c.restore();
    }
  };
  /* ---------- glasses (eyes at ±16, 2) ---------- */
  function arms(c, col) { c.beginPath(); c.moveTo(-27, 0); c.lineTo(-44, -4); c.moveTo(27, 0); c.lineTo(44, -4); c.strokeStyle = INK; c.lineWidth = 4.5; c.stroke(); c.strokeStyle = col; c.lineWidth = 2; c.stroke(); }
  function bridge(c, col, y) { c.beginPath(); c.moveTo(-6, y); c.quadraticCurveTo(0, y - 4, 6, y); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); c.strokeStyle = col; c.lineWidth = 2.4; c.stroke(); }
  var GLASSES = {
    round: function (c, it) { var col = it.col || '#3D3650'; arms(c, col); bridge(c, col, 0); [-16, 16].forEach(function (x) { circle(c, x, 2, 11); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = col; c.lineWidth = 3; c.stroke(); }); },
    shades: function (c, it) {
      var col = it.col || '#3D3650'; arms(c, col); bridge(c, col, -1);
      [-1, 1].forEach(function (s) { D.shape(c, D.rrPath(s * 16 - 12, -7, 24, 17, 7), '#2A2340', { lw: 0, depth: 0 }); D.rr(c, s * 16 - 12, -7, 24, 17, 7); c.strokeStyle = col; c.lineWidth = 3; c.stroke(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(s * 16 - 5, -2, 4, 2, -0.5, 0, TAU); c.fill(); });
    },
    star: function (c, it) { var col = it.col || '#FFD23F'; arms(c, col); bridge(c, col, 0); [-17, 17].forEach(function (x) { star(c, x, 2, 15); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = col; c.lineWidth = 3; c.stroke(); }); },
    heart: function (c, it) { var col = it.col || '#FF5C8A'; arms(c, col); bridge(c, col, -1); [-17, 17].forEach(function (x) { heart(c, x, 1, 12); c.fillStyle = 'rgba(255,140,180,.35)'; c.fill(); c.strokeStyle = INK; c.lineWidth = 6; c.stroke(); c.strokeStyle = col; c.lineWidth = 3; c.stroke(); }); },
    cateye: function (c, it) {
      var col = it.col || '#3D3650'; arms(c, col); bridge(c, col, 0);
      [-1, 1].forEach(function (s) {
        var p = path(function (p) { p.moveTo(s * 4, -2); p.quadraticCurveTo(s * 16, -10, s * 30, -10); p.quadraticCurveTo(s * 29, 12, s * 16, 12); p.quadraticCurveTo(s * 5, 12, s * 4, -2); p.closePath(); });
        c.fillStyle = 'rgba(255,255,255,.25)'; c.fill(p); c.strokeStyle = INK; c.lineWidth = 6.5; c.stroke(p); c.strokeStyle = col; c.lineWidth = 3.2; c.stroke(p);
      });
    }
  };
  /* ---------- round the neck (chin at about y 43) ---------- */
  var NECK = {
    bowtie: function (c, it) {
      cloth(c, path(function (p) { p.moveTo(0, 47); p.lineTo(-18, 37); p.quadraticCurveTo(-22, 47, -18, 57); p.closePath(); }), it, 3);
      cloth(c, path(function (p) { p.moveTo(0, 47); p.lineTo(18, 37); p.quadraticCurveTo(22, 47, 18, 57); p.closePath(); }), it, 3);
      D.shape(c, D.rrPath(-5, 41, 10, 12, 4), trim(it.col), { lw: 2.8, depth: 0 });
    },
    scarf: function (c, it) {
      cloth(c, path(function (p) { p.moveTo(12, 44); p.lineTo(26, 46); p.lineTo(30, 84); p.lineTo(16, 84); p.closePath(); }), it, 3.2, function (c, tc) { c.strokeStyle = tc; c.lineWidth = 2.5; for (var x = 18; x < 30; x += 4) { c.beginPath(); c.moveTo(x, 80); c.lineTo(x, 86); c.stroke(); } });
      cloth(c, path(function (p) { p.moveTo(-34, 38); p.quadraticCurveTo(0, 50, 34, 38); p.lineTo(35, 48); p.quadraticCurveTo(0, 62, -35, 48); p.closePath(); }), it, 3.4);
    },
    pearls: function (c) {
      for (var i = 0; i <= 10; i++) { var t = i / 10, a = Math.PI * (0.15 + 0.7 * t), x = Math.cos(a) * 28, y = 40 + Math.sin(a) * 16; D.shape(c, ell(x, y, 3.8, 3.8), '#FFF9F0', { lw: 2, depth: 1.5 }); }
    },
    bandana: function (c, it) {
      cloth(c, path(function (p) { p.moveTo(-32, 40); p.quadraticCurveTo(0, 48, 32, 40); p.lineTo(0, 76); p.closePath(); }), it, 3.2);
      D.shape(c, path(function (p) { p.moveTo(26, 40); p.lineTo(38, 36); p.lineTo(36, 46); p.closePath(); }), it.col, { lw: 2.5, depth: 0 });
    },
    tie: function (c, it) {
      cloth(c, path(function (p) { p.moveTo(-6, 52); p.lineTo(6, 52); p.lineTo(10, 80); p.lineTo(0, 90); p.lineTo(-10, 80); p.closePath(); }), it, 3);
      cloth(c, path(function (p) { p.moveTo(-8, 41); p.lineTo(8, 41); p.lineTo(5, 53); p.lineTo(-5, 53); p.closePath(); }), { col: it.col, pat: 'plain' }, 3);
    }
  };
  /* ---------- tops: clipped to the body, below the chin ---------- */
  function bodyClip(c, build, extra) {
    var rx = (build === 'fluffy' ? 41 : 38) + (extra || 0);
    var p = new Path2D(); p.ellipse(0, 64, rx, 26 + (extra || 0), 0, 0, TAU);
    c.clip(p);
    var h = new Path2D(); h.rect(-200, -200, 400, 400); h.ellipse(0, 6, build === 'chubby' ? 51 : 45, 38, 0, 0, TAU);
    c.clip(h, 'evenodd');
  }
  function topShape(c, it, build, inside) {
    c.save(); bodyClip(c, build, 1);
    cloth(c, path(function (p) { p.rect(-60, 30, 120, 70); }), it, 0, inside);
    c.restore();
    // its edge, drawn over the cut line
    var e = new Path2D(); e.ellipse(0, 64, build === 'fluffy' ? 41 : 38, 26, 0, 0, TAU);
    c.save(); var h = new Path2D(); h.rect(-200, -200, 400, 400); h.ellipse(0, 6, build === 'chubby' ? 51 : 45, 38, 0, 0, TAU); c.clip(h, 'evenodd');
    c.strokeStyle = INK; c.lineWidth = 5; c.stroke(e); c.restore();
  }
  var TOPS = {
    tee: function (c, it, b) { topShape(c, it, b, function (c, tc) { c.beginPath(); c.ellipse(0, 42, 20, 9, 0, 0, Math.PI); c.strokeStyle = tc; c.lineWidth = 4; c.stroke(); }); },
    hoodie: function (c, it, b) {
      topShape(c, it, b, function (c, tc) {
        c.fillStyle = tc; D.rr(c, -16, 66, 32, 16, 6); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
        c.beginPath(); c.moveTo(-8, 44); c.lineTo(-10, 60); c.moveTo(8, 44); c.lineTo(10, 60); c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.5; c.stroke();
      });
      // the hood, round the back of the neck
      c.save(); var h = new Path2D(); h.rect(-200, -200, 400, 400); h.ellipse(0, 6, b === 'chubby' ? 51 : 45, 38, 0, 0, TAU); c.clip(h, 'evenodd');
      cloth(c, path(function (p) { p.moveTo(-38, 44); p.quadraticCurveTo(-36, 30, -20, 34); p.lineTo(20, 34); p.quadraticCurveTo(36, 30, 38, 44); p.quadraticCurveTo(0, 54, -38, 44); p.closePath(); }), { col: it.col, pat: 'plain' }, 3.4);
      c.restore();
    },
    sweater: function (c, it, b) { topShape(c, it, b, function (c, tc) { c.fillStyle = tc; c.fillRect(-60, 80, 120, 12); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; for (var x = -40; x < 40; x += 6) { c.beginPath(); c.moveTo(x, 81); c.lineTo(x, 92); c.stroke(); } c.beginPath(); c.ellipse(0, 41, 22, 10, 0, 0, Math.PI); c.strokeStyle = tc; c.lineWidth = 6; c.stroke(); }); },
    dress: function (c, it, b) {
      topShape(c, it, b);
      // the skirt flares out over the feet
      cloth(c, path(function (p) { p.moveTo(-34, 72); p.lineTo(34, 72); p.quadraticCurveTo(48, 86, 52, 96); for (var i = 0; i <= 8; i++) { var x = 52 - i * 13; p.quadraticCurveTo(x - 6.5, 102, x - 13, 96); } p.quadraticCurveTo(-48, 86, -34, 72); p.closePath(); }), it, 3.5);
      D.shape(c, D.rrPath(-34, 66, 68, 9, 4), trim(it.col), { lw: 3, depth: 0 });
    },
    jacket: function (c, it, b) {
      topShape(c, it, b, function (c, tc) {
        c.beginPath(); c.moveTo(0, 42); c.lineTo(0, 92); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
        c.fillStyle = tc; c.beginPath(); c.moveTo(-2, 42); c.lineTo(-20, 42); c.lineTo(-4, 64); c.closePath(); c.fill(); c.beginPath(); c.moveTo(2, 42); c.lineTo(20, 42); c.lineTo(4, 64); c.closePath(); c.fill();
        c.fillStyle = '#FFF1C9'; [62, 74, 86].forEach(function (y) { circle(c, -6, y, 2.6); c.fill(); });
        D.rr(c, 14, 70, 14, 10, 3); c.strokeStyle = tc; c.lineWidth = 2.5; c.stroke();
      });
    },
    overalls: function (c, it, b) {
      c.save(); bodyClip(c, b, 1);
      cloth(c, path(function (p) { p.moveTo(-60, 70); p.lineTo(60, 70); p.lineTo(60, 100); p.lineTo(-60, 100); p.closePath(); p.rect(-15, 50, 30, 22); }), it, 0, function (c, tc) { D.rr(c, -9, 54, 18, 10, 3); c.strokeStyle = tc; c.lineWidth = 2.5; c.stroke(); });
      c.beginPath(); c.moveTo(-60, 70); c.lineTo(-15, 70); c.lineTo(-15, 50); c.lineTo(15, 50); c.lineTo(15, 70); c.lineTo(60, 70); c.strokeStyle = INK; c.lineWidth = 3.5; c.stroke();
      c.restore();
      [-1, 1].forEach(function (s) { c.beginPath(); c.moveTo(s * 13, 52); c.lineTo(s * 24, 40); c.strokeStyle = INK; c.lineWidth = 8; c.stroke(); c.strokeStyle = it.col; c.lineWidth = 4; c.stroke(); D.shape(c, ell(s * 12, 53, 3, 3), '#FFD23F', { lw: 2, depth: 0 }); });
      var e = new Path2D(); e.ellipse(0, 64, b === 'fluffy' ? 41 : 38, 26, 0, 0.25, Math.PI - 0.25); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(e);
    }
  };

  /* ---------- the dressed cat ---------- */
  function lookOf(m) {
    var o = {}, l = m.look || {}; for (var k in l) o[k] = l[k];
    if (!o.color && !o.preset) o.preset = 'ginger';
    o.pose = m.pose === 'wave' ? 'wave' : 'sit'; o.face = m.face || 'happy';
    return o;
  }
  function drawModel(c, m, size) {
    var o = lookOf(m), k = (size || 88) / 88, of = m.outfit || {};
    o.size = size;
    try { GGCat.draw(c, o); } catch (e) {}
    var build = o.build || 'short', fur = o.color || '#FFA94D';
    c.save(); c.scale(k, k); c.lineJoin = 'round'; c.lineCap = 'round';
    var top = of.top && of.top.id !== 'none' && TOPS[of.top.id] ? of.top : null;
    if (top) {
      TOPS[top.id](c, top, build);
      // feet back on top of the top (not under a dress), and a sleeve on a waving paw
      if (top.id !== 'dress') { var feet = o.markings === 'tuxedo' ? '#FFFFFF' : fur; [[-14, 88], [14, 88]].forEach(function (q) { D.shape(c, ell(q[0], q[1], 11, 7), feet, { lw: 4, depth: 0 }); }); }
      if (o.pose === 'wave') {
        c.beginPath(); c.moveTo(28, 70); c.quadraticCurveTo(44, 62, 46, 44); c.strokeStyle = INK; c.lineWidth = 16; c.stroke(); c.strokeStyle = top.col; c.lineWidth = 9; c.stroke();
        D.shape(c, ell(47, 36, 12, 13), fur, { lw: 4, depth: 0 });
        c.fillStyle = '#FFB3C7'; [[47, 39, 3.6], [41, 31, 2], [47, 28, 2], [53, 31, 2]].forEach(function (q) { circle(c, q[0], q[1], q[2]); c.fill(); });
      }
    }
    var neck = of.neck && of.neck.id !== 'none' && NECK[of.neck.id] ? of.neck : null;
    if (neck) NECK[neck.id](c, neck);
    var gl = of.glasses && of.glasses.id !== 'none' && GLASSES[of.glasses.id] ? of.glasses : null;
    if (gl) GLASSES[gl.id](c, gl);
    var hat = of.hat && of.hat.id !== 'none' && HATS[of.hat.id] ? of.hat : null;
    if (hat) HATS[hat.id](c, hat);
    c.restore();
  }

  /* ---------- photo backdrops ---------- */
  function drawBackdrop(c, id, w, h) {
    var R = D.seeded(7), g;
    c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    if (id === 'city') {
      g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1F1B3D'); g.addColorStop(1, '#5A447A'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#FFF6D8'; for (var i = 0; i < 30; i++) { circle(c, R() * w, R() * h * 0.5, 0.6 + R() * 1.2); c.fill(); }
      circle(c, w * 0.8, h * 0.17, w * 0.07); c.fillStyle = '#FFF1C9'; c.fill();
      for (var x = -10; x < w; x += w * 0.12 + R() * w * 0.06) {
        var bw = w * (0.09 + R() * 0.08), bh = h * (0.25 + R() * 0.3), col = ['#3C3366', '#4A3F6B', '#2D2752'][Math.floor(R() * 3)];
        c.fillStyle = col; c.fillRect(x, h - bh, bw, bh);
        c.fillStyle = 'rgba(255,217,138,.8)'; for (var wy = h - bh + 6; wy < h - 4; wy += 9) for (var wx = x + 4; wx < x + bw - 5; wx += 7) if (R() < 0.35) c.fillRect(wx, wy, 3.5, 4.5);
      }
    } else if (id === 'beach') {
      g = c.createLinearGradient(0, 0, 0, h * 0.6); g.addColorStop(0, '#7CC4FF'); g.addColorStop(1, '#CDEBFF'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      circle(c, w * 0.78, h * 0.2, w * 0.1); c.fillStyle = '#FFE27A'; c.fill();
      c.fillStyle = '#4FA9E0'; c.fillRect(0, h * 0.52, w, h * 0.14);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = Math.max(1.5, w * 0.008); for (var wv = 0; wv < 3; wv++) { c.beginPath(); for (var xx = 0; xx <= w; xx += w / 16) c.lineTo(xx, h * (0.56 + wv * 0.035) + Math.sin(xx * 0.08 + wv) * 2); c.stroke(); }
      c.fillStyle = '#F6D9A0'; c.beginPath(); c.moveTo(0, h * 0.66); c.quadraticCurveTo(w * 0.5, h * 0.6, w, h * 0.68); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
      [[0.12, 0.24], [0.3, 0.14]].forEach(function (q) { c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(w * q[0], h * q[1], w * 0.08, h * 0.03, 0, 0, TAU); c.ellipse(w * q[0] + w * 0.05, h * q[1] - h * 0.015, w * 0.05, h * 0.03, 0, 0, TAU); c.fill(); });
    } else if (id === 'flowers') {
      c.fillStyle = '#C9EBD8'; c.fillRect(0, 0, w, h);
      var cols = ['#FF8FAB', '#FFD23F', '#B48CFF', '#FFFFFF', '#FF9F43'], step = w / 7;
      for (var fy = 0, r = 0; fy < h + step; fy += step * 0.8, r++) for (var fx = (r % 2) * step / 2; fx < w + step; fx += step) {
        var fr = step * 0.22, col2 = cols[Math.floor(R() * cols.length)];
        c.fillStyle = '#7BC79A'; c.beginPath(); c.ellipse(fx + fr, fy + fr * 0.8, fr * 0.8, fr * 0.4, 0.6, 0, TAU); c.fill();
        for (var pk = 0; pk < 5; pk++) { var a = pk / 5 * TAU + r; c.fillStyle = col2; circle(c, fx + Math.cos(a) * fr * 0.75, fy + Math.sin(a) * fr * 0.75, fr * 0.6); c.fill(); }
        c.fillStyle = '#FFE27A'; circle(c, fx, fy, fr * 0.45); c.fill();
      }
    } else if (id === 'space') {
      g = c.createRadialGradient(w * 0.5, h * 0.4, 10, w * 0.5, h * 0.5, w); g.addColorStop(0, '#4B3A8C'); g.addColorStop(1, '#1A1533'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#FFF6D8'; for (var s = 0; s < 50; s++) { circle(c, R() * w, R() * h, 0.5 + R() * 1.4); c.fill(); }
      circle(c, w * 0.18, h * 0.22, w * 0.09); c.fillStyle = '#FF9F7A'; c.fill();
      c.beginPath(); c.ellipse(w * 0.18, h * 0.22, w * 0.15, w * 0.03, -0.3, 0, TAU); c.strokeStyle = '#FFD7A8'; c.lineWidth = Math.max(2, w * 0.012); c.stroke();
      star(c, w * 0.85, h * 0.15, w * 0.03); c.fillStyle = '#FFD23F'; c.fill();
    } else if (id === 'confetti') {
      g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#FFE58A'); g.addColorStop(1, '#FFC4A8'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      var cc = ['#FF5C8A', '#7CC4FF', '#7BD389', '#B48CFF', '#FFFFFF', '#FF9F43'];
      for (var q = 0; q < 60; q++) { c.save(); c.translate(R() * w, R() * h); c.rotate(R() * TAU); c.fillStyle = cc[q % cc.length]; c.fillRect(-w * 0.012, -w * 0.005, w * 0.024, w * 0.01); c.restore(); }
      // bunting along the top
      c.beginPath(); c.moveTo(0, h * 0.04); c.quadraticCurveTo(w / 2, h * 0.16, w, h * 0.04); c.strokeStyle = INK; c.lineWidth = Math.max(1.5, w * 0.008); c.stroke();
      for (var bI = 1; bI < 8; bI++) { var t = bI / 8, bx = t * w, by = h * 0.04 + h * 0.24 * t * (1 - t); c.beginPath(); c.moveTo(bx - w * 0.04, by); c.lineTo(bx + w * 0.04, by); c.lineTo(bx, by + h * 0.08); c.closePath(); c.fillStyle = cc[bI % cc.length]; c.fill(); c.lineWidth = Math.max(1, w * 0.006); c.stroke(); }
    } else {
      // the studio: a soft pink sweep with a spotlight
      g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#FFD3E4'); g.addColorStop(1, '#FFB3CB'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      g = c.createRadialGradient(w * 0.5, h * 0.45, 4, w * 0.5, h * 0.45, w * 0.6); g.addColorStop(0, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(w * 0.5, h * 0.9, w * 0.42, h * 0.07, 0, 0, TAU); c.fill();
    }
    c.restore();
  }
  /* the picture itself: the backdrop with the cat standing in it */
  function drawShot(c, ph, w, h) {
    drawBackdrop(c, ph.bg, w, h);
    var size = Math.min(w * 0.5, h * 0.44), k = size / 88;   // room above for a tall hat
    c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    c.translate(w / 2, h * 0.94 - 96 * k);
    D.shadow(c, 0, 96 * k, 46 * k, 8 * k);
    drawModel(c, ph.m || {}, size);
    c.restore();
    if (ph.fx) {
      c.save(); var R = D.seeded(3);
      for (var i = 0; i < 9; i++) { var x = R() * w, y = R() * h * 0.7, r = w * (0.015 + R() * 0.025); star(c, x, y, r); c.fillStyle = i % 2 ? '#FFFFFF' : '#FFE27A'; c.fill(); c.lineWidth = Math.max(1, w * 0.005); c.strokeStyle = INK; c.stroke(); }
      c.restore();
    }
  }
  /* an instant photo hanging on the wall: bottom centre at (0,0) */
  function drawPhoto(c, ph, w) {
    var h = w * 1.18, x = -w / 2, y = -h, b = w * 0.07, inner = w - 2 * b;
    var lw = Math.max(2.5, Math.min(5, w * 0.022));
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = 'rgba(42,35,64,.14)'; D.rr(c, x + w * 0.03, y + w * 0.04, w, h, w * 0.04); c.fill();
    // washi tape at the top, instead of a nail
    c.save(); c.rotate(-0.05);
    D.rr(c, -w * 0.18, y - w * 0.05, w * 0.36, w * 0.11, 2); c.fillStyle = 'rgba(255,143,171,.75)'; c.fill();
    c.restore();
    D.rr(c, x, y, w, h, w * 0.035); c.fillStyle = '#FFFDF8'; c.fill();
    c.save(); c.beginPath(); c.rect(x + b, y + b, inner, inner); c.clip(); c.translate(x + b, y + b); drawShot(c, ph, inner, inner); c.restore();
    c.beginPath(); c.rect(x + b, y + b, inner, inner); c.lineWidth = lw * 0.6; c.strokeStyle = 'rgba(42,35,64,.5)'; c.stroke();
    D.rr(c, x, y, w, h, w * 0.035); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
    c.save(); c.rotate(-0.05); D.rr(c, -w * 0.18, y - w * 0.05, w * 0.36, w * 0.11, 2); c.lineWidth = lw * 0.5; c.strokeStyle = 'rgba(42,35,64,.35)'; c.stroke(); c.restore();
    c.restore();
  }

  /* a patch of fabric (for pattern buttons): x, y, w, h in pixels */
  function swatch(c, x, y, w, h, item) {
    c.save(); c.translate(x + w / 2, y + h / 2); var k = Math.max(w, h) / 60; c.scale(k, k);
    cloth(c, D.rrPath(-w / 2 / k + 1.5, -h / 2 / k + 1.5, w / k - 3, h / k - 3, 6), item, 3);
    c.restore();
  }

  window.GGFashion = {
    COLOURS: COLOURS, PATTERNS: PATTERNS, SLOTS: SLOTS, BACKDROPS: BACKDROPS, swatch: swatch,
    drawModel: drawModel, drawBackdrop: drawBackdrop, drawShot: drawShot, drawPhoto: drawPhoto
  };
})();
