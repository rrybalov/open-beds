# Open Beds

A live open-bed board for Pathways intake staff in Allegheny County. It answers one question: **where can I send someone today?**

Counts reach the board three ways:

1. **Email.** Providers email their daily counts to a Pathways alias and the board updates automatically.
2. **Provider form.** Providers who'd rather not email fill in a one-minute form.
3. **DHS admin.** Staff enter counts from phone calls, correct mistakes and review emails the parser isn't sure about.

## Pages

| Page | For | What it does |
|---|---|---|
| [`index.html`](index.html) | Pathways intake staff | **Find a bed** (filter by bed type, sex, age, LOCA level, payment and location — a multi-select of provider sites; each card shows who the site takes), with a **List / Map** toggle (the same filters drive both; type an address or ZIP to sort by distance; select a pin to open that provider's availability in the side list). Each card shows the bed breakdown (type × men / women / total), when and where the count came from with **View source**, a **Mark a referral** action that takes one bed off the count for everyone, and **Contact admissions**: call, email intake, directions, website. **All sites** grid, **Updates** feed. |
| [`update.html`](update.html) | Providers | Enter open beds per site (blank keeps the last count). Each site can add bed types or split men/women, and open **Facility details** to change levels of care, who they take or won't, what's needed before admission, pregnancy / MOUD / medical / legal context, payment and contact. **Add a provider or facility** (top right) — new ones wait for DHS approval. |
| [`admin.html`](admin.html) | DHS staff | **Update a facility** (counts or details) and **Add a facility** at the top. **Updates**: anything waiting for review first, then every change split out by facility (with its provider) and exactly what changed — e.g. “1 detox bed for men claimed through the dashboard (6 → 5)”, “1 residential bed for women removed (4 → 3) — changed manually by DHS”. Filter by source or facility; undo referrals, revert details changes. **Settings**. |

## Run it

No build step. Serve the folder (`python3 -m http.server`) or open `index.html`. On GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.

**Demo mode:** data lives in your browser, seeded from 7 real provider emails (Nov 2–3, 2026) re-timed to today. Submit the form or simulate an email in one tab and the board updates in another. Admin → Settings → Reset demo data starts over.

## Files

| Path | What it is |
|---|---|
| `data/sites.js` | Providers, sites, sender domains, each site's bed layout, and who it takes (LOCA levels, population, exclusions, prerequisites, payment — from the Bed Search Worksheet and emails) |
| `data/sample-emails.js` | The 7 sample emails as text (names removed), plus 2 test cases |
| `assets/parser.js` | Email → per-site counts. Runs in the browser and in Node. |
| `assets/store.js` | The update log (demo adapter). The only file that changes for production. |
| `assets/board.js` · `update.js` · `admin.js` | The three pages |
| `assets/colab.css` | CoLab / ClientView look and feel: sidebar shell, cards, tabs, segmented controls, buttons, modal, toast — matches `rrybalov/colab-client-profile` |
| `assets/editor.js` · `facility.js` · `profile.js` · `common.js` | Shared bed-count editor, new-facility form, facility-details form, helpers |
| `tests/parser.test.js` | `node tests/parser.test.js` — parser checked against all 7 emails |
| `docs/architecture.md` | Sources, email alias options, API, security |
| `docs/email-aggregation.md` | The 7 emails side by side, with totals |
| `docs/mvp-recommendations.md` | Board design recommendations |

## Contacts, map and payment data

- **Contacts:** `reach` in `data/sites.js` — admissions phone, intake email and website, each with where it came from. The Email tag and “Email intake” open a pre-written email (no client details) to the published intake address, or else to whoever sent the site’s latest bed email. Only UPMC McKeesport publishes an intake address today; sample sender addresses are redacted, so other sites show “No intake email on file” in the demo.

- **Map:** Leaflet with CARTO/OpenStreetMap tiles, loaded from cdnjs. Addresses and ZIPs are looked up with OpenStreetMap's Nominatim, biased to Pennsylvania. Distances are straight-line; most pins sit at the town centre (`geo.precision` in `data/sites.js`) until street addresses are on file. If the map library is blocked, the list still sorts by distance. For production, use the county's own geocoder so no address leaves DHS systems.
- **Payment:** `fit.pay` in `data/sites.js` records what each site is known to take (`true`) or not take (`false`). Few sites have this on file yet, so the filter hides only sites known *not* to take a payment type, lists confirmed sites first, and tells staff to ask about the rest.

## Privacy

This repository is public. It holds no client data, staff names, personal emails or direct lines. Only organization admissions numbers printed in the emails are kept. The real board should sit behind staff sign-in — see `docs/architecture.md`.
