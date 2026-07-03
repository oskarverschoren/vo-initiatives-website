# /start chat-audit — serverinstallatie

Eén keer uitvoeren op de server (`root@vo-initiatives.com`). De bestanden in deze map
horen NIET in de webroot — kopieer ze naar `/root/.hermes/scripts/`.

## 1. Handler plaatsen

```bash
scp server/onboard_chat_handler.py server/create-stripe-link.sh root@vo-initiatives.com:/root/.hermes/scripts/
```

## 2. Stripe-link + webhook (eenmalig)

Gebruik een **restricted key** (`rk_live_...`) met schrijfrechten op Products, Prices,
Payment Links en Webhook Endpoints — geen volledige `sk_live_` nodig. Zet hem in de
credential-map:

```bash
ssh root@vo-initiatives.com
echo '{"restricted_key":"rk_live_..."}' > /root/.hermes/secrets/stripe.json
chmod 600 /root/.hermes/secrets/stripe.json
bash /root/.hermes/scripts/create-stripe-link.sh   # leest de key uit stripe.json
# script print: PAYMENT LINK + WEBHOOK SECRET (whsec_...) + de env-regels
```

## 3. systemd-unit

`/etc/systemd/system/vo-onboard-chat.service`:

```ini
[Unit]
Description=VO-Initiatives onboarding chat-audit endpoint
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /root/.hermes/scripts/onboard_chat_handler.py
Restart=always
RestartSec=3
User=root
Environment=OPENROUTER_API_KEY=sk-or-...        # VO's eigen key
Environment=CHAT_MODEL=anthropic/claude-haiku-4.5
Environment=FREE_TURNS=8
Environment=PAYWALL=0                            # 1 = Stripe-gate aan
Environment=STRIPE_LINK=
Environment=STRIPE_WEBHOOK_SECRET=
Environment=IP_SESSIONS_PER_HOUR=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now vo-onboard-chat
curl -s http://127.0.0.1:8098/api/onboard/chat/health   # -> {"ok": true, ...}
```

## 4. nginx (naast de bestaande /api/onboard-locatie)

```nginx
    location /api/onboard/chat {
        proxy_pass http://127.0.0.1:8098;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 90s;
    }
    location /api/onboard/stripe-webhook {
        proxy_pass http://127.0.0.1:8098;
    }
```

```bash
nginx -t && systemctl reload nginx
curl -s https://vo-initiatives.com/api/onboard/chat/health
```

## Gedrag

- Chat-audit → aan het einde POST het dossier naar de bestaande pipeline
  (`127.0.0.1:8099/api/onboard`, `kanaal="web-audit"`); volledige transcripts staan in
  `/root/.hermes/onboard-chat/<sessie>.json`.
- Paywall (indien `PAYWALL=1`): na `FREE_TURNS` beurten pauzeert de chat met de Stripe-link
  (`client_reference_id` = sessie-ID); de webhook zet de sessie op betaald; de site pollt
  en gaat automatisch verder.
- Kosten-/misbruikcaps: max 3 nieuwe sessies per IP per uur, 30 beurten per sessie,
  600 output-tokens per beurt, goedkoop model standaard.
- Frontend-fallbacks: chat-health faalt → wizard-formulier; wizard-API faalt → cal.com.
