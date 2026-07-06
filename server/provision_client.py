#!/usr/bin/env python3
"""Managed-assistant provisioning engine (Telegram-first).

Neemt één dossier-JSON (uit NOVA/inbox) en doorloopt de deterministische
bouwstappen voor een MANAGED klant-assistent. Idempotent: al-gedane stappen
worden overgeslagen. Wat een mens/secret nodig heeft, wordt netjes als PENDING
gemarkeerd i.p.v. gefaket.

STRICTE SCHEIDING (hard guardrail):
  - Secrets (OpenRouter per-klant key + hash, Telegram bot-token) → ALLEEN in
    /root/.hermes/secrets/<slug>.json (chmod 600). NOOIT in de vault.
  - Niet-geheime status/checklist → /root/.hermes/vault/.../NOVA/clients/<slug>.md
    (die mag naar GitHub syncen).
  - Runtime-config (model, cap, kanaal, status, verwijzing naar key-hash) →
    /root/.hermes/clients/<slug>/config.json (buiten de vault).

GEEN account/key aanmaken namens de KLANT: de OpenRouter-key wordt aangemaakt op
VO's eigen provisioning-key (VO-infra), met een harde maand-cap (fair-use).

Cap-fases per klant:
  - opstart (~2 weken): $50, ruimte om ~10 automatiseringen te bouwen/uitzoeken
  - run (daarna):       $15/maand voor de draaiende automatiseringen
Nieuwe klanten starten op de opstart-cap. Na de sprint omschakelen met
--switch-to-run-cap (verlaagt de bestaande key via de OpenRouter-API).

Gebruik:
  python3 provision_client.py /pad/naar/dossier.json
  python3 provision_client.py --status <slug>
  python3 provision_client.py --approve-key <slug>
  python3 provision_client.py --switch-to-run-cap <slug>
"""
import json, os, re, sys, time, urllib.request, urllib.error
import uuid, secrets as _secrets

HERMES = "/root/.hermes"
ENV = f"{HERMES}/.env"
VAULT_CLIENTS = f"{HERMES}/vault/vo-brain/NOVA/clients"
SECRETS_DIR = f"{HERMES}/secrets"            # buiten de vault!
CLIENTS_DIR = f"{HERMES}/clients"            # buiten de vault!
PROFILES_DIR = f"{HERMES}/profiles"          # per-klant Hermes-profielen
LOG = f"{HERMES}/logs/provision.log"

# Fair-use grenzen per klant (USD). Bundel-onderdeel van de dienst, geen
# doorverkoop. Twee fases:
#   - opstart (eerste ~2 weken): hogere cap om ~10 automatiseringen te bouwen/uitzoeken
#   - run (daarna): lagere maand-cap voor de draaiende automatiseringen
STARTUP_CAP = float(os.environ.get("VO_CLIENT_STARTUP_CAP", "50"))   # 2-weken opstart-sprint
RUN_CAP     = float(os.environ.get("VO_CLIENT_RUN_CAP", "15"))       # daarna, per maand
# Backward-compat: nieuwe klanten starten op de opstart-cap.
DEFAULT_MONTHLY_CAP = float(os.environ.get("VO_CLIENT_MONTHLY_CAP", str(STARTUP_CAP)))
CLIENT_MODEL = os.environ.get("VO_CLIENT_MODEL", "google/gemini-2.5-flash")

REQUIRED = ("bedrijf", "email", "telefoon", "taak")


