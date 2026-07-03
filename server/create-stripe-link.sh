#!/usr/bin/env bash
# Maakt eenmalig het Stripe-product + de Payment Link voor de audit-paywall.
# Draai dit OP de server; de key verlaat de machine nooit.
#
#   STRIPE_SECRET_KEY=sk_live_... bash create-stripe-link.sh
# of, als de key in de credential-map ligt (bv. /root/.hermes/secrets/stripe.json
# met {"secret_key":"sk_live_..."}):
#   STRIPE_SECRET_KEY=$(python3 -c 'import json;print(json.load(open("/root/.hermes/secrets/stripe.json"))["secret_key"])') bash create-stripe-link.sh
set -euo pipefail

: "${STRIPE_SECRET_KEY:?Zet STRIPE_SECRET_KEY (sk_live_... of sk_test_...)}"
API="https://api.stripe.com/v1"
AUTH=(-u "${STRIPE_SECRET_KEY}:")

echo "1/3 product aanmaken…"
PRODUCT=$(curl -s "${AUTH[@]}" "$API/products" \
  -d name="VOI Agent-audit" \
  -d description="Grondige bedrijfsaudit door je VOI Agent — volledig verrekend bij je opstart." \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
echo "   product: $PRODUCT"

echo "2/3 prijs aanmaken (€95)…"
PRICE=$(curl -s "${AUTH[@]}" "$API/prices" \
  -d product="$PRODUCT" -d unit_amount=9500 -d currency=eur \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')
echo "   prijs: $PRICE"

echo "3/3 payment link aanmaken…"
LINK=$(curl -s "${AUTH[@]}" "$API/payment_links" \
  -d "line_items[0][price]=$PRICE" -d "line_items[0][quantity]=1" \
  -d "after_completion[type]=redirect" \
  -d "after_completion[redirect][url]=https://vo-initiatives.com/start?paid=1" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["url"])')

echo
echo "PAYMENT LINK: $LINK"
echo
echo "Vervolgens:"
echo "  a) Webhook aanmaken (eenmalig):"
echo "     curl -s -u \$STRIPE_SECRET_KEY: $API/webhook_endpoints \\"
echo "       -d url=https://vo-initiatives.com/api/onboard/stripe-webhook \\"
echo "       -d 'enabled_events[0]=checkout.session.completed'"
echo "     -> noteer de 'secret' (whsec_...) uit het antwoord."
echo "  b) Zet in /etc/systemd/system/vo-onboard-chat.service:"
echo "     Environment=STRIPE_LINK=$LINK"
echo "     Environment=STRIPE_WEBHOOK_SECRET=whsec_..."
echo "     Environment=PAYWALL=1   (of 0 om de gate uit te laten)"
