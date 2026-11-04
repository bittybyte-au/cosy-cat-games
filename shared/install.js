/* Cosy Cat Games: "Put it on your home screen" helper.
   - Android / desktop Chrome and Edge: a real Install button (the browser's own prompt).
   - iPhone / iPad: Apple has no install button, so we show short picture steps.
   - Inside Facebook / Instagram / email app browsers: explain how to open it in Safari or Chrome first.
   - Hidden when the games were opened from the home screen already.
   Use: GGInstall.banner(el)  (closable, remembers being closed on this device)
        GGInstall.button(el)  (always shown, for the FAQ)                       */
(function () {
  var KEY = 'cosyCatInstall.v1';
  var deferred = null;
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|GSA\/|; wv\)/.test(ua);
  var listeners = [];

  function installed() {
    try { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
    catch (e) { return false; }
  }
  function dismissed() { try { return localStorage.getItem(KEY) === 'closed'; } catch (e) { return false; } }
  function dismiss() { try { localStorage.setItem(KEY, 'closed'); } catch (e) {} }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    listeners.forEach(function (f) { f(); });
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    document.querySelectorAll('.gg-install').forEach(function (el) { el.hidden = true; });
  });

  var CSS = '.gg-install{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#FFF8EC;border:3px solid #2A2340;border-radius:22px;box-shadow:0 4px 0 #2A2340;padding:10px 12px 10px 14px;font:800 1rem Nunito,ui-rounded,system-ui,sans-serif;color:#2A2340}' +
    '.gg-install .gi-text{flex:1 1 180px;min-width:0}' +
    '.gg-install .gi-btn,.gg-ig .gi-btn{min-height:48px;padding:0 20px;border-radius:999px;border:3px solid #2A2340;background:#7BD389;color:#2A2340;font:800 1rem Nunito,ui-rounded,system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 0 #2A2340}' +
    '.gg-install .gi-btn:active,.gg-ig .gi-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #2A2340}' +
    '.gg-install .gi-x{width:44px;height:44px;border-radius:50%;border:3px solid #2A2340;background:#fff;font:800 1.1rem/1 Nunito,system-ui,sans-serif;color:#2A2340;cursor:pointer;flex:none}' +
    '.gg-install button:focus-visible,.gg-ig button:focus-visible{outline:4px solid #FFC93C;outline-offset:3px}' +
    '.gg-ig-back{position:fixed;inset:0;z-index:60;background:rgba(42,35,64,.55);display:grid;place-items:center;padding:16px;overflow-y:auto}' +
    '.gg-ig{width:min(460px,100%);background:#FFF8EC;border:4px solid #2A2340;border-radius:28px;box-shadow:0 8px 0 #2A2340;padding:20px;display:flex;flex-direction:column;gap:14px;font:700 1.05rem/1.4 Nunito,ui-rounded,system-ui,sans-serif;color:#2A2340}' +
    '.gg-ig h2{margin:0;text-align:center;font:800 1.7rem/1.1 "Baloo 2",ui-rounded,system-ui,sans-serif}' +
    '.gg-ig ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px;counter-reset:s}' +
    '.gg-ig li{display:flex;align-items:center;gap:12px;background:#fff;border:3px solid #2A2340;border-radius:18px;padding:10px 12px;counter-increment:s}' +
    '.gg-ig li::before{content:counter(s);flex:none;width:34px;height:34px;border-radius:50%;background:#FFC93C;border:3px solid #2A2340;display:grid;place-items:center;font:800 1.1rem/1 Nunito,system-ui,sans-serif}' +
    '.gg-ig li svg{flex:none;width:40px;height:40px}' +
    '.gg-ig .gi-note{margin:0;font-size:.95rem;color:#5E5675;text-align:center}' +
    '.gg-ig .gi-row{display:flex;justify-content:center}';
  var TEXT = 'Keep your progress and avatar safe: make Cosy Cat Games an app on your home screen.';
  var styled = false;
  function style() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

  var ICON_SHARE = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="15" width="22" height="20" rx="4" fill="#fff" stroke="#2F7DF6" stroke-width="3"/><rect x="15" y="12" width="10" height="6" fill="#fff"/><path d="M20 24 V5 M13 11 L20 4 L27 11" fill="none" stroke="#2F7DF6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_DOTS = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#2A2340" stroke-width="3"/><g fill="#2A2340"><circle cx="12" cy="20" r="3"/><circle cx="20" cy="20" r="3"/><circle cx="28" cy="20" r="3"/></g></svg>';
  var ICON_VDOTS = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#2A2340" stroke-width="3"/><g fill="#2A2340"><circle cx="20" cy="12" r="3"/><circle cx="20" cy="20" r="3"/><circle cx="20" cy="28" r="3"/></g></svg>';
  var ICON_ADD = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="6" width="28" height="28" rx="7" fill="#fff" stroke="#2A2340" stroke-width="3"/><path d="M20 13 V27 M13 20 H27" stroke="#2A2340" stroke-width="3.5" stroke-linecap="round"/></svg>';
  var ICON_CAT = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 17 L7 5 L17 11 Z M32 17 L33 5 L23 11 Z" fill="#FFC93C" stroke="#2A2340" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="20" cy="23" rx="14" ry="12" fill="#FFC93C" stroke="#2A2340" stroke-width="2.5"/><path d="M14 22 Q16 19.5 18 22 M22 22 Q24 19.5 26 22" fill="none" stroke="#2A2340" stroke-width="2" stroke-linecap="round"/><path d="M17 27 Q20 30 23 27" fill="none" stroke="#2A2340" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_COMPASS = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#fff" stroke="#2F7DF6" stroke-width="3"/><path d="M26 14 L22 22 L14 26 L18 18 Z" fill="#FF5A5F" stroke="#2A2340" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  function steps() {
    if (inApp) return {
      title: 'Open it in your browser first',
      list: [[ICON_DOTS, 'Tap the <b>•••</b> or <b>share</b> menu in this app.'],
             [ICON_COMPASS, 'Choose <b>Open in Safari</b> or <b>Open in Chrome</b>.'],
             [ICON_ADD, 'Then tap <b>Put it on my home screen</b> again.']],
      note: 'Apps like Facebook, Instagram and email open links in their own little browser, which can’t add to the home screen.'
    };
    if (isIOS) return {
      title: 'Add to your home screen',
      list: [[ICON_SHARE, 'Tap the <b>Share</b> button. On newer iPhones it’s inside the <b>•••</b> menu at the bottom.'],
             [ICON_ADD, 'Scroll down and tap <b>Add to Home Screen</b>.'],
             [ICON_CAT, 'Tap <b>Add</b>. The cat icon appears on your home screen.']],
      note: 'It then opens full screen like an app, works offline, and your progress is kept safe. (Safari can clear saved games after a week away; the app doesn\u2019t.)'
    };
    if (isAndroid) return {
      title: 'Add to your home screen',
      list: [[ICON_VDOTS, 'Tap the <b>⋮</b> menu at the top of Chrome.'],
             [ICON_ADD, 'Tap <b>Add to home screen</b> or <b>Install app</b>.'],
             [ICON_CAT, 'Tap <b>Install</b> or <b>Add</b>. The cat icon appears on your home screen.']],
      note: 'It then opens full screen like an app, and works offline.'
    };
    return {
      title: 'Install on this computer',
      list: [[ICON_VDOTS, 'Open your browser’s menu (⋮ or •••).'],
             [ICON_ADD, 'Choose <b>Install Cosy Cat Games</b> or <b>Add to Dock</b>.'],
             [ICON_CAT, 'It opens in its own window and works offline.']],
      note: 'Chrome, Edge and Safari can do this. Firefox on a computer can’t.'
    };
  }

  function showGuide() {
    style();
    var s = steps();
    var back = document.createElement('div');
    back.className = 'gg-ig-back';
    back.innerHTML = '<div class="gg-ig" role="dialog" aria-modal="true" aria-labelledby="ggIgTitle"><h2 id="ggIgTitle">' + s.title + '</h2><ol>' +
      s.list.map(function (r) { return '<li>' + r[0] + '<span>' + r[1] + '</span></li>'; }).join('') +
      '</ol><p class="gi-note">' + s.note + '</p><div class="gi-row"><button class="gi-btn" type="button">Got it</button></div></div>';
    document.body.appendChild(back);
    var btn = back.querySelector('button');
    function close() { back.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    btn.addEventListener('click', close);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', key);
    setTimeout(function () { btn.focus(); }, 30);
  }

  function go() {
    if (deferred && !inApp) {
      var d = deferred; deferred = null;
      d.prompt();
      if (d.userChoice) d.userChoice.then(function () {}, function () {});
    } else showGuide();
  }

  function build(el, closable) {
    if (!el || installed()) { if (el) el.hidden = true; return; }
    if (closable && dismissed()) { el.hidden = true; return; }
    style();
    el.classList.add('gg-install');
    el.hidden = false;
    function draw() {
      el.innerHTML = '<span class="gi-text">' + TEXT + '</span>' +
        '<button class="gi-btn" type="button">' + (deferred && !inApp ? 'Make it an app' : 'Show me how') + '</button>' +
        (closable ? '<button class="gi-x" type="button" aria-label="Close">✕</button>' : '');
      el.querySelector('.gi-btn').addEventListener('click', go);
      var x = el.querySelector('.gi-x');
      if (x) x.addEventListener('click', function () { dismiss(); el.hidden = true; });
    }
    draw();
    listeners.push(draw);
  }

  window.GGInstall = {
    installed: installed,
    banner: function (el) { build(el, true); },
    button: function (el) { build(el, false); },
    guide: showGuide
  };
})();
