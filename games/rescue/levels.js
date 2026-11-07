/* Cat Rescue: the 30 rescues. Each is a map (8 rows of 8, top row first), the goal, the moves, the peril and its cat.
   Map: '.' piece, '#' no cell, 'b' box, 'B' taped box (two hits), 'k' box with a kitten, 'K' taped box with a kitten,
   't' piece wrapped in yarn, 'c' a kitten on a cushion (bring it down to the bottom), 'o' an open cell: a hole cut
   in the board at the start, under the peril's heap, for the player to dig down into a channel.
   goal: kittens (freed from boxes), boxes (broken, kitten boxes count too), yarn (untangled), down (cushion kittens);
   pouring all of the heap out through the bottom of the board is always part of the goal too.
   heap: how much of the heap is there at the start (enough to fill the starting holes and a bit over); src: how much
   more falls in from the top of the scene, feed of it after each move.
   The openings were picked by playing each level with the bot from a few places (the edge of the board, or the
   middle, never leaving a strip one or two cells wide beside them) and a few depths.
   colours: how many kinds of piece (4 is gentle, 5 normal, 6 tricky). tip: a line shown at the start.
   Moves were tuned by playing every level with a greedy bot (see the notes in the commit), and retuned when the
   heap came in, so each level's bot win rate stayed about what it was first tuned to. */
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
    { moves: 31, heap: 4, src: 4, feed: 1, colours: 5, goal: { kittens: 4 }, tip: 'Match three next to a box to break it open.',
      map: ['oo......', '........', '........', '.bbbbbb.', '.bk..kb.', '........', '..bkkb..', '........'] },
    { moves: 38, heap: 4, src: 5, feed: 1, colours: 5, goal: { kittens: 4 }, tip: 'Line up four to make zoomies. Swap it to clear a whole line!',
      map: ['oo......', 'oo......', '.bbbbbb.', '.k.bb.k.', '..bbbb..', '...kk...', '........', '........'] },
    { moves: 35, heap: 7, src: 3, feed: 1, colours: 5, goal: { boxes: 16, kittens: 2 }, tip: 'Make an L or a T shape for catnip: it clears all round it.',
      map: ['oo......', 'oo......', '.bbbbbb.', '.bk..kb.', '.bb..bb.', '..bbbb..', '........', '........'] },
    { moves: 39, heap: 7, src: 3, feed: 1, colours: 5, goal: { kittens: 4 }, tip: 'Taped boxes need two matches.',
      map: ['oo......', 'oo......', '..B..B..', '..K..K..', '........', '.B.BB.B.', '.K....K.', '........'] },
    { moves: 43, heap: 6, src: 5, feed: 1, colours: 5, goal: { boxes: 20, kittens: 3 }, tip: 'Five in a row makes rainbow yarn. Swap it with a piece to clear every piece of that kind.',
      map: ['o.......', 'o.......', 'oBBBBBB.', '.b.kk.b.', '.bbbbbb.', '........', '.bbkbbb.', '........'] },

    { moves: 25, heap: 8, src: 4, feed: 1, colours: 5, goal: { yarn: 10, kittens: 2 }, tip: 'Yarn holds a piece still. Match that piece to untangle it.',
      map: ['oo......', 'oo......', 'ot.tt.t.', '........', 't.tkkt.t', '........', '..t..t..', '........'] },
    { moves: 31, heap: 7, src: 6, feed: 1, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['oo......', 'oo......', 'tttttttt', '........', '..bkkb..', '..b..b..', '.k.tt.k.', '........'] },
    { moves: 51, heap: 6, src: 5, feed: 1, colours: 5, goal: { kittens: 6 },
      map: ['o.......', 'o.......', 'otttttt.', '.tkkkkt.', '.tbKKbt.', '.tttttt.', '........', '........'] },
    { moves: 27, heap: 10, src: 4, feed: 1, colours: 5, goal: { down: 1 }, tip: 'Clear the pieces under the cushion to bring the kitten down to the bottom.',
      map: ['oo.c....', 'oo......', 'oo......', '...b....', '........', '...b....', '........', '........'] },
    { moves: 32, heap: 7, src: 8, feed: 1, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['oc....c.', 'o.......', 'ob....b.', '...kk...', '........', '...bb...', '........', '........'] },

    { moves: 33, heap: 9, src: 7, feed: 1, colours: 5, goal: { kittens: 6 },
      map: ['#o.....#', 'oo......', 'obb..bb.', 'obk..kb.', '.BB..BB.', '..kKKk..', '...bb...', '#......#'] },
    { moves: 36, heap: 6, src: 10, feed: 1, colours: 5, goal: { kittens: 4, yarn: 8 },
      map: ['oo......', '........', '.t.tt.t.', '.K.bb.K.', '...bb...', '.t.KK.t.', '.t....t.', '........'] },
    { moves: 30, heap: 10, src: 7, feed: 2, colours: 5, goal: { down: 2 },
      map: ['ooc..c..', 'oo......', 'oo......', 'bbB..Bbb', '........', '..t..t..', '........', '........'] },
    { moves: 26, heap: 8, src: 10, feed: 2, colours: 5, goal: { yarn: 16, kittens: 2 },
      map: ['oo......', 'ot.t.t.t', 't.t.t.t.', '...KK...', 't.t.t.t.', '.t.t.t.t', '........', '........'] },
    { moves: 37, heap: 9, src: 6, feed: 2, colours: 5, goal: { kittens: 4 },
      map: ['oo......', 'oo......', 'oBBBBBB.', '.BkKKkB.', '.BBBBBB.', '........', '........', '........'] },

    { moves: 19, heap: 8, src: 8, feed: 2, colours: 5, goal: { kittens: 6 },
      map: ['###..###', '##....##', '#oKbbK.#', 'ooBkkB..', 'o.bBBb..', '#.K..K.#', '##....##', '###..###'] },
    { moves: 35, heap: 11, src: 9, feed: 2, colours: 5, goal: { down: 2 },
      map: ['oo.cc...', 'oo......', 'oo.tt...', '..b..b..', '...tt...', '........', '...tt...', '........'] },
    { moves: 37, heap: 6, src: 15, feed: 2, colours: 5, goal: { kittens: 6 },
      map: ['oB....B.', '.K.tt.K.', '.B....B.', '...KK...', '.t....t.', '..BBBB..', '..BkkB..', '........'] },
    { moves: 56, heap: 8, src: 14, feed: 2, colours: 5, goal: { down: 2, boxes: 8 },
      map: ['c..o...c', '...o....', 'bbbbbbbb', '........', '.tttttt.', '........', '........', '........'] },
    { moves: 50, heap: 8, src: 14, feed: 2, colours: 6, goal: { kittens: 4 },
      map: ['oo......', '.K....K.', '..tttt..', '........', '..B..B..', '.BKBBKB.', '........', '........'] },

    { moves: 30, heap: 9, src: 14, feed: 2, colours: 5, goal: { boxes: 22, kittens: 3 },
      map: ['#o.....#', 'obbbbbb.', 'obkBBkb.', '.bbkbbb.', '.BB..BB.', '...tt...', '..t..t..', '#......#'] },
    { moves: 34, heap: 7, src: 17, feed: 2, colours: 5, goal: { down: 2, kittens: 2 },
      map: ['oc....c.', '........', '.B....B.', '.B.tt.B.', '........', '...KK...', '.t....t.', '........'] },
    { moves: 37, heap: 7, src: 18, feed: 2, colours: 5, goal: { kittens: 6 },
      map: ['t..o...t', '.t.KK.t.', '..tBBt..', '.K.tt.K.', '..tBBt..', '.t.KK.t.', 't......t', '........'] },
    { moves: 56, heap: 7, src: 18, feed: 2, colours: 6, goal: { kittens: 6 },
      map: ['...o....', '..K..K..', '........', '.B.BB.B.', '..B..B..', '.kK..Kk.', '...BB...', '........'] },
    { moves: 30, heap: 9, src: 17, feed: 2, colours: 5, goal: { down: 1, kittens: 2 },
      map: ['oo.c....', '..k.k...', '...t....', '.b.B.b..', '...t....', '..b.b...', '...B....', '........'] },

    { moves: 41, heap: 6, src: 13, feed: 2, colours: 5, goal: { down: 2, kittens: 4 },
      map: ['#..cc..#', 'o.BBBB..', '.tk..kt.', '.t.KK.t.', '..bbbb..', '........', '...tt...', '#......#'] },
    { moves: 32, heap: 9, src: 19, feed: 2, colours: 5, goal: { kittens: 6 },
      map: ['oo......', 'bK....Kb', 'b.tttt.b', 'b.t..t.b', 'b.tkkt.b', 'b......b', 'bK....Kb', 'bbbbbbbb'] },
    { moves: 74, heap: 8, src: 12, feed: 2, colours: 5, goal: { down: 4 },
      map: ['c.co.c.c', '...o....', '...o....', '.bbbbbb.', '........', '........', '........', '........'] },
    { moves: 41, heap: 10, src: 19, feed: 2, colours: 5, goal: { kittens: 4, down: 2 },
      map: ['oK.KK.K.', 'ot.tt.t.', 'o.......', 'tt....tt', '...cc...', '........', '.bbbbbb.', '........'] },
    { moves: 45, heap: 10, src: 20, feed: 2, colours: 5, goal: { down: 2, kittens: 6 },
      map: ['oc.KK..c', 'otbbbbt.', '.b.kk.b.', '.bt..tb.', '.b.kk.b.', '.tbbbbt.', '........', '........'] }
  ];
  L.forEach(function (lv, i) {
    lv.n = i + 1;
    lv.peril = PERILS[i % PERILS.length];
    lv.cat = { name: CATS[i][0], preset: CATS[i][1] };
  });
  window.RescueLevels = L;
})();
