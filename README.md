# VO-Initiatives — Website

Premium one-page marketing site for VO-Initiatives (ingewerkte AI-assistenten voor Belgische KMO's).
Static HTML/CSS/JS — no build step. Built on the VOI brand system (`../design.md`).

## Structure

```
website/
├── index.html              # the one-pager
├── assets/
│   ├── hero.mp4            # animated hero background (241KB, muted loop)
│   ├── hero.jpg            # hero poster / fallback (Higgsfield-generated)
│   ├── oskar.jpg           # founder photo
│   ├── favicon.svg         # ember-V mark
│   └── app.js              # scroll-reveal (externalised so CSP needs no unsafe-inline)
├── privacy.html · verwerkersovereenkomst.html · algemene-voorwaarden.html · cookiebeleid.html
├── netlify.toml · vercel.json   # security headers + caching for each host
├── robots.txt · sitemap.xml
└── BRAND-CONTENT-SPEC.md   # the copy contract (not deployed-critical)
```

## Run locally

```bash
cd website
python3 -m http.server 8777
# open http://localhost:8777
```

## Deploy (pick one)

**Netlify Drop (fastest, ~30s):** drag the `website/` folder onto https://app.netlify.com/drop — `netlify.toml` applies headers automatically.

**Vercel CLI:**
```bash
cd website
vercel        # preview
vercel --prod # production  (vercel.json applies headers)
```

**GitHub + auto-deploy:** push this folder as a repo, connect it on Netlify/Vercel (no build command, publish dir `.`).

After deploy: point the `vo-initiatives.com` domain at the host, then update the absolute URLs in `sitemap.xml`, `robots.txt`, and the `og:`/`canonical` tags if the domain differs.

## Notes / honest gaps
- No testimonials/case-study section yet — intentionally omitted until real, documented cases exist (see `BRAND-CONTENT-SPEC.md`).
- Forms are `mailto:` CTAs. Swap for a real form endpoint (Netlify Forms / Formspree) when ready, and tighten `form-action` in the CSP accordingly.
- Optional SEO enhancement: add `Organization`/`LocalBusiness` JSON-LD (requires a CSP script hash or a small `'unsafe-inline'` exception).
