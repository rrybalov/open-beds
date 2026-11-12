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

  var state = { type: "any", sex: "any", age: "adult", loca: "any", pay: "any", q: "", mh: false, recentOnly: false, view: "find", sort: "region", origin: null };
  var PAY = {};
  S.sites.payTypes.forEach(function (p) { PAY[p[0]] = { label: p[1], short: p[2] }; });
  // true = known to take it, false = known not to, undefined = not on file
  function payStatus(site) { return state.pay === "any" ? undefined : (site.fit.pay || {})[state.pay]; }
  var LEVEL = {};
  S.sites.levels.forEach(function (l) { LEVEL[l[0]] = { short: l[1], long: l[2] }; });
  var KNOWN = [["pregnancy", "pregnancy"], ["moud", "MOUD"], ["medical", "medical limits"], ["legal", "legal history"]];
  var SOURCE_LABEL = { worksheet: "Bed Search Worksheet", email: "provider email", website: "provider website" };
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
    if (!state.mh && site.services.indexOf("SUD") < 0) return false;
    if (state.recentOnly && (site.noReport || OB.when(site.report.receivedAt).hours >= 24)) return false;
    if (state.loca !== "any" && !((site.fit.levels || []).indexOf(state.loca) > -1)) return false;
    if (state.pay !== "any" && payStatus(site) === false) return false;
    if (state.q) {
      var hay = [site.name, site.fullName, site.org, site.town].join(" ").toLowerCase();
      if (hay.indexOf(state.q) < 0) return false;
    }
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

  function splitPills(site, a) {
    var out = [];
    if (state.type === "any") {
      a.per.forEach(function (p) {
        if (p.type === "shared") out.push('<span class="pill strong">' + p.n + " " + esc(p.label) + "</span>");
        else if (p.label) out.push('<span class="pill strong">' + TYPE_LABEL[p.type] + " — " + esc(p.label) + "</span>");
        else {
          var detail = (p.parts && p.parts.length > 1) ? " (" + p.parts.map(function (x) { return x.n + " " + SEX_SHORT[x.sex]; }).join(" · ") + ")" : "";
          out.push('<span class="pill strong">' + TYPE_LABEL[p.type] + " " + p.n + detail + "</span>");
        }
      });
    } else if (a.parts && a.parts.length) {
      a.parts.forEach(function (p) { out.push('<span class="pill strong">' + p.n + " " + (p.sex === "male" ? "male" : "female") + "</span>"); });
    }
    if (a.label && (a.state === "avail" || state.type === "any")) out.push('<span class="pill">' + esc(a.label) + "</span>");
    if (a.note) out.push('<span class="pill warn">' + esc(a.note) + "</span>");
    (a.notes || []).forEach(function (n) { out.push('<span class="pill warn">' + esc(n) + "</span>"); });
    if (state.type === "any" && site.shared && state.sex === "any") out.push('<span class="pill warn">Not split between detox and rehab</span>');
    if (site.sexSplitInferred && (state.sex !== "any" || (a.parts && a.parts.length > 1) || state.type === "any")) out.push('<span class="pill warn">Male/female read from unlabeled columns</span>');
    if (site.population === "adolescent") out.push('<span class="pill tag">Adolescent unit</span>');
    if (state.pay !== "any") out.push(payStatus(site) === true
      ? '<span class="pill pay-yes">Takes ' + esc(PAY[state.pay].short) + "</span>"
      : '<span class="pill warn">' + esc(PAY[state.pay].short) + " not on file — ask</span>");
    (site.notes || []).forEach(function (n) { out.push('<span class="pill">' + esc(n) + "</span>"); });
    return out.join("");
  }

  // "Who they take": levels of care (to match the LOCA), population, exclusions, prerequisites, payment.
  function levelChips(f) {
    if (!f.levels || !f.levels.length) return '<span class="fit-none">Not on file</span>';
    return f.levels.map(function (c) {
      return '<span class="lvl-chip' + (state.loca === c ? " hit" : "") + '" title="' + esc(LEVEL[c].long) + '">' + esc(LEVEL[c].short) + "</span>";
    }).join("");
  }
  function fitSection(site) {
    var f = site.fit || {};
    var rows = [["LOCA levels", levelChips(f) + (f.levelsNote ? '<span class="fit-note">' + esc(f.levelsNote) + "</span>" : "")]];
    if (f.serves) rows.push(["Serves", esc(f.serves)]);
    (f.excludes || []).forEach(function (x) { rows.push(["Won’t take", '<span class="fit-x">' + esc(x) + "</span>"]); });
    (f.requires || []).forEach(function (x) { rows.push(["Requires", esc(x)]); });
    if (f.takes && f.takes.length) rows.push(["Takes", esc(f.takes.join(" · "))]);
    if (f.payer) rows.push(["Payment", esc(f.payer)]);
    (f.notes || []).forEach(function (x) { rows.push(["Admissions", esc(x)]); });
    var missing = KNOWN.filter(function (k) { return (f.known || []).indexOf(k[0]) < 0; }).map(function (k) { return k[1]; });
    if (missing.length) rows.push(["Not on file", '<span class="fit-none">' + esc(missing.join(" · ")) + " — ask when you call</span>"]);
    var src = (f.source || []).map(function (s) { return SOURCE_LABEL[s]; });
    return '<div class="fit"><p class="fit-h">Who they take</p><dl>' + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl>" +
      (src.length ? '<p class="fit-src">From the ' + esc(src.join(" and ")) + "</p>" : "") + "</div>";
  }

  var PHONE_SVG = '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>';

  function sourceDetail(site) {
    var r = site.report;
    if (r.source === "email") return "Read from " + esc(S.orgById[site.orgId].short) + "’s email.";
    if (r.source === "form") return "Submitted on the provider update form" + (r.by && r.by !== "Provider form" ? " by " + esc(r.by) : "") + ".";
    return "Updated by DHS staff" + (r.reason ? ": “" + esc(r.reason) + "”" : "") + ".";
  }

  function card(site, a) {
    var f = OB.when(site.report.receivedAt);
    var box;
    if (a.state === "open") box = '<div class="count open"><b>' + a.n + "</b><span>" + esc(countLabel(a)) + "</span></div>";
    else if (a.state === "avail") box = '<div class="count avail"><b>Available</b><span>no count given</span></div>';
    else box = '<div class="count full"><b>Full</b><span>' + (state.type === "any" ? "all reported beds" : esc(countLabel(a))) + "</span></div>";
    var call = site.contact
      ? '<a class="call" href="tel:' + site.contact.replace(/[^0-9]/g, "") + '" aria-label="Call ' + esc(site.name) + " admissions, " + esc(site.contact) + '">' + PHONE_SVG + esc(site.contact) + "</a>"
      : '<span class="nocall">Number in provider profile</span>';
    return '<article class="card">' + box +
      '<div class="site"><h3>' + esc(site.name) + (site.fullName && site.fullName !== site.name ? ' <span class="full-name">' + esc(site.fullName) + "</span>" : "") + "</h3>" +
      '<div class="where">' + esc(site.org) + " · " + esc(site.town) + " · " + esc(regionLabel(site)) + (state.origin ? " · " + esc(distLabel(site)) : "") + "</div>" +
      '<div class="split">' + splitPills(site, a) + "</div></div>" +
      '<div class="side"><span class="fr ' + f.level + '" title="' + esc(f.age) + '">' + esc(f.label) + "</span>" + OB.sourceChip(site.report.source, site.report.id, site.id) + call + "</div>" +
      fitSection(site) +
      '<p class="src">' + sourceDetail(site) + " " + OB.sourceLink(site.report.source, site.report.id, site.id) + "</p>" +
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
    $("view-find").innerHTML = html;
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
          upd = '<span class="fr stale">No report</span>';
        } else {
          var f = OB.when(site.report.receivedAt);
          upd = '<span class="fr ' + f.level + '">' + esc(f.label) + "</span> " + OB.sourceChip(site.report.source, site.report.id, site.id);
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
    var bySource = { email: 0, form: 0, admin: 0 };
    last24.forEach(function (r) { bySource[r.source]++; });
    var html = '<div class="cov">' +
      '<div class="tile"><span class="n">' + last24.length + '</span><span class="l">Updates in the last 24 h</span><span class="s">' + bySource.email + " email · " + bySource.form + " form · " + bySource.admin + " DHS</span></div>" +
      '<div class="tile"><span class="n">' + S.boardSites().filter(function (s) { return !s.noReport && OB.when(s.report.receivedAt).hours < 24; }).length + " of " + S.sites.sites.length + '</span><span class="l">Sites current</span><span class="s">Updated in the last 24 h</span></div>' +
      "</div>";
    html += '<div class="cards">' + reps.slice(0, 40).map(function (r) {
      var f = OB.when(r.receivedAt);
      var names = r.entries.filter(function (e) { return e.siteId; }).map(function (e) { return S.siteById[e.siteId] ? S.siteById[e.siteId].name : e.siteId; });
      var org = r.orgId && S.orgById[r.orgId] ? S.orgById[r.orgId].short : "Unknown sender";
      return '<article class="feed"><div class="feed-top"><b>' + esc(org) + "</b>" + OB.sourceChip(r.source, r.id) + '<span class="fr ' + f.level + '">' + esc(f.label) + "</span></div>" +
        '<div class="feed-sites">' + esc(plural(names.length, "site")) + ": " + esc(names.join(", ")) + "</div>" +
        (r.source === "admin" && r.reason ? '<div class="feed-note">“' + esc(r.reason) + "”</div>" : "") +
        "</article>";
    }).join("") + "</div>";
    $("status").textContent = "Newest first. Every email, form submission and DHS edit that changed the board.";
    $("view-updates").innerHTML = html;
  }


  // ---------- map ----------
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
    return { cls: "nr", text: "—", say: "not reported for this filter" };
  }
  var PRECISION = { address: "", town: "Pin at the town centre, so distance is approximate.", area: "Rough area only — address not on file." };
  function directions(site) {
    return "https://www.google.com/maps/dir/?api=1" + (state.origin ? "&origin=" + state.origin.lat + "," + state.origin.lng : "") +
      "&destination=" + encodeURIComponent(site.geo.precision === "address" ? site.geo.lat + "," + site.geo.lng : (site.fullName || site.name) + ", " + site.town + ", PA");
  }
  function popupHtml(site, a) {
    var b = badge(site, a);
    return '<div class="pop"><b>' + esc(site.name) + '</b><span class="pop-where">' + esc(site.org) + " · " + esc(site.town) + "</span>" +
      '<span class="pop-count ' + b.cls + '">' + (a.state === "open" ? a.n + " " + esc(countLabel(a)) : esc(b.say)) + "</span>" +
      (state.origin ? '<span class="pop-dist">' + esc(distLabel(site)) + " straight-line</span>" : "") +
      (PRECISION[site.geo.precision] ? '<span class="pop-note">' + PRECISION[site.geo.precision] + "</span>" : "") +
      '<span class="pop-links">' + (site.contact ? '<a href="tel:' + site.contact.replace(/[^0-9]/g, "") + '">' + esc(site.contact) + "</a>" : "") +
      '<a href="' + esc(directions(site)) + '" target="_blank" rel="noopener">Directions</a></span></div>';
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
  function renderMap(sites) {
    var rows = sites.map(function (s) { return { site: s, a: availFor(s) }; });
    var rank = { open: 0, avail: 1, full: 2, nr: 3, na: 3, none: 4 };
    rows.sort(function (x, y) {
      if (state.origin) return (distOf(x.site) - distOf(y.site)) || ((y.a.n || 0) - (x.a.n || 0));
      return (rank[x.a.state] - rank[y.a.state]) || ((y.a.n || 0) - (x.a.n || 0)) || (regionOrder(x.site) - regionOrder(y.site));
    });
    var placed = rows.filter(function (r) { return r.site.geo; }), unplaced = rows.filter(function (r) { return !r.site.geo; });
    var open = rows.filter(function (r) { return r.a.state === "open"; });
    var nearestOpen = state.origin ? open.filter(function (r) { return r.site.geo; })[0] : null;
    $("status").textContent = state.origin
      ? "Nearest to " + state.origin.label + ". " + (nearestOpen ? "Closest site with open " + (state.type === "any" ? "beds" : TYPE_LABEL[state.type].toLowerCase() + " beds") + ": " + nearestOpen.site.name + ", " + distLabel(nearestOpen.site) + " (straight-line)." : "No site with a reported open count matches these filters.")
      : plural(placed.length, "site") + " on the map · " + plural(open.length, "site") + " with open beds. Search an address or ZIP to sort by distance.";

    // List
    $("map-list").innerHTML = rows.map(function (r, i) {
      var s = r.site, b = badge(s, r.a);
      return '<li class="ml ' + b.cls + '"><span class="ml-n ' + b.cls + '" aria-hidden="true">' + esc(b.text) + "</span>" +
        '<div class="ml-body"><b>' + esc(s.name) + '</b><span class="ml-where">' + esc(s.town) + (state.origin ? " · " + esc(distLabel(s)) : "") + '</span><span class="sr">' + esc(b.say) + "</span>" +
        '<span class="ml-act">' + (s.geo ? '<button type="button" class="linkbtn" data-pin="' + esc(s.id) + '">Show on map</button>' : '<span class="fit-none">Location not on file</span>') +
        (s.contact ? '<a href="tel:' + s.contact.replace(/[^0-9]/g, "") + '">' + esc(s.contact) + "</a>" : "") +
        (s.report ? OB.sourceChip(s.report.source, s.report.id, s.id) : "") + "</span></div></li>";
    }).join("") || '<li class="empty">No sites match these filters.</li>';

    if (!ensureMap()) return;
    map.invalidateSize();
    var reopen = Object.keys(pins).filter(function (id) { return pins[id].isPopupOpen(); })[0];
    pinLayer.clearLayers();
    pins = {};
    // Spread pins that share a point (e.g. three York sites) in a small ring.
    var groups = {};
    placed.forEach(function (r) { var k = r.site.geo.lat.toFixed(3) + "," + r.site.geo.lng.toFixed(3); (groups[k] = groups[k] || []).push(r); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      g.forEach(function (r, i) {
        var lat = r.site.geo.lat, lng = r.site.geo.lng;
        if (g.length > 1) { var ang = 2 * Math.PI * i / g.length; lat += 0.02 * Math.cos(ang); lng += 0.027 * Math.sin(ang); }
        var b = badge(r.site, r.a);
        var m = L.marker([lat, lng], {
          icon: L.divIcon({ className: "pin-wrap", html: '<span class="pin ' + b.cls + '">' + esc(b.text) + "</span>", iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -18] }),
          title: r.site.name + " — " + b.say, alt: r.site.name + " — " + b.say, riseOnHover: true,
          zIndexOffset: r.a.state === "open" ? 1000 : 0
        }).bindPopup(popupHtml(r.site, r.a));
        m.addTo(pinLayer);
        pins[r.site.id] = m;
      });
    });
    if (reopen && pins[reopen]) pins[reopen].openPopup();
    if (originPin) { originPin.remove(); originPin = null; }
    if (state.origin) {
      originPin = L.marker([state.origin.lat, state.origin.lng], {
        icon: L.divIcon({ className: "pin-wrap", html: '<span class="pin origin" aria-hidden="true"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: "Searched location", alt: "Searched location", zIndexOffset: 2000
      }).bindPopup("<b>" + esc(state.origin.label) + "</b>").addTo(map);
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
      mapMsg("Showing distances from " + o.label + ". Distances are straight-line.");
      setOrigin(o);
    }).catch(function () { mapMsg("The address lookup isn’t reachable from this network. Try “Use my location”.", true); });
  });
  $("map-me").addEventListener("click", function () {
    if (!navigator.geolocation) { mapMsg("This browser can’t share its location.", true); return; }
    mapMsg("Getting your location…");
    navigator.geolocation.getCurrentPosition(function (p) {
      mapMsg("Showing distances from your location. Distances are straight-line.");
      setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, label: "your location" });
    }, function () { mapMsg("Location wasn’t shared. Type a ZIP code instead.", true); }, { timeout: 10000 });
  });
  $("map-clear").addEventListener("click", function () { $("map-q").value = ""; mapMsg("Looked up with OpenStreetMap. Enter a ZIP or address only — never a client’s name."); setOrigin(null); });
  $("map-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-pin]");
    if (!b || !map) return;
    var m = pins[b.getAttribute("data-pin")];
    if (!m) return;
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 10));
    m.openPopup();
    $("map").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });

  // ---------- tabs ----------
  var TABS = [["find", "tab-find", "view-find"], ["map", "tab-map", "view-map"], ["grid", "tab-grid", "view-grid"], ["updates", "tab-updates", "view-updates"]];
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

  function render() {
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
    $("sortbox").hidden = state.view !== "find";
    renderTiles(sites);
    if (state.view === "find") renderFind(sites);
    else if (state.view === "map") renderMap(sites);
    else if (state.view === "grid") renderGrid(sites);
    else renderUpdates();
  }

  buildSeg("f-type", "f-type", TYPE_OPTS, "type");
  buildSeg("f-sex", "f-sex", SEX_OPTS, "sex");
  buildSeg("f-age", "f-age", AGE_OPTS, "age");
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
  $("f-search").addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); render(); });
  $("f-mh").addEventListener("change", function (e) { state.mh = e.target.checked; render(); });
  $("f-fresh").addEventListener("change", function (e) { state.recentOnly = e.target.checked; render(); });
  $("f-sort").addEventListener("change", function (e) { state.sort = e.target.value; render(); });
  setupTabs();
  S.subscribe(render);
  setInterval(render, 60000);
  render();
})();
