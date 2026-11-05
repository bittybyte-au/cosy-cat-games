/* Cosy Cat Games: the shared drawing kit for canvas games, so every game looks like one set.

   The house style, in four rules:
   1. One ink colour (INK) for every outline, in three weights: LW.big (5) for main shapes,
      LW.mid (4) for parts, LW.fine (3) for small details. Round joins and caps.
   2. Outline last. Fill a shape, draw its details and shading clipped inside it, then stroke the outline,
      so nothing ever sits on top of a line or pokes past it.
   3. Soft light from the top left: shapes get a gentle gradient (tone) or a darker crescent along the
      lower right edge (crescent), plus an optional white shine near the top left.
   4. Things on a surface get a soft ink shadow underneath (shadow), never a hard black one.

   GGDraw.tone(c, col, y0, y1)               a fill that's a touch lighter at y0 and darker at y1
   GGDraw.shape(c, path, fill, opts)         rule 2 in one call. path: Path2D or a function(p) that adds to a new Path2D.
       opts: { lw, depth (crescent size, 0 = none), inside: fn(c) drawn clipped, shine: [x, y, rx, ry, rot, a], dx, dy, shade, line,
               m: a DOMMatrix placing the shape (squashed, turned): the outline keeps its weight however it's squashed,
                  and inside/shine are drawn in the shape's own units }
   GGDraw.crescent(c, path2d, depth, fill?)  just the clipped darker crescent
   GGDraw.shine(c, x, y, rx, ry, rot, a)     a soft white highlight
   GGDraw.shadow(c, x, y, rx, ry)            a soft shadow on the ground
   GGDraw.ink(c, lw)                         stroke the current path in ink
   GGDraw.rrPath(x, y, w, h, r, p?), ellPath(x, y, rx, ry)   Path2D builders (rrPath adds to p when given)
   GGDraw.rr(c, x, y, w, h, r)               a rounded rectangle as the current path
   GGDraw.seeded(seed)                       a repeatable random() for scattering seeds, spots and crumbs
   GGDraw.mix(a, b, t), darker(col, k), lighter(col, k)  colour helpers */
(function () {
  var INK = '#2A2340';
  var LW = { big: 5, mid: 4, fine: 3 };

  function rgb(hex) { var h = String(hex).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var v = parseInt(h, 16) || 0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  function hex(a) { return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function isHex(c) { return typeof c === 'string' && c.charAt(0) === '#'; }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  // darker leans towards ink rather than black, so shadows stay warm and match the outlines
  function darker(col, k) { return isHex(col) ? mix(col, INK, k) : col; }
  function lighter(col, k) { return isHex(col) ? mix(col, '#FFFFFF', k) : col; }

  // gradients are kept, so a shape drawn every frame doesn't make a new one each time
  var tones = {}, nTones = 0;
  function tone(c, col, y0, y1, x0, x1) {
    if (!isHex(col)) return col;
    x0 = x0 || 0; if (x1 === undefined) x1 = x0;
    var key = col + y0 + ',' + y1 + ',' + x0 + ',' + x1, g = tones[key];
    if (g) return g;
    if (nTones > 400) { tones = {}; nTones = 0; }
    g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, lighter(col, 0.12)); g.addColorStop(0.55, col); g.addColorStop(1, darker(col, 0.12));
    nTones++; return (tones[key] = g);
  }
  function ink(c, lw) { c.lineWidth = lw || LW.big; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  function rrPath(x, y, w, h, r, p) { p = p || new Path2D(); r = Math.min(r, w / 2, h / 2); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; }
  function rr(c, x, y, w, h, r) { c.beginPath(); rrPath(x, y, w, h, r, c); }
  function seeded(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function ellPath(x, y, rx, ry, rot) { var p = new Path2D(); p.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); return p; }

  /* the darker crescent along the lower right: the shape minus a copy of itself moved up and left, clipped to the shape */
  function crescent(c, p, depth, fill, dx, dy) {
    if (!depth) return;
    var hole = new Path2D();
    hole.rect(-1e5, -1e5, 2e5, 2e5);
    hole.addPath(p, new DOMMatrix().translate(dx === undefined ? -depth * 0.7 : dx, dy === undefined ? -depth : dy));
    c.save(); c.clip(p); c.fillStyle = fill || 'rgba(42,35,64,.12)'; c.fill(hole, 'evenodd'); c.restore();
  }
  function shine(c, x, y, rx, ry, rot, a) {
    c.save(); c.fillStyle = 'rgba(255,255,255,' + (a === undefined ? 0.45 : a) + ')';
    c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); c.fill(); c.restore();
  }
  function shadow(c, x, y, rx, ry) { c.save(); c.fillStyle = 'rgba(42,35,64,.16)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.restore(); }

  function shape(c, path, fill, o) {
    o = o || {};
    var p = path, m = o.m;
    if (typeof path === 'function') { p = new Path2D(); path(p); }
    if (m) { var q = new Path2D(); q.addPath(p, m); p = q; }
    if (fill) { c.fillStyle = fill; c.fill(p); }
    if (o.inside) { c.save(); c.clip(p); if (m) c.transform(m.a, m.b, m.c, m.d, m.e, m.f); o.inside(c); c.restore(); }
    crescent(c, p, o.depth === undefined ? 7 : o.depth, o.shade, o.dx, o.dy);
    if (o.shine) { c.save(); c.clip(p); if (m) c.transform(m.a, m.b, m.c, m.d, m.e, m.f); shine(c, o.shine[0], o.shine[1], o.shine[2], o.shine[3], o.shine[4], o.shine[5]); c.restore(); }
    if (o.lw !== 0) { c.lineWidth = o.lw || LW.big; c.strokeStyle = o.line || INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(p); }
    return p;
  }

  window.GGDraw = {
    INK: INK, LW: LW,
    tone: tone, shape: shape, crescent: crescent, shine: shine, shadow: shadow, ink: ink,
    rrPath: rrPath, ellPath: ellPath, rr: rr, seeded: seeded, mix: mix, darker: darker, lighter: lighter
  };
})();
