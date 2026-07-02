// VO-Initiatives redesign — lightweight client-side i18n (NL default, EN/FR).
// Translations are idiomatic, not literal. NL lives inline in the HTML as the no-JS fallback.
(function () {
  "use strict";

  const DICT = {
    en: {
      "meta.title": `VO-Initiatives — VOI Agents that understand your work and do it`,
      "meta.desc": `VOI Agents: digital colleagues that understand what you mean and run your recurring tasks and entire workflows. Fully built and managed by VOI. First workflow live within 48 hours, or you don't pay.`,
      "meta.ogtitle": `It knows what you want — before you ask. | VOI Agents`,
      "aria.mainnav": `Main navigation`,
      "aria.theme": `Switch between light and dark theme`,
      "aria.logos": `Tools VOI Agents work with`,
      "aria.chart": `Growth curve of AI adoption among SMEs`,
      "aria.quote": `Quote from the founder`,
      "aria.faqnav": `FAQ categories`,
      "nav.product": `Product`, "nav.workflows": `Workflows`, "nav.pricing": `Pricing`, "nav.faq": `FAQ`, "nav.cta": `Start your build`,
      "hero.badge": `VOI Agents · fully managed`,
      "hero.h1": `It knows what you want — before you ask.`,
      "hero.p": `VOI Agents understand what you mean and simply get your recurring tasks — and entire workflows — done. We build and run them. You just give the word.`,
      "hero.cta1": `Start your build`, "hero.cta2": `Book a call`,
      "hero.note": `First workflow live within 48 hours — or you don't pay`,
      "app.aria": `Preview of the VOI cockpit: you give an instruction in plain language and the agent gets it done`,
      "app.home": `Cockpit`, "app.help": `Help`, "app.demo": `Demo · sample data`, "app.greet": `Good morning, Sofie`,
      "app.chip1": `Prep my next meeting`, "app.chip2": `Summarize the last call`,
      "app.today": `Today`, "app.date": `18 June`,
      "app.m1": `Intake — Bakkerij Vermeulen`, "app.m2": `Follow-up — Transport De Wilde`, "app.m3": `Monthly report — ready`,
      "app.ago": `5 min ago`, "app.sent": `Follow-up email sent`,
      "app.tab1": `Insights`, "app.tab2": `Transcript`, "app.conv": `Call with De Wilde`,
      "feat.h2": `Everything you need to hand off work`,
      "feat.lead": `No software to learn. No bot to run yourself. An agent we build on your processes — and manage entirely for you.`,
      "feat.cta": `Start your build`,
      "fv1.label": `Client follow-up`, "fv1.to": `To: info@dewilde-transport.be`, "fv1.chip": `Draft`,
      "fv1.body": `Hi Marc, just following up after our call…`, "fv1.send": `Send`,
      "fv1.sug": `Suggested action`, "fv1.ok": `Attachment picked`,
      "f1.t": `Follow-ups, ready to send`,
      "f1.p": `Ask in plain language. The agent writes the email, picks the right attachment and stages everything for your review.`,
      "fv2.label": `You say`, "fv2.q": `"Send the weekly report to the team every Friday."`,
      "fv2.s1": `Pull the numbers from Sheets`, "fv2.s2": `Write the summary`, "fv2.s3": `Email the team Friday at 8:00`,
      "f2.t": `Plain language becomes a workflow`,
      "f2.p": `Describe a task the way you'd hand it to a colleague. The agent turns it into a workflow that keeps running.`,
      "fv3.label": `Waiting for approval`, "fv3.line": `Invoice #2026-081 · €4,820 · Supplier Nova`,
      "fv3.ok": `Approve`, "fv3.no": `Decline`, "fv3.paused": `Workflow paused at step 3 of 5`, "fv3.wait": `Waiting`,
      "f3.t": `Approvals built in`,
      "f3.p": `The agent pauses on the steps where a human is needed. You approve or decline — you stay in control.`,
      "scale.h2": `Built to keep running`,
      "scale.lead": `We build the agent, host it, monitor it and keep it running — 24/7. The AI tech is fully included in the service.`,
      "s1.v": `38 h/month`, "s1.l": `of admin time the average Belgian SME loses`,
      "s2.v": `€18,700+`, "s2.l": `per year in lost time at 8 h/week`,
      "s3.v": `8% → 81%`, "s3.l": `AI adoption among SMEs in one year`,
      "s4.v": `+1,000`, "s4.l": `integrations with the tools you already use`,
      "scale.src": `Sources: FDmagazine · Exact SME Barometer 2026`,
      "pil1.t": `We connect your tools`, "pil1.p": `Gmail, HubSpot, your accounting, Sheets, Slack — no migration.`,
      "pil2.t": `We build & train it in`, "pil2.p": `On your real processes, with a memory. It understands the goal of your workflow.`,
      "pil3.t": `You give the word`, "pil3.p": `"Follow up with this client." In your dashboard chat or by email. It understands and does the rest.`,
      "pil4.t": `We monitor 24/7`, "pil4.p": `No account, no keys, no upkeep. Runs on EU servers, GDPR-compliant.`,
      "quote.text": `"We still work inside an old, manual system. I build agents that fit into the tools you already have — progress that doesn't punish you for what you've already built."`,
      "quote.role": `Founder, VO-Initiatives`,
      "wfs.h2": `Entire workflows — not a single task`,
      "wfs.lead": `Six examples of what a VOI Agent runs end to end — built on your processes.`,
      "wf1.tag": `Sales`, "wf1.t": `Quote → follow-up → invoicing`, "wf1.p": `From quote to paid invoice, followed up automatically. Nothing slips.`,
      "wf2.tag": `Operations`, "wf2.t": `Lead → intake → scheduling`, "wf2.p": `New lead in → intake done → appointment booked. Without you.`,
      "wf3.tag": `Logistics`, "wf3.t": `Order → track & trace → customer update`, "wf3.p": `Status changes → the customer is notified automatically. No phone calls.`,
      "wf4.tag": `Finance`, "wf4.t": `Process invoices & audits`, "wf4.p": `Incoming invoices read, checked, forwarded. Audit files compiled.`,
      "wf5.tag": `Management`, "wf5.t": `Reports & KPIs`, "wf5.p": `Every Monday, the numbers you want — automatically. No spreadsheet hassle.`,
      "wf6.tag": `Any business`, "wf6.t": `Tailored`, "wf6.p": `We map your daily tasks and build exactly the workflow you need.`,
      "price.h2": `A built, owned system`,
      "price.lead": `You're paying for an agent built on your processes — not a chatbot subscription. No usage fees, no long contracts.`,
      "price.intro": `One clear price per agent, everything included.`,
      "price.g": `First workflow live within 48 hours — or you don't pay`,
      "plan1.pop": `Most chosen`,
      "plan1.meta": `<b>€2,250</b> per month · one-time onboarding &amp; build €3,000–€4,000`,
      "plan1.cta": `Start your build`,
      "plan2.meta": `<b>Custom</b> · multiple departments or complex processes`,
      "plan2.cta": `Get in touch`,
      "ptg1.t": `Workflows`, "ptg1.p": `What your agent runs, and keeps running`,
      "ptr1.l": `Dedicated agents`, "ptr1.v1": `1, built on your processes`, "ptr1.v2": `Multiple`,
      "ptr2.l": `Recurring tasks & multistep workflows`,
      "ptr3.l": `Number of workflows`, "ptr3.v1": `Agreed per agent`, "ptr3.v2": `Unlimited`,
      "ptr4.l": `Controlled from the dashboard chat or by email`,
      "ptg2.t": `Integrations & management`, "ptg2.p": `Connected to your existing tools`,
      "ptr5.l": `Connected to your tools · no migration`,
      "ptr6.l": `Your owned cockpit`,
      "ptr7.l": `Fully managed — no account, no usage fees`,
      "ptr8.l": `Custom integrations & API`,
      "ptg3.t": `Support`, "ptg3.p": `Who's there for you`,
      "ptr9.l": `Dedicated manager & SLA`,
      "ptr10.l": `Monthly strategic review`,
      "price.note": `Partner program: earn €1,125/month per referred client, for life — <a href="affiliate.html" style="text-decoration:underline">become a partner</a>`,
      "aria.trust": `Trust and data protection`,
      "trust.b1": `100% Belgian company`, "trust.b2": `EU servers (Germany)`, "trust.b3": `GDPR-compliant · DPA included`, "trust.b4": `No data resale`,
      "faq.h2": `Frequently asked questions`,
      "faq.lead": `Short answers about agents, workflows and pricing.`,
      "faqc1": `General`, "faqc2": `Workflows`, "faqc3": `Pricing`,
      "faqg1.t": `General`,
      "faq.q1": `What is a VOI Agent?`,
      "faq.a1": `A digital colleague that understands what you mean and runs your recurring tasks and entire workflows. We build it on your processes, host it and manage it fully — you give the word in your dashboard chat or by email.`,
      "faq.q2": `Do I need to be technical?`,
      "faq.a2": `No. No account, no keys, no upkeep. Most "AI for business" hands you a system you have to run, host and fix yourself. We don't — the AI tech is fully included in the service.`,
      "faq.q3": `Where is my data stored?`,
      "faq.a3": `On EU servers in Germany. We're a 100% Belgian company, GDPR-compliant with a data processing agreement included, and we never resell data.`,
      "faqg2.t": `Workflows`,
      "faq.q4": `Which tasks can an agent take over?`,
      "faq.a4": `Everything that keeps coming back: following up quotes, lead intake and scheduling, track & trace updates to customers, processing invoices, preparing reports and KPIs. We map your daily tasks and build exactly the workflow you need.`,
      "faq.q5": `How fast is my first workflow live?`,
      "faq.a5": `Within 48 hours of starting your build — or you don't pay. During onboarding we build the agent on your real processes and give it a memory.`,
      "faq.q6": `Does it work with my existing tools?`,
      "faq.a6": `Yes. Gmail, HubSpot, your accounting, Sheets, Slack and over a thousand other integrations. We connect the agent to the software you already use — no migration.`,
      "faqg3.t": `Pricing`,
      "faq.q7": `What does a VOI Agent cost?`,
      "faq.a7": `€2,250 per month for one agent, fully built and managed, plus a one-time onboarding & build of €3,000–€4,000. For multiple departments or complex processes we prepare a custom Enterprise proposal.`,
      "faq.q8": `Are there usage fees or long contracts?`,
      "faq.a8": `No. You're paying for an agent built on your processes — not a chatbot subscription, no usage fees, no long contracts.`,
      "faq.q9": `Is there a partner program?`,
      "faq.a9": `Yes. Refer a business — we close and deliver. You earn 50% of the monthly fee (€1,125/month per client), every month the client stays, plus 50% of the build. No cap, no time limit.`,
      "final.h2": `Hand off your first workflow`,
      "final.lead": `Book a 30-minute call — together we pick the first workflow to build. Live within 48 hours, or you don't pay.`,
      "final.cta": `Start your build`,
      "final.note": `No usage fees · no long contracts`,
      "foot1.t": `Product`, "foot1.l1": `How it works`, "foot1.l2": `Workflows`, "foot1.l3": `The cockpit`, "foot1.l4": `Pricing`, "foot1.l5": `FAQ`,
      "chip.new": `New`,
      "foot2.t": `Company`, "foot2.l1": `About VO-Initiatives`, "foot2.l2": `Become a partner`, "foot2.l3": `Contact`,
      "foot3.t": `VOI for`, "foot3.l1": `Sales`, "foot3.l2": `Operations`, "foot3.l3": `Logistics`, "foot3.l4": `Finance`, "foot3.l5": `Management`,
      "foot4.t": `Legal`, "foot4.l1": `Privacy policy`, "foot4.l2": `Data processing agreement`, "foot4.l3": `Terms & conditions`, "foot4.l4": `Cookie policy`,
      "start.back": `Back to home`,
      "start.badge": `Onboarding · starts right away`,
      "start.h1": `Start your build`,
      "start.lead": `Tell us in one minute who you are and what you want to automate. Your onboarding starts immediately — the intake continues in your mailbox.`,
      "start.f.naam": `Name`,
      "start.f.email": `Email address`,
      "start.f.bedrijf": `Company`,
      "start.f.wens": `What do you want to automate? <em>(optional)</em>`,
      "start.f.optioneel": `(optional)`,
      "start.f.wensph": `E.g. following up quotes, processing invoices, the monthly report…`,
      "start.submit": `Start your build`,
      "start.note": `First workflow live within 48 hours — or you don't pay`,
      "start.ok.h2": `We're on it`,
      "start.ok.p": `Your onboarding is running. Check your mailbox — the intake continues there. First workflow live within 48 hours, or you don't pay.`,
      "start.ok.home": `Back to home`,
      "start.fb.h2": `Direct start is briefly unavailable`,
      "start.fb.p": `No worries — book your 30-minute onboarding call right away and we'll start there.`,
      "start.fb.cta": `Book your call`,
      "start.privacy": `We only use your details for your onboarding — never for anything else. See our <a href="privacy.html" style="text-decoration:underline">privacy policy</a>.`,
      "foot.copy": `© 2026 VO-Initiatives · It knows what you want, before you ask.`
    },
    fr: {
      "meta.title": `VO-Initiatives — Des VOI Agents qui comprennent votre travail et l'exécutent`,
      "meta.desc": `Les VOI Agents : des collègues numériques qui comprennent ce que vous voulez et exécutent vos tâches récurrentes et des workflows entiers. Entièrement construits et gérés par VOI. Premier workflow en ligne sous 48 h, ou vous ne payez pas.`,
      "meta.ogtitle": `Il sait ce dont vous avez besoin — avant de le demander. | VOI Agents`,
      "aria.mainnav": `Navigation principale`,
      "aria.theme": `Basculer entre thème clair et sombre`,
      "aria.logos": `Les outils avec lesquels les VOI Agents fonctionnent`,
      "aria.chart": `Courbe de croissance de l'adoption de l'IA par les PME`,
      "aria.quote": `Citation du fondateur`,
      "aria.faqnav": `Catégories de FAQ`,
      "nav.product": `Produit`, "nav.workflows": `Workflows`, "nav.pricing": `Tarifs`, "nav.faq": `FAQ`, "nav.cta": `Lancer votre build`,
      "hero.badge": `VOI Agents · entièrement géré`,
      "hero.h1": `Il sait ce dont vous avez besoin — avant de le demander.`,
      "hero.p": `Les VOI Agents comprennent ce que vous voulez et exécutent vos tâches récurrentes — et des workflows entiers. Nous les construisons et les pilotons. Vous donnez l'instruction.`,
      "hero.cta1": `Lancer votre build`, "hero.cta2": `Réserver un appel`,
      "hero.note": `Premier workflow en ligne sous 48 h — ou vous ne payez pas`,
      "app.aria": `Aperçu du cockpit VOI : vous donnez une instruction en langage courant et l'agent l'exécute`,
      "app.home": `Cockpit`, "app.help": `Aide`, "app.demo": `Démo · données fictives`, "app.greet": `Bonjour, Sofie`,
      "app.chip1": `Préparer mon prochain rendez-vous`, "app.chip2": `Résumer le dernier appel`,
      "app.today": `Aujourd'hui`, "app.date": `18 juin`,
      "app.m1": `Intake — Bakkerij Vermeulen`, "app.m2": `Relance — Transport De Wilde`, "app.m3": `Rapport mensuel — prêt`,
      "app.ago": `il y a 5 min`, "app.sent": `E-mail de relance envoyé`,
      "app.tab1": `Analyses`, "app.tab2": `Compte rendu`, "app.conv": `Appel avec De Wilde`,
      "feat.h2": `Tout ce qu'il faut pour déléguer votre travail`,
      "feat.lead": `Aucun logiciel à apprendre. Aucun bot à piloter vous-même. Un agent que nous construisons sur vos processus — et que nous gérons entièrement pour vous.`,
      "feat.cta": `Lancer votre build`,
      "fv1.label": `Suivi client`, "fv1.to": `À : info@dewilde-transport.be`, "fv1.chip": `Brouillon`,
      "fv1.body": `Bonjour Marc, je reviens vers vous après notre échange…`, "fv1.send": `Envoyer`,
      "fv1.sug": `Action suggérée`, "fv1.ok": `Pièce jointe choisie`,
      "f1.t": `Des relances prêtes à partir`,
      "f1.p": `Demandez-le en langage courant. L'agent rédige l'e-mail, choisit la bonne pièce jointe et prépare tout pour votre validation.`,
      "fv2.label": `Vous dites`, "fv2.q": `« Envoie le rapport hebdo à l'équipe chaque vendredi. »`,
      "fv2.s1": `Récupérer les chiffres dans Sheets`, "fv2.s2": `Rédiger la synthèse`, "fv2.s3": `L'envoyer à l'équipe vendredi à 8 h`,
      "f2.t": `Le langage courant devient un workflow`,
      "f2.p": `Décrivez une tâche comme vous la confieriez à un collègue. L'agent en fait un workflow qui continue de tourner.`,
      "fv3.label": `En attente de validation`, "fv3.line": `Facture #2026-081 · 4 820 € · Fournisseur Nova`,
      "fv3.ok": `Valider`, "fv3.no": `Refuser`, "fv3.paused": `Workflow en pause à l'étape 3 sur 5`, "fv3.wait": `En attente`,
      "f3.t": `La validation est intégrée`,
      "f3.p": `L'agent s'arrête aux étapes où un humain est nécessaire. Vous validez ou refusez — vous gardez le contrôle.`,
      "scale.h2": `Conçu pour tourner sans s'arrêter`,
      "scale.lead": `Nous construisons l'agent, l'hébergeons, le surveillons et le maintenons en marche — 24 h/24, 7 j/7. La technologie IA est entièrement comprise dans le service.`,
      "s1.v": `38 h/mois`, "s1.l": `de temps admin perdu en moyenne par une PME belge`,
      "s2.v": `18 700 €+`, "s2.l": `par an de temps perdu à raison de 8 h/semaine`,
      "s3.v": `8 % → 81 %`, "s3.l": `d'adoption de l'IA par les PME en un an`,
      "s4.v": `+1 000`, "s4.l": `intégrations avec les outils que vous utilisez déjà`,
      "scale.src": `Sources : FDmagazine · Baromètre PME Exact 2026`,
      "pil1.t": `Nous connectons vos outils`, "pil1.p": `Gmail, HubSpot, votre comptabilité, Sheets, Slack — aucune migration.`,
      "pil2.t": `Nous le construisons & le formons`, "pil2.p": `Sur vos processus réels, avec une mémoire. Il comprend l'objectif de votre workflow.`,
      "pil3.t": `Vous donnez l'instruction`, "pil3.p": `« Relance ce client. » Via le chat de votre tableau de bord ou par e-mail. Il comprend et fait le reste.`,
      "pil4.t": `Nous surveillons 24/7`, "pil4.p": `Pas de compte, pas de clés, pas d'entretien. Sur des serveurs UE, conforme RGPD.`,
      "quote.text": `« Nous travaillons encore dans un vieux système manuel. Je construis des agents qui s'intègrent aux outils que vous avez déjà — un progrès qui ne vous punit pas pour ce que vous avez déjà bâti. »`,
      "quote.role": `Fondateur, VO-Initiatives`,
      "wfs.h2": `Des workflows entiers — pas une seule tâche`,
      "wfs.lead": `Six exemples de ce qu'un VOI Agent exécute de bout en bout — construit sur vos processus.`,
      "wf1.tag": `Ventes`, "wf1.t": `Devis → relance → facturation`, "wf1.p": `Du devis à la facture payée, relancé automatiquement. Rien ne passe à la trappe.`,
      "wf2.tag": `Opérations`, "wf2.t": `Lead → intake → planification`, "wf2.p": `Nouveau lead → intake réalisé → rendez-vous planifié. Sans vous.`,
      "wf3.tag": `Logistique`, "wf3.t": `Commande → track & trace → info client`, "wf3.p": `Le statut change → le client est prévenu automatiquement. Zéro coup de fil.`,
      "wf4.tag": `Finance`, "wf4.t": `Traiter factures & audits`, "wf4.p": `Factures entrantes lues, contrôlées, transmises. Dossiers d'audit constitués.`,
      "wf5.tag": `Management`, "wf5.t": `Rapports & KPI`, "wf5.p": `Chaque lundi, les chiffres que vous voulez — automatiquement. Sans galère Excel.`,
      "wf6.tag": `Toute entreprise`, "wf6.t": `Sur mesure`, "wf6.p": `Nous cartographions vos tâches quotidiennes et construisons exactement le workflow qu'il vous faut.`,
      "price.h2": `Un système construit, à vous`,
      "price.lead": `Vous payez pour un agent construit sur vos processus — pas un abonnement chatbot. Pas de frais de consommation, pas de contrats longs.`,
      "price.intro": `Un prix clair par agent, tout compris.`,
      "price.g": `Premier workflow en ligne sous 48 h — ou vous ne payez pas`,
      "plan1.pop": `Le plus choisi`,
      "plan1.meta": `<b>2 250 €</b> par mois · onboarding &amp; build unique 3 000–4 000 €`,
      "plan1.cta": `Lancer votre build`,
      "plan2.meta": `<b>Sur mesure</b> · plusieurs départements ou processus complexes`,
      "plan2.cta": `Nous contacter`,
      "ptg1.t": `Workflows`, "ptg1.p": `Ce que votre agent exécute, en continu`,
      "ptr1.l": `Agents dédiés`, "ptr1.v1": `1, construit sur vos processus`, "ptr1.v2": `Plusieurs`,
      "ptr2.l": `Tâches récurrentes & workflows multi-étapes`,
      "ptr3.l": `Nombre de workflows`, "ptr3.v1": `Défini ensemble par agent`, "ptr3.v2": `Illimité`,
      "ptr4.l": `Pilotage via le chat du tableau de bord ou par e-mail`,
      "ptg2.t": `Intégrations & gestion`, "ptg2.p": `Connecté à vos outils existants`,
      "ptr5.l": `Connexion à vos outils · aucune migration`,
      "ptr6.l": `Votre cockpit à vous`,
      "ptr7.l": `Entièrement géré — pas de compte, pas de consommation`,
      "ptr8.l": `Intégrations custom & API`,
      "ptg3.t": `Support`, "ptg3.p": `Qui est là pour vous`,
      "ptr9.l": `Manager dédié & SLA`,
      "ptr10.l": `Revue stratégique mensuelle`,
      "price.note": `Programme partenaire : gagnez 1 125 €/mois par client référé, à vie — <a href="affiliate.html" style="text-decoration:underline">devenez partenaire</a>`,
      "aria.trust": `Confiance et protection des données`,
      "trust.b1": `Entreprise 100 % belge`, "trust.b2": `Serveurs UE (Allemagne)`, "trust.b3": `Conforme RGPD · accord de sous-traitance inclus`, "trust.b4": `Aucune revente de données`,
      "faq.h2": `Questions fréquentes`,
      "faq.lead": `Des réponses courtes sur les agents, les workflows et les tarifs.`,
      "faqc1": `Général`, "faqc2": `Workflows`, "faqc3": `Tarifs`,
      "faqg1.t": `Général`,
      "faq.q1": `Qu'est-ce qu'un VOI Agent ?`,
      "faq.a1": `Un collègue numérique qui comprend ce que vous voulez et exécute vos tâches récurrentes et des workflows entiers. Nous le construisons sur vos processus, l'hébergeons et le gérons entièrement — vous donnez l'instruction via le chat de votre tableau de bord ou par e-mail.`,
      "faq.q2": `Faut-il être technique ?`,
      "faq.a2": `Non. Pas de compte, pas de clés, pas d'entretien. La plupart des « IA pour entreprises » vous laissent un système à piloter, héberger et réparer vous-même. Pas nous — la technologie IA est entièrement comprise dans le service.`,
      "faq.q3": `Où sont stockées mes données ?`,
      "faq.a3": `Sur des serveurs UE en Allemagne. Nous sommes une entreprise 100 % belge, conforme RGPD avec un accord de sous-traitance inclus, et nous ne revendons jamais de données.`,
      "faqg2.t": `Workflows`,
      "faq.q4": `Quelles tâches un agent peut-il reprendre ?`,
      "faq.a4": `Tout ce qui revient sans cesse : relancer des devis, qualifier et planifier des leads, envoyer des mises à jour track & trace aux clients, traiter des factures, préparer rapports et KPI. Nous cartographions vos tâches quotidiennes et construisons exactement le workflow qu'il vous faut.`,
      "faq.q5": `Mon premier workflow est en ligne en combien de temps ?`,
      "faq.a5": `Sous 48 heures après le lancement de votre build — ou vous ne payez pas. Pendant l'onboarding, nous construisons l'agent sur vos processus réels et lui donnons une mémoire.`,
      "faq.q6": `Ça fonctionne avec mes outils existants ?`,
      "faq.a6": `Oui. Gmail, HubSpot, votre comptabilité, Sheets, Slack et plus de mille autres intégrations. Nous connectons l'agent aux logiciels que vous utilisez déjà — aucune migration.`,
      "faqg3.t": `Tarifs`,
      "faq.q7": `Combien coûte un VOI Agent ?`,
      "faq.a7": `2 250 € par mois pour un agent, entièrement construit et géré, plus un onboarding & build unique de 3 000 à 4 000 €. Pour plusieurs départements ou des processus complexes, nous préparons une offre Enterprise sur mesure.`,
      "faq.q8": `Y a-t-il des frais de consommation ou des contrats longs ?`,
      "faq.a8": `Non. Vous payez pour un agent construit sur vos processus — pas un abonnement chatbot, pas de frais de consommation, pas de contrats longs.`,
      "faq.q9": `Existe-t-il un programme partenaire ?`,
      "faq.a9": `Oui. Référez une entreprise — nous concluons et livrons. Vous touchez 50 % du prix mensuel (1 125 €/mois par client), chaque mois tant que le client reste, plus 50 % de l'onboarding. Sans plafond, sans limite de durée.`,
      "final.h2": `Déléguez votre premier workflow`,
      "final.lead": `Réservez un appel de 30 minutes — nous choisissons ensemble le premier workflow à construire. En ligne sous 48 h, ou vous ne payez pas.`,
      "final.cta": `Lancer votre build`,
      "final.note": `Pas de frais de consommation · pas de contrats longs`,
      "foot1.t": `Produit`, "foot1.l1": `Comment ça marche`, "foot1.l2": `Workflows`, "foot1.l3": `Le cockpit`, "foot1.l4": `Tarifs`, "foot1.l5": `FAQ`,
      "chip.new": `Nouveau`,
      "foot2.t": `Entreprise`, "foot2.l1": `À propos de VO-Initiatives`, "foot2.l2": `Devenir partenaire`, "foot2.l3": `Contact`,
      "foot3.t": `VOI pour`, "foot3.l1": `Ventes`, "foot3.l2": `Opérations`, "foot3.l3": `Logistique`, "foot3.l4": `Finance`, "foot3.l5": `Management`,
      "foot4.t": `Juridique`, "foot4.l1": `Politique de confidentialité`, "foot4.l2": `Accord de sous-traitance`, "foot4.l3": `Conditions générales`, "foot4.l4": `Politique de cookies`,
      "start.back": `Retour à l'accueil`,
      "start.badge": `Onboarding · démarre immédiatement`,
      "start.h1": `Lancez votre build`,
      "start.lead": `Dites-nous en une minute qui vous êtes et ce que vous voulez automatiser. Votre onboarding démarre immédiatement — l'intake continue dans votre boîte mail.`,
      "start.f.naam": `Nom`,
      "start.f.email": `Adresse e-mail`,
      "start.f.bedrijf": `Entreprise`,
      "start.f.wens": `Que voulez-vous automatiser ? <em>(facultatif)</em>`,
      "start.f.optioneel": `(facultatif)`,
      "start.f.wensph": `Par ex. relancer des devis, traiter des factures, le rapport mensuel…`,
      "start.submit": `Lancer votre build`,
      "start.note": `Premier workflow en ligne sous 48 h — ou vous ne payez pas`,
      "start.ok.h2": `C'est parti`,
      "start.ok.p": `Votre onboarding est lancé. Vérifiez votre boîte mail — l'intake y continue. Premier workflow en ligne sous 48 h, ou vous ne payez pas.`,
      "start.ok.home": `Retour à l'accueil`,
      "start.fb.h2": `Le démarrage direct est momentanément indisponible`,
      "start.fb.p": `Pas d'inquiétude — réservez tout de suite votre appel d'onboarding de 30 minutes et nous démarrerons là.`,
      "start.fb.cta": `Réserver votre appel`,
      "start.privacy": `Nous utilisons vos données uniquement pour votre onboarding — jamais pour autre chose. Voir notre <a href="privacy.html" style="text-decoration:underline">politique de confidentialité</a>.`,
      "foot.copy": `© 2026 VO-Initiatives · Il sait ce dont vous avez besoin, avant de le demander.`
    }
  };

  // Typdemo-prompts per taal; app.js leest deze per cyclus.
  window.VOI_PROMPTS = {
    nl: [
      "Volg de offerte voor Vandenberghe op",
      "Draai het maandrapport en mail het naar mij",
      "Plan een intake in met de nieuwe lead",
      "Stuur de klant een track & trace-update"
    ],
    en: [
      "Follow up on the Vandenberghe quote",
      "Run the monthly report and email it to me",
      "Schedule an intake with the new lead",
      "Send the customer a track & trace update"
    ],
    fr: [
      "Relance le devis Vandenberghe",
      "Génère le rapport mensuel et envoie-le-moi",
      "Planifie un intake avec le nouveau lead",
      "Envoie au client une mise à jour track & trace"
    ]
  };

  const OG_LOCALE = { nl: "nl_BE", en: "en_US", fr: "fr_FR" };
  const SUPPORTED = ["nl", "en", "fr"];

  // Cache de originele inline (NL) inhoud zodat terugschakelen de brontekst herstelt.
  const ORIG_HTML = new Map();
  const ORIG_ATTR = new Map();
  const original = (map, key, value) => { if (!map.has(key)) map.set(key, value); return map.get(key); };

  function apply(lang) {
    document.documentElement.lang = lang;
    const d = DICT[lang]; // undefined voor nl → val terug op inline NL
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const base = original(ORIG_HTML, el, el.innerHTML);
      el.innerHTML = (d && d[key] != null) ? d[key] : base;
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      const base = original(ORIG_ATTR, el, el.getAttribute("aria-label"));
      el.setAttribute("aria-label", (d && d[key] != null) ? d[key] : base);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const key = el.getAttribute("data-i18n-ph");
      const base = original(ORIG_ATTR, el, el.getAttribute("placeholder"));
      el.setAttribute("placeholder", (d && d[key] != null) ? d[key] : base);
    });
    // <head>-metadata
    const get = (k) => (d && d[k]) || null;
    document.title = get("meta.title") || original(ORIG_ATTR, "__title", document.title);
    const setMeta = (sel, key) => {
      const m = document.querySelector(sel); if (!m) return;
      m.setAttribute("content", get(key) || original(ORIG_ATTR, sel, m.getAttribute("content")));
    };
    setMeta('meta[name="description"]', "meta.desc");
    setMeta('meta[property="og:description"]', "meta.desc");
    const ogt = document.querySelector('meta[property="og:title"]');
    if (ogt) ogt.setAttribute("content", get("meta.ogtitle") || original(ORIG_ATTR, "__ogt", ogt.getAttribute("content")));
    const ogl = document.querySelector('meta[property="og:locale"]');
    if (ogl) ogl.setAttribute("content", OG_LOCALE[lang]);
    // switch-status
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
