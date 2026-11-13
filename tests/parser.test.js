// Run: node tests/parser.test.js
"use strict";
var assert = require("assert");
var data = require("../data/sites.js");
var emails = require("../data/sample-emails.js");
var P = require("../assets/parser.js");

var byKey = {};
emails.samples.concat(emails.extras).forEach(function (e) { byKey[e.key] = P.parseEmail(e, data); });
function entry(r, siteId) { return r.entries.filter(function (e) { return e.siteId === siteId; })[0]; }
var passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ✓ " + name); }

console.log("parser");

test("Pyramid prose → Silvermist Pittsburgh, Silvermist Pocono (MH, women) and Providence House", function () {
  var r = byKey["pyramid-silvermist"];
  assert.deepStrictEqual(entry(r, "silvermist-pgh").counts, { residential: { male: 3 } });
  assert.deepStrictEqual(entry(r, "silvermist-pocono").counts, { residential: { female: 4 } });
  assert.deepStrictEqual(entry(r, "providence-house").counts, { php: { any: 1 } });
});


test("Acadia table → 11 sites, male/female inferred, NA kept", function () {
  var r = byKey["acadia-pac"];
  assert.strictEqual(r.confidence, "high");
  assert.strictEqual(r.entries.length, 11);
  assert.deepStrictEqual(entry(r, "bowling-green").counts, { detox: { male: 6, female: 3 }, residential: { male: 0, female: 4 }, php: { male: 0, female: 2 } });
  assert.deepStrictEqual(entry(r, "york").counts.detox, { male: "na", female: 0 });
  assert.deepStrictEqual(entry(r, "york-php").counts.php, { male: 0, female: "na" });
  assert.deepStrictEqual(entry(r, "hcrc-adol").counts.residential, { male: 6, female: 1 });
  assert.deepStrictEqual(entry(r, "pmrc").counts.php, { male: 8, female: 0 });
  assert.ok(entry(r, "hcrc").flags.indexOf("sexSplitInferred") > -1);
});

test("Acadia totals match the hand-built table", function () {
  var t = { detox: { male: 0, female: 0 }, residential: { male: 0, female: 0 }, php: { male: 0, female: 0 } };
  byKey["acadia-pac"].entries.forEach(function (e) {
    if (e.siteId === "hcrc-adol") return;
    Object.keys(t).forEach(function (type) { ["male", "female"].forEach(function (s) { var v = e.counts[type][s]; if (typeof v === "number") t[type][s] += v; }); });
  });
  assert.deepStrictEqual(t, { detox: { male: 23, female: 19 }, residential: { male: 20, female: 21 }, php: { male: 8, female: 2 } });
});

test("UPMC Mercy one-liner → 9 detox, sex not given", function () {
  var r = byKey["upmc-mercy"];
  assert.strictEqual(r.confidence, "high");
  assert.deepStrictEqual(entry(r, "upmc-mercy").counts, { detox: { any: 9 } });
  assert.ok(entry(r, "upmc-mercy").notes[0].indexOf("1 scheduled discharge") === 0);
});

test("UPMC McKeesport reply → shared 9, ignores quoted Mercy text", function () {
  var r = byKey["upmc-mckeesport"];
  assert.strictEqual(r.entries.length, 1);
  assert.strictEqual(r.entries[0].siteId, "upmc-mckeesport");
  assert.strictEqual(r.entries[0].shared.open, 9);
});

test("Valley Forge newsletter → shared 7", function () {
  assert.strictEqual(entry(byKey.vfmc, "vfmc").shared.open, 7);
});

test("Pyramid prose → three sites", function () {
  var r = byKey["pyramid-silvermist"];
  assert.strictEqual(r.confidence, "high");
  assert.deepStrictEqual(entry(r, "silvermist-pgh").counts, { residential: { male: 3 } });
  assert.deepStrictEqual(entry(r, "silvermist-pocono").counts, { residential: { female: 4 } });
  assert.deepStrictEqual(entry(r, "providence-house").counts, { php: { any: 1 } });
});

test("Gaiser newsletter → 4 M / 3 F residential, outpatient accepting", function () {
  var e = entry(byKey.gaiser, "gaiser");
  assert.deepStrictEqual(e.counts, { residential: { male: 4, female: 3 } });
  assert.strictEqual(e.qualitative[0].types[0], "outpatient");
});

test("SpiritLife → available, no count, medium confidence", function () {
  var r = byKey.spiritlife;
  assert.strictEqual(r.confidence, "medium");
  assert.strictEqual(entry(r, "spiritlife").qualitative[0].types[0], "unknown");
});

test("Standard format → high confidence", function () {
  var r = byKey["standard-format"];
  assert.strictEqual(r.confidence, "high");
  assert.deepStrictEqual(entry(r, "gaiser").counts, { residential: { male: 2, female: 5 } });
});

test("Unknown sender → low confidence, counts unplaced", function () {
  var r = byKey["unknown-sender"];
  assert.strictEqual(r.confidence, "low");
  assert.strictEqual(r.entries[0].siteId, null);
  assert.deepStrictEqual(r.entries[0].counts, { detox: { male: 3 }, residential: { male: 2 } });
});

console.log(passed + " passed");
