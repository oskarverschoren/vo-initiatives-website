/* VO-Initiatives redesign — thema, FAQ-categorieën, reveal, typdemo */
(function () {
  "use strict";

  var reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- thema-toggle (init gebeurt inline in <head>) ---- */
  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("voi-theme", next);
    });
  }

  /* ---- FAQ-categorieën ---- */
  var faqButtons = document.querySelectorAll(".faq-nav button");
  var faqGroups = document.querySelectorAll(".faq-group");
  faqButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      faqButtons.forEach(function (b) { b.classList.toggle("on", b === btn); });
      faqGroups.forEach(function (g) {
        g.classList.toggle("show", g.dataset.cat === btn.dataset.cat);
      });
    });
  });

  /* ---- audit-wizard (/start): grondige intake -> POST naar de provisioning-pipeline ---- */
  var onboardForm = document.getElementById("onboardForm");
  if (onboardForm) {
    var errorBox = document.getElementById("onboardError");
    var successBox = document.getElementById("onboardSuccess");
    var fallbackBox = document.getElementById("onboardFallback");
    var submitBtn = document.getElementById("onboardSubmit");
    var prevBtn = document.getElementById("wizPrev");
    var nextBtn = document.getElementById("wizNext");
    var steps = [].slice.call(onboardForm.querySelectorAll(".wiz-step"));
    var current = 0;

    var checkedValues = function (gridId) {
      return [].slice.call(document.querySelectorAll("#" + gridId + " input:checked")).map(function (c) { return c.value; });
    };

    var showError = function (msg) { errorBox.textContent = msg; errorBox.hidden = false; };

    var goTo = function (i) {
      current = i;
      errorBox.hidden = true;
      steps.forEach(function (st, idx) { st.classList.toggle("on", idx === i); });
      document.getElementById("wizNum").textContent = i + 1;
      document.getElementById("wizBar").style.width = ((i + 1) / steps.length * 100) + "%";
      prevBtn.hidden = i === 0;
      nextBtn.hidden = i === steps.length - 1;
      submitBtn.hidden = i !== steps.length - 1;
      if (i === steps.length - 1) fillSummary();
      steps[i].querySelector("input,select,textarea") && i === 0 && steps[i].querySelector("input").focus();
    };

    var validateStep = function (i) {
      var fields = steps[i].querySelectorAll("input[required],select[required]");
      for (var f = 0; f < fields.length; f++) {
        if (!fields[f].checkValidity()) { fields[f].reportValidity(); return false; }
      }
      return true;
    };

    var fillSummary = function () {
      var box = document.getElementById("wizSummary");
      var tools = checkedValues("toolGrid");
      var anders = onboardForm.toolsAnders.value.trim();
      if (anders) tools = tools.concat([anders]);
      var rows = [
        [box.dataset.lBedrijf || "Bedrijf", onboardForm.bedrijf.value + " — " + onboardForm.naam.value],
        [box.dataset.lTools || "Tools", tools.join(", ") || "—"],
        [box.dataset.lTaken || "Workflows", checkedValues("taskGrid").join(", ") || "—"],
        [box.dataset.lUren || "Tijd", onboardForm.uren.value || "—"]
      ];
      box.innerHTML = rows.map(function (r) {
        var d = document.createElement("div");
        var b = document.createElement("b"); b.textContent = r[0];
        var sp = document.createElement("span"); sp.textContent = r[1];
        d.appendChild(b); d.appendChild(sp);
        return d.outerHTML;
      }).join("");
    };

    var buildPreview = function () {
      var naam = (onboardForm.naam.value.trim().split(/\s+/)[0]) || "";
      document.getElementById("pvGreet").textContent =
        (document.getElementById("pvGreet").dataset.hello || "Goedemorgen") + (naam ? ", " + naam : "");
      var tools = checkedValues("toolGrid");
      var anders = onboardForm.toolsAnders.value.trim();
      if (anders) tools = tools.concat(anders.split(",").map(function (t) { return t.trim(); }).filter(Boolean));
      if (!tools.length) tools = ["Gmail"];
      var chipHost = document.getElementById("pvTools");
      chipHost.innerHTML = "";
      tools.slice(0, 8).forEach(function (t) {
        var c = document.createElement("span"); c.className = "chip";
        c.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6.5L5 9.5L10 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        c.appendChild(document.createTextNode(" " + t));
        chipHost.appendChild(c);
      });
      var flows = checkedValues("taskGrid");
      if (!flows.length && onboardForm.doel.value.trim()) flows = [onboardForm.doel.value.trim().slice(0, 60)];
      if (!flows.length) flows = ["Werkplek automatiseren"];
      var flowHost = document.getElementById("pvFlows");
      flowHost.innerHTML = "";
      flows.slice(0, 5).forEach(function (fl, idx) {
        var row = document.createElement("div"); row.className = "mrow" + (idx === 0 ? " m1" : idx === 1 ? " m2" : " m3");
        var left = document.createElement("span");
        var dot = document.createElement("span"); dot.className = "mdot";
        dot.style.background = idx === 0 ? "var(--ember)" : idx === 1 ? "var(--success)" : "var(--ink-3)";
        left.appendChild(dot); left.appendChild(document.createTextNode(" " + fl));
        var right = document.createElement("span");
        right.textContent = flowHost.dataset.status || "in opbouw";
        row.appendChild(left); row.appendChild(right);
        flowHost.appendChild(row);
      });
    };

    prevBtn.addEventListener("click", function () { goTo(Math.max(0, current - 1)); });
    nextBtn.addEventListener("click", function () { if (validateStep(current)) goTo(Math.min(steps.length - 1, current + 1)); });

    onboardForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      errorBox.hidden = true;
      if (onboardForm.querySelector('[name="website"]').value) {
        onboardForm.hidden = true; successBox.hidden = false; return;
      }
      if (!validateStep(0)) { goTo(0); return; }

      var tools = checkedValues("toolGrid");
      var anders = onboardForm.toolsAnders.value.trim();
      if (anders) tools = tools.concat([anders]);
      var payload = {
        naam: onboardForm.naam.value.trim(),
        email: onboardForm.email.value.trim(),
        bedrijf: onboardForm.bedrijf.value.trim(),
        telefoon: onboardForm.telefoon.value.trim(),
        kanaal: "web",
        tools: tools.join(", "),
        taak: checkedValues("taskGrid").join("; "),
        uren: onboardForm.uren.value,
        doel: onboardForm.doel.value.trim()
      };

      submitBtn.disabled = true;
      fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.body && res.body.ok) {
            buildPreview();
            onboardForm.hidden = true;
            successBox.hidden = false;
            successBox.scrollIntoView({ block: "start", behavior: "smooth" });
          } else {
            showError((res.body && res.body.error) || "Er ging iets mis — probeer het opnieuw.");
          }
        })
        .catch(function () {
          onboardForm.hidden = true;
          fallbackBox.hidden = false;
        })
        .finally(function () { submitBtn.disabled = false; });
    });

    goTo(0);
  }

  /* ---- taalknoppen op juridische pagina's (sturen de tekstnode-engine aan) ---- */
  var legalLang = document.getElementById("legalLang");
  if (legalLang && typeof window.voiSetLang === "function") {
    var syncLegalLang = function () {
      var cur = "nl";
      try { cur = localStorage.getItem("voi_lang") || document.documentElement.lang || "nl"; } catch (e) {}
      legalLang.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("on", b.dataset.lang === cur);
      });
    };
    legalLang.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-lang]");
      if (b) { window.voiSetLang(b.dataset.lang); syncLegalLang(); }
    });
    syncLegalLang();
  }

  /* ---- scroll-reveal ---- */
  var faders = document.querySelectorAll(".fade");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    faders.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    faders.forEach(function (el) { io.observe(el); });
  }

  /* ---- cockpit-tilt: subtiel meebewegen met de muis ---- */
  var shot = document.querySelector(".app-shot");
  var card = document.querySelector(".app-card");
  if (shot && card && !reducedMotion && matchMedia("(pointer: fine)").matches) {
    var MAX_TILT = 2.4;
    var rafId = null;
    var target = { x: 0, y: 0 };

    var applyTilt = function () {
      rafId = null;
      card.style.setProperty("--tx", target.x + "deg");
      card.style.setProperty("--ty", target.y + "deg");
    };
    shot.addEventListener("pointermove", function (e) {
      var r = shot.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2 * MAX_TILT;
      target.y = -((e.clientY - r.top) / r.height - 0.5) * 2 * MAX_TILT;
      if (!rafId) rafId = requestAnimationFrame(applyTilt);
    });
    shot.addEventListener("pointerleave", function () {
      target.x = 0; target.y = 0;
      if (!rafId) rafId = requestAnimationFrame(applyTilt);
    });
  }

  /* ---- typdemo in de hero-cockpit (prompts per taal uit i18n.js) ---- */
  var typed = document.getElementById("typed");
  if (typed && !reducedMotion) {
    var TYPE_DELAY = 55;
    var HOLD_DELAY = 2600;
    var promptIndex = 0;

    var promptsForLang = function () {
      var all = window.VOI_PROMPTS || {};
      return all[document.documentElement.lang] || all.nl || [typed.textContent];
    };

    var typePrompt = function (text, charIndex) {
      typed.textContent = text.slice(0, charIndex);
      if (charIndex < text.length) {
        setTimeout(function () { typePrompt(text, charIndex + 1); }, TYPE_DELAY);
      } else {
        setTimeout(function () {
          var prompts = promptsForLang();
          promptIndex = (promptIndex + 1) % prompts.length;
          typePrompt(prompts[promptIndex], 0);
        }, HOLD_DELAY);
      }
    };
    setTimeout(function () { typePrompt(promptsForLang()[0], 0); }, 1200);
  }
})();
