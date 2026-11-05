/* Cosy Cat Games – the player and their progress, saved on this device only.
   One player per device. Everything lives in one localStorage key. Nothing is sent anywhere. */
(function () {
  var KEY = 'cosyCatGames.v1';

  function blank() { return { players: [], current: null, progress: {}, settings: { sound: true } }; }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var d = JSON.parse(raw);
      var b = blank();
      d.players = Array.isArray(d.players) ? d.players : b.players;
      d.progress = d.progress && typeof d.progress === 'object' ? d.progress : b.progress;
      d.settings = d.settings && typeof d.settings === 'object' ? d.settings : b.settings;
      // one player per device: keep the one used most recently (earlier versions allowed several)
      if (d.players.length > 1) {
        var keep = d.players.filter(function (p) { return p.id === d.current; })[0] || d.players[d.players.length - 1];
        d.players = [keep];
        var kept = {}; kept[keep.id] = d.progress[keep.id] || {}; d.progress = kept;
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
    getSetting: function (k, dflt) { return k in data.settings ? data.settings[k] : dflt; },
    setSetting: function (k, v) { data.settings[k] = v; save(); },
    reload: function () { data = load(); }
  };

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
