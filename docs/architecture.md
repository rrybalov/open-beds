# Architecture — three ways counts reach the board

The board takes counts from three sources and treats them the same way.

| Source | Who | How | Published |
|---|---|---|---|
| **Email** | Provider | Sends counts to the Pathways bed alias, in their usual format or the standard one | Automatically when the parser recognizes the sender and the layout; otherwise held for DHS review |
| **Provider form** | Provider | `update.html`, opened from a personal link | Immediately |
| **DHS admin** | DHS / Pathways staff | `admin.html` → Sites → Update (phone calls, corrections) | Immediately, with a required reason |

## One log, latest wins

Every change is a **report** in one append-only log:

```
report  { id, source: email|form|admin, status: published|review|rejected,
          receivedAt, orgId, by, reason?, email?: {from, subject, body},
          parse?: {template, confidence, warnings}, entries: [entry] }
entry   { siteId, counts: { detox: { male: 3, female: "na" } },
          shared?: { open, types, label }, qualitative?: [...], notes: [] }
```

For each site, the board shows the entry from its **most recent published report**, whatever the source. Each count is labeled with its source and age, so staff can see, for example, that “5 detox” came from a DHS phone call at 11:20 and not from the 6:30 AM email. Nothing is overwritten or deleted, so the log is also the audit trail.

## The email alias

```
Provider ──email──▶ bed alias ──▶ mail flow ──POST──▶ /api/inbound-email
                                                         │  parseEmail()  (assets/parser.js)
                                                         ▼
                              confidence high/medium ─▶ published ─▶ board
                              confidence low ─────────▶ review queue ─▶ admin publishes / rejects
```

`assets/parser.js` is written to run in Node as well as the browser, so the service behind the alias can use it as-is. What it handles today (`node tests/parser.test.js`):

| Layout | Example sender | Confidence |
|---|---|---|
| Standard format (`Site:` / `Detox male: 3` …) | Any known sender | High |
| Table rows of 6 numbers / NA | Acadia PAC | High |
| One-liners (“9 available beds”, “14 cap 9 open”) | UPMC Mercy, McKeesport | High |
| Newsletter with a big number | Valley Forge, Gaiser | High |
| Prose (“3 adult male residential beds at Silvermist Pittsburgh”) | Pyramid | High |
| “Beds available” with no number | SpiritLife | Medium |
| Unknown sender, or counts it can’t place on a site | — | Low → review |

A provider is matched by its **sender domain** (`data/sites.js` → `senderDomains`). Quoted replies are stripped first, so a reply-all thread doesn’t pick up someone else’s numbers.

**Push providers toward the standard format or the form.** Each new layout needs a template, and prose needs a person to check it.

### Two ways to build the alias (a DHS IT decision)

**A. Microsoft 365 — fits the county’s existing mail.** A shared mailbox is the alias. A Power Automate flow (“When a new email arrives in a shared mailbox”) posts the sender, subject and plain-text body to an Azure Function running `parser.js`, which writes the report. Exchange already checks SPF and DKIM.

**B. Inbound-email webhook.** Point the alias’s MX at a service such as SendGrid Inbound Parse or Postmark, which posts each email to a serverless function running the same parser.

Either way: drop attachments, keep the text body for audit, and alert an admin when a recognized sender’s email fails to parse.

## API the production store implements

`assets/store.js` is the only file that knows where data lives. The demo version keeps the log in the browser. A production version swaps in these calls without touching the pages:

| Method | Path | Caller | Auth |
|---|---|---|---|
| GET | `/api/board` | Board | Staff sign-in |
| POST | `/api/inbound-email` | Mail flow | Shared secret |
| POST | `/api/reports/form` | Provider form | Per-provider link token |
| POST | `/api/reports/admin` | Admin | County SSO |
| GET | `/api/reports?status=review` | Admin | County SSO |
| POST | `/api/reports/{id}/publish` · `/reject` | Admin | County SSO |
| POST | `/api/referrals` · `/api/referrals/{id}/undo` | Board (intake staff) | Staff sign-in |
| PUT | `/api/sites/{id}/profile` | Provider form, Admin | Per-provider link token / County SSO |
| POST | `/api/sites` (from the provider form) | Provider form | Per-provider link token — held as `review` until DHS approves |
| GET/PUT/POST | `/api/sites`, `/api/orgs` (POST adds a facility) | Admin | County SSO |

**Facility details** (levels of care, who they take, pregnancy / MOUD / medical / legal notes, payment, contact) are reports with a `profile: { siteId, before, after, changes }` block. They apply at once; reverting restores `before`, and undoing the revert re-applies `after`. Any admin decision can be undone by setting the report back to its previous status (`store.restore(id, status)`).

**New facilities from providers** arrive as one report listing `newSites` (and `newOrg` for a new provider). They stay off the board until DHS approves; DHS-added facilities publish at once.

**Partial updates:** form and DHS updates carry only the fields someone typed. The server lays them over the site's current, referral-adjusted counts, so a blank field means "no change".

**Referrals** are reports with `source: "referral"` and no counts: `{ siteId, type, sex, by }`. The board takes one bed off a site's latest count for each referral marked *after* that count arrived. When the provider sends a new count, older referrals stop applying — the provider's number already reflects them. Undo marks the referral `undone`. The board should poll `/api/board` (or use server-sent events) every 30–60 seconds so a referral reaches every viewer quickly.

Store: `orgs` (with sender domains), `sites` (profile + bed layout), `reports` (append-only, entries as JSON), `provider_links` (token, org, created, revoked).

## Security and privacy

- **Provider form:** one link per organization with an unguessable token that can be revoked. No passwords for providers to manage.
- **Admin:** county single sign-on. Every edit records who and why.
- **Email:** only allow-listed domains publish automatically. Everything else waits for review. A spoofed email can’t publish if domain authentication fails.
- **Visibility:** the GitHub Pages site is a public demo. The real board shows providers’ capacity, and Acadia’s email went to an internal distribution list, so host it behind staff sign-in.
- **Not stored:** client information of any kind. Staff names in this public repo.

## What’s demo-only today

- Data lives in the viewer’s browser (`localStorage`), seeded from the 7 sample emails and re-timed to “today.”
- No sign-in. Anyone can open the admin page, but changes affect only their own browser.
- “Simulate an email” stands in for the alias.
- **Referrals and added facilities reach only other tabs in the same browser.** “Everyone looking at the dashboard” needs the API above — a static GitHub Pages site has nowhere shared to write.
