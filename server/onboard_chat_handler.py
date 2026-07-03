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
import json
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

os.makedirs(STATE_DIR, exist_ok=True)
os.makedirs(AUDIT_DIR, exist_ok=True)
_ip_log = {}  # ip -> [timestamps]

SYSTEM_PROMPT = """Je bent de audit-agent van VO-Initiatives (VOI). Je voert een grondige,
vriendelijke bedrijfsaudit met een Belgische KMO-eigenaar, als voorbereiding op zijn/haar
eigen VOI Agent. Toon: kalme, capabele collega — warm, concreet, nuchter, nooit hype.
Antwoord in de taal van de bezoeker (NL/EN/FR). Kort en gericht: max 3 zinnen + één vraag
per beurt. Nooit meer dan één vraag tegelijk.

FASE 1 — IDENTIFICEER (beurt 1-2): vraag bedrijfsnaam + website. Zodra je website-onderzoek
in je context ziet ("WEBSITE-ONDERZOEK"), bouw je vragen daarop voort ("ik zie dat jullie …").
Vraag in beurt 2-3 ook het e-mailadres ("dan kan de opstart meteen starten").

FASE 2 — PLUIS UIT (de kern): breng systematisch in kaart, met doorvragen:
- Wie ze zijn: activiteit, sector, team (hoeveel mensen, wie doet wat), sinds wanneer.
- Hoe ze werken: de belangrijkste processen stap voor stap (offerte→factuur, order→levering…),
  volumes (per week/maand), seizoenspatronen, waar het schuurt of blijft liggen.
- Tools: welke software voor mail, boekhouding, CRM, planning, communicatie — per proces.
- Doelen: wat moet er over 3 maanden anders zijn; wat is de grootste tijdvreter.
Wees een auditor: vraag door op vage antwoorden ("hoeveel per week ongeveer?", "wie doet dat nu?").

FASE 3 — ROND AF: wanneer je een volledig beeld hebt (of de bezoeker wil afronden), geef je
een korte samenvatting, zeg je dat de verbindingen en de diepere inlees van mails/documenten
volgen tijdens de opstart (na veilige koppeling — nooit wachtwoorden in deze chat), en sluit
je af. Direct NA je afsluitende zin schrijf je op een nieuwe regel exact dit blok:
###DOSSIER###
{"naam":"…","email":"…","bedrijf":"…","telefoon":"…","tools":"…","taak":"…","uren":"…","doel":"…"}
Elke waarde beknopt maar volledig (max 1800 tekens), in het Nederlands. "taak" = de processen/
workflows die de agent gaat overnemen; "tools" = alle genoemde software; "uren" = geschat
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


def _fetch_site(text):
    """Licht publiek onderzoek: haal de website uit het bericht en lees hem."""
    m = re.search(r"(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})(/\S*)?", text, re.I)
    if not m:
        return None
    host = m.group(1).lower()
    for url in (f"https://{host}", f"https://www.{host}", f"http://{host}"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "VOI-audit/1.0"})
            html = urllib.request.urlopen(req, timeout=8).read(300_000).decode("utf-8", "ignore")
            txt = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
            txt = re.sub(r"<[^>]+>", " ", txt)
            txt = re.sub(r"\s+", " ", txt).strip()
            vat = re.search(r"BE ?0?\d{3}[. ]?\d{3}[. ]?\d{3}", html)
            head = f"WEBSITE-ONDERZOEK ({url})" + (f" · BTW gevonden: {vat.group(0)}" if vat else "")
            return head + ":\n" + txt[:6000]
        except Exception:
            continue
    return None


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
        "connections": [t.strip() for t in payload["tools"].split(",") if t.strip()],
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


def _load_record(token):
    if not re.fullmatch(r"[0-9a-f]{32}", token or ""):
        return None
    p = os.path.join(AUDIT_DIR, token + ".json")
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return None


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
                "workflows": rec.get("workflows", []),
                "status": rec.get("status", ""),
                "doel": rec.get("doel", ""),
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

        # eenmalig publiek onderzoek zodra er een domein voorbijkomt
        research = None
        if not sess["researched"]:
            research = _fetch_site(msg)
            if research:
                sess["researched"] = True

        convo = [{"role": "system", "content": SYSTEM_PROMPT + f"\n\nTaal van de bezoeker: {lang}."}]
        if research:
            convo.append({"role": "system", "content": research})
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
