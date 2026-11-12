/*
 * Open Beds — normalized daily bed reports
 *
 * Source: 7 bed-availability emails that providers sent to Pathways on
 * Nov 2–3, 2026, forwarded to the county as examples. Counts are exactly as
 * the providers reported them. Nothing here is live.
 *
 * Privacy: this repository is public. Staff names, personal email addresses
 * and direct or cell numbers from the emails are NOT stored here. Only
 * organization-level admissions lines that appear in the emails are kept.
 *
 * Shape of a site record
 *   counts[type][sex]  number  = beds open
 *                      0       = offered, full today
 *                      "na"    = provider marked not available / not offered
 *                      (absent) = not mentioned in the report
 *   type: detox | residential | php | outpatient
 *   sex:  male | female | any   ("any" = the report did not split by sex)
 *   shared       one count that covers several bed types (e.g. "detox or rehab")
 *   qualitative  availability stated without a number
 */
window.OPEN_BEDS = {
  boardTime: "2026-11-03T14:00:00-05:00",
  sourceNote: "7 provider emails received by Pathways, Nov 2–3, 2026",

  reports: [
    {
      id: "acadia-pac",
      organization: "Acadia Healthcare — PA Addiction Centers (PAC)",
      sentAt: "2026-11-03T09:55:00-05:00",
      sender: "Senior Lead Patient Navigator",
      format: "Table in email body",
      specificity: "by-sex",
      sites: ["bowling-green", "bradford", "cove-forge", "allenwood", "lehigh", "york", "mt-zion", "york-php", "pmrc", "hcrc", "hcrc-adol"],
      gives: "Open beds for 11 sites × detox / residential / PHP, two sub-columns each; NA marks beds not offered.",
      missing: "Sub-columns are unlabeled (blue/pink — read as male/female). No locations, levels of care, payers or restrictions.",
      ingest: "Structured — parse the table. Same layout daily."
    },
    {
      id: "upmc-mercy",
      organization: "UPMC Mercy",
      sentAt: "2026-11-03T06:30:00-05:00",
      sender: "Addiction Medicine Liaison Nurse",
      format: "One-line email (“Mercy Detox Census”)",
      specificity: "by-type",
      sites: ["upmc-mercy"],
      gives: "9 available detox beds, 1 scheduled discharge.",
      missing: "No split by sex. Level of care only from the subject line (detox).",
      ingest: "Short sentence — a two-field form would replace it."
    },
    {
      id: "upmc-mckeesport",
      organization: "UPMC McKeesport",
      sentAt: "2026-11-03T07:15:00-05:00",
      sender: "Unit Director, Addiction Medicine Services",
      format: "Reply-all one-liner on the Mercy thread",
      specificity: "total-only",
      sites: ["upmc-mckeesport"],
      gives: "Census 5 rehab, 0 detox; 0 discharges, 0 admissions; capacity 14; 9 open.",
      missing: "Open beds aren’t split between detox and rehab, or by sex.",
      ingest: "Shorthand — needs a person or a form."
    },
    {
      id: "vfmc",
      organization: "Valley Forge Medical Center and Hospital",
      sentAt: "2026-11-03T10:03:00-05:00",
      sender: "Admissions team (marketing newsletter)",
      format: "Designed marketing email",
      specificity: "total-only",
      sites: ["vfmc"],
      gives: "7 beds open, detox or rehab, Levels 4 and 3.7; medically complex patients accepted; pre-cert handled.",
      missing: "No split by level, type or sex.",
      ingest: "Number sits in an image-heavy layout — manual entry."
    },
    {
      id: "pyramid-silvermist",
      organization: "Pyramid Healthcare",
      sentAt: "2026-11-02T09:57:00-05:00",
      sender: "National Clinical Liaison",
      format: "Prose email",
      specificity: "by-sex",
      sites: ["silvermist-pgh", "silvermist-pocono", "providence-house"],
      gives: "3 adult male residential (MH or SUD) at Silvermist Pittsburgh; 4 adult female residential (MH) at Silvermist Pocono; 1 SUD PHP at Providence House.",
      missing: "Providence House location. Whether the Pocono beds take SUD clients.",
      ingest: "Prose — manual entry."
    },
    {
      id: "gaiser",
      organization: "Ellen O’Brien Gaiser Center",
      sentAt: "2026-11-02T08:03:00-05:00",
      sender: "Admissions (Constant Contact newsletter)",
      format: "Designed marketing email",
      specificity: "by-sex",
      sites: ["gaiser"],
      gives: "4 male and 3 female residential beds; also accepting IOP and OP clients.",
      missing: "No detox count. No level of care stated for residential.",
      ingest: "Two numbers in a template — manual entry or template parse."
    },
    {
      id: "spiritlife",
      organization: "SpiritLife",
      sentAt: "2026-11-02T08:27:00-05:00",
      sender: "Director of Marketing and Referral Development",
      format: "Prose email with rack card",
      specificity: "none",
      sites: ["spiritlife"],
      gives: "“Beds available and transportation this week.”",
      missing: "No count, bed type, sex or level of care.",
      ingest: "Can’t be counted — shows as “available, call”."
    }
  ],

  sites: [
    // ---- Acadia (PAC). Sub-columns read as male / female from colour; confirm with Acadia.
    { id: "bowling-green", name: "Bowling Green", org: "Acadia (PAC)", report: "acadia-pac", town: "Kennett Square", region: "eastern", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: 6, female: 3 }, residential: { male: 0, female: 4 }, php: { male: 0, female: 2 } },
      contact: "610-347-5625" },
    { id: "bradford", name: "Bradford", org: "Acadia (PAC)", report: "acadia-pac", town: "Millerton", region: "central", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: 1, female: 4 }, residential: { male: 6, female: 2 }, php: { male: 0, female: 0 } },
      contact: "570-537-6035" },
    { id: "cove-forge", name: "Cove Forge", org: "Acadia (PAC)", report: "acadia-pac", town: "Williamsburg", region: "central", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: 5, female: 5 }, residential: { male: 6, female: 8 }, php: { male: 0, female: 0 } },
      contact: "800-873-2131" },
    { id: "allenwood", name: "Allenwood", org: "Acadia (PAC)", report: "acadia-pac", town: "Allenwood", region: "central", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: 3, female: 2 }, residential: { male: 3, female: 2 }, php: { male: "na", female: "na" } },
      contact: "570-980-2114" },
    { id: "lehigh", name: "Lehigh", org: "Acadia (PAC)", report: "acadia-pac", town: "Bethlehem", region: "eastern", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: 4, female: 0 }, residential: { male: 0, female: 0 }, php: { male: "na", female: "na" } },
      contact: "610-814-7750" },
    { id: "york", name: "York", org: "Acadia (PAC)", report: "acadia-pac", town: "York", region: "central", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: "na", female: 0 }, residential: { male: "na", female: 0 }, php: { male: "na", female: "na" } },
      contact: "717-840-2308" },
    { id: "mt-zion", name: "Mt Zion", org: "Acadia (PAC)", report: "acadia-pac", town: "York", region: "central", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: 1, female: "na" }, residential: { male: 1, female: "na" }, php: { male: "na", female: "na" } },
      contact: "717-893-5339" },
    { id: "york-php", name: "York PHP", org: "Acadia (PAC)", report: "acadia-pac", town: "York", region: "central", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: "na", female: "na" }, residential: { male: "na", female: "na" }, php: { male: 0, female: "na" } },
      contact: "717-840-2308" },
    { id: "pmrc", name: "PMRC", fullName: "Pocono Mountain Recovery Center", org: "Acadia (PAC)", report: "acadia-pac", town: "Henryville", region: "eastern", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: 1, female: 2 }, residential: { male: 0, female: 5 }, php: { male: 8, female: 0 } },
      contact: "570-216-5555" },
    { id: "hcrc", name: "HCRC", fullName: "Huntington Creek Recovery Center", org: "Acadia (PAC)", report: "acadia-pac", town: "Shickshinny", region: "eastern", population: "adult", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: 2, female: 3 }, residential: { male: 4, female: 0 }, php: { male: "na", female: "na" } },
      contact: "570-216-5555" },
    { id: "hcrc-adol", name: "HCRC Adolescent", fullName: "Huntington Creek Recovery Center — adolescent unit", org: "Acadia (PAC)", report: "acadia-pac", town: "Shickshinny", region: "eastern", population: "adolescent", services: ["SUD"], sexSplitInferred: true,
      counts: { detox: { male: "na", female: "na" }, residential: { male: 6, female: 1 }, php: { male: "na", female: "na" } },
      contact: "570-216-5555" },

    // ---- UPMC
    { id: "upmc-mercy", name: "UPMC Mercy", org: "UPMC", report: "upmc-mercy", town: "Pittsburgh", region: "allegheny", population: "adult", services: ["SUD"],
      counts: { detox: { any: 9 } },
      notes: ["1 scheduled discharge"],
      contact: null },
    { id: "upmc-mckeesport", name: "UPMC McKeesport", org: "UPMC", report: "upmc-mckeesport", town: "McKeesport", region: "allegheny", population: "adult", services: ["SUD"],
      shared: { types: ["detox", "residential"], open: 9, label: "detox or rehab" },
      notes: ["Capacity 14 · census 5 rehab, 0 detox", "0 discharges, 0 admissions today"],
      contact: null },

    // ---- Valley Forge
    { id: "vfmc", name: "Valley Forge Medical Center", org: "Valley Forge Medical Center", report: "vfmc", town: "Norristown", region: "eastern", population: "adult", services: ["SUD"],
      shared: { types: ["detox", "residential"], open: 7, label: "detox or rehab" },
      levels: ["4", "3.7"],
      tags: ["Medically complex OK: IV antibiotics, wound care, CHF, diabetes", "Pre-certification handled", "Hospital-level care"],
      notes: ["Admissions hours as written: “7:30–12:00 AM”"],
      contact: "610-539-8500" },

    // ---- Pyramid Healthcare
    { id: "silvermist-pgh", name: "Silvermist Pittsburgh", org: "Pyramid Healthcare", report: "pyramid-silvermist", town: "Pittsburgh area", region: "western", population: "adult", services: ["SUD", "MH"],
      counts: { residential: { male: 3 } },
      tags: ["Mental health or substance use"],
      contact: null },
    { id: "silvermist-pocono", name: "Silvermist Pocono", org: "Pyramid Healthcare", report: "pyramid-silvermist", town: "Pocono region", region: "eastern", population: "adult", services: ["MH"],
      counts: { residential: { female: 4 } },
      tags: ["Mental health only"],
      contact: null },
    { id: "providence-house", name: "Providence House", org: "Pyramid Healthcare", report: "pyramid-silvermist", town: "Location not stated", region: "unknown", population: "adult", services: ["SUD"],
      counts: { php: { any: 1 } },
      contact: null },

    // ---- Gaiser
    { id: "gaiser", name: "Gaiser Center", fullName: "Ellen O’Brien Gaiser Center", org: "Gaiser Center", report: "gaiser", town: "Butler", region: "western", population: "adult", services: ["SUD"],
      counts: { residential: { male: 4, female: 3 } },
      qualitative: [{ types: ["outpatient"], label: "Accepting IOP and OP — mornings, evenings, weekends, telehealth" }],
      tags: ["MAT", "Gender-specific programs", "Most Western PA SCA funding"],
      contact: "724-287-8205" },

    // ---- SpiritLife
    { id: "spiritlife", name: "SpiritLife", org: "SpiritLife", report: "spiritlife", town: "Penn Run", region: "western", population: "adult", services: ["SUD"],
      qualitative: [{ types: ["unknown"], label: "“Beds available this week” — type and count not given" }],
      tags: ["Transportation available this week"],
      contact: null }
  ],

  regions: {
    allegheny: { label: "Allegheny County", order: 0 },
    western: { label: "Western PA", order: 1 },
    central: { label: "Central PA", order: 2 },
    eastern: { label: "Eastern PA", order: 3 },
    unknown: { label: "Location not stated", order: 4 }
  }
};
