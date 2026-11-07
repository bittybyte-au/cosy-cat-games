/* Cosy Cat Games: the game list.
   One entry per game drives the home tiles, age filters, padlocks, the toddler home
   and (later) the parent allow/block lists. Adding a game = one entry here + its folder.

   id        folder name under /games/ (also used by the pass and allow/block lists)
   save      the key the game uses with GG.getProgress / GG.setProgress
   ages      one or more of 'under5', '5-10', '10+' (suggestions only, used by filters)
   toddler   true = shown on the toddler home (and tagged as a toddler game); toddler games usually have no badge (Cat Puzzles shows a total)
   toddlerToo true = a regular game with its own toddler version: shown on both homes, not tagged
   free      what guests and expired passes can play: 'all', a list of parts, or a number of levels
   status    'live' playable, 'soon' greyed "Coming soon" tile while testing, 'dev' hidden on the live site
   season    null, or a season id (e.g. 'christmas') for games that only appear in that season
   tile      false = no tile on the games home or landing page (Cosy Home has its own house button)
   badge     optional: progress -> short text for the tile badge, or '' for none
   levels    level games: the set number of levels (rounds, days, puzzles). This is the one place the count lives:
             each game keeps the same number as a constant (game pages don't load this file), with a comment pointing
             here. Level games also give
   done      progress -> how many levels are finished, from the game's own save. Their badge is made from the two
             by levelsBadge below ('5/20'), so no level game writes its own badge. */
