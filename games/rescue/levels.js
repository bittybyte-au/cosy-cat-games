/* Cat Rescue: the 30 rescues. Each is a map (8 rows of 8, top row first), the goal, the moves, the peril and its cat.
   Map: '.' piece, '#' no cell, 'b' box, 'B' taped box (two hits), 'k' box with a kitten, 'K' taped box with a kitten,
   't' piece wrapped in yarn, 'c' a kitten on a cushion (bring it down to the bottom).
   goal: kittens (freed from boxes), boxes (broken, kitten boxes count too), yarn (untangled), down (cushion kittens).
   colours: how many kinds of piece (4 is gentle, 5 normal, 6 tricky). tip: a line shown at the start.
   pile: how much of the heap rests on top of each column (cleared pieces knock it down into the board); set below
   from a shape and a size for each level, so every rescue has a heap to clear.
   Moves were tuned by playing every level with a greedy bot (see the notes in the commit), and retuned with the
   heap added so each level's bot win rate stayed about the same. */
(function () {
  var PERILS = ['bath', 'tree', 'rain', 'tide', 'laundry'];
  var CATS = [
    ['Mochi', 'ginger'], ['Pip', 'white'], ['Biscuit', 'purple'], ['Tofu', 'blue'], ['Pumpkin', 'pink'],
    ['Bean', 'black'], ['Noodle', 'ginger'], ['Pickle', 'blue'], ['Muffin', 'pink'], ['Clover', 'white'],
    ['Sesame', 'black'], ['Juniper', 'purple'], ['Waffle', 'ginger'], ['Pebble', 'white'], ['Olive', 'pink'],
    ['Ziggy', 'blue'], ['Marmalade', 'ginger'], ['Dumpling', 'purple'], ['Fig', 'black'], ['Socks', 'white'],
    ['Poppy', 'pink'], ['Maple', 'ginger'], ['Toast', 'blue'], ['Nutmeg', 'purple'], ['Luna', 'black'],
    ['Pudding', 'white'], ['Basil', 'ginger'], ['Crumpet', 'pink'], ['Miso', 'blue'], ['Button', 'purple']
  ];
  var L = [
    { moves: 16, colours: 5, goal: { kittens: 4 }, tip: 'Match three next to a box to break it open.',
      map: ['........', '........', '........', '.bbbbbb.', '.bk..kb.', '........', '..bkkb..', '........'] },
    { moves: 16, colours: 5, goal: { kittens: 4 }, tip: 'Line up four to make zoomies. Swap it to clear a whole line!',
      map: ['........', '........', '.bbbbbb.', '.k.bb.k.', '..bbbb..', '...kk...', '........', '........'] },
    { moves: 19, colours: 5, goal: { boxes: 16, kittens: 2 }, tip: 'Make an L or a T shape for catnip: it clears all round it.',
      map: ['........', '........', '.bbbbbb.', '.bk..kb.', '.bb..bb.', '..bbbb..', '........', '........'] },
    { moves: 22, colours: 5, goal: { kittens: 4 }, tip: 'Taped boxes need two matches.',
      map: ['........', '........', '..B..B..', '..K..K..', '........', '.B.BB.B.', '.K....K.', '........'] },
    { moves: 27, colours: 5, goal: { boxes: 20, kittens: 3 }, tip: 'Five in a row makes rainbow yarn. Swap it with a piece to clear every piece of that kind.',
      map: ['........', '........', '.BBBBBB.', '.b.kk.b.', '.bbbbbb.', '........', '.bbkbbb.', '........'] },

    { moves: 18, colours: 5, goal: { yarn: 10, kittens: 2 }, tip: 'Yarn holds a piece still. Match that piece to untangle it.',
      map: ['........', '........', '.t.tt.t.', '........', 't.tkkt.t', '........', '..t..t..', '........'] },
    { moves: 25, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['........', '........', 'tttttttt', '........', '..bkkb..', '..b..b..', '.k.tt.k.', '........'] },
    { moves: 25, colours: 5, goal: { kittens: 6 },
      map: ['........', '........', '.tttttt.', '.tkkkkt.', '.tbKKbt.', '.tttttt.', '........', '........'] },
    { moves: 27, colours: 5, goal: { down: 1 }, tip: 'Clear the pieces under the cushion to bring the kitten down to the bottom.',
      map: ['...c....', '........', '........', '...b....', '........', '...b....', '........', '........'] },
    { moves: 27, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['.c....c.', '........', '.b....b.', '...kk...', '........', '...bb...', '........', '........'] },

    { moves: 25, colours: 5, goal: { kittens: 6 },
      map: ['#......#', '........', '.bb..bb.', '.bk..kb.', '.BB..BB.', '..kKKk..', '...bb...', '#......#'] },
    { moves: 29, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['........', '........', '.t.tt.t.', '.K.bb.K.', '...bb...', '.t.KK.t.', '.t....t.', '........'] },
    { moves: 25, colours: 5, goal: { down: 2 },
      map: ['..c..c..', '........', '........', 'bbB..Bbb', '........', '..t..t..', '........', '........'] },
    { moves: 20, colours: 5, goal: { yarn: 16, kittens: 2 },
      map: ['........', '.t.t.t.t', 't.t.t.t.', '...KK...', 't.t.t.t.', '.t.t.t.t', '........', '........'] },
    { moves: 30, colours: 5, goal: { kittens: 4 },
      map: ['........', '........', '.BBBBBB.', '.BkKKkB.', '.BBBBBB.', '........', '........', '........'] },

    { moves: 23, colours: 5, goal: { kittens: 6 },
      map: ['###..###', '##....##', '#.KbbK.#', '..BkkB..', '..bBBb..', '#.K..K.#', '##....##', '###..###'] },
    { moves: 27, colours: 5, goal: { down: 2 },
      map: ['...cc...', '........', '...tt...', '..b..b..', '...tt...', '........', '...tt...', '........'] },
    { moves: 19, colours: 5, goal: { kittens: 6 },
      map: ['.B....B.', '.K.tt.K.', '.B....B.', '...KK...', '.t....t.', '..BBBB..', '..BkkB..', '........'] },
    { moves: 33, colours: 5, goal: { down: 2, boxes: 8 },
      map: ['c......c', '........', 'bbbbbbbb', '........', '.tttttt.', '........', '........', '........'] },
    { moves: 28, colours: 6, goal: { kittens: 4 },
      map: ['........', '.K....K.', '..tttt..', '........', '..B..B..', '.BKBBKB.', '........', '........'] },

    { moves: 28, colours: 5, goal: { boxes: 22, kittens: 3 },
      map: ['#......#', '.bbbbbb.', '.bkBBkb.', '.bbkbbb.', '.BB..BB.', '...tt...', '..t..t..', '#......#'] },
    { moves: 28, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['.c....c.', '........', '.B....B.', '.B.tt.B.', '........', '...KK...', '.t....t.', '........'] },
    { moves: 28, colours: 5, goal: { kittens: 6 },
      map: ['t......t', '.t.KK.t.', '..tBBt..', '.K.tt.K.', '..tBBt..', '.t.KK.t.', 't......t', '........'] },
    { moves: 33, colours: 6, goal: { kittens: 6 },
      map: ['........', '..K..K..', '........', '.B.BB.B.', '..B..B..', '.kK..Kk.', '...BB...', '........'] },
    { moves: 26, colours: 5, goal: { down: 1, kittens: 2 },
      map: ['...c....', '..k.k...', '...t....', '.b.B.b..', '...t....', '..b.b...', '...B....', '........'] },

    { moves: 41, colours: 5, goal: { down: 2, kittens: 4 },
      map: ['#..cc..#', '..BBBB..', '.tk..kt.', '.t.KK.t.', '..bbbb..', '........', '...tt...', '#......#'] },
    { moves: 25, colours: 5, goal: { kittens: 6 },
      map: ['........', 'bKbbbbKb', 'b.tttt.b', 'b.t..t.b', 'b.tkkt.b', 'b......b', 'bK....Kb', 'bbbbbbbb'] },
    { moves: 42, colours: 5, goal: { down: 4 },
      map: ['c.c..c.c', '........', '........', '.bbbbbb.', '........', '..t..t..', '........', '........'] },
    { moves: 30, colours: 5, goal: { kittens: 4, down: 2 },
      map: ['.K.KK.K.', '.t.tt.t.', '........', 'tt....tt', '...cc...', '........', '.bbbbbb.', '........'] },
    { moves: 35, colours: 5, goal: { down: 2, kittens: 6 },
      map: ['c..KK..c', '.tbbbbt.', '.b.kk.b.', '.bt..tb.', '.b.kk.b.', '.tbbbbt.', '........', '........'] }
  ];
  /* the heap's shape over the 8 columns, and how big it is, level by level */
  var SHAPES = {
    mound: [1, 2, 3, 4, 4, 3, 2, 1], wide: [2, 2, 3, 3, 3, 3, 2, 2], twin: [3, 4, 2, 1, 1, 2, 4, 3],
    left: [5, 4, 3, 3, 2, 1, 1, 1], right: [1, 1, 1, 2, 3, 3, 4, 5], shaft: [0, 1, 3, 6, 6, 3, 1, 0], edges: [4, 3, 1, 0, 0, 1, 3, 4]
  };
  var HEAPS = ['mound', 'wide', 'twin', 'mound', 'left', 'shaft', 'right', 'wide', 'mound', 'twin',
    'edges', 'shaft', 'left', 'mound', 'right', 'shaft', 'mound', 'wide', 'edges', 'mound',
    'left', 'shaft', 'twin', 'right', 'mound', 'edges', 'wide', 'shaft', 'twin', 'mound'];
  function heap(shape, total) {
    var s = SHAPES[shape], sum = s.reduce(function (a, b) { return a + b; }, 0), out = s.map(function (v) { return Math.floor(v * total / sum); });
    var left = total - out.reduce(function (a, b) { return a + b; }, 0), order = s.map(function (v, i) { return i; }).sort(function (a, b) { return s[b] - s[a]; });
    for (var i = 0; left > 0; i++, left--) out[order[i % order.length]]++;
    return out.map(function (v) { return Math.min(v, 8); });
  }
  L.forEach(function (lv, i) {
    lv.n = i + 1;
    if (!lv.pile) lv.pile = heap(HEAPS[i], Math.round(8 + i * 0.75));
    lv.peril = PERILS[i % PERILS.length];
    lv.cat = { name: CATS[i][0], preset: CATS[i][1] };
  });
  window.RescueLevels = L;
})();
