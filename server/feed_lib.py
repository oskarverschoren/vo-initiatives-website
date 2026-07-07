#!/usr/bin/env python3
"""Gedeelde bibliotheek voor het chat-first dashboard.

- Berichtenfeed per klant: de agent (en systeemgebeurtenissen) schrijven hier
  proactief in; het dashboard toont de feed als hét gesprek. De feed is meteen
  ook de chatgeschiedenis.
- Workflow-metadata + prijstrappen: licht €150 / standaard €300 / zwaar €450
  per workflow per maand, met een plafond op €2.250 → daarboven "VOI Onbeperkt"
  (onbeperkt workflows/cronjobs).
"""
import json
import os
import re
import time

AUDIT_DIR = os.environ.get("AUDIT_DIR", "/root/.hermes/audits")

TIERS = {"licht": 150, "standaard": 300, "zwaar": 450}
CAP = 2250  # €/maand — vanaf hier VOI Onbeperkt


def _feed_path(token):
    if not re.fullmatch(r"[0-9a-f]{32}", token or ""):
        return None
    return os.path.join(AUDIT_DIR, token + "-feed.json")


def feed_read(token, limit=200):
    p = _feed_path(token)
    try:
        with open(p) as f:
            return json.load(f)[-limit:]
    except Exception:
        return []


def feed_add(token, role, text, kind="text", wf=None):
    """Bericht toevoegen aan de klantfeed. role: agent|user|system."""
    p = _feed_path(token)
    if not p or not text:
        return
    items = feed_read(token, limit=500)
    entry = {"ts": time.time(), "role": role, "text": str(text)[:4000], "kind": kind}
    if wf is not None:
        entry["wf"] = wf
    items.append(entry)
    tmp = p + ".tmp"
    with open(tmp, "w") as f:
        json.dump(items[-500:], f, ensure_ascii=False)
    os.replace(tmp, p)


def wf_ensure(record):
    """Zorg dat elke workflow metadata heeft: tier, prijs, status.
    Statussen: voorgesteld -> actief (na betaling of onder Onbeperkt)."""
    meta = record.setdefault("wf", {})
    for i, name in enumerate(record.get("workflows", [])):
        key = str(i)
        if key not in meta:
            meta[key] = {"name": name, "tier": "standaard",
                         "price": TIERS["standaard"], "status": "voorgesteld"}
    return meta


def wf_active_total(record):
    return sum(m.get("price", 0) for m in record.get("wf", {}).values()
               if m.get("status") == "actief")


def wf_unlimited(record):
    return wf_active_total(record) >= CAP


def wf_view(record):
    """Compacte weergave voor de frontend."""
    wf_ensure(record)
    return {
        "items": [{"idx": k, **{f: m.get(f) for f in ("name", "tier", "price", "status")}}
                  for k, m in sorted(record.get("wf", {}).items(), key=lambda kv: int(kv[0]))],
        "totaal": wf_active_total(record),
        "cap": CAP,
        "onbeperkt": wf_unlimited(record),
    }


def concierge_prompt(record):
    """Systeemprompt voor de dashboard-chat zolang de echte Hermes-gateway nog
    niet live is: dezelfde agent-persona, met alle klantkennis, en met het
    initiatief om activaties voor te stellen. Betalen gebeurt NOOIT in tekst —
    alleen via de activatiekaarten die de interface toont."""
    d = record.get("dossier", {})
    ins = record.get("insights", {})
    wf = wf_view(record)
    return f"""Je bent de VOI Agent van {d.get('bedrijf', 'deze klant')} — in opbouw, maar al aan het werk.
Toon: kalme, capabele collega. Antwoord in de taal van de klant. Kort (max 4 zinnen per beurt).
NEEM INITIATIEF: verwijs naar wat je al zag, stel de volgende stap voor, vraag niet om toestemming
om te helpen — help.

WAT JE WEET:
- Dossier: {json.dumps({k: d.get(k, '') for k in ('bedrijf', 'taak', 'uren', 'doel', 'tools')}, ensure_ascii=False)}
- Observaties uit gekoppelde tools: {json.dumps(ins.get('observaties', []), ensure_ascii=False)}
- Nog te bevestigen: {json.dumps(ins.get('bevestig', []), ensure_ascii=False)}
- Workflows en status: {json.dumps(wf['items'], ensure_ascii=False)} (actief totaal €{wf['totaal']}/m)

PRIJZEN (vast, per workflow per maand): licht €150 · standaard €300 · zwaar €450.
Vanaf €2.250/maand totaal: VOI Onbeperkt — onbeperkt workflows en cronjobs, geen meerprijs.
Als de klant een workflow wil activeren of jij stelt er één voor: zeg welke en waarom, en zeg dat
de activatieknop hieronder in het gesprek verschijnt. Vraag NOOIT om kaartgegevens of betalingen
in tekst; de interface regelt dat. Geen kortingen beloven. De €95-audit wordt verrekend bij de
eerste activatie. Wachtwoorden/keys weiger je altijd — koppelen gaat via de Verbindingen-kaart."""
