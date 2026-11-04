/* Game Garden – player profiles and progress, saved on this device only.
   Everything lives in one localStorage key. Nothing is sent anywhere. */
(function () {
  var KEY = 'gameGarden.v1';

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
      return d;
    } catch (e) { return blank(); }
  }

  var data = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  var AVATARS = ['cat', 'bunny', 'bear', 'frog', 'panda', 'fox'];
  var COLORS = ['#FF6B57', '#3FA7F5', '#FFC93C', '#7BD389', '#FF7EB6', '#9B7BFF'];

  /* Simple flat animal faces drawn as SVG. */
  function avatarSVG(kind, color, size) {
    size = size || 64;
    var ink = '#2A2340';
    var face = { cat: '#FFE9C9', bunny: '#FFFFFF', bear: '#C98B5B', frog: '#7BD389', panda: '#FFFFFF', fox: '#FF9A4D' }[kind] || '#FFE9C9';
    var ears = '';
    if (kind === 'cat' || kind === 'fox') ears = '<path d="M18 30 L22 8 L36 22 Z M82 30 L78 8 L64 22 Z" fill="' + face + '" stroke="' + ink + '" stroke-width="4" stroke-linejoin="round"/>';
    if (kind === 'bunny') ears = '<ellipse cx="35" cy="16" rx="9" ry="20" fill="' + face + '" stroke="' + ink + '" stroke-width="4"/><ellipse cx="65" cy="16" rx="9" ry="20" fill="' + face + '" stroke="' + ink + '" stroke-width="4"/><ellipse cx="35" cy="17" rx="4" ry="12" fill="#FFB3C7"/><ellipse cx="65" cy="17" rx="4" ry="12" fill="#FFB3C7"/>';
    if (kind === 'bear') ears = '<circle cx="24" cy="24" r="12" fill="' + face + '" stroke="' + ink + '" stroke-width="4"/><circle cx="76" cy="24" r="12" fill="' + face + '" stroke="' + ink + '" stroke-width="4"/>';
    if (kind === 'panda') ears = '<circle cx="24" cy="24" r="12" fill="' + ink + '"/><circle cx="76" cy="24" r="12" fill="' + ink + '"/>';
    if (kind === 'frog') ears = '<circle cx="32" cy="26" r="14" fill="' + face + '" stroke="' + ink + '" stroke-width="4"/><circle cx="68" cy="26" r="14" fill="' + face + '" stroke="' + ink + '" stroke-width="4"/>';
    var extras = '';
    if (kind === 'panda') extras = '<ellipse cx="37" cy="54" rx="9" ry="11" fill="' + ink + '" transform="rotate(-20 37 54)"/><ellipse cx="63" cy="54" rx="9" ry="11" fill="' + ink + '" transform="rotate(20 63 54)"/>';
    if (kind === 'fox') extras = '<path d="M30 70 Q50 92 70 70 Q50 78 30 70 Z" fill="#FFF3E6"/>';
    var eyeY = kind === 'frog' ? 27 : 55;
    var eyeDX = kind === 'frog' ? 18 : 13;
    var eyeFill = kind === 'panda' ? '#FFFFFF' : ink;
    return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="49" fill="' + color + '"/>' + ears +
      '<ellipse cx="50" cy="60" rx="36" ry="32" fill="' + face + '" stroke="' + ink + '" stroke-width="4"/>' + extras +
      '<circle cx="' + (50 - eyeDX) + '" cy="' + eyeY + '" r="4.5" fill="' + eyeFill + '"/><circle cx="' + (50 + eyeDX) + '" cy="' + eyeY + '" r="4.5" fill="' + eyeFill + '"/>' +
      '<ellipse cx="30" cy="68" rx="6" ry="3.5" fill="#FF8FAB" opacity=".7"/><ellipse cx="70" cy="68" rx="6" ry="3.5" fill="#FF8FAB" opacity=".7"/>' +
      '<path d="M44 66 Q47 70 50 66 Q53 70 56 66" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>' +
      '</svg>';
  }

  window.GG = {
    AVATARS: AVATARS,
    COLORS: COLORS,
    avatarSVG: avatarSVG,
    players: function () { return data.players.slice(); },
    current: function () {
      for (var i = 0; i < data.players.length; i++) if (data.players[i].id === data.current) return data.players[i];
      return null;
    },
    setCurrent: function (id) { data.current = id; save(); },
    addPlayer: function (name, avatar, color) {
      var p = { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: String(name).slice(0, 16), avatar: avatar, color: color };
      data.players.push(p);
      data.current = p.id;
      save();
      return p;
    },
    removePlayer: function (id) {
      data.players = data.players.filter(function (p) { return p.id !== id; });
      delete data.progress[id];
      if (data.current === id) data.current = data.players.length ? data.players[0].id : null;
      save();
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
