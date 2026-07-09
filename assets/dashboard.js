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
  var feedSig = "";
  var feedBusy = false;
  var chatBusy = false;
  var revealBusy = false;
  var focusIdx = null;
  var focusName = "";

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

  var refreshDash = function () {
    return fetch("/api/dashboard?id=" + token, { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (rec) { if (rec && rec.ok) render(rec); return rec; })
      .catch(function () {});
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

  var URL_RE = /(https?:\/\/[^\s]+|mailto:[^\s]+)/g;

  function msgEl(role, text) {
    var m = document.createElement("div");
    m.className = "msg " + (role === "user" ? "user" : "agent");
    if (role === "user") { m.textContent = text; return m; }
    // defensief: oude feed-berichten van vóór de server-side markdown-strip
    text = String(text).replace(/\*\*/g, "").replace(/^#{1,4}\s*/gm, "");
    // agent-berichten: URL's en mailto's klikbaar maken (rest blijft platte tekst)
    String(text).split(URL_RE).forEach(function (part) {
      if (/^(https?:\/\/|mailto:)/.test(part)) {
        var a = document.createElement("a");
        a.href = part;
        a.textContent = part.length > 64 ? part.slice(0, 61) + "…" : part;
        a.target = "_blank"; a.rel = "noopener";
        m.appendChild(a);
      } else if (part) {
        m.appendChild(document.createTextNode(part));
      }
    });
    return m;
  }

  /* werkregels: het zichtbare logboek van wat de agent doet.
     kind="werk", state "bezig" (pulserende dot) of "klaar" (vinkje). */
  var WERK_ICON = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M4.2 7.3l1.9 1.9 3.7-4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function werkEl(e) {
    var d = document.createElement("div");
    d.className = "werk" + (e.state === "bezig" ? " bezig" : "");
    var ic = document.createElement("span");
    ic.className = "werk-ic";
    if (e.state === "bezig") {
      var dot = document.createElement("i");
      dot.className = "werk-dot";
      ic.appendChild(dot);
    } else {
      ic.innerHTML = WERK_ICON;
    }
    var tx = document.createElement("span");
    tx.textContent = e.text;
    d.appendChild(ic); d.appendChild(tx);
    return d;
  }

  function feedSignature(items) {
    var last = items[items.length - 1] || {};
    return (focusIdx || "") + "§" + items.length + "|" + (last.ts || "") + "|" + (last.state || "") + "|" + String(last.text || "").length;
  }

  function renderFeed(items) {
    // tijdens een streaming-reveal de log niet herbouwen — anders knippert het antwoord weg
    if (revealBusy) return;
    var sig = feedSignature(items);
    if (sig === feedSig) return;
    var stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 60;
    var view = items;
    if (focusIdx !== null) {
      // focus: alleen entries van deze workflow + de laatste 2 algemene berichten
      var general = items.filter(function (e) { return e.wf == null; }).slice(-2);
      view = items.filter(function (e) {
        return String(e.wf) === String(focusIdx) || general.indexOf(e) !== -1;
      });
    }
    log.innerHTML = "";
    var i = 0;
    while (i < view.length) {
      var e = view[i];
      if ((e.kind || "text") === "werk") {
        if (e.state === "bezig") { log.appendChild(werkEl(e)); i++; continue; }
        var run = [];
        while (i < view.length && (view[i].kind || "text") === "werk" && view[i].state !== "bezig") {
          run.push(view[i]); i++;
        }
        if (run.length >= 3) {
          // 3+ afgeronde stappen: eerdere inklappen, laatste zichtbaar houden
          var det = document.createElement("details");
          det.className = "werk-group";
          var sum = document.createElement("summary");
          var ind = document.createElement("span");
          ind.className = "ind";
          var st = document.createElement("span");
          st.textContent = t("tWerkGroup", "Agent werkte — {n} stappen").replace("{n}", run.length - 1);
          sum.appendChild(ind); sum.appendChild(st);
          det.appendChild(sum);
          run.slice(0, -1).forEach(function (w) { det.appendChild(werkEl(w)); });
          log.appendChild(det);
          log.appendChild(werkEl(run[run.length - 1]));
        } else {
          run.forEach(function (w) { log.appendChild(werkEl(w)); });
        }
        continue;
      }
      log.appendChild(msgEl(e.role, e.text));
      i++;
    }
    feedSig = sig;
    var last = items[items.length - 1] || {};
    feedBusy = last.kind === "werk" && last.state === "bezig";
    if (stick || view.length <= 3) log.scrollTop = log.scrollHeight;
  }

  /* ---------- workflow-focus: klik op een workflow = chatfilter + context ---------- */
  var focusBar = document.getElementById("focusBar");
  var focusLabel = document.getElementById("focusLabel");

  function setFocus(idx, name) {
    focusIdx = idx;
    focusName = name || "";
    if (idx === null) {
      focusBar.hidden = true;
      if (chatText.dataset.ph0) chatText.placeholder = chatText.dataset.ph0;
    } else {
      focusLabel.textContent = t("tFocusOn", "Gefocust op '{w}'").replace("{w}", focusName);
      focusBar.hidden = false;
      if (!chatText.dataset.ph0) chatText.dataset.ph0 = chatText.placeholder;
      chatText.placeholder = t("tFocusPh", "Over '{w}': typ je bericht…").replace("{w}", focusName);
    }
    feedSig = "";
    loadFeed();
  }

  function toggleFocus(item) {
    setFocus(String(item.idx) === String(focusIdx) ? null : String(item.idx), item.name);
  }

  document.getElementById("focusClose").addEventListener("click", function () { setFocus(null); });

  /* ---------- Stripe Billing Portal ---------- */
  var portalBtnEl = document.getElementById("portalBtn");
  if (portalBtnEl) {
    portalBtnEl.addEventListener("click", function () {
      portalBtnEl.disabled = true;
      fetch("/api/dashboard/portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: token })
      })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.ok && j.url) window.open(j.url, "_blank", "noopener"); })
        .catch(function () {})
        .finally(function () { portalBtnEl.disabled = false; });
    });
  }

  /* ---------- ideeën-rail: klik = opdracht klaargezet in de chat ---------- */
  document.querySelectorAll("#ideaRail .idea").forEach(function (card) {
    card.addEventListener("click", function () {
      setFocus(null);
      chatText.value = card.dataset.prompt || "";
      chatText.focus();
      document.querySelectorAll("#ideaRail .idea.picked").forEach(function (c) { c.classList.remove("picked"); });
      card.classList.add("picked");
      setTimeout(function () { card.classList.remove("picked"); }, 1400);
      var agentCard = document.getElementById("agentCard");
      if (agentCard) agentCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });

  var pollTimer = null;
  function schedulePoll() {
    clearTimeout(pollTimer);
    // tijdens een beurt op 2s pollen zodat werkregels TERWIJL de shimmer draait verschijnen;
    // agent zichtbaar bezig -> 4s; anders rustig op 12s. renderFeed slaat de rebuild over
    // zolang een reveal loopt (revealBusy), dus het antwoord knippert nooit weg.
    var delay = chatBusy ? 2000 : (feedBusy ? 4000 : 12000);
    pollTimer = setTimeout(function () {
      loadFeed().then(schedulePoll, schedulePoll);
    }, delay);
  }
  function startFeedPoll() {
    if (!pollTimer) schedulePoll();
  }

  /* ---------- denk-indicator: shimmer-statuswoord dat door eerlijke fasen loopt ----------
     Nooit verzonnen tool-namen — alleen generieke fasen; échte acties blijven werkregels. */
  var statusLine = document.getElementById("agentStatusLine");
  var statusText = document.getElementById("agentStatusText");
  var statusTimers = [];
  var THINK_PHASES = [[1200, "tThink2"], [6000, "tThink3"], [20000, "tThink4"]];
  function startStatus() {
    stopStatus();
    statusText.textContent = t("tThink1", "Je bericht aan het lezen…");
    statusLine.hidden = false;
    THINK_PHASES.forEach(function (p) {
      statusTimers.push(setTimeout(function () { statusText.textContent = t(p[1], ""); }, p[0]));
    });
  }
  function stopStatus() {
    statusTimers.forEach(clearTimeout);
    statusTimers = [];
    statusLine.hidden = true;
  }

  var prefersReduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  /* ---------- streaming-gevoel: het (synchroon binnengekomen) antwoord in stukjes onthullen ----------
     Reveal in platte tekst met blokcursor; op het einde één keer swappen naar de gelinkifiëerde
     versie (msgEl doet linkify), zodat de URL-logica één codepad blijft. */
  function revealReply(textRaw) {
    if (prefersReduce) {
      log.appendChild(msgEl("agent", textRaw));
      log.scrollTop = log.scrollHeight;
      return Promise.resolve();
    }
    revealBusy = true;
    var el = document.createElement("div");
    el.className = "msg agent revealing";
    log.appendChild(el);
    // whitespace-tokens behouden (pre-wrap) en per 2-4 woorden onthullen
    var tokens = String(textRaw).split(/(\s+)/);
    var i = 0;
    return new Promise(function (resolve) {
      function step() {
        if (i >= tokens.length) {
          el.classList.remove("revealing");
          el.replaceWith(msgEl("agent", textRaw));
          revealBusy = false;
          resolve();
          return;
        }
        var chunk = "", words = 0;
        while (i < tokens.length && words < 3) {
          chunk += tokens[i];
          if (/\S/.test(tokens[i])) words++;
          i++;
        }
        el.textContent += chunk;
        if (log.scrollTop + log.clientHeight >= log.scrollHeight - 80) log.scrollTop = log.scrollHeight;
        setTimeout(step, 35);
      }
      step();
    });
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
    startStatus();
    fetch("/api/dashboard/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: token, message: text, wf: focusIdx || undefined })
    })
      .then(function (r) { return r.json(); })
      .then(function (jr) {
        stopStatus();
        var reply = (jr && jr.ok && jr.reply)
          ? jr.reply
          : ((jr && jr.error) || t("tAgentErr", "Even niet bereikbaar — probeer zo opnieuw."));
        return revealReply(reply).then(function () {
          // de agent voerde een actie uit (workflow/koppeling): zijpaneel + werkregels meteen mee
          if (jr && jr.ok && jr.refresh) {
            loadFeed();
            refreshDash().then(function (rec) {
              if (rec && rec.ok && jr.connect) openWizardFor(jr.connect);
            });
          }
        });
      })
      .catch(function () {
        stopStatus();
        return revealReply(t("tAgentErr", "Even niet bereikbaar."));
      })
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

    // portaal-knop alleen tonen zodra er echt een abonnement loopt
    var portalBtn = document.getElementById("portalBtn");
    if (portalBtn) {
      portalBtn.hidden = !(wf.items || []).some(function (i) {
        return i.status === "live" || i.status === "actief";
      });
    }

    var host = document.getElementById("flowList");
    host.innerHTML = "";
    (wf.items || []).forEach(function (item) {
      // bouw eerst, betaal daarna: voorgesteld -> in_aanbouw -> klaar_voor_review -> live
      var status = item.status === "actief" ? "live" : item.status;
      var row = document.createElement("div");
      row.className = "flow-row";
      var dot = document.createElement("span");
      dot.className = "flow-dot" + (status === "live" ? " on" : status === "in_aanbouw" ? " build" : "");
      var label = document.createElement("span");
      label.className = "flow-name";
      label.textContent = item.name;
      label.addEventListener("click", function () { toggleFocus(item); });
      if (focusIdx !== null && String(item.idx) === String(focusIdx)) row.classList.add("focus");
      row.appendChild(dot); row.appendChild(label);

      if (status === "live") {
        var okChip = document.createElement("span");
        okChip.className = "conn-ok";
        okChip.textContent = t("tLive", "Live");
        row.appendChild(okChip);
      } else if (status === "in_aanbouw") {
        var buildChip = document.createElement("span");
        buildChip.className = "flow-status";
        buildChip.textContent = t("tInBuild", "In aanbouw");
        row.appendChild(buildChip);
      } else if (status === "klaar_voor_review") {
        var payBtn = document.createElement("button");
        payBtn.type = "button";
        payBtn.className = "btn btn-primary conn-btn";
        payBtn.textContent = t("tReview", "Goedkeuren & activeer") + " · €" + item.price + t("tPerMonth", "/m");
        payBtn.addEventListener("click", function () { activate(item, payBtn); });
        row.appendChild(payBtn);
      } else {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-secondary conn-btn";
        btn.textContent = t("tBuild", "Bouw & test — gratis");
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
        } else if (jr && jr.ok) {
          if (jr.status) item.status = jr.status;
          loadFeed();
        }
      })
      .catch(function () {})
      .finally(function () { btn.disabled = false; });
  }

  /* ---------- verbindingen (wizards) ---------- */
  function openWizardFor(name) {
    var rows = document.querySelectorAll("#connList .conn-row");
    for (var i = 0; i < rows.length; i++) {
      var label = rows[i].querySelector(".conn-name");
      if (label && label.textContent === name) {
        var btn = rows[i].querySelector(".conn-btn");
        if (btn) btn.click();
        rows[i].scrollIntoView({ block: "nearest" });
        return;
      }
    }
  }

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
    // "off" negeert Chrome bij password-velden -> autofill plakte er opgeslagen
    // wachtwoorden in; "new-password" onderdrukt dat wel
    input.autocomplete = type === "password" ? "new-password" : "off";
    if (placeholder) input.placeholder = placeholder;
    label.appendChild(span); label.appendChild(input);
    return label;
  }

  function buildWizard(tool, setStatus) {
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
          if (j && j.ok) { wiz.remove(); setStatus(j.status || "verbonden"); loadFeed(); }
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
      var openWiz = function () {
        var open = connHost.querySelector(".conn-wizard");
        if (open) open.remove();
        var wiz = buildWizard(name, setStatus);
        row.insertAdjacentElement("afterend", wiz);
        wiz.querySelector("input").focus();
      };
      var setStatus = function (status) {
        row.querySelectorAll(".conn-btn,.conn-ok,.conn-saved").forEach(function (e) { e.remove(); });
        var chip = document.createElement("span");
        if (status === "bewaard") {
          // API-key veilig opgeslagen, maar de agent kan die tool nog niet lezen
          chip.className = "conn-saved";
          chip.textContent = t("tSaved", "Key bewaard");
        } else {
          chip.className = "conn-ok";
          chip.textContent = t("tConnected", "Verbonden");
        }
        // klik op de chip = key/wachtwoord vervangen of opnieuw koppelen
        chip.title = t("tReplace", "Klik om te vervangen of opnieuw te koppelen");
        chip.addEventListener("click", openWiz);
        row.appendChild(chip);
      };
      if (statusMap[name] === "verbonden" || statusMap[name] === "bewaard") {
        setStatus(statusMap[name]);
      } else {
        var btn = document.createElement("button");
        btn.className = "btn btn-secondary conn-btn";
        btn.type = "button";
        btn.textContent = t("tLink", "Koppel");
        btn.addEventListener("click", openWiz);
        row.appendChild(btn);
      }
      connHost.appendChild(row);
    });

    // zelf een tool toevoegen: naam -> juiste wizard -> na koppelen ververst alles
    var addRow = document.createElement("div");
    addRow.className = "conn-row";
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-secondary conn-btn conn-add";
    addBtn.textContent = "+ " + t("tAddTool", "Tool toevoegen");
    addBtn.addEventListener("click", function () {
      var open = connHost.querySelector(".conn-wizard");
      if (open) open.remove();
      var form = document.createElement("form");
      form.className = "conn-wizard";
      var lbl = field(t("tAddName", "Naam van de tool"), "tool", "text", "bv. Teamleader, Exact…");
      form.appendChild(lbl);
      var go = document.createElement("button");
      go.type = "submit";
      go.className = "btn btn-primary conn-submit";
      go.textContent = t("tNext", "Verder");
      form.appendChild(go);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var nm = lbl.querySelector("input").value.trim().slice(0, 40);
        if (!nm) return;
        var wiz = buildWizard(nm, function () { refreshDash(); });
        form.replaceWith(wiz);
        wiz.querySelector("input").focus();
      });
      addRow.insertAdjacentElement("afterend", form);
      lbl.querySelector("input").focus();
    });
    addRow.appendChild(addBtn);
    connHost.appendChild(addRow);

    if (rec.doel && rec.doel.trim()) {
      document.getElementById("goalText").textContent = rec.doel;
      show(document.getElementById("goalCard"));
    }
  }
})();
