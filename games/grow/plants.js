/* Cosy Cat Games: plants – the pots, seeds and plant drawings, and the player's grown plants.
   Shared by the Grow game (games/grow/, where plants are grown) and Cosy Home (where they're displayed).
   Plants are saved by the Grow game: GG.getProgress('grow') = { plants: [{ id, t, pot, col, cpot? }], next, grown }.
   A plant in a pot made in the Pottery game keeps its own copy of the pot (cpot, GGPot.pack data, plus cuid, the
   collection item it came from), so it still draws if that pot is deleted from the collection; pot is then a built-in
   pot to fall back on (and is used wherever shared/pots.js isn't loaded).
   Drawings are bottom centre at (0,0), about 92 units wide for the pot. Wherever a pot is asked for, it can be a
   built-in pot's number or a pot from Pottery (its packed data). */
(function () {
  'use strict';
  var D = window.GGDraw;   // needs shared/draw.js first
  var INK = D.INK, rr = D.rr, ink = D.ink;
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function findDef(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  var FLOWER = ['#FF5A7A', '#FFD23F', '#B48CFF', '#FF9F43', '#FFFFFF', '#5DB8FF'];
  var POTS = [
    { fill: '#E58B5B', dark: '#B9623A', deco: 'band' },
    { fill: '#FF9EC4', dark: '#E8558E', deco: 'dots' },
    { fill: '#7CC4FF', dark: '#3B8FD6', deco: 'stripes' },
    { fill: '#FFD93F', dark: '#C9A20C', deco: 'dots' },
    { fill: '#FFFFFF', dark: '#D9D3E6', deco: 'cat' },
    { fill: '#7BD389', dark: '#3E9E58', deco: 'stripes' }
  ];
  /* `grown` = how many plants you need to have grown before this seed appears; `grew` finishes "You grew …!" */
  var PLANTS = [
    { id: 'catnip', name: 'Catnip', grew: 'some catnip', colour: true, h: 125, grown: 0 },
    { id: 'tulip', name: 'Tulips', grew: 'some tulips', colour: true, h: 150, grown: 0 },
    { id: 'cactus', name: 'Cactus', grew: 'a cactus', colour: true, h: 125, grown: 0 },
    { id: 'sunflower', name: 'Sunflower', grew: 'a sunflower', h: 215, grown: 1 },
    { id: 'catgrass', name: 'Cat grass', grew: 'some cat grass', h: 130, grown: 2 },
    { id: 'lavender', name: 'Lavender', grew: 'some lavender', h: 155, grown: 3 },
    { id: 'lemon', name: 'Lemon tree', grew: 'a lemon tree', h: 205, grown: 5 },
    { id: 'shroom', name: 'Glow mushrooms', grew: 'some glow mushrooms', colour: true, h: 120, grown: 7 }
  ];
  /* Things: some to start with, the rest earned in the other games (read from their saves). */

  /* ---------- pots made in the Pottery game (shared/pots.js) ---------- */
  function cpot(pot) { return pot && typeof pot === 'object' && window.GGPot && GGPot.unpack(pot) ? pot : null; }
  function potOf(pl) { return (pl && cpot(pl.cpot)) || (pl ? pl.pot : 0); }
  /* a made pot is fitted into a box a little wider and up to half again taller than a built-in pot, so a tall vase
     doesn't tower over its plant and a wide bowl doesn't spill off a shelf */
  function cfit(w) { return { w: w * 1.1, h: w * 0.95, lw: Math.max(2, w * 0.04) }; }
  /* where the plant stands: on the soil in the opening, scaled down for a narrow neck */
  function base(pot, w) {
    w = w || 92;
    var cp = cpot(pot);
    if (!cp) return { y: -w * 0.62 * 0.9, k: 1 };
    var m = GGPot.size(cp, cfit(w).w, cfit(w).h).mouth;
    return { y: m.y + m.ry * 0.3, k: clamp((m.rx * 2) / (w * 0.78), 0.5, 1) };
  }

  /* the pot's rim, a little lighter at the top (drawn whole behind the plant, and again as the front lip over it) */
  function rim(c, P, w, h) {
    var lw = Math.max(2, w * 0.04);
    D.shape(c, D.rrPath(-w * 0.56, -h, w * 1.12, h * 0.22, h * 0.08), D.tone(c, P.fill, -h, -h * 0.78), { lw: lw, depth: h * 0.05 });
  }
  function drawPot(c, pot, w) {
    var cp = cpot(pot);
    if (cp) { var sz = GGPot.draw(c, cp, cfit(w)); return sz ? sz.h : w * 0.62; }
    var P = POTS[pot] || POTS[0];
    var h = w * 0.62, top = -h;
    c.save();
    D.shape(c, function (p) { p.moveTo(-w * 0.5, top + h * 0.18); p.lineTo(-w * 0.38, 0); p.lineTo(w * 0.38, 0); p.lineTo(w * 0.5, top + h * 0.18); p.closePath(); },
      D.tone(c, P.fill, top, 0), { lw: Math.max(2, w * 0.04), depth: w * 0.08, inside: function (c) {
        c.fillStyle = P.dark;
        if (P.deco === 'dots') for (var i = -2; i <= 2; i++) { circle(c, i * w * 0.18, top + h * 0.6 + (i % 2) * h * 0.12, w * 0.05); c.fill(); }
        if (P.deco === 'stripes') for (var j = 0; j < 3; j++) c.fillRect(-w, top + h * (0.4 + j * 0.2), w * 2, h * 0.07);
        if (P.deco === 'band') c.fillRect(-w, top + h * 0.55, w * 2, h * 0.12);
        if (P.deco === 'cat') {
          c.strokeStyle = INK; c.lineWidth = w * 0.03; c.lineCap = 'round';
          c.beginPath(); c.moveTo(-w * 0.14, top + h * 0.56); c.quadraticCurveTo(-w * 0.1, top + h * 0.5, -w * 0.06, top + h * 0.56);
          c.moveTo(w * 0.06, top + h * 0.56); c.quadraticCurveTo(w * 0.1, top + h * 0.5, w * 0.14, top + h * 0.56); c.stroke();
          c.beginPath(); c.moveTo(-w * 0.05, top + h * 0.68); c.quadraticCurveTo(-w * 0.025, top + h * 0.74, 0, top + h * 0.68); c.quadraticCurveTo(w * 0.025, top + h * 0.74, w * 0.05, top + h * 0.68); c.stroke();
          c.fillStyle = 'rgba(255,120,160,.5)'; ell(c, -w * 0.22, top + h * 0.66, w * 0.05, w * 0.03); c.fill(); ell(c, w * 0.22, top + h * 0.66, w * 0.05, w * 0.03); c.fill();
        }
      } });
    rim(c, P, w, h);
    c.restore();
    return h;
  }
  function leaf(c, x, y, len, ang, col) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); c.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); c.closePath();
    c.fillStyle = col || '#5CCB75'; c.fill(); ink(c, 2.5);
    c.restore();
  }
  function stem(c, x0, y0, x1, y1, w) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (x1 - x0) * 0.3, (y0 + y1) / 2, x1, y1); c.lineWidth = (w || 5) + 3; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = w || 5; c.strokeStyle = '#4FB868'; c.stroke(); }
  /* the soil showing in the mouth of the pot (drawn after the pot, before the plant) */
  function soil(c, w, amount, pot) {
    var h = w * 0.62; amount = amount === undefined ? 1 : amount;
    if (amount <= 0) return;
    var cp = cpot(pot);
    if (cp) {
      var m = GGPot.size(cp, cfit(w).w, cfit(w).h).mouth, sy = m.y + m.ry * (0.95 - 0.6 * amount);
      c.save(); GGPot.clipMouth(c, cp, cfit(w));
      ell(c, 0, sy + m.ry * 0.25, m.rx * 1.05, m.ry * 1.1); c.fillStyle = '#7A4E2D'; c.fill();
      c.fillStyle = '#5E3A1F'; circle(c, -m.rx * 0.4, sy + m.ry * 0.2, Math.max(1, m.rx * 0.06)); c.fill(); circle(c, m.rx * 0.3, sy + m.ry * 0.45, Math.max(1, m.rx * 0.05)); c.fill();
      c.restore();
      return;
    }
    ell(c, 0, -h + h * 0.08, w * 0.5 * (0.55 + 0.45 * amount), h * 0.1); c.fillStyle = '#7A4E2D'; c.fill();
    c.fillStyle = '#5E3A1F'; circle(c, -w * 0.18, -h + h * 0.07, w * 0.025); c.fill(); circle(c, w * 0.14, -h + h * 0.1, w * 0.02); c.fill();
  }
  /* the front half of the pot's rim, drawn over the bottom of the plant so the stems go into the soil */
  function potLip(c, pot, w) {
    var cp = cpot(pot);
    if (cp) { GGPot.lip(c, cp, cfit(w)); return; }
    var P = POTS[pot] || POTS[0], h = w * 0.62;
    c.save();
    c.beginPath(); c.rect(-w, -h + h * 0.12, w * 2, h * 0.3); c.clip();
    rim(c, P, w, h);
    c.restore();
  }
  function drawPotted(c, pl, g, t, soilAmount) {
    var pot = potOf(pl);
    drawPot(c, pot, 92);
    soil(c, 92, soilAmount, pot);
    drawPlant(c, pl, g, t);
    potLip(c, pot, 92);
  }

  /* A potted plant, bottom centre at (0,0). g = how grown it is (0 nothing, 1 full). */
  function drawPlant(c, pl, g, t) {
    var d = findDef(PLANTS, pl.t) || PLANTS[0];
    var w = 92;
    var col = FLOWER[pl.col || 0];
    g = g === undefined ? 1 : g;
    t = t || 0;
    var B = base(potOf(pl), w);
    c.save();
    // plants drawn first, pot rim drawn over their base
    c.save();
    c.translate(0, B.y); if (B.k !== 1) c.scale(B.k, B.k);
    var sway = Math.sin(t * 1.3 + (pl.id || 0)) * 0.03;
    c.rotate(sway);
    var gg = easeOut(g);
    if (gg > 0.01) {
      c.scale(gg, gg);
      ({
        catnip: function () {
          [[-26, -18, -2.4], [24, -16, -0.7], [-14, -40, -2.0], [14, -42, -1.1], [0, -56, -1.57], [-30, -42, -2.7], [30, -40, -0.4]].forEach(function (L) { leaf(c, 0, -6, Math.hypot(L[0], L[1]) + 16, L[2], '#6BD58A'); });
          if (g > 0.7) [[-18, -66], [6, -74], [24, -60]].forEach(function (p) { for (var i = 0; i < 4; i++) { circle(c, p[0], p[1] + i * 7, 4.5); c.fillStyle = col === '#FFFFFF' ? '#E9DDFF' : col; c.fill(); ink(c, 1.8); } });
        },
        tulip: function () {
          [[-22, -96], [0, -118], [22, -100]].forEach(function (p, i) {
            stem(c, p[0] * 0.3, 0, p[0], p[1], 5);
            leaf(c, p[0] * 0.3, -14, 38, i === 1 ? -1.9 : (i ? -0.6 : -2.5), '#5CCB75');
            c.save(); c.translate(p[0], p[1]);
            c.beginPath(); c.moveTo(-15, -6); c.lineTo(-15, -26); c.lineTo(-7, -18); c.lineTo(0, -30); c.lineTo(7, -18); c.lineTo(15, -26); c.lineTo(15, -6); c.quadraticCurveTo(0, 12, -15, -6); c.closePath();
            c.fillStyle = col; c.fill(); ink(c, 3);
            c.restore();
          });
        },
        cactus: function () {
          c.beginPath(); c.moveTo(-14, -30); c.lineTo(-40, -30); c.lineTo(-40, -56);
          c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 29; c.strokeStyle = INK; c.stroke(); c.lineWidth = 22; c.strokeStyle = '#5CCB75'; c.stroke();
          D.shape(c, D.rrPath(-24, -88, 48, 92, 24), D.tone(c, '#5CCB75', -88, 4), { lw: 3.5, depth: 7, inside: function (c) {
            c.strokeStyle = '#3E9E58'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -80); c.lineTo(0, -4); c.moveTo(-12, -74); c.lineTo(-12, -6); c.moveTo(12, -74); c.lineTo(12, -6); c.stroke();
            c.fillStyle = INK; [[-18, -60], [18, -46], [-6, -30], [10, -70]].forEach(function (p) { circle(c, p[0], p[1], 1.6); c.fill(); });
            // a cute face
            c.beginPath(); c.arc(-8, -54, 3.2, 0, TAU); c.moveTo(11.2, -54); c.arc(8, -54, 3.2, 0, TAU); c.fillStyle = INK; c.fill();
            c.beginPath(); c.moveTo(-5, -46); c.quadraticCurveTo(0, -42, 5, -46); ink(c, 2.2);
          } });
          c.fillStyle = INK; circle(c, -42, -44, 1.6); c.fill();
          if (g > 0.7) { for (var i = 0; i < 6; i++) { ell(c, Math.cos(i * TAU / 6) * 7, -92 + Math.sin(i * TAU / 6) * 7, 7, 4.5, i * TAU / 6); c.fillStyle = col; c.fill(); ink(c, 1.8); } circle(c, 0, -92, 4.5); c.fillStyle = '#FFD23F'; c.fill(); ink(c, 1.8); }
        },
        sunflower: function () {
          stem(c, 0, 0, 4, -168, 7);
          leaf(c, 2, -60, 46, -0.5, '#5CCB75'); leaf(c, 2, -95, 44, -2.6, '#5CCB75');
          c.save(); c.translate(4, -172);
          for (var i = 0; i < 14; i++) { ell(c, Math.cos(i * TAU / 14) * 30, Math.sin(i * TAU / 14) * 30, 16, 8, i * TAU / 14); c.fillStyle = '#FFD23F'; c.fill(); ink(c, 2.2); }
          circle(c, 0, 0, 22); c.fillStyle = '#8B5A3C'; c.fill(); ink(c, 3);
          c.beginPath(); c.moveTo(-10, -2); c.quadraticCurveTo(-6, -7, -2, -2); c.moveTo(2, -2); c.quadraticCurveTo(6, -7, 10, -2); c.lineWidth = 2.5; c.strokeStyle = '#FFE9B0'; c.stroke();
          c.beginPath(); c.moveTo(-5, 6); c.quadraticCurveTo(0, 11, 5, 6); c.stroke();
          c.restore();
        },
        catgrass: function () {
          for (var i = -7; i <= 7; i++) {
            var x = i * 5, h = 80 + ((i * 37) % 23) + Math.abs(i) * -2;
            c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + i * 1.5, -h * 0.6, x + i * 3.5, -h);
            c.lineWidth = 7; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = i % 2 ? '#7BD389' : '#5CCB75'; c.stroke();
          }
        },
        lavender: function () {
          [-24, -8, 8, 24].forEach(function (x, i) {
            var top = -110 - (i % 2) * 18;
            stem(c, x * 0.3, 0, x, top + 30, 4);
            for (var k = 0; k < 6; k++) { ell(c, x + (k % 2 ? 4 : -4), top + k * 8, 6, 5); c.fillStyle = k % 2 ? '#A77BFF' : '#B98FFF'; c.fill(); ink(c, 1.6); }
          });
          leaf(c, 0, -10, 40, -2.6, '#8FBF9A'); leaf(c, 0, -10, 40, -0.5, '#8FBF9A');
        },
        lemon: function () {
          c.beginPath(); c.moveTo(-7, 0); c.lineTo(-5, -96); c.lineTo(5, -96); c.lineTo(7, 0); c.closePath(); c.fillStyle = '#9A6B4A'; c.fill(); ink(c, 3);
          D.shape(c, D.ellPath(0, -140, 58, 58), D.tone(c, '#4FB868', -198, -82), { lw: 3.5, depth: 9, inside: function (c) { circle(c, -26, -152, 22); c.fillStyle = '#5CCB75'; c.fill(); } });
          [[-30, -128], [22, -150], [6, -112], [30, -118], [-8, -170]].forEach(function (p) { ell(c, p[0], p[1], 10, 8, 0.4); c.fillStyle = '#FFE14D'; c.fill(); ink(c, 2.2); });
        },
        shroom: function () {
          [[-24, -46, 22], [16, -64, 28], [30, -30, 16]].forEach(function (m, i) {
            c.save(); c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2 + i); circle(c, m[0], m[1] - 6, m[2] * 1.6); c.fillStyle = col === '#FFFFFF' ? '#E4FFF9' : col; c.fill(); c.restore();
            rr(c, m[0] - m[2] * 0.25, m[1], m[2] * 0.5, -m[1], 5); c.fillStyle = '#FFF3E4'; c.fill(); ink(c, 2.5);
            c.beginPath(); c.arc(m[0], m[1] + 2, m[2], Math.PI, 0); c.closePath(); c.fillStyle = col === '#FFFFFF' ? '#7CE0D2' : col; c.fill(); ink(c, 3);
            c.fillStyle = '#fff'; circle(c, m[0] - m[2] * 0.4, m[1] - m[2] * 0.4, m[2] * 0.16); c.fill(); circle(c, m[0] + m[2] * 0.35, m[1] - m[2] * 0.55, m[2] * 0.12); c.fill();
          });
        }
      }[d.id] || function () {})();
    }
    c.restore();
    // seed sprout before it grows
    if (g <= 0.01 && pl.seed) { c.save(); c.translate(0, B.y); leaf(c, 0, 0, 14, -2.3, '#7BD389'); leaf(c, 0, 0, 14, -0.8, '#7BD389'); c.restore(); }
    c.restore();
  }
  /* ---------- the player's plants (saved by the Grow game) ---------- */
  function load() {
    var p = {};
    try { p = GG.getProgress('grow') || {}; } catch (e) {}
    // plants grown before Grow was its own game lived in Cosy Home's save: move them across once
    if (!Array.isArray(p.plants)) {
      var h = {};
      try { h = GG.getProgress('home') || {}; } catch (e) {}
      p = { plants: Array.isArray(h.plants) ? h.plants : [], next: h.next || 1, grown: h.grown || (Array.isArray(h.plants) ? h.plants.length : 0) };
      try {
        GG.setProgress('grow', p);
        if (Array.isArray(h.plants)) { delete h.plants; delete h.next; delete h.grown; GG.setProgress('home', h); }
      } catch (e) {}
    }
    if (typeof p.next !== 'number') p.next = p.plants.reduce(function (m, x) { return Math.max(m, x.id || 0); }, 0) + 1;
    if (typeof p.grown !== 'number') p.grown = p.plants.length;
    return p;
  }

  window.GGPlants = {
    FLOWER: FLOWER, POTS: POTS, PLANTS: PLANTS,
    def: function (id) { return findDef(PLANTS, id); },
    drawPot: drawPot, drawPlant: drawPlant, drawPotted: drawPotted, soil: soil, potLip: potLip, leaf: leaf,
    /* pots from Pottery: potOf(plant) is what to pass as a pot; base(pot) is where its plant stands ({ y, k: plant scale });
       extraH(plant) is how much taller (or shorter) the potted plant is than in a built-in pot */
    potOf: potOf, base: base, isCustom: function (pot) { return !!cpot(pot); },
    extraH: function (pl) {
      var pot = potOf(pl); if (!cpot(pot)) return 0;
      var b = base(pot, 92), d = findDef(PLANTS, pl.t) || PLANTS[0], top0 = 92 * 0.62 * 0.9;
      var potTop = GGPot.size(pot, cfit(92).w, cfit(92).h).h;
      return Math.round(Math.max(potTop, -b.y + (d.h - top0) * b.k) - d.h);
    },
    load: load,
    save: function (p) { try { GG.setProgress('grow', p); } catch (e) {} },
    list: function () { return load().plants; },
    seedsFor: function (grown) { return PLANTS.filter(function (p) { return grown >= p.grown; }); }
  };
})();
