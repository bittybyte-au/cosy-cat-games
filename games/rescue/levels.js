/* Cat Rescue: the 30 rescues. Each is a map (8 rows of 8, top row first), the goal, the moves, the scene and its cat.
   Map: '.' piece, '#' no cell, 'b' box, 'B' taped box (two hits), 'k' box with a kitten, 'K' taped box with a kitten,
   't' piece wrapped in yarn, 'c' a kitten on a cushion (bring it down to the bottom), 'r' a rescue part.
   goal: kittens (freed from boxes), boxes (broken, kitten boxes count too), yarn (untangled), down (cushion kittens).
   job: the rescue built step by step in the scene: { scene, part (the board tile: 'rung' | 'plank' | 'cushion' |
   'balloon'), n (how many parts finish it), keep (how many are on the board at once while more are needed) }.
   It's a goal too: the level is won when the rescue is built and the other goals are done.
   PROTOTYPE: only rescue 1 has a job so far (the tree and the ladder); the rest still use the old scenes.
   colours: how many kinds of piece (4 is gentle, 5 normal, 6 tricky). tip: a line shown at the start.
   Moves were tuned by playing every level with a greedy bot (see the notes in the commit). */
(function () {
  var CATS = [
    ['Mochi', 'ginger'], ['Pip', 'white'], ['Biscuit', 'purple'], ['Tofu', 'blue'], ['Pumpkin', 'pink'],
    ['Bean', 'black'], ['Noodle', 'ginger'], ['Pickle', 'blue'], ['Muffin', 'pink'], ['Clover', 'white'],
    ['Sesame', 'black'], ['Juniper', 'purple'], ['Waffle', 'ginger'], ['Pebble', 'white'], ['Olive', 'pink'],
    ['Ziggy', 'blue'], ['Marmalade', 'ginger'], ['Dumpling', 'purple'], ['Fig', 'black'], ['Socks', 'white'],
    ['Poppy', 'pink'], ['Maple', 'ginger'], ['Toast', 'blue'], ['Nutmeg', 'purple'], ['Luna', 'black'],
    ['Pudding', 'white'], ['Basil', 'ginger'], ['Crumpet', 'pink'], ['Miso', 'blue'], ['Button', 'purple']
  ];
  var L = [
    { moves: 15, colours: 5, goal: {}, job: { scene: 'tree', part: 'rung', n: 6, keep: 2 },
      map: ['........', '........', '........', '........', '........', '........', '........', '........'] },
    { moves: 16, colours: 5, goal: { kittens: 4 }, tip: 'Line up four to make zoomies. Swap it to clear a whole line!',
      map: ['........', '........', '.bbbbbb.', '.k.bb.k.', '..bbbb..', '...kk...', '........', '........'] },
    { moves: 16, colours: 5, goal: { boxes: 16, kittens: 2 }, tip: 'Make an L or a T shape for catnip: it clears all round it.',
      map: ['........', '........', '.bbbbbb.', '.bk..kb.', '.bb..bb.', '..bbbb..', '........', '........'] },
    { moves: 22, colours: 5, goal: { kittens: 4 }, tip: 'Taped boxes need two matches.',
      map: ['........', '........', '..B..B..', '..K..K..', '........', '.B.BB.B.', '.K....K.', '........'] },
    { moves: 23, colours: 5, goal: { boxes: 20, kittens: 3 }, tip: 'Five in a row makes rainbow yarn. Swap it with a piece to clear every piece of that kind.',
      map: ['........', '........', '.BBBBBB.', '.b.kk.b.', '.bbbbbb.', '........', '.bbkbbb.', '........'] },

    { moves: 18, colours: 5, goal: { yarn: 10, kittens: 2 }, tip: 'Yarn holds a piece still. Match that piece to untangle it.',
      map: ['........', '........', '.t.tt.t.', '........', 't.tkkt.t', '........', '..t..t..', '........'] },
    { moves: 21, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['........', '........', 'tttttttt', '........', '..bkkb..', '..b..b..', '.k.tt.k.', '........'] },
    { moves: 23, colours: 5, goal: { kittens: 6 },
      map: ['........', '........', '.tttttt.', '.tkkkkt.', '.tbKKbt.', '.tttttt.', '........', '........'] },
    { moves: 18, colours: 5, goal: { down: 1 }, tip: 'Clear the pieces under the cushion to bring the kitten down to the bottom.',
      map: ['...c....', '........', '........', '...b....', '........', '...b....', '........', '........'] },
    { moves: 27, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['.c....c.', '........', '.b....b.', '...kk...', '........', '...bb...', '........', '........'] },

    { moves: 17, colours: 5, goal: { kittens: 6 },
      map: ['#......#', '........', '.bb..bb.', '.bk..kb.', '.BB..BB.', '..kKKk..', '...bb...', '#......#'] },
    { moves: 21, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['........', '........', '.t.tt.t.', '.K.bb.K.', '...bb...', '.t.KK.t.', '.t....t.', '........'] },
    { moves: 25, colours: 5, goal: { down: 2 },
      map: ['..c..c..', '........', '........', 'bbB..Bbb', '........', '..t..t..', '........', '........'] },
    { moves: 20, colours: 5, goal: { yarn: 16, kittens: 2 },
      map: ['........', '.t.t.t.t', 't.t.t.t.', '...KK...', 't.t.t.t.', '.t.t.t.t', '........', '........'] },
    { moves: 24, colours: 5, goal: { kittens: 4 },
      map: ['........', '........', '.BBBBBB.', '.BkKKkB.', '.BBBBBB.', '........', '........', '........'] },

    { moves: 17, colours: 5, goal: { kittens: 6 },
      map: ['###..###', '##....##', '#.KbbK.#', '..BkkB..', '..bBBb..', '#.K..K.#', '##....##', '###..###'] },
    { moves: 24, colours: 5, goal: { down: 2 },
      map: ['...cc...', '........', '...tt...', '..b..b..', '...tt...', '........', '...tt...', '........'] },
    { moves: 16, colours: 5, goal: { kittens: 6 },
      map: ['.B....B.', '.K.tt.K.', '.B....B.', '...KK...', '.t....t.', '..BBBB..', '..BkkB..', '........'] },
    { moves: 28, colours: 5, goal: { down: 2, boxes: 8 },
      map: ['c......c', '........', 'bbbbbbbb', '........', '.tttttt.', '........', '........', '........'] },
    { moves: 28, colours: 6, goal: { kittens: 4 },
      map: ['........', '.K....K.', '..tttt..', '........', '..B..B..', '.BKBBKB.', '........', '........'] },

    { moves: 22, colours: 5, goal: { boxes: 22, kittens: 3 },
      map: ['#......#', '.bbbbbb.', '.bkBBkb.', '.bbkbbb.', '.BB..BB.', '...tt...', '..t..t..', '#......#'] },
    { moves: 28, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['.c....c.', '........', '.B....B.', '.B.tt.B.', '........', '...KK...', '.t....t.', '........'] },
    { moves: 15, colours: 5, goal: { kittens: 6 },
      map: ['t......t', '.t.KK.t.', '..tBBt..', '.K.tt.K.', '..tBBt..', '.t.KK.t.', 't......t', '........'] },
    { moves: 22, colours: 6, goal: { kittens: 6 },
      map: ['........', '..K..K..', '........', '.B.BB.B.', '..B..B..', '.kK..Kk.', '...BB...', '........'] },
    { moves: 16, colours: 5, goal: { down: 1, kittens: 2 },
      map: ['...c....', '..k.k...', '...t....', '.b.B.b..', '...t....', '..b.b...', '...B....', '........'] },

    { moves: 34, colours: 5, goal: { down: 2, kittens: 4 },
      map: ['#..cc..#', '..BBBB..', '.tk..kt.', '.t.KK.t.', '..bbbb..', '........', '...tt...', '#......#'] },
    { moves: 20, colours: 5, goal: { kittens: 6 },
      map: ['........', 'bKbbbbKb', 'b.tttt.b', 'b.t..t.b', 'b.tkkt.b', 'b......b', 'bK....Kb', 'bbbbbbbb'] },
    { moves: 34, colours: 5, goal: { down: 4 },
      map: ['c.c..c.c', '........', '........', '.bbbbbb.', '........', '..t..t..', '........', '........'] },
    { moves: 24, colours: 5, goal: { kittens: 4, down: 2 },
      map: ['.K.KK.K.', '.t.tt.t.', '........', 'tt....tt', '...cc...', '........', '.bbbbbb.', '........'] },
    { moves: 30, colours: 5, goal: { down: 2, kittens: 6 },
      map: ['c..KK..c', '.tbbbbt.', '.b.kk.b.', '.bt..tb.', '.b.kk.b.', '.tbbbbt.', '........', '........'] }
  ];
  var OLD = ['bath', 'rain', 'tide', 'laundry'];
  L.forEach(function (lv, i) {
    lv.n = i + 1;
    lv.peril = lv.job ? lv.job.scene : OLD[i % OLD.length];
    lv.cat = { name: CATS[i][0], preset: CATS[i][1] };
  });
  window.RescueLevels = L;
})();
