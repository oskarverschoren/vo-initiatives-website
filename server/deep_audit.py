#!/usr/bin/env python3
"""VOI diepe-audit inlees-agent.

Leest de gekoppelde verbindingen van één klant (IMAP read-only, ICS-agenda),
destilleert daar met het model eerlijke bevindingen uit, en schrijft ze als
`insights` in het klantrecord — het dashboard toont ze onder "Wat je agent al zag".

Wordt automatisch gestart door onboard_chat_handler.py na elke geslaagde
koppeling; handmatig: python3 deep_audit.py <token> (env zoals de handler).

Privacy (v1): uit de mailbox gaan alleen afzender-domeinen, onderwerpregels en
datums van een recent staal naar het model — geen mail-inhoud. Agenda: alleen
titels en tijdstippen. Alles read-only.
"""
import email.header
import email.utils
import imaplib
import json
import os
import re
import sys
import time
import urllib.request
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
MODEL = os.environ.get("CHAT_MODEL", "anthropic/claude-haiku-4.5")
AUDIT_DIR = os.environ.get("AUDIT_DIR", "/root/.hermes/audits")
CONN_DIR = os.environ.get("CONN_SECRETS_DIR", "/root/.hermes/audit-connections")
CLIENTS_DIR = os.environ.get("CLIENTS_DIR", "/root/.hermes/clients")
MAIL_SAMPLE = int(os.environ.get("DEEP_MAIL_SAMPLE", "300"))


def _decode(value):
    try:
        parts = email.header.decode_header(value or "")
        return "".join(p.decode(c or "utf-8", "ignore") if isinstance(p, bytes) else p
                       for p, c in parts)
    except Exception:
        return str(value or "")


def read_imap(fields):
    """Staal uit de inbox: afzenders, onderwerpen, datums. Read-only."""
    box = imaplib.IMAP4_SSL(fields["host"], 993, timeout=20)
    box.login(fields["email"], fields["password"])
    try:
        box.select("INBOX", readonly=True)
        _, data = box.search(None, "ALL")
        ids = data[0].split()
        sample = ids[-MAIL_SAMPLE:]
        senders, subjects, dates = [], [], []
        # in blokken fetchen om het snel te houden
        for i in range(0, len(sample), 50):
            chunk = b",".join(sample[i:i + 50])
            _, msgs = box.fetch(chunk, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
            for part in msgs:
                if not isinstance(part, tuple):
                    continue
                head = part[1].decode("utf-8", "ignore")
                m_from = re.search(r"^From:(.*)$", head, re.M | re.I)
                m_subj = re.search(r"^Subject:(.*)$", head, re.M | re.I)
                m_date = re.search(r"^Date:(.*)$", head, re.M | re.I)
                if m_from:
                    addr = email.utils.parseaddr(_decode(m_from.group(1)))[1]
                    if "@" in addr:
                        senders.append(addr.split("@")[1].lower())
                if m_subj:
                    subj = _decode(m_subj.group(1)).strip()
                    if subj:
                        subjects.append(subj[:120])
                if m_date:
                    try:
                        parsed = email.utils.parsedate_tz(m_date.group(1).strip())
                        if parsed:
                            dates.append(email.utils.mktime_tz(parsed))
                    except Exception:
                        pass
    finally:
        try:
            box.logout()
        except Exception:
            pass

    weeks = 1.0
    if len(dates) >= 2:
        span = (max(dates) - min(dates)) / (7 * 86400)
        weeks = max(span, 0.5)
    uniq_subjects = list(dict.fromkeys(subjects))
    return {
        "mails_in_staal": len(subjects),
        "mails_per_week": round(len(subjects) / weeks),
        "top_afzender_domeinen": Counter(senders).most_common(10),
        "voorbeeld_onderwerpen": uniq_subjects[-40:],
    }


def read_ics(fields):
    """Agenda-staal: titels + tijdstippen van events, ±45 dagen rond vandaag."""
    url = fields["url"].replace("webcal://", "https://", 1)
    req = urllib.request.Request(url, headers={"User-Agent": "VOI-audit/1.0"})
    raw = urllib.request.urlopen(req, timeout=20).read(2_000_000).decode("utf-8", "ignore")
    events = []
    now = time.time()
    window = 45 * 86400
    for block in raw.split("BEGIN:VEVENT")[1:]:
        m_start = re.search(r"DTSTART[^:]*:(\d{8})(T(\d{6}))?", block)
        m_sum = re.search(r"SUMMARY[^:]*:(.*)", block)
        if not m_start:
            continue
        try:
            ts = time.mktime(time.strptime(m_start.group(1), "%Y%m%d"))
        except ValueError:
            continue
        if abs(ts - now) > window:
            continue
        title = (m_sum.group(1).strip() if m_sum else "")[:100]
        events.append({"datum": m_start.group(1), "titel": title})
    titles = Counter(e["titel"] for e in events if e["titel"])
    return {
        "events_90_dagen": len(events),
        "events_per_week": round(len(events) / 13.0, 1),
        "terugkerende_titels": titles.most_common(10),
        "voorbeeld_events": events[-25:],
    }


def summarize(record, gathered):
    profiel = record.get("dossier", {})
    prompt = f"""Je bent de audit-agent van VO-Initiatives. Hieronder staan RUWE, geanonimiseerde
signalen uit de zojuist gekoppelde tools van een klant (alleen afzender-domeinen,
onderwerpregels, agenda-titels — geen inhoud). Plus wat de klant zelf vertelde.

KLANT ZEI: {json.dumps({k: profiel.get(k, '') for k in ('bedrijf', 'taak', 'uren', 'doel')}, ensure_ascii=False)}

SIGNALEN UIT TOOLS: {json.dumps(gathered, ensure_ascii=False)[:8000]}

Destilleer hieruit een eerlijk beeld. Verzin NIETS dat niet uit de data blijkt.
Antwoord met UITSLUITEND dit JSON-object (Nederlands, geen tekst eromheen):
{{"observaties": ["3-6 concrete observaties, elk max 140 tekens, bv. 'Je ontvangt ~X mails/week, vooral van <domein> — vermoedelijk klantaanvragen'"],
"bevestig": ["2-4 korte ja/nee-vragen aan de klant om aannames te toetsen"],
"workflow_signalen": ["1-3 signalen die de geplande workflows ondersteunen of bijsturen"]}}"""
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 900,
        "temperature": 0.3,
    }).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions", data=body,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json",
                 "HTTP-Referer": "https://vo-initiatives.com", "X-Title": "VOI deep audit"})
    with urllib.request.urlopen(req, timeout=90) as r:
        content = json.loads(r.read())["choices"][0]["message"]["content"]
    m = re.search(r"\{.*\}", content, re.S)
    return json.loads(m.group(0))


