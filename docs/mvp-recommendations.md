# MVP recommendations — a bed board built from the daily emails

**Goal:** one screen where Pathways staff see, by mid-morning, where they can send someone today.
**Scope:** only what the provider emails contain. Client matching, bed holds and referrals come later.

## What the board does now (this repo)

- **Find a bed** — pick bed type, sex and age; get a list of sites with open beds. Allegheny County first, then Western, Central and Eastern PA. Sites that say “available” without a number are listed separately. Full sites are collapsed.
- **All sites** — every site × detox / residential / PHP / outpatient, grouped by region. Keeps full, NA, not reported and no-count visibly different.
- **Daily reports** — what each email gave, what it left out, and how it could be ingested.
- Summary tiles that also act as filters. A freshness chip on every site. A call button wherever the email gave an admissions line.

## Recommendations

### 1. Make the site the row, and normalize to four bed types
Detox, residential, PHP, outpatient. One email can cover 11 sites (Acadia). Keep the organization as a filter and a label, not the row.

### 2. Never invent precision
Show what the provider said, at the detail they said it.
- **Shared counts** (“9 open, detox or rehab”) get one cell spanning both columns — not split.
- **Sex not given:** when a user filters to women, confirmed counts and unsplit counts are reported separately (“19 confirmed for women, plus 25 where the report doesn’t give sex”). Tiles count only confirmed beds.
- **No count** (“beds available this week”) is its own state: *Available — call for details*.

### 3. Keep five cell states distinct
Open (number) · Full (0) · NA (provider marked it) · Not in report · Available, no count. Acadia already separates 0 from NA; losing that would send staff to call about beds that don’t exist.

### 4. Timestamp everything; let age drive trust
Every site shows when its report arrived. Today = green, yesterday = amber, older = red. “Only reports from today” is one click. If a provider hasn’t reported by late morning, the board should say so rather than show yesterday’s numbers as current.

### 5. Separate the daily count from the provider profile
The emails carry counts, not descriptions. Store location, levels of care, payers, restrictions and admissions lines once per site (seed from the Bed Search Worksheet), and attach each day’s counts to it. The board joins the two.

### 6. Sort by distance, because this sample is mostly far away
Only the two UPMC hospital units are in Allegheny County. Every residential bed in these emails is outside the county, many 200+ miles away. Region-first sorting is the default; drive time is the next step.

### 7. Ingest in three steps
| Phase | How counts get in | Effort |
|---|---|---|
| **0 — now** | Pathways staff enter each morning’s emails into a short form per site (or paste Acadia’s table). About a minute per email. | Staff time; no provider change |
| **1** | Auto-parse the structured senders (Acadia’s table). Send every other provider a one-minute update link that replaces their email. | Small build; light ask of providers |
| **2** | Providers update directly or by feed; email becomes the fallback. | Provider onboarding |

### 8. Give providers a simple standard to report to
Ask for Acadia’s table, with labels: site × bed type × sex (and age where relevant), NA vs 0, a timestamp, and an admissions line. Most of the confusion in these seven emails would disappear.

### 9. Hide mental-health-only beds by default
Silvermist Pocono’s 4 beds are mental health only. They stay available behind a toggle.

### 10. Show who didn’t report
Next iteration: list worksheet providers with no email today as “No report — call,” so silence isn’t mistaken for “no beds.”

## Open questions for Pathways and providers
- Acadia: what do the blue and pink sub-columns mean? (Read here as male / female.)
- Acadia: does NA mean “not offered” or “not reported today”?
- UPMC McKeesport: how do the 9 open beds split between detox and rehab?
- Valley Forge: admissions hours are written “7:30–12:00 AM.” Which hours?
- Silvermist Pocono: do those beds take substance-use clients?
- Providence House: where is it?
- SpiritLife: which levels, and how many beds?
- Is White Deer Run on the Bed Search Worksheet the same network as Acadia’s Allenwood, Lehigh and York sites?

## Privacy
This repository is public. Staff names, personal email addresses and direct or cell numbers from the emails are not stored. Only organization admissions lines printed in the emails are kept. The original PDFs are not committed.