# ---------- helpers ----------
def _env(key, default=""):
    try:
        with open(ENV) as f:
            for line in f:
                line = line.strip()
                if line.startswith(key + "="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return default


def _log(msg):
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    line = f"[{time.strftime('%F %T')}] {msg}"
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass
    print(line)


def _slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s[:50] or "klant"


def _telegram(msg):
    tok, chat = _env("TELEGRAM_BOT_TOKEN"), _env("TELEGRAM_CHAT_ID")
    if not (tok and chat):
        return
    try:
        import urllib.parse
        data = urllib.parse.urlencode({"chat_id": chat, "text": msg}).encode()
        urllib.request.urlopen(
            f"https://api.telegram.org/bot{tok}/sendMessage", data=data, timeout=10)
    except Exception:
        pass


def _read_json(path, default=None):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {} if default is None else default


def _write_secret(slug, data):
    """Per-klant secrets — buiten de vault, 0600."""
    os.makedirs(SECRETS_DIR, exist_ok=True)
    os.chmod(SECRETS_DIR, 0o700)
    path = f"{SECRETS_DIR}/{slug}.json"
    existing = _read_json(path, {})
    existing.update(data)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(existing, f, indent=2)
    return path


def _write_config(slug, data):
    d = f"{CLIENTS_DIR}/{slug}"
    os.makedirs(d, exist_ok=True)
    path = f"{d}/config.json"
    cfg = _read_json(path, {})
    cfg.update(data)
    with open(path, "w") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    return cfg


# ---------- desktop install tokens + sync credential ----------
STATE_DIR = f"{HERMES}/state"
INSTALL_TOKENS = f"{STATE_DIR}/install_tokens.json"
INSTALL_TOKEN_TTL_DAYS = 30


def _ensure_sync_token(slug):
    """Per-client desktop sync credential in secrets/<slug>.json (0600).
    Idempotent: returns the existing token if present, else mints one.
    The value is never logged or returned to any transcript."""
    existing = _read_json(f"{SECRETS_DIR}/{slug}.json", {})
    tok = existing.get("sync_token")
    if not tok:
        tok = _secrets.token_urlsafe(32)
        _write_secret(slug, {"sync_token": tok,
                             "sync_token_added_at": int(time.time())})
    return tok


def generate_install_token(slug):
    """Mint a one-time-use desktop-install token (30-day expiry) for <slug>.
    Stored in state/install_tokens.json keyed by token uuid. Ensures the
    client's sync_token exists too. Returns the token string."""
    slug = _slug(slug)
    os.makedirs(STATE_DIR, exist_ok=True)
    now = int(time.time())
    tokens = _read_json(INSTALL_TOKENS, {})
    token = uuid.uuid4().hex
    tokens[token] = {
        "token": token,
        "slug": slug,
        "created_at": now,
        "expires_at": now + INSTALL_TOKEN_TTL_DAYS * 86400,
        "used": False,
        "used_at": None,
    }
    tmp = INSTALL_TOKENS + ".tmp"
    with open(tmp, "w") as f:
        json.dump(tokens, f, indent=2)
    os.replace(tmp, INSTALL_TOKENS)
    _ensure_sync_token(slug)
    return token


# ---------- stap 1: dossier valideren ----------
def validate(dossier):
    missing = [f for f in REQUIRED if not str(dossier.get(f, "")).strip()]
    return missing


# ---------- stap 2: per-klant OpenRouter-key met harde maand-cap ----------
def provision_or_key(slug, bedrijf, cap=DEFAULT_MONTHLY_CAP):
    """Maakt een per-klant key met maand-cap op VO's provisioning-key.

    Echt werkend zodra OPENROUTER_PROVISIONING_KEY in .env staat. Zonder die key:
    PENDING (niet faken). Idempotent: bestaat er al een key-hash, dan skip.
    """
    secrets = _read_json(f"{SECRETS_DIR}/{slug}.json", {})
    if secrets.get("openrouter_key_hash"):
        return ("done", f"key bestaat al (hash {secrets['openrouter_key_hash'][:12]}…)")

    prov = _env("OPENROUTER_PROVISIONING_KEY")
    if not prov:
        return ("pending", "OPENROUTER_PROVISIONING_KEY ontbreekt in .env "
                           "(Oskar moet die eenmalig aanmaken in het OpenRouter-dashboard)")

    # Anti-abuse/kostenrem: maak NIET automatisch een betaalde key aan bij elke
    # (mogelijk nep-)aanvraag. Standaard wacht de key op expliciete goedkeuring:
    #   python3 provision_client.py --approve-key <slug>
    # Zet VO_AUTO_PROVISION_KEY=1 om dit per run te overrulen.
    if os.environ.get("VO_AUTO_PROVISION_KEY", "0") != "1":
        return ("pending", f"key wacht op goedkeuring — run: "
                           f"provision_client.py --approve-key {slug}")

    body = json.dumps({
        "name": f"vo-client-{slug}",
        "limit": cap,
        "limit_reset": "monthly",
    }).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/keys",
        data=body, method="POST",
        headers={"Authorization": f"Bearer {prov}",
                 "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            resp = json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        return ("error", f"OpenRouter weigerde key-aanmaak (HTTP {e.code}): {detail}")
    except Exception as e:
        return ("error", f"netwerk-/onbekende fout bij key-aanmaak: {e}")

    key = resp.get("key", "")
    data = resp.get("data", {}) or {}
    khash = data.get("hash", "")
    if not key or not khash:
        return ("error", f"onverwacht antwoord van OpenRouter: {str(resp)[:200]}")

    # Secret weg uit de vault; alleen hash + cap in niet-geheime config.
    _write_secret(slug, {"openrouter_key": key, "openrouter_key_hash": khash,
                         "openrouter_cap_usd": cap, "created_at": time.strftime('%F %T')})
    return ("done", f"key aangemaakt (hash {khash[:12]}…, cap ${cap:.0f}/maand)")


# ---------- stap 3: kanaal koppelen ----------
def normalize_kanaal(raw):
    """Maak de kanaalkeuze van de bezoeker robuust. Default = telegram."""
    k = (raw or "").strip().lower()
    if "whats" in k or k == "wa":
        return "whatsapp"
    if "voi" in k or "app" in k or "desktop" in k:
        return "voi-agent"
    return "telegram"


def _allocate_app_port():
    """Find the next free port for a VOI Agent desktop gateway (8700+)."""
    import socket
    HERMES = "/root/.hermes"
    PORT_STATE = f"{HERMES}/state/app_ports.json"
    try:
        with open(PORT_STATE) as f:
            import json as _j
            used = set(_j.load(f).values())
    except Exception:
        used = set()
    port = 8700
    while port in used or _port_in_use(port):
        port += 1
    return port


def _port_in_use(port):
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def _save_app_port(slug, port):
    import json as _j
    HERMES = "/root/.hermes"
    PORT_STATE = f"{HERMES}/state/app_ports.json"
    os.makedirs(os.path.dirname(PORT_STATE), exist_ok=True)
    try:
        with open(PORT_STATE) as f:
            data = _j.load(f)
    except Exception:
        data = {}
    data[slug] = port
    with open(PORT_STATE, "w") as f:
        _j.dump(data, f, indent=2)


def setup_channel(slug, kanaal):
    """Kanaal koppelen op basis van de keuze van de klant. Beide kanalen worden
    ondersteund:
      - Telegram: per-klant BotFather-token in de secrets (mens-stap: Oskar maakt
        de bot aan). Schaalt schoon: 1 bot per klant via een token-drop.
      - WhatsApp: ingebouwde Baileys-bridge (emuleert WhatsApp Web — GEEN Meta
        Business API, geen Twilio, geen developer-account). Setup is interactief:
        'hermes whatsapp' wizard + QR scannen met een APART klant-nummer. Elke
        klant = eigen nummer + eigen bridge-sessie; conversational gebruik, geen
        bulk/uitgaande spam (kleine ban-kans).
    Tokens/sessies horen in de secrets/bridge-state, NIET in de vault.
    """
    secrets = _read_json(f"{SECRETS_DIR}/{slug}.json", {})
    if kanaal == "whatsapp":
        if secrets.get("whatsapp_paired"):
            return ("done", "WhatsApp-bridge gekoppeld")
        return ("pending",
                "klant koos WhatsApp — ondersteund via de ingebouwde Baileys-bridge "
                "(WhatsApp Web, GEEN Meta Business API of Twilio nodig). Setup (mens-stap, "
                "interactief): draai 'hermes whatsapp' op de VM, kies bot-modus, en scan de "
                "QR met het APARTE WhatsApp-nummer van de klant (WhatsApp > Gekoppelde "
                "apparaten > Apparaat koppelen). Let op: elke klant heeft een eigen nummer "
                "+ eigen bridge-sessie nodig; gebruik conversational, geen bulk-outbound "
                "(kleine ban-kans). Telegram blijft de snelste/schaalbaarste start.")
    if kanaal == "voi-agent":
        import secrets as _sec, json as _j
        profile_env = f"{PROFILES_DIR}/{slug}/.env" if os.path.exists(f"{PROFILES_DIR}/{slug}") else None
        # Check if port already assigned
        port = None
        if profile_env and os.path.exists(profile_env):
            with open(profile_env) as ef:
                for ln in ef:
                    if ln.startswith("API_SERVER_PORT="):
                        port = int(ln.split("=",1)[1].strip().strip('"').strip("'"))
        if not port:
            port = _allocate_app_port()
            _save_app_port(slug, port)
        app_key = _sec.token_urlsafe(32)
        # Write to profile env (will be created by client_launch.sh)
        os.makedirs(f"{CLIENTS_DIR}/{slug}", exist_ok=True)
        env_extra = {"API_SERVER_PORT": str(port), "API_SERVER_KEY": app_key}
        extra_path = f"{CLIENTS_DIR}/{slug}/app_env.json"
        with open(extra_path, "w") as ef:
            _j.dump(env_extra, ef)
        os.chmod(extra_path, 0o600)
        return ("done", f"VOI Agent app-kanaal klaar (poort {port})")
    # default: telegram
    if secrets.get("telegram_bot_token"):
        return ("done", "Telegram-bot-token aanwezig")
    return ("pending",
            f"Telegram-bot nog niet gekoppeld. Stap (Oskar/Nova): maak via @BotFather "
            f"een bot, en zet het token in {SECRETS_DIR}/{slug}.json onder "
            f"\"telegram_bot_token\". Daarna draait de koppeling automatisch.")


# ---------- stap 4: persona/taak laden ----------
def _derive_website(dossier):
    """Best-effort website-URL. Prioriteit: expliciet veld, anders domein uit e-mail
    (geen gratis providers), anders bedrijfsnaam die op een domein lijkt."""
    for k in ("website", "url", "site", "web"):
        v = str(dossier.get(k, "")).strip()
        if v:
            if not v.startswith(("http://", "https://")):
                v = "https://" + v
            return v
    email = str(dossier.get("email", "")).strip().lower()
    free = {"gmail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com",
            "icloud.com", "telenet.be", "skynet.be", "proximus.be", "me.com"}
    if "@" in email:
        dom = email.split("@", 1)[1].strip()
        if dom and dom not in free and "." in dom:
            return "https://" + dom
    bedrijf = str(dossier.get("bedrijf", "")).strip().lower()
    if "." in bedrijf and " " not in bedrijf:
        return "https://" + bedrijf
    return ""


def _agent_name(dossier):
    """Naam die de klant koos voor de assistent; standaard 'Jarvis'."""
    for k in ("agent_naam", "assistent_naam", "jarvis_naam", "agent_name", "bot_naam", "naam_assistent"):
        v = str(dossier.get(k, "")).strip()
        if v:
            return v
    return "Jarvis"


def load_persona(slug, dossier):
    d = f"{CLIENTS_DIR}/{slug}"
    os.makedirs(d, exist_ok=True)
    path = f"{d}/persona.md"
    if os.path.exists(path):
        return ("done", "persona-bestand bestaat al")
    bedrijf = dossier.get("bedrijf", "") or "the company"
    taak = (dossier.get("taak", "") or "").strip()
    taak_v = taak or "the recurring work agreed at onboarding"
    agent = _agent_name(dossier)
    owner = (dossier.get("naam", "") or "").strip() or "the owner"
    sector = (str(dossier.get("sector", "")) or "generic").strip().lower()
    sector_clause = "" if sector in ("", "generic") else " in the %s sector" % sector
    persona = (
        f"# {agent} - Digital Employee of {bedrijf}\n\n"
        f"## Identity\n"
        f"I am {agent}, the dedicated digital employee of {bedrijf}{sector_clause}. I work for {owner}, "
        f"and my job is to take {taak_v} and the recurring work around it off their plate.\n\n"
        f"## Character\n"
        f"- Proactive: I surface problems and the next step before being asked.\n"
        f"- Reliable: I do exactly what I say, and I say plainly what I cannot do.\n"
        f"- Discreet: I never share {owner}'s data, keys or internal details with anyone.\n"
        f"- Self-activating: I never ask {owner} to do something I have a tool to do myself. I fetch, search and check things directly, then report back.\n"
        f"- Owner-first: every action serves {owner}'s time and interests, nothing else.\n\n"
        f"## Communication Style\n"
        f"- Short and direct. No filler, no \"great question\", no hedging - I respect your time.\n"
        f"- Calm and certain: same tone under pressure as on a quiet day.\n"
        f"- Honest as information, not judgment - I flag problems plainly and propose the better path.\n\n"
        f"## I handle automatically\n"
        f"- Recurring {taak_v} and the admin around it\n"
        f"- Drafting documents, replies and summaries for your review\n"
        f"- Tracking deadlines, renewals and follow-ups, and flagging them early\n\n"
        f"## I always ask first\n"
        f"- Sending anything to a third party on your behalf (email, message, submission)\n"
        f"- Anything irreversible: deleting, paying, or committing money or dates\n\n"
        f"## Escalate immediately (to {owner}, with a one-line reason)\n"
        f"- Anything angry, legal, or a complaint from a third party\n"
        f"- Any request for a number, price or claim I cannot source from my memory or a connected tool\n"
        f"- Anything outside the working agreements in my memory\n\n"
        f"## Language\n"
        f"I always respond in the language {owner} writes to me in.\n"
        f"Dutch if Dutch. French if French. English if English.\n\n"
        f"## Memory\n"
        f"I read my memory before every response.\n"
        f"I update my memory after every significant interaction.\n\n"
        f"## Tool Use Philosophy\n"
        f"Before asking {owner} for anything, I check if I have a skill that can get it myself.\n"
        f"- If {owner} mentions a website or URL: I fetch it immediately with my web/browser tools; I never ask them to paste the content.\n"
        f"- If {owner} asks me to search for something: I search immediately; I never ask them to use a search engine themselves.\n"
        f"- If {owner} asks me to check something online: I check it myself and report back with findings.\n"
        f"Rule: if I have a tool that can do it, I use it first. I ask only if the tool fails or does not exist.\n\n"
        f"## Connected apps\n"
        f"When {owner} connects or declines an app, I record it in integrations.md "
        f"(Connected / Pending / Declined) and mirror the short list under "
        f"'## Connected Apps' in MEMORY.md. I never store passwords or keys.\n\n"
        f"## When something breaks\n"
        f"If the owner reports something is broken, failing or not working, I use the "
        f"bug-report skill (skills/bug-report) to file it to VO-Initiatives, then I reassure "
        f"the owner with a timeframe and a workaround. I never expose internal errors, keys "
        f"or file paths.\n\n"
        f"## First session (max 5 messages, then never onboard again)\n"
        f"Message 1 - Greet {owner} by name; say in one line you are {agent}, "
        f"their digital employee for {bedrijf}. If the website is in memory, I read it "
        f"and fetch the public site myself before asking anything. Only if I truly have "
        f"no website and no description anywhere do I ask for one. Then stop and wait.\n"
        f"Message 2 - Confirm what you understood in exactly 5 bullets "
        f"(company, sector, what they do, the owner, what to automate). "
        f"Ask \"Did I get this right?\" Then stop and wait.\n"
        f"Message 3 - Propose exactly 3 concrete automations for {taak_v}, "
        f"easiest first, one line each. Then stop and wait.\n"
        f"Message 4 - Ask which one to start with. Then ask two guardrail questions, in {owner}'s language: "
        f"(a) What must I never do or say on behalf of {bedrijf}? "
        f"(b) What is the tricky case where a new employee would get this work wrong? "
        f"Then stop and wait.\n"
        f"Message 5 - Read back the working agreements as two short lists - 'I handle automatically' and "
        f"'I always ask first' (my defaults plus their answers; their must-nevers recorded VERBATIM, never "
        f"paraphrased) - and ask for an explicit yes. After the yes: write the company facts to MEMORY.md, "
        f"the owner facts to USER.md, and the confirmed lists to MEMORY.md under "
        f"'## Working agreements (owner-confirmed)' with the date. Until VO-Initiatives has reviewed these "
        f"agreements, I stay in draft-only mode: everything I produce is a draft for {owner} to approve; "
        f"anything money-touching, legal or irreversible stays human-in-the-loop even after review.\n"
        f"Never mention /help or commands. Never ask for passwords, codes or API keys in chat.\n"
    )
    with open(path, "w") as f:
        f.write(persona)
    return ("done", "persona-bestand aangemaakt")


def seed_memory(slug, dossier):
    """Eenmalige geheugen-seed (MEMORY.md + USER.md) in de clients-dir; client_launch.sh
    kopieert ze seed-once naar profiles/<slug>/memories/ (overschrijft nooit)."""
    d = f"{CLIENTS_DIR}/{slug}"
    os.makedirs(d, exist_ok=True)
    bedrijf = dossier.get("bedrijf", "") or "unknown"
    taak = (dossier.get("taak", "") or "").strip() or "to be refined"
    naam = (dossier.get("naam", "") or "").strip() or "unknown - confirm"
    website = _derive_website(dossier) or "unknown - ask in first session"
    today = time.strftime("%Y-%m-%d")
    written = []
    mp = f"{d}/MEMORY.md"
    if not os.path.exists(mp):
        _sector = (str(dossier.get("sector", "")) or "").strip().lower()
        _sector_line = _sector if _sector and _sector != "generic" else "unknown - confirm in first session"
        _tools_raw = (str(dossier.get("tools", "")) or "").strip()
        _tools_lines = ""
        if _tools_raw:
            _tool_list = [t.strip() for t in _tools_raw.replace(",", "\n").split("\n") if t.strip()]
            _tools_lines = "\n".join(f"- {t}" for t in _tool_list) if _tool_list else "(none mentioned)"
        else:
            _tools_lines = "(none mentioned yet — ask in first session)"
        _kanaal = (str(dossier.get("kanaal", "")) or "telegram").strip()
        mem = (
            f"# MEMORY - {bedrijf}\n\n"
            f"## Company\n"
            f"Name: {bedrijf}\n"
            f"Sector: {_sector_line}\n"
            f"Location: unknown - confirm in first session\n"
            f"Website: {website}\n\n"
            f"## Hired to automate\n"
            f"- {taak}\n\n"
            f"## Tools mentioned by owner (from intake)\n"
            f"{_tools_lines}\n\n"
            f"## Channel\n"
            f"- {_kanaal}\n\n"
            f"## Connected Apps\n"
            f"(none yet — audit pending)\n\n"
            f"## Approved Automations\n"
            f"(none yet)\n\n"
            f"## Patterns Observed\n"
            f"(none yet)\n\n"
            f"## YES (owner approved)\n"
            f"(none yet)\n\n"
            f"## NO (owner declined)\n"
            f"(none yet)\n\n"
            f"## onboarding_complete\n"
            f"false\n\n"
            f"## Last updated\n"
            f"- {today}: profile created, awaiting first session\n"
        )
        mem = mem[:2200]
        with open(mp, "w") as f:
            f.write(mem)
        written.append("MEMORY.md")
    up = f"{d}/USER.md"
    if not os.path.exists(up):
        usr = (
            f"# USER - {naam}\n\n"
            f"## Identity\n"
            f"Name: {naam}\n"
            f"Telegram user ID: unknown - set on first contact (TOFU)\n"
            f"Preferred language: unknown - match first message\n\n"
            f"## Communication Style\n"
            f"(observe and fill)\n\n"
            f"## Preferences\n"
            f"(observe and fill)\n\n"
            f"## Important Dates\n"
            f"(none yet)\n"
        )
        usr = usr[:1375]
        with open(up, "w") as f:
            f.write(usr)
        written.append("USER.md")
    if written:
        return ("done", "geheugen-seed aangemaakt: " + ", ".join(written))
    return ("done", "geheugen-seed bestond al")


def seed_integrations(slug, dossier):
    """Eenmalige registry van gekoppelde apps (clients/<slug>/integrations.md)."""
    d = f"{CLIENTS_DIR}/{slug}"
    os.makedirs(d, exist_ok=True)
    path = f"{d}/integrations.md"
    if os.path.exists(path):
        return ("done", "integraties-registry bestond al")
    bedrijf = dossier.get("bedrijf", "") or "the company"
    agent = _agent_name(dossier)
    owner = (dossier.get("naam", "") or "").strip() or "the owner"
    reg = (
        f"# Connected Apps - {bedrijf}\n\n"
        f"Registry of external apps and accounts {agent} may use for {owner}. "
        f"{agent} updates this file whenever an app is connected, requested or "
        f"declined, and mirrors the short list under '## Connected Apps' in MEMORY.md.\n\n"
        f"## Connected\n"
        f"(none yet)\n\n"
        f"## Pending (requested, awaiting owner)\n"
        f"(none yet)\n\n"
        f"## Declined (owner said no - do not ask again)\n"
        f"(none yet)\n\n"
        f"## Rules\n"
        f"- Never store passwords, codes or API keys here or in chat - VOI handles credentials securely.\n"
        f"- Mark an app Connected only after {owner} confirms it works.\n"
        f"- If {owner} declines an app, record it under Declined and never re-ask.\n"
    )
    with open(path, "w") as f:
        f.write(reg)
    return ("done", "integraties-registry aangemaakt")


# ---------- vault: niet-geheime status/checklist ----------
def write_vault_dossier(slug, dossier, steps):
    os.makedirs(VAULT_CLIENTS, exist_ok=True)
    path = f"{VAULT_CLIENTS}/{slug}.md"
    dag0 = time.strftime("%d-%m-%Y")
    lines = []
    lines.append(f"# Managed build — {dossier.get('bedrijf','')}\n")
    lines.append(f"- **Contact:** {dossier.get('naam','')} · {dossier.get('email','')} · {dossier.get('telefoon','')}")
    lines.append(f"- **Kanaal:** Telegram (managed, first)")
    lines.append(f"- **Dag 0:** {dag0}")
    lines.append(f"- **Model:** {CLIENT_MODEL} · **cap:** opstart ${STARTUP_CAP:.0f} (2 wk) → run ${RUN_CAP:.0f}/maand (fair-use)")
    lines.append(f"- **Eigenaar:** Nova/Sam\n")
    lines.append("## Build-status (automatisch)\n")
    for name, (state, detail) in steps.items():
        mark = {"done": "[x]", "pending": "[ ]", "error": "[!]"}.get(state, "[ ]")
        lines.append(f"- {mark} **{name}** — {state}: {detail}")
    lines.append("\n> Secrets (key/token) staan BUITEN de vault in /root/.hermes/secrets/. "
                 "Dit bestand is veilig om te syncen.\n")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    return path


# ---------- orchestratie ----------
def provision(dossier_path):
    dossier = _read_json(dossier_path, {})
    if not dossier:
        _log(f"FOUT: kan dossier niet lezen: {dossier_path}")
        return 1

    missing = validate(dossier)
    if missing:
        _log(f"dossier onvolledig ({dossier.get('bedrijf','?')}): mist {missing} — "
             f"Nova moet dit eerst aanvullen. Geen build gestart.")
        _telegram(f"⚠️ Managed build niet gestart voor {dossier.get('bedrijf','?')}: "
                  f"dossier mist {', '.join(missing)}. Nova vult aan.")
        return 2

    slug = _slug(dossier["bedrijf"])
    kanaal = normalize_kanaal(dossier.get("kanaal"))
    _log(f"start managed build: {slug} (kanaal: {kanaal})")

    steps = {}
    steps["dossier-validatie"] = ("done", "alle verplichte velden aanwezig")
    steps["openrouter-key (cap)"] = provision_or_key(slug, dossier["bedrijf"], STARTUP_CAP)
    steps["kanaal-koppeling"] = setup_channel(slug, kanaal)
    steps["persona/taak"] = load_persona(slug, dossier)
    steps["geheugen-seed"] = seed_memory(slug, dossier)
    steps["integraties-registry"] = seed_integrations(slug, dossier)

    # status afleiden
    states = [s for s, _ in steps.values()]
    if "error" in states:
        status = "error"
    elif "pending" in states:
        status = "wachten (zie pending-stappen)"
    else:
        status = "klaar voor go-live"

    _write_config(slug, {
        "bedrijf": dossier["bedrijf"], "kanaal": kanaal, "model": CLIENT_MODEL,
        "sector": (str(dossier.get("sector", "")) or "generic").strip().lower(),
        "land": (str(dossier.get("land", "") or dossier.get("country", "")) or "BE").strip().upper(),
        "cap_phase": "startup",
        "startup_cap_usd": STARTUP_CAP,
        "run_cap_usd": RUN_CAP,
        "monthly_cap_usd": STARTUP_CAP,   # actieve cap tijdens de 2-weken opstart-sprint
        "status": status,
        "updated_at": time.strftime('%F %T'),
    })
    vault_path = write_vault_dossier(slug, dossier, steps)

    summary = [f"🛠️ Managed build — {dossier['bedrijf']} ({status})"]
    for name, (state, detail) in steps.items():
        icon = {"done": "✅", "pending": "⏳", "error": "❌"}.get(state, "•")
        summary.append(f"{icon} {name}: {detail}")
    summary.append(f"Dossier: {os.path.basename(vault_path)}")
    _telegram("\n".join(summary))
    _log(f"klaar: {slug} → {status}")
    for name, (state, detail) in steps.items():
        _log(f"  {state:7} {name}: {detail}")
    return 0


def approve_key(slug):
    """Maakt alsnog de per-klant OpenRouter-key aan (na menselijke goedkeuring)."""
    cfg = _read_json(f"{CLIENTS_DIR}/{slug}/config.json", {})
    if not cfg:
        _log(f"--approve-key: geen config voor '{slug}' — eerst provisionen.")
        return 1
    bedrijf = cfg.get("bedrijf", slug)
    cap = float(cfg.get("monthly_cap_usd", DEFAULT_MONTHLY_CAP))
    os.environ["VO_AUTO_PROVISION_KEY"] = "1"  # overrule de gate, alleen hier
    state, detail = provision_or_key(slug, bedrijf, cap)
    _log(f"--approve-key {slug}: {state} — {detail}")
    if state == "done":
        # status bijwerken: key-stap niet meer pending
        new_status = "klaar voor go-live" if cfg.get("status", "").startswith("wachten") else cfg.get("status")
        # alleen optillen als enige resterende blocker de key was; anders met rust laten
        _write_config(slug, {"status": new_status, "updated_at": time.strftime('%F %T')})
        _telegram(f"✅ Key aangemaakt voor {bedrijf} — {detail}")
    else:
        _telegram(f"⚠️ Key-aanmaak voor {bedrijf} {state}: {detail}")
    return 0 if state == "done" else 3


def _patch_key_limit(prov, khash, new_limit):
    body = json.dumps({"limit": new_limit}).encode()
    req = urllib.request.Request(
        f"https://openrouter.ai/api/v1/keys/{khash}",
        data=body, method="PATCH",
        headers={"Authorization": f"Bearer {prov}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def switch_to_run_cap(slug):
    """Na de 2-weken opstart-sprint: verlaag de per-klant key naar de run-cap."""
    cfg = _read_json(f"{CLIENTS_DIR}/{slug}/config.json", {})
    if not cfg:
        _log(f"--switch-to-run-cap: geen config voor '{slug}' — eerst provisionen.")
        return 1
    run_cap = float(cfg.get("run_cap_usd", RUN_CAP))
    sec = _read_json(f"{SECRETS_DIR}/{slug}.json", {})
    khash = sec.get("openrouter_key_hash")
    if not khash:
        # Nog geen key aangemaakt: zet config alvast op run-fase, zodat een latere
        # --approve-key meteen op de lage cap aanmaakt.
        _write_config(slug, {"cap_phase": "run", "monthly_cap_usd": run_cap,
                             "updated_at": time.strftime('%F %T')})
        _log(f"--switch-to-run-cap {slug}: nog geen key — config op run-fase ({run_cap:.0f}) gezet.")
        return 0
    prov = _env("OPENROUTER_PROVISIONING_KEY")
    if not prov:
        _log("--switch-to-run-cap: OPENROUTER_PROVISIONING_KEY ontbreekt in .env.")
        return 1
    try:
        _patch_key_limit(prov, khash, run_cap)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        _log(f"--switch-to-run-cap {slug}: OpenRouter weigerde (HTTP {e.code}): {detail}")
        return 3
    except Exception as e:
        _log(f"--switch-to-run-cap {slug}: fout: {e}")
        return 3
    _write_config(slug, {"cap_phase": "run", "monthly_cap_usd": run_cap,
                         "updated_at": time.strftime('%F %T')})
    _write_secret(slug, {"openrouter_cap_usd": run_cap})
    bedrijf = cfg.get("bedrijf", slug)
    _log(f"--switch-to-run-cap {slug}: cap verlaagd naar ${run_cap:.0f}/maand")
    _telegram(f"🔧 {bedrijf}: opstart-sprint klaar — cap verlaagd naar ${run_cap:.0f}/maand (run-fase).")
    return 0


def show_status(slug):
    cfg = _read_json(f"{CLIENTS_DIR}/{slug}/config.json", {})
    sec = _read_json(f"{SECRETS_DIR}/{slug}.json", {})
    print(json.dumps({
        "config": cfg,
        "secrets_present": {k: bool(v) for k, v in sec.items()},
    }, indent=2, ensure_ascii=False))
    return 0


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1
    if args[0] == "--status" and len(args) > 1:
        return show_status(_slug(args[1]))
    if args[0] == "--approve-key" and len(args) > 1:
        return approve_key(_slug(args[1]))
    if args[0] == "--switch-to-run-cap" and len(args) > 1:
        return switch_to_run_cap(_slug(args[1]))
    return provision(args[0])


if __name__ == "__main__":
    sys.exit(main())
