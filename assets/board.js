/* Open Beds — public board. Reads the store; re-renders when any source updates it. */
(function () {
  "use strict";

  var S = window.OpenBedsStore, OB = window.OB, esc = OB.esc;
  var REGIONS = S.sites.regions;
  var BED_TYPES = ["detox", "residential", "php", "outpatient"];
  var TYPE_OPTS = [["any", "Any type"], ["detox", "Detox"], ["residential", "Residential"], ["php", "PHP"], ["outpatient", "Outpatient"]];
  var SEX_OPTS = [["any", "Any"], ["male", "Male"], ["female", "Female"]];
  var AGE_OPTS = [["adult", "Adults"], ["adolescent", "Adolescents"], ["all", "All"]];
  var TYPE_LABEL = OB.TYPE_LABEL;
  var SEX_SHORT = { male: "M", female: "F", any: "" };

  var state = { type: "any", sex: "any", age: "adult", loca: "any", pay: "any", locs: [], sudOnly: false, recentOnly: false, view: "find", mode: "list", sort: "region", origin: null, selected: null };
  var PAY = {};
  S.sites.payTypes.forEach(function (p) { PAY[p[0]] = { label: p[1], short: p[2] }; });
  // true = known to take it, false = known not to, undefined = not on file
  function payStatus(site) { return state.pay === "any" ? undefined : (site.fit.pay || {})[state.pay]; }
  var LEVEL = {};
  S.sites.levels.forEach(function (l) { LEVEL[l[0]] = { short: l[1], long: l[2] }; });
  var KNOWN = [["pregnancy", "pregnancy"], ["moud", "MOUD"], ["medical", "medical limits"], ["legal", "legal history"]];
  var SOURCE_LABEL = { worksheet: "Bed Search Worksheet", email: "provider email", website: "provider website", admin: "DHS entry" };
  function $(id) { return document.getElementById(id); }
  function plural(n, a, b) { return OB.plural(n, a, b); }

  // ---------- availability ----------
  // state: open | full | avail (no count) | na (marked NA) | nr (not in report)
  function avail(site, type, sex) {
    var c = site.counts && site.counts[type];
    if (c) {
      if (sex === "any") {
        var keys = Object.keys(c).filter(function (k) { return typeof c[k] === "number"; });
        if (!keys.length) return { state: "na" };
        var n = keys.reduce(function (t, k) { return t + c[k]; }, 0);
        var parts = keys.filter(function (k) { return k !== "any"; }).map(function (k) { return { sex: k, n: c[k] }; });
        return { state: n > 0 ? "open" : "full", n: n, parts: parts };
      }
      var v = c[sex], note = null;
      if (v === undefined && c.any !== undefined) { v = c.any; note = "Sex not stated in report"; }
      if (v === undefined) return { state: "nr" };
      if (v === "na") return { state: "na" };
      return { state: v > 0 ? "open" : "full", n: v, note: note };
    }
    if (site.shared && site.shared.types.indexOf(type) > -1) {
      return { state: site.shared.open > 0 ? "open" : "full", n: site.shared.open, shared: true,
        note: "One count for " + site.shared.label + (sex !== "any" ? " · sex not stated" : "") };
    }
    var q = (site.qualitative || []).filter(function (x) { return x.types.indexOf(type) > -1 || x.types.indexOf("unknown") > -1; })[0];
    if (q) return { state: "avail", label: q.label, note: sex !== "any" ? "Sex not stated" : null };
    return { state: "nr" };
  }

  function isNoCount(site) { return (site.qualitative || []).some(function (q) { return q.types.indexOf("unknown") > -1; }); }

  function availAny(site, sex) {
    var per = [], n = 0, unstated = 0, hasAvail = false, hasFull = false, hasNa = false, notes = [];
    BED_TYPES.forEach(function (t) {
      if (site.shared && site.shared.types.indexOf(t) > -1) return;
      var a = avail(site, t, sex);
      if (a.state === "open") { n += a.n; if (a.note) unstated += a.n; per.push({ type: t, n: a.n, parts: a.parts }); if (a.note && notes.indexOf(a.note) < 0) notes.push(a.note); }
      else if (a.state === "avail") { hasAvail = true; if (!isNoCount(site)) per.push({ type: t, label: "accepting" }); }
      else if (a.state === "full") hasFull = true;
      else if (a.state === "na") hasNa = true;
    });
    if (site.shared) {
      n += site.shared.open;
      if (sex !== "any") unstated += site.shared.open;
      per.push({ type: "shared", n: site.shared.open, label: site.shared.label });
      if (sex !== "any") notes.push("Sex not stated");
    }
    var label = null;
    (site.qualitative || []).forEach(function (q) { if (q.types.indexOf("unknown") > -1) label = q.label; });
    return { state: n > 0 ? "open" : hasAvail ? "avail" : hasFull ? "full" : hasNa ? "na" : "nr", n: n, unstated: unstated, per: per, notes: notes, label: label };
  }

  function unstatedOf(a) {
    if (state.sex === "any" || a.state !== "open") return 0;
    if (a.unstated !== undefined) return a.unstated;
    return a.note ? a.n : 0;
  }
  function availFor(site) {
    if (site.noReport) return { state: "none" };
    return state.type === "any" ? availAny(site, state.sex) : avail(site, state.type, state.sex);
  }

  function passesFilters(site) {
    if (state.age !== "all" && site.population !== state.age) return false;
    if (state.sudOnly && site.services.indexOf("SUD") < 0) return false;
    if (state.recentOnly && (site.noReport || OB.when(site.report.receivedAt).hours >= 24)) return false;
    if (state.loca !== "any" && !((site.fit.levels || []).indexOf(state.loca) > -1)) return false;
    if (state.pay !== "any" && payStatus(site) === false) return false;
    if (state.locs.length && state.locs.indexOf(site.id) < 0) return false;
    return true;
  }
  function regionOrder(site) { return REGIONS[site.region].order; }
  function regionLabel(site) { return REGIONS[site.region].label; }

  // ---------- controls ----------
  function buildSeg(containerId, name, opts, key) {
    var el = $(containerId);
    el.innerHTML = opts.map(function (o) {
      var id = name + "-" + o[0];
      return '<input type="radio" name="' + name + '" id="' + id + '" value="' + o[0] + '"' + (state[key] === o[0] ? " checked" : "") + '>' +
        '<label for="' + id + '">' + esc(o[1]) + "</label>";
    }).join("");
    el.addEventListener("change", function (e) { state[key] = e.target.value; render(); });
  }
  function syncSeg(name, key) {
    var el = document.querySelector('input[name="' + name + '"][value="' + state[key] + '"]');
    if (el) el.checked = true;
  }

  // ---------- tiles ----------
  function renderTiles(sites) {
    function sum(type) {
      var n = 0, s = 0, u = 0;
      sites.forEach(function (site) {
        if (site.noReport) return;
        var a = avail(site, type, state.sex);
        if (a.state !== "open" || a.shared) return;
        if (a.note) u += a.n; else { n += a.n; s++; }
      });
      return { n: n, s: s, u: u };
    }
    var dx = sum("detox"), rs = sum("residential"), ph = sum("php");
    var sharedN = 0, sharedS = 0, op = 0, noCount = 0;
    sites.forEach(function (site) {
      if (site.noReport) return;
      if (site.shared) { sharedN += site.shared.open; sharedS++; }
      var o = avail(site, "outpatient", state.sex);
      if ((o.state === "open" || o.state === "avail") && !isNoCount(site)) op++;
      if (isNoCount(site)) noCount++;
    });
    var sexWord = state.sex === "any" ? "" : (state.sex === "male" ? " · men" : " · women");
    function sub(x) { return plural(x.s, "site") + " with a count" + (x.u ? " · +" + x.u + " sex not stated" : ""); }
    function tile(type, n, l, s) {
      return '<button type="button" class="tile" data-type="' + type + '" aria-pressed="' + (state.type === type) + '">' +
        '<span class="n">' + n + '</span><span class="l">' + l + '</span><span class="s">' + s + "</span></button>";
    }
    $("tiles").innerHTML =
      tile("detox", dx.n, "Detox beds open" + sexWord, sub(dx)) +
      tile("residential", rs.n, "Residential beds open" + sexWord, sub(rs)) +
      tile("php", ph.n, "PHP slots open" + sexWord, sub(ph)) +
      '<div class="tile note"><span class="n">' + sharedN + '</span><span class="l">Detox or rehab, not split</span><span class="s">' + plural(sharedS, "site") + " · one shared count" + (state.sex !== "any" ? ", sex not stated" : "") + "</span></div>" +
      tile("outpatient", op, "Outpatient accepting", "Sites saying yes") +
      '<div class="tile note"><span class="n">' + noCount + '</span><span class="l">“Beds available”, no count</span><span class="s">Call for type and number</span></div>';
    Array.prototype.forEach.call(document.querySelectorAll("#tiles button.tile"), function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-type");
        state.type = state.type === t ? "any" : t;
        state.view = "find";
        syncSeg("f-type", "type");
        render();
      });
    });
  }

  // ---------- find a bed ----------
  function countLabel(a) {
    var sex = state.sex === "any" || unstatedOf(a) === a.n ? "" : (state.sex === "male" ? " · male" : " · female");
    if (state.type === "any") return "open beds" + sex;
    if (a.shared) return "detox or rehab";
    return TYPE_LABEL[state.type].toLowerCase() + sex;
  }

  // ---------- bed breakdown ----------
  // Every bed type the site offers, with men / women / total. The filtered type and sex are highlighted.
  function refsFor(site, type, sex) { return (site.referrals || []).filter(function (r) { return r.type === type && r.sex === sex; }).length; }
  function refMark(n) {
    return n ? '<span class="refmark" title="' + n + " referral" + (n > 1 ? "s" : "") + ' marked since the provider’s count">−' + n + '<span class="sr"> after referrals</span></span>' : "";
  }
  function numCell(site, type, sex, v, hc) {
    var cls = hc ? " hc" : "";
    if (v === undefined) return '<td class="nr' + cls + '"><span aria-hidden="true">—</span><span class="sr">not given</span></td>';
    if (v === "na") return '<td class="na' + cls + '">N/A</td>';
    return '<td class="' + (v > 0 ? "open" : "zero") + cls + '">' + v + refMark(refsFor(site, type, sex)) + "</td>";
  }
  function bedTable(site) {
    if (site.noReport) return '<p class="bed-none">No report yet — call to check.</p>';
    if (isNoCount(site)) {
      var q = (site.qualitative || []).filter(function (x) { return x.types.indexOf("unknown") > -1; })[0];
      return '<p class="bed-none"><b>' + esc(q ? q.label : "Beds available") + "</b> — no bed type or count given. Call to ask.</p>";
    }
    var counts = site.counts || {};
    var layout = (site.beds || []).map(function (b) { return b.type; });
    Object.keys(counts).forEach(function (t) { if (layout.indexOf(t) < 0 && !(site.shared && site.shared.types.indexOf(t) > -1)) layout.push(t); });
    var order = ["detox", "shared", "residential", "php", "outpatient"];
    layout.sort(function (x, y) { return order.indexOf(x) - order.indexOf(y); });
    var hm = state.sex === "male", hf = state.sex === "female";
    var sumM = 0, sumF = 0, sumT = 0, numericRows = 0;
    var rows = layout.map(function (t) {
      var hit = state.type !== "any" && (state.type === t || (t === "shared" && site.shared && site.shared.types.indexOf(state.type) > -1));
      var tr = "<tr" + (hit ? ' class="hit"' : "") + ">";
      if (t === "shared") {
        var n = site.shared ? site.shared.open : undefined;
        if (typeof n === "number") { sumT += n; numericRows++; }
        return tr + '<th scope="row">Detox or rehab<span class="sub">one count for both</span></th><td colspan="2" class="ns">Sex not given</td>' +
          (typeof n === "number" ? '<td class="tot ' + (n > 0 ? "open" : "zero") + '">' + n + refMark(refsFor(site, "shared", "any")) + "</td>" : '<td class="nr tot">—</td>') + "</tr>";
      }
      if (t === "outpatient") {
        var yes = (site.qualitative || []).some(function (x) { return x.types.indexOf("outpatient") > -1; });
        var no = counts.outpatient && counts.outpatient.any === 0;
        return tr + '<th scope="row">Outpatient</th><td colspan="3" class="' + (yes ? "yes" : no ? "zero" : "nr") + '">' + (yes ? "Accepting new clients" : no ? "Not accepting" : "Not in this report") + "</td></tr>";
      }
      var c = counts[t];
      if (!c) {
        var qa = (site.qualitative || []).filter(function (x) { return x.types.indexOf(t) > -1; })[0];
        return tr + '<th scope="row">' + TYPE_LABEL[t] + '</th><td colspan="3" class="' + (qa ? "yes" : "nr") + '">' + (qa ? esc(qa.label) + " — no count given" : "Not in this report") + "</td></tr>";
      }
      var hasSex = c.male !== undefined || c.female !== undefined;
      var tot = ["male", "female", "any"].reduce(function (x, k) { return typeof c[k] === "number" ? x + c[k] : x; }, 0);
      var allNa = ["male", "female", "any"].every(function (k) { return c[k] === undefined || c[k] === "na"; });
      numericRows++;
      if (typeof c.male === "number") sumM += c.male;
      if (typeof c.female === "number") sumF += c.female;
      sumT += tot;
      var cells = hasSex
        ? numCell(site, t, "male", c.male, hm) + numCell(site, t, "female", c.female, hf)
        : '<td colspan="2" class="ns">Sex not given</td>';
      var totCell = allNa ? '<td class="na tot">N/A</td>' : '<td class="tot ' + (tot > 0 ? "open" : "zero") + '">' + tot +
        (!hasSex ? refMark(refsFor(site, t, "any")) : "") +
        (hasSex && typeof c.any === "number" ? '<span class="sub">incl. ' + c.any + " sex not given</span>" : "") + "</td>";
      return tr + '<th scope="row">' + TYPE_LABEL[t] + "</th>" + cells + totCell + "</tr>";
    }).join("");
    var foot = numericRows > 1
      ? '<tfoot><tr><th scope="row">All open</th><td' + (hm ? ' class="hc"' : "") + ">" + sumM + "</td><td" + (hf ? ' class="hc"' : "") + ">" + sumF + '</td><td class="tot">' + sumT + "</td></tr></tfoot>"
      : "";
    return '<table class="beds"><caption class="sr">Open beds at ' + esc(site.name) + " by type</caption>" +
      '<thead><tr><th scope="col">Bed type</th><th scope="col"' + (hm ? ' class="hc"' : "") + '>Men</th><th scope="col"' + (hf ? ' class="hc"' : "") + '>Women</th><th scope="col">Total</th></tr></thead>' +
      "<tbody>" + rows + "</tbody>" + foot + "</table>";
  }
  // Plain-text notes under the table (no tags).
  function bedNotes(site) {
    var out = [];
    if (state.pay !== "any") out.push(payStatus(site) === true ? "On file as taking " + PAY[state.pay].short + "." : PAY[state.pay].short + " isn’t on file — ask when you call.");
    (site.notes || []).forEach(function (n) { out.push("Provider note: " + n); });
    return out.length ? '<ul class="bed-notes">' + out.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "";
  }
  function siteMeta(site) {
    var m = [];
    if (site.services.indexOf("SUD") < 0) m.push("Mental health only — no substance use treatment");
    if (site.population === "adolescent") m.push("Adolescent unit");
    return m.length ? '<p class="meta">' + esc(m.join(" · ")) + "</p>" : "";
  }
  function dayWord(label) { return label.replace(/^Today /, "today ").replace(/^Yesterday /, "yesterday "); }
  // When the count came in, from where, a link to the source, and any referrals since.
  function updatedBlock(site) {
    if (site.noReport) return '<p class="upd"><span class="upd-time stale">No report yet</span></p>';
    var f = OB.when(site.report.receivedAt);
    var html = '<p class="upd"><span class="upd-time ' + f.level + '">Updated ' + esc(dayWord(f.label)) + (f.level !== "fresh" ? " (" + esc(f.age) + ")" : "") + "</span>" +
      '<span class="upd-src">' + esc(OB.sourceText(site.report, S)) + "</span>" +
      '<button type="button" class="linkbtn" data-report="' + esc(site.report.id) + '" data-site="' + esc(site.id) + '" aria-haspopup="dialog">View source<span class="sr"> for ' + esc(site.name) + "</span></button></p>";
    var refs = site.referrals || [];
    if (refs.length) {
      html += '<p class="upd-ref">' + plural(refs.length, "referral") + " marked since — last " + esc(dayWord(OB.when(refs[0].receivedAt).label)) +
        ' <button type="button" class="linkbtn" data-undo="' + esc(refs[0].id) + '">Undo<span class="sr"> the last referral to ' + esc(site.name) + "</span></button></p>";
    }
    return html;
  }
  function referOptions(site) {
    var out = [], order = ["detox", "shared", "residential", "php"];
    Object.keys(site.counts || {}).forEach(function (t) {
      if (t === "outpatient") return;
      ["male", "female", "any"].forEach(function (sx) { var v = site.counts[t][sx]; if (typeof v === "number" && v > 0) out.push({ type: t, sex: sx, n: v }); });
    });
    if (site.shared && site.shared.open > 0) out.push({ type: "shared", sex: "any", n: site.shared.open });
    return out.sort(function (a, b) { return order.indexOf(a.type) - order.indexOf(b.type); });
  }
  function referButton(site) {
    if (site.noReport || !referOptions(site).length) return "";
    return '<button type="button" class="btn small refer-btn" data-refer="' + esc(site.id) + '" aria-haspopup="dialog">Mark a referral<span class="sr"> to ' + esc(site.name) + "</span></button>";
  }

  // "Who they take": levels of care (to match the LOCA), population, exclusions, prerequisites, payment.
  function levelChips(f) {
    if (!f.levels || !f.levels.length) return '<span class="fit-none">Not on file</span>';
    return f.levels.map(function (c) {
      var t = esc(LEVEL[c].short);
      return state.loca === c ? '<strong class="lvl-hit" title="' + esc(LEVEL[c].long) + '">' + t + "</strong>" : '<span title="' + esc(LEVEL[c].long) + '">' + t + "</span>";
    }).join(" · ");
  }
  function fitSection(site) {
    var f = site.fit || {};
    var rows = [["LOCA levels", levelChips(f) + (f.levelsNote ? '<span class="fit-note">' + esc(f.levelsNote) + "</span>" : "")]];
    if (f.serves) rows.push(["Serves", esc(f.serves)]);
    (f.excludes || []).forEach(function (x) { rows.push(["Won’t take", '<span class="fit-x">' + esc(x) + "</span>"]); });
    (f.requires || []).forEach(function (x) { rows.push(["Requires", esc(x)]); });
    if (f.takes && f.takes.length) rows.push(["Takes", esc(f.takes.join(" · "))]);
    KNOWN.forEach(function (k) { var t = (f.policies || {})[k[0]]; if (t) rows.push([k[1].charAt(0).toUpperCase() + k[1].slice(1), esc(t)]); });
    if (f.payer) rows.push(["Payment", esc(f.payer)]);
    (f.notes || []).forEach(function (x) { rows.push(["Admissions", esc(x)]); });
    var missing = KNOWN.filter(function (k) { return (f.known || []).indexOf(k[0]) < 0; }).map(function (k) { return k[1]; });
    if (missing.length) rows.push(["Not on file", '<span class="fit-none">' + esc(missing.join(" · ")) + " — ask when you call</span>"]);
    return '<div class="fit"><p class="fit-h">Who they take</p><dl>' + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl>" +
      "</div>";
  }

  var PHONE_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>';

  // ---------- contact ----------
  var MAIL_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m3.5 6.5 8.5 7 8.5-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  var WEB_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  function tel(n) { return "tel:" + n.replace(/[^0-9]/g, ""); }
  // Published intake address, else whoever sent the latest bed email (redacted in the demo).
  function intakeEmail(site) {
    if (site.reach && site.reach.email) return { to: site.reach.email, how: "Intake address from " + site.reach.emailFrom };
    var from = site.report && site.report.from;
    if (from && !/^redacted@/i.test(from)) return { to: from, how: "Replies to the address that sent today’s bed email" };
    return null;
  }
  function mailto(site) {
    var em = intakeEmail(site);
    if (!em) return null;
    var a = availFor(site);
    var want = (state.type === "any" ? "a bed" : "a " + TYPE_LABEL[state.type].toLowerCase() + " bed") + (state.sex === "male" ? " for a man" : state.sex === "female" ? " for a woman" : "");
    var saw = site.report ? (a.state === "open" ? a.n + " open" : a.state === "avail" ? "availability" : "no open beds") + " in your update from " + OB.when(site.report.receivedAt).label.replace(/^Today /, "today at ") : "";
    var body = "Hello " + site.name + " admissions,\n\nPathways is looking for " + want + ". " + (saw ? "The bed board shows " + saw + ". " : "") +
      "Is a bed still available, and what do you need from us to send a referral?\n\nThank you,\n";
    return "mailto:" + em.to + "?subject=" + encodeURIComponent("Bed availability — " + site.name + " (Pathways)") + "&body=" + encodeURIComponent(body);
  }
  function contactStrip(site) {
    var r = site.reach || {}, m = mailto(site), em = intakeEmail(site), bits = [];
    if (r.phone) bits.push('<a class="cbtn primary" href="' + tel(r.phone) + '" aria-label="Call ' + esc(site.name) + " admissions, " + esc(r.phone) + '">' + PHONE_SVG + esc(r.phone) + "</a>");
    var forSite = '<span class="sr"> for ' + esc(site.name) + "</span>";
    if (m) bits.push('<a class="cbtn" href="' + esc(m) + '">' + MAIL_SVG + "Email intake" + forSite + "</a>");
    if (site.geo) {
      var dest = site.geo.precision === "address" ? site.geo.lat + "," + site.geo.lng : (site.fullName || site.name) + ", " + site.town + ", PA";
      bits.push('<a class="cbtn" href="https://www.google.com/maps/dir/?api=1' + (state.origin ? "&amp;origin=" + state.origin.lat + "," + state.origin.lng : "") + "&amp;destination=" + esc(encodeURIComponent(dest)) + '" target="_blank" rel="noopener">Directions' + forSite + '<span class="sr"> (opens in a new tab)</span></a>');
    }
    if (r.web) bits.push('<a class="cbtn" href="' + esc(r.web) + '" target="_blank" rel="noopener">' + WEB_SVG + "Website" + forSite + '<span class="sr"> (opens in a new tab)</span></a>');
    var notes = [];
    if (r.phone && r.phoneFrom) notes.push("Phone: " + r.phoneFrom + ".");
    if (em) notes.push(em.how + ".");
    else notes.push("No intake email on file.");
    if (!r.phone) notes.push("No phone on file.");
    return '<div class="contact"><p class="contact-h">Contact admissions</p><div class="contact-btns">' + bits.join("") + '</div><p class="contact-note">' + esc(notes.join(" ")) + "</p></div>";
  }

  function card(site, a) {
    var box;
    if (a.state === "open") box = '<div class="count open"><b>' + a.n + "</b><span>" + esc(countLabel(a)) + "</span></div>";
    else if (a.state === "avail") box = '<div class="count avail"><b>Yes</b><span>available, no count</span></div>';
    else box = '<div class="count full"><b>0</b><span>' + (state.type === "any" ? "open beds" : esc(countLabel(a))) + "</span></div>";
    return '<article class="card" id="card-' + esc(site.id) + '" aria-labelledby="h-' + esc(site.id) + '">' + box +
      '<div class="site"><h3 id="h-' + esc(site.id) + '">' + esc(site.name) + (site.fullName && site.fullName !== site.name ? ' <span class="full-name">' + esc(site.fullName) + "</span>" : "") + "</h3>" +
      '<div class="where">' + esc(site.org) + " · " + esc(site.town) + " · " + esc(regionLabel(site)) + (state.origin ? " · " + esc(distLabel(site)) : "") + "</div>" +
      siteMeta(site) + "</div>" +
      '<div class="side">' + updatedBlock(site) + referButton(site) + "</div>" +
      '<div class="bedwrap">' + bedTable(site) + bedNotes(site) + "</div>" +
      fitSection(site) +
      contactStrip(site) +
      "</article>";
  }

  function sorter(a, b) {
    var sa = a.site, sb = b.site, na = a.a.n || 0, nb = b.a.n || 0;
    if (state.pay !== "any") { var pa = payStatus(sa) === true, pb = payStatus(sb) === true; if (pa !== pb) return pa ? -1 : 1; }
    if (state.sort === "distance" && state.origin) return (distOf(sa) - distOf(sb)) || (nb - na);
    if (state.sort === "count") return (nb - na) || (regionOrder(sa) - regionOrder(sb));
    if (state.sort === "recent") return (new Date(sb.report.receivedAt) - new Date(sa.report.receivedAt)) || (nb - na);
    return (regionOrder(sa) - regionOrder(sb)) || (nb - na);
  }

  function renderFind(sites) {
    var rows = sites.map(function (s) { return { site: s, a: availFor(s) }; });
    var open = rows.filter(function (r) { return r.a.state === "open"; }).sort(sorter);
    var av = rows.filter(function (r) { return r.a.state === "avail"; }).sort(sorter);
    var full = rows.filter(function (r) { return r.a.state === "full"; }).sort(sorter);
    var none = rows.filter(function (r) { return r.a.state === "none"; });
    var other = rows.length - open.length - av.length - full.length - none.length;
    var beds = open.reduce(function (t, r) { return t + r.a.n; }, 0);
    var unst = open.reduce(function (t, r) { return t + unstatedOf(r.a); }, 0);

    var what = (state.type === "any" ? "beds" : TYPE_LABEL[state.type].toLowerCase() + " beds") +
      (state.sex === "any" ? "" : state.sex === "male" ? " for men" : " for women") +
      (state.age === "adolescent" ? " (adolescents)" : "");
    var who = state.sex === "male" ? "men" : "women";
    $("status").textContent = state.sex === "any"
      ? plural(open.length, "site") + " report " + beds + " open " + what + "; " + av.length + " more " + (av.length === 1 ? "says it has" : "say they have") + " availability without a count."
      : plural(open.length, "site") + " report open " + what + ": " + (beds - unst) + " confirmed for " + who + ", plus " + unst + " where the report doesn’t give sex. " + av.length + " more without a count.";

    var html = "";
    if (open.length) {
      html += '<div class="group-h"><h2>Open — count reported</h2><span>' + plural(open.length, "site") + " · " + plural(beds, "bed") + "</span></div>";
      html += '<div class="cards">' + open.map(function (r) { return card(r.site, r.a); }).join("") + "</div>";
    }
    if (av.length) {
      html += '<div class="group-h"><h2>Available — call for details</h2><span>' + plural(av.length, "site") + "</span></div>";
      html += '<div class="cards">' + av.map(function (r) { return card(r.site, r.a); }).join("") + "</div>";
    }
    if (!open.length && !av.length) {
      html += '<div class="empty">No site reports open ' + esc(what) + " right now. Check “Full today” below, widen the filters, or call providers who didn’t report.</div>";
    }
    if (full.length) {
      html += '<details class="more"><summary>Full today (' + full.length + ")</summary><div class=\"cards\">" + full.map(function (r) { return card(r.site, r.a); }).join("") + "</div></details>";
    }
    var foot = [];
    if (other) foot.push(plural(other, "other site") + " in recent reports " + (other === 1 ? "doesn’t" : "don’t") + " offer this or didn’t mention it.");
    if (none.length) foot.push(plural(none.length, "site") + " " + (none.length === 1 ? "hasn’t" : "haven’t") + " reported yet: " + none.map(function (r) { return esc(r.site.name); }).join(", ") + ".");
    if (state.loca !== "any") {
      var noLv = S.boardSites().filter(function (s) { return !(s.fit.levels && s.fit.levels.length); }).length;
      foot.push("Showing sites that accept LOCA level " + esc(LEVEL[state.loca].short) + ". " + plural(noLv, "site") + " with no levels on file " + (noLv === 1 ? "is" : "are") + " hidden — call them to check.");
    }
    if (state.pay !== "any") {
      var shown = rows.filter(function (r) { return r.a.state !== "none"; });
      var yes = shown.filter(function (r) { return payStatus(r.site) === true; }).length;
      var no = S.boardSites().filter(function (s) { return (s.fit.pay || {})[state.pay] === false; }).length;
      foot.push(plural(yes, "site") + " on file as taking " + esc(PAY[state.pay].short) + " " + (yes === 1 ? "is" : "are") + " listed first. Payment isn’t on file for the rest — ask when you call." +
        (no ? " " + plural(no, "site") + " that " + (no === 1 ? "doesn’t" : "don’t") + " take it " + (no === 1 ? "is" : "are") + " hidden." : ""));
    }
    if (foot.length) html += '<p class="footnote">' + foot.join(" ") + "</p>";
    $("find-list").innerHTML = html;
  }

  // ---------- all sites grid ----------
  function gridCell(a) {
    if (a.state === "open") {
      var small = a.parts && a.parts.length > 1 ? a.parts.map(function (p) { return p.n + " " + SEX_SHORT[p.sex]; }).join(" · ") : a.note ? "sex not stated" : "open";
      return '<span class="cell open"><b>' + a.n + "</b><small>" + esc(small) + "</small></span>";
    }
    if (a.state === "full") return '<span class="cell full"><b>Full</b><small>0 open</small></span>';
    if (a.state === "avail") return '<span class="cell avail"><b>Yes</b><small>no count</small></span>';
    if (a.state === "na") return '<span class="cell na"><b>NA</b><small>per report</small></span>';
    return '<span class="cell nr"><b>—</b><small>not reported</small></span>';
  }

  function renderGrid(sites) {
    var byRegion = {};
    sites.forEach(function (s) { (byRegion[s.region] = byRegion[s.region] || []).push(s); });
    var regions = Object.keys(byRegion).sort(function (a, b) { return REGIONS[a].order - REGIONS[b].order; });
    var cols = BED_TYPES.map(function (t) {
      return '<th scope="col" class="num' + (state.type === t ? " sel" : "") + '">' + TYPE_LABEL[t] + "</th>";
    }).join("");
    var body = regions.map(function (r) {
      var head = '<tr class="region-row"><th scope="rowgroup" colspan="6">' + esc(REGIONS[r].label) + " · " + plural(byRegion[r].length, "site") + "</th></tr>";
      return head + byRegion[r].map(function (site) {
        var cells = "", upd;
        if (site.noReport) {
          cells = '<td class="c" colspan="4"><span class="cell nr wide"><b>No report yet</b><small>call to check</small></span></td>';
          upd = '<span class="upd-time stale">No report</span>';
        } else {
          var f = OB.when(site.report.receivedAt);
          upd = '<span class="upd-time ' + f.level + '">' + esc(f.label) + '</span><span class="upd-src">' + esc(OB.sourceText(site.report, S)) + "</span>" +
            '<button type="button" class="linkbtn" data-report="' + esc(site.report.id) + '" data-site="' + esc(site.id) + '">View source</button>' +
            (site.referrals && site.referrals.length ? '<span class="upd-src">' + plural(site.referrals.length, "referral") + " since</span>" : "") +
            (site.reach.phone ? '<a class="grid-tel" href="' + tel(site.reach.phone) + '">' + esc(site.reach.phone) + "</a>" : "");
          if (isNoCount(site)) {
            cells = '<td class="c" colspan="4"><span class="cell avail wide"><b>Beds available</b><small>type and count not given</small></span></td>';
          } else {
            var i = 0;
            while (i < BED_TYPES.length) {
              var t = BED_TYPES[i];
              if (site.shared && site.shared.types[0] === t) {
                var span = site.shared.types.length;
                cells += '<td class="c" colspan="' + span + '"><span class="cell open wide"><b>' + site.shared.open + "</b><small>" + esc(site.shared.label) + (state.sex !== "any" ? " · sex not stated" : "") + "</small></span></td>";
                i += span;
                continue;
              }
              cells += '<td class="c">' + gridCell(avail(site, t, state.sex)) + "</td>";
              i++;
            }
          }
        }
        var lv = (site.fit.levels || []).map(function (c) { return LEVEL[c].short; }).join(" · ");
        return "<tr><th scope=\"row\" class=\"site-name\"><b>" + esc(site.name) + "</b><span>" + esc(site.org) + " · " + esc(site.town) + "</span><span class=\"grid-lv\">" + (lv ? "Levels " + esc(lv) : "Levels not on file") + (site.fit.excludes ? " · won’t take: " + esc(site.fit.excludes.join("; ")) : "") + "</span></th>" +
          cells + '<td class="upd-cell">' + upd + "</td></tr>";
      }).join("");
    }).join("");

    $("status").textContent = plural(sites.length, "site") + (state.sex === "any" ? "" : state.sex === "male" ? " · counts for men" : " · counts for women") + ".";
    $("view-grid").innerHTML = sites.length
      ? '<div class="gridwrap"><table class="grid"><caption class="sr">Open beds by site and bed type</caption><thead><tr><th scope="col">Site</th>' + cols + '<th scope="col">Last update</th></tr></thead><tbody>' + body + "</tbody></table>" +
        '<div class="legend"><span><span class="cell open"><b>6</b></span> open (M · F split where given)</span><span><span class="cell full"><b>Full</b></span> offered, 0 open</span><span><span class="cell na"><b>NA</b></span> marked NA by provider</span><span><span class="cell nr"><b>—</b></span> not in report</span><span><span class="cell avail"><b>Yes</b></span> available, no count</span></div></div>'
      : '<div class="empty">No sites match these filters.</div>';
  }

  // ---------- updates feed ----------
  function renderUpdates() {
    var reps = S.reports().filter(function (r) { return r.status === "published"; });
    var last24 = reps.filter(function (r) { return OB.when(r.receivedAt).hours < 24; });
    var bySource = { email: 0, form: 0, admin: 0, referral: 0 };
    last24.forEach(function (r) { bySource[r.source]++; });
    var html = '<div class="cov">' +
      '<div class="tile"><span class="n">' + last24.length + '</span><span class="l">Updates in the last 24 h</span><span class="s">' + bySource.email + " email · " + bySource.form + " form · " + bySource.admin + " DHS · " + plural(bySource.referral, "referral") + "</span></div>" +
      '<div class="tile"><span class="n">' + S.boardSites().filter(function (s) { return !s.noReport && OB.when(s.report.receivedAt).hours < 24; }).length + " of " + S.sites.sites.length + '</span><span class="l">Sites current</span><span class="s">Updated in the last 24 h</span></div>' +
      "</div>";
    html += '<div class="cards">' + reps.slice(0, 40).map(function (r) {
      var f = OB.when(r.receivedAt);
      var names = r.source === "referral" ? [S.siteById[r.referral.siteId] ? S.siteById[r.referral.siteId].name : r.referral.siteId]
        : r.entries.filter(function (e) { return e.siteId; }).map(function (e) { return S.siteById[e.siteId] ? S.siteById[e.siteId].name : e.siteId; });
      var org = r.orgId && S.orgById[r.orgId] ? S.orgById[r.orgId].short : "Unknown sender";
      var what = r.source === "referral"
        ? "Referral marked" + (r.by && r.by.indexOf(": ") > -1 ? " by " + r.by.split(": ")[1] : "") + " — one " + (r.referral.type === "shared" ? "detox or rehab" : TYPE_LABEL[r.referral.type].toLowerCase()) + " bed at " + names[0]
        : plural(names.length, "site") + ": " + names.join(", ");
      return '<article class="feed"><div class="feed-top"><b>' + esc(r.source === "referral" ? "Pathways" : org) + '</b><span class="upd-src">' + OB.ICON[r.source] + " " + esc(OB.SOURCE[r.source].label) + '</span><span class="upd-time ' + f.level + '">' + esc(f.label) + "</span>" +
        '<button type="button" class="linkbtn" data-report="' + esc(r.id) + '">View source</button></div>' +
        '<div class="feed-sites">' + esc(what) + "</div>" +
        (r.source === "admin" && r.reason ? '<div class="feed-note">“' + esc(r.reason) + "”</div>" : "") +
        "</article>";
    }).join("") + "</div>";
    $("status").textContent = "Newest first. Every email, form submission and DHS edit that changed the board.";
    $("view-updates").innerHTML = html;
  }


  // ---------- map (Find a bed → Map) ----------
  var map = null, pinLayer = null, originPin = null, pins = {}, needFit = true;
  function haversine(a, b) {
    var R = 3958.8, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function distOf(site) { return state.origin && site.geo ? haversine(state.origin, site.geo) : Infinity; }
  function distLabel(site) {
    if (!site.geo) return "location not on file";
    var d = distOf(site);
    return (site.geo.precision === "address" ? "" : "≈") + (d < 10 ? d.toFixed(1) : Math.round(d)) + " mi";
  }
  function badge(site, a) {
    if (a.state === "open") return { cls: "open", text: String(a.n), say: a.n + " open" };
    if (a.state === "avail") return { cls: "avail", text: "Yes", say: "available, no count" };
    if (a.state === "full") return { cls: "full", text: "Full", say: "full" };
    if (a.state === "none") return { cls: "none", text: "?", say: "no report yet" };
    return { cls: "nr", text: "—", say: "not reported for these filters" };
  }
  var PRECISION = { town: "Pin at the town centre, so distance is approximate.", area: "Rough area only." };

  function detail(site, a) {
    return siteMeta(site) + bedTable(site) + bedNotes(site) +
      (site.geo && PRECISION[site.geo.precision] ? '<p class="fit-note">' + PRECISION[site.geo.precision] + "</p>" : "") +
      '<div class="ml-upd">' + updatedBlock(site) + referButton(site) + "</div>" +
      fitSection(site) + contactStrip(site);
  }

  function renderMap(sites) {
    var rows = sites.map(function (s) { return { site: s, a: availFor(s) }; });
    var rank = { open: 0, avail: 1, full: 2, nr: 3, na: 3, none: 4 };
    rows.sort(function (x, y) { return (rank[x.a.state] - rank[y.a.state]) || sorter(x, y); });
    if (state.origin) rows.sort(function (x, y) { return (distOf(x.site) - distOf(y.site)) || ((y.a.n || 0) - (x.a.n || 0)); });
    var placed = rows.filter(function (r) { return r.site.geo; });
    var open = rows.filter(function (r) { return r.a.state === "open"; });
    var nearestOpen = state.origin ? open.filter(function (r) { return r.site.geo; })[0] : null;
    var what = state.type === "any" ? "beds" : TYPE_LABEL[state.type].toLowerCase() + " beds";
    $("status").textContent = state.origin
      ? "Nearest to " + state.origin.label + ". " + (nearestOpen ? "Closest site with open " + what + ": " + nearestOpen.site.name + ", " + distLabel(nearestOpen.site) + " (straight-line)." : "No site with a reported open count matches these filters.")
      : plural(open.length, "site") + " with open " + what + " · " + plural(placed.length, "site") + " on the map. Select a pin to see its availability.";
    if (state.selected && !rows.some(function (r) { return r.site.id === state.selected; })) state.selected = null;

    $("map-list").innerHTML = rows.map(function (r) {
      var s = r.site, b = badge(s, r.a), on = state.selected === s.id;
      return '<li class="ml' + (on ? " sel" : "") + '" id="ml-' + esc(s.id) + '">' +
        '<button type="button" class="ml-head" data-sel="' + esc(s.id) + '" aria-expanded="' + on + '" aria-controls="mld-' + esc(s.id) + '">' +
        '<span class="ml-n ' + b.cls + '" aria-hidden="true">' + esc(b.text) + "</span>" +
        '<span class="ml-body"><b>' + esc(s.name) + '</b><span class="ml-where">' + esc(s.org) + " · " + esc(s.town) + (state.origin ? " · " + esc(distLabel(s)) : "") + "</span>" +
        '<span class="sr">' + esc(b.say) + "</span></span>" + '<span class="ml-chev" aria-hidden="true"></span></button>' +
        '<div class="ml-detail" id="mld-' + esc(s.id) + '"' + (on ? "" : " hidden") + ">" + (on ? detail(s, r.a) : "") + "</div></li>";
    }).join("") || '<li class="empty">No sites match these filters.</li>';

    if (!ensureMap()) return;
    map.invalidateSize();
    pinLayer.clearLayers();
    pins = {};
    // Spread pins that share a point (the three York sites) in a small ring.
    var groups = {};
    placed.forEach(function (r) { var k = r.site.geo.lat.toFixed(3) + "," + r.site.geo.lng.toFixed(3); (groups[k] = groups[k] || []).push(r); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      g.forEach(function (r, i) {
        var lat = r.site.geo.lat, lng = r.site.geo.lng;
        if (g.length > 1) { var ang = 2 * Math.PI * i / g.length; lat += 0.02 * Math.cos(ang); lng += 0.027 * Math.sin(ang); }
        var b = badge(r.site, r.a), on = state.selected === r.site.id;
        var m = L.marker([lat, lng], {
          icon: L.divIcon({ className: "pin-wrap", html: '<span class="pin ' + b.cls + (on ? " sel" : "") + '">' + esc(b.text) + "</span>", iconSize: [40, 40], iconAnchor: [20, 20] }),
          title: r.site.name + " — " + b.say, alt: r.site.name + " — " + b.say, riseOnHover: true, keyboard: true,
          zIndexOffset: on ? 3000 : r.a.state === "open" ? 1000 : 0
        });
        m.on("click", function () { select(r.site.id, false); });
        m.addTo(pinLayer);
        pins[r.site.id] = m;
      });
    });
    if (originPin) { originPin.remove(); originPin = null; }
    if (state.origin) {
      originPin = L.marker([state.origin.lat, state.origin.lng], {
        icon: L.divIcon({ className: "pin-wrap", html: '<span class="pin origin" aria-hidden="true"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: "Searched location: " + state.origin.label, alt: "Searched location", keyboard: false, interactive: false, zIndexOffset: 2000
      }).addTo(map);
    }
    if (needFit) {
      needFit = false;
      var pts = state.origin
        ? [[state.origin.lat, state.origin.lng]].concat(placed.slice(0, 4).map(function (r) { return [r.site.geo.lat, r.site.geo.lng]; }))
        : placed.map(function (r) { return [r.site.geo.lat, r.site.geo.lng]; });
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 11 });
      else if (pts.length) map.setView(pts[0], 10);
    }
  }

  // Select a provider: expands it in the list and highlights its pin. From a pin, the list scrolls to it;
  // from the list, the map pans to the pin.
  function select(id, fromList) {
    state.selected = fromList && state.selected === id ? null : id;
    render();
    var li = $("ml-" + id);
    if (!li) return;
    if (fromList) {
      if (state.selected && map && pins[id]) map.panTo(pins[id].getLatLng());
      li.querySelector(".ml-head").focus();
    } else {
      var wrap = $("map-list-wrap");
      if (wrap.scrollHeight > wrap.clientHeight + 4) wrap.scrollTop = li.offsetTop - 8;
      else li.scrollIntoView({ block: "nearest", behavior: "smooth" });
      li.querySelector(".ml-head").focus({ preventScroll: true });
    }
  }
  function ensureMap() {
    if (map) return map;
    if (!window.L) { $("map").hidden = true; $("map-off").hidden = false; return null; }
    map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.5 }).setView([40.95, -77.6], 7);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    pinLayer = L.layerGroup().addTo(map);
    map.on("focus", function () { map.scrollWheelZoom.enable(); });
    map.on("blur", function () { map.scrollWheelZoom.disable(); });
    return map;
  }

  // Geocoding: OpenStreetMap Nominatim, biased to Pennsylvania. Production should use the county's geocoder.
  function geocode(q) {
    var zip = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(q);
    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&viewbox=-80.6,42.3,-74.6,39.6&" +
      (zip ? "postalcode=" + zip[1] : "q=" + encodeURIComponent(q));
    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("lookup " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j[0]) return null;
        var parts = String(j[0].display_name || q).split(",").map(function (x) { return x.trim(); });
        return { lat: +j[0].lat, lng: +j[0].lon, label: zip ? "ZIP " + zip[1] + (parts[1] ? " (" + parts[1] + ")" : "") : parts.slice(0, 3).join(", ") };
      });
  }
  function setOrigin(o) {
    state.origin = o;
    needFit = true;
    $("map-clear").hidden = !o;
    var opt = document.querySelector('#f-sort option[value="distance"]');
    opt.disabled = !o;
    if (o && state.sort === "region") { state.sort = "distance"; $("f-sort").value = "distance"; }
    if (!o && state.sort === "distance") { state.sort = "region"; $("f-sort").value = "region"; }
    render();
  }
  function mapMsg(t, bad) { var m = $("map-msg"); m.textContent = t; m.classList.toggle("bad", !!bad); }
  $("map-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("map-q").value.trim();
    if (!q) { mapMsg("Enter a ZIP code or an address.", true); $("map-q").focus(); return; }
    mapMsg("Looking up “" + q + "”…");
    geocode(q).then(function (o) {
      if (!o) { mapMsg("Couldn’t find “" + q + "”. Try a ZIP code or add the town.", true); return; }
      mapMsg("Distances from " + o.label + " are straight-line.");
      setOrigin(o);
    }).catch(function () { mapMsg("The address lookup isn’t reachable from this network. Try “Use my location”.", true); });
  });
  $("map-me").addEventListener("click", function () {
    if (!navigator.geolocation) { mapMsg("This browser can’t share its location.", true); return; }
    mapMsg("Getting your location…");
    navigator.geolocation.getCurrentPosition(function (p) {
      mapMsg("Distances from your location are straight-line.");
      setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, label: "your location" });
    }, function () { mapMsg("Location wasn’t shared. Type a ZIP code instead.", true); }, { timeout: 10000 });
  });
  $("map-clear").addEventListener("click", function () { $("map-q").value = ""; mapMsg("Looked up with OpenStreetMap. Enter a ZIP or address only — never a client’s name."); setOrigin(null); });
  $("map-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sel]");
    if (b) select(b.getAttribute("data-sel"), true);
  });

  // ---------- referrals ----------
  // Marking a referral takes one bed off the site's count for everyone, until the provider reports again.
  var SEXW = { male: "men", female: "women", any: "sex not given" };
  function optLabel(o) {
    return (o.type === "shared" ? "Detox or rehab (one count)" : TYPE_LABEL[o.type] + " — " + SEXW[o.sex]) + " · " + o.n + " open";
  }
  function lastInitials() { try { return localStorage.getItem("openbeds.initials") || ""; } catch (e) { return ""; } }
  function saveInitials(v) { try { localStorage.setItem("openbeds.initials", v); } catch (e) { /* ignore */ } }
  function openRefer(siteId) {
    var site = S.boardSites().filter(function (x) { return x.id === siteId; })[0];
    var opts = site ? referOptions(site) : [];
    if (!opts.length) return;
    // Preselect the bed that matches the current filters, if there is one.
    var pick = 0;
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i];
      var typeOk = state.type === "any" || o.type === state.type || (o.type === "shared" && site.shared.types.indexOf(state.type) > -1);
      var sexOk = state.sex === "any" || o.sex === state.sex;
      if (typeOk && sexOk) { pick = i; break; }
    }
    var html = '<form id="refer-form" novalidate><div class="srcdlg-h"><h2 id="refer-h">Mark a referral to ' + esc(site.name) + "</h2></div>" +
      '<p class="hint">This takes one bed off ' + esc(site.name) + "’s count for everyone using the board, until the provider sends a new count. Don’t enter client names or details.</p>" +
      '<fieldset class="refer-opts"><legend class="lbl">Which bed?</legend>' + opts.map(function (o, j) {
        return '<label class="refer-opt"><input type="radio" name="refer-bed" value="' + j + '"' + (j === pick ? " checked" : "") + "> " + esc(optLabel(o)) + "</label>";
      }).join("") + "</fieldset>" +
      '<div class="field"><label class="lbl" for="refer-by">Your initials <span class="help">(optional)</span></label><input id="refer-by" class="input" maxlength="6" autocomplete="off" value="' + esc(lastInitials()) + '"></div>' +
      '<div class="btnrow"><button type="submit" class="btn primary">Mark referral</button><button type="button" class="btn" data-close>Cancel</button></div></form>';
    var el = OB.openDialog(html, "refer-h");
    el.querySelector("#refer-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var o = opts[+el.querySelector('input[name="refer-bed"]:checked').value];
      var by = el.querySelector("#refer-by").value.trim();
      saveInitials(by);
      var r = S.refer({ siteId: site.id, type: o.type, sex: o.sex, by: by });
      OB.closeDialog();
      var b = document.querySelector('[data-refer="' + site.id + '"]');
      if (b) b.focus();
      toast("Referral marked: " + site.name + ", " + optLabel(o).split(" · ")[0].toLowerCase() + " now " + (o.n - 1) + " open.", r.id);
    });
  }
  var toastTimer = null;
  function toast(msg, undoId) {
    var t = $("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = "<span>" + esc(msg) + "</span>" + (undoId ? '<button type="button" class="linkbtn toast-undo" data-undo="' + esc(undoId) + '">Undo</button>' : "") +
      '<button type="button" class="toast-x" aria-label="Dismiss message">' + '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    t.hidden = false;
    // Focused controls scroll clear of the toast while it shows (WCAG 2.4.11).
    document.documentElement.style.scrollPaddingBottom = "96px";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 12000);
  }
  function hideToast() {
    var t = $("toast");
    if (t) t.hidden = true;
    document.documentElement.style.scrollPaddingBottom = "";
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("toast") && !$("toast").hidden && !document.querySelector(".dialog-wrap:not([hidden])")) hideToast(); });
  document.addEventListener("click", function (e) { if (e.target.closest(".toast-x")) hideToast(); });
  document.addEventListener("click", function (e) {
    var rb = e.target.closest("[data-refer]");
    if (rb) { openRefer(rb.getAttribute("data-refer")); return; }
    var ub = e.target.closest("[data-undo]");
    if (ub) {
      S.undoReferral(ub.getAttribute("data-undo"), { by: "Pathways" + (lastInitials() ? ": " + lastInitials() : "") });
      toast("Referral undone. The bed is back on the board.");
    }
  });

  // ---------- tabs ----------
  var TABS = [["find", "tab-find", "view-find"], ["grid", "tab-grid", "view-grid"], ["updates", "tab-updates", "view-updates"]];
  function setupTabs() {
    TABS.forEach(function (t, i) {
      var b = $(t[1]);
      b.addEventListener("click", function () { state.view = t[0]; render(); });
      b.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        var next = TABS[(i + d + TABS.length) % TABS.length];
        state.view = next[0]; render(); $(next[1]).focus();
      });
    });
  }

  function render() { OB.keepFocus(renderNow); }
  function renderNow() {
    var all = S.boardSites();
    var sites = all.filter(passesFilters);
    var latest = all.filter(function (s) { return !s.noReport; }).map(function (s) { return new Date(s.report.receivedAt); }).sort(function (a, b) { return b - a; })[0];
    $("board-meta").textContent = "Live · " + all.length + " sites · last update " + (latest ? OB.when(latest.toISOString()).label : "none");
    TABS.forEach(function (t) {
      var on = state.view === t[0];
      $(t[1]).setAttribute("aria-selected", on);
      $(t[1]).tabIndex = on ? 0 : -1;
      $(t[2]).hidden = !on;
    });
    renderTiles(sites);
    if (state.view === "find") {
      $("find-list").hidden = state.mode !== "list";
      $("find-map").hidden = state.mode !== "map";
      if (state.mode === "map") renderMap(sites); else renderFind(sites);
    }
    else if (state.view === "grid") renderGrid(sites);
    else renderUpdates();
  }

  buildSeg("f-type", "f-type", TYPE_OPTS, "type");
  buildSeg("f-sex", "f-sex", SEX_OPTS, "sex");
  buildSeg("f-age", "f-age", AGE_OPTS, "age");
  buildSeg("f-mode", "f-mode", [["list", "List"], ["map", "Map"]], "mode");
  $("f-loca").innerHTML += S.sites.levels.map(function (l) { return '<option value="' + l[0] + '">' + esc(l[1] + " — " + l[2]) + "</option>"; }).join("");
  // Picking a LOCA level also picks the matching bed type; staff can change it after.
  var LOCA_TYPE = { wm4: "detox", wm37: "detox", "4": "residential", "37": "residential", "35": "residential", "25": "php", "21": "outpatient", "1": "outpatient" };
  $("f-loca").addEventListener("change", function (e) {
    state.loca = e.target.value;
    state.type = LOCA_TYPE[state.loca] || "any";
    syncSeg("f-type", "type");
    render();
  });
  $("f-pay").innerHTML += S.sites.payTypes.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + "</option>"; }).join("");
  $("f-pay").addEventListener("change", function (e) { state.pay = e.target.value; render(); });
  // ---------- locations multiselect ----------
  // Empty selection = all locations. Grouped by provider; a provider box selects all its sites.
  function locLabel() {
    if (!state.locs.length) return "All locations";
    if (state.locs.length === 1) return S.siteById[state.locs[0]] ? S.siteById[state.locs[0]].name : "1 location";
    return state.locs.length + " locations";
  }
  function buildLocPanel() {
    var groups = S.sites.orgs.map(function (o) {
      return { org: o, sites: S.boardSites().filter(function (x) { return x.orgId === o.id; }) };
    }).filter(function (g) { return g.sites.length; });
    $("f-loc-panel").innerHTML =
      '<label class="check loc-all"><input type="checkbox" id="f-loc-all"' + (state.locs.length ? "" : " checked") + "> All locations</label>" +
      groups.map(function (g) {
        var on = g.sites.filter(function (x) { return state.locs.indexOf(x.id) > -1; }).length;
        var one = g.sites.length === 1;
        return '<fieldset class="loc-group"><legend class="sr">' + esc(g.org.name) + "</legend>" +
          (one ? "" : '<label class="check loc-org"><input type="checkbox" data-org="' + esc(g.org.id) + '"' + (on === g.sites.length ? " checked" : "") + "> " + esc(g.org.name) + " <span class=\"help\">(all " + g.sites.length + ")</span></label>") +
          g.sites.map(function (x) {
            return '<label class="check loc-site' + (one ? " solo" : "") + '"><input type="checkbox" data-loc="' + esc(x.id) + '"' + (state.locs.indexOf(x.id) > -1 ? " checked" : "") + "> " + esc(x.name) +
              ' <span class="help">' + esc(one ? x.org + " · " + x.town : x.town) + "</span></label>";
          }).join("") + "</fieldset>";
      }).join("") +
      '<div class="locpanel-foot"><button type="button" class="btn small" id="f-loc-clear">Clear</button><button type="button" class="btn small primary" id="f-loc-done">Done</button></div>';
    Array.prototype.forEach.call(document.querySelectorAll("#f-loc-panel [data-org]"), function (el) {
      var ids = S.boardSites().filter(function (x) { return x.orgId === el.getAttribute("data-org"); }).map(function (x) { return x.id; });
      var on = ids.filter(function (id) { return state.locs.indexOf(id) > -1; }).length;
      el.indeterminate = on > 0 && on < ids.length;
    });
  }
  function setLocs(ids) {
    var all = S.boardSites().map(function (x) { return x.id; });
    state.locs = ids.length >= all.length ? [] : ids;
    $("f-loc-btn").textContent = locLabel();
    var keep = document.activeElement && document.activeElement.closest("#f-loc-panel") ? (document.activeElement.getAttribute("data-loc") || document.activeElement.getAttribute("data-org") || document.activeElement.id) : null;
    buildLocPanel();
    if (keep) { var back = document.querySelector('#f-loc-panel [data-loc="' + keep + '"], #f-loc-panel [data-org="' + keep + '"], #f-loc-panel #' + keep); if (back) back.focus(); }
    render();
  }
  function openLoc(open) {
    $("f-loc-panel").hidden = !open;
    $("f-loc-btn").setAttribute("aria-expanded", open);
    if (open) { buildLocPanel(); var f = $("f-loc-panel").querySelector("input"); if (f) f.focus(); }
  }
  $("f-loc-btn").addEventListener("click", function () { openLoc($("f-loc-panel").hidden); });
  $("f-loc-panel").addEventListener("change", function (e) {
    var el = e.target, ids = state.locs.slice();
    if (el.id === "f-loc-all") { setLocs([]); return; }
    if (el.hasAttribute("data-org")) {
      var orgIds = S.boardSites().filter(function (x) { return x.orgId === el.getAttribute("data-org"); }).map(function (x) { return x.id; });
      ids = ids.filter(function (id) { return orgIds.indexOf(id) < 0; });
      if (el.checked) ids = ids.concat(orgIds);
    } else if (el.hasAttribute("data-loc")) {
      var id = el.getAttribute("data-loc");
      ids = ids.filter(function (x) { return x !== id; });
      if (el.checked) ids.push(id);
    }
    setLocs(ids);
  });
  $("f-loc-panel").addEventListener("click", function (e) {
    if (e.target.id === "f-loc-done") { openLoc(false); $("f-loc-btn").focus(); }
    if (e.target.id === "f-loc-clear") setLocs([]);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("f-loc-panel").hidden) { openLoc(false); $("f-loc-btn").focus(); } });
  document.addEventListener("click", function (e) { if (!$("f-loc-panel").hidden && !e.target.closest(".locsel")) openLoc(false); });
  $("f-sud").addEventListener("change", function (e) { state.sudOnly = e.target.checked; render(); });
  $("f-fresh").addEventListener("change", function (e) { state.recentOnly = e.target.checked; render(); });
  $("f-sort").addEventListener("change", function (e) { state.sort = e.target.value; render(); });
  setupTabs();
  S.subscribe(render);
  setInterval(render, 60000);
  render();
})();
