/*
 * Open Beds — email parser.
 *
 * Turns a provider's bed email into per-site counts. The same code runs in the
 * browser (admin "simulate an email") and server-side behind the email alias
 * (see docs/architecture.md).
 *
 *   parseEmail({ from, subject, body }, OPEN_BEDS_SITES) ->
 *     { orgId, template, confidence: "high"|"medium"|"low", entries, warnings, summary }
 *
 * confidence  high   recognized sender + recognized layout, every count placed
 *             medium recognized sender, but imprecise (e.g. "beds available", no number)
 *             low    unknown sender, or a count we couldn't place  -> admin review
 *
 * entry: { siteId, counts: { detox: { male: 3, female: "na" } }, shared, qualitative, notes, flags }
 */
(function (root) {
  "use strict";

  var TYPE_WORDS = { detox: "detox", withdrawal: "detox", wm: "detox", rehab: "residential", residential: "residential", res: "residential", inpatient: "residential", php: "php", iop: "outpatient", outpatient: "outpatient", op: "outpatient" };
  var SEX_WORDS = { male: "male", men: "male", man: "male", female: "female", women: "female", woman: "female", any: "any", total: "any", all: "any" };

  function lower(s) { return String(s || "").toLowerCase(); }

  // Drop quoted replies and forwarded history: everything from the first header-like line after real content.
  function stripQuoted(body) {
    var lines = String(body || "").replace(/\r/g, "").split("\n");
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (out.join("").trim() && /^\s*(from:|-{2,}\s*original message|on .+ wrote:|>)/i.test(l)) break;
      out.push(l);
    }
    return out.join("\n");
  }

  function domainOf(from) {
    var m = String(from || "").match(/@([a-z0-9.-]+)/i);
    return m ? m[1].toLowerCase() : "";
  }

  function orgFor(from, data) {
    var d = domainOf(from);
    if (!d) return null;
    for (var i = 0; i < data.orgs.length; i++) {
      var o = data.orgs[i];
      for (var j = 0; j < o.senderDomains.length; j++) {
        var sd = o.senderDomains[j];
        if (d === sd || d.slice(-(sd.length + 1)) === "." + sd) return o;
      }
    }
    return null;
  }

  function sitesOf(orgId, data) {
    return data.sites.filter(function (s) { return !orgId || s.org === orgId; });
  }

  // Longest alias first, so "york php" wins over "york" and "hcrc adol" over "hcrc".
  function aliasList(sites) {
    var list = [];
    sites.forEach(function (s) {
      (s.aliases || []).concat([s.name]).forEach(function (a) { list.push({ alias: lower(a), site: s }); });
    });
    return list.sort(function (a, b) { return b.alias.length - a.alias.length; });
  }

  function findSite(text, sites) {
    var t = lower(text);
    var list = aliasList(sites);
    for (var i = 0; i < list.length; i++) {
      var re = new RegExp("(^|[^a-z])" + list[i].alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z])");
      if (re.test(t)) return list[i].site;
    }
    return null;
  }

  function newEntry(siteId) { return { siteId: siteId, counts: {}, notes: [], flags: [] }; }
  function setCount(e, type, sex, v) { (e.counts[type] = e.counts[type] || {})[sex] = v; }
  function num(tok) { return /^na$/i.test(tok) ? "na" : parseInt(tok, 10); }

  // ---------- templates ----------

  // Recommended standard format:  "Site: X" then "Detox male: 3" / "PHP: NA" / "Outpatient: yes" / "Notes: ..."
  function parseStandard(text, sites) {
    if (!/^\s*site\s*:/im.test(text)) return null;
    var entries = [], warnings = [], cur = null;
    text.split("\n").forEach(function (line) {
      var m;
      if ((m = line.match(/^\s*site\s*:\s*(.+)$/i))) {
        var s = findSite(m[1], sites);
        cur = newEntry(s ? s.id : null);
        if (!s) { cur.unmatched = m[1].trim(); warnings.push("Site not recognized: “" + m[1].trim() + "”"); }
        entries.push(cur);
        return;
      }
      if (!cur) return;
      if ((m = line.match(/^\s*notes?\s*:\s*(.+)$/i))) { cur.notes.push(m[1].trim()); return; }
      if ((m = line.match(/^\s*(?:shared|detox or rehab)\s*:\s*(\d+)/i))) { cur.shared = { open: parseInt(m[1], 10), label: "detox or rehab" }; return; }
      m = line.match(/^\s*([a-z]+)(?:\s+([a-z]+))?\s*[:=]\s*(\d+|na|n\/a|yes|no|full)\b/i);
      if (!m) return;
      var type = TYPE_WORDS[lower(m[1])], sex = SEX_WORDS[lower(m[2] || "any")] || "any", v = lower(m[3]);
      if (!type) return;
      if (type === "outpatient") {
        if (v === "yes") cur.qualitative = (cur.qualitative || []).concat([{ types: ["outpatient"], label: "Accepting outpatient clients" }]);
        else setCount(cur, "outpatient", "any", v === "no" || v === "full" ? 0 : v === "na" || v === "n/a" ? "na" : parseInt(v, 10));
        return;
      }
      setCount(cur, type, sex, v === "na" || v === "n/a" ? "na" : v === "full" ? 0 : parseInt(v, 10));
    });
    return { template: "standard", entries: entries, warnings: warnings };
  }

  // Acadia PAC table: "<site>  d_m d_f  r_m r_f  p_m p_f"
  function parseAcadia(text, sites) {
    var entries = [];
    text.split("\n").forEach(function (line) {
      var tokens = line.match(/\b(\d+|NA)\b/gi);
      if (!tokens || tokens.length !== 6) return;
      var namePart = line.slice(0, line.search(/\b(\d+|NA)\b/i));
      var s = findSite(namePart, sites);
      if (!s) return;
      var e = newEntry(s.id);
      ["detox", "residential", "php"].forEach(function (t, i) {
        setCount(e, t, "male", num(tokens[i * 2]));
        setCount(e, t, "female", num(tokens[i * 2 + 1]));
      });
      e.flags.push("sexSplitInferred");
      entries.push(e);
    });
    return entries.length ? { template: "acadia-table", entries: entries, warnings: ["Unlabeled sub-columns read as male / female"] } : null;
  }

  function parseUpmc(text, subject, sites) {
    var t = lower(text);
    var m;
    if (/mckeesport/.test(t) && (m = t.match(/(\d+)\s*cap\w*\s*(\d+)\s*open/))) {
      var e = newEntry("upmc-mckeesport");
      e.shared = { open: parseInt(m[2], 10), label: "detox or rehab" };
      var c = t.match(/(\d+)\s*rehab\s*(\d+)\s*detox/);
      e.notes.push("Capacity " + m[1] + (c ? " · census " + c[1] + " rehab, " + c[2] + " detox" : ""));
      var d = t.match(/(\d+)\s*discharges?\s*(\d+)\s*admissions?/);
      if (d) e.notes.push(d[1] + " discharges, " + d[2] + " admissions today");
      return { template: "upmc-mckeesport", entries: [e], warnings: ["Open beds not split between detox and rehab"] };
    }
    if ((/mercy/.test(t) || /mercy/i.test(subject)) && (m = t.match(/(\d+)\s*(?:available|open)\s*beds?/))) {
      var e2 = newEntry("upmc-mercy");
      setCount(e2, "detox", "any", parseInt(m[1], 10));
      var sd = t.match(/(\d+)\s*scheduled discharges?/);
      if (sd) e2.notes.push(sd[1] + " scheduled discharge" + (sd[1] === "1" ? "" : "s"));
      return { template: "upmc-mercy", entries: [e2], warnings: [] };
    }
    return null;
  }

  function parseVfmc(text) {
    var m = text.match(/(\d+)\s*\n?\s*beds?\s+open/i);
    if (!m) return null;
    var e = newEntry("vfmc");
    e.shared = { open: parseInt(m[1], 10), label: "detox or rehab" };
    return { template: "vfmc-newsletter", entries: [e], warnings: ["One count for detox or rehab"] };
  }

  function parseGaiser(text) {
    var m = text.match(/male residential beds:\s*female residential beds:\s*(\d+)\s+(\d+)/i);
    var male, female;
    if (m) { male = m[1]; female = m[2]; }
    else {
      var a = text.match(/(?:^|[^e])male residential beds:\s*(\d+)/i), b = text.match(/female residential beds:\s*(\d+)/i);
      if (a) male = a[1];
      if (b) female = b[1];
    }
    if (male === undefined && female === undefined) return null;
    var e = newEntry("gaiser");
    if (male !== undefined) setCount(e, "residential", "male", parseInt(male, 10));
    if (female !== undefined) setCount(e, "residential", "female", parseInt(female, 10));
    if (/accepting clients at our outpatient/i.test(text)) e.qualitative = [{ types: ["outpatient"], label: "Accepting IOP and OP" }];
    return { template: "gaiser-newsletter", entries: [e], warnings: [] };
  }

  // Prose: "3 adult male residential beds available at Silvermist Pittsburgh."
  function parseProse(text, sites) {
    var entries = {}, warnings = [], placed = 0, unplaced = 0;
    var sentences = text.replace(/\n/g, " ").split(/(?<=[.!?])\s+/);
    sentences.forEach(function (sen) {
      var re = /(\d+)\s+((?:[a-z]+\s+){0,4}?)(detox|withdrawal|rehab|residential|php|iop|outpatient)\b/gi, m;
      var sexM = sen.match(/\b(male|female|men|women)\b/i);
      var site = findSite(sen, sites) || (sites.length === 1 ? sites[0] : null);
      while ((m = re.exec(sen))) {
        var sexWord = (m[2].match(/\b(male|female|men|women)\b/i) || sexM || [])[1];
        var sex = sexWord ? SEX_WORDS[lower(sexWord)] : "any";
        var type = TYPE_WORDS[lower(m[3])];
        var key = site ? site.id : "__unplaced";
        var e = entries[key] = entries[key] || newEntry(site ? site.id : null);
        setCount(e, type, sex, parseInt(m[1], 10));
        if (site) placed++; else unplaced++;
      }
    });
    if (!placed && !unplaced) return null;
    if (unplaced) warnings.push("Couldn’t tell which site some counts belong to");
    return { template: "prose", entries: Object.keys(entries).map(function (k) { return entries[k]; }), warnings: warnings };
  }

  // "We have beds available" with no number.
  function parseNoCount(text, sites) {
    if (!/\bbeds?\b[^.]{0,40}\bavailable\b|\bavailable\b[^.]{0,20}\bbeds?\b/i.test(text)) return null;
    if (sites.length !== 1) return null;
    var e = newEntry(sites[0].id);
    e.qualitative = [{ types: ["unknown"], label: "“Beds available” — type and count not given" }];
    if (/transportation/i.test(text)) e.notes.push("Transportation offered");
    return { template: "no-count", entries: [e], warnings: ["No count given"], medium: true };
  }

  // ---------- main ----------
  function parseEmail(email, data) {
    var text = stripQuoted(email.body);
    var org = orgFor(email.from, data);
    var sites = sitesOf(org && org.id, data);
    var result = null;

    result = parseStandard(text, sites);
    if (!result && org) {
      if (org.id === "acadia") result = parseAcadia(text, sites);
      else if (org.id === "upmc") result = parseUpmc(text, email.subject || "", sites);
      else if (org.id === "vfmc") result = parseVfmc(text);
      else if (org.id === "gaiser") result = parseGaiser(text);
    }
    if (!result) result = parseProse(text, sites);
    if (!result && org) result = parseNoCount(text, sites);
    if (!result) result = { template: "none", entries: [], warnings: ["No bed counts found"] };

    var warnings = result.warnings.slice();
    var hasUnplaced = result.entries.some(function (e) { return !e.siteId; });
    var confidence;
    if (!org) { confidence = "low"; warnings.unshift("Sender " + (domainOf(email.from) || "unknown") + " isn’t a known provider"); }
    else if (!result.entries.length || hasUnplaced) confidence = "low";
    else if (result.medium) confidence = "medium";
    else confidence = "high";

    var siteNames = result.entries.filter(function (e) { return e.siteId; }).map(function (e) {
      var s = data.sites.filter(function (x) { return x.id === e.siteId; })[0];
      return s ? s.name : e.siteId;
    });
    return {
      orgId: org ? org.id : null,
      template: result.template,
      confidence: confidence,
      entries: result.entries,
      warnings: warnings,
      summary: siteNames.length ? siteNames.length + (siteNames.length === 1 ? " site: " : " sites: ") + siteNames.join(", ") : "No sites matched"
    };
  }

  var api = { parseEmail: parseEmail, stripQuoted: stripQuoted, orgFor: orgFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OpenBedsParser = api;
})(typeof window !== "undefined" ? window : this);
