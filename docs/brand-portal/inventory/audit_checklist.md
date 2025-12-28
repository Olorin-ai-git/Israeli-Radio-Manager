# Inventory + Classification Checklist (existing `olorin.ai`)

Use this to classify every existing page/asset into one of:
- **Move to `fraud.olorin.ai`** (fraud-only)
- **Keep on `olorin.ai`** (non-fraud / corporate)
- **Split** (page has mixed messaging; create 2 pages and redirect accordingly)
- **Delete** (obsolete, thin, or duplicative)

## What to capture per URL
- URL + title
- 1–2 sentence summary
- Primary CTA + destination (form/calendar/email)
- Keywords in: H1, meta title, meta description, image alt, FAQ blocks
- Embedded links (especially to PDFs, decks, blog posts)
- Backlinks (if known) and current performance (impressions/clicks)
- Final decision: Keep / Move / Split / Delete
- Redirect target (exact new URL)

## Fraud “leak” checks (must be removed from `olorin.ai`)
- Mentions of: fraud, AML, chargebacks, KYC, transactions, risk scoring, disputes
- Client logos/case studies tied to fraud work
- Security/compliance language specific to fraud offering (SOC2 claims, etc.) unless it is truly corporate-level

## Non-fraud checks (must not appear on `fraud.olorin.ai`)
- Radio station automation, scheduling, media operations
- AI agents for ops outside fraud
- Generic “we do everything” consulting claims

## Output artifacts
- Update `url_inventory.csv` with actions + redirect targets.
- Create a redirect map in `seo/redirect_map.csv`.
- List any PDFs/assets that must move and keep their URLs stable (or redirect them too).


