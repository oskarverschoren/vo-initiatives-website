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

  /* ---- onboarding-formulier (/start): POST naar de provisioning-pipeline ---- */
  var onboardForm = document.getElementById("onboardForm");
  if (onboardForm) {
    var errorBox = document.getElementById("onboardError");
    var successBox = document.getElementById("onboardSuccess");
    var fallbackBox = document.getElementById("onboardFallback");
    var submitBtn = document.getElementById("onboardSubmit");

    var showError = function (msg) {
      errorBox.textContent = msg;
      errorBox.hidden = false;
    };

    onboardForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      errorBox.hidden = true;

      // honeypot: stil "slagen" voor bots
      if (onboardForm.querySelector('[name="website"]').value) {
        onboardForm.hidden = true;
        successBox.hidden = false;
        return;
      }
      if (!onboardForm.reportValidity()) return;

      var payload = {
        naam: onboardForm.naam.value.trim(),
        email: onboardForm.email.value.trim(),
        bedrijf: onboardForm.bedrijf.value.trim(),
        wens: onboardForm.wens.value.trim()
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
            onboardForm.hidden = true;
            successBox.hidden = false;
            successBox.scrollIntoView({ block: "center", behavior: "smooth" });
          } else {
            showError((res.body && res.body.error) || "Er ging iets mis — probeer het opnieuw.");
          }
        })
        .catch(function () {
          // endpoint niet bereikbaar → val terug op het opstartgesprek
          onboardForm.hidden = true;
          fallbackBox.hidden = false;
        })
        .finally(function () { submitBtn.disabled = false; });
    });
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
