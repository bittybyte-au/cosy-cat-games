/* Cat Rescue: the 30 rescues. Each is a map (8 rows of 8, top row first), the goal, the moves, the peril and its cat.
   Map: '.' piece, '#' no cell, 'b' box, 'B' taped box (two hits), 'k' box with a kitten, 'K' taped box with a kitten,
   't' piece wrapped in yarn, 'c' a kitten on a cushion (bring it down to the bottom).
   goal: kittens (freed from boxes), boxes (broken, kitten boxes count too), yarn (untangled), down (cushion kittens).
   colours: how many kinds of piece (4 is gentle, 5 normal, 6 tricky). tip: a line shown at the start.
   wall: each brick's strength along the top of the board; set below, so every rescue has a wall: plain bricks
   first, then some taped bricks that need two hits. Each brick knocked out is a gap the peril's filling pours in
   through. fill: how much filling waits behind the wall (set below, 8 rising to 24); draining all of it out of the
   bottom of the board is part of every rescue's goal.
   Moves were tuned by playing every level with a greedy bot (see the notes in the commit), and retuned when the
   filling started pouring into the board, so each level's bot win rate stayed about the same. */
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
    { moves: 23, colours: 5, goal: { kittens: 4 }, tip: 'Match three next to a box to break it open.',
      map: ['........', '........', '........', '.bbbbbb.', '.bk..kb.', '........', '..bkkb..', '........'] },
    { moves: 19, colours: 5, goal: { kittens: 4 }, tip: 'Line up four to make zoomies. Swap it to clear a whole line!',
      map: ['........', '........', '.bbbbbb.', '.k.bb.k.', '..bbbb..', '...kk...', '........', '........'] },
    { moves: 17, colours: 5, goal: { boxes: 16, kittens: 2 }, tip: 'Make an L or a T shape for catnip: it clears all round it.',
      map: ['........', '........', '.bbbbbb.', '.bk..kb.', '.bb..bb.', '..bbbb..', '........', '........'] },
    { moves: 23, colours: 5, goal: { kittens: 4 }, tip: 'Taped boxes need two matches.',
      map: ['........', '........', '..B..B..', '..K..K..', '........', '.B.BB.B.', '.K....K.', '........'] },
    { moves: 24, colours: 5, goal: { boxes: 20, kittens: 3 }, tip: 'Five in a row makes rainbow yarn. Swap it with a piece to clear every piece of that kind.',
      map: ['........', '........', '.BBBBBB.', '.b.kk.b.', '.bbbbbb.', '........', '.bbkbbb.', '........'] },

    { moves: 17, colours: 5, goal: { yarn: 10, kittens: 2 }, tip: 'Yarn holds a piece still. Match that piece to untangle it.',
      map: ['........', '........', '.t.tt.t.', '........', 't.tkkt.t', '........', '..t..t..', '........'] },
    { moves: 21, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['........', '........', 'tttttttt', '........', '..bkkb..', '..b..b..', '.k.tt.k.', '........'] },
    { moves: 38, colours: 5, goal: { kittens: 6 },
      map: ['........', '........', '.tttttt.', '.tkkkkt.', '.tbKKbt.', '.tttttt.', '........', '........'] },
    { moves: 30, colours: 5, goal: { down: 1 }, tip: 'Clear the pieces under the cushion to bring the kitten down to the bottom.',
      map: ['...c....', '........', '........', '...b....', '........', '...b....', '........', '........'] },
    { moves: 35, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['.c....c.', '........', '.b....b.', '...kk...', '........', '...bb...', '........', '........'] },

    { moves: 27, colours: 5, goal: { kittens: 6 },
      map: ['#......#', '........', '.bb..bb.', '.bk..kb.', '.BB..BB.', '..kKKk..', '...bb...', '#......#'] },
    { moves: 26, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['........', '........', '.t.tt.t.', '.K.bb.K.', '...bb...', '.t.KK.t.', '.t....t.', '........'] },
    { moves: 25, colours: 5, goal: { down: 2 },
      map: ['..c..c..', '........', '........', 'bbB..Bbb', '........', '..t..t..', '........', '........'] },
    { moves: 21, colours: 5, goal: { yarn: 16, kittens: 2 },
      map: ['........', '.t.t.t.t', 't.t.t.t.', '...KK...', 't.t.t.t.', '.t.t.t.t', '........', '........'] },
    { moves: 30, colours: 5, goal: { kittens: 4 },
      map: ['........', '........', '.BBBBBB.', '.BkKKkB.', '.BBBBBB.', '........', '........', '........'] },

    { moves: 23, colours: 5, goal: { kittens: 6 },
      map: ['###..###', '##....##', '#.KbbK.#', '..BkkB..', '..bBBb..', '#.K..K.#', '##....##', '###..###'] },
    { moves: 32, colours: 5, goal: { down: 2 },
      map: ['...cc...', '........', '...tt...', '..b..b..', '...tt...', '........', '...tt...', '........'] },
    { moves: 22, colours: 5, goal: { kittens: 6 },
      map: ['.B....B.', '.K.tt.K.', '.B....B.', '...KK...', '.t....t.', '..BBBB..', '..BkkB..', '........'] },
    { moves: 27, colours: 5, goal: { down: 2, boxes: 8 },
      map: ['c......c', '........', 'bbbbbbbb', '........', '.tttttt.', '........', '........', '........'] },
    { moves: 33, colours: 6, goal: { kittens: 4 },
      map: ['........', '.K....K.', '..tttt..', '........', '..B..B..', '.BKBBKB.', '........', '........'] },

    { moves: 26, colours: 5, goal: { boxes: 22, kittens: 3 },
      map: ['#......#', '.bbbbbb.', '.bkBBkb.', '.bbkbbb.', '.BB..BB.', '...tt...', '..t..t..', '#......#'] },
    { moves: 29, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['.c....c.', '........', '.B....B.', '.B.tt.B.', '........', '...KK...', '.t....t.', '........'] },
    { moves: 21, colours: 5, goal: { kittens: 6 },
      map: ['t......t', '.t.KK.t.', '..tBBt..', '.K.tt.K.', '..tBBt..', '.t.KK.t.', 't......t', '........'] },
    { moves: 23, colours: 6, goal: { kittens: 6 },
      map: ['........', '..K..K..', '........', '.B.BB.B.', '..B..B..', '.kK..Kk.', '...BB...', '........'] },
    { moves: 22, colours: 5, goal: { down: 1, kittens: 2 },
      map: ['...c....', '..k.k...', '...t....', '.b.B.b..', '...t....', '..b.b...', '...B....', '........'] },

    { moves: 42, colours: 5, goal: { down: 2, kittens: 4 },
      map: ['#..cc..#', '..BBBB..', '.tk..kt.', '.t.KK.t.', '..bbbb..', '........', '...tt...', '#......#'] },
    { moves: 22, colours: 5, goal: { kittens: 6 },
      map: ['........', 'bKbbbbKb', 'b.tttt.b', 'b.t..t.b', 'b.tkkt.b', 'b......b', 'bK....Kb', 'bbbbbbbb'] },
    { moves: 40, colours: 5, goal: { down: 4 },
      map: ['c.c..c.c', '........', '........', '.bbbbbb.', '........', '..t..t..', '........', '........'] },
    { moves: 27, colours: 5, goal: { kittens: 4, down: 2 },
      map: ['.K.KK.K.', '.t.tt.t.', '........', 'tt....tt', '...cc...', '........', '.bbbbbb.', '........'] },
    { moves: 31, colours: 5, goal: { down: 2, kittens: 6 },
      map: ['c..KK..c', '.tbbbbt.', '.b.kk.b.', '.bt..tb.', '.b.kk.b.', '.tbbbbt.', '........', '........'] }
  ];
  /* the wall along the top of the board: bricks of strength 1, with some taped (strength 2) on later rescues */
  var TAPED = [[], [2, 5], [1, 3, 4, 6]];
  function wall(n) { var t = TAPED[n <= 10 ? 0 : n <= 20 ? 1 : 2], w = [1, 1, 1, 1, 1, 1, 1, 1]; t.forEach(function (c) { w[c] = 2; }); return w; }
  /* how much filling waits behind the wall: from 8 on the first rescue to 24 on the last */
  function fill(n) { return Math.round(8 + (n - 1) * 16 / 29); }
  L.forEach(function (lv, i) {
    lv.n = i + 1;
    if (!lv.wall) lv.wall = wall(i + 1);
    if (!lv.fill) lv.fill = fill(i + 1);
    lv.peril = PERILS[i % PERILS.length];
    lv.cat = { name: CATS[i][0], preset: CATS[i][1] };
  });
  window.RescueLevels = L;
})();
