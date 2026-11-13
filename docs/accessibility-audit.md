## Accessibility Audit: Open Beds (bed board, provider update form, DHS admin)
**Standard:** WCAG 2.2 AA | **Date:** November 13, 2026

Method (from the design `accessibility-review` skill, extended to 2.2): scripted automated scan of 22 page states (board list, filtered, locations open, map, All sites, Updates, referral and source dialogs, toast; update form with details, new facility, new provider, errors; admin updates, simulator, three dialogs, settings; phone 390px for each page), keyboard-only pass over ~400 tab stops, dialog focus tests, reflow at 320px (= 400% zoom), WCAG 1.4.12 text-spacing override, contrast measured on every rendered text node and control border, and a screen-reader tree review. Rerun with `node tests/a11y.js` while serving the folder on port 8765.

### Summary
**Issues found:** 13 | **Critical:** 2 | **Major:** 8 | **Minor:** 3 — **all fixed; rescan: 0 issues**

### Findings

#### Perceivable
| # | Issue | WCAG Criterion | Severity | Fix |
|---|-------|---------------|----------|----------------|
| 1 | “0” counts in bed tables were 3.19:1 (2.78:1 in a highlighted column) | 1.4.3 Contrast | 🔴 Critical | Zero / N/A / “not given” text set to #5C6075 (≥ 5.4:1 on every surface) |
| 2 | Highlighted “Women” header 4.47:1, “N/A” 4.26:1, “one count for both” 4.33:1 | 1.4.3 Contrast | 🔴 Critical | Header uses Dark Blue; highlight backgrounds lightened; sub-labels #5C6075 |
| 3 | Filtered column marked by color alone | 1.4.1 Use of Color | 🟢 Minor | Highlighted column header is also underlined; highlighted row keeps its left bar |
| 4 | Toast “Undo” had no cue that it is a control | 1.4.11 Non-text Contrast | 🟡 Major | Underlined text button in Sky on Black (11.7:1) |
| 5 | Heading jumped h2 → h4 in the admin Edit details dialog | 1.3.1 Info and Relationships | 🟢 Minor | Section headings follow their context (h3 in dialogs, h4 under a site) |
| 6 | Facility cards had no accessible name | 1.3.1 Info and Relationships | 🟢 Minor | Each card is labelled by its facility heading |

#### Operable
| # | Issue | WCAG Criterion | Severity | Fix |
|---|-------|---------------|----------|----------------|
| 7 | Tab could leave open dialogs and reach the page behind | 2.4.3 Focus Order | 🟡 Major | Page behind is `inert` while a dialog is open; Tab / Shift+Tab cycle inside |
| 8 | Live refresh (every minute, or another tab’s update) destroyed the focused control | 2.4.3 Focus Order / 3.2.1 | 🟡 Major | Re-renders restore focus to the same control (board and admin) |
| 9 | Toast could cover a focused control near the bottom of the screen | 2.4.11 Focus Not Obscured | 🟡 Major | Toast dismisses with Esc or ✕; focused controls scroll clear while it shows |
| 10 | Phone links in All sites 18px tall; “Test the email alias” 22px | 2.5.8 Target Size | 🟡 Major | Both at least 24px (toggle 44px); all link buttons min 24px |

#### Understandable
| # | Issue | WCAG Criterion | Severity | Fix |
|---|-------|---------------|----------|----------------|
| 11 | DHS staff retyped their name in every dialog; providers their role | 3.3.7 Redundant Entry | 🟡 Major | Name and role are remembered and prefilled |

#### Robust
| # | Issue | WCAG Criterion | Severity | Fix |
|---|-------|---------------|----------|----------------|
| 12 | Address lookup results and errors were not announced | 4.1.3 Status Messages | 🟡 Major | Lookup message is a polite live region |
| 13 | Repeated “Directions”, “Website”, “View email”, “Correct counts” were ambiguous out of context | 2.4.4 Link Purpose / 4.1.2 | 🟡 Major | Each carries the facility name (and “opens in a new tab”) for screen readers |

### Color Contrast Check
| Element | Foreground | Background | Ratio | Required | Pass? |
|---------|-----------|------------|-------|----------|-------|
| Body text | #3D3D4B | #F5F5FF | 9.9:1 | 4.5:1 | ✅ |
| Bed counts | #121221 | #FFFFFF | 18.7:1 | 4.5:1 | ✅ |
| Zero / N/A cells | #5C6075 | #FFFFFF / #F0F0FC | 6.2 / 5.5:1 | 4.5:1 | ✅ |
| Highlighted column header | #262673 | #F5F5FF | 12.1:1 | 4.5:1 | ✅ |
| Open count box | #0A6559 | #DFF7F2 | 6.4:1 | 4.5:1 | ✅ |
| Stale update time | #B4382C | #FFFFFF | 5.9:1 | 4.5:1 | ✅ |
| Review status | #6E4A0E | #FFF9EE | 7.6:1 | 4.5:1 | ✅ |
| Links / link buttons | #2626D9 | #FFFFFF | 8.1:1 | 4.5:1 | ✅ |
| Toast Undo | #ACD0FF | #121221 | 11.7:1 | 4.5:1 | ✅ |
| Input borders | #6C7084 | #FFFFFF | 4.9:1 | 3:1 | ✅ |

### Keyboard Navigation
| Element | Tab Order | Enter/Space | Escape | Arrow Keys |
|---------|-----------|-------------|--------|------------|
| Sidebar links | First, in visual order | Follow link | — | — |
| Filter segments | One stop per group | Select | — | Move between options |
| Locations | Button, then checkboxes | Open / toggle | Close, focus returns to button | — |
| Summary counts | In order | Toggle filter (aria-pressed) | — | — |
| Tabs | Selected tab only | Activate | — | Left/Right move and select |
| Mark a referral | Per card | Opens dialog, focus on bed choice | Closes, focus returns | Choose bed |
| Dialogs | Trapped inside | Submit | Close | — |
| Map list | Per provider | Expand and pan map | — | — |
| Toast | After page content | Undo / dismiss | Dismiss | — |

### Screen Reader
| Element | Announced As | Issue |
|---------|-------------|-------|
| Facility card | “article, Cove Forge” → count → heading → table “Open beds at Cove Forge by type” with row/column headers | None |
| Filters | Groups “Bed type”, “Sex”, “Age” of radio buttons with checked state | None |
| Mark a referral | “Mark a referral to Cove Forge, button” | None |
| Board status, toast, admin status, lookup message | Live regions (polite) | None |

### Not covered by automation — verify before launch
1. **Real Leaflet map:** markers are keyboard-focusable in Leaflet; the provider list beside the map is the full non-map, non-drag alternative (2.5.7). Recheck once the map library loads on the county network.
2. **Assistive technology pass:** run NVDA + Chrome and VoiceOver + Safari through “find a bed → mark a referral → undo” and the provider form once.
3. **Content changes:** new provider notes and facility details are provider-entered text; plain-language review is editorial, not technical.
