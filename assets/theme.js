/* Thema vóór first paint zetten om flits te vermijden — synchronously geladen in <head>.
   Extern bestand: de productie-CSP (script-src 'self') laat geen inline scripts toe. */
(function () {
  var t;
  try { t = localStorage.getItem("voi-theme"); } catch (e) {}
  if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
})();
