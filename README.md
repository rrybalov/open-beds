# Open Beds

A daily open-bed board for Pathways intake staff in Allegheny County. It answers one question: **where can I send someone today?**

This MVP is built only from what providers already send Pathways — daily bed-availability emails. It does not match clients to providers yet.

## Run it

No build step. Open `index.html` in a browser, or publish with GitHub Pages (Settings → Pages → Deploy from branch → `main`, `/ (root)`).

## What’s here

| Path | What it is |
|---|---|
| `index.html` | The dashboard |
| `assets/app.js` | Filtering, views and rendering (plain JS) |
| `assets/styles.css` | ACDHS design system tokens and layout (Roboto) |
| `data/reports.js` | The 7 sample emails, normalized to sites and bed types |
| `docs/email-aggregation.md` | The emails side by side, with totals |
| `docs/mvp-recommendations.md` | What the board should do, and how counts should get in |

## The board

- **Find a bed** — filter by bed type, sex and age; see sites with open beds, nearest region first.
- **All sites** — every site × detox / residential / PHP / outpatient.
- **Daily reports** — each email: what it gave, what it left out, how to ingest it.

## Data model

Each **site** has a profile (organization, town, region, population, services, admissions line) and the counts from its latest **report**:

```js
counts: {
  detox:       { male: 6, female: 3 },   // number = open, 0 = full
  residential: { male: "na", female: 0 }, // "na" = marked NA by provider
  php:         { any: 1 }                 // any = sex not given
}
shared:      { types: ["detox", "residential"], open: 9, label: "detox or rehab" }
qualitative: [{ types: ["unknown"], label: "Beds available this week" }]
```

A bed type that isn’t mentioned is shown as “not in report.”

## Sample data

Counts are from emails sent Nov 2–3, 2026, and the board is pinned to Nov 3, 2026, 2:00 PM so freshness reads correctly. Nothing is live.

Staff names, personal emails and direct or cell numbers from the emails are **not** stored. This repository is public.
