// VO-Initiatives — lightweight client-side i18n (NL default, EN/FR).
// Translations are idiomatic, not literal. NL lives inline in the HTML as the no-JS fallback.
(function () {
  const DICT = {
    en: {
      "meta.title": `VO-Initiatives — VOI Agents that understand your work and do it`,
      "meta.desc": `VOI Agents: digital colleagues that understand what you mean and run your recurring tasks and entire workflows. Fully built and managed by VOI. First workflow live within 48 hours, or you don't pay.`,
      "meta.ogtitle": `It knows what you want — before you ask. | VOI Agents`,
      "nav.how": `How it works`, "nav.workflows": `Workflows`, "nav.demo": `Demo`, "nav.pricing": `Pricing`, "nav.partner": `Become a partner`, "nav.cta": `Start your build`,
      "hero.eyebrow": `VOI Agents · fully managed`,
      "hero.h1": `It knows what you want — <em class="acc">before</em> you ask.`,
      "hero.p": `VOI Agents understand what you mean and simply get your recurring tasks — and entire workflows — done. We build and run them. You just give the word.`,
      "hero.cta1": `Start your build →`, "hero.cta2": `How it works`,
      "hero.t1": `First workflow live within 48 hours`, "hero.t2": `Fully managed`, "hero.t3": `Belgian · GDPR`,
      "prob.eyebrow": `The problem`,
      "prob.h2": `You wanted leverage. You became the <em class="acc">bottleneck</em>.`,
      "prob.lead": `Tasks that keep coming back, workflows scattered across five tools, everything routed through you. And if you tried building an agent yourself? You got a second job — one that keeps breaking.`,
      "prob.s1": `of companies already deploy AI agents`, "prob.s2": `faster back-office cycles with agents`, "prob.s3": `annual growth of the agent market`,
      "prob.src": `Source: enterprise AI-agent market data, 2026`,
      "how.eyebrow": `How it works`, "how.h2": `The <em class="acc">VOI Agent</em>.`,
      "how.lead": `No software to learn. No bot to run yourself. An agent we build on your processes — and manage entirely for you.`,
      "how.s1t": `We connect your tools`, "how.s1p": `Gmail, HubSpot, your accounting, Sheets, Slack — we connect the agent to the software you already use. No migration.`,
      "how.s2t": `We build &amp; train it in`, "how.s2p": `During onboarding we build the agent on your real processes and give it a memory. It understands the goal of your workflow.`,
      "how.s3t": `You give the word`, "how.s3p": `"Follow up with this client." "Run the monthly report." By chat or email. It understands and does the rest. You stay in control.`,
      "wf.eyebrow": `What an agent does`, "wf.h2": `Entire workflows — not a single <em class="acc">task</em>.`,
      "wf.c1tag": `Sales`, "wf.c1t": `Quote → follow-up → invoicing`, "wf.c1p": `From quote to paid invoice, followed up automatically. Nothing slips.`,
      "wf.c2tag": `Operations`, "wf.c2t": `Lead → intake → scheduling`, "wf.c2p": `New lead in → intake done → appointment booked. Without you.`,
      "wf.c3tag": `Logistics`, "wf.c3t": `Order → track &amp; trace → customer update`, "wf.c3p": `Status changes → the customer is notified automatically. No phone calls.`,
      "wf.c4tag": `Finance`, "wf.c4t": `Process invoices &amp; audits`, "wf.c4p": `Incoming invoices read, checked, forwarded. Audit files compiled.`,
      "wf.c5tag": `Management`, "wf.c5t": `Reports &amp; KPIs`, "wf.c5p": `Every Monday, the numbers you want — automatically. No spreadsheet hassle.`,
      "wf.c6tag": `Any business`, "wf.c6t": `Tailored`, "wf.c6p": `We map your daily tasks and build exactly the workflow you need.`,
      "demo.eyebrow": `Your own cockpit`, "demo.h2": `One clear place where everything <em class="acc">runs</em>.`,
      "demo.lead": `No no-code spaghetti. A clean, light, lightning-fast dashboard where you see your agents, your pipeline and your numbers at a glance — and control it all.`,
      "demo.flag": `Demo · sample data`,
      "man.eyebrow": `You don't run it`, "man.h2": `No account. No keys. No <em class="acc">upkeep</em>.`,
      "man.lead": `Most "AI for business" hands you a system you have to run, host and fix yourself. We don't. We build the agent, host it, monitor it and keep it running — 24/7. The AI tech is fully included in the service.`,
      "price.eyebrow": `Pricing`, "price.h2": `A built, owned <em class="acc">system</em>.`,
      "price.lead": `You're paying for an agent built on your processes — not a chatbot subscription. No usage fees, no long contracts.`,
      "price.build": `One-time onboarding &amp; build: €3,000–€4,000`, "price.mo": ` / month`, "price.desc": `One agent, fully built and managed.`,
      "price.guarantee": `First workflow live within 48 hours — or you don't pay`,
      "price.f1": `One dedicated agent, built on your processes`, "price.f2": `Recurring tasks and multistep workflows`, "price.f3": `Connected to your existing tools · no migration`, "price.f4": `Your owned cockpit · controlled by chat or email`, "price.f5": `Fully managed — no account, no usage fees`,
      "price.cta1": `Start your build`,
      "price.ent.amt": `Custom`, "price.ent.desc": `Multiple departments or complex processes.`,
      "price.e1": `Multiple agents`, "price.e2": `Unlimited workflows`, "price.e3": `Custom integrations &amp; API`, "price.e4": `Dedicated manager &amp; SLA`, "price.e5": `Monthly strategic review`, "price.cta2": `Get in touch`,
      "aff.eyebrow": `<span style="background:var(--teal)"></span>Partner program`,
      "aff.big": `Earn €1,125/month per client. For life.`,
      "aff.p": `Refer a business — we close and deliver. You earn 50% of the monthly fee, every month the client stays, plus 50% of the build. No cap, no time limit.`,
      "aff.cta": `Become a partner →`,
      "trust.eyebrow": `Belgian &amp; secure`, "trust.h2": `Your data stays in <em class="acc">Europe</em>. And with us.`,
      "trust.b1": `100% Belgian company`, "trust.b2": `EU servers (Germany)`, "trust.b3": `GDPR-compliant · DPA included`, "trust.b4": `No data resale`,
      "found.eyebrow": `Behind VO-Initiatives`, "found.h2": `Automate the old world — without <em class="acc">breaking</em> it.`,
      "found.quote": `"We still work inside an old, manual system. I build agents that fit into the tools you already have and quietly make them faster and smarter — progress that doesn't punish you for what you've already built."`,
      "found.attr": `Oskar Verschoren · Founder, VO-Initiatives`,
      "final.eyebrow": `The next step`, "final.h2": `Hand off your <em class="acc">first</em> workflow.`,
      "final.lead": `Book a 30-minute call — together we pick the first workflow to build. Live within 48 hours, or you don't pay.`,
      "final.cta1": `Start your build →`, "final.cta2": `Book a call`,
      "foot.partner": `Become a partner`, "foot.privacy": `Privacy policy`, "foot.dpa": `Data processing agreement`, "foot.terms": `Terms & conditions`, "foot.cookies": `Cookie policy`,
      "foot.copy": `© 2026 VO-Initiatives · VOI Agents that understand your work and do it · It knows what you want, before you ask.`
    },
    fr: {
      "meta.title": `VO-Initiatives — Des VOI Agents qui comprennent votre travail et l'exécutent`,
      "meta.desc": `Les VOI Agents : des collègues numériques qui comprennent ce que vous voulez et exécutent vos tâches récurrentes et des workflows entiers. Entièrement construits et gérés par VOI. Premier workflow en ligne sous 48 h, ou vous ne payez pas.`,
      "meta.ogtitle": `Il sait ce dont vous avez besoin — avant de le demander. | VOI Agents`,
      "nav.how": `Comment ça marche`, "nav.workflows": `Workflows`, "nav.demo": `Démo`, "nav.pricing": `Tarifs`, "nav.partner": `Devenir partenaire`, "nav.cta": `Lancer votre build`,
      "hero.eyebrow": `VOI Agents · entièrement géré`,
      "hero.h1": `Il sait ce dont vous avez besoin — <em class="acc">avant</em> de le demander.`,
      "hero.p": `Les VOI Agents comprennent ce que vous voulez et exécutent vos tâches récurrentes — et des workflows entiers. Nous les construisons et les pilotons. Vous donnez l'instruction.`,
      "hero.cta1": `Lancer votre build →`, "hero.cta2": `Comment ça marche`,
      "hero.t1": `Premier workflow en ligne sous 48 h`, "hero.t2": `Entièrement géré`, "hero.t3": `Belge · RGPD`,
      "prob.eyebrow": `Le problème`,
      "prob.h2": `Vous vouliez de l'effet de levier. Vous êtes devenu le <em class="acc">goulot d'étranglement</em>.`,
      "prob.lead": `Des tâches qui reviennent sans cesse, des workflows éparpillés sur cinq outils, et tout qui passe par vous. Et si vous avez tenté de construire un agent vous-même ? Vous avez hérité d'un second métier — qui casse en permanence.`,
      "prob.s1": `des entreprises déploient déjà des agents IA`, "prob.s2": `de cycles back-office plus rapides avec des agents`, "prob.s3": `de croissance annuelle du marché des agents`,
      "prob.src": `Source : données du marché des agents IA en entreprise, 2026`,
      "how.eyebrow": `Comment ça marche`, "how.h2": `Le <em class="acc">VOI Agent</em>.`,
      "how.lead": `Aucun logiciel à apprendre. Aucun bot à piloter vous-même. Un agent que nous construisons sur vos processus — et que nous gérons entièrement pour vous.`,
      "how.s1t": `Nous connectons vos outils`, "how.s1p": `Gmail, HubSpot, votre comptabilité, Sheets, Slack — nous connectons l'agent aux logiciels que vous utilisez déjà. Aucune migration.`,
      "how.s2t": `Nous le construisons &amp; le formons`, "how.s2p": `Pendant l'onboarding, nous construisons l'agent sur vos processus réels et lui donnons une mémoire. Il comprend l'objectif de votre workflow.`,
      "how.s3t": `Vous donnez l'instruction`, "how.s3p": `« Relance ce client. » « Génère le rapport mensuel. » Par chat ou e-mail. Il comprend et fait le reste. Vous gardez le contrôle.`,
      "wf.eyebrow": `Ce qu'un agent fait`, "wf.h2": `Des workflows entiers — pas une seule <em class="acc">tâche</em>.`,
      "wf.c1tag": `Sales`, "wf.c1t": `Devis → relance → facturation`, "wf.c1p": `Du devis à la facture payée, relancé automatiquement. Rien ne traîne.`,
      "wf.c2tag": `Opérations`, "wf.c2t": `Lead → qualification → planification`, "wf.c2p": `Nouveau lead → qualification réalisée → rendez-vous fixé. Sans vous.`,
      "wf.c3tag": `Logistique`, "wf.c3t": `Commande → suivi → mise à jour client`, "wf.c3p": `Le statut change → le client est prévenu automatiquement. Aucun appel.`,
      "wf.c4tag": `Finance`, "wf.c4t": `Traiter factures &amp; audits`, "wf.c4p": `Factures entrantes lues, vérifiées, transmises. Dossiers d'audit constitués.`,
      "wf.c5tag": `Management`, "wf.c5t": `Rapports &amp; KPI`, "wf.c5p": `Chaque lundi, les chiffres que vous voulez — automatiquement. Sans galérer sur Excel.`,
      "wf.c6tag": `Toute entreprise`, "wf.c6t": `Sur mesure`, "wf.c6p": `Nous analysons vos tâches quotidiennes et construisons exactement le workflow qu'il vous faut.`,
      "demo.eyebrow": `Votre propre cockpit`, "demo.h2": `Un seul endroit clair où tout <em class="acc">tourne</em>.`,
      "demo.lead": `Pas de spaghetti no-code. Un tableau de bord épuré, léger et ultra-rapide où vous voyez vos agents, votre pipeline et vos chiffres d'un coup d'œil — et où vous pilotez tout.`,
      "demo.flag": `Démo · données d'exemple`,
      "man.eyebrow": `Vous ne le pilotez pas`, "man.h2": `Aucun compte. Aucune clé. Aucune <em class="acc">maintenance</em>.`,
      "man.lead": `La plupart des solutions « IA pour entreprises » vous livrent un système que vous devez piloter, héberger et réparer vous-même. Pas nous. Nous construisons l'agent, l'hébergeons, le surveillons et le maintenons en marche — 24/7. La technologie IA est entièrement comprise dans le service.`,
      "price.eyebrow": `Tarifs`, "price.h2": `Un système <em class="acc">conçu</em> et bien à vous.`,
      "price.lead": `Vous payez pour un agent construit sur vos processus — pas un abonnement chatbot. Aucun frais d'usage, aucun contrat long.`,
      "price.build": `Onboarding &amp; build uniques : 3 000–4 000 €`, "price.mo": ` / mois`, "price.desc": `Un agent, entièrement construit et géré.`,
      "price.guarantee": `Premier workflow en ligne sous 48 h — ou vous ne payez pas`,
      "price.f1": `Un agent dédié, construit sur vos processus`, "price.f2": `Tâches récurrentes et workflows multi-étapes`, "price.f3": `Connecté à vos outils existants · aucune migration`, "price.f4": `Votre cockpit · piloté par chat ou e-mail`, "price.f5": `Entièrement géré — aucun compte, aucun frais d'usage`,
      "price.cta1": `Lancer votre build`,
      "price.ent.amt": `Sur mesure`, "price.ent.desc": `Plusieurs départements ou processus complexes.`,
      "price.e1": `Plusieurs agents`, "price.e2": `Workflows illimités`, "price.e3": `Intégrations &amp; API sur mesure`, "price.e4": `Manager dédié &amp; SLA`, "price.e5": `Revue stratégique mensuelle`, "price.cta2": `Nous contacter`,
      "aff.eyebrow": `<span style="background:var(--teal)"></span>Programme partenaire`,
      "aff.big": `Gagnez 1 125 €/mois par client. À vie.`,
      "aff.p": `Recommandez une entreprise — nous concluons et livrons. Vous touchez 50 % de l'abonnement mensuel, chaque mois où le client reste, plus 50 % du build. Sans plafond, sans limite de durée.`,
      "aff.cta": `Devenir partenaire →`,
      "trust.eyebrow": `Belge &amp; sécurisé`, "trust.h2": `Vos données restent en <em class="acc">Europe</em>. Et chez nous.`,
      "trust.b1": `Entreprise 100 % belge`, "trust.b2": `Serveurs UE (Allemagne)`, "trust.b3": `Conforme RGPD · DPA inclus`, "trust.b4": `Aucune revente de données`,
      "found.eyebrow": `Derrière VO-Initiatives`, "found.h2": `Automatiser l'ancien monde — sans le <em class="acc">casser</em>.`,
      "found.quote": `« Nous travaillons encore dans un système ancien et manuel. Je construis des agents qui s'intègrent aux outils que vous avez déjà et les rendent discrètement plus rapides et plus intelligents — un progrès qui ne vous punit pas pour ce que vous avez bâti. »`,
      "found.attr": `Oskar Verschoren · Fondateur, VO-Initiatives`,
      "final.eyebrow": `L'étape suivante`, "final.h2": `Confiez votre <em class="acc">premier</em> workflow.`,
      "final.lead": `Réservez un appel de 30 minutes — nous choisissons ensemble le premier workflow à construire. En ligne sous 48 h, ou vous ne payez pas.`,
      "final.cta1": `Lancer votre build →`, "final.cta2": `Réserver un appel`,
      "foot.partner": `Devenir partenaire`, "foot.privacy": `Politique de confidentialité`, "foot.dpa": `Accord de traitement des données`, "foot.terms": `Conditions générales`, "foot.cookies": `Politique cookies`,
      "foot.copy": `© 2026 VO-Initiatives · Des VOI Agents qui comprennent votre travail et l'exécutent · Il sait ce que vous voulez, avant que vous le demandiez.`
    }
  };

  const OG_LOCALE = { nl: "nl_BE", en: "en_US", fr: "fr_FR" };
  const SUPPORTED = ["nl", "en", "fr"];

  function apply(lang) {
    document.documentElement.lang = lang;
    const d = DICT[lang]; // undefined for nl → keep inline HTML
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (d && d[key] != null) el.innerHTML = d[key];
    });
    // head/meta
    const t = (d && d["meta.title"]) || "VO-Initiatives — VOI Agents die je werk begrijpen en uitvoeren";
    document.title = t;
    const set = (sel, val) => { const m = document.querySelector(sel); if (m && val) m.setAttribute("content", val); };
    set('meta[name="description"]', (d && d["meta.desc"]) || null);
    set('meta[property="og:title"]', (d && d["meta.ogtitle"]) || null);
    set('meta[property="og:description"]', (d && d["meta.desc"]) || null);
    set('meta[property="og:locale"]', OG_LOCALE[lang]);
    // switch state
    document.querySelectorAll("#lang button").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang));
    try { localStorage.setItem("voi_lang", lang); } catch (e) {}
  }

  function init() {
    let lang = "nl";
    try { lang = localStorage.getItem("voi_lang") || (navigator.language || "nl").slice(0, 2); } catch (e) {}
    if (!SUPPORTED.includes(lang)) lang = "nl";
    apply(lang);
    const sw = document.getElementById("lang");
    if (sw) sw.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-lang]");
      if (b) apply(b.dataset.lang);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
