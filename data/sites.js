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
        beds: [{ type: "shared", covers: ["detox", "residential"], label: "detox or rehab" }] },

      // Pyramid Healthcare
      { id: "silvermist-pgh", org: "pyramid", name: "Silvermist Pittsburgh", aliases: ["silvermist pittsburgh"], town: "Renfrew", region: "western", population: "adult", services: ["SUD", "MH"], contact: null,
        beds: [{ type: "residential", sexes: ["male"] }] },
      { id: "silvermist-pocono", org: "pyramid", name: "Silvermist Pocono", aliases: ["silvermist pocono"], town: "Moscow", region: "eastern", population: "adult", services: ["MH"], contact: null,
        beds: [{ type: "residential", sexes: ["female"] }] },
      { id: "providence-house", org: "pyramid", name: "Providence House", aliases: ["providence house"], town: "Location not stated", region: "unknown", population: "adult", services: ["SUD"], contact: null,
        beds: [{ type: "php", sexes: ["any"] }] },

      // Gaiser
      { id: "gaiser", org: "gaiser", name: "Gaiser Center", fullName: "Ellen O’Brien Gaiser Center", aliases: ["gaiser"], town: "Butler", region: "western", population: "adult", services: ["SUD"], contact: "724-287-8205",
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


  /*
   * fit: who each site takes, from the Bed Search Worksheet ("worksheet"),
   * provider emails ("email") and provider websites ("website").
   *   levels   ASAM levels the site accepts — match to the client's LOCA recommendation
   *   serves   population as the provider describes it
   *   excludes who they don't take        requires  admission prerequisites
   *   takes    notable clients they do take   payer   funding notes
   *   known    which of pregnancy / moud / medical / legal is on file
   * Anything not listed here is NOT on file — the board says so.
   */
  var WDR = { levels: ["wm37", "35", "25"], levelsNote: "From the worksheet’s White Deer Run entry (ALDA; 2.5 listed as SOP)", source: ["worksheet", "website"] };
  var FIT = {
    "bowling-green": { serves: "Adults", source: ["email"] },
    "bradford": { serves: "Adults", source: ["email"] },
    "cove-forge": { serves: "Adults", notes: ["Direct admission requests by email until about 9 PM"], source: ["email", "worksheet"] },
    "allenwood": Object.assign({ serves: "Adults" }, WDR),
    "lehigh": Object.assign({ serves: "Adults" }, WDR),
    "york": Object.assign({ serves: "Adults" }, WDR),
    "mt-zion": Object.assign({ serves: "Adults" }, WDR),
    "york-php": Object.assign({ serves: "Adults" }, WDR),
    "pmrc": { serves: "Adults", source: ["email"] },
    "hcrc": { serves: "Adults", source: ["email"] },
    "hcrc-adol": { serves: "Adolescents only", source: ["email"] },
    "upmc-mercy": { levels: ["wm4"], takes: ["Medically managed detox (hospital unit, 18 beds)"], known: ["medical"], source: ["worksheet"] },
    "upmc-mckeesport": { levels: ["wm4", "4"], takes: ["People who need medical stabilization"], requires: ["Rehab: already through detox, relapsed, and needs medical treatment"], known: ["medical"], source: ["worksheet"] },
    "vfmc": { levels: ["wm4", "4", "37"], takes: ["Medically complex: IV antibiotics, wound care, CHF, diabetes, hypertension"], payer: "Pre-certification handled by VFMC", known: ["medical"], source: ["email"] },
    "silvermist-pgh": { serves: "Adult men", takes: ["Mental health or substance use"], payer: "Private insurance only", pay: { private: true, medicaid: false, sca: false, medicare: false }, source: ["email", "worksheet"] },
    "silvermist-pocono": { serves: "Adult women", excludes: ["Substance use — mental health beds only"], payer: "Silvermist is listed as private insurance only — confirm", pay: { private: true, medicaid: false, sca: false, medicare: false }, source: ["email", "worksheet"] },
    "providence-house": { levels: ["25"], takes: ["Substance use"], source: ["email"] },
    "gaiser": { levels: ["35", "21", "1"], serves: "Adults · separate men’s and women’s programs", takes: ["MAT"], payer: "Most Western PA SCA funding", pay: { sca: true }, known: ["moud"], source: ["email", "worksheet"] },
    "spiritlife": { levels: ["wm37", "35"], takes: ["Transportation offered"], source: ["worksheet", "email"] }
  };
  OPEN_BEDS_SITES.sites.forEach(function (s) { s.fit = FIT[s.id] || { source: [] }; });

  /*
   * pay (inside fit): payment types a site is known to take (true) or not take (false).
   * Missing = not on file. The board's payment filter hides only sites known NOT to take it.
   */
  OPEN_BEDS_SITES.payTypes = [
    ["medicaid", "Medical Assistance (HealthChoices)", "Medical Assistance"],
    ["sca", "County / SCA funding (uninsured)", "SCA funding"],
    ["private", "Private insurance", "private insurance"],
    ["medicare", "Medicare", "Medicare"]
  ];

  /*
   * geo: map pin. precision "address" = the facility; "town" = town centre (street address
   * not on file); "area" = rough area only. Sites with no geo are listed under the map.
   */
  var GEO = {
    "bowling-green": [39.8468, -75.7116, "town"], "bradford": [41.9834, -76.9483, "town"],
    "cove-forge": [40.4623, -78.1997, "town"], "allenwood": [41.1062, -76.8730, "town"],
    "lehigh": [40.6259, -75.3705, "town"], "york": [39.9626, -76.7277, "town"],
    "mt-zion": [39.9626, -76.7277, "town"], "york-php": [39.9626, -76.7277, "town"],
    "pmrc": [41.1040, -75.2510, "town"], "hcrc": [41.1534, -76.1505, "town"], "hcrc-adol": [41.1534, -76.1505, "town"],
    "upmc-mercy": [40.4362, -79.9852, "address"], "upmc-mckeesport": [40.3487, -79.8544, "address"],
    "vfmc": [40.1215, -75.3399, "town"], "silvermist-pgh": [40.8073, -79.9753, "town"], "silvermist-pocono": [41.3376, -75.5185, "town"],
    "gaiser": [40.8612, -79.8953, "town"], "spiritlife": [40.6195, -79.0372, "town"]
  };
  OPEN_BEDS_SITES.sites.forEach(function (s) { var g = GEO[s.id]; s.geo = g ? { lat: g[0], lng: g[1], precision: g[2] } : null; });
  OPEN_BEDS_SITES.levels = [
    ["wm4", "WM 4", "Medically managed withdrawal"], ["wm37", "WM 3.7", "Medically monitored withdrawal"],
    ["4", "4", "Medically managed inpatient"], ["37", "3.7", "Medically monitored inpatient"],
    ["35", "3.5", "Clinically managed residential"], ["25", "2.5", "Partial hospitalization (PHP)"],
    ["21", "2.1", "Intensive outpatient (IOP)"], ["1", "1", "Outpatient"]
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = OPEN_BEDS_SITES;
  else root.OPEN_BEDS_SITES = OPEN_BEDS_SITES;
})(typeof window !== "undefined" ? window : this);
