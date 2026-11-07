/* Cosy Cat Games: the creatures and little things every game shares (mice, dogs, yarn balls, fish). The scenery
   kit (shared/scene.js) does rooms and outdoors; this does the things that live in them. A game never draws one of
   these itself: it calls one and passes parameters. A new kind of thing (or a new view of one) is added here, with a
   cell in tools/scene-gallery.html, before a game uses it. Needs shared/draw.js first.

   House style (shared/draw.js): one ink, outline last with details clipped inside, light from the top left.
   Outlines are the house weights on screen whatever the size: pass `ls`, the scale the canvas is already drawn at
   when you call inside your own c.scale() (default 1).

   Views: 'top' is seen from straight above (games played on a floor or board: Mouse Pop, Yarn Dash, Laser Bounce);
   'side' is seen side-on (games with a floor line: Sneaky Cat, Yarn Defence's runners). Each thing faces +x
   (to the right) unless it says otherwise; pass `dir: -1` or rotate to turn it.

     GGThings.mouse(c, x, y, { view: 'top' | 'side', size (1 = about 70 long), col, a (top: the way it faces, radians),
                    run (a phase: paws/body bob; leave out when still), tail (a phase for the tail), toy (a wind-up key
                    on its back, turning at this angle), sleepy (side: eyes shut), crown (side: a little gold crown),
                    dir (side: 1 right, -1 left), tilt (side: up to ±0.5 when climbing), shadow (default true), ls })
         centred on its body; the side view stands on y (its feet at y + a little)
     GGThings.dog(c, x, y, { view: 'side' | 'top', col: { body, dark, ear, spots }, bed (a colour, or false),
                  lift (0..1 head up), perk (0..1 ear up), open (0..1 mouth, a bark), eyes: 'closed' | 'peek' | 'open',
                  wag (a phase), breathe (a small squash, e.g. sin(t) * 0.03), dir (side: 1 head right, -1 head left), ls })
         side: lying on its bed, (x, y) the floor under its middle; top: curled up in a round bed seen from above,
         (x, y) the bed's middle
     GGThings.yarnBall(c, x, y, { r, col, gold, spin, end (a loose end), shadow, ls })   centred
     GGThings.fish(c, x, y, { size (1 = 34 long), col, gold (a soft glow), a (turn), ls })   centred, facing left */