(function () {
  /* cat heads in the tile pictures are drawn by the shared cat (shared/cat.js, loaded first) */
  function cat(o) { return window.GGCat ? window.GGCat.g(o) : ''; }
  /* ---------- level games: "levels finished / levels", e.g. '5/20' ----------
     Nothing before the first is finished; an old save from before the set count (past the end) counts as all done. */
  function levelsBadge(done, total) { var n = Math.max(0, Math.min(total, Math.floor(done) || 0)); return n ? n + '/' + total : ''; }
  function count(list, ok) { var seen = {}, n = 0; (Array.isArray(list) ? list : []).forEach(function (x) { if (ok(x) && !seen[x]) { seen[x] = 1; n++; } }); return n; }
  var DONE = {
    /* saves the next level to play: { level } */
    next: function (p) { return p && p.level > 1 ? p.level - 1 : 0; },
    /* saves the highest level open: { best } */
    open: function (p) { return p && p.best > 1 ? p.best - 1 : 0; },
    /* saves a list of the levels finished: { done: [n, ...] } */
    list: function (p, total) { return count(p && p.done, function (n) { return n >= 1 && n <= total; }); },
    /* saves stars (or a best rating) for each level finished: { [key]: { level: stars } } */
    rated: function (key) { return function (p, total) { var o = p && p[key]; return o && typeof o === 'object' ? count(Object.keys(o), function (k) { return +k >= 1 && +k <= total && o[k] > 0; }) : 0; }; }
  };

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

    pottery: svg(
      // a potter's wheel with wet clay spinning on it, a fired vase on the shelf, and the cat potter watching
      sh(R(8, 124, 56, 8, 3), '#E6B98A', { lw: 3, k: 2, in: shadow(37, 125, 16, 3) }) +
      sh(P(26, 124, 'q-9 -16 1 -30q4 -6 2 -12h14q-2 6 2 12q10 14 1 30z'), '#4B9BE8', { k: 3, in: el(30, 104, 2, 7, '#fff', 0.5) + el(36, 112, 2.4, 2.4, '#fff') + el(28, 110, 2, 2, '#fff') + el(44, 110, 2, 2, '#fff') + '<rect x="16" y="88" width="40" height="5" fill="#FF8FB8"/>' }) +
      sh(E(36, 82, 7, 2.2), '#6FB2F0', { lw: 3, k: 0, in: el(36, 82.6, 4.6, 1.4, '#2E5E99') }) +
      shadow(110, 141, 56, 4) +
      sh(P(76, 116, 'l-8 25h84l-8 -25z'), '#7CC4FF', { k: 4, in: '<rect x="80" y="116" width="8" height="26" fill="#fff" opacity=".35"/>' }) +
      sh(E(110, 116, 52, 11), '#DDE7F2', { k: 3, in: el(110, 114, 44, 8, 'rgba(42,35,64,.14)') }) +
      sh(P(70, 110, 'v5a40 8 0 0 0 80 0v-5z'), '#9AA3B5', { lw: 3, k: 0, in: ln('M84 112v8M100 113v10M120 113v10M136 112v8', 2.5, 'rgba(255,255,255,.5)') }) +
      sh(E(110, 110, 40, 8), '#C3CAD8', { lw: 3, k: 0, in: el(111, 110, 20, 4, 'rgba(80,45,30,.25)') }) +
      sh(P(92, 111, 'q-13 -22 1 -40q6 -8 4 -18h26q-2 10 4 18q14 18 1 40z'), '#B97753', { k: 4,
        in: ln('M84 98q26 6 52 0M86 84q24 5 48 0M95 64q15 3 30 0', 2.5, 'rgba(80,40,20,.3)') + el(100, 84, 3, 12, '#fff', 0.3) + ln('M118 60q4 24 0 48', 3, 'rgba(255,235,220,.35)') }) +
      sh(E(110, 53, 13, 3.6), '#C98B6B', { lw: 3, k: 0, in: el(110, 53.6, 9.6, 2.4, '#6E4128') }) +
      ln('M70 62q-7 10 0 20M150 62q7 10 0 20', 3) + ln('M66 77l4 5l5 -3M154 77l-4 5l-5 -3', 3) +
      cat({ preset: 'ginger', pose: 'sit', face: 'happy', x: 200, y: 82, size: 52 })),

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

    rescue: svg(
      // the game as it looks: the bath scene on top, the water rising round a cat on a stool, a brick wall with a
      // gap the water pours through, and the board of pieces (with a kitten box) underneath
      sh(R(0, 0, 240, 150, 0), '#D4EEFF', { lw: 0, k: 0 }) +
      ln('M0 18h240M0 36h240M30 0v58M60 0v58M90 0v58M120 0v58M150 0v58M180 0v58M210 0v58', 1.5, 'rgba(255,255,255,.8)') +
      sh(R(0, 52, 240, 12, 0), '#FFE3C2', { lw: 0, k: 0 }) +
      '<path d="M26 34H150V44Q150 58 136 58H40Q26 58 26 44Z" fill="#8FD3FF" opacity=".85"/>' +
      sh(P(20, 30, 'h136v14q0 16 -16 16h-104q-16 0 -16 -16z'), 'none', { lw: 3.5, k: 0 }) + sh(R(16, 27, 144, 6, 3), '#FFFFFF', { lw: 3, k: 0 }) +
      sh(R(76, 36, 26, 5, 2), '#E6B98A', { lw: 2.5, k: 0 }) + ln('M80 41v12M98 41v12', 3, '#C98B5B') +
      cat({ preset: 'ginger', pose: 'sit', face: 'surprised', x: 89, y: 17, size: 23 }) +
      sh(P(186, 46, 'h40l-4 12q-16 3 -32 0z'), '#E6B477', { lw: 2.5, k: 0 }) +
      // the wall, with one brick knocked out and the water pouring through
      [0, 1, 2, 4, 5].map(function (i) { return sh(R(i * 40 + 2, 64, 36, 12, 3), '#E58F74', { lw: 2.5, k: 2, in: ln('M' + (i * 40) + ' 70h40M' + (i * 40 + 20) + ' 64v6', 1.5, 'rgba(42,35,64,.3)') }); }).join('') +
      '<rect x="120" y="64" width="40" height="12" fill="#3A3046"/>' +
      '<path d="M133 62q-2 14 1 26h12q3 -12 1 -26z" fill="#8FD3FF"' + stroke(2) + '/>' +
      // the board
      sh(R(0, 76, 240, 74, 0), '#FFF8EC', { lw: 0, k: 0 }) +
      '<path d="M40 76h40v37H40zM120 76h40v37h-40zM0 113h40v37H0zM80 113h40v37H80zM160 113h40v37h-40z" fill="#F6E8D2"/>' +
      sh(R(84, 82, 32, 26, 4), '#E2A866', { lw: 2.5, k: 2, in: '<rect x="96" y="82" width="8" height="26" fill="#C98B5B"/>' }) +
      [[20, 95, '#5DB6F5'], [180, 95, '#5DB6F5'], [140, 132, '#5DB6F5']].map(function (q) { return sh(P(q[0] - 11, q[1], 'q7 -8 14 -3l6 -4v14l-6 -4q-7 5 -14 -3z'), q[2], { lw: 2.5, k: 0 }); }).join('') +
      [[60, 95], [220, 132], [100, 132]].map(function (q) { return sh(E(q[0], q[1], 10, 10), '#FF7EB6', { lw: 2.5, k: 2, in: ln('M' + (q[0] - 10) + ' ' + (q[1] - 2) + 'q10 -6 20 0M' + (q[0] - 10) + ' ' + (q[1] + 4) + 'q10 -6 20 0', 1.5, 'rgba(42,35,64,.35)') }); }).join('') +
      [[140, 95], [20, 132], [220, 95]].map(function (q) { return sh(E(q[0], q[1] + 3, 7, 6), '#A77BFF', { lw: 2.2, k: 0 }) + el(q[0] - 7, q[1] - 6, 3, 3, '#A77BFF') + el(q[0], q[1] - 9, 3, 3, '#A77BFF') + el(q[0] + 7, q[1] - 6, 3, 3, '#A77BFF'); }).join('') +
      [[180, 132], [60, 132]].map(function (q) { return sh(P(q[0] - 9, q[1] + 8, 'q0 -18 9 -18q9 0 9 18z'), '#FFC93C', { lw: 2.5, k: 0 }); }).join('') +
      ln('M0 76h240', 3)),
    hotpaws: (function () {
      // a little light-up floor from above: green and dark tiles are safe, blue ones are diamonds, orange warns, red is lava
      var K = { on: ['#5FE08B', '#C4FFD3'], off: ['#3A3262', '#4E4579'], d: ['#5DB6F5', '#D7F0FF'], warn: ['#FFB547', '#FFEBA8'], lava: ['#FF5B3A', '#FFB14A'] };
      var map = [['on', 'off', 'd', 'warn', 'lava'], ['off', 'on', 'off', 'lava', 'lava'], ['d', 'off', 'on', 'warn', 'off']];
      var out = sh(R(10, 8, 220, 138, 18), '#4A3F78', { k: 5 });
      map.forEach(function (row, j) {
        row.forEach(function (key, i) {
          var x = 20 + i * 41, y = 17 + j * 41, cx = x + 19, cy = y + 19, k = K[key], inner = '';
          if (key !== 'off') inner += el(cx, cy, 15, 15, k[1], 0.55);
          if (key === 'off') inner += el(cx - 7, cy - 7, 2, 2, '#fff', 0.12) + el(cx + 7, cy - 7, 2, 2, '#fff', 0.12) + el(cx - 7, cy + 7, 2, 2, '#fff', 0.12) + el(cx + 7, cy + 7, 2, 2, '#fff', 0.12);
          if (key === 'lava') inner += ln('M' + x + ' ' + (cy - 7) + 'q5 -5 10 0t10 0t10 0t10 0M' + x + ' ' + (cy + 6) + 'q5 -5 10 0t10 0t10 0t10 0', 3, '#FFC46A') + sh(E(cx + 8, cy - 1, 3.5, 3.5), '#FFD45A', { lw: 1.6, k: 0 });
          if (key === 'warn') inner += ln('M' + (x - 4) + ' ' + (y + 24) + 'l24 -26M' + (x + 8) + ' ' + (y + 38) + 'l30 -32', 4, 'rgba(255,240,170,.8)');
          if (key !== 'off') inner += shine(cx - 7, cy - 10, 7, 3);
          out += sh(R(x, y, 38, 38, 8), k[0], { lw: 3, k: 3, in: inner });
          if (key === 'warn') out += sh(P(cx, cy - 9, 'l9 16h-18z'), '#FFF6D8', { lw: 2.5, k: 0 }) + ln('M' + cx + ' ' + (cy - 3) + 'v4', 2.5) + el(cx, cy + 4.5, 1.4, 1.4, INK);
          if (key === 'd') out += sh(P(cx - 6, cy - 7, 'h12l5 5.5l-11 13l-11 -13z'), '#F2FAFF', { lw: 2.5, k: 0, in: '<path d="M' + (cx + 2) + ' ' + (cy - 1.5) + 'h9l-11 13z" fill="#9ED8FF"/>' + ln('M' + (cx - 11) + ' ' + (cy - 1.5) + 'h22', 1.6) });
        });
      });
      // the cat, mid-step on a safe tile, with a puff from the lava it just hopped off
      out += shadow(81, 80, 19, 3.5) + cat({ preset: 'ginger', pose: 'walk', step: 1.3, moving: true, face: 'happy', dir: 1, x: 88, y: 56, size: 30 });
      out += sh(U(E(166, 58, 7, 7), E(176, 54, 8, 8), E(184, 60, 6, 6)), '#FFF8EC', { union: true, lw: 2.5, k: 2 });
      return svg(out);
    })(),
    kittenkitchen: svg(
      // the cat sits beside a birthday cake it's decorating: drippy icing, strawberries, sprinkles and candles
      cat({ preset: 'ginger', pose: 'sit', face: 'happy', x: 46, y: 80, size: 54 }) +
      shadow(150, 136, 80, 7) + sh(E(150, 128, 76, 13), '#fff', { k: 3 }) +
      sh(P(96, 78, 'h108v42q-54 16 -108 0z'), '#FFB3CB', { k: 5, in: ln('M96 106q54 14 108 0', 6, '#FFF4E6') +
        ln('M112 100l5 -3M140 104l5 2M164 99l4 -4M186 102l5 1M128 114l4 3M172 116l4 -3', 3.5, '#7CC4FF') + ln('M102 112l4 2M154 114l3 -4M196 110l-3 4', 3.5, '#FFC93C') }) +
      sh(P(94, 80, 'q56 -16 112 0v6h-5v8a5 5 0 0 1 -10 0v-8h-5v13a5 5 0 0 1 -10 0v-13h-5v9a5 5 0 0 1 -10 0v-9h-5v16a5 5 0 0 1 -10 0v-16h-5v7a5 5 0 0 1 -10 0v-7h-5v14a5 5 0 0 1 -10 0v-14h-5v8a5 5 0 0 1 -10 0v-8h-7z'), '#FFF8FB', { lw: 3, k: 2 }) +
      [[126, '#7CC4FF', 46], [150, '#FF8FAB', 40], [174, '#7BD389', 46]].map(function (c) {
        return sh(R(c[0] - 4.5, c[2], 9, 76 - c[2], 3), c[1], { lw: 3, k: 0 }) + sh(P(c[0], c[2] - 20, 'q8 10 0 15q-8 -5 0 -15z'), '#FFC93C', { lw: 2.5, k: 0 });
      }).join('') +
      // strawberries like the pancake ones: a rounded berry with seeds and a leafy top
      [[110, 72], [190, 72]].map(function (b) {
        return sh(P(b[0], b[1] - 6, 'c6 -2 9 3 7 8c-2 5 -5 8 -7 8c-2 0 -5 -3 -7 -8c-2 -5 1 -10 7 -8z'), '#F0435A', { lw: 2.5, k: 2,
          in: el(b[0] - 3, b[1] - 1, 1, 1.4, '#FFE27A') + el(b[0] + 3, b[1] - 1, 1, 1.4, '#FFE27A') + el(b[0], b[1] + 4, 1, 1.4, '#FFE27A') }) +
          sh(P(b[0] - 5, b[1] - 7, 'q5 -5 10 0q-5 3 -10 0z'), '#5DBB63', { lw: 2, k: 0 });
      }).join('') +
      ''),

    laser: svg(
      sh(R(8, 8, 224, 134, 16), '#6B4F57', { lw: 4, k: 0, in: ln('M8 52h224M8 96h224M60 8v44M150 52v44M100 96v46M200 8v44', 2, 'rgba(42,35,64,.3)') }) +
      ln('M48 112H150V56', 10, 'rgba(255,60,90,.35)') + ln('M48 112H150V56', 4, '#FFC2CC') +
      sh(R(18, 104, 34, 16, 6), '#B9C0D6', { lw: 3, k: 3 }) + sh(R(48, 106, 8, 12, 3), '#FF5A6E', { lw: 2.5, k: 0 }) +
      sh(P(138, 124, 'l26 -26l7 7l-26 26z'), '#F2C27B', { lw: 3, k: 2, in: ln('M144 120l18 -18', 3, '#CDEEFF') }) +
      cat({ preset: 'ginger', pose: 'lie', face: 'happy', x: 158, y: 44, size: 64 }) +
      el(150, 60, 9, 9, 'rgba(255,80,110,.5)') + el(150, 60, 3.5, 3.5, '#FFE3E8') +
      sh(P(196, 120, 'h22l-4 18h-14z'), '#E58B5E', { lw: 3, k: 2 }) + sh(E(201, 112, 5, 11), '#5DBB72', { lw: 2.5, k: 0 }) + sh(E(212, 112, 5, 11), '#5DBB72', { lw: 2.5, k: 0 })),

    rooftop: svg(
      sh(R(0, 0, 240, 150, 0), '#2E2A55', { lw: 0, k: 0 }) +
      el(196, 30, 15, 15, '#FFF1C9') + '<circle cx="196" cy="30" r="15" fill="none"' + stroke(2.5) + '/>' +
      el(30, 20, 1.6, 1.6, '#FFF6D8') + el(70, 40, 1.4, 1.4, '#FFF6D8') + el(120, 16, 1.8, 1.8, '#FFF6D8') + el(150, 50, 1.3, 1.3, '#FFF6D8') + el(225, 70, 1.5, 1.5, '#FFF6D8') +
      sh(R(-6, 100, 104, 60, 2), '#7A5C8E', { lw: 3.5, k: 0, in: '<rect x="12" y="114" width="16" height="20" rx="3" fill="#FFD98A"/><rect x="44" y="114" width="16" height="20" rx="3" fill="#4A3F6B"/><rect x="76" y="114" width="16" height="20" rx="3" fill="#FFD98A"/>' }) +
      sh(R(138, 88, 110, 70, 2), '#5E6B9E', { lw: 3.5, k: 0, in: '<rect x="152" y="104" width="16" height="20" rx="3" fill="#4A3F6B"/><rect x="186" y="104" width="16" height="20" rx="3" fill="#FFD98A"/><rect x="220" y="104" width="16" height="20" rx="3" fill="#FFD98A"/>' }) +
      sh(R(196, 62, 22, 26, 2), '#B65A4B', { lw: 3, k: 3 }) +
      [[100, 52], [120, 42], [140, 46]].map(function (q) { return sh(P(q[0] - 10, q[1], 'q6 -7 12 -3l6 -4v12l-6 -4q-6 4 -12 -1z'), '#7CC4FF', { lw: 2.5, k: 0 }); }).join('') +
      cat({ preset: 'ginger', pose: 'walk', face: 'happy', x: 80, y: 56, size: 50, step: 1, moving: true, dir: 1, t: 'rotate(-12 70 70)' })),
    sneaky: svg(
      sh(R(0, 0, 240, 150, 0), '#4B4378', { lw: 0, k: 0 }) +
      sh(R(150, 14, 60, 64, 4), '#2A2452', { lw: 3.5, k: 0, in: el(190, 34, 9, 9, '#FFF1C9') + el(162, 30, 1.4, 1.4, '#FFF6D8') + el(172, 60, 1.2, 1.2, '#FFF6D8') }) +
      ln('M180 14v64M150 46h60', 3) +
      '<path d="M0 104h240v46H0z" fill="#7A5560"/>' + '<path d="M0 98h240v8H0z" fill="#E9DCC8"/>' + ln('M0 98h240M0 106h240', 2.5) +
      '<path d="M96 108h136v30H96z" fill="rgba(255,226,140,.25)"/>' +
      shadow(178, 132, 52, 6) + sh(E(178, 128, 54, 10), '#B05F7C', { lw: 3, k: 0 }) +
      sh(E(184, 114, 36, 15), '#C98B5B', { lw: 3, k: 3 }) + sh(E(206, 120, 13, 10), '#C98B5B', { lw: 3, k: 2 }) +
      sh(R(128, 120, 30, 9, 4), '#C98B5B', { lw: 2.5, k: 0 }) +
      sh(E(148, 112, 15, 13), '#C98B5B', { lw: 3, k: 2 }) + sh(E(135, 116, 9, 6.5), '#C98B5B', { lw: 2.5, k: 0 }) + el(127, 114, 3, 2.6, '#2A2340') +
      ln('M144 108q3 2.5 6 0', 2) + sh(P(152, 103, 'q8 -2 8 8q0 9 -5 10q-5 -3 -3 -18z'), '#7E4E30', { lw: 2.5, k: 0 }) +
      '<text x="160" y="88" font-family="Baloo 2, sans-serif" font-weight="800" font-size="15" fill="#BFE6FF" stroke="#2A2340" stroke-width="3" paint-order="stroke">z</text>' +
      '<text x="170" y="76" font-family="Baloo 2, sans-serif" font-weight="800" font-size="11" fill="#BFE6FF" stroke="#2A2340" stroke-width="2.5" paint-order="stroke">z</text>' +
      shadow(72, 130, 22, 4) +
      cat({ preset: 'ginger', pose: 'walk', face: 'open', x: 72, y: 106, size: 32, step: 1.2, moving: true, dir: 1 }) +
      sh(R(8, 100, 34, 32, 3), '#DDA86F', { lw: 3, k: 3, in: '<path d="M19 100h12v32H19z" fill="rgba(255,255,255,.35)"/>' }) +
      [[108, 116]].map(function (q) { return sh(P(q[0] - 10, q[1], 'q6 -7 12 -3l6 -4v12l-6 -4q-6 4 -12 -1z'), '#7CC4FF', { lw: 2.5, k: 0 }); }).join('')),
    yarndefence: svg(
      sh(R(0, 0, 240, 150, 0), '#DCAA7A', { lw: 0, k: 0 }) +
      ln('M0 30h240M0 60h240M0 90h240M0 120h240', 1.5, 'rgba(42,35,64,.14)') +
      ln('M-10 110H120V50H250', 34) + ln('M-10 110H120V50H250', 28, '#E9837A') + ln('M-10 110H120V50H250', 18, '#F2A08E') +
      [[34, 110], [74, 110]].map(function (q, i) { return sh(P(q[0] - 14, q[1] + 4, 'q0 -15 17 -15q14 0 18 13q-2 6 -14 6h-16q-5 0 -5 -4z'), i ? '#B8B3C9' : '#D2AE86', { lw: 2.5, k: 2 }) + el(q[0] + 4, q[1] - 10, 5, 5, '#FFB4C6') + el(q[0] + 12, q[1] - 4, 2.6, 2.6, '#2A2340') + el(q[0] + 21, q[1] + 2, 2.4, 2.4, '#FF8FAB') + ln('M' + (q[0] - 14) + ' ' + (q[1] + 2) + 'q-10 -2 -14 6', 2.2); }).join('') +
      shadow(196, 62, 30, 5) + sh(P(170, 38, 'h52l-5 22h-42z'), '#C9935E', { lw: 3, k: 3 }) +
      wool(184, 34, 10, '#FF8FAB', '#D9577C') + wool(204, 32, 10, '#7CC4FF', '#4F9BD9') + wool(194, 22, 9, '#FFD23F', '#E0A800') +
      shadow(84, 76, 20, 4) + sh(E(84, 74, 18, 6), '#FFD23F', { lw: 2.5, k: 0 }) +
      cat({ preset: 'ginger', pose: 'sit', face: 'happy', x: 84, y: 40, size: 36 }) +
      shadow(160, 132, 20, 4) + sh(E(160, 130, 18, 6), '#B48CFF', { lw: 2.5, k: 0 }) +
      cat({ color: '#F1E3CB', build: 'fluffy', pose: 'lie', face: 'sleep', x: 160, y: 118, size: 34 })),
    fishmaze: svg(
      sh(R(0, 0, 240, 150, 0), '#BDE8A8', { lw: 0, k: 0 }) +
      '<path d="M0 0h30v150H0zM60 0h30v150H60zM120 0h30v150h-30zM180 0h30v150h-30z" fill="rgba(42,35,64,.04)"/>' +
      ln('M20 20H220V130H20Z', 30) + ln('M20 20H220V130H20Z', 24, '#4FB868') + ln('M20 20H220V130H20Z', 17, '#5CCB75') +
      ln('M70 75H170', 30) + ln('M70 75H170', 24, '#4FB868') + ln('M70 75H170', 17, '#5CCB75') +
      [[86, 47], [112, 47], [138, 47], [164, 47], [112, 103], [138, 103], [164, 103], [190, 103]].map(function (q) { return sh(P(q[0] - 8, q[1], 'q5 -6 10 -2.5l5 -3.5v10l-5 -3.5q-5 3.5 -10 -0.5z'), '#7CC4FF', { lw: 2.2, k: 0 }); }).join('') +
      el(194, 47, 9, 9, 'rgba(196,255,176,.7)') + sh(E(190, 47, 5, 8), '#5DBB72', { lw: 2.2, k: 0 }) + sh(E(198, 47, 5, 8), '#5DBB72', { lw: 2.2, k: 0 }) +
      sh(E(58, 103, 17, 14), '#C98B5B', { lw: 3, k: 2 }) + sh(E(43, 103, 6, 10), '#7E4E30', { lw: 2.5, k: 0 }) + sh(E(73, 103, 6, 10), '#7E4E30', { lw: 2.5, k: 0 }) +
      el(52, 100, 2.4, 2.4, '#2A2340') + el(64, 100, 2.4, 2.4, '#2A2340') + el(58, 107, 3, 2.2, '#2A2340') +
      cat({ preset: 'ginger', pose: 'head', face: 'open', x: 58, y: 40, size: 34 })),
    parade: svg(
      sh(R(0, 0, 240, 150, 0), '#BFE6FF', { lw: 0, k: 0 }) +
      '<path d="M0 104q60 -22 120 -6t120 -4v56H0z" fill="#A8E0A0"/>' + ln('M0 104q60 -22 120 -6t120 -4', 2.5) +
      sh(R(-6, 60, 96, 26, 6), '#C48A5A', { lw: 3.5, k: 3, in: '<path d="M-6 60h96v6H-6z" fill="#7BD389"/>' }) +
      sh(R(-6, 122, 252, 40, 4), '#C48A5A', { lw: 3.5, k: 3, in: '<path d="M-6 122h252v6H-6z" fill="#7BD389"/>' }) +
      sh(P(14, 60, 'v-18h26v18z'), '#DDA86F', { lw: 3, k: 2 }) + ln('M14 42l-8 -8M40 42l8 -8', 3) +
      cat({ preset: 'pink', pose: 'walk', face: 'happy', x: 66, y: 50, size: 18, step: 1, moving: true, dir: 1 }) +
      ln('M104 70v18', 2.5) + sh(P(90, 72, 'q0 -14 14 -14t14 14q-3.5 -3 -7 0q-3.5 -3 -7 0q-3.5 -3 -7 0q-3.5 -3 -7 0z'), '#7CC4FF', { lw: 2.5, k: 0 }) +
      cat({ preset: 'blue', pose: 'walk', face: 'happy', x: 106, y: 94, size: 18, dir: 1 }) +
      cat({ preset: 'ginger', pose: 'walk', face: 'happy', x: 66, y: 112, size: 18, step: 2, moving: true, dir: 1 }) +
      cat({ preset: 'purple', pose: 'walk', face: 'happy', x: 140, y: 112, size: 18, step: 0.5, moving: true, dir: 1 }) +
      shadow(204, 122, 26, 4) + sh(R(186, 94, 36, 28, 3), '#F2C27B', { lw: 3, k: 3 }) +
      sh(P(180, 97, 'l24 -20l24 20z'), '#E9837A', { lw: 3, k: 2 }) + sh(P(197, 122, 'v-10a7 7 0 0 1 14 0v10z'), '#4A3656', { lw: 2.5, k: 0 })),
    fashion: svg(
      sh(R(0, 0, 240, 150, 0), '#FFD3E4', { lw: 0, k: 0 }) +
      el(120, 70, 80, 66, '#FFFFFF', 0.5) + el(120, 138, 84, 10, '#FFFFFF', 0.45) +
      sh(R(170, 22, 52, 62, 4), '#FFFDF8', { lw: 3, k: 0, in: '<path d="M175 27h42v42h-42z" fill="#7CC4FF"/><path d="M175 60q10 -10 21 0t21 -2v11h-42z" fill="#F6D9A0"/>' }) +
      sh(R(186, 16, 20, 8, 1), 'rgba(255,143,171,.8)', { lw: 0, k: 0 }) +
      sh(R(18, 34, 46, 34, 7), '#FF8FAB', { lw: 3, k: 3, in: '<circle cx="41" cy="52" r="9" fill="#BFE6FF"/>' }) + sh(P(31, 34, 'l3 -7h14l3 7z'), '#FF8FAB', { lw: 3, k: 0 }) +
      '<circle cx="41" cy="52" r="9" fill="none"' + stroke(3) + '/>' +
      ln('M26 22l-5 -6M41 18v-8M56 22l5 -6', 3) +
      shadow(120, 136, 34, 6) +
      cat({ preset: 'ginger', pose: 'sit', face: 'happy', x: 120, y: 70, size: 60 }) +
      sh(P(106, 50, 'l-2 -18l9 8l7 -13l7 13l9 -8l-2 18z'), '#FFD23F', { lw: 3, k: 3 }) +
      el(120, 27, 2.6, 2.6, '#FF5C8A') +
      '<path d="M120 103l-12 -7v14zM120 103l12 -7v14z" fill="#5B6BD6"' + stroke(2.5) + '/>' + el(120, 103, 3.5, 4, '#3E4BB0') +
      [109, 131].map(function (x) { return '<path d="M' + x + ' 77c-8 -7 -10 -12 -5 -15q4 -2 5 3q1 -5 5 -3c5 3 3 8 -5 15z" fill="rgba(255,92,138,.75)"' + stroke(2.6) + '/>'; }).join('') +
      ln('M114 70h12', 2.6))
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
      levels: 20, done: DONE.next, art: ART.kittypop
    },
    {
      id: 'cubbies', save: 'cubbies', name: 'Cosy Cubbies', blurb: 'Tuck sleepy cats into their beds',
      ages: ['5-10'], toddler: false, free: 0, status: 'live', season: null, colour: '#BFE0FF',
      levels: 20, done: DONE.next, art: ART.cubbies
    },
    {
      id: 'yarn', save: 'yarn', name: 'Yarn Sort', blurb: 'Sort the wool into tubes',
      ages: ['5-10', '10+'], toddler: false, free: 0, status: 'live', season: null, colour: '#DCC8FF',
      levels: 25, done: DONE.next, art: ART.yarn
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
      // a total, not an "out of": colouring doesn't get harder. Pictures finished (hung) so far; older saves count
      // the finished pictures they still hold.
      badge: function (p) {
        var n = p && typeof p.hung === 'number' ? p.hung : (p && Array.isArray(p.pics) ? p.pics.filter(function (x) { return x && x.done; }).length : 0);
        return n ? n + (n === 1 ? ' picture' : ' pictures') : '';
      },
      art: ART.colour
    },
    {
      id: 'grow', save: 'grow', name: 'Grow', blurb: 'Grow plants for your home',
      ages: ['under5', '5-10'], toddler: false, toddlerToo: true, free: 'all', status: 'live', season: null, colour: '#D4F0C4',
      badge: function (p) { var n = p && typeof p.grown === 'number' ? p.grown : 0; return n ? n + (n === 1 ? ' plant grown' : ' plants grown') : ''; },
      art: ART.grow
    },
    {
      id: 'pottery', save: 'pottery', name: 'Pottery', blurb: 'Shape, paint and fire a pot',
      ages: ['5-10', '10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#F6DCC6',
      badge: function (p) { var n = p && typeof p.made === 'number' ? p.made : 0; return n ? n + (n === 1 ? ' pot made' : ' pots made') : ''; },
      art: ART.pottery
    },
    {
      id: 'cafe', save: 'cafe', name: 'Cat Caf\u00e9', blurb: 'Serve hungry cat customers',
      ages: ['5-10'], toddler: false, free: 'all', status: 'live', season: null, colour: '#FFD9C2',
      levels: 15, done: DONE.rated('best'), art: ART.cafe
    },
    {
      id: 'feed', save: 'feed', name: 'Feed the Cat', blurb: 'Give each cat its bowl',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#FFE0B8',
      art: ART.feed
    },
    {
      id: 'yarn-dash', save: 'yarndash', name: 'Yarn Dash', blurb: 'Run and catch the yarn',
      ages: ['5-10'], toddler: false, free: 'all', status: 'live', season: null, colour: '#F2DDC0',
      levels: 20, done: function (p) { return Math.max(DONE.next(p), (p && p.best) | 0); }, art: ART.yarndash
    },
    {
      id: 'slide', save: 'slide', name: 'Slide Puzzle', blurb: 'Slide the squares to fix the picture',
      ages: ['5-10', '10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#CDE8FF',
      levels: 12, done: function (p) { var s = p && p.solved, n = 0; if (s && typeof s === 'object') Object.keys(s).forEach(function (k) { if (Array.isArray(s[k])) n += (s[k].indexOf(3) >= 0) + (s[k].indexOf(4) >= 0); }); return n; }, art: ART.slide
    },
    {
      id: 'rescue', save: 'rescue', name: 'Cat Rescue', blurb: 'Match to free kittens from boxes',
      ages: ['10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#F6DDF2',
      levels: 30, done: DONE.list, art: ART.rescue
    },
    {
      id: 'hotpaws', save: 'hotpaws', name: 'Hot Paws', blurb: 'Dodge the lava, grab the diamonds',
      ages: ['5-10', '10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#CDEFD8',
      levels: 20, done: DONE.list, art: ART.hotpaws
    },
    {
      id: 'seek', save: 'seek', name: 'Hide and Seek', blurb: 'Find the hidden things',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#CFEFC4',
      art: ART.seek
    },
    {
      id: 'mouse-pop', save: 'mousepop', name: 'Mouse Pop', blurb: 'Tap the mice to pop them',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#F2DDC0',
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
      badge: function (p) { var n = (p && p.done) | 0; return n ? n + (n === 1 ? ' puzzle' : ' puzzles') : ''; },   // a total: puzzles don't get harder
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
      id: 'kitten-kitchen', save: 'kittenkitchen', name: 'Topping Time', blurb: 'Decorate pizza, pancakes and cake',
      ages: ['under5'], toddler: true, free: 'all', status: 'live', season: null, colour: '#FFE2C7',
      art: ART.kittenkitchen
    },
    {
      id: 'laser', save: 'laser', name: 'Laser Bounce', blurb: 'Bounce the laser to every cat',
      ages: ['10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#D9CCF2',
      levels: 30, done: DONE.open, art: ART.laser
    },
    {
      id: 'rooftop', save: 'rooftop', name: 'Rooftop Run', blurb: 'Leap across the city at night',
      ages: ['10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#C9CBEF',
      badge: function (p) { return p && p.best ? 'Best ' + p.best + ' m' : ''; }, art: ART.rooftop
    },
    {
      id: 'sneaky', save: 'sneaky', name: 'Sneaky Cat', blurb: 'Tiptoe past the sleeping dogs',
      ages: ['10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#B9B2E8',
      levels: 20, done: DONE.open, art: ART.sneaky
    },
    {
      id: 'yarn-defence', save: 'yarndefence', name: 'Yarn Defence', blurb: 'Send the mice home, save the yarn',
      ages: ['10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#F6C9A8',
      levels: 30, done: DONE.open, art: ART.yarndefence
    },
    {
      id: 'fishmaze', save: 'fishmaze', name: 'Fish Maze', blurb: 'Munch the fish, dodge the puppies',
      ages: ['5-10'], toddler: false, free: 'all', status: 'live', season: null, colour: '#C6EBB5',
      levels: 15, done: DONE.open, art: ART.fishmaze
    },
    {
      id: 'parade', save: 'parade', name: 'Kitten Parade', blurb: 'Give the kittens jobs to get them all home',
      ages: ['10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#BFE6FF',
      levels: 12, done: DONE.rated('stars'), art: ART.parade
    },
    {
      id: 'fashion', save: 'fashion', name: 'Cat Fashion Studio', blurb: 'Dress up your cat, then strike a pose',
      ages: ['5-10', '10+'], toddler: false, free: 'all', status: 'live', season: null, colour: '#FFC4DA',
      badge: function (p) { return p && p.shots ? p.shots + (p.shots === 1 ? ' photo' : ' photos') : ''; }, art: ART.fashion
    }
  ];

  /* level games: the badge is levels finished out of the set count */
  GAMES.forEach(function (g) {
    if (g.levels && g.done) g.badge = function (p) { return levelsBadge(g.done(p || {}, g.levels), g.levels); };
  });

  /* Dev games show on a test copy of the site (localhost, preview links) or with ?dev in the address. */
  function devVisible() {
    try {
      var h = location.hostname;
      return /^(localhost|127\.0\.0\.1)$/.test(h) || /[?&]dev\b/.test(location.search) || /-git-|vercel\.app$/.test(h);
    } catch (e) { return false; }
  }

  window.GGGames = {
    all: GAMES,
    AGES: [{ id: 'under5', label: 'Under 5' }, { id: '5-10', label: '5\u201310' }, { id: '10+', label: '10+' }],
    levelsBadge: levelsBadge,
    /* how many of a level game's levels are finished, from its saved progress (null for other games) */
    levelsDone: function (g, p) { return g && g.levels && g.done ? Math.min(g.levels, Math.max(0, g.done(p || {}, g.levels) | 0)) : null; },
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
