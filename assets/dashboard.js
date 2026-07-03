/* VO-Initiatives — web-dashboard: laadt het klantrecord uit de audit en rendert de cockpit. */
(function () {
  "use strict";

  var main = document.getElementById("dashMain");
  if (!main) return;

  var loading = document.getElementById("dashLoading");
  var missing = document.getElementById("dashMissing");

  // Vertaalde stukjes staan als verborgen template-spans in de HTML (data-i18n),
  // de i18n-engine (defer, vóór dit script) heeft ze al vertaald.
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

  function render(rec) {
    var naam = (rec.profile && rec.profile.naam ? rec.profile.naam.split(/\s+/)[0] : "");
    var hello = t("tHello", "Welkom");
    document.getElementById("dashGreet").textContent = naam ? hello + ", " + naam : hello;

    // verbindingen — elke tool is een koppelkaart (OAuth-wizard volgt in fase 3)
    var connHost = document.getElementById("connList");
    connHost.innerHTML = "";
    var conns = (rec.connections && rec.connections.length) ? rec.connections : ["Gmail"];
    conns.slice(0, 12).forEach(function (name) {
      var row = document.createElement("div");
      row.className = "conn-row";
      var left = document.createElement("span");
      left.className = "conn-name";
      left.textContent = name;
      var btn = document.createElement("button");
      btn.className = "btn btn-secondary conn-btn";
      btn.type = "button";
      btn.textContent = t("tLink", "Koppel");
      btn.addEventListener("click", function () {
        btn.textContent = t("tSoon", "Binnenkort");
        btn.disabled = true;
      });
      row.appendChild(left);
      row.appendChild(btn);
      connHost.appendChild(row);
    });

    // workflows — in opbouw
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

    // doel
    if (rec.doel && rec.doel.trim()) {
      document.getElementById("goalText").textContent = rec.doel;
      show(document.getElementById("goalCard"));
    }
  }
})();