(function () {
  'use strict';
  var D = window.GGDraw, INK = D.INK, LW = D.LW, TAU = Math.PI * 2;
  function W(o, w, k) { return w / (((o && o.ls) || 1) * (k || 1)); }   // a house line weight, at the scale we're drawn at
  function pick(v, d) { return v === undefined || v === null ? d : v; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function star(c, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, q = i % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); }

  /* ================= mouse ================= */
  var MOUSE_TOP = new Path2D('M-32 0Q-30 -22 0 -21Q30 -18 38 0Q30 18 0 21Q-30 22 -32 0Z');
  function mouse(c, x, y, o) {
    o = o || {};
    if (o.view === 'side') return mouseSide(c, x, y, o);
    var s = pick(o.size, 1), a = o.a || 0, col = o.col || '#C9C2D6', run = o.run || 0, tl = pick(o.tail, 0);
    var lm = W(o, LW.mid, s), lf = W(o, LW.fine, s);
    if (o.shadow !== false) { c.save(); c.translate(x + 3, y + 6); c.rotate(a); c.scale(s, s); c.fillStyle = 'rgba(42,35,64,.16)'; c.beginPath(); c.ellipse(2, 0, 38, 24, 0, 0, TAU); c.fill(); c.restore(); }
    c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
    // the crescent of shade sits to the lower right on screen, whichever way the mouse faces
    var cs = Math.cos(-a), sn = Math.sin(-a), ox = -5 / s, oy = -7 / s;
    // tail (starts under the body), outlined
    c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(-54, -8 + Math.sin(tl) * 10, -70, 4);
    c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 5 + lf * 2; c.stroke(); c.strokeStyle = '#FF8FAB'; c.lineWidth = 5; c.stroke();
    // little paws peeking out from under the body (a toy mouse runs on wheels: none)
    if (!o.toy && o.toy !== 0) [[-14, -20, 1], [14, -19, -1], [-14, 20, -1], [14, 19, 1]].forEach(function (f) { c.beginPath(); c.ellipse(f[0] + Math.sin(run) * 4 * f[2], f[1], 7, 5, 0, 0, TAU); c.fillStyle = '#FFB3C7'; c.fill(); D.ink(c, lf); });
    D.shape(c, MOUSE_TOP, col, { lw: lm, depth: 1, dx: ox * cs - oy * sn, dy: ox * sn + oy * cs, shade: 'rgba(42,35,64,.14)' });
    [-20, 20].forEach(function (ey) { D.shape(c, D.ellPath(10, ey, 11, 11), col, { lw: lf, depth: 0, inside: function (c) { c.beginPath(); c.arc(10, ey, 6, 0, TAU); c.fillStyle = '#FFB3C7'; c.fill(); } }); });
    // face: eyes inside; whiskers and nose out at the tip, so nothing crosses the outline
    c.fillStyle = INK; c.beginPath(); c.arc(26, -7, 3.6, 0, TAU); c.fill(); c.beginPath(); c.arc(26, 7, 3.6, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(42, -4); c.lineTo(52, -11); c.moveTo(42, 4); c.lineTo(52, 11); c.strokeStyle = 'rgba(42,35,64,.5)'; c.lineWidth = 2 / s; c.stroke();
    c.beginPath(); c.arc(39, 0, 5, 0, TAU); c.fillStyle = '#FF7FA6'; c.fill(); D.ink(c, lf);
    if (o.toy || o.toy === 0) {
      // the wind-up key on its back
      c.save(); c.translate(-8, 0); c.rotate(o.toy);
      c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.strokeStyle = INK; c.lineWidth = 4 + lf * 2; c.stroke(); c.strokeStyle = '#E0A100'; c.lineWidth = 4; c.stroke();
      [-12, 12].forEach(function (kx) { D.shape(c, D.ellPath(kx, 0, 5, 5), '#FFD23F', { lw: lf, depth: 0 }); });
      c.restore();
    }
    c.restore();
  }
  /* side on: a plump body, one ear, a long tail; drawn in a 36-long space and scaled up to match the top view */
  function mouseSide(c, x, y, o) {
    var s = pick(o.size, 1) * 2, col = o.col || '#B8B3C9', dir = o.dir === -1 ? -1 : 1;
    var lm = W(o, LW.fine, s), lf = W(o, 2.5, s), bob = Math.sin(o.run || 0) * 1.5;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (o.shadow !== false) D.shadow(c, 0, 9, 14, 4);
    c.save(); if (dir < 0) c.scale(-1, 1); c.rotate(clamp(o.tilt || 0, -0.5, 0.5) * 0.5);
    c.beginPath(); c.moveTo(-14, 2); c.quadraticCurveTo(-26, -2 + Math.sin(pick(o.tail, 0)) * 5, -30, 6); c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 1.8 + lf * 0.9; c.stroke(); c.strokeStyle = '#FFB4C6'; c.lineWidth = 1.8; c.stroke();
    D.shape(c, function (p) { p.moveTo(-16, 4 + bob); p.quadraticCurveTo(-16, -12 + bob, 2, -12 + bob); p.quadraticCurveTo(16, -12 + bob, 20, 2 + bob); p.quadraticCurveTo(18, 8 + bob, 4, 8 + bob); p.lineTo(-12, 8 + bob); p.quadraticCurveTo(-16, 8 + bob, -16, 4 + bob); p.closePath(); }, col, { lw: lm, depth: 3 });
    D.shape(c, D.ellPath(6, -12 + bob, 6, 6), '#FFB4C6', { lw: lf, depth: 0 });
    c.beginPath(); c.arc(21, 2 + bob, 2.4, 0, TAU); c.fillStyle = '#FF8FAB'; c.fill();
    if (o.sleepy) { c.beginPath(); c.moveTo(10, -3 + bob); c.lineTo(15, -3 + bob); c.strokeStyle = INK; c.lineWidth = lf * 0.8; c.stroke(); }
    else { c.beginPath(); c.arc(13, -3 + bob, 2, 0, TAU); c.fillStyle = INK; c.fill(); }
    if (o.crown) D.shape(c, function (p) { p.moveTo(-4, -12 + bob); p.lineTo(10, -12 + bob); p.lineTo(8, -20 + bob); p.lineTo(3, -15 + bob); p.lineTo(-2, -20 + bob); p.closePath(); }, '#FFD23F', { lw: lf * 0.9, depth: 0 });
    c.restore();
    c.restore();
  }

  /* ================= dog ================= */
  var DOG_COL = { body: '#C98B5B', dark: '#9A6440', ear: '#7E4E30' };
  function dog(c, x, y, o) {
    o = o || {};
    return o.view === 'top' ? dogTop(c, x, y, o) : dogSide(c, x, y, o);
  }
  function eyesSide(c, o, lf) {
    var e = o.eyes || 'closed';
    if (e === 'closed') { c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(-8, -1, -2, -6); D.ink(c, lf); }
    else if (e === 'peek') { c.beginPath(); c.moveTo(-15, -6); c.lineTo(-1, -6); D.ink(c, lf); c.beginPath(); c.arc(-8, -4, 3, 0, Math.PI); c.fillStyle = INK; c.fill(); }
    else {
      c.beginPath(); c.arc(-8, -6, 6.5, 0, TAU); c.fillStyle = '#FFFFFF'; c.fill(); D.ink(c, lf * 0.85);
      c.beginPath(); c.arc(-10, -6, 3.4, 0, TAU); c.fillStyle = INK; c.fill();
      c.beginPath(); c.moveTo(-17, -16); c.lineTo(-2, -15); D.ink(c, lf);
    }
  }
  /* lying on its bed, side on; drawn with its head on the left (-x) and turned by dir */
  function dogSide(c, x, y, o) {
    var col = o.col || DOG_COL, lift = clamp(o.lift || 0, 0, 1), perk = clamp(o.perk || 0, 0, 1), open = clamp(o.open || 0, 0, 1);
    var lm = W(o, LW.mid), lf = W(o, LW.fine), breathe = o.breathe || 0;
    c.save(); c.translate(x, y); c.scale(o.dir === 1 ? -1 : 1, 1);
    if (o.bed !== false) {
      var bed = o.bed || '#B05F7C';
      D.shape(c, D.ellPath(0, -4, 104, 22), bed, { lw: lm, depth: 0 });
      D.shape(c, D.ellPath(0, -10, 88, 14), D.lighter(bed, 0.18), { lw: 0, depth: 0 });
    }
    // tail (wags a little when awake)
    c.save(); c.translate(58, -36); c.rotate(0.5 + Math.sin(o.wag || 0) * 0.4 * (lift > 0.5 ? 1 : 0));
    D.shape(c, function (p) { p.moveTo(0, -6); p.quadraticCurveTo(26, -20, 40, -6); p.quadraticCurveTo(28, -8, 2, 6); p.closePath(); }, col.body, { lw: lf, depth: 0 });
    c.restore();
    c.save(); c.translate(0, -34); c.scale(1, 1 + breathe);
    D.shape(c, D.ellPath(0, 0, 70, 30), col.body, { lw: lm, depth: 6, inside: col.spots ? function (c) { c.fillStyle = '#4A4262'; [[10, -14, 16, 11], [-28, 6, 12, 9], [40, 4, 10, 8]].forEach(function (s) { c.beginPath(); c.ellipse(s[0], s[1], s[2], s[3], 0.3, 0, TAU); c.fill(); }); } : null });
    c.restore();
    D.shape(c, D.ellPath(38, -24, 24, 20), col.body, { lw: lm, depth: 4 });
    D.shape(c, D.rrPath(34, -12, 36, 14, 7), col.body, { lw: lf, depth: 0 });
    D.shape(c, D.rrPath(-104, -16, 56, 16, 8), col.body, { lw: lf, depth: 0 });
    D.shape(c, D.rrPath(-96, -10, 50, 14, 7), col.dark, { lw: lf, depth: 0 });
    // head: resting on the paws asleep, up when awake
    c.save(); c.translate(-74 - lift * 6, -34 - lift * 38); c.rotate(lerp(0.12, -0.05, lift));
    D.shape(c, D.ellPath(0, 0, 30, 25), col.body, { lw: lm, depth: 4 });
    D.shape(c, D.ellPath(-28, 6 + open * 2, 18, 12 + open * 3), col.body, { lw: lf, depth: 0 });
    if (open > 0.2) { c.beginPath(); c.ellipse(-30, 14 + open * 4, 10, 4 + open * 5, 0, 0, TAU); c.fillStyle = '#A3405C'; c.fill(); D.ink(c, lf * 0.85); }
    c.beginPath(); c.ellipse(-44, 2, 6, 5, 0, 0, TAU); c.fillStyle = INK; c.fill();
    eyesSide(c, o, lf);
    // the floppy ear: hangs down asleep, perks up as it wakes
    c.save(); c.translate(10, -16); c.rotate(lerp(0.2, -0.9, perk) + (o.twitch || 0));
    D.shape(c, function (p) { p.moveTo(-6, 0); p.quadraticCurveTo(14, -6, 16, 14); p.quadraticCurveTo(16, 34, 6, 36); p.quadraticCurveTo(-4, 30, -6, 0); p.closePath(); }, col.ear, { lw: lf, depth: 0 });
    c.restore();
    c.restore();
    c.restore();
  }
  /* curled up in a round bed, seen from above; the head lifts towards the viewer when it wakes */
  var BED = D.ellPath(0, 10, 92, 70), BED_IN = D.ellPath(0, 10, 72, 52), BODY = D.ellPath(6, 18, 56, 38), HEAD = D.ellPath(0, 0, 34, 28);
  function dogTop(c, x, y, o) {
    var col = o.col || DOG_COL, up = clamp(o.lift || 0, 0, 1), lm = W(o, LW.mid), lf = W(o, LW.fine);
    c.save(); c.translate(x, y);
    if (o.bed !== false) {
      var bed = o.bed || '#B48CFF';
      D.shadow(c, 4, 22, 92, 64);
      D.shape(c, BED, D.tone(c, bed, -60, 80), { lw: lm, depth: 10 });
      D.shape(c, BED_IN, D.lighter(bed, 0.55), { lw: lf, depth: 0, inside: function (c) { c.fillStyle = 'rgba(42,35,64,.1)'; c.beginPath(); c.ellipse(8, 20, 72, 52, 0, 0, TAU); c.rect(-200, -200, 400, 400); c.fill('evenodd'); } });
    }
    // tail first, starting inside the body, so the body covers the join
    c.beginPath(); c.moveTo(50, 20); c.quadraticCurveTo(78, 8 + Math.sin(o.wag || 0) * 6, 70, -6); c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 6 + lm * 2; c.stroke(); c.strokeStyle = col.body; c.lineWidth = 6; c.stroke();
    var light = D.lighter(col.body, 0.3);
    D.shape(c, BODY, D.tone(c, col.body, -20, 56), { lw: lm, depth: 8, inside: function (c) { c.beginPath(); c.ellipse(18, 30, 26, 12, 0.3, 0, TAU); c.fillStyle = light; c.fill(); } });
    c.save(); c.translate(-30, 10 - up * 26);
    D.shape(c, HEAD, D.tone(c, col.body, -28, 28), { lw: lm, depth: 6, inside: function (c) { c.beginPath(); c.ellipse(0, 12, 16, 12, 0, 0, TAU); c.fillStyle = light; c.fill(); } });
    var flop = o.flop || 0;
    [[-28, 0.4 + flop], [28, -0.4 - flop]].forEach(function (e) { D.shape(c, D.ellPath(e[0], 4, 12, 22, e[1]), col.ear, { lw: lf, depth: 3 }); });
    c.beginPath(); c.ellipse(0, 6, 6, 4.5, 0, 0, TAU); c.fillStyle = INK; c.fill();
    var e = o.eyes || 'closed';
    if (e === 'closed') { c.beginPath(); c.moveTo(-16, -6); c.quadraticCurveTo(-10, -1, -4, -6); c.moveTo(4, -6); c.quadraticCurveTo(10, -1, 16, -6); D.ink(c, lf); }
    else if (e === 'peek') { c.beginPath(); c.moveTo(-16, -6); c.quadraticCurveTo(-10, -1, -4, -6); D.ink(c, lf); c.beginPath(); c.arc(10, -6, 4.5, 0, TAU); c.fillStyle = INK; c.fill(); }
    else { c.fillStyle = INK; c.beginPath(); c.arc(-10, -6, 5, 0, TAU); c.fill(); c.beginPath(); c.arc(10, -6, 5, 0, TAU); c.fill(); if (o.open) { c.beginPath(); c.ellipse(0, 20, 7, 6, 0, 0, TAU); c.fillStyle = '#FF7FA6'; c.fill(); D.ink(c, lf); } }
    c.restore();
    c.restore();
  }

  /* ================= yarn ball ================= */
  function yarnBall(c, x, y, o) {
    o = o || {};
    var r = o.r || 20, col = o.gold ? '#FFD23F' : (o.col || '#FF8FAB'), lw = W(o, r > 26 ? LW.mid : LW.fine);
    c.save(); c.translate(x, y);
    if (o.shadow) D.shadow(c, 3, r * 0.9, r * 0.9, r * 0.3);
    c.rotate(o.spin || 0);
    if (o.end) {
      // a loose end, starting under the ball so the ball covers the join
      c.beginPath(); c.moveTo(r * 0.45, r * 0.5); c.quadraticCurveTo(r * 1.3, r * 0.9, r * 1.1, r * 1.3); c.lineCap = 'round';
      var tw = Math.max(1.5, r * 0.15);
      c.strokeStyle = INK; c.lineWidth = tw + W(o, LW.fine) * 2; c.stroke(); c.strokeStyle = o.gold ? '#FFC21A' : col; c.lineWidth = tw; c.stroke();
    }
    D.shape(c, D.ellPath(0, 0, r, r), D.tone(c, col, -r, r), { lw: lw, depth: r * 0.2, shade: 'rgba(42,35,64,.15)', inside: function (c) {
      c.strokeStyle = o.gold ? '#C98A00' : 'rgba(42,35,64,.32)'; c.lineWidth = Math.max(1.2, r * 0.1);
      for (var i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-r, i * r * 0.32 - r * 0.3); c.quadraticCurveTo(0, i * r * 0.32 + r * 0.3, r, i * r * 0.32 - r * 0.3); c.stroke(); }
      c.beginPath(); c.moveTo(-r * 0.2, -r); c.quadraticCurveTo(r * 0.5, 0, -r * 0.2, r); c.stroke();
    }, shine: [-r * 0.4, -r * 0.45, r * 0.32, r * 0.18, -0.6, 0.6] });
    c.restore();
  }

  /* ================= fish ================= */
  var FISH = new Path2D('M-16 0Q-4 -12 8 -5L17 -11L17 11L8 5Q-4 12 -16 0Z');
  function fish(c, x, y, o) {
    o = o || {};
    var s = pick(o.size, 1), col = o.gold ? '#FFD23F' : (o.col || '#7CC4FF');
    c.save(); c.translate(x, y); if (o.a) c.rotate(o.a); c.scale(s, s);
    if (o.gold) { c.save(); c.globalAlpha = 0.45; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fillStyle = '#FFE58A'; c.fill(); c.restore(); }
    D.shape(c, FISH, col, { lw: W(o, LW.fine, s), depth: 3 });
    c.beginPath(); c.arc(-8, -1.5, 2, 0, TAU); c.fillStyle = INK; c.fill();
    c.restore();
  }

  window.GGThings = {
    VARIANTS: { mouse: ['top', 'side'], dog: ['side', 'top'], yarnBall: ['plain', 'gold'], fish: ['plain', 'gold'] },
    mouse: mouse, dog: dog, yarnBall: yarnBall, fish: fish, star: star
  };
})();
