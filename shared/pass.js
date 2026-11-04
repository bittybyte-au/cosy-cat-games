/* Cosy Cat Games – the one-year pass, on this device.
   Remembers this device's pass (a sign-in token and the end date) in browser storage, checks in with
   the server now and then, and shows a friendly padlock screen for locked games.
   If the pass is switched off (or the server isn't set up yet) everything stays unlocked. */
(function () {
  var KEY = 'cosyCatPass.v1';
  var script = document.currentScript;
  var ROOT = script && script.src ? new URL('../', script.src) : new URL('/', location.href);
  var API = new URL('api/', ROOT).href;
  var UNLOCK = new URL('unlock/index.html', ROOT).href;

  /* What's free without a pass, by game folder name. A list means only those items; a number means
     levels up to that number. Any game not listed here (including new ones) is fully locked. */
  var FREE = { 'cooking': ['handroll'], 'kitty-pop': 3 };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function randomId() {
    var a = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'[b & 63]; }).join('');
  }
  var s = load();
  if (!s.device) { s.device = randomId(); save(); }

  function deviceName() {
    var ua = navigator.userAgent || '';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
    if (/CrOS/.test(ua)) return 'Chromebook';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows computer';
    return 'Computer';
  }

  function activePass() { return !!s.pass && (s.pass.never || s.pass.expiresAt > Date.now()); }
  function state() {
    var required = !!s.required;
    return {
      required: required,
      signedIn: !!s.token,
      active: activePass(),
      unlocked: !required || (!!s.token && activePass()),
      pass: s.pass || null,
      price: s.price || '$5.99',
      deviceLimit: s.deviceLimit || 6
    };
  }

  function api(path, body) {
    return fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'server_error' }; });
    });
  }

  /* checks the switch and this device's pass; safe to call on every page load */
  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = api('config').then(function (c) {
      if (c && typeof c.passRequired === 'boolean') { s.required = c.passRequired; if (c.price) s.price = c.price; if (c.deviceLimit) s.deviceLimit = c.deviceLimit; }
      if (!s.token) return;
      return api('status', { token: s.token }).then(function (st) {
        if (st && st.ok && st.signedIn === false) { delete s.token; delete s.pass; }
        else if (st && st.ok && st.pass) s.pass = st.pass;
      });
    }).catch(function () { /* offline or no server: keep what we knew */ })
      .then(function () { s.checkedAt = Date.now(); save(); refreshing = null; return state(); });
    return refreshing;
  }

  function setPass(token, pass) { s.token = token; s.pass = pass; save(); }
  function signOut() { delete s.token; delete s.pass; save(); }
  function setRequest(id) { if (id) s.request = { id: id, at: Date.now() }; else delete s.request; save(); }

  /* ---- the padlock screen used by games ---- */
  function lockScreen(opts) {
    opts = opts || {};
    var old = document.getElementById('ggLock'); if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'ggLock';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ggLockTitle');
    el.innerHTML =
      '<style>' +
      '#ggLock{position:fixed;inset:0;z-index:50;background:rgba(42,35,64,.6);display:grid;place-items:center;padding:16px;font-family:"Nunito",ui-rounded,system-ui,sans-serif;color:#2A2340}' +
      '#ggLock .card{width:min(440px,100%);background:#FFF8EC;border:4px solid #2A2340;border-radius:28px;box-shadow:0 8px 0 #2A2340;padding:22px;text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center}' +
      '#ggLock h2{margin:0;font:800 1.8rem/1.1 "Baloo 2",ui-rounded,system-ui,sans-serif}' +
      '#ggLock p{margin:0;font-weight:700;font-size:1.05rem}' +
      '#ggLock .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}' +
      '#ggLock a,#ggLock button{min-height:56px;padding:0 22px;border-radius:999px;border:3px solid #2A2340;box-shadow:0 4px 0 #2A2340;font:800 1.1rem "Nunito",system-ui,sans-serif;color:#2A2340;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer;background:#fff}' +
      '#ggLock .go{background:#7BD389}' +
      '</style>' +
      '<div class="card">' +
      '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="18" y="40" width="60" height="46" rx="12" fill="#FFC93C" stroke="#2A2340" stroke-width="5"/><path d="M30 40 V30 a18 18 0 0 1 36 0 V40" fill="none" stroke="#2A2340" stroke-width="7" stroke-linecap="round"/><circle cx="48" cy="60" r="6" fill="#2A2340"/><rect x="45" y="62" width="6" height="12" rx="3" fill="#2A2340"/></svg>' +
      '<h2 id="ggLockTitle"></h2><p class="msg"></p>' +
      '<div class="row"><button type="button" class="back"></button><a class="go" href="' + UNLOCK + '">Ask a grown-up</a></div>' +
      '</div>';
    el.querySelector('h2').textContent = opts.title || 'This one needs a pass';
    el.querySelector('.msg').textContent = opts.text || 'A grown-up can unlock every game for a year.';
    var back = el.querySelector('.back');
    back.textContent = opts.backLabel || 'Back';
    back.addEventListener('click', function () { el.remove(); if (opts.onBack) opts.onBack(); });
    document.body.appendChild(el);
    el.querySelector('.go').focus();
    return el;
  }

  /* every game page: if this whole game is locked, cover it with the padlock screen */
  var m = location.pathname.match(/\/games\/([^\/]+)\//);
  var GAME = m ? m[1] : null;
  function guardGame() {
    if (!GAME || FREE[GAME] !== undefined) return;
    if (state().unlocked) { var l = document.getElementById('ggLock'); if (l && l.dataset.whole) l.remove(); return; }
    if (document.getElementById('ggLock')) return;
    var el = lockScreen({ title: 'This game needs a pass', text: 'A grown-up can unlock every game for a year.', backLabel: 'Home', onBack: function () { location.href = new URL('play/index.html', ROOT).href; } });
    el.dataset.whole = '1';
  }

  window.GGPass = {
    FREE: FREE,
    state: state,
    refresh: refresh,
    api: api,
    setPass: setPass,
    signOut: signOut,
    setRequest: setRequest,
    request: function () { return s.request && Date.now() - s.request.at < 24 * 3600 * 1000 ? s.request.id : null; },
    device: s.device,
    deviceName: deviceName,
    unlockURL: UNLOCK,
    token: function () { return s.token || null; },
    lockScreen: lockScreen,
    /* is this level / recipe playable right now? */
    game: GAME,
    guardGame: guardGame,
    allows: function (game, what) {
      var st = state();
      if (st.unlocked) return true;
      var f = FREE[game];
      if (Array.isArray(f)) return f.indexOf(what) >= 0;
      if (typeof f === 'number') return what <= f;
      return false;
    }
  };

  // check straight away from what this device remembers, then again once the server has answered
  function onReady() { guardGame(); refresh().then(function () { guardGame(); window.dispatchEvent(new CustomEvent('ggpass', { detail: state() })); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
})();
