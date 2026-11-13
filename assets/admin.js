/* Open Beds — admin: every update in one list (email, provider form, DHS, referrals), plus settings. */
(function () {
  "use strict";
  var S = window.OpenBedsStore, OB = window.OB, ED = window.OpenBedsEditor, FAC = window.OpenBedsFacility, PR = window.OpenBedsProfile, esc = OB.esc;
  function $(id) { return document.getElementById(id); }
  var ui = { tab: "updates", filter: "all", site: "" };
  var lastFocus = null;

  function siteName(id) { return S.siteById[id] ? S.siteById[id].name : id; }
  function orgShort(id) { return id && S.orgById[id] ? S.orgById[id].short : "Unknown sender"; }
  function liveSites() { return S.sites.sites.filter(function (s) { return !s.pending; }); }

  // ---------- updates ----------
  var FILTERS = [["all", "All"], ["review", "Needs review"], ["email", "Email"], ["form", "Provider form"], ["admin", "DHS"], ["referral", "Referrals"], ["profile", "Facility details"]];
  function renderFilter() {
    $("upd-filter").innerHTML = FILTERS.map(function (f) {
      var id = "uf-" + f[0];
      return '<input type="radio" name="uf" id="' + id + '" value="' + f[0] + '"' + (ui.filter === f[0] ? " checked" : "") + '><label for="' + id + '">' + f[1] + "</label>";
    }).join("");
  }

  // What the update did, in one line.
  function whatLine(r) {
    if (r.source === "referral") {
      var rf = r.referral;
      return "One " + (rf.type === "shared" ? "detox or rehab" : OB.TYPE_LABEL[rf.type].toLowerCase()) + " bed" + (rf.sex === "male" ? " (men)" : rf.sex === "female" ? " (women)" : "") + " referred to " + siteName(rf.siteId);
    }
    if (r.newSites) return "New facilit" + (r.newSites.length === 1 ? "y" : "ies") + ": " + r.newSites.map(siteName).join(", ") + (r.newOrg ? " — new provider " + orgShort(r.newOrg) : "");
    var named = r.entries.filter(function (e) { return e.siteId; }).map(function (e) { return siteName(e.siteId); });
    var loose = r.entries.length - named.length;
    if (!r.entries.length) return "No counts found";
    return (named.length > 3 ? named.length + " sites: " + named.slice(0, 3).join(", ") + " and " + (named.length - 3) + " more" : named.join(", ")) +
      (loose ? (named.length ? " · " : "") + OB.plural(loose, "count") + " not matched to a site" : "");
  }
  function whoLine(r) {
    if (r.source === "referral") return "Pathways" + (r.by && r.by.indexOf(": ") > -1 ? " · " + r.by.split(": ")[1] : "");
    if (r.source === "admin") return "DHS" + (r.by && r.by.indexOf(": ") > -1 ? " · " + r.by.split(": ")[1] : "");
    return orgShort(r.orgId);
  }
  function statusText(r) {
    if (r.status === "review") return r.newSites ? "Waiting for approval" : "Needs review";
    if (r.status === "rejected") return r.source === "email" ? "Rejected" : r.profile ? "Reverted" : "Removed";
    if (r.status === "undone") return "Undone";
    return "";
  }

  function item(r) {
    var f = OB.when(r.receivedAt), st = statusText(r);
    var siteOpts = '<option value="">Assign to site…</option>' + liveSites().map(function (s) { return '<option value="' + s.id + '">' + esc(s.name + " — " + S.orgById[s.org].short) + "</option>"; }).join("");
    var assign = r.status !== "published" && r.source === "email" ? r.entries.map(function (e, i) {
      if (e.siteId) return "";
      return '<div class="assign"><span>' + esc(OB.entrySummary(e)) + '</span><label class="sr" for="as-' + r.id + "-" + i + '">Site for these counts</label><select class="sel-in" id="as-' + r.id + "-" + i + '" data-assign="' + r.id + '" data-idx="' + i + '">' + siteOpts + "</select></div>";
    }).join("") : "";
    var warn = r.status === "review" && r.parse && r.parse.warnings && r.parse.warnings.length ? '<p class="ui-warn">' + esc(r.parse.warnings[0]) + "</p>" : "";
    var view = '<button type="button" class="linkbtn" data-report="' + esc(r.id) + '" aria-haspopup="dialog">' + (r.source === "email" ? "View email" : "View details") + "</button>";
    var acts = [];
    // Buttons only where a decision is waiting; everything else is a quiet link.
    function btn(act, label, cls) {
      var look = r.status === "review" ? "btn small" + (cls ? " " + cls : "") : "linkbtn" + (cls === "danger" ? " danger" : "");
      acts.push('<button type="button" class="' + look + '" data-act="' + act + '" data-id="' + r.id + '">' + label + "</button>");
    }
    if (r.status === "review") {
      btn("publish", r.newSites ? "Approve" : "Publish", "primary");
      if (r.source === "email") btn("edit", "Edit counts");
      btn("reject", "Reject", "danger");
    } else if (r.status === "published") {
      if (r.source === "referral") btn("undo", "Undo");
      else { if (r.source === "email") btn("edit", "Correct"); btn("reject", r.source === "email" ? "Unpublish" : "Remove", "danger"); }
    } else if (r.status === "rejected" && r.source === "email") btn("publish", "Publish anyway");
    return '<article class="ui-item' + (r.status === "review" ? " review" : "") + (r.status === "rejected" || r.status === "undone" ? " off" : "") + '" id="u-' + r.id + '">' +
      '<div class="ui-main"><p class="ui-top"><b>' + esc(whoLine(r)) + '</b><span class="upd-src">' + (OB.ICON[r.source] || "") + esc(OB.SOURCE[r.source].label) + "</span>" +
      '<span class="ui-time">' + esc(f.label) + "</span>" + (st ? '<span class="ui-status st-' + r.status + '">' + esc(st) + "</span>" : "") + "</p>" +
      '<p class="ui-what">' + esc(whatLine(r)) + (r.reason && r.source !== "email" ? ' <span class="ui-reason">“' + esc(r.reason) + "”</span>" : "") + "</p>" +
      warn + assign + "</div>" +
      '<div class="ui-act">' + view + acts.join("") + "</div></article>";
  }

  // ---------- per-facility change log ----------
  // Every update split into one line per facility, with what changed since that facility's last count.
  var SEXW = { male: " for men", female: " for women", any: "" };
  function bedWord(t, sx, n) {
    var name = t === "shared" ? "detox-or-rehab" : OB.TYPE_LABEL[t] ? OB.TYPE_LABEL[t].toLowerCase() : t;
    return (n === undefined ? "" : n + " ") + name + " bed" + (n === 1 || n === undefined ? "" : "s") + SEXW[sx || "any"];
  }
  // Flatten an entry into comparable cells.
  function cells(e) {
    var out = {};
    if (!e) return out;
    Object.keys(e.counts || {}).forEach(function (t) {
      if (t === "outpatient") { if (e.counts.outpatient.any === 0) out["op"] = "no"; return; }
      Object.keys(e.counts[t]).forEach(function (sx) { out[t + "|" + sx] = e.counts[t][sx]; });
    });
    if (e.shared) out["shared|any"] = e.shared.open;
    (e.qualitative || []).forEach(function (q) {
      if (q.types.indexOf("outpatient") > -1) out["op"] = "yes";
      else out["q|" + q.types.join(",")] = q.label;
    });
    return out;
  }
  function changeLines(prev, cur) {
    if (!prev) return ["First count on the board: " + OB.entrySummary(cur)];
    var a = cells(prev), b = cells(cur), keys = [], lines = [];
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    var order = ["detox", "shared", "residential", "php", "op", "q"];
    keys.sort(function (x, y) { return order.indexOf(x.split("|")[0]) - order.indexOf(y.split("|")[0]); });
    keys.forEach(function (k) {
      var va = a[k], vb = b[k], t = k.split("|")[0], sx = k.split("|")[1];
      if (va === vb) return;
      if (k === "op") { lines.push(vb === "yes" ? "Outpatient: now accepting new clients" : vb === "no" ? "Outpatient: no longer accepting" : "Outpatient: not in this update"); return; }
      if (t === "q") { lines.push(vb ? "Says “" + vb + "” (no count)" : "No longer says “" + va + "”"); return; }
      var label = bedWord(t, sx);
      if (typeof va === "number" && typeof vb === "number") {
        var d = vb - va;
        lines.push(Math.abs(d) + " " + bedWord(t, sx, Math.abs(d)).replace(/^\d+ /, "") + " " + (d < 0 ? "removed" : "added") + " (" + va + " → " + vb + ")");
      } else if (vb === "na") lines.push(label.charAt(0).toUpperCase() + label.slice(1) + " marked N/A");
      else if (va === undefined) lines.push(label.charAt(0).toUpperCase() + label.slice(1) + ": " + vb + " open (new in this update)");
      else if (vb === undefined) lines.push(label.charAt(0).toUpperCase() + label.slice(1) + ": not in this update (was " + (va === "na" ? "N/A" : va) + ")");
      else lines.push(label.charAt(0).toUpperCase() + label.slice(1) + ": " + (va === "na" ? "N/A" : va) + " → " + vb);
    });
    return lines.length ? lines : ["No change — same counts confirmed"];
  }
  function howLine(r) {
    var who = r.by && r.by.indexOf(": ") > -1 ? r.by.split(": ")[1] : "";
    if (r.profile) return "Facility details changed " + (r.source === "admin" ? "by DHS" + (who ? " (" + who + ")" : "") : "on the provider form" + (r.by ? " — " + r.by : "")) + (r.reason ? " — “" + r.reason + "”" : "");
    if (r.source === "referral") return "Claimed through the dashboard" + (who ? " by " + who : "");
    if (r.source === "admin") return "Changed manually by DHS" + (who ? " (" + who + ")" : "") + (r.reason ? " — “" + r.reason + "”" : "");
    if (r.source === "form") return "Provider form" + (r.by ? " — " + r.by : "");
    return "Email from " + orgShort(r.orgId);
  }
  function siteItems() {
    var chron = S.reports().slice().reverse(), lastPub = {}, items = [];
    chron.forEach(function (r) {
      if (r.status === "review") return; // shown at the top, as a whole
      var off = r.status === "rejected" || r.status === "undone";
      if (r.source === "referral") {
        var rf = r.referral, before = lastPub[rf.siteId], was = null;
        // Take the claimed bed off the running count, so the next update is compared with what the board showed.
        if (before && !off) {
          var nx = JSON.parse(JSON.stringify(before));
          if (rf.type === "shared" && nx.shared) { was = nx.shared.open; nx.shared.open = Math.max(0, was - 1); }
          else if (nx.counts && nx.counts[rf.type] && typeof nx.counts[rf.type][rf.sex] === "number") { was = nx.counts[rf.type][rf.sex]; nx.counts[rf.type][rf.sex] = Math.max(0, was - 1); }
          lastPub[rf.siteId] = nx;
        }
        items.push({ r: r, siteId: rf.siteId, kind: "referral", lines: ["1 " + bedWord(rf.type, rf.sex, 1).replace(/^1 /, "") + " claimed through the dashboard" + (was !== null ? " (" + was + " → " + Math.max(0, was - 1) + ")" : "")] });
        return;
      }
      if (r.profile) { items.push({ r: r, siteId: r.profile.siteId, kind: "profile", lines: r.profile.changes.length ? r.profile.changes : ["Facility details saved, no changes"] }); return; }
      (r.newSites || []).forEach(function (id) {
        if (!r.entries.some(function (e) { return e.siteId === id; })) items.push({ r: r, siteId: id, kind: "new", lines: ["Added as a new facility — no counts yet"] });
      });
      r.entries.forEach(function (e) {
        var isNew = (r.newSites || []).indexOf(e.siteId) > -1;
        var lines = isNew ? ["Added as a new facility: " + OB.entrySummary(e)] : e.siteId ? changeLines(lastPub[e.siteId], e) : ["Counts not matched to a site: " + OB.entrySummary(e)];
        items.push({ r: r, siteId: e.siteId, kind: "counts", lines: lines });
        if (e.siteId && !off) lastPub[e.siteId] = e;
      });
    });
    return items.reverse();
  }
  function siteItem(it) {
    var r = it.r, f = OB.when(r.receivedAt), site = it.siteId ? S.siteById[it.siteId] : null, st = statusText(r);
    var acts = ['<button type="button" class="linkbtn" data-report="' + esc(r.id) + '"' + (it.siteId ? ' data-site="' + esc(it.siteId) + '"' : "") + ' aria-haspopup="dialog">' + (r.source === "email" ? "View email" : "View details") + "</button>"];
    if (r.status === "published") {
      if (it.kind === "referral") acts.push('<button type="button" class="linkbtn" data-act="undo" data-id="' + r.id + '">Undo</button>');
      else if (it.kind === "profile") acts.push('<button type="button" class="linkbtn danger" data-act="reject" data-id="' + r.id + '">Revert</button>');
      if (site && !site.pending) acts.push('<button type="button" class="linkbtn" data-fix="' + esc(site.id) + '">Correct counts</button>');
    }
    return '<article class="ui-item site-line' + (st ? " off" : "") + '">' +
      '<div class="ui-main"><p class="ui-top"><b>' + esc(site ? site.name : "Unmatched counts") + "</b>" +
      (site ? '<span class="ui-org">run by ' + esc(orgShort(site.org)) + "</span>" : "") +
      '<span class="ui-time">' + esc(f.label) + "</span>" + (st ? '<span class="ui-status st-' + r.status + '">' + esc(st) + "</span>" : "") + "</p>" +
      '<ul class="ui-changes">' + it.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" +
      '<p class="ui-how"><span class="upd-src">' + (OB.ICON[r.source] || "") + "</span>" + esc(howLine(r)) + "</p></div>" +
      '<div class="ui-act">' + acts.join("") + "</div></article>";
  }

  function renderUpdates() {
    var all = S.reports();
    var waiting = all.filter(function (r) { return r.status === "review"; })
      .filter(function (r) { return ui.filter === "all" || ui.filter === "review" || r.source === ui.filter; })
      .sort(function (a, b) { return new Date(b.receivedAt) - new Date(a.receivedAt); });
    var lines = ui.filter === "review" ? [] : siteItems().filter(function (it) {
      if (ui.filter === "all") return true;
      if (ui.filter === "profile") return it.kind === "profile";
      return it.r.source === ui.filter && it.kind !== "profile";
    });
    if (ui.site) lines = lines.filter(function (it) { return it.siteId === ui.site; });
    var html = "";
    if (waiting.length) html += '<h2 class="ui-h">Waiting for you <span>' + waiting.length + "</span></h2>" + waiting.map(item).join("");
    if (ui.filter !== "review") html += '<h2 class="ui-h">Changes by facility <span>newest first</span></h2>' + (lines.length ? lines.slice(0, 150).map(siteItem).join("") : '<div class="empty">Nothing here.</div>');
    else if (!waiting.length) html += '<div class="empty">Nothing waiting for review.</div>';
    $("upd-list").innerHTML = html;
  }

  function onUpdateClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var id = b.getAttribute("data-id");
    var r = S.reports().filter(function (x) { return x.id === id; })[0];
    var act = b.getAttribute("data-act");
    if (act === "undo") { S.undoReferral(id, { by: "DHS admin" }); say("Referral undone — the bed is back on the board."); return; }
    if (act === "reject") { S.reject(id); say(r.profile ? "Reverted — the facility’s details are back to what they were." : r.status === "published" ? "Removed from the board." : "Rejected."); return; }
    var entries = assigned(r);
    if (!entries) { say("Assign every count to a site first."); var sel = document.querySelector('[data-assign="' + id + '"]'); if (sel) sel.focus(); return; }
    if (act === "publish") { S.publish(id, { entries: entries }); say(r.newSites ? "Approved — the new facilit" + (r.newSites.length === 1 ? "y is" : "ies are") + " on the board." : "Published. The bed board is updated."); return; }
    if (act === "edit") openEmailEdit(r, entries);
  }

  // Entries with any admin site assignments applied; null if something is still unplaced.
  function assigned(r) {
    var ok = true;
    var entries = r.entries.map(function (e, i) {
      if (e.siteId) return e;
      var sel = document.querySelector('[data-assign="' + r.id + '"][data-idx="' + i + '"]');
      if (!sel || !sel.value) { ok = false; return e; }
      return Object.assign({}, e, { siteId: sel.value });
    });
    return ok ? entries : null;
  }

  // ---------- email simulator ----------
  function receiveSimulated() {
    var em = { from: $("sim-from").value.trim(), subject: $("sim-subject").value.trim(), body: $("sim-body").value };
    if (!em.body.trim()) { $("sim-result").innerHTML = '<p class="err">Paste an email body first.</p>'; return; }
    var r = S.receiveEmail(em);
    var msg = r.status === "published"
      ? "Published automatically — " + esc(r.parse.summary) + '. <a href="index.html">See the board</a>.'
      : "Held for review — " + esc((r.parse.warnings || [])[0] || "low confidence") + ".";
    $("sim-result").innerHTML = '<p class="hint" style="margin-top:12px">' + msg + "</p>";
    ui.filter = r.status === "review" ? "review" : "all";
    renderAll();
    var el = $("u-" + r.id);
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  function loadExample() {
    var key = $("sim-example").value;
    var all = window.OPEN_BEDS_EMAILS.samples.concat(window.OPEN_BEDS_EMAILS.extras);
    var em = all.filter(function (x) { return x.key === key; })[0];
    if (!em) { $("sim-from").value = ""; $("sim-subject").value = ""; $("sim-body").value = ""; return; }
    $("sim-from").value = em.from; $("sim-subject").value = em.subject; $("sim-body").value = em.body;
  }

  // ---------- dialogs ----------
  function openDialog(html, onSave) {
    lastFocus = document.activeElement;
    $("dlg").innerHTML = html;
    $("dlg-wrap").hidden = false;
    var first = $("dlg").querySelector("input, select, textarea, button");
    if (first) first.focus();
    $("dlg").querySelector("[data-cancel]").addEventListener("click", closeDialog);
    $("dlg").querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); onSave(); });
  }
  function closeDialog() { $("dlg-wrap").hidden = true; $("dlg").innerHTML = ""; if (lastFocus) lastFocus.focus(); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("dlg-wrap").hidden) closeDialog(); });

  function openSiteUpdate(siteId) {
    var site = S.siteById[siteId];
    var cur = S.current({ adjusted: true })[siteId];
    var html = '<form novalidate><h2 id="dlg-h">Update ' + esc(site.name) + '</h2><p class="hint">Use when a provider calls in, or to correct a count. The board shows this as a DHS update.</p>' +
      ED.siteBlock(site, cur, { prefix: "ad", mode: "admin" }) +
      '<div class="row2"><div class="field"><label class="lbl" for="ad-by">Your name</label><input id="ad-by" class="input wide" type="text" autocomplete="name"></div>' +
      '<div class="field"><label class="lbl" for="ad-reason">Reason <span class="help">(required)</span></label><input id="ad-reason" class="input wide" type="text" placeholder="e.g. Called admissions at 11:20"></div></div>' +
      '<div class="err" id="ad-err" role="alert" hidden></div>' +
      '<div class="btnrow"><button type="submit" class="btn primary">Save to board</button><button type="button" class="btn" data-cancel>Cancel</button></div></form>';
    openDialog(html, function () {
      var r = ED.readSite(site, { prefix: "ad" });
      var reason = $("ad-reason").value.trim();
      var errs = [];
      if (r.errors.length) errs.push("Fix the highlighted counts.");
      if (!r.entry) errs.push("Enter at least one count.");
      if (!reason) errs.push("Add a reason.");
      if (errs.length) { $("ad-err").textContent = errs.join(" "); $("ad-err").hidden = false; return; }
      S.adminUpdate({ orgId: site.org, entries: [r.entry], by: $("ad-by").value.trim(), reason: reason });
      closeDialog();
      say(site.name + " updated on the board.");
    });
  }

  function openEmailEdit(r, entries) {
    var blocks = entries.map(function (e) {
      return ED.siteBlock(S.siteById[e.siteId], { entry: e, report: { receivedAt: r.receivedAt, source: "email" } }, { prefix: "em", mode: "admin" });
    }).join("");
    var html = '<form novalidate><h2 id="dlg-h">Check the ' + esc(orgShort(r.orgId)) + ' email</h2><p class="hint">Correct anything the parser got wrong, then publish.</p>' + blocks +
      '<div class="err" id="em-err" role="alert" hidden></div><div class="btnrow"><button type="submit" class="btn primary">Publish</button><button type="button" class="btn" data-cancel>Cancel</button></div></form>';
    openDialog(html, function () {
      var out = [], bad = 0;
      entries.forEach(function (e) {
        var res = ED.readSite(S.siteById[e.siteId], { prefix: "em" });
        bad += res.errors.length;
        if (res.entry) { res.entry.flags = e.flags || []; out.push(res.entry); }
      });
      if (bad || !out.length) { $("em-err").textContent = bad ? "Fix the highlighted counts." : "Enter at least one count."; $("em-err").hidden = false; return; }
      S.publish(r.id, { entries: out });
      closeDialog();
      say("Published with your corrections.");
    });
  }

  function openAddFacility() {
    var orgOpts = S.sites.orgs.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.name) + "</option>"; }).join("");
    var html = '<form novalidate class="addsite"><h2 id="dlg-h">Add a facility</h2>' +
      '<p class="hint">It appears on the bed board right away.</p>' +
      '<div class="field"><label class="lbl" for="nf-org">Provider</label><select id="nf-org" class="sel-in" style="max-width:420px">' + orgOpts + '<option value="__new">New provider…</option></select></div>' +
      '<div id="nf-neworg" hidden>' + FAC.providerFields("nf") + "</div>" +
      FAC.fields("nf") +
      '<div class="row2"><div class="field"><label class="lbl" for="nf-by">Your name</label><input id="nf-by" class="input wide" type="text" autocomplete="name"></div>' +
      '<div class="field"><label class="lbl" for="nf-reason">Where the counts came from</label><input id="nf-reason" class="input wide" type="text" value="New facility added"></div></div>' +
      '<div class="btnrow"><button type="submit" class="btn primary" id="nf-save">Add to the board</button><button type="button" class="btn" data-cancel>Cancel</button></div></form>';
    openDialog(html, function () {
      var newOrg = $("nf-org").value === "__new";
      var prov = newOrg ? FAC.readProvider("nf") : { errors: [] };
      var fac = FAC.read("nf");
      if (prov.errors.length || fac.errors.length) {
        $("nf-ferr").textContent = prov.errors.concat(fac.errors).join(" ");
        $("nf-ferr").hidden = false;
        return;
      }
      $("nf-save").disabled = true;
      $("nf-save").textContent = "Adding…";
      FAC.buildAll([fac], newOrg ? prov.org.id : $("nf-org").value, "admin").then(function (built) {
        S.addSite({ site: built[0].site, org: newOrg ? prov.org : null, entry: built[0].entry, by: $("nf-by").value.trim(), reason: $("nf-reason").value.trim() });
        closeDialog();
        say(fac.data.name + " added to the board" + (built[0].entry ? " with its counts" : " — no counts yet") + (built[0].site.geo ? "." : ". It isn’t on the map: the address couldn’t be looked up."));
      });
    });
    $("nf-org").addEventListener("change", function () { $("nf-neworg").hidden = $("nf-org").value !== "__new"; });
  }

  function openProfile(siteId) {
    var site = S.siteById[siteId];
    var html = '<form novalidate><h2 id="dlg-h">' + esc(site.name) + ' — facility details</h2><p class="hint">Levels of care, who they take, payment and contact. Saved changes show on the board and in Updates.</p>' +
      PR.fields(site, "ap", { open: true }) +
      '<div class="row2"><div class="field"><label class="lbl" for="ap-by">Your name</label><input id="ap-by" class="input wide" type="text" autocomplete="name"></div>' +
      '<div class="field"><label class="lbl" for="ap-reason">Why <span class="help">(optional)</span></label><input id="ap-reason" class="input wide" type="text" placeholder="e.g. Confirmed with admissions"></div></div>' +
      '<div class="btnrow"><button type="submit" class="btn primary">Save details</button><button type="button" class="btn" data-cancel>Cancel</button></div></form>';
    openDialog(html, function () {
      var pr = PR.read(site, "ap");
      if (pr.errors.length) return;
      if (!pr.changed) { closeDialog(); say("No changes to save."); return; }
      S.updateProfile({ siteId: site.id, fit: pr.fit, reach: pr.reach, changes: pr.changes, by: "DHS admin" + ($("ap-by").value.trim() ? ": " + $("ap-by").value.trim() : ""), reason: $("ap-reason").value.trim(), source: "admin" });
      closeDialog();
      say(site.name + ": " + OB.plural(pr.changes.length, "detail") + " updated.");
    });
  }

  function renderSitePicker() {
    var cur = S.current(), keep = $("pick-site").value;
    $("pick-site").innerHTML = '<option value="">Choose a site…</option>' + liveSites().map(function (s) {
      var c = cur[s.id], stale = !c || OB.when(c.report.receivedAt).hours >= 24;
      return '<option value="' + s.id + '">' + esc(s.name + " — " + S.orgById[s.org].short + (stale ? " (no update in 24 h)" : "")) + "</option>";
    }).join("");
    $("pick-site").value = keep;
    var ks = $("upd-site").value;
    $("upd-site").innerHTML = '<option value="">All facilities</option>' + liveSites().map(function (s) { return '<option value="' + s.id + '">' + esc(s.name + " — " + S.orgById[s.org].short) + "</option>"; }).join("");
    $("upd-site").value = ks;
  }

  // ---------- settings ----------
  function renderSettings() {
    $("set-auto").checked = !!S.settings().autoPublish;
    $("sender-rows").innerHTML = S.sites.orgs.map(function (o) {
      var n = liveSites().filter(function (s) { return s.org === o.id; }).length;
      return "<tr><td>" + esc(o.name) + "</td><td>" + (o.senderDomains.length ? o.senderDomains.map(esc).join("<br>") : '<span class="conf">None</span>') + "</td><td>" + n + "</td></tr>";
    }).join("");
  }

  // ---------- shell ----------
  var TABS = [["updates", "t-updates", "p-updates"], ["settings", "t-settings", "p-settings"]];
  function say(msg) { $("a-status").textContent = msg; }

  function renderAll() {
    var review = S.reports().filter(function (r) { return r.status === "review"; }).length;
    var cur = S.current(), live = liveSites();
    var fresh = live.filter(function (s) { return cur[s.id] && OB.when(cur[s.id].report.receivedAt).hours < 24; }).length;
    $("admin-meta").textContent = fresh + " of " + live.length + " sites updated in the last 24 hours · " + OB.plural(review, "update") + " waiting for review.";
    $("review-badge").hidden = !review;
    $("review-badge").textContent = review;
    $("review-badge").setAttribute("aria-label", review + " need review");
    TABS.forEach(function (t) {
      var on = ui.tab === t[0];
      $(t[1]).setAttribute("aria-selected", on);
      $(t[1]).tabIndex = on ? 0 : -1;
      $(t[2]).hidden = !on;
    });
    renderFilter();
    renderUpdates();
    renderSitePicker();
    renderSettings();
  }

  TABS.forEach(function (t, i) {
    $(t[1]).addEventListener("click", function () { ui.tab = t[0]; renderAll(); });
    $(t[1]).addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      var next = TABS[(i + d + TABS.length) % TABS.length];
      ui.tab = next[0]; renderAll(); $(next[1]).focus();
    });
  });
  $("upd-filter").addEventListener("change", function (e) { ui.filter = e.target.value; renderUpdates(); });
  $("upd-list").addEventListener("click", onUpdateClick);
  $("upd-list").addEventListener("click", function (e) { var b = e.target.closest("[data-fix]"); if (b) openSiteUpdate(b.getAttribute("data-fix")); });
  $("upd-site").addEventListener("change", function (e) { ui.site = e.target.value; renderUpdates(); });
  $("pick-details").addEventListener("click", function () {
    if (!$("pick-site").value) { say("Choose a site first."); $("pick-site").focus(); return; }
    openProfile($("pick-site").value);
  });
  $("add-site").addEventListener("click", openAddFacility);
  $("pick-go").addEventListener("click", function () {
    if (!$("pick-site").value) { say("Choose a site to update."); $("pick-site").focus(); return; }
    openSiteUpdate($("pick-site").value);
  });
  $("set-auto").addEventListener("change", function (e) { S.setSetting("autoPublish", e.target.checked); say(e.target.checked ? "Recognized emails will publish automatically." : "Every email will wait for review."); });
  $("reset").addEventListener("click", function () { S.reset(); say("Demo data reset to the 7 sample emails."); });

  var all = window.OPEN_BEDS_EMAILS.samples.map(function (e) { return [e.key, S.orgById[window.OpenBedsParser.orgFor(e.from, S.sites).id].short + " — " + e.subject]; })
    .concat(window.OPEN_BEDS_EMAILS.extras.map(function (e) { return [e.key, e.label]; }));
  $("sim-example").innerHTML = '<option value="">Blank</option>' + all.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + "</option>"; }).join("");
  $("sim-example").value = "standard-format";
  loadExample();
  $("sim-example").addEventListener("change", loadExample);
  $("sim-send").addEventListener("click", receiveSimulated);

  S.subscribe(renderAll);
  renderAll();
})();
