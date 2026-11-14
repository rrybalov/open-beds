# Usability test plan — Open Beds

**Why:** every design choice so far rests on the bed-search emails, the Bed Search Worksheet and expert review (DHS design principles, NN/g heuristics, WCAG 2.2 AA). No one who will use the board day to day has tried it yet. This round checks the three jobs the board exists for, with the people who do them.

**What we're testing:** the GitHub Pages prototype (bed board, provider update form, DHS admin). It uses made-up data saved in the participant's own browser. Nothing they enter reaches a real system.

## Participants (5)

| # | Who | Why them |
|---|---|---|
| 3 | **Pathways intake staff** — at least one on nights or weekends, at least one newer than six months | They use the board under time pressure, often on the phone with a client |
| 2 | **Provider admissions staff** — one from a multi-site provider (e.g. Acadia, 11 facilities), one from a single-site provider | They have to update the board instead of (or as well as) sending the email |

Five people find most of the serious problems in a round like this. Run a second, smaller round after the fixes.

**Recruiting:** through the Pathways supervisor and the provider contacts already on the bed-search email list. No incentive needed for staff during work hours. Providers get a thank-you note from DHS.

## Logistics

- **Format:** 45 minutes, one-on-one, on Teams with screen share, or in person at Pathways. Intake staff use their usual work computer. Providers use whatever they send the email from.
- **People:** a facilitator, plus one note-taker who doesn't speak.
- **Recording:** screen and audio, only with the participant's consent. Recordings stay on the DHS share and are deleted after synthesis.
- **Privacy:** tell participants never to type a real client's name, date of birth or details. Use the scenario cards instead.
- **Before each session:** clear browser storage (the admin page has "Reset demo data"). Open the right starting page.

## Script

### Intro (3 min)
> Thanks for helping. We're testing the website, not you — if something is confusing, that's what we need to know. Please think out loud as you go: what you're looking for, what you expect, what surprises you. I may not answer questions right away, because I want to see what you'd do on your own. You can stop at any time. Is it OK to record the screen and audio?

### Warm-up (3 min)
- Walk me through how you find a bed for someone today. What do you open first?
- When did the current way last let you down?

## Tasks — intake staff (25 min)

Read each scenario aloud and hand it over as a card. Start each task from the bed board with filters cleared.

| # | Scenario | Success looks like | Watch for |
|---|---|---|---|
| T1 | "A man in his 40s needs **detox** today. He has **Medical Assistance**. Find where you'd call first." | Picks Detox + Men, sets payment, names a facility with an open count, and finds its phone number | Do they see the counts in the Bed type control? Do they find payment under More filters? Do they trust "Today 9:14 AM"? |
| T2 | "Same man — he's in **McKeesport**. Which open detox is **closest**?" | Types the ZIP or town, switches to the map or distance sort, and picks the nearest open facility | Do they find the address box in the find bar? Do they understand "straight-line"? |
| T3 | "You've just referred him to that facility. **Let everyone know** a bed is taken." | Uses "Mark a referral" and confirms; the count drops by one | Is the button where they expect, next to Call? Do they notice the Undo? |
| T4 | "A woman needs **residential** care and is **pregnant**. Can that facility take her?" | Opens the card's "Who they take" and finds the pregnancy line, or decides to call | Do they read the restrictions before calling? Is "Won't take" clear? |
| T5 | "Your coworker asks which facilities **haven't updated** today." | Uses the All facilities tab or the "updated in the last 24 hours" filter, or reads the stale-data notice | Do they understand the update times and the source? |
| T6 | "Send a colleague the **same search** you're looking at." | Copies the page address (the filters are in the URL) | Do they expect this to work? (Discovery only — don't count it as a failure.) |

## Tasks — provider admissions (25 min)

| # | Scenario | Success looks like | Watch for |
|---|---|---|---|
| P1 | "It's 8 AM. Update today's open beds: **2 detox for men** at one facility. Everything else is the same as yesterday." | Opens that facility, enters 2, uses "No change — confirm last counts" on the others they mean to confirm, checks the review, sends | Do multi-site providers use the jump list? Do they understand that leaving a facility closed changes nothing? Is the review step welcome or a nuisance? |
| P2 | "You now have **women's PHP** beds, which the form doesn't show." | Uses "Add a bed type or split by men / women" | Do they find it? Do the extra rows make sense? |
| P3 | "You **stopped taking people on methadone**. Tell Pathways." | Opens Facility details and edits the MOUD line | Do they know this belongs in the update form? |
| P4 | "You're opening a **new location** next month." | Uses "Add a provider or facility" and understands DHS will check it before it appears | Is the "DHS checks first" message clear? |
| P5 | "Would you use this **instead of the email**? What would stop you?" | — (interview) | Effort compared with the email, who on their team would do it, and when in the day |

## DHS admin (optional, 10 min, with one DHS staff member)

- "An email came in that the board couldn't match. Put it on the board." → assigns a facility, then publishes.
- "A provider changed their details by mistake. Undo it." → Revert, then the toast's Undo.

## Wrap-up (5 min)

- On a scale of 1–7, how easy was that? Why that number and not lower?
- What would make you trust these numbers enough to skip a call?
- What's missing that you'd need on a night shift?

## What we'll measure

| Measure | How | Target for this round |
|---|---|---|
| Task success | Done without help / done with a hint / not done | ≥ 4 of 5 people complete T1, T3, P1 without help |
| Time on task | From the scenario card to the answer, T1 and P1 | T1 under 60 s; P1 under 2 min for a multi-site provider |
| Errors | Wrong facility, wrong filter, a referral marked on the wrong card, counts entered in the wrong facility | Each one gets logged with what led to it |
| Ease rating | Single Ease Question (1–7) after each task | Median ≥ 5.5 |
| Trust | "Would you call based on this?" after T1 and T4 | Collect reasons, both yes and no |
| Accessibility | One participant using a screen reader or 200% zoom, if anyone on the team does | No blockers |

## Note-taking template

| Participant | Task | Result (done / hint / not done) | Time | Errors | Quote | Severity (1–4) | Idea |
|---|---|---|---|---|---|---|---|

Severity: **4** blocks the task · **3** causes an error or a long delay · **2** slows them down or confuses · **1** cosmetic.

## After the sessions

1. Debrief within a day while it's fresh: the top 3 problems per person.
2. Affinity-map the notes, then rank problems by severity × how many people hit them.
3. Write up a one-page readout (problems, evidence, proposed fix) for Pathways leadership and the product team.
4. Fix the severity 3–4 problems, then test those fixes with 2–3 new people.

## Questions this round should settle

- Do intake staff trust a count with a timestamp, or do they still call to check? (This decides how much the referral feature and data freshness are worth.)
- Will providers update the form every morning instead of emailing? If not, the email parser stays the main way data comes in.
- Is "Men / Women / sex not given" the right split, or do staff need other categories?
- Is the map used, or is distance sort enough?
