/* VO-Initiatives — web-dashboard: laadt het klantrecord en beheert de tool-koppelingen.
   Koppelen: Gmail/Outlook via IMAP app-wachtwoord (live getest), agenda via geheime
   ICS-link, overige tools via API-key. Credentials gaan één kant op (POST) en worden
   nooit teruggelezen. */
(function () {
  "use strict";

  var main = document.getElementById("dashMain");
  if (!main) return;

  var loading = document.getElementById("dashLoading");
  var missing = document.getElementById("dashMissing");

  // Vertaalde stukjes staan als verborgen template-spans in de HTML (data-i18n).
  var t = function (id, fallback) {
    var el = document.getElementById(id);
    return el ? el.textContent : fallback;
  };

  var show = function (el) { el.hidden = false; };
  var hide = function (el) { el.hidden = true; };

  var token = (new URLSearchParams(location.search).get("id") || "").trim();
  if (!/^[0-9a-f]{32}$/.test(token)) {
    hide(loading); show(missing); return;
  }

  fetch("/api/dashboard?id=" + token)
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (rec) {
      if (!rec || !rec.ok) return Promise.reject();
      render(rec);
      hide(loading); show(main);
    })
    .catch(function () { hide(loading); show(missing); });

  function connTypeFor(tool) {
    var s = tool.toLowerCase();
    if (/gmail|google mail|^google$/.test(s)) return { type: "imap", help: "tHelpGmail" };
    if (/outlook|hotmail|office/.test(s)) return { type: "imap", help: "tHelpOutlook" };
    if (/agenda|calendar|cal\.com/.test(s)) return { type: "ics", help: "tHelpIcs" };
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

  function buildWizard(tool, row, markConnected) {
    var kind = connTypeFor(tool);
    var wiz = document.createElement("form");
    wiz.className = "conn-wizard";

    var help = document.createElement("p");
    help.className = "conn-help";
    help.textContent = t(kind.help, "");
    wiz.appendChild(help);

    if (kind.type === "imap") {
      wiz.appendChild(field(t("tFldEmail", "E-mailadres"), "email", "email"));
      wiz.appendChild(field(t("tFldAppPw", "App-wachtwoord"), "password", "password", "xxxx xxxx xxxx xxxx"));
    } else if (kind.type === "ics") {
      wiz.appendChild(field(t("tFldIcs", "Geheime iCal/ICS-link"), "url", "url", "https://calendar.google.com/calendar/ical/…/basic.ics"));
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) { wiz.remove(); markConnected(); }
          else {
            err.textContent = (j && j.error) || t("tConnErr", "Koppelen lukte niet — probeer opnieuw.");
            err.hidden = false;
          }
        })
        .catch(function () {
          err.textContent = t("tConnErr", "Koppelen lukte niet — probeer opnieuw.");
          err.hidden = false;
        })
        .finally(function () {
          submit.disabled = false;
          submit.textContent = t("tTestLink", "Test & koppel");
        });
    });
    return wiz;
  }

  function render(rec) {
    var naam = (rec.profile && rec.profile.naam ? rec.profile.naam.split(/\s+/)[0] : "");
    var hello = t("tHello", "Welkom");
    document.getElementById("dashGreet").textContent = naam ? hello + ", " + naam : hello;

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
        okChip.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6.5L5 9.5L10 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        okChip.appendChild(document.createTextNode(" " + t("tConnected", "Verbonden")));
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
          var open = row.parentNode.querySelector(".conn-wizard");
          if (open) open.remove();
          var wiz = buildWizard(name, row, setConnected);
          row.insertAdjacentElement("afterend", wiz);
          wiz.querySelector("input").focus();
        });
        row.appendChild(btn);
      }
      connHost.appendChild(row);
    });

    var flowHost = document.getElementById("flowList");
    flowHost.innerHTML = "";
    var flows = (rec.workflows && rec.workflows.length) ? rec.workflows : [t("tFlowDef", "Werkplek automatiseren")];
    flows.slice(0, 8).forEach(function (name) {
      var row = document.createElement("div");
      row.className = "flow-row";
      var dot = document.createElement("span");
      dot.className = "flow-dot";
      var label = document.createElement("span");
      label.className = "flow-name";
      label.textContent = name;
      var status = document.createElement("span");
      status.className = "flow-status";
      status.textContent = t("tBuilding", "in opbouw");
      row.appendChild(dot);
      row.appendChild(label);
      row.appendChild(status);
      flowHost.appendChild(row);
    });

    if (rec.doel && rec.doel.trim()) {
      document.getElementById("goalText").textContent = rec.doel;
      show(document.getElementById("goalCard"));
    }
  }
})();