MARK_BEGIN = "<!-- web-audit:begin -->"
MARK_END = "<!-- web-audit:end -->"


def sync_memory(record):
    """Schrijf de audit-kennis in de MEMORY.md-seed van de klant, zodat de
    Hermes-agent op dag één alles weet wat de audit zag. Idempotent: het blok
    tussen de markers wordt vervangen. Draait alleen zolang het profiel nog
    niet gelanceerd is (de seed wordt eenmalig gekopieerd door client_launch)."""
    slug = (record.get("provision") or {}).get("slug", "")
    if not slug:
        return
    mem_path = os.path.join(CLIENTS_DIR, slug, "MEMORY.md")
    if not os.path.exists(mem_path):
        return
    ins = record.get("insights") or {}
    d = record.get("dossier") or {}
    lines = ["", MARK_BEGIN, "## Audit-bevindingen (web-audit)"]
    bron = ins.get("bron") or {}
    if bron:
        lines.append(f"Bron: {bron.get('mails', 0)} mails, {bron.get('events', 0)} agenda-items gelezen (read-only staal).")
    for o in ins.get("observaties", []):
        lines.append(f"- {o}")
    for w in ins.get("workflow_signalen", []):
        lines.append(f"- {w}")
    vragen = ins.get("bevestig", [])
    if vragen:
        lines.append("")
        lines.append("### Nog te bevestigen met de klant")
        lines += [f"- {v}" for v in vragen]
    flows = record.get("workflows") or []
    if flows:
        lines.append("")
        lines.append("### Voorgestelde workflows (uit de audit — stel voor en plan via `hermes cron` na akkoord)")
        lines += [f"- {f}" for f in flows]
    if d.get("doel"):
        lines.append("")
        lines.append(f"### Doel van de klant\n{d['doel']}")
    lines.append(MARK_END)
    block = "\n".join(lines) + "\n"

    current = open(mem_path).read()
    if MARK_BEGIN in current and MARK_END in current:
        pre = current.split(MARK_BEGIN)[0].rstrip("\n")
        post = current.split(MARK_END, 1)[1]
        current = pre + block + post
    else:
        current = current.rstrip("\n") + "\n" + block
    with open(mem_path, "w") as f:
        f.write(current)


def main(token):
    rec_path = os.path.join(AUDIT_DIR, token + ".json")
    with open(rec_path) as f:
        record = json.load(f)

    gathered, bronnen = {}, {"mails": 0, "events": 0}
    conn_dir = os.path.join(CONN_DIR, token)
    for name in sorted(os.listdir(conn_dir)) if os.path.isdir(conn_dir) else []:
        with open(os.path.join(conn_dir, name)) as f:
            conn = json.load(f)
        try:
            if conn["type"] == "imap":
                gathered["mailbox"] = read_imap(conn["fields"])
                bronnen["mails"] = gathered["mailbox"]["mails_in_staal"]
            elif conn["type"] == "ics":
                gathered["agenda"] = read_ics(conn["fields"])
                bronnen["events"] = gathered["agenda"]["events_90_dagen"]
        except Exception as e:
            gathered[conn["tool"]] = {"fout": str(e)[:150]}

    if not gathered:
        return

    try:
        insights = summarize(record, gathered)
        record["insights"] = {
            "created": time.time(),
            "observaties": [str(o)[:200] for o in insights.get("observaties", [])][:6],
            "bevestig": [str(v)[:200] for v in insights.get("bevestig", [])][:4],
            "workflow_signalen": [str(w)[:200] for w in insights.get("workflow_signalen", [])][:3],
            "bron": bronnen,
        }
        record.pop("insights_error", None)
    except Exception as e:
        record["insights_error"] = str(e)[:200]

    tmp = rec_path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    os.replace(tmp, rec_path)

    try:
        sync_memory(record)
    except Exception:
        pass

    # bevindingen als proactief bericht in het gesprek (chat-first)
    try:
        import feed_lib
        ins = record.get("insights") or {}
        if ins.get("observaties"):
            regels = "\n".join("• " + o for o in ins["observaties"][:5])
            vragen = ins.get("bevestig") or []
            vraag = ("\n\n" + vragen[0]) if vragen else ""
            feed_lib.feed_add(token, "agent",
                f"Ik heb je gekoppelde tools gelezen. Dit valt me op:\n{regels}{vraag}")
    except Exception:
        pass


if __name__ == "__main__":
    if len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{32}", sys.argv[1]):
        main(sys.argv[1])
