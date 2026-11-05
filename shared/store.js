/* Cosy Cat Games – the player and their progress, saved on this device only.
   One player per device. Everything lives in one localStorage key. Nothing is sent anywhere. */
(function () {
  var KEY = 'cosyCatGames.v1';

  function blank() { return { players: [], current: null, progress: {}, collection: {}, settings: { sound: true } }; }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var d = JSON.parse(raw);
      var b = blank();
      d.players = Array.isArray(d.players) ? d.players : b.players;
      d.progress = d.progress && typeof d.progress === 'object' ? d.progress : b.progress;
      d.settings = d.settings && typeof d.settings === 'object' ? d.settings : b.settings;
      d.collection = d.collection && typeof d.collection === 'object' ? d.collection : b.collection;
      // one player per device: keep the one used most recently (earlier versions allowed several)
      if (d.players.length > 1) {
        var keep = d.players.filter(function (p) { return p.id === d.current; })[0] || d.players[d.players.length - 1];
        d.players = [keep];
        var kept = {}; kept[keep.id] = d.progress[keep.id] || {}; d.progress = kept;
        var keptC = {}; keptC[keep.id] = d.collection[keep.id] || []; d.collection = keptC;
        try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, d, { current: keep.id }))); } catch (e) {}
      }
      d.current = d.players.length ? d.players[0].id : null;
      return d;
    } catch (e) { return blank(); }
  }

  var data = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  window.GG = {
    current: function () {
      for (var i = 0; i < data.players.length; i++) if (data.players[i].id === data.current) return data.players[i];
      return null;
    },
    /* makes this device's player (there is only ever one); anything played before keeps its progress */
    addPlayer: function (name, avatar, color) {
      if (data.players.length) return GG.updatePlayer(name, avatar, color);
      var p = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: String(name).slice(0, 16), avatar: avatar, color: color };
      data.players = [p];
      data.current = p.id;
      if (data.progress.guest) { data.progress[p.id] = data.progress.guest; delete data.progress.guest; }
      if (data.collection.guest) { data.collection[p.id] = data.collection.guest; delete data.collection.guest; }
      save();
      return p;
    },
    /* extra details kept with the player, e.g. which earned avatar items they've seen */
    setPlayerInfo: function (info) {
      var p = data.players[0]; if (!p) return;
      for (var k in info) if (k !== 'id') p[k] = info[k];
      save();
    },
    updatePlayer: function (name, avatar, color) {
      var p = data.players[0];
      if (!p) return null;
      if (name) p.name = String(name).slice(0, 16);
      if (avatar) p.avatar = avatar;
      if (color) p.color = color;
      save();
      return p;
    },
    /* Progress for one game, for the current player (or a guest object if nobody is chosen). */
    getProgress: function (game) {
      var id = data.current || 'guest';
      var all = data.progress[id] || {};
      return JSON.parse(JSON.stringify(all[game] || {}));
    },
    setProgress: function (game, value) {
      var id = data.current || 'guest';
      data.progress[id] = data.progress[id] || {};
      data.progress[id][game] = value;
      return save();
    },
    /* The player's collection: things made or earned in one game that other games can show
       (dishes from Cosy Kitchen in Cosy Home). Small JSON only, no pictures; at most 200 per player.
       collect(gameId, { type, id, data }) returns the new item's uid. */
    collect: function (gameId, item) {
      if (!item || typeof item !== 'object' || !item.type || !item.id) return null;
      var json = JSON.stringify(item.data || {});
      if (json.length > 8000) return null;
      var who = data.current || 'guest';
      var list = data.collection[who] = data.collection[who] || [];
      var uid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      list.push({ uid: uid, from: String(gameId), type: String(item.type), id: String(item.id), data: JSON.parse(json), at: Date.now() });
      if (list.length > 200) list.splice(0, list.length - 200);
      save();
      return uid;
    },
    /* everything collected, oldest first; filter matches on any fields, e.g. { type: 'dish' } */
    collection: function (filter) {
      var list = data.collection[data.current || 'guest'] || [];
      return JSON.parse(JSON.stringify(list.filter(function (it) {
        for (var k in (filter || {})) if (it[k] !== filter[k]) return false;
        return true;
      })));
    },
    uncollect: function (uid) {
      var who = data.current || 'guest', list = data.collection[who] || [];
      var n = list.length;
      data.collection[who] = list.filter(function (it) { return it.uid !== uid; });
      if (data.collection[who].length !== n) save();
    },
    getSetting: function (k, dflt) { return k in data.settings ? data.settings[k] : dflt; },
    setSetting: function (k, v) { data.settings[k] = v; save(); },
    reload: function () { data = load(); }
  };

  /* Visit counts (Vercel Web Analytics, from our host): no cookies and nothing that identifies anyone.
     Only on the live site, so test copies and previews aren't counted. */
  try {
    if (location.protocol === 'https:' && !/claude|localhost|vercel\.app$/.test(location.hostname)) {
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
      var va = document.createElement('script');
      va.defer = true; va.src = '/_vercel/insights/script.js';
      document.head.appendChild(va);
    }
  } catch (e) {}

  /* Games: iPhones and iPads ignore user-scalable=no, so a pinch zoomed the page in with no easy way back out.
     Stop pinch zoom on game pages (info pages can still be zoomed). Double-tap zoom is stopped in game.css. */
  try {
    var noZoom = function (e) { if (document.body && document.body.classList.contains('game')) e.preventDefault(); };
    ['gesturestart', 'gesturechange'].forEach(function (t) { document.addEventListener(t, noZoom, { passive: false }); });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) noZoom(e); }, { passive: false });
  } catch (e) {}

  /* Ask the browser not to clear our saved data when space is low (granted quietly to home screen apps). */
  try {
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (standalone && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  } catch (e) {}

  /* Offline support: harmless if service workers are unavailable. */
  try {
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude/.test(location.hostname)) {
      var root = document.currentScript && document.currentScript.src ? new URL('../', document.currentScript.src) : new URL('/', location.href);
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(new URL('sw.js', root).href, { scope: root.pathname }).catch(function () {});
      });
    }
  } catch (e) {}
})();
