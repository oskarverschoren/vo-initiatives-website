#!/usr/bin/env bash
# Maakt eenmalig het Stripe-product + de Payment Link voor de audit-paywall.
# Draai dit OP de server; de key verlaat de machine nooit.
#
# Met de key uit je credential-map (zonder hem te tonen):
#   STRIPE_SECRET_KEY=$(grep -rhoE "sk_(live|test)_[A-Za-z0-9]+" /root/.hermes/secrets/ 2>/dev/null | head -1) \
#     bash /root/.hermes/scripts/create-stripe-link.sh
set -euo pipefail

# Key mag meegegeven worden via STRIPE_SECRET_KEY, of komt uit de credential-map
# /root/.hermes/secrets/stripe.json  ({"restricted_key":"rk_live_..."} of {"secret_key":"sk_live_..."}).
# Een restricted key (rk_) met schrijfrechten op Products/Prices/PaymentLinks/Webhooks
# is de veilige keuze — geen volledige sk_live_ nodig.
if [ -z "${STRIPE_SECRET_KEY:-}" ] && [ -f /root/.hermes/secrets/stripe.json ]; then
  STRIPE_SECRET_KEY=$(python3 -c 'import json;d=json.load(open("/root/.hermes/secrets/stripe.json"));print(d.get("restricted_key") or d.get("secret_key") or "")')
fi
: "${STRIPE_SECRET_KEY:?Zet STRIPE_SECRET_KEY of vul /root/.hermes/secrets/stripe.json met restricted_key}"
case "$STRIPE_SECRET_KEY" in
  sk_live_...|sk_test_...|rk_live_...|rk_test_...) echo "FOUT: dat is de placeholder — gebruik je echte key." >&2; exit 1;;
  sk_*|rk_*) ;;
  *) echo "FOUT: key hoort met sk_ of rk_ te beginnen (kreeg: ${STRIPE_SECRET_KEY:0:6}…)." >&2; exit 1;;
esac
echo "key-type: ${STRIPE_SECRET_KEY:0:8}  lengte: ${#STRIPE_SECRET_KEY}"
API="https://api.stripe.com/v1"

extract() {  # leest Stripe-antwoord; toont fout leesbaar en stopt
  python3 -c '
import json,sys
d=json.load(sys.stdin)
if "error" in d:
    e=d["error"]
    sys.stderr.write("STRIPE FOUT: "+e.get("message", str(e))+"\n")
    sys.exit(1)
print(d.get("'"$1"'",""))'
}

echo "1/3 product aanmaken…"
PRODUCT=$(curl -s -u "${STRIPE_SECRET_KEY}:" "$API/products" \
  -d name="VOI Agent-audit" \
  -d description="Grondige bedrijfsaudit door je VOI Agent — volledig verrekend bij je opstart." \
  | extract id)
echo "   product: $PRODUCT"

echo "2/3 prijs aanmaken (€95)…"
PRICE=$(curl -s -u "${STRIPE_SECRET_KEY}:" "$API/prices" \
  -d product="$PRODUCT" -d unit_amount=9500 -d currency=eur \
  | extract id)
echo "   prijs: $PRICE"

echo "3/3 payment link aanmaken…"
LINK=$(curl -s -u "${STRIPE_SECRET_KEY}:" "$API/payment_links" \
  -d "line_items[0][price]=$PRICE" -d "line_items[0][quantity]=1" \
  -d "after_completion[type]=redirect" \
  -d "after_completion[redirect][url]=https://vo-initiatives.com/start?paid=1" \
  | extract url)

echo
echo "PAYMENT LINK: $LINK"
echo
echo "4/4 webhook aanmaken…"
WHSEC=$(curl -s -u "${STRIPE_SECRET_KEY}:" "$API/webhook_endpoints" \
  -d url="https://vo-initiatives.com/api/onboard/stripe-webhook" \
  -d "enabled_events[0]=checkout.session.completed" \
  | extract secret)
echo "   WEBHOOK SECRET: $WHSEC"
echo
echo "Zet in /etc/systemd/system/vo-onboard-chat.service:"
echo "  Environment=STRIPE_LINK=$LINK"
echo "  Environment=STRIPE_WEBHOOK_SECRET=$WHSEC"
echo "  Environment=PAYWALL=1   (of 0 om de gate uit te laten)"
