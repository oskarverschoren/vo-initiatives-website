#!/usr/bin/env python3
"""VOI onboarding chat-audit handler (web).

Interactieve audit-chat voor /start: het model ondervraagt de bezoeker grondig
(naar het model van skills/productivity/belgian-business-audit), doet vooraf
licht publiek onderzoek (website ophalen), en schrijft aan het einde een schoon
klantdossier naar AUDIT_DIR. Dat record is de bron voor het web-dashboard
(/dashboard?id=<token>); een agent bouwt daaruit later de cockpit op.

Draait loopback-only; nginx proxyt:
    /api/onboard/chat           -> 127.0.0.1:8097  (POST gesprek, GET /health, GET /status)
    /api/onboard/stripe-webhook -> 127.0.0.1:8097  (Stripe checkout.session.completed)
    /api/dashboard?id=<token>   -> 127.0.0.1:8097  (GET klantrecord voor het dashboard)

ENV (zet in de systemd-unit):
    OPENROUTER_API_KEY   verplicht — VO's eigen key (NIET een klant-key)
    CHAT_MODEL           default "anthropic/claude-haiku-4.5"
    FREE_TURNS           default 8   — beurten vóór de paywall
    PAYWALL              "1" = aan, default "0" (gratis, alleen caps)
    STRIPE_LINK          Payment Link URL (uit create-stripe-link.sh)
    STRIPE_WEBHOOK_SECRET whsec_... — zonder secret worden webhooks GEWEIGERD
    ONBOARD_URL          default http://127.0.0.1:8099/api/onboard
    STATE_DIR            default /root/.hermes/onboard-chat
    MAX_TURNS            default 30  — harde bovengrens per sessie
    IP_SESSIONS_PER_HOUR default 3
"""
import hashlib
import hmac
import imaplib
import json
import subprocess
import sys
import os
import re
import time
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
MODEL = os.environ.get("CHAT_MODEL", "anthropic/claude-haiku-4.5")
FREE_TURNS = int(os.environ.get("FREE_TURNS", "8"))
PAYWALL = os.environ.get("PAYWALL", "0") == "1"
STRIPE_LINK = os.environ.get("STRIPE_LINK", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
ONBOARD_URL = os.environ.get("ONBOARD_URL", "http://127.0.0.1:8099/api/onboard")
STATE_DIR = os.environ.get("STATE_DIR", "/root/.hermes/onboard-chat")
AUDIT_DIR = os.environ.get("AUDIT_DIR", "/root/.hermes/audits")
MAX_TURNS = int(os.environ.get("MAX_TURNS", "30"))
IP_SESSIONS_PER_HOUR = int(os.environ.get("IP_SESSIONS_PER_HOUR", "3"))

CONN_DIR = os.environ.get("CONN_SECRETS_DIR", "/root/.hermes/audit-connections")

os.makedirs(STATE_DIR, exist_ok=True)
os.makedirs(AUDIT_DIR, exist_ok=True)
os.makedirs(CONN_DIR, exist_ok=True)
try:
    os.chmod(CONN_DIR, 0o700)
except OSError:
    pass
_ip_log = {}  # ip -> [timestamps]

SYSTEM_PROMPT = """Je bent de audit-agent van VO-Initiatives (VOI). Je voert een grondige,
vriendelijke bedrijfsaudit met een Belgische KMO-eigenaar, als voorbereiding op zijn/haar
eigen VOI Agent. Toon: kalme, capabele collega — warm, concreet, nuchter, nooit hype.
Antwoord in de taal van de bezoeker (NL/EN/FR). Kort en gericht: max 3 zinnen + één vraag
per beurt. Nooit meer dan één vraag tegelijk.

FASE 1 — IDENTIFICEER (beurt 1-2): vraag bedrijfsnaam + website. Zodra je website-onderzoek
in je context ziet ("WEBSITE-ONDERZOEK"), gebruik je het actief: leid de bedrijfsnaam en
activiteit eruit af en BEVESTIG ze ("ik zie dat jullie X doen — klopt dat?") in plaats van
ernaar te vragen. Staat er "WEBSITE-ONDERZOEK-MISLUKT", zeg dan eerlijk dat de site weinig
prijsgaf en vraag naar de juiste website.
Vraag in beurt 2-3 ook het e-mailadres én telefoonnummer ("dan kan de opstart meteen starten").

FASE 2 — KERN (kort — streef naar 5 à 6 vragen totaal): breng alleen de hoofdlijnen in kaart:
- Activiteit + teamgrootte (één vraag).
- De 1 à 3 grootste tijdvreters die eruit moeten, met een ruwe volume-indicatie.
- Welke tools ze gebruiken voor mail, boekhouding, CRM en planning (één vraag).
- Wat er over 3 maanden anders moet zijn.
Vraag GEEN organigram-details (wie precies wat doet) en geen stap-voor-stap procesbeschrijvingen —
die details lees je straks zelf uit de gekoppelde tools tijdens de diepere audit, en dat zeg je
ook zo ("dat hoef je me niet uit te leggen — dat zie ik zo zelf in je agenda/mailbox zodra je
koppelt"). Eén verduidelijkingsvraag bij een vaag antwoord, daarna verder.

FASE 3 — ROND AF (begin het afronden vanaf beurt 6 à 8): geef een korte samenvatting en zeg dat
de echte diepgang in het dashboard gebeurt: daar koppelt de klant zijn tools en lees jij zelf
hoe alles loopt (nooit wachtwoorden in deze chat). Direct NA je afsluitende zin schrijf je op een nieuwe regel exact dit blok:
###DOSSIER###
{"naam":"…","email":"…","bedrijf":"…","telefoon":"…","tools":"…","taak":"…","uren":"…","doel":"…"}
Elke waarde beknopt maar volledig (max 1800 tekens), in het Nederlands. "taak" = de processen/
workflows die de agent gaat overnemen; "tools" = ALLEEN de losse app-/softwarenamen, komma-gescheiden, zonder uitleg
(dus "CrewPlanner, Gmail, Exact" — NIET "CrewPlanner voor planning; ..."). Noem tools die ze
niet gebruiken niet; "uren" = geschat
tijdverlies; "doel" = de doelen + belangrijkste context over het bedrijf (sector, team, volumes).

REGELS: geen wachtwoorden/API-keys vragen of aannemen. Geen prijzen beloven buiten wat de
site zegt. Geen claims over andere klanten. Als iets buiten je bereik valt: verwijs naar het
gesprek met Oskar (cal.com-link staat op de site)."""


def _now():
    return time.time()


def _session_path(sid):
    if not re.fullmatch(r"[0-9a-f]{32}", sid or ""):
        return None
    return os.path.join(STATE_DIR, sid + ".json")


def _load(sid):
    p = _session_path(sid)
    if p and os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return None


def _save(sess):
    with open(_session_path(sess["id"]), "w") as f:
        json.dump(sess, f, ensure_ascii=False)


def _rate_ok(ip):
    ts = [t for t in _ip_log.get(ip, []) if _now() - t < 3600]
    _ip_log[ip] = ts
    if len(ts) >= IP_SESSIONS_PER_HOUR:
        return False
    ts.append(_now())
    return True


def _fetch_one(url):
    req = urllib.request.Request(url, headers={"User-Agent": "VOI-audit/1.0"})
    html = urllib.request.urlopen(req, timeout=6).read(300_000).decode("utf-8", "ignore")
    txt = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    vat = re.search(r"BE ?0?\d{3}[. ]?\d{3}[. ]?\d{3}", html)
    return txt, (vat.group(0) if vat else None)


def _fetch_site(text):
    """Publiek onderzoek volgens de audit-skill: probeer domein-varianten
    (www, alternatieve TLD .be/.com — Belgische sites zitten vaak op .be) en
    veelgebruikte paden; lege lander-pagina's tellen niet als resultaat.
    Geeft (onderzoek, host) terug; onderzoek is None als niets bruikbaars."""
    m = re.search(r"(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})(/\S*)?", text, re.I)
    if not m:
        return None, None
    host = m.group(1).lower().removeprefix("www.")
    variants = [host, "www." + host]
    base, _, tld = host.rpartition(".")
    if base and tld == "com":
        variants += [base + ".be", "www." + base + ".be"]
    elif base and tld == "be":
        variants += [base + ".com"]
    attempts = 0
    for h in variants:
        for path in ("", "/nl", "/en"):
            if attempts >= 8:
                return None, host
            attempts += 1
            url = f"https://{h}{path}"
            try:
                txt, vat = _fetch_one(url)
            except Exception:
                continue
            if len(txt) < 400:  # lege lander/redirect-pagina — geen echt resultaat
                continue
            head = f"WEBSITE-ONDERZOEK ({url})" + (f" · BTW gevonden: {vat}" if vat else "")
            return head + ":\n" + txt[:6000], host
    return None, host


def _llm(messages):
    body = json.dumps({
        "model": MODEL,
        "messages": messages,
        "max_tokens": 600,
        "temperature": 0.6,
    }).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vo-initiatives.com",
            "X-Title": "VOI onboarding audit",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    return data["choices"][0]["message"]["content"]


def _extract_dossier(reply):
    if "###DOSSIER###" not in reply:
        return reply, None
    visible, _, tail = reply.partition("###DOSSIER###")
    m = re.search(r"\{.*\}", tail, re.S)
    dossier = None
    if m:
        try:
            dossier = json.loads(m.group(0))
        except Exception:
            dossier = None
    return visible.strip(), dossier


def _clean_tools(raw):
    """Maak van een tools-veld een schone lijst app-namen: split op , en ;,
    kap uitleg achter 'voor'/'(' af, gooi fragmenten zonder echte tool weg."""
    out, seen = [], set()
    for part in re.split(r"[;,]", raw or ""):
        name = re.split(r"\bvoor\b|\(", part, maxsplit=1)[0].strip(" .·-")
        low = name.lower()
        if not name or len(name) > 40:
            continue
        if any(w in low for w in ("nog niet", "geen ", "onbekend", "n.v.t", "diverse", "andere")):
            continue
        # los "Google/Gmail" op in aparte namen
        for tok in re.split(r"\s*/\s*", name):
            tok = tok.strip()
            if tok and tok.lower() not in seen:
                seen.add(tok.lower())
                out.append(tok)
    return out[:12]


def _save_customer_record(sess, dossier):
    """Schrijf een schoon klantdossier naar AUDIT_DIR (losgekoppeld van Nova).
    Dit record is de bron voor het dashboard-build. Geeft het dashboard-token
    terug, of None als opslaan mislukt (dan tonen we geen valse success)."""
    payload = {k: str(dossier.get(k, ""))[:1900] for k in
               ("naam", "email", "bedrijf", "telefoon", "tools", "taak", "uren", "doel")}
    token = uuid.uuid4().hex
    record = {
        "token": token,
        "created": _now(),
        "status": "audit_complete",
        "lang": sess.get("lang", "nl"),
        "profile": {k: payload[k] for k in ("naam", "email", "bedrijf", "telefoon")},
        "connections": _clean_tools(payload["tools"]),
        "workflows": [t.strip() for t in re.split(r"[;\n]", payload["taak"]) if t.strip()],
        "uren": payload["uren"],
        "doel": payload["doel"],
        "dossier": payload,
        "transcript": sess.get("messages", []),
    }
    try:
        tmp = os.path.join(AUDIT_DIR, token + ".json.tmp")
        with open(tmp, "w") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
        os.replace(tmp, os.path.join(AUDIT_DIR, token + ".json"))
        sess["customer_token"] = token
        return token
    except Exception:
        return None


def _save_record(record):
    tmp = os.path.join(AUDIT_DIR, record["token"] + ".json.tmp")
    with open(tmp, "w") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    os.replace(tmp, os.path.join(AUDIT_DIR, record["token"] + ".json"))


def _load_record(token):
    if not re.fullmatch(r"[0-9a-f]{32}", token or ""):
        return None
    p = os.path.join(AUDIT_DIR, token + ".json")
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return None


# ---- verbindingen (Fase 3): IMAP app-wachtwoord, ICS-agenda, API-key ----
IMAP_HOSTS = {
    "gmail": "imap.gmail.com", "google": "imap.gmail.com",
    "outlook": "outlook.office365.com", "hotmail": "outlook.office365.com",
    "office": "outlook.office365.com",
}


def _conn_type_for(tool):
    t = tool.lower()
    # agenda eerst — "Google Agenda" mag niet op de mail-key "google" matchen
    if "agenda" in t or "calendar" in t or "cal.com" in t:
        return "ics", None
    for key, host in IMAP_HOSTS.items():
        if key in t:
            return "imap", host
    return "apikey", None


def _test_imap(host, email, password):
    try:
        box = imaplib.IMAP4_SSL(host, 993, timeout=10)
        box.login(email, password)
        box.logout()
        return True, None
    except Exception as e:
        msg = str(e)
        if "AUTHENTICATIONFAILED" in msg.upper() or "INVALID CREDENTIALS" in msg.upper():
            return False, "app_password"  # signaal voor vriendelijke, vertaalde melding
        return False, msg[:200]


def _test_ics(url):
    if not url.startswith(("https://", "webcal://")):
        return False, "geef de geheime iCal/ICS-link (begint met https://)"
    try:
        req = urllib.request.Request(url.replace("webcal://", "https://", 1),
                                     headers={"User-Agent": "VOI-audit/1.0"})
        head = urllib.request.urlopen(req, timeout=10).read(2048).decode("utf-8", "ignore")
        if "BEGIN:VCALENDAR" in head:
            return True, None
        return False, "die link geeft geen agenda (ICS) terug"
    except Exception as e:
        return False, str(e)[:200]


def _store_connection(token, tool, conn_type, fields):
    """Credentials apart van het record, 0600, worden nooit teruggegeven."""
    d = os.path.join(CONN_DIR, token)
    os.makedirs(d, exist_ok=True)
    os.chmod(d, 0o700)
    safe = re.sub(r"[^a-z0-9-]+", "-", tool.lower())[:40] or "tool"
    p = os.path.join(d, safe + ".json")
    with open(p, "w") as f:
        json.dump({"tool": tool, "type": conn_type, "fields": fields, "created": _now()}, f)
    os.chmod(p, 0o600)


def _set_conn_status(record, tool, status):
    st = record.setdefault("connections_status", {})
    st[tool] = status
    tmp = os.path.join(AUDIT_DIR, record["token"] + ".json.tmp")
    with open(tmp, "w") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    os.replace(tmp, os.path.join(AUDIT_DIR, record["token"] + ".json"))


DEEP_AUDIT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deep_audit.py")


def _spawn_deep_audit(token):
    """Start de inlees-agent op de achtergrond; mag nooit de koppel-flow blokkeren."""
    try:
        subprocess.Popen([sys.executable, DEEP_AUDIT, token],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)
    except Exception:
        pass


# ---- brug naar de Hermes-pipeline: provisioner + per-klant gateway-chat ----
PROVISION = "/root/.hermes/scripts/provision_client.py"
CLIENTS_DIR = "/root/.hermes/clients"


def _slug(value):
    v = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return v[:50] or "klant"


def _spawn_provision(record):
    """Alle verplichte velden aanwezig -> dossier wegschrijven en de
    provisioner starten (credit-safe: key blijft PENDING tot goedkeuring)."""
    dossier = dict(record.get("dossier", {}))
    if not all(str(dossier.get(k, "")).strip() for k in ("bedrijf", "email", "telefoon", "taak")):
        return None
    dossier.setdefault("kanaal", "app")
    path = os.path.join(AUDIT_DIR, record["token"] + "-dossier.json")
    with open(path, "w") as f:
        json.dump(dossier, f, ensure_ascii=False, indent=2)
    try:
        subprocess.Popen([sys.executable, PROVISION, path],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)
    except Exception:
        return None
    return {"slug": _slug(dossier.get("bedrijf")), "spawned": _now()}


def _gateway_for(slug):
    """Poort + key van de per-klant Hermes-gateway, als die bestaat."""
    try:
        with open(os.path.join(CLIENTS_DIR, slug, "app_env.json")) as f:
            env = json.load(f)
        port = int(env.get("API_SERVER_PORT", 0))
        key = env.get("API_SERVER_KEY", "")
        if port and key:
            return port, key
    except Exception:
        pass
    return None, None


def _gateway_chat(port, key, message):
    body = json.dumps({
        "model": "voi-agent",
        "messages": [{"role": "user", "content": message}],
    }).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/v1/chat/completions", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read())
    return data["choices"][0]["message"]["content"]


def _provision_view(rec):
    prov = rec.get("provision")
    if not prov:
        return None
    slug = prov.get("slug", "")
    port, key = _gateway_for(slug)
    return {"slug": slug, "active": bool(port),
            "provisioned": os.path.isdir(os.path.join(CLIENTS_DIR, slug))}


def _verify_stripe(sig_header, body):
    if not STRIPE_WEBHOOK_SECRET:
        return False
    try:
        parts = dict(p.split("=", 1) for p in sig_header.split(","))
        signed = f"{parts['t']}.{body.decode()}"
        expected = hmac.new(STRIPE_WEBHOOK_SECRET.encode(), signed.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, parts.get("v1", ""))
    except Exception:
        return False


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _ip(self):
        return self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        if path == "/api/onboard/chat/health":
            return self._send(200, {"ok": bool(API_KEY), "paywall": PAYWALL})
        if path == "/api/onboard/chat/status":
            m = re.search(r"session=([0-9a-f]{32})", self.path)
            sess = _load(m.group(1)) if m else None
            if not sess:
                return self._send(404, {"ok": False})
            return self._send(200, {"ok": True, "paid": sess.get("paid", False), "turns": sess.get("turns", 0)})
        if path == "/api/dashboard":
            m = re.search(r"id=([0-9a-f]{32})", self.path)
            rec = _load_record(m.group(1)) if m else None
            if not rec:
                return self._send(404, {"ok": False})
            return self._send(200, {
                "ok": True,
                "profile": rec.get("profile", {}),
                "connections": rec.get("connections", []),
                "connections_status": rec.get("connections_status", {}),
                "workflows": rec.get("workflows", []),
                "status": rec.get("status", ""),
                "doel": rec.get("doel", ""),
                "insights": rec.get("insights"),
                "provision": _provision_view(rec),
            })
        return self._send(404, {"ok": False})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        if length > 100_000:
            return self._send(413, {"ok": False, "error": "te groot"})
        body = self.rfile.read(length)
        path = self.path.rstrip("/")

        if path == "/api/onboard/stripe-webhook":
            if not _verify_stripe(self.headers.get("Stripe-Signature", ""), body):
                return self._send(400, {"ok": False})
            try:
                event = json.loads(body)
                if event.get("type") == "checkout.session.completed":
                    ref = event["data"]["object"].get("client_reference_id", "")
                    sess = _load(ref)
                    if sess:
                        sess["paid"] = True
                        _save(sess)
            except Exception:
                pass
            return self._send(200, {"ok": True})

        if path == "/api/dashboard/connect":
            try:
                data = json.loads(body)
            except Exception:
                return self._send(400, {"ok": False, "error": "ongeldige JSON"})
            rec = _load_record(str(data.get("id", "")))
            tool = str(data.get("tool", "")).strip()[:60]
            if not rec or not tool:
                return self._send(404, {"ok": False, "error": "onbekend dashboard of tool"})
            attempts = rec.get("connect_attempts", 0)
            if attempts >= 25:
                return self._send(429, {"ok": False, "error": "te veel pogingen"})
            rec["connect_attempts"] = attempts + 1
            conn_type, host = _conn_type_for(tool)
            if conn_type == "imap":
                email = str(data.get("email", "")).strip()[:200]
                password = str(data.get("password", ""))[:200]
                if not email or not password:
                    _set_conn_status(rec, tool, "todo")
                    return self._send(400, {"ok": False, "error": "e-mail en app-wachtwoord zijn nodig"})
                ok, err = _test_imap(host, email, password)
                if not ok:
                    _set_conn_status(rec, tool, "fout")
                    if err == "app_password":
                        return self._send(400, {"ok": False, "code": "app_password",
                                                "error": "gebruik een app-wachtwoord, niet je gewone wachtwoord"})
                    return self._send(400, {"ok": False, "error": "koppeling geweigerd: " + (err or "onbekend")})
                _store_connection(rec["token"], tool, "imap", {"host": host, "email": email, "password": password})
            elif conn_type == "ics":
                url = str(data.get("url", "")).strip()[:500]
                ok, err = _test_ics(url)
                if not ok:
                    _set_conn_status(rec, tool, "fout")
                    return self._send(400, {"ok": False, "error": err or "ongeldige agenda-link"})
                _store_connection(rec["token"], tool, "ics", {"url": url})
            else:
                apikey = str(data.get("apikey", "")).strip()[:500]
                if not apikey:
                    return self._send(400, {"ok": False, "error": "API-key is nodig"})
                _store_connection(rec["token"], tool, "apikey", {"apikey": apikey})
            _set_conn_status(rec, tool, "verbonden")
            _spawn_deep_audit(rec["token"])
            return self._send(200, {"ok": True, "tool": tool, "status": "verbonden"})

        if path == "/api/dashboard/chat":
            try:
                data = json.loads(body)
            except Exception:
                return self._send(400, {"ok": False, "error": "ongeldige JSON"})
            rec = _load_record(str(data.get("id", "")))
            msg = str(data.get("message", "")).strip()[:4000]
            if not rec or not msg:
                return self._send(404, {"ok": False})
            prov = rec.get("provision") or {}
            port, key = _gateway_for(prov.get("slug", ""))
            if not port:
                return self._send(409, {"ok": False, "code": "not_active"})
            try:
                reply = _gateway_chat(port, key, msg)
            except Exception:
                return self._send(502, {"ok": False, "code": "gateway_error"})
            return self._send(200, {"ok": True, "reply": reply})

        if path != "/api/onboard/chat":
            return self._send(404, {"ok": False})
        if not API_KEY:
            return self._send(503, {"ok": False, "error": "chat niet geconfigureerd"})

        try:
            data = json.loads(body)
        except Exception:
            return self._send(400, {"ok": False, "error": "ongeldige JSON"})
        msg = str(data.get("message", "")).strip()[:4000]
        lang = str(data.get("lang", "nl"))[:2]
        if not msg:
            return self._send(400, {"ok": False, "error": "leeg bericht"})

        sid = data.get("session", "")
        sess = _load(sid)
        if not sess:
            if not _rate_ok(self._ip()):
                return self._send(429, {"ok": False, "error": "te veel sessies — probeer later opnieuw"})
            sess = {"id": uuid.uuid4().hex, "created": _now(), "ip": self._ip(),
                    "turns": 0, "paid": False, "lang": lang, "messages": [], "researched": False}

        if sess["turns"] >= MAX_TURNS:
            token = _save_customer_record(sess, {k: "" for k in
                                                 ("naam", "email", "bedrijf", "telefoon", "tools", "taak", "uren", "doel")})
            out = {"ok": True, "session": sess["id"], "done": True,
                   "reply": "We hebben genoeg om mee te starten — je dashboard wordt nu opgezet."}
            if token:
                out["dashboard_url"] = "/dashboard?id=" + token
            return self._send(200, out)
        if PAYWALL and not sess["paid"] and sess["turns"] >= FREE_TURNS:
            url = STRIPE_LINK + ("&" if "?" in STRIPE_LINK else "?") + "client_reference_id=" + sess["id"]
            _save(sess)
            return self._send(200, {"ok": True, "session": sess["id"], "paywall": True, "payment_url": url})

        sess["messages"].append({"role": "user", "content": msg})

        # publiek onderzoek: bij elk nieuw domein in het gesprek, tot het lukt;
        # het resultaat blijft in de sessie zodat ELKE beurt het meekrijgt
        if not sess.get("research") or sess.get("research_failed"):
            research, host = _fetch_site(msg)
            if research:
                sess["research"] = research
                sess["research_failed"] = False
            elif host and host != sess.get("research_host"):
                sess["research"] = (f"WEBSITE-ONDERZOEK-MISLUKT: {host} gaf geen bruikbare "
                                    "inhoud (lege pagina of redirect). Zeg dit eerlijk en "
                                    "vraag naar de juiste website, of ga verder met vragen.")
                sess["research_failed"] = True
            if host:
                sess["research_host"] = host

        convo = [{"role": "system", "content": SYSTEM_PROMPT + f"\n\nTaal van de bezoeker: {lang}."}]
        if sess.get("research"):
            convo.append({"role": "system", "content": sess["research"]})
        convo += sess["messages"][-24:]

        try:
            raw = _llm(convo)
        except Exception:
            return self._send(502, {"ok": False, "error": "agent tijdelijk niet bereikbaar"})

        reply, dossier = _extract_dossier(raw)
        sess["messages"].append({"role": "assistant", "content": raw})
        sess["turns"] += 1

        out = {"ok": True, "session": sess["id"], "reply": reply, "done": False}
        if dossier:
            token = _save_customer_record(sess, dossier)
            if token:
                rec = _load_record(token)
                prov = _spawn_provision(rec)
                if prov:
                    rec["provision"] = prov
                    _save_record(rec)
                out["done"] = True
                out["dashboard_url"] = "/dashboard?id=" + token
                out["preview"] = {
                    "naam": dossier.get("naam", ""),
                    "tools": [t.strip() for t in str(dossier.get("tools", "")).split(",") if t.strip()][:8],
                    "flows": [t.strip() for t in re.split(r"[;\n]", str(dossier.get("taak", ""))) if t.strip()][:5],
                }
            else:
                # opslaan mislukt: geen valse "klaar" tonen, laat de bezoeker het opnieuw proberen
                out["reply"] = reply + "\n\n(Ik kon je audit even niet opslaan — stuur je laatste bericht nog eens.)"
        _save(sess)
        return self._send(200, out)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8097), Handler).serve_forever()
