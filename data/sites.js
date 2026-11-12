/*
 * Open Beds — provider and site profiles.
 *
 * Profiles change rarely (location, what each site offers, admissions line).
 * Daily counts are NOT stored here; they arrive as reports (email, provider
 * form or DHS admin) and live in the store.
 *
 * beds: what the site can report, which drives the provider form and admin editor.
 *   { type: "detox"|"residential"|"php", sexes: ["male","female"] | ["any"] }
 *   { type: "shared", covers: ["detox","residential"], label: "detox or rehab" }
 *   { type: "outpatient", mode: "yesno" }
 *
 * This repository is public: no staff names, personal emails or direct lines.
 */
(function (root) {
  var OPEN_BEDS_SITES = {
    orgs: [
      { id: "acadia", name: "Acadia Healthcare — PA Addiction Centers (PAC)", short: "Acadia (PAC)", senderDomains: ["acadiahealthcare.com"] },
      { id: "upmc", name: "UPMC", short: "UPMC", senderDomains: ["upmc.edu"] },
      { id: "vfmc", name: "Valley Forge Medical Center and Hospital", short: "Valley Forge Medical Center", senderDomains: ["vfmc.net"] },
      { id: "pyramid", name: "Pyramid Healthcare", short: "Pyramid Healthcare", senderDomains: ["pyramidhc.com"] },
      { id: "gaiser", name: "Ellen O’Brien Gaiser Center", short: "Gaiser Center", senderDomains: ["gaisercenter.com", "ellenobriengaisercenter.ccsend.com"] },
      { id: "spiritlife", name: "SpiritLife", short: "SpiritLife", senderDomains: ["spiritlifeinc.org"] }
    ],

    sites: [
      // Acadia (PAC) — Acadia's table splits each bed type into two unlabeled columns, read as male / female.
      { id: "bowling-green", org: "acadia", name: "Bowling Green", aliases: ["bowling green"], town: "Kennett Square", region: "eastern", population: "adult", services: ["SUD"], contact: "610-347-5625",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "bradford", org: "acadia", name: "Bradford", aliases: ["bradford"], town: "Millerton", region: "central", population: "adult", services: ["SUD"], contact: "570-537-6035",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "cove-forge", org: "acadia", name: "Cove Forge", aliases: ["cove forge"], town: "Williamsburg", region: "central", population: "adult", services: ["SUD"], contact: "800-873-2131",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "allenwood", org: "acadia", name: "Allenwood", aliases: ["allenwood"], town: "Allenwood", region: "central", population: "adult", services: ["SUD"], contact: "570-980-2114",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "lehigh", org: "acadia", name: "Lehigh", aliases: ["lehigh"], town: "Bethlehem", region: "eastern", population: "adult", services: ["SUD"], contact: "610-814-7750",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "york", org: "acadia", name: "York", aliases: ["york"], town: "York", region: "central", population: "adult", services: ["SUD"], contact: "717-840-2308",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "mt-zion", org: "acadia", name: "Mt Zion", aliases: ["mt zion", "mt. zion", "mount zion"], town: "York", region: "central", population: "adult", services: ["SUD"], contact: "717-893-5339",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "york-php", org: "acadia", name: "York PHP", aliases: ["york php"], town: "York", region: "central", population: "adult", services: ["SUD"], contact: "717-840-2308",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "pmrc", org: "acadia", name: "PMRC", fullName: "Pocono Mountain Recovery Center", aliases: ["pmrc", "pocono mountain"], town: "Henryville", region: "eastern", population: "adult", services: ["SUD"], contact: "570-216-5555",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "hcrc", org: "acadia", name: "HCRC", fullName: "Huntington Creek Recovery Center", aliases: ["hcrc", "huntington creek"], town: "Shickshinny", region: "eastern", population: "adult", services: ["SUD"], contact: "570-216-5555",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },
      { id: "hcrc-adol", org: "acadia", name: "HCRC Adolescent", fullName: "Huntington Creek Recovery Center — adolescent unit", aliases: ["hcrc adol", "hcrc adolescent"], town: "Shickshinny", region: "eastern", population: "adolescent", services: ["SUD"], contact: "570-216-5555",
        beds: [{ type: "detox", sexes: ["male", "female"] }, { type: "residential", sexes: ["male", "female"] }, { type: "php", sexes: ["male", "female"] }] },

      // UPMC
      { id: "upmc-mercy", org: "upmc", name: "UPMC Mercy", aliases: ["mercy"], town: "Pittsburgh", region: "allegheny", population: "adult", services: ["SUD"], contact: null,
        beds: [{ type: "detox", sexes: ["any"] }] },
      { id: "upmc-mckeesport", org: "upmc", name: "UPMC McKeesport", aliases: ["mckeesport"], town: "McKeesport", region: "allegheny", population: "adult", services: ["SUD"], contact: null,
        beds: [{ type: "shared", covers: ["detox", "residential"], label: "detox or rehab" }] },

      // Valley Forge
      { id: "vfmc", org: "vfmc", name: "Valley Forge Medical Center", aliases: ["valley forge", "vfmc"], town: "Norristown", region: "eastern", population: "adult", services: ["SUD"], contact: "610-539-8500",
        levels: ["4", "3.7"], tags: ["Medically complex OK: IV antibiotics, wound care, CHF, diabetes", "Pre-certification handled", "Hospital-level care"],
        beds: [{ type: "shared", covers: ["detox", "residential"], label: "detox or rehab" }] },

      // Pyramid Healthcare
      { id: "silvermist-pgh", org: "pyramid", name: "Silvermist Pittsburgh", aliases: ["silvermist pittsburgh"], town: "Pittsburgh area", region: "western", population: "adult", services: ["SUD", "MH"], contact: null,
        tags: ["Mental health or substance use"],
        beds: [{ type: "residential", sexes: ["male"] }] },
      { id: "silvermist-pocono", org: "pyramid", name: "Silvermist Pocono", aliases: ["silvermist pocono"], town: "Pocono region", region: "eastern", population: "adult", services: ["MH"], contact: null,
        tags: ["Mental health only"],
        beds: [{ type: "residential", sexes: ["female"] }] },
      { id: "providence-house", org: "pyramid", name: "Providence House", aliases: ["providence house"], town: "Location not stated", region: "unknown", population: "adult", services: ["SUD"], contact: null,
        beds: [{ type: "php", sexes: ["any"] }] },

      // Gaiser
      { id: "gaiser", org: "gaiser", name: "Gaiser Center", fullName: "Ellen O’Brien Gaiser Center", aliases: ["gaiser"], town: "Butler", region: "western", population: "adult", services: ["SUD"], contact: "724-287-8205",
        tags: ["MAT", "Gender-specific programs", "Most Western PA SCA funding"],
        beds: [{ type: "residential", sexes: ["male", "female"] }, { type: "outpatient", mode: "yesno" }] },

      // SpiritLife — emails give no count; levels from the Bed Search Worksheet (WM 3.7, 3.5).
      { id: "spiritlife", org: "spiritlife", name: "SpiritLife", aliases: ["spiritlife", "spirit life"], town: "Penn Run", region: "western", population: "adult", services: ["SUD"], contact: null,
        beds: [{ type: "detox", sexes: ["any"] }, { type: "residential", sexes: ["any"] }] }
    ],

    regions: {
      allegheny: { label: "Allegheny County", order: 0 },
      western: { label: "Western PA", order: 1 },
      central: { label: "Central PA", order: 2 },
      eastern: { label: "Eastern PA", order: 3 },
      unknown: { label: "Location not stated", order: 4 }
    }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = OPEN_BEDS_SITES;
  else root.OPEN_BEDS_SITES = OPEN_BEDS_SITES;
})(typeof window !== "undefined" ? window : this);
