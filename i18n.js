/* VOI-Initiatives — lightweight client-side i18n.
 * Source HTML is Dutch (nl). Default display language = English (en).
 * Translates by dictionary lookup on text nodes + key attributes, keeping the
 * original NL as the source-of-truth so switching is instant and reversible.
 * Dictionary lives in window.VOI_I18N (loaded from /i18n-dict.js).
 *
 * Add to any page with ONE tag in <head>:
 *   <script src="/i18n-dict.js"></script>
 *   <script src="/i18n.js"></script>
 */
(function () {
  var LANGS = { en: "EN", fr: "FR", nl: "NL" };
  var NAMES = { en: "English", fr: "Français", nl: "Nederlands" };
  var DEFAULT_LANG = (function(){try{var b=(navigator.language||"nl").slice(0,2);return {en:1,fr:1,nl:1}[b]?b:"nl";}catch(err){return "nl";}})();
  var STORAGE_KEY = "voi_lang";

  // ---- FOUC guard: hide body until first translation (with hard failsafe) ----
  var style = document.createElement("style");
  style.textContent =
    "html.voi-i18n-pending body{opacity:0!important}" +
    ".voi-lang{position:relative;display:inline-flex;margin-left:16px;vertical-align:middle;font-family:inherit}" +
    ".voi-lang-btn{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;" +
    "font:600 12px/1 inherit;letter-spacing:.04em;color:rgba(140,140,140,.95);" +
    "padding:7px 10px;border-radius:9px;transition:.15s}" +
    ".voi-lang-btn:hover{color:#E2572B;background:rgba(140,140,140,.14)}" +
    ".voi-lang-btn svg{opacity:.85}" +
    ".voi-lang-chev{transition:transform .15s}" +
    ".voi-lang.open .voi-lang-chev{transform:rotate(180deg)}" +
    ".voi-lang-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:156px;" +
    "background:#15151b;border:1px solid rgba(255,255,255,.12);border-radius:12px;" +
    "padding:6px;box-shadow:0 12px 34px rgba(0,0,0,.45);display:none;z-index:1000}" +
    ".voi-lang.open .voi-lang-menu{display:block}" +
    ".voi-lang-menu button{all:unset;cursor:pointer;display:flex;align-items:center;gap:10px;" +
    "box-sizing:border-box;width:100%;font:500 13px/1 inherit;color:rgba(255,255,255,.72);" +
    "padding:9px 10px;border-radius:8px;transition:.12s}" +
    ".voi-lang-menu button:hover{background:rgba(255,255,255,.07);color:#fff}" +
    ".voi-lang-menu button[aria-current=true]{color:#E2572B;font-weight:700}" +
    ".voi-lang-code{opacity:.5;font-size:11px;letter-spacing:.05em;min-width:20px}" +
    ".voi-lang-menu button[aria-current=true] .voi-lang-code{opacity:.9}" +
    ".nav-drawer .voi-lang{display:block;margin:16px 0 0}" +
    ".nav-drawer .voi-lang-menu{right:auto;left:0}";
  (document.head || document.documentElement).appendChild(style);
  document.documentElement.classList.add("voi-i18n-pending");
  function reveal() { document.documentElement.classList.remove("voi-i18n-pending"); }
  setTimeout(reveal, 1500); // never stay hidden, even if JS errors below

  function currentLang() {
    try {
      var u = new URLSearchParams(location.search).get("lang");
      if (u && LANGS[u]) { localStorage.setItem(STORAGE_KEY, u); return u; }
      var s = localStorage.getItem(STORAGE_KEY);
      if (s && LANGS[s]) return s;
    } catch (e) {}
    return DEFAULT_LANG;
  }

  // Keep the original NL text per node/attr so re-switching is lossless.
  var textOrig = new WeakMap();
  var attrOrig = new WeakMap(); // node -> {attr: original}
  var ATTRS = ["placeholder", "aria-label", "title", "alt", "content", "value"];

  function lookup(dict, nl, lang) {
    var e = dict[nl];
    return e && e[lang] ? e[lang] : null;
  }

  function applyText(dict, lang) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n, nodes = [];
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      if (!textOrig.has(node)) {
        if (!node.nodeValue || !node.nodeValue.trim()) return;
        textOrig.set(node, node.nodeValue);
      }
      var orig = textOrig.get(node);
      var key = orig.trim();
      if (lang === "nl") { node.nodeValue = orig; return; }
      var t = lookup(dict, key, lang);
      node.nodeValue = t ? orig.replace(key, t) : orig; // fallback: keep NL
    });
  }

  function applyAttrs(dict, lang) {
    var els = document.querySelectorAll(
      "[placeholder],[aria-label],[title],[alt],meta[name=description]"
    );
    els.forEach(function (el) {
      var store = attrOrig.get(el) || {};
      ATTRS.forEach(function (a) {
        if (!el.hasAttribute(a)) return;
        if (!(a in store)) store[a] = el.getAttribute(a);
        var orig = store[a];
        if (!orig || !orig.trim()) return;
        if (lang === "nl") { el.setAttribute(a, orig); return; }
        var t = lookup(dict, orig.trim(), lang);
        if (t) el.setAttribute(a, t);
      });
      attrOrig.set(el, store);
    });
  }

  function applyTitle(dict, lang) {
    var el = document.querySelector("title");
    if (!el) return;
    if (!attrOrig.get(el)) attrOrig.set(el, { _t: el.textContent });
    var orig = attrOrig.get(el)._t;
    var t = lang === "nl" ? orig : lookup(dict, orig.trim(), lang);
    el.textContent = t || orig;
  }

  var activeLang = DEFAULT_LANG;
  var retoken;

  function translate(lang) {
    var dict = window.VOI_I18N || {};
    activeLang = lang;
    document.documentElement.setAttribute("lang", lang);
    applyText(dict, lang);
    applyAttrs(dict, lang);
    applyTitle(dict, lang);
    updateSwitcher(lang);
  }

  // Re-translate content that JS injects after first paint (animated chat demos,
  // lazy sections, etc.). Debounced; observes only added nodes, so it never loops
  // on our own text edits.
  function scheduleRetranslate() {
    if (retoken) return;
    retoken = setTimeout(function () {
      retoken = null;
      var dict = window.VOI_I18N || {};
      applyText(dict, activeLang);
      applyAttrs(dict, activeLang);
    }, 120);
  }

  function startObserver() {
    if (!window.MutationObserver || !document.body) return;
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) { scheduleRetranslate(); return; }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ---- language switcher (globe dropdown) injected into header + drawer ----
  var GLOBE = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<circle cx="8" cy="8" r="6.3" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M8 1.7c1.8 1.7 2.8 3.9 2.8 6.3S9.8 12.6 8 14.3M8 1.7C6.2 3.4 5.2 5.6 5.2 8S6.2 12.6 8 14.3M1.9 8h12.2" ' +
    'stroke="currentColor" stroke-width="1.1"/></svg>';
  var CHEV = '<svg class="voi-lang-chev" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">' +
    '<path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function closeMenu(wrap) {
    wrap.classList.remove("open");
    var b = wrap.querySelector(".voi-lang-btn");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  function buildSwitcher() {
    var wrap = document.createElement("span");
    wrap.className = "voi-lang";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "voi-lang-btn";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Change language");
    btn.innerHTML = GLOBE + '<span class="voi-lang-cur">EN</span>' + CHEV;
    var menu = document.createElement("div");
    menu.className = "voi-lang-menu";
    menu.setAttribute("role", "menu");
    Object.keys(LANGS).forEach(function (code) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.dataset.lang = code;
      b.innerHTML = '<span class="voi-lang-code">' + LANGS[code] + "</span>" + NAMES[code];
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        setLang(code);
        closeMenu(wrap);
      });
      menu.appendChild(b);
    });
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var willOpen = !wrap.classList.contains("open");
      document.querySelectorAll(".voi-lang.open").forEach(closeMenu);
      if (willOpen) { wrap.classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
    });
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    return wrap;
  }

  function mountSwitchers() {
    var hosts = [];
    var navLinks = document.querySelector("nav .nav-links");
    if (navLinks) hosts.push(navLinks);
    var drawer = document.querySelector(".nav-drawer");
    if (drawer) hosts.push(drawer);
    if (!hosts.length) {
      var nav = document.querySelector("header nav") || document.querySelector("header");
      if (nav) hosts.push(nav);
    }
    hosts.forEach(function (h) {
      if (h.querySelector(".voi-lang")) return;
      h.appendChild(buildSwitcher());
    });
  }

  function updateSwitcher(lang) {
    document.querySelectorAll(".voi-lang-cur").forEach(function (s) {
      s.textContent = LANGS[lang] || lang.toUpperCase();
    });
    document.querySelectorAll(".voi-lang-menu button").forEach(function (b) {
      b.setAttribute("aria-current", b.dataset.lang === lang ? "true" : "false");
    });
  }

  function setLang(lang) {
    if (!LANGS[lang]) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    translate(lang);
  }

  function init() {
    try {
      mountSwitchers();
      // close any open dropdown on outside-click or Escape
      document.addEventListener("click", function () {
        document.querySelectorAll(".voi-lang.open").forEach(closeMenu);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") document.querySelectorAll(".voi-lang.open").forEach(closeMenu);
      });
      translate(currentLang());
      startObserver();
    } catch (e) {
      // On any failure, fall back to readable NL source.
      document.documentElement.setAttribute("lang", "nl");
    } finally {
      reveal();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // expose for debugging / programmatic switch
  window.voiSetLang = setLang;
})();
