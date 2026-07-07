/* VO-Initiatives — chat-first dashboard.
   Het gesprek met de agent is het hoofdscherm (feed = geschiedenis + proactieve
   berichten). Zijrail: plan (trappen -> €2.250 = Onbeperkt), workflows met
   activatie via Stripe, verbindingen (IMAP/ICS/API-key, one-way), doel. */
(function () {
  "use strict";

  var main = document.getElementById("dashMain");
  if (!main) return;

  var loading = document.getElementById("dashLoading");
  var missing = document.getElementById("dashMissing");

  var t = function (id, fallback) {
    var el = document.getElementById(id);
    return el ? el.textContent : fallback;
  };
  var tHtml = function (id, fallback) {
    var el = document.getElementById(id);
    return el ? el.innerHTML : fallback;
  };
  var show = function (el) { el.hidden = false; };
  var hide = function (el) { el.hidden = true; };

  var token = (new URLSearchParams(location.search).get("id") || "").trim();
  var hasUrlToken = /^[0-9a-f]{32}$/.test(token);
  var feedCount = 0;
  var chatBusy = false;

  /* ---------- laden ---------- */
  var loadDashboard = function () {
    return fetch("/api/dashboard" + (hasUrlToken ? "?id=" + token : ""), { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (rec) {
        if (!rec || !rec.ok) return Promise.reject();
        token = rec.token || token;
        render(rec);
        return loadFeed().then(function () {
          hide(loading); hide(document.getElementById("dashLogin")); show(main);
          startFeedPoll();
        });
      });
  };

  var loadFeed = function () {
    return fetch("/api/dashboard/feed?id=" + token, { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) return;
        renderFeed(j.feed || []);
        if (j.wf) renderPlanAndFlows(j.wf);
      }).catch(function () {});
  };

  loadDashboard().catch(function () {
    hide(loading);
    if (hasUrlToken) { show(missing); return; }
    initLogin();
  });

  /* ---------- login (e-mailcode) ---------- */
  function initLogin() {
    var loginBox = document.getElementById("dashLogin");
    show(loginBox);
    var emailForm = document.getElementById("loginEmailForm");
    var codeForm = document.getElementById("loginCodeForm");
    var emailVal = "";
    emailForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      emailVal = emailForm.email.value.trim();
      var btn = emailForm.querySelector("button");
      btn.disabled = true;
      fetch("/api/dashboard/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailVal })
      }).finally(function () {
        btn.disabled = false;
        hide(emailForm); show(codeForm);
        codeForm.code.focus();
      });
    });
    codeForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var err = document.getElementById("loginCodeErr");
      err.hidden = true;
      var btn = codeForm.querySelector("button");
      btn.disabled = true;
      fetch("/api/dashboard/login/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: emailVal, code: codeForm.code.value.trim() })
      })
        .then(function (r) { return r.json(); })
        .then(function (jr) {
          if (jr && jr.ok) { show(loading); hide(loginBox); return loadDashboard(); }
          err.textContent = (jr && jr.error) || "Code ongeldig of verlopen.";
          err.hidden = false;
        })
        .catch(function () { err.textContent = "Even niet bereikbaar — probeer opnieuw."; err.hidden = false; })
        .finally(function () { btn.disabled = false; });
    });
  }

  /* ---------- chat/feed ---------- */
  var log = document.getElementById("agentLog");

  function msgEl(role, text) {
    var m = document.createElement("div");
    m.className = "msg " + (role === "user" ? "user" : "agent");
    m.textContent = text;
    return m;
  }

  function renderFeed(items) {
    if (items.length === feedCount) return;
    var stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 60;
    log.innerHTML = "";
    items.forEach(function (e) { log.appendChild(msgEl(e.role, e.text)); });
    feedCount = items.length;
    if (stick || feedCount <= 3) log.scrollTop = log.scrollHeight;
  }

  var pollTimer = null;
  function startFeedPoll() {
    if (pollTimer) return;
    pollTimer = setInterval(function () { if (!chatBusy) loadFeed(); }, 12000);
  }

  var chatForm = document.getElementById("agentInput");
  var chatText = document.getElementById("agentText");
  chatForm.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var text = chatText.value.trim();
    if (!text || chatBusy) return;
    chatBusy = true;
    log.appendChild(msgEl("user", text));
    log.scrollTop = log.scrollHeight;
    chatText.value = "";
    var typing = document.createElement("div");
    typing.className = "msg agent typing";
    typing.innerHTML = "<i></i><i></i><i></i>";
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;
    fetch("/api/dashboard/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: token, message: text })
    })
      .then(function (r) { return r.json(); })
      .then(function (jr) {
        typing.remove();
        if (jr && jr.ok && jr.reply) log.appendChild(msgEl("agent", jr.reply));
        else log.appendChild(msgEl("agent", (jr && jr.error) || t("tAgentErr", "Even niet bereikbaar — probeer zo opnieuw.")));
        log.scrollTop = log.scrollHeight;
        feedCount += 2;
      })
      .catch(function () { typing.remove(); log.appendChild(msgEl("agent", t("tAgentErr", "Even niet bereikbaar."))); })
      .finally(function () { chatBusy = false; chatText.focus(); });
  });
  chatText.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); chatForm.requestSubmit(); }
  });

  /* ---------- plan + workflows ---------- */
  function renderPlanAndFlows(wf) {
    var pct = Math.min(100, Math.round(100 * (wf.totaal || 0) / (wf.cap || 2250)));
    document.getElementById("planBar").style.width = pct + "%";
    var note = document.getElementById("planNote");
    if (wf.onbeperkt) {
      note.textContent = t("tUnlimited", "VOI Onbeperkt.");
      document.getElementById("dashPlanBadge").textContent = "VOI Onbeperkt";
    } else {
      note.textContent = t("tPlanNote", "€{x} van €2.250/m").replace("{x}", wf.totaal || 0);
    }

    var host = document.getElementById("flowList");
    host.innerHTML = "";
    (wf.items || []).forEach(function (item) {
      var row = document.createElement("div");
      row.className = "flow-row";
      var dot = document.createElement("span");
      dot.className = "flow-dot" + (item.status === "actief" ? " on" : "");
      var label = document.createElement("span");
      label.className = "flow-name";
      label.textContent = item.name;
      row.appendChild(dot); row.appendChild(label);

      if (item.status === "actief") {
        var okChip = document.createElement("span");
        okChip.className = "conn-ok";
        okChip.textContent = t("tActive", "Actief");
        row.appendChild(okChip);
      } else {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-secondary conn-btn";
        btn.textContent = t("tActivate", "Activeer") + " · €" + item.price + t("tPerMonth", "/m");
        btn.addEventListener("click", function () { activate(item, btn); });
        row.appendChild(btn);
      }
      host.appendChild(row);
    });
  }

  function activate(item, btn) {
    btn.disabled = true;
    fetch("/api/dashboard/activate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: token, idx: item.idx })
    })
      .then(function (r) { return r.json(); })
      .then(function (jr) {
        if (jr && jr.ok && jr.payment_url) {
          window.open(jr.payment_url, "_blank", "noopener");
          log.appendChild(msgEl("agent", t("tPayOpened", 'Betaalpagina geopend voor "{w}".').replace("{w}", item.name)));
          log.scrollTop = log.scrollHeight;
          feedCount += 1;
        } else if (jr && jr.ok) {
          loadFeed();
        }
      })
      .catch(function () {})
      .finally(function () { btn.disabled = false; });
  }

  /* ---------- verbindingen (wizards) ---------- */
  function connTypeFor(tool) {
    var s = tool.toLowerCase();
    if (/agenda|calendar|cal\.com/.test(s)) return { type: "ics", help: "tHelpIcs" };
    if (/gmail|google mail|^google$/.test(s)) return { type: "imap", help: "tHelpGmail" };
    if (/outlook|hotmail|office/.test(s)) return { type: "imap", help: "tHelpOutlook" };
    return { type: "apikey", help: "tHelpApikey" };
  }

  function field(labelText, name, type, placeholder) {
    var label = document.createElement("label");
    label.className = "of-field";
    var span = document.createElement("span");
    span.textContent = labelText;
    var input = document.createElement("input");
    input.type = type; input.name = name; input.required = true;
    input.autocomplete = "off";
    if (placeholder) input.placeholder = placeholder;
    label.appendChild(span); label.appendChild(input);
    return label;
  }

  function buildWizard(tool, markConnected) {
    var kind = connTypeFor(tool);
    var wiz = document.createElement("form");
    wiz.className = "conn-wizard";
    var help = document.createElement("p");
    help.className = "conn-help";
    help.innerHTML = tHtml(kind.help, "");
    wiz.appendChild(help);
    if (kind.type === "imap") {
      wiz.appendChild(field(t("tFldEmail", "E-mailadres"), "email", "email"));
      wiz.appendChild(field(t("tFldAppPw", "App-wachtwoord"), "password", "password", "xxxx xxxx xxxx xxxx"));
    } else if (kind.type === "ics") {
      wiz.appendChild(field(t("tFldIcs", "Geheime iCal/ICS-link"), "url", "url"));
    } else {
      wiz.appendChild(field(t("tFldApikey", "API-key"), "apikey", "password"));
    }
    var err = document.createElement("p");
    err.className = "of-error"; err.hidden = true;
    wiz.appendChild(err);
    var submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "btn btn-primary conn-submit";
    submit.textContent = t("tTestLink", "Test & koppel");
    wiz.appendChild(submit);

    wiz.addEventListener("submit", function (ev) {
      ev.preventDefault();
      err.hidden = true;
      var payload = { id: token, tool: tool };
      wiz.querySelectorAll("input").forEach(function (i) { payload[i.name] = i.value.trim(); });
      submit.disabled = true;
      submit.textContent = t("tTesting", "Testen…");
      fetch("/api/dashboard/connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) { wiz.remove(); markConnected(); loadFeed(); }
          else {
            if (j && j.code === "app_password") err.innerHTML = tHtml("tErrAppPw", t("tConnErr", ""));
            else err.textContent = (j && j.error) || t("tConnErr", "Koppelen lukte niet — probeer opnieuw.");
            err.hidden = false;
          }
        })
        .catch(function () { err.textContent = t("tConnErr", "Koppelen lukte niet."); err.hidden = false; })
        .finally(function () { submit.disabled = false; submit.textContent = t("tTestLink", "Test & koppel"); });
    });
    return wiz;
  }

  /* ---------- render ---------- */
  function render(rec) {
    var naam = (rec.profile && rec.profile.naam ? rec.profile.naam.split(/\s+/)[0] : "");
    var hello = t("tHello", "Welkom");
    document.getElementById("dashGreet").textContent = naam ? hello + ", " + naam : hello;

    var prov = rec.provision || {};
    document.getElementById("agentStatus").textContent =
      prov.active ? t("tAgentLive", "Live") : t("tConcierge", "In opbouw");

    if (rec.wf) renderPlanAndFlows(rec.wf);

    var statusMap = rec.connections_status || {};
    var connHost = document.getElementById("connList");
    connHost.innerHTML = "";
    var conns = (rec.connections && rec.connections.length) ? rec.connections : ["Gmail"];
    conns.slice(0, 12).forEach(function (name) {
      var row = document.createElement("div");
      row.className = "conn-row";
      var left = document.createElement("span");
      left.className = "conn-name";
      left.textContent = name;
      row.appendChild(left);
      var setConnected = function () {
        row.querySelectorAll(".conn-btn,.conn-ok").forEach(function (e) { e.remove(); });
        var okChip = document.createElement("span");
        okChip.className = "conn-ok";
        okChip.textContent = t("tConnected", "Verbonden");
        row.appendChild(okChip);
      };
      if (statusMap[name] === "verbonden") {
        setConnected();
      } else {
        var btn = document.createElement("button");
        btn.className = "btn btn-secondary conn-btn";
        btn.type = "button";
        btn.textContent = t("tLink", "Koppel");
        btn.addEventListener("click", function () {
          var open = connHost.querySelector(".conn-wizard");
          if (open) open.remove();
          var wiz = buildWizard(name, setConnected);
          row.insertAdjacentElement("afterend", wiz);
          wiz.querySelector("input").focus();
        });
        row.appendChild(btn);
      }
      connHost.appendChild(row);
    });

    if (rec.doel && rec.doel.trim()) {
      document.getElementById("goalText").textContent = rec.doel;
      show(document.getElementById("goalCard"));
    }
  }
})();
