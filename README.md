# Open Beds

A live open-bed board for Pathways intake staff in Allegheny County. It answers one question: **where can I send someone today?**

Counts reach the board three ways:

1. **Email.** Providers email their daily counts to a Pathways alias and the board updates automatically.
2. **Provider form.** Providers who'd rather not email fill in a one-minute form.
3. **DHS admin.** Staff enter counts from phone calls, correct mistakes and review emails the parser isn't sure about.

## Pages

| Page | For | What it does |
|---|---|---|
| [`index.html`](index.html) | Pathways intake staff | **Find a bed** (filter by type, sex, age; nearest first), **All sites** grid, **Updates** feed |
| [`update.html`](update.html) | Providers | Enter open beds per site. A personal link (`update.html?org=gaiser`) preselects the provider. |
| [`admin.html`](admin.html) | DHS staff | **Email inbox** with review queue and an email simulator, **Sites** with manual updates, **Activity** log, **Settings** |

## Run it

No build step. Serve the folder (`python3 -m http.server`) or open `index.html`. On GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root.

**Demo mode:** data lives in your browser, seeded from 7 real provider emails (Nov 2–3, 2026) re-timed to today. Submit the form or simulate an email in one tab and the board updates in another. Admin → Settings → Reset demo data starts over.

## Files

| Path | What it is |
|---|---|
| `data/sites.js` | Providers, sites, sender domains and each site's bed layout |
| `data/sample-emails.js` | The 7 sample emails as text (names removed), plus 2 test cases |
| `assets/parser.js` | Email → per-site counts. Runs in the browser and in Node. |
| `assets/store.js` | The update log (demo adapter). The only file that changes for production. |
| `assets/board.js` · `update.js` · `admin.js` | The three pages |
| `assets/editor.js` · `common.js` | Shared bed-count editor and helpers |
| `tests/parser.test.js` | `node tests/parser.test.js` — parser checked against all 7 emails |
| `docs/architecture.md` | Sources, email alias options, API, security |
| `docs/email-aggregation.md` | The 7 emails side by side, with totals |
| `docs/mvp-recommendations.md` | Board design recommendations |

## Privacy

This repository is public. It holds no client data, staff names, personal emails or direct lines. Only organization admissions numbers printed in the emails are kept. The real board should sit behind staff sign-in — see `docs/architecture.md`.
