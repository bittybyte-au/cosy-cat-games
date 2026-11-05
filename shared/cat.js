/* Cosy Cat Games: the one cat.
   Every cat on the site and in the games is drawn from these shapes: same head, same soft
   rounded-tip ears, same face. Options change the build (short, chubby, fluffy), colours,
   markings (tabby, calico, tuxedo, patch), eyes, mouth and small extras (bow, bell, chef's hat).

   The shapes are written once as SVG path data in a 100-unit space (head centred near 0,0,
   about 88 wide) and drawn two ways from the same list:
     GGCat.svg(opts)        a whole <svg> (pages, avatars)
     GGCat.g(opts)          an SVG <g> to place inside another picture (x, y, size)
     GGCat.draw(ctx, opts)  onto a canvas at the current origin (games); opts.size = width in px
   opts.pose: 'head' (default), 'sit', 'wave' (sit with a waving paw), 'peek' (paws on a ledge), 'lie' (asleep). */
(function () {
  var INK = '#2A2340';

  /* the six game cats; each has its own detail so they can be told apart without colour */
  var PRESETS = {
    ginger: { color: '#FFA94D', dark: '#E07B1F', inner: '#FFC7A0', markings: 'tabby' },
    pink:   { color: '#FF9EC4', dark: '#E8558E', inner: '#FFD3E4', extra: 'bow' },
    blue:   { color: '#7CC4FF', dark: '#3B8FD6', inner: '#CDE8FF', eyes: 'sleepy' },
    purple: { color: '#B48CFF', dark: '#7E55D6', inner: '#E2D3FF', mouth: 'grin' },
    black:  { color: '#4A4160', dark: '#2E2840', inner: '#8E7FA8', line: '#F3EEFF', eyes: 'green', cheeks: false },
    white:  { color: '#FFFFFF', dark: '#D9D3E6', inner: '#FFC4D6', extra: 'bell' },
    // the chef mascot: white with a ginger patch, chef's hat
    chef:   { color: '#FFFFFF', inner: '#FFB3C7', markings: 'patch', patch: '#FFB26B', eyes: 'happy', hat: 'chef' },
    // the sun in the sky
    sun:    { color: '#FFC93C', inner: '#FF8FAB', eyes: 'happy' }
  };
  var GAME_ORDER = ['ginger', 'pink', 'blue', 'purple', 'black', 'white'];

  /* ---------- tiny path helpers (100-unit space) ---------- */
  function n(v) { return Math.round(v * 100) / 100; }
  function ell(cx, cy, rx, ry) { return 'M' + n(cx - rx) + ' ' + n(cy) + 'A' + n(rx) + ' ' + n(ry) + ' 0 1 0 ' + n(cx + rx) + ' ' + n(cy) + 'A' + n(rx) + ' ' + n(ry) + ' 0 1 0 ' + n(cx - rx) + ' ' + n(cy) + 'Z'; }
  function circ(cx, cy, r) { return ell(cx, cy, r, r); }
  function rgb(hex) { var h = String(hex).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var v = parseInt(h, 16) || 0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function isDark(c) { if (typeof c !== 'string' || c.charAt(0) !== '#') return false; var a = rgb(c); return (0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]) < 110; }
  function shade(c, k) { var a = rgb(c); return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v * (1 - k)))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }

  /* head outline for each build */
  function headGeom(build) {
    if (build === 'chubby') return { cx: 0, cy: 7, rx: 50, ry: 39 };
    if (build === 'fluffy') return { cx: 0, cy: 6, rx: 42, ry: 35 };
    return { cx: 0, cy: 6, rx: 44, ry: 37 };
  }
  function headPath(build) {
    var g = headGeom(build);
    if (build !== 'fluffy') return ell(g.cx, g.cy, g.rx, g.ry);
    var d = '', k = 16;
    for (var i = 0; i <= k; i++) {
      var a = (i / k) * Math.PI * 2, x = g.cx + Math.cos(a) * g.rx, y = g.cy + Math.sin(a) * g.ry;
      if (!i) { d += 'M' + n(x) + ' ' + n(y); continue; }
      var am = ((i - 0.5) / k) * Math.PI * 2;
      d += 'Q' + n(g.cx + Math.cos(am) * (g.rx + 8)) + ' ' + n(g.cy + Math.sin(am) * (g.ry + 8)) + ' ' + n(x) + ' ' + n(y);
    }
    return d + 'Z';
  }
  /* the one ear shape: soft and rounded at the tip. side -1 left, 1 right; w stretches it for wider heads */
  function earPath(side, w) { var s = side * (w || 1); return 'M' + n(s * 40) + ' -2Q' + n(s * 44) + ' -36 ' + n(s * 36) + ' -44Q' + n(s * 24) + ' -38 ' + n(s * 8) + ' -30Z'; }
  function earInner(side, w) { var s = side * (w || 1); return 'M' + n(s * 33) + ' -12L' + n(s * 34) + ' -34L' + n(s * 18) + ' -27Z'; }

  /* ---------- build the list of shapes ----------
     each shape: { d, fill, stroke, lw, alpha, tf: [x, y, deg, scale], clip: true (clipped to the head) } */
  function shapesFor(o) {
    var P = o.preset && PRESETS[o.preset] ? PRESETS[o.preset] : {};
    var get = function (k, dflt) { return o[k] !== undefined ? o[k] : (P[k] !== undefined ? P[k] : dflt); };
    var plain = !!o.plain; // a special fill (like a rainbow) with no colour-specific details
    var fill = get('color', '#FFFFFF');
    var dark = isDark(fill);
    var line = get('line', dark ? '#F3EEFF' : INK);
    var inner = get('inner', '#FFB3C7');
    var build = get('build', 'short');
    var markings = plain ? 'none' : get('markings', 'none');
    var expr = o.face || 'open';                                   // open | blink | happy | surprised | yawn | sleep
    var eyes = plain ? 'dot' : get('eyes', 'dot');
    if (expr === 'blink' || expr === 'yawn' || expr === 'sleep') eyes = 'closed';
    else if (expr === 'happy') eyes = 'happy';
    else if (expr === 'surprised') eyes = 'surprised';
    var mouth = plain ? 'w' : get('mouth', 'w');
    if (expr === 'yawn') mouth = 'yawn'; else if (expr === 'surprised') mouth = 'o'; else if (expr === 'happy' && !o.mouth) mouth = 'grin';
    var cheeks = get('cheeks', true);
    var extra = plain ? 'none' : get('extra', 'none');
    var hat = get('hat', 'none');
    var g = headGeom(build), wide = g.rx / 44;
    var S = [];
    var patch = get('patch', '#FFB26B');

    // ears (the patch cat has a ginger right ear; calico a ginger and a dark one)
    var earL = fill, earR = fill;
    if (markings === 'patch') earR = patch;
    if (markings === 'calico') { earL = '#FFA94D'; earR = '#4A4458'; }
    S.push({ d: earPath(-1, wide), fill: earL, stroke: INK, lw: 5 });
    S.push({ d: earPath(1, wide), fill: earR, stroke: INK, lw: 5 });
    S.push({ d: earInner(-1, wide) + earInner(1, wide), fill: inner });
    // head
    var head = headPath(build);
    S.push({ d: head, fill: fill });
    if (markings === 'tabby') S.push({ d: 'M-10 -28L-10 -19M0 -29L0 -15M10 -28L10 -19M-44 4L-33 7M-44 14L-33 13M44 4L33 7M44 14L33 13', stroke: get('dark', shade(fill, 0.28)), lw: 4.5, clip: true });
    if (markings === 'calico') S.push({ d: 'M-50 -26Q-20 -30 -14 -6Q-24 8 -50 4Z', fill: '#FFA94D', clip: true }, { d: 'M50 -22Q22 -28 16 -6Q24 8 50 2Z', fill: '#4A4458', clip: true }, { d: ell(26, 40, 16, 9), fill: '#FFA94D', clip: true });
    // tuxedo: a white blaze down the face, a white muzzle and chin
    if (markings === 'tuxedo') S.push({ d: 'M0 -26Q-5 -10 -9 2Q-24 6 -24 20Q-20 40 0 44Q20 40 24 20Q24 6 9 2Q5 -10 0 -26Z', fill: '#FFFFFF', clip: true });
    if (markings === 'patch') S.push({ d: 'M14 -32Q40 -30 46 0Q30 -6 20 -10Q12 -20 14 -32Z', fill: patch, clip: true });
    S.push({ d: head, stroke: INK, lw: 5 });
    // a tuxedo cat's eyes and whiskers sit on dark fur; its nose and mouth on the white muzzle
    var whisker = line;
    if (markings === 'tuxedo') { whisker = '#F3EEFF'; line = INK; if (!o.eyeColor) o = Object.assign({}, o, { eyeColor: '#F3EEFF' }); }

    // cheeks
    if (cheeks && !o.noCheeks) S.push({ d: ell(-26, 16, 7, 4.5) + ell(26, 16, 7, 4.5), fill: 'rgba(255,120,160,.45)' });
    // eyes
    var ex = 16, ey = 2, eyeLine = o.eyeColor || line;
    if (!o.noEyes) {
      if (eyes === 'closed') S.push({ d: 'M' + (-ex - 6) + ' ' + ey + 'Q' + (-ex) + ' ' + (ey + 4.5) + ' ' + (-ex + 6) + ' ' + ey + 'M' + (ex - 6) + ' ' + ey + 'Q' + ex + ' ' + (ey + 4.5) + ' ' + (ex + 6) + ' ' + ey, stroke: eyeLine, lw: 4.5 });
      else if (eyes === 'happy') S.push({ d: 'M' + (-ex - 6.5) + ' ' + (ey + 2) + 'Q' + (-ex) + ' ' + (ey - 7) + ' ' + (-ex + 6.5) + ' ' + (ey + 2) + 'M' + (ex - 6.5) + ' ' + (ey + 2) + 'Q' + ex + ' ' + (ey - 7) + ' ' + (ex + 6.5) + ' ' + (ey + 2), stroke: eyeLine, lw: 4.5 });
      else if (eyes === 'surprised') S.push({ d: circ(-ex, ey, 7.5) + circ(ex, ey, 7.5), fill: '#FFFFFF', stroke: INK, lw: 3 }, { d: circ(-ex, ey, 3.5) + circ(ex, ey, 3.5), fill: INK });
      else if (eyes === 'sleepy') S.push({ d: 'M' + (-ex - 7) + ' ' + (ey - 1) + 'A7 7 0 0 0 ' + (-ex + 7) + ' ' + (ey - 1) + 'ZM' + (ex - 7) + ' ' + (ey - 1) + 'A7 7 0 0 0 ' + (ex + 7) + ' ' + (ey - 1) + 'Z', fill: INK }, { d: 'M' + (-ex - 8) + ' ' + (ey - 1.5) + 'L' + (-ex + 8) + ' ' + (ey - 1.5) + 'M' + (ex - 8) + ' ' + (ey - 1.5) + 'L' + (ex + 8) + ' ' + (ey - 1.5), stroke: INK, lw: 4 });
      else if (eyes === 'green') S.push({ d: ell(-ex, ey, 8.5, 7.5) + ell(ex, ey, 8.5, 7.5), fill: '#9BFF6E' }, { d: ell(-ex, ey, 2.5, 6) + ell(ex, ey, 2.5, 6), fill: '#16131F' }, { d: circ(-ex + 3, ey - 3, 1.8) + circ(ex + 3, ey - 3, 1.8), fill: '#FFFFFF' });
      else S.push({ d: ell(-ex, ey, 5.5, 6.5) + ell(ex, ey, 5.5, 6.5), fill: eyeLine }, { d: circ(-ex + 2, ey - 2.5, 2) + circ(ex + 2, ey - 2.5, 2), fill: line === INK ? '#FFFFFF' : INK });
    }
    // nose and mouth
    S.push({ d: 'M-3.5 9L3.5 9L0 13Z', fill: '#FF7FA6' });
    if (!o.noMouth) {
      if (mouth === 'yawn') S.push({ d: ell(0, 22, 7.2, 8), fill: '#7A2E4A', stroke: line, lw: 3 });
      else if (mouth === 'o') S.push({ d: ell(0, 20, 3.6, 4), fill: '#7A2E4A', stroke: line, lw: 3 });
      else if (mouth === 'grin') S.push({ d: 'M-10 15Q0 32 10 15Z', fill: '#7A2E4A', stroke: line, lw: 3 }, { d: ell(0, 21.5, 4, 2.5), fill: '#FF8FAB' });
      else S.push({ d: 'M-7 15Q-3.5 20 0 14Q3.5 20 7 15', stroke: line, lw: 3 });
    }
    // whiskers
    S.push({ d: 'M-30 10L-47 7M-30 15L-46 17M30 10L47 7M30 15L46 17', stroke: whisker, lw: 1.8, alpha: 0.7 });
    // little extras
    if (extra === 'bow') S.push({ d: 'M0 0L-13 -8L-13 8ZM0 0L13 -8L13 8Z', fill: '#FF4F86', stroke: INK, lw: 3, tf: [25, -30, 20] }, { d: circ(0, 0, 4), fill: '#FF4F86', stroke: INK, lw: 3, tf: [25, -30, 20] });
    if (extra === 'bell') S.push({ d: circ(0, g.cy + g.ry - 1, 7.5), fill: '#FFC93C', stroke: INK, lw: 3 }, { d: 'M-5 ' + (g.cy + g.ry) + 'L5 ' + (g.cy + g.ry), stroke: INK, lw: 3 });
    if (hat === 'chef') {
      var t = g.cy - g.ry; // top of the head
      // outline everything first, then fill, so the puffs read as one soft shape
      var hatD = 'M-18 ' + (t + 6) + 'L18 ' + (t + 6) + 'L18 ' + (t - 8) + 'L-18 ' + (t - 8) + 'Z' + circ(-14, t - 14, 12) + circ(14, t - 14, 12) + circ(0, t - 22, 14);
      S.push({ d: hatD, stroke: INK, lw: 9 }, { d: hatD, fill: '#FFFFFF' }, { d: 'M-18 ' + (t - 4) + 'L18 ' + (t - 4), stroke: '#E9E3F2', lw: 2 });
    }
    return { shapes: S, head: head, fill: fill, inner: inner, line: line };
  }

  /* bodies for the poses, drawn behind (back) or in front of (front) the head */
  function poseShapes(pose, fill) {
    var back = [], front = [];
    var paw = function (x, y) { return [{ d: ell(x, y, 14, 15), fill: fill, stroke: INK, lw: 4 }, { d: circ(x, y + 3, 4) + circ(x - 6, y - 4, 2.2) + circ(x, y - 7, 2.2) + circ(x + 6, y - 4, 2.2), fill: '#FFB3C7' }]; };
    if (pose === 'sit' || pose === 'wave') {
      back.push({ d: 'M-30 76Q-62 72 -56 44Q-52 32 -42 38', stroke: INK, lw: 13 }, { d: 'M-30 76Q-62 72 -56 44Q-52 32 -42 38', stroke: '#FFB26B', lw: 6 });
      back.push({ d: ell(0, 64, 38, 26), fill: fill, stroke: INK, lw: 5 });
      back.push({ d: ell(-14, 88, 11, 7) + ell(14, 88, 11, 7), fill: fill, stroke: INK, lw: 4 });
      if (pose === 'wave') front.push({ d: 'M28 70Q44 62 46 44', stroke: INK, lw: 16, wave: true }, { d: 'M28 70Q44 62 46 44', stroke: fill, lw: 8, wave: true }, { d: ell(47, 36, 12, 13), fill: fill, stroke: INK, lw: 4, wave: true }, { d: circ(47, 39, 3.6) + circ(41, 31, 2) + circ(47, 28, 2) + circ(53, 31, 2), fill: '#FFB3C7', wave: true });
    }
    if (pose === 'peek') front = front.concat(paw(-24, 46), paw(24, 46));
    return { back: back, front: front };
  }

  /* the picture's bounds in the 100-unit space, per pose */
  var BOX = { head: [-52, -72, 104, 124], sit: [-66, -72, 128, 172], wave: [-66, -72, 128, 172], peek: [-52, -72, 104, 136], lie: [-96, -52, 176, 100] };

  function allShapes(o) {
    var pose = o.pose || 'head';
    var c = shapesFor(o);
    if (pose === 'lie') {
      // asleep: body and curled tail on the left, head resting on the right
      var f = c.fill;
      var body = [{ d: 'M-50 30Q-86 30 -80 8Q-76 -2 -66 4', stroke: INK, lw: 12 }, { d: 'M-50 30Q-86 30 -80 8Q-76 -2 -66 4', stroke: '#FFB26B', lw: 5 }, { d: ell(-20, 22, 46, 22), fill: f, stroke: INK, lw: 5 }];
      var head = c.shapes.map(function (s) { var t = {}; for (var k in s) t[k] = s[k]; t.tf = [30, 2, 0, 0.78]; if (s.tf) t.tf2 = s.tf; return t; });
      return { list: body.concat(head), head: c.head, headTf: [30, 2, 0, 0.78] };
    }
    var p = poseShapes(pose, c.fill);
    if (o.rays) {
      var r = '';
      for (var i = 0; i < 12; i++) { var a = (i / 12) * Math.PI * 2 + 0.26; if (Math.sin(a) < -0.55) continue; r += 'M' + n(Math.cos(a) * 54) + ' ' + n(6 + Math.sin(a) * 46) + 'L' + n(Math.cos(a) * 66) + ' ' + n(6 + Math.sin(a) * 58); }
      p.back.unshift({ d: r, stroke: INK, lw: 5 });
    }
    return { list: p.back.concat(c.shapes, p.front), head: c.head };
  }

  /* ---------- SVG ---------- */
  var uid = 0;
  function tfAttr(tf) { if (!tf) return ''; return ' transform="translate(' + tf[0] + ' ' + tf[1] + ')' + (tf[2] ? ' rotate(' + tf[2] + ')' : '') + (tf[3] && tf[3] !== 1 ? ' scale(' + tf[3] + ')' : '') + '"'; }
  function shapeSVG(s, clipId) {
    var a = '<path d="' + s.d + '"';
    a += ' fill="' + (s.fill || 'none') + '"';
    if (s.stroke) a += ' stroke="' + s.stroke + '" stroke-width="' + s.lw + '" stroke-linecap="round" stroke-linejoin="round"';
    if (s.alpha) a += ' opacity="' + s.alpha + '"';
    a += '/>';
    if (s.tf2) a = '<g' + tfAttr(s.tf2) + '>' + a + '</g>';
    if (s.clip) a = '<g clip-path="url(#' + clipId + ')">' + a + '</g>';
    if (s.tf) a = '<g' + tfAttr(s.tf) + '>' + a + '</g>';
    return a;
  }
  function inner(o) {
    var r = allShapes(o), id = 'ggc' + (++uid);
    // the clip is used inside each shape's own transform, so it is the plain head outline
    var out = '<defs><clipPath id="' + id + '"><path d="' + r.head + '"/></clipPath></defs>';
    var waving = '';
    // extra SVG in the same 100-unit space (avatar hats and hair): behind the cat, over the head, in front
    out += o.svgBack || '';
    var headEnd = r.list.length;
    r.list.forEach(function (s, i) { if (s.d === r.head && s.stroke && !s.fill) headEnd = i; });
    r.list.forEach(function (s, i) {
      if (i === headEnd + 1 && o.svgOverHead) out += o.svgOverHead;
      var piece = shapeSVG(s, id);
      if (s.wave) waving += piece; else out += piece;
    });
    if (waving) out += '<g class="cat-wave" style="transform-box:fill-box;transform-origin:20% 100%">' + waving + '</g>';
    if (o.zzz) out += '<text x="58" y="-30" font-family="Baloo 2, ui-rounded, sans-serif" font-weight="800" font-size="18" fill="#5E5675">z</text><text x="70" y="-46" font-family="Baloo 2, ui-rounded, sans-serif" font-weight="800" font-size="26" fill="#5E5675">Z</text>';
    return out + (o.svgFront || '');
  }
  function svg(o) {
    o = o || {};
    var b = BOX[o.pose || 'head'];
    var w = o.size || 64, h = Math.round(w * b[3] / b[2]);
    var dims = o.fluid ? '' : ' width="' + w + '" height="' + h + '"';
    return '<svg viewBox="' + b.join(' ') + '"' + dims + (o.cls ? ' class="' + o.cls + '"' : '') + ' aria-hidden="true">' + inner(o) + '</svg>';
  }
  function g(o) {
    o = o || {};
    var k = (o.size || 88) / 88;
    return '<g transform="translate(' + (o.x || 0) + ' ' + (o.y || 0) + ') scale(' + n(k) + ')">' + inner(o) + '</g>';
  }

  /* ---------- canvas ---------- */
  var P2 = {};
  function path2d(d) { return P2[d] || (P2[d] = new Path2D(d)); }
  function draw(c, o) {
    o = o || {};
    var k = (o.size || 88) / 88;
    var minLw = 1.5 / k; // keep lines visible on tiny cats
    var r = allShapes(o);
    c.save();
    c.scale(k, k);
    c.lineCap = 'round'; c.lineJoin = 'round';
    var applyTf = function (tf) { if (!tf) return; c.translate(tf[0], tf[1]); if (tf[2]) c.rotate(tf[2] * Math.PI / 180); if (tf[3] && tf[3] !== 1) c.scale(tf[3], tf[3]); };
    r.list.forEach(function (s) {
      c.save();
      applyTf(s.tf);
      if (s.clip) c.clip(path2d(r.head));
      applyTf(s.tf2);
      if (s.alpha) c.globalAlpha = s.alpha;
      var p = path2d(s.d);
      if (s.fill) { c.fillStyle = s.fill === 'none' ? 'transparent' : s.fill; c.fill(p); }
      if (s.stroke) { c.strokeStyle = s.stroke; c.lineWidth = Math.max(s.lw, s.lw > 2.5 ? minLw : minLw * 0.6); c.stroke(p); }
      c.restore();
    });
    c.restore();
  }

  /* a single ear standing on a flat edge (the game tiles): the same ear, turned so its base is level */
  function earSVG(side, cls) {
    // the shared ear, turned so its base lies flat and leaning outward like a cat's; no line along the base,
    // so it sits on the tile's own border
    var rot = side * 41.2, mid = side * 24, open = earPath(side).replace(/Z$/, '');
    return '<svg class="' + (cls || '') + '" viewBox="-26 -38 52 38" aria-hidden="true"><g transform="scale(-1 1) rotate(' + (-rot) + ') translate(' + (-mid) + ' 16)">' +
      '<path d="' + earPath(side) + '" fill="var(--tile, #fff)"/><path d="' + earInner(side) + '" fill="#FF8FAB" opacity=".75"/>' +
      '<path d="' + open + '" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></g></svg>';
  }
  /* a pair of cat ears on something that isn't a cat (the clouds): <g data-cat-ears='{"x":98,"y":28,"k":0.75}'> */
  function earsG(o) {
    return '<g transform="translate(' + (o.x || 0) + ' ' + (o.y || 0) + ') scale(' + (o.k || 1) + ')"><path d="' + earPath(-1) + earPath(1) + '" fill="' + (o.fill || '#fff') + '" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/><path d="' + earInner(-1) + earInner(1) + '" fill="#FFB3C7"/></g>';
  }

  /* pages mark where a cat goes with data-cat='{"preset":"chef","pose":"wave"}'; it scales to its box */
  function fill(root) {
    (root || document).querySelectorAll('[data-cat]').forEach(function (el) {
      var o = {}; try { o = JSON.parse(el.getAttribute('data-cat')); } catch (e) {}
      o.fluid = true;
      el.innerHTML = svg(o);
    });
    (root || document).querySelectorAll('[data-cat-ears]').forEach(function (el) {
      var o = {}; try { o = JSON.parse(el.getAttribute('data-cat-ears')); } catch (e) {}
      el.innerHTML = earsG(o);
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { fill(); });
    else fill();
  }

  window.GGCat = {
    fill: fill, earSVG: earSVG,
    INK: INK, PRESETS: PRESETS, GAME_ORDER: GAME_ORDER,
    svg: svg, g: g, draw: draw,
    earPath: earPath, earInner: earInner, shapes: function (o) { return allShapes(o || {}).list; },
    isDark: isDark, shade: shade
  };
})();
