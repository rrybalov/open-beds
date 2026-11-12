/*
 * The 7 provider bed emails Pathways received Nov 2–3, 2026, as plain text.
 * Signatures, staff names and personal addresses are removed (sender local
 * parts are "redacted"). Used to seed the demo and to test the email parser.
 *
 * hoursAgo: how long before "now" the demo treats each email as received,
 * so the relative timing of the originals is kept (originals: board at
 * Nov 3, 2026, 2:00 PM).
 */
(function (root) {
  var SAMPLE_EMAILS = [
    {
      key: "upmc-mercy",
      originalSent: "2026-11-03T06:30:00-05:00",
      hoursAgo: 7.5,
      from: "redacted@upmc.edu",
      subject: "Mercy Detox Census",
      body: "Hi,\n9 available beds, 1 scheduled discharge\nAddiction Medicine Liaison Nurse\nUPMC Mercy"
    },
    {
      key: "upmc-mckeesport",
      originalSent: "2026-11-03T07:15:00-05:00",
      hoursAgo: 6.75,
      from: "redacted@upmc.edu",
      subject: "Re: Mercy Detox Census",
      body: "McKeesport 5 rehab 0 detox 0 discharges 0 admissions\n14 cap 9 open beds\nThank you,\nUnit Director\nAddiction Medicine Services\nUPMC McKeesport\n\nFrom: redacted@upmc.edu\nSent: Tuesday, November 3, 2026 6:29 AM\nSubject: Mercy Detox Census\nHi,\n9 available beds, 1 scheduled discharge"
    },
    {
      key: "acadia-pac",
      originalSent: "2026-11-03T09:55:00-05:00",
      hoursAgo: 4.08,
      from: "redacted@acadiahealthcare.com",
      subject: "11/03-TUESDAY-PAC Bed Availability",
      body: [
        "Hi! Please see below for current availability.",
        "PAC Bed Availability",
        "Facility        Detox       Res        PHP",
        "Bowling Green   6   3       0   4      0   2",
        "Bradford        1   4       6   2      0   0",
        "Cove Forge      5   5       6   8      0   0",
        "Allenwood       3   2       3   2      NA  NA",
        "Lehigh          4   0       0   0      NA  NA",
        "York            NA  0       NA  0      NA  NA",
        "Mt Zion         1   NA      1   NA     NA  NA",
        "York PHP        NA  NA      NA  NA     0   NA",
        "PMRC            1   2       0   5      8   0",
        "HCRC            2   3       4   0      NA  NA",
        "HCRC Adol       NA  NA      6   1      NA  NA",
        "Senior Lead Patient Navigator"
      ].join("\n")
    },
    {
      key: "vfmc",
      originalSent: "2026-11-03T10:03:00-05:00",
      hoursAgo: 3.95,
      from: "redacted@vfmc.net",
      subject: "Valley Forge Medical Center | Bed Availability for Tuesday, November 3rd",
      body: "Beds open today. Hospital-level care for patients with complex medical needs.\nREFERRAL PARTNER UPDATE\nBEDS AVAILABLE TODAY\nTODAY'S AVAILABILITY • TUESDAY, NOVEMBER 3RD, 2026\n7\nBEDS OPEN\nDetox or rehab beds for patients with a substance use disorder history and medical needs.\nTwo Levels of Inpatient Care\nLevel 4 for patients who need medically managed, hospital-level detox and/or rehab, and Level 3.7 for those who need medically monitored inpatient treatment."
    },
    {
      key: "pyramid-silvermist",
      originalSent: "2026-11-02T09:57:00-05:00",
      hoursAgo: 28.05,
      from: "redacted@pyramidhc.com",
      subject: "Silvermist Bed Availability",
      body: "Good Morning,\nWe currently have 3 adult male residential beds available at Silvermist Pittsburgh for Mental Health or Substance Use Treatment. Also, we have 4 adult female residential beds at Silvermist Pocono for Mental Health. Finally, we have 1 PHP SUD Bed available at our Providence House. If you have anyone who needs this level of care or if you have any questions, please do not hesitate to contact me.\nNational Clinical Liaison\nPyramid Healthcare"
    },
    {
      key: "gaiser",
      originalSent: "2026-11-02T08:03:00-05:00",
      hoursAgo: 29.95,
      from: "redacted@ellenobriengaisercenter.ccsend.com",
      subject: "Open Male and Female Inpatient Beds",
      body: "Gaiser Center Inpatient Bed Availability\nInpatient Bed Openings\nNovember 2, 2026\nMale Residential Beds:      Female Residential Beds:\n4                           3\nFor direct admissions, referrals, transfers to our Inpatient, or our Outpatient location, contact admissions.\nOur Inpatient Program Offers: Medication Assisted Treatment (MAT), Trauma Therapy, Gender Specific Facilities and Programs\n**We are also accepting clients at our Outpatient Program (IOP, OP)**\nWe offer morning, evening, weekend, and telehealth availability.\nInsurances We Accept: Most Western PA SCA Funding"
    },
    {
      key: "spiritlife",
      originalSent: "2026-11-02T08:27:00-05:00",
      hoursAgo: 29.55,
      from: "redacted@spiritlifeinc.org",
      subject: "Bed availability",
      body: "Good morning, all,\nSpiritLife has beds available and transportation this week, we hope to hear from you all. Have a great day and week. Let me know if I can assist with anything.\nDirector of Marketing and Referral Development\nSpiritLife, Inc."
    }
  ];

  // Extra examples for the admin "simulate an email" tool.
  var EXTRA_EMAILS = [
    {
      key: "standard-format",
      label: "Gaiser Center — recommended standard format",
      from: "redacted@gaisercenter.com",
      subject: "Open beds — Gaiser Center",
      body: "Site: Gaiser Center\nResidential male: 2\nResidential female: 5\nOutpatient: yes\nNotes: 1 discharge expected this afternoon"
    },
    {
      key: "unknown-sender",
      label: "Unrecognized sender — goes to review",
      from: "intake@example-recovery.org",
      subject: "Beds today",
      body: "Good morning! We have 3 detox beds and 2 rehab beds open for men today. Call us to refer."
    }
  ];

  var out = { samples: SAMPLE_EMAILS, extras: EXTRA_EMAILS };
  if (typeof module !== "undefined" && module.exports) module.exports = out;
  else root.OPEN_BEDS_EMAILS = out;
})(typeof window !== "undefined" ? window : this);
