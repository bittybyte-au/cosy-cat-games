/* Cosy Cat Games: the game list.
   One entry per game drives the home tiles, age filters, padlocks, the toddler home
   and (later) the parent allow/block lists. Adding a game = one entry here + its folder.

   id        folder name under /games/ (also used by the pass and allow/block lists)
   save      the key the game uses with GG.getProgress / GG.setProgress
   ages      one or more of 'under5', '5-10', '11+' (suggestions only, used by filters)
   toddler   true = shown on the toddler home (and tagged as a toddler game); toddler games have no badge/counter
   toddlerToo true = a regular game with its own toddler version: shown on both homes, not tagged
   free      what guests and expired passes can play: 'all', a list of parts, or a number of levels
   status    'live' playable, 'soon' greyed "Coming soon" tile while testing, 'dev' hidden on the live site
   season    null, or a season id (e.g. 'christmas') for games that only appear in that season
   tile      false = no tile on the games home or landing page (Cosy Home has its own house button)
   badge     optional: progress -> short text for the tile badge, or '' for none */
(function () {
  /* cat heads in the tile pictures are drawn by the shared cat (shared/cat.js, loaded first) */
  function cat(o) { return window.GGCat ? window.GGCat.g(o) : ''; }
  function level(p) { return p && p.level > 1 ? 'Level ' + p.level : ''; }

  /* ---------- the tile pictures, in the house style ----------
     One ink colour in three weights (4 main shapes, 3 parts, 2.5 small details). Outline last: a shape is filled,
     its details and a soft darker crescent along the lower right are drawn clipped inside it, then the outline goes
     on top, so nothing pokes past a line. Joins start inside the thing they join and are drawn first.
     Shapes are functions of a nudge (dx, dy) written with relative steps, so the crescent's moved copy is free. */
  var INK = '#2A2340', uid = 0;
  function f(v) { return Math.round(v * 10) / 10; }
  function R(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    var a = 'a' + r + ' ' + r + ' 0 0 1 ';
    return function (dx, dy) { return 'M' + f(x + r + dx) + ' ' + f(y + dy) + 'h' + f(w - 2 * r) + a + r + ' ' + r + 'v' + f(h - 2 * r) + a + -r + ' ' + r + 'h' + f(2 * r - w) + a + -r + ' ' + -r + 'v' + f(2 * r - h) + a + r + ' ' + -r + 'z'; };
  }
  function E(cx, cy, rx, ry) {
    var a = 'a' + rx + ' ' + ry + ' 0 1 0 ';
    return function (dx, dy) { return 'M' + f(cx - rx + dx) + ' ' + f(cy + dy) + a + 2 * rx + ' 0' + a + -2 * rx + ' 0z'; };
  }
  function P(x, y, rel) { return function (dx, dy) { return 'M' + f(x + dx) + ' ' + f(y + dy) + rel; }; }
  function U() { var l = [].slice.call(arguments); return function (dx, dy) { return l.map(function (s) { return s(dx, dy); }).join(''); }; }
  function star(cx, cy, r) {
    return function (dx, dy) {
      for (var i = 0, d = ''; i < 10; i++) { var a = Math.PI * (i / 5 - 0.5), q = i % 2 ? r * 0.5 : r; d += (i ? 'L' : 'M') + f(cx + dx + Math.cos(a) * q) + ' ' + f(cy + dy + Math.sin(a) * q); }
      return d + 'z';
    };
  }
  function stroke(lw) { return ' stroke="' + INK + '" stroke-width="' + lw + '" stroke-linecap="round" stroke-linejoin="round"'; }
  /* a filled shape: o.lw outline (0 = none), o.k crescent depth (0 = none), o.in svg drawn clipped inside,
     o.union strokes first at double weight so overlapping parts (petals, foam) read as one outline, o.t a transform */
  function sh(s, fill, o) {
    o = o || {};
    var d = s(0, 0), lw = o.lw === undefined ? 4 : o.lw, k = o.k === undefined ? 4 : o.k, out = '';
    if (o.union) out += '<path d="' + d + '" fill="none"' + stroke(lw * 2) + '/>';
    out += '<path d="' + d + '" fill="' + fill + '"/>';
    if (k || o.in) {
      var id = 'gt' + (++uid);
      out += '<clipPath id="' + id + '"><path d="' + d + '"/></clipPath><g clip-path="url(#' + id + ')">' + (o.in || '') +
        (k ? '<path d="M-300 -300h840v750h-840z' + s(-k * 0.7, -k) + '" fill="rgba(42,35,64,.13)" fill-rule="evenodd"/>' : '') + '</g>';
    }
    if (lw && !o.union) out += '<path d="' + d + '" fill="none"' + stroke(lw) + '/>';
    return o.t ? '<g transform="' + o.t + '">' + out + '</g>' : out;
  }
  function el(cx, cy, rx, ry, fill, op) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (op ? ' opacity="' + op + '"' : '') + '/>'; }
  function ln(d, lw, col, extra) { return '<path d="' + d + '" fill="none"' + (col ? stroke(lw).replace(INK, col) : stroke(lw)) + (extra || '') + '/>'; }
  function tube(d, col, w) { return ln(d, w + 5) + ln(d, w, col); }                   // a stem or handle with an ink edge
  function shadow(cx, cy, rx, ry) { return el(cx, cy, rx, ry, 'rgba(42,35,64,.16)'); }
  function shine(cx, cy, rx, ry) { return el(cx, cy, rx, ry, '#fff', 0.45); }
  function svg(body, vb) { return '<svg viewBox="' + (vb || '0 0 240 150') + '">' + body + '</svg>'; }
  /* a ball of wool: stripes and shading inside, outline on top */
  function wool(x, y, r, col, dark) { return sh(E(x, y, r, r), col, { lw: 3, k: 3, in: ln('M' + (x - r) + ' ' + (y - 5) + 'q' + r + ' -8 ' + 2 * r + ' 0m-' + 2 * r + ' 7q' + r + ' -8 ' + 2 * r + ' 0m-' + 2 * r + ' 7q' + r + ' -8 ' + 2 * r + ' 0', 2.4, dark) }); }
  /* a cardboard box with its lid shut, x..x+w wide, bottom at y */
  function shutBox(x, y, w, h, col) {
    return shadow(x + w / 2, y, w / 2 + 6, 4) + sh(R(x, y - h, w, h, 4), col, { in: '<rect x="' + (x + w / 2 - 4) + '" y="' + (y - h) + '" width="8" height="22" fill="#F3D3A6"/>' }) +
      sh(P(x, y - h, 'l10 -12h' + (w - 20) + 'l10 12z'), '#D9A066', { lw: 3, k: 0, in: '<rect x="' + (x + w / 2 - 4) + '" y="' + (y - h - 14) + '" width="8" height="14" fill="#F3D3A6"/>' });
  }
  function bowl(cx, col) {
    return shadow(cx, 130, 30, 4) + sh(P(cx - 28, 112, 'q2 18 18 18h20q16 0 18 -18z'), col, { k: 3 }) +
      sh(E(cx, 112, 28, 7), col, { lw: 3, k: 0, in: el(cx, 112, 28, 7, 'rgba(42,35,64,.18)') + el(cx, 115, 20, 6, '#B5713A') + el(cx - 5, 112, 3, 2, '#D08A4E') + el(cx + 6, 113, 3, 2, '#D08A4E') });
  }

  var ART = {
    cooking: svg(
      shadow(120, 134, 96, 9) +
      sh(E(120, 118, 100, 22), '#fff', { k: 5, in: el(120, 115, 74, 12, '#FFE3EC') }) +
      shadow(114, 116, 58, 5) +
      sh(P(170, 64, 'h-104a14 26 0 0 0 0 52h104z'), '#2E4A3A', { k: 6, in: '<rect x="62" y="71" width="100" height="7" rx="3.5" fill="#3D6450"/>' }) +
      sh(E(170, 90, 16, 26), '#2E4A3A', { k: 0, in: sh(E(170, 90, 12, 21.5), '#fff', { lw: 0, k: 3, in:
        sh(R(162, 76, 11, 9, 2), '#FF8A5B', { lw: 2.5, k: 0 }) + sh(R(170, 88, 7, 8, 1.5), '#4FAE5E', { lw: 2.5, k: 0 }) + sh(E(165, 100, 5, 4), '#C8E26F', { lw: 2.5, k: 0 }) }) }) +
      shadow(198, 129, 18, 4) +
      sh(E(198, 124, 17, 6.5), '#fff', { lw: 3, k: 2, in: el(198, 124, 11, 3.5, '#5A2A12') })),

    kittypop: svg(
      sh(R(10, 34, 220, 100, 24), '#FFF8EC', { k: 5 }) +
      [50, 120, 190].map(function (x, i) {
        return sh(R(x - 32, 44, 64, 80, 16), i === 1 ? '#FFE3EC' : '#FFEFD9', { lw: 3, k: 3 }) + cat({ preset: 'ginger', face: 'happy', x: x, y: 83, size: 52 });
      }).join('') +
      sh(star(64, 18, 11), '#FFC93C', { lw: 2.5, k: 2 }) + sh(star(178, 16, 8), '#FFC93C', { lw: 2.5, k: 0 })),

    cubbies: svg(
      [[14, '#FFA94D', 'ginger'], [88, '#B48CFF', 'purple'], [162, '#7CC4FF']].map(function (b) {
        var cx = b[0] + 32;
        return sh(R(b[0], 8, 64, 58, 10), '#E6B98A', { k: 4 }) + sh(R(b[0] + 6, 16, 52, 42, 7), '#FFF3E4', { lw: 3, k: 0, in:
          '<rect x="' + b[0] + '" y="16" width="64" height="9" fill="rgba(42,35,64,.1)"/>' +
          sh(E(cx, 52, 22, 6), b[1], { lw: 2.5, k: 0 }) + (b[2] ? cat({ preset: b[2], face: 'blink', x: cx, y: 43, size: 38 }) : '') +
          sh(P(cx - 22, 52, 'c0 9 44 9 44 0c-8 4 -36 4 -44 0z'), b[1], { lw: 2.5, k: 0 }) });
      }).join('') +
      sh(R(6, 118, 228, 20, 10), '#6E6487', { k: 3, in: [30, 90, 150, 210].map(function (x) { return sh(E(x, 128, 4, 4), '#B9AED0', { lw: 2.5, k: 0 }); }).join('') }) +
      sh(E(136, 108, 28, 9), '#F2DCC3', { lw: 3, k: 0 }) + cat({ preset: 'blue', face: 'blink', x: 136, y: 91, size: 40 }) +
      sh(P(108, 108, 'c0 13 56 13 56 0c-12 6 -44 6 -56 0z'), '#F7E6D2', { lw: 3, k: 2 }) +
      ln('M176 104Q196 98 194 78', 3, 0, ' stroke-dasharray="5 6"') + ln('M188 80L194 72L200 80', 3)),

    yarn: svg(
      [[43, ['#FF5A5F', '#4D8BFF', '#5CCB75']], [91, ['#4D8BFF', '#FFD93F', '#FF5A5F', '#4D8BFF']], [139, ['#5CCB75', '#5CCB75', '#5CCB75', '#5CCB75']], [187, ['#FFD93F', '#FF5A5F']]].map(function (t) {
        var x = t[0], dark = { '#FF5A5F': '#C7343A', '#4D8BFF': '#2459C2', '#5CCB75': '#2E9447', '#FFD93F': '#C9A20C' };
        return sh(R(x - 17, 22, 34, 112, 17), 'rgba(255,255,255,.6)', { k: 0, in: t[1].map(function (c, i) { return wool(x, 119 - i * 26, 13, c, dark[c]); }).join('') + '<rect x="' + (x - 12) + '" y="32" width="5" height="88" rx="2.5" fill="#fff" opacity=".5"/>' }) +
          sh(R(x - 21, 16, 42, 12, 6), '#E6B98A', { lw: 3, k: 2 });
      }).join('') + cat({ preset: 'ginger', pose: 'peek', face: 'blink', x: 139, y: 8, size: 38 }), '0 -14 240 164'),

    home: svg(
      sh(R(14, 10, 212, 132, 18), '#D7F2DF', { k: 0, in: '<rect x="0" y="108" width="240" height="40" fill="#C98B5B"/>' + ln('M0 108H240', 3) }) +
      sh(R(92, 24, 56, 48, 6), '#9EDCFF', { lw: 3, k: 0, in: shine(104, 34, 8, 5) + ln('M120 24V72M92 48H148', 4, '#fff') }) +
      sh(R(30, 62, 50, 8, 3), '#E6B98A', { lw: 3, k: 2 }) +
      ln('M52 54V32', 3) + sh(P(52, 40, 'q-10 -2 -8 -10q9 2 8 10z'), '#7BD389', { lw: 2.5, k: 0 }) + sh(P(52, 36, 'q10 -2 9 -10q-9 2 -9 10z'), '#7BD389', { lw: 2.5, k: 0 }) +
      sh(P(44, 62, 'l-3 -16h22l-3 16z'), '#FF9EC4', { lw: 3, k: 2 }) +
      sh(R(156, 24, 32, 38, 5), '#E6B98A', { lw: 3, k: 2 }) + sh(R(161, 29, 22, 28, 3), '#FFE7C2', { lw: 2.5, k: 0, in: '<path d="M158 58L168 42L174 50L178 45L186 58Z" fill="#7BD389"/>' }) +
      sh(E(122, 122, 62, 11), '#FF9EC4', { lw: 3, k: 3, in: el(122, 122, 40, 6, '#FFD3E4') }) + shadow(122, 125, 24, 4) +
      cat({ preset: 'ginger', pose: 'sit', face: 'happy', x: 122, y: 84, size: 40 }) +
      shadow(210, 108, 12, 3) + tube('M210 106V64', '#FFE7C2', 3) + sh(P(200, 54, 'h20l6 16h-32z'), '#FFD23F', { lw: 3, k: 2 })),

    colour: svg(
      [['#FF5A5F', 'translate(26 80) rotate(-28)'], ['#A77BFF', 'translate(214 80) rotate(28)']].map(function (p) {
        return '<g transform="' + p[1] + '">' + sh(P(-8, 34, 'l8 22 8 -22z'), '#FFE3C2', { lw: 3, k: 0, in: '<path d="M-5 47L0 56L5 47Z" fill="' + p[0] + '"/>' }) +
          sh(R(-8, -36, 16, 72, 4), p[0], { lw: 3.5, k: 3 }) + '</g>';
      }).join('') +
      sh(R(58, 14, 124, 124, 10), '#FFD23F', { k: 5 }) +
      sh(R(70, 26, 100, 100, 6), '#9EDCFF', { lw: 3, k: 0, in: sh(E(150, 46, 11, 11), '#FFE14D', { lw: 3, k: 2 }) +
        '<path d="M60 100Q120 82 180 100V140H60Z" fill="#7BD389"/>' + ln('M60 100Q120 82 180 100', 3) + cat({ preset: 'pink', face: 'happy', x: 112, y: 82, size: 46 }) })),

    grow: svg(
      sh(R(8, 124, 224, 14, 5), '#E6B98A', { k: 3 }) +
      shadow(50, 124, 22, 3) + sh(P(30, 124, 'l4 -40q16 -8 32 0l4 40z'), '#C48A55', { k: 4 }) + sh(E(50, 84, 16, 5), '#7A4E2D', { lw: 3, k: 0 }) +
      sh(P(120, 86, 'q-24 0 -28 -18q22 -2 28 18z'), '#7BD389', { lw: 3, k: 2 }) + sh(P(120, 76, 'q24 0 28 -18q-22 -2 -28 18z'), '#7BD389', { lw: 3, k: 2 }) +
      tube('M120 104V46', '#4FB868', 4) +
      sh(U(E(120, 27, 10, 10), E(132, 36, 10, 10), E(128, 50, 10, 10), E(112, 50, 10, 10), E(108, 36, 10, 10)), '#FF5A7A', { union: true, lw: 3, k: 3 }) + sh(E(120, 40, 8, 8), '#FFD23F', { lw: 3, k: 2 }) +
      shadow(120, 124, 30, 3) + sh(P(94, 100, 'h52l-6 24h-40z'), '#E8875A', { k: 3 }) + sh(R(88, 92, 64, 12, 4), '#F2A07A', { k: 2 }) +
      shadow(186, 124, 24, 3) + ln('M176 98Q186 72 198 98', 4) + tube('M174 106L150 88', '#7CC4FF', 5) + sh(E(148, 86, 4, 6), '#7CC4FF', { lw: 2.5, k: 0, t: 'rotate(-37 148 86)' }) +
      sh(R(166, 94, 40, 30, 9), '#7CC4FF', { k: 4 }) +
      cat({ preset: 'sun', face: 'happy', x: 200, y: 34, size: 40 })),

    cafe: svg(
      [16, 34, 52, 70, 88, 106, 124].map(function (x, i) { return sh(P(x, 9, 'h12l-6 14z'), i % 2 ? '#FFD23F' : '#FF8FAB', { lw: 2.5, k: 0 }); }).join('') + ln('M8 9H144', 2.5) +
      sh(R(12, 116, 216, 28, 10), '#C98B5B', { k: 4 }) + sh(R(6, 110, 228, 14, 6), '#E6B98A', { k: 3 }) +
      cat({ preset: 'chef', pose: 'peek', face: 'happy', x: 66, y: 74, size: 60 }) + cat({ preset: 'ginger', pose: 'peek', face: 'open', x: 180, y: 80, size: 56 }) +
      shadow(122, 111, 26, 3) + sh(E(122, 106, 26, 6), '#fff', { lw: 3, k: 2 }) +
      sh(R(106, 96, 32, 8, 4), '#F2B25C', { lw: 2.5, k: 0 }) + sh(R(104, 89, 36, 8, 4), '#8A5034', { lw: 2.5, k: 0 }) +
      sh(P(105, 90, 'q0 -18 17 -18q17 0 17 18z'), '#F2B25C', { lw: 3, k: 3, in: el(115, 81, 1.6, 1.1, '#fff') + el(122, 77, 1.6, 1.1, '#fff') + el(129, 81, 1.6, 1.1, '#fff') }) +
      sh(P(172, 40, 'l8 12l6 -12z'), '#fff', { lw: 3, k: 0 }) + sh(R(144, 4, 68, 40, 14), '#fff', { lw: 3, k: 3 }) +
      sh(E(178, 29, 20, 5.5), '#fff', { lw: 2.5, k: 0 }) + sh(E(178, 25, 16, 5.5), '#E8A85C', { lw: 2.5, k: 0, in: el(178, 25, 12, 3.5, '#FFE07A') + el(173, 25, 2, 1.4, '#D83A3A') + el(183, 26, 2, 1.4, '#D83A3A') })),

    feed: svg(
      sh(R(4, 96, 232, 48, 14), '#E6B98A', { k: 3 }) +
      cat({ color: '#FF4D4D', pose: 'peek', face: 'open', x: 46, y: 66, size: 60 }) + cat({ color: '#3D8BFF', pose: 'peek', face: 'happy', x: 120, y: 66, size: 60 }) + cat({ color: '#FFD23F', pose: 'peek', face: 'open', x: 194, y: 66, size: 60 }) +
      bowl(46, '#FF4D4D') + bowl(120, '#3D8BFF') + bowl(194, '#FFD23F')),

    yarndash: svg(
      sh(R(10, 10, 220, 130, 16), '#E8C9A0', { k: 0 }) + sh(E(120, 78, 74, 44), '#C7EBD2', { lw: 3, k: 4 }) +
      sh(R(-24, -9, 48, 18, 9), '#4FAE5E', { lw: 3, k: 3, t: 'translate(196 44) rotate(-30)', in: ln('M-14 -3H14', 3, '#7BD389') }) +
      wool(48, 44, 14, '#FF8FAB', '#E2607F') +
      shadow(104, 108, 42, 4) + cat({ preset: 'ginger', pose: 'lie', face: 'happy', x: 116, y: 76, size: 62 }) +
      wool(190, 112, 14, '#FFD23F', '#C98A00') + sh(star(216, 96, 9), '#FFE14D', { lw: 2.5, k: 0 })),

    seek: svg(sh(R(6, 6, 228, 138, 16), '#BFE6FF', { k: 0, in:
      '<rect x="0" y="72" width="240" height="80" fill="#9BDC8C"/>' + ln('M0 72H240', 3) +
      sh(E(200, 30, 14, 14), '#FFE14D', { lw: 3, k: 2 }) +
      sh(E(64, 72, 18, 18), '#FF5A7A', { lw: 3, k: 3, in: ln('M46 68q18 12 36 0m-34 10q16 12 32 0', 2.4, '#D63D5E') }) +
      shadow(66, 128, 48, 4) + sh(P(20, 128, 'q-4 -32 20 -42q16 -20 38 -6q22 -10 32 16q8 16 2 32z'), '#5CCB75', { k: 5 }) +
      cat({ color: '#FFA94D', face: 'happy', x: 168, y: 88, size: 46 }) +
      shadow(169, 132, 44, 4) + sh(P(128, 132, 'q-4 -28 18 -34q22 -12 44 0q24 6 20 34z'), '#C9C2D6', { k: 5 }) })),

    mousepop: svg(
      sh(E(120, 78, 104, 60), '#FFE7F0', { k: 5 }) +
      [['#7CC4FF', 'translate(70 92) rotate(-20)'], ['#FFD23F', 'translate(174 66) rotate(200)']].map(function (m) {
        return '<g transform="' + m[1] + '">' + tube('M-24 0Q-44 -6 -56 4', '#FF8FAB', 3) +
          sh(E(8, -16, 8, 8), m[0], { lw: 3, k: 0, in: el(9, -18, 4, 4, '#FFB3C7') }) + sh(E(8, 16, 8, 8), m[0], { lw: 3, k: 0, in: el(9, 18, 4, 4, '#FFB3C7') }) +
          sh(P(-28, 0, 'q2 -18 28 -17q24 3 30 17q-6 14 -30 17q-26 1 -28 -17z'), m[0], { lw: 3, k: 3 }) +
          sh(E(30, 0, 4, 4), '#FF7FA6', { lw: 2.5, k: 0 }) + el(19, -6, 2.6, 2.6, INK) + el(19, 6, 2.6, 2.6, INK) + '</g>';
      }).join('') +
      tube('M146 112a16 16 0 1 0 -32 0a16 16 0 1 0 32 0', '#FF8FAB', 4) +
      sh(E(104, 106, 7, 7), '#FF8FAB', { lw: 2.5, k: 0 }) + sh(E(154, 100, 6, 6), '#fff', { lw: 2.5, k: 0 }) + sh(E(136, 84, 7, 7), '#FF8FAB', { lw: 2.5, k: 0 }) + sh(E(158, 124, 5, 5), '#FF8FAB', { lw: 2.5, k: 0 })),

    bath: svg(
      cat({ preset: 'ginger', face: 'happy', x: 120, y: 64, size: 70 }) + el(106, 55, 6, 5, '#8A5A34') + el(113, 47, 4, 3.5, '#8A5A34') +
      shadow(120, 136, 82, 5) + sh(P(40, 92, 'h160q0 44 -30 44h-100q-30 0 -30 -44z'), '#fff', { k: 6 }) + sh(R(34, 88, 172, 8, 4), '#fff', { lw: 3.5, k: 0 }) +
      sh(U(E(58, 86, 10, 10), E(78, 84, 12, 12), E(96, 88, 8, 8)), '#fff', { union: true, lw: 2.5, k: 2 }) + sh(U(E(146, 87, 10, 10), E(162, 88, 8, 8)), '#fff', { union: true, lw: 2.5, k: 2 }) +
      sh(E(170, 42, 7, 7), '#fff', { lw: 2.5, k: 0, in: shine(167, 39, 2.5, 2) }) + sh(E(184, 28, 5, 5), '#fff', { lw: 2.5, k: 0 }) +
      '<g transform="translate(188 76)">' + sh(P(-16, 0, 'q0 12 16 12q14 0 16 -10q-8 2 -12 -3z'), '#FFD23F', { lw: 2.5, k: 2 }) +
      sh(P(10, -12, 'l10 3l-10 3z'), '#FF9A2E', { lw: 2.5, k: 0 }) + sh(E(5, -8, 8, 8), '#FFD23F', { lw: 2.5, k: 2 }) + el(7, -10, 1.7, 1.7, INK) + '</g>'),

    puzzle: (function () {
      var left = P(22, 22, 'h58v74a9 9 0 1 1 0 16v18h-58z'), right = P(80, 22, 'h54v108h-54v-18a9 9 0 1 0 0 -16z');
      var pic = function () { return cat({ preset: 'ginger', face: 'happy', x: 78, y: 64, size: 58 }) + sh(P(48, 88, 'h60q-4 36 -30 36q-26 0 -30 -36z'), '#7CC4FF', { lw: 3, k: 3 }); };
      return svg(
        sh(R(14, 14, 128, 124, 12), '#FFF3E4', { k: 4 }) + sh(right, '#F1D9C0', { lw: 0, k: 0 }) + ln(right(0, 0), 2.5, 0, ' stroke-dasharray="6 6"') +
        sh(left, '#FFE0EC', { lw: 3, k: 3, in: pic() }) +
        shadow(194, 142, 34, 4) + sh(right, '#FFE0EC', { lw: 3, k: 3, in: pic(), t: 'translate(85 2) rotate(12 107 76)' }));
    })(),

    stack: svg(
      shadow(120, 142, 54, 4) + sh(R(70, 128, 100, 14, 7), '#FF8FAB', { lw: 3, k: 3 }) +
      [['purple', '#B48CFF', 'happy', 122], ['ginger', '#FFA94D', 'sleep', 116], [0, '#A7E3B8', 'happy', 126], ['pink', '#FF9EC4', 'surprised', 112]].map(function (c, i) {
        // each cat's little paws rest on the head of the cat below, as in the game
        return cat({ preset: c[0] || undefined, color: c[0] ? undefined : c[1], pose: 'lie', face: c[2], x: c[3], y: 106.4 - i * 30.2, size: 38 });
      }).join('')),

    peekaboo: svg(
      shadow(70, 136, 48, 4) +
      sh(P(38, 68, 'l6 -16h52l6 16z'), '#D9A066', { lw: 3, k: 0 }) + sh(P(28, 78, 'l10 -10h64l10 10z'), '#9C6A3A', { lw: 3, k: 0 }) +
      sh(P(28, 78, 'l10 -10l-20 -12l-12 10z'), '#D9A066', { lw: 3, k: 0 }) + sh(P(112, 78, 'l-10 -10l20 -12l12 10z'), '#D9A066', { lw: 3, k: 0 }) +
      cat({ preset: 'pink', pose: 'peek', face: 'happy', x: 70, y: 54, size: 54 }) +
      sh(R(28, 78, 84, 58, 4), '#E8B577', { k: 4 }) +
      shutBox(140, 136, 78, 62, '#E2A866') + '<text x="179" y="126" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="30" fill="#B9814A">?</text>'),

    kittenbox: svg(
      shutBox(16, 134, 62, 54, '#E8B577') + shutBox(162, 134, 62, 54, '#E8B577') +
      shadow(120, 134, 37, 4) + sh(P(89, 80, 'l8 -8h46l8 8z'), '#9C6A3A', { lw: 3, k: 0 }) +
      sh(P(89, 80, 'l8 -8l-11 -10l-6 8z'), '#D9A066', { lw: 3, k: 0 }) + sh(P(151, 80, 'l-8 -8l11 -10l6 8z'), '#D9A066', { lw: 3, k: 0 }) +
      cat({ preset: 'blue', pose: 'peek', face: 'happy', x: 120, y: 58, size: 50 }) +
      sh(R(89, 80, 62, 54, 4), '#E2A866', { k: 4 }) +
      ln('M60 28Q120 2 180 28', 3, 0, ' stroke-dasharray="6 6"') + ln('M172 20L182 29L170 34', 3)),

    crossing: svg(sh(R(6, 8, 228, 136, 16), '#A9DC8F', { k: 0, in:
      '<rect x="0" y="40" width="240" height="76" fill="#5E5675"/>' + ln('M0 40H240M0 116H240', 3) +
      [46, 60, 74, 88, 102].map(function (y) { return '<rect x="92" y="' + y + '" width="56" height="8" rx="2" fill="#fff"/>'; }).join('') +
      '<rect x="12" y="76" width="20" height="4" rx="2" fill="#fff" opacity=".6"/><rect x="50" y="76" width="20" height="4" rx="2" fill="#fff" opacity=".6"/>' +
      // two cars waiting at the crossing, one each way
      [['#FF5A5F', 14, 110, 1], ['#7CC4FF', 226, 70, -1]].map(function (c) {
        var s = c[3], x = c[1], y = c[2];
        return shadow(x + s * 29, y, 32, 3) +
          sh(P(x, y, 'v-12l' + 10 * s + ' -2l' + 8 * s + ' -12h' + 22 * s + 'l' + 8 * s + ' 12l' + 10 * s + ' 2v12z'), c[0], { lw: 3, k: 3, in:
            sh(P(x + 21 * s, y - 23, 'h' + 8 * s + 'v8h' + -13 * s + 'z'), '#CDE8FF', { lw: 2.5, k: 0 }) + sh(P(x + 32 * s, y - 23, 'h' + 6 * s + 'l' + 5 * s + ' 8h' + -11 * s + 'z'), '#CDE8FF', { lw: 2.5, k: 0 }) }) +
          sh(E(x + 14 * s, y, 6, 6), '#3D3650', { lw: 2.5, k: 0 }) + sh(E(x + 44 * s, y, 6, 6), '#3D3650', { lw: 2.5, k: 0 });
      }).join('') +
      // whole kittens walking over the zebra crossing
      shadow(95, 81, 20, 3) + cat({ preset: 'white', pose: 'walk', step: 1.2, moving: true, face: 'happy', x: 104, y: 58, size: 30 }) +
      shadow(133, 119, 20, 3) + cat({ preset: 'pink', pose: 'walk', step: 4, moving: true, face: 'happy', x: 142, y: 96, size: 30 }) +
      shadow(214, 136, 10, 3) + tube('M214 136V100', '#B9AED0', 4) +
      sh(E(214, 96, 14, 14), '#FF5A5F', { lw: 3.5, k: 3, in: '<circle cx="214" cy="96" r="9" fill="none" stroke="#fff" stroke-width="2.5"/>' }) })),

    slide: (function () {
      // a 3x3 picture puzzle: each square shows its part of one picture; the bottom-right square slides into the gap
      var pic = '<rect x="0" y="0" width="240" height="150" fill="#FFE0EC"/><rect x="0" y="116" width="240" height="40" fill="#A9DC8F"/>' + cat({ preset: 'ginger', face: 'happy', x: 120, y: 68, size: 80 });
      var sq = '';
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
        if (r === 2 && c > 0) continue;
        sq += sh(R(62 + c * 40, 16 + r * 40, 36, 36, 5), '#FFE0EC', { lw: 2.5, k: 3, in: pic });
      }
      sq += sh(R(122, 96, 36, 36, 5), '#FFE0EC', { lw: 2.5, k: 3, in: '<g transform="translate(-20 0)">' + pic + '</g>' });
      return svg(shadow(120, 142, 70, 5) + sh(R(52, 6, 136, 136, 14), '#E6B98A', { k: 5 }) + sh(R(59, 13, 122, 122, 7), '#B98552', { lw: 3, k: 0 }) + sq +
        ln('M228 114H198', 3.5) + ln('M206 106L198 114L206 122', 3.5));
    })(),

    kittenkitchen: svg(
      cat({ preset: 'ginger', face: 'happy', x: 50, y: 70, size: 60 }) +
      shadow(150, 136, 80, 7) + sh(E(150, 128, 76, 13), '#fff', { k: 3 }) +
      sh(P(96, 78, 'h108v42q-54 16 -108 0z'), '#FFB3CB', { k: 5, in: ln('M96 104q54 14 108 0', 6, '#FFF4E6') }) +
      sh(P(94, 80, 'q56 -16 112 0v8q-8 10 -16 0q-11 12 -22 0q-12 12 -24 0q-12 12 -24 0q-11 12 -22 0q-8 10 -16 0z'), '#FFF8FB', { lw: 3, k: 0 }) +
      [[126, '#7CC4FF', 46], [150, '#FF8FAB', 40], [174, '#7BD389', 46]].map(function (c) {
        return sh(R(c[0] - 4.5, c[2], 9, 76 - c[2], 3), c[1], { lw: 3, k: 0 }) + sh(P(c[0], c[2] - 20, 'q8 10 0 15q-8 -5 0 -15z'), '#FFC93C', { lw: 2.5, k: 0 });
      }).join('') +
      sh(E(124, 110, 7, 7), '#E2223C', { lw: 2.5, k: 2 }) + sh(E(176, 112, 7, 7), '#E2223C', { lw: 2.5, k: 2 }) +
      sh(P(150, 120, 'c-10 -8 -6 -16 0 -11c6 -5 10 3 0 11z'), '#FF8FAB', { lw: 2.5, k: 0 }))
  };

  var GAMES = [
    {
      id: 'cooking', save: 'cooking', name: 'Cosy Kitchen', blurb: 'Chop, mix and cook yummy dishes',
      ages: ['5-10'], toddler: false, free: ['handroll'], status: 'live', season: null, colour: '#FFB4A2',
      badge: function (p) { var n = (p && p.made) || 0; return n ? n + (n === 1 ? ' dish made' : ' dishes made') : ''; },
      art: ART.cooking
    },
    {
      id: 'kitty-pop', save: 'kittypop', name: 'Kitty Match', blurb: 'Line up three cats in a row',
      ages: ['5-10'], toddler: false, free: 3, status: 'live', season: null, colour: '#FFC2DA',
      badge: level, art: ART.kittypop
    },
    {
      id: 'cubbies', save: 'cubbies', name: 'Cosy Cubbies', blurb: 'Tuck sleepy cats into their beds',
      ages: ['5-10'], toddler: false, free: 0, status: 'live', season: null, colour: '#BFE0FF',
      badge: level, art: ART.cubbies
    },
    {
      id: 'yarn', save: 'yarn', name: 'Yarn Sort', blurb: 'Sort the wool into tubes',
      ages: ['5-10'], toddler: false, free: 0, status: 'live', season: null, colour: '#DCC8FF',
      badge: level, art: ART.yarn
    },
    {
      id: 'home', save: 'home', name: 'Cosy Home', blurb: 'Decorate your cosy house',
      ages: ['5-10'], toddler: false, free: 'all', status: 'live', season: null, colour: '#C7EBD2', tile: false,
      badge: function (p) { var n = p && Array.isArray(p.placed) ? p.placed.length : 0; return n ? n + (n === 1 ? ' thing in your room' : ' things in your room') : ''; },
      art: ART.home
    },
    {
      id: 'colour', save: 'colour', name: 'Colour Me', blurb: 'Colour pictures to hang at home',
      ages: ['under5', '5-10'], toddler: false, toddlerToo: true, free: 'all', status: 'live', season: null, colour: '#FFE7A8',
      badge: function (p) { var n = p && Array.isArray(p.pics) ? p.pics.filter(function (x) { return x && x.done; }).length : 0; return n ? n + (n === 1 ? ' picture' : ' pictures') : ''; },
      art: ART.colour
    },
    {
      id: 'grow', save: 'grow', name: 'Grow', blurb: 'Grow plants for your home',
      ages: ['under5', '5-10'], toddler: false, toddlerToo: true, free: 'all', status: 'live', season: null, colour: '#D4F0C4',
      badge: function (p) { var n = p && typeof p.grown === 'number' ? p.grown : 0; return n ? n + (n === 1 ? ' plant grown' : ' plants grown') : ''; },
      art: ART.grow
    },
    {
      id: 'cafe', save: 'cafe', name: 'Cat Caf\u00e9', blurb: 'Serve hungry cat customers',
      ages: ['5-10'], toddler: false, free: 'all', status: 'live', season: null, colour: '#FFD9C2',
      badge: function (p) { var n = p && typeof p.served === 'number' ? p.served : 0; return n ? n + (n === 1 ? ' cat served' : ' cats served') : ''; },
      art: ART.cafe
    },
    {
      id: 'feed', save: 'feed', name: 'Feed the Cat', blurb: 'Give each cat its bowl',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#FFE0B8',
      art: ART.feed
    },
    {
      id: 'yarn-dash', save: 'yarndash', name: 'Yarn Dash', blurb: 'Run and catch the yarn',
      ages: ['5-10'], toddler: false, free: 'all', status: 'live', season: null, colour: '#F2DDC0',
      badge: level, art: ART.yarndash
    },
    {
      id: 'slide', save: 'slide', name: 'Slide Puzzle', blurb: 'Slide the squares to fix the picture',
      ages: ['5-10'], toddler: false, free: 'all', status: 'live', season: null, colour: '#CDE8FF',
      art: ART.slide
    },
    {
      id: 'seek', save: 'seek', name: 'Hide and Seek', blurb: 'Find the hidden things',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#CFEFC4',
      art: ART.seek
    },
    {
      id: 'mouse-pop', save: 'mousepop', name: 'Mouse Pop', blurb: 'Tap the mice to pop them',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#FFE0EC',
      art: ART.mousepop
    },
    {
      id: 'bath', save: 'bath', name: 'Bath Time', blurb: 'Wash a muddy kitten',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#D4EEFB',
      art: ART.bath
    },
    {
      id: 'puzzle', save: 'puzzle', name: 'Cat Puzzles', blurb: 'Put the picture back together',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#FFE3C2',
      art: ART.puzzle
    },
    {
      id: 'stack', save: 'stack', name: 'Stack the Cats', blurb: 'Build a wobbly cat tower',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#E2D9FF',
      art: ART.stack
    },
    {
      id: 'peekaboo', save: 'peekaboo', name: 'Peekaboo Boxes', blurb: 'What\u2019s in the box?',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#FFE3C2',
      art: ART.peekaboo
    },
    {
      id: 'kitten-box', save: 'kittenbox', name: 'Kitten in a Box', blurb: 'Keep your eye on the kitten!',
      ages: ['5-10'], toddler: false, free: 'all', status: 'live', season: null, colour: '#FFEBD1',
      art: ART.kittenbox
    },
    {
      id: 'crossing', save: 'crossing', name: 'Kitten Crossing', blurb: 'Stop the cars so kittens can cross',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#CDEBC2',
      art: ART.crossing
    },
    {
      id: 'kitten-kitchen', save: 'kittenkitchen', name: 'Kitten Kitchen', blurb: 'Decorate pizza, pancakes and cake',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#FFE2C7',
      art: ART.kittenkitchen
    }
  ];

  /* Dev games show on a test copy of the site (localhost, preview links) or with ?dev in the address. */
  function devVisible() {
    try {
      var h = location.hostname;
      return /^(localhost|127\.0\.0\.1)$/.test(h) || /[?&]dev\b/.test(location.search) || /-git-|vercel\.app$/.test(h);
    } catch (e) { return false; }
  }

  window.GGGames = {
    all: GAMES,
    AGES: [{ id: 'under5', label: 'Under 5' }, { id: '5-10', label: '5\u201310' }, { id: '11+', label: '11+' }],
    get: function (id) { for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i]; return null; },
    /* games to show on the home page right now (season games only in their season) */
    visible: function (opts) {
      opts = opts || {};
      var dev = devVisible(), season = opts.season || null;
      return GAMES.filter(function (g) {
        if (g.status === 'dev' && !dev) return false;
        if (g.tile === false && !opts.all) return false;
        if (g.season && g.season !== season) return false;
        if (opts.toddler !== undefined && !!g.toddler !== !!opts.toddler && !(opts.toddler && g.toddlerToo)) return false;
        if (opts.age && g.ages.indexOf(opts.age) < 0) return false;
        return true;
      });
    },
    playable: function (g) { return g.status === 'live' || (g.status !== 'soon' && devVisible()); }
  };
})();
