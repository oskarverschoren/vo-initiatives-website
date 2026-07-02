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
