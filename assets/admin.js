/* Open Beds — admin: email inbox and review, site updates, activity, settings. */
(function () {
  "use strict";
  var S = window.OpenBedsStore, OB = window.OB, ED = window.OpenBedsEditor, esc = OB.esc;
  function $(id) { return document.getElementById(id); }
  var ui = { tab: "inbox", mailFilter: "all", staleOnly: false };
  var lastFocus = null;

  function siteName(id) { return S.siteById[id] ? S.siteById[id].name : id; }
  function orgShort(id) { return id && S.orgById[id] ? S.orgById[id].short : "Unknown sender"; }
  var STATUS = { published: "Published", review: "Needs review", rejected: "Rejected", undone: "Undone" };
  function statusChip(r) {
    var label = r.status === "published" && r.source === "email" ? (r.auto ? "Auto-published" : "Published by DHS") :
      r.status === "published" && r.source === "referral" ? "On the board" : STATUS[r.status];
    return '<span class="status-chip st-' + r.status + '">' + esc(label) + "</span>";
  }

  // ---------- inbox ----------
  var FILTERS = [["all", "All"], ["review", "Needs review"], ["published", "Published"], ["rejected", "Rejected"]];
  function renderMailFilter() {
    $("mail-filter").innerHTML = FILTERS.map(function (f) {
      var id = "mf-" + f[0];
      return '<input type="radio" name="mf" id="' + id + '" value="' + f[0] + '"' + (ui.mailFilter === f[0] ? " checked" : "") + '><label for="' + id + '">' + f[1] + "</label>";
    }).join("");
  }

  function mailItem(r) {
    var f = OB.when(r.receivedAt);
    var siteOpts = '<option value="">Assign to site…</option>' + S.sites.sites.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name + " — " + S.orgById[s.org].short) + "</option>"; }).join("");
    var parsed = r.entries.map(function (e, i) {
      if (e.siteId) return "<li><b>" + esc(siteName(e.siteId)) + "</b> — " + esc(OB.entrySummary(e)) + (e.notes && e.notes.length ? " · " + esc(e.notes.join("; ")) : "") + "</li>";
      return '<li><div class="assign"><span>' + esc(OB.entrySummary(e)) + '</span><label class="sr" for="as-' + r.id + "-" + i + '">Site for these counts</label><select class="sel-in" id="as-' + r.id + "-" + i + '" data-assign="' + r.id + '" data-idx="' + i + '">' + siteOpts + "</select></div></li>";
    }).join("");
    var warns = (r.parse.warnings || []).map(function (w) { return '<span class="pill warn">' + esc(w) + "</span>"; }).join("");
    var actions = "";
    if (r.status === "review") actions = '<button type="button" class="btn primary small" data-act="publish" data-id="' + r.id + '">Publish</button><button type="button" class="btn small" data-act="edit" data-id="' + r.id + '">Edit counts, then publish</button><button type="button" class="btn danger small" data-act="reject" data-id="' + r.id + '">Reject</button>';
    else if (r.status === "published") actions = '<button type="button" class="btn small" data-act="edit" data-id="' + r.id + '">Correct counts</button><button type="button" class="btn danger small" data-act="reject" data-id="' + r.id + '">Unpublish</button>';
    else actions = '<button type="button" class="btn small" data-act="publish" data-id="' + r.id + '">Publish anyway</button>';
    return '<article class="mail' + (r.status === "review" ? " review" : "") + '" id="mail-' + r.id + '"><div class="mail-top">' + statusChip(r) + "<b>" + esc(orgShort(r.orgId)) + '</b><span class="fr ' + f.level + '">' + esc(f.label) + '</span><span class="conf">Parser confidence: ' + esc(r.parse.confidence) + "</span></div>" +
      '<div class="mail-meta">From ' + esc(r.email.from) + " · “" + esc(r.email.subject) + "”</div>" +
      (parsed ? '<ul class="parsed">' + parsed + "</ul>" : "<p class=\"hint\">No counts found.</p>") +
      (warns ? '<div class="warns">' + warns + "</div>" : "") +
      '<details><summary class="conf" style="cursor:pointer">Original email</summary><pre>' + esc(r.email.body) + "</pre></details>" +
      '<div class="btnrow">' + actions + "</div></article>";
  }

  function renderInbox() {
    var mails = S.reports().filter(function (r) { return r.source === "email"; });
    var list = mails.filter(function (r) { return ui.mailFilter === "all" || r.status === ui.mailFilter; });
    list.sort(function (a, b) { return (a.status === "review" ? 0 : 1) - (b.status === "review" ? 0 : 1) || new Date(b.receivedAt) - new Date(a.receivedAt); });
    $("mail-list").innerHTML = list.length ? list.map(mailItem).join("") : '<div class="empty">No emails here.</div>';
  }

  function onInboxClick(e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var id = b.getAttribute("data-id");
    var r = S.reports().filter(function (x) { return x.id === id; })[0];
    var act = b.getAttribute("data-act");
    if (act === "reject") { S.reject(id); say((r.status === "published" ? "Unpublished" : "Rejected") + " the " + orgShort(r.orgId) + " email."); return; }
    var entries = assigned(r);
    if (!entries) { say("Assign every count to a site first."); var sel = document.querySelector('[data-assign="' + id + '"]'); if (sel) sel.focus(); return; }
    if (act === "publish") { S.publish(id, { entries: entries }); say("Published. The bed board is updated."); return; }
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

  function receiveSimulated() {
    var em = { from: $("sim-from").value.trim(), subject: $("sim-subject").value.trim(), body: $("sim-body").value };
    if (!em.body.trim()) { $("sim-result").innerHTML = '<p class="err">Paste an email body first.</p>'; return; }
    var r = S.receiveEmail(em);
    var msg = r.status === "published"
      ? "Published automatically — " + esc(r.parse.summary) + '. <a href="index.html">See the board</a>.'
      : "Held for review — " + esc((r.parse.warnings || [])[0] || "low confidence") + ".";
    $("sim-result").innerHTML = '<p class="hint" style="margin-top:12px">' + msg + "</p>";
    ui.mailFilter = r.status === "review" ? "review" : "all";
    renderAll();
    var el = $("mail-" + r.id);
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
    var cur = S.current()[siteId];
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


  // ---------- add a facility ----------
  // Every bed type is offered on a new facility; blanks mean "not reported yet".
  var FULL_LAYOUT = [
    { type: "detox", sexes: ["male", "female", "any"] },
    { type: "residential", sexes: ["male", "female", "any"] },
    { type: "php", sexes: ["male", "female", "any"] },
    { type: "outpatient", mode: "yesno" }
  ];
  function slug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "site"; }
  function geocode(q) {
    return fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&viewbox=-80.6,42.3,-74.6,39.6&q=" + encodeURIComponent(q), { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) { return j && j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null; })
      .catch(function () { return null; });
  }
  function openAddFacility() {
    var temp = { id: "new", name: "New facility", beds: FULL_LAYOUT };
    var orgOpts = S.sites.orgs.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.name) + "</option>"; }).join("");
    var regionOpts = Object.keys(S.sites.regions).sort(function (a, b) { return S.sites.regions[a].order - S.sites.regions[b].order; })
      .map(function (k) { return '<option value="' + k + '">' + esc(S.sites.regions[k].label) + "</option>"; }).join("");
    var levels = S.sites.levels.map(function (l) { return '<label class="check"><input type="checkbox" name="nf-lv" value="' + esc(l[0]) + '"> ' + esc(l[1]) + ' <span class="help">' + esc(l[2]) + "</span></label>"; }).join("");
    var html = '<form novalidate class="addsite"><h2 id="dlg-h">Add a facility</h2>' +
      '<p class="hint">The facility appears on the bed board right away. Every bed type is available — leave blank anything they don’t offer or didn’t report.</p>' +
      '<h3 class="form-sub">Facility</h3>' +
      '<div class="row2"><div class="field"><label class="lbl" for="nf-name">Facility name <span class="help">(required)</span></label><input id="nf-name" class="input wide" type="text" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="nf-org">Provider</label><select id="nf-org" class="sel-in">' + orgOpts + '<option value="__new">New provider…</option></select></div></div>' +
      '<div class="row2" id="nf-neworg" hidden><div class="field"><label class="lbl" for="nf-orgname">Provider name <span class="help">(required)</span></label><input id="nf-orgname" class="input wide" type="text" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="nf-domain">Email domain they send from <span class="help">(optional, e.g. provider.org)</span></label><input id="nf-domain" class="input wide" type="text" autocomplete="off"></div></div>' +
      '<div class="row2"><div class="field"><label class="lbl" for="nf-address">Street address <span class="help">(optional — places it on the map)</span></label><input id="nf-address" class="input wide" type="text" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="nf-town">Town <span class="help">(required)</span></label><input id="nf-town" class="input wide" type="text" autocomplete="off"></div></div>' +
      '<div class="row2"><div class="field"><label class="lbl" for="nf-region">Region</label><select id="nf-region" class="sel-in">' + regionOpts + "</select></div>" +
      '<div class="field"><span class="lbl" id="nf-pop-l">Serves</span><div class="radio-row" role="radiogroup" aria-labelledby="nf-pop-l"><label class="check"><input type="radio" name="nf-pop" value="adult" checked> Adults</label><label class="check"><input type="radio" name="nf-pop" value="adolescent"> Adolescents</label></div></div></div>' +
      '<div class="field"><span class="lbl" id="nf-svc-l">Treats</span><div class="radio-row" role="group" aria-labelledby="nf-svc-l"><label class="check"><input type="checkbox" name="nf-svc" value="SUD" checked> Substance use</label><label class="check"><input type="checkbox" name="nf-svc" value="MH"> Mental health</label></div></div>' +
      '<h3 class="form-sub">Admissions contact</h3>' +
      '<div class="row3"><div class="field"><label class="lbl" for="nf-phone">Phone</label><input id="nf-phone" class="input wide" type="tel" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="nf-email">Intake email</label><input id="nf-email" class="input wide" type="email" autocomplete="off"></div>' +
      '<div class="field"><label class="lbl" for="nf-web">Website</label><input id="nf-web" class="input wide" type="url" autocomplete="off" placeholder="https://"></div></div>' +
      '<h3 class="form-sub">Who they take</h3>' +
      '<fieldset class="lv-grid"><legend class="lbl">LOCA levels they accept</legend>' + levels + "</fieldset>" +
      '<div class="row2"><div class="field"><label class="lbl" for="nf-excl">Won’t take <span class="help">(optional, one per line)</span></label><textarea id="nf-excl" class="input wide" rows="2"></textarea></div>' +
      '<div class="field"><label class="lbl" for="nf-pay">Payment <span class="help">(optional)</span></label><input id="nf-pay" class="input wide" type="text" placeholder="e.g. Medical Assistance and SCA"></div></div>' +
      '<h3 class="form-sub">Open beds now</h3>' +
      ED.siteBlock(temp, null, { prefix: "nf", mode: "admin" }) +
      '<div class="row2"><div class="field"><label class="lbl" for="nf-by">Your name</label><input id="nf-by" class="input wide" type="text" autocomplete="name"></div>' +
      '<div class="field"><label class="lbl" for="nf-reason">Where the counts came from</label><input id="nf-reason" class="input wide" type="text" value="New facility added"></div></div>' +
      '<div class="err" id="nf-err" role="alert" hidden></div>' +
      '<div class="btnrow"><button type="submit" class="btn primary" id="nf-save">Add to the board</button><button type="button" class="btn" data-cancel>Cancel</button></div></form>';
    openDialog(html, saveFacility);
    $("dlg").querySelector(".site-edit-h").hidden = true;
    $("nf-org").addEventListener("change", function () { $("nf-neworg").hidden = $("nf-org").value !== "__new"; });

    function saveFacility() {
      var v = function (id) { return $(id).value.trim(); };
      var errs = [];
      var name = v("nf-name"), town = v("nf-town"), newOrg = $("nf-org").value === "__new";
      if (!name) errs.push("Add the facility name.");
      if (name && S.sites.sites.some(function (s) { return s.name.toLowerCase() === name.toLowerCase(); })) errs.push("A facility called “" + name + "” is already on the board.");
      if (!town) errs.push("Add the town.");
      if (newOrg && !v("nf-orgname")) errs.push("Add the provider’s name.");
      if (v("nf-email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("nf-email"))) errs.push("Check the intake email.");
      var svc = Array.prototype.map.call(document.querySelectorAll('input[name="nf-svc"]:checked'), function (x) { return x.value; });
      if (!svc.length) errs.push("Choose what they treat.");
      var counts = ED.readSite(temp, { prefix: "nf" });
      if (counts.errors.length) errs.push("Fix the highlighted counts.");
      if (errs.length) { $("nf-err").textContent = errs.join(" "); $("nf-err").hidden = false; return; }

      var id = slug(name) + "-" + Math.random().toString(36).slice(2, 6);
      var org = null, orgId = $("nf-org").value;
      if (newOrg) {
        org = { id: "org-" + slug(v("nf-orgname")) + "-" + Math.random().toString(36).slice(2, 5), name: v("nf-orgname"), short: v("nf-orgname"),
          senderDomains: v("nf-domain") ? [v("nf-domain").replace(/^.*@/, "").toLowerCase()] : [], custom: true };
        orgId = org.id;
      }
      var excl = v("nf-excl") ? v("nf-excl").split(/\n|;/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
      var levelsSel = Array.prototype.map.call(document.querySelectorAll('input[name="nf-lv"]:checked'), function (x) { return x.value; });
      var pop = document.querySelector('input[name="nf-pop"]:checked').value;
      var site = {
        id: id, org: orgId, name: name, aliases: [name.toLowerCase()], town: town, region: $("nf-region").value, population: pop, services: svc,
        contact: v("nf-phone") || null, beds: FULL_LAYOUT, custom: true,
        fit: { levels: levelsSel, serves: pop === "adult" ? "Adults" : "Adolescents", excludes: excl.length ? excl : undefined, payer: v("nf-pay") || undefined, known: [], source: ["admin"] },
        reach: { phone: v("nf-phone") || null, phoneFrom: v("nf-phone") ? "DHS entry" : null, email: v("nf-email") || null, emailFrom: v("nf-email") ? "DHS entry" : null, web: v("nf-web") || null },
        geo: null
      };
      var entry = counts.entry ? Object.assign(counts.entry, { siteId: id }) : null;
      $("nf-save").disabled = true;
      $("nf-save").textContent = "Adding…";
      var where = (v("nf-address") ? v("nf-address") + ", " : "") + town + ", PA";
      geocode(where).then(function (g) {
        if (g) site.geo = { lat: g.lat, lng: g.lng, precision: v("nf-address") ? "address" : "town" };
        S.addSite({ site: site, org: org, entry: entry, by: v("nf-by"), reason: v("nf-reason") || "New facility added" });
        closeDialog();
        say(name + " added to the board" + (entry ? " with its counts" : " — no counts yet") + (site.geo ? "." : ". It isn’t on the map: the address couldn’t be looked up."));
      });
    }
  }

  // ---------- sites ----------
  function renderSites() {
    var cur = S.current();
    var refs = {};
    S.boardSites().forEach(function (b) { if (b.referrals && b.referrals.length) refs[b.id] = b.referrals.length; });
    var rows = S.sites.sites.filter(function (s) {
      if (!ui.staleOnly) return true;
      return !cur[s.id] || OB.when(cur[s.id].report.receivedAt).hours >= 24;
    }).map(function (s) {
      var c = cur[s.id];
      var upd = c ? '<span class="fr ' + OB.when(c.report.receivedAt).level + '">' + esc(OB.when(c.report.receivedAt).label) + "</span> " + OB.sourceChip(c.report.source, c.report.id, s.id) : '<span class="fr stale">No update</span>';
      return '<tr><th scope="row"><b>' + esc(s.name) + "</b>" + (s.custom ? ' <span class="conf">· added by DHS</span>' : "") + '<br><span class="conf">' + esc(S.orgById[s.org].short) + " · " + esc(s.town) + "</span></th><td>" + upd + '</td><td class="sum">' + esc(c ? OB.entrySummary(c.entry) : "—") +
        (refs[s.id] ? '<br><span class="conf">' + OB.plural(refs[s.id], "referral") + " marked since — subtract from these counts</span>" : "") +
        '</td><td><button type="button" class="btn small" data-site="' + s.id + '">Update<span class="sr"> ' + esc(s.name) + "</span></button></td></tr>";
    });
    $("site-rows").innerHTML = rows.join("") || '<tr><td colspan="4">Every site has updated in the last 24 hours.</td></tr>';
  }

  // ---------- activity ----------
  var SRC = { email: "Email", form: "Provider form", admin: "DHS update" };
  function renderActivity() {
    $("act-rows").innerHTML = S.reports().map(function (r) {
      var f = OB.when(r.receivedAt);
      var names = r.source === "referral" ? [siteName(r.referral.siteId) + " — one " + (r.referral.type === "shared" ? "detox or rehab" : OB.TYPE_LABEL[r.referral.type].toLowerCase()) + " bed" + (r.referral.sex === "male" ? " (men)" : r.referral.sex === "female" ? " (women)" : "")]
        : r.entries.map(function (e) { return e.siteId ? siteName(e.siteId) : "Unassigned"; });
      return "<tr><td>" + esc(f.label) + "</td><td>" + OB.sourceChip(r.source, r.id) + "</td><td>" + esc(r.by) + (r.reason ? '<br><span class="conf">“' + esc(r.reason) + "”</span>" : "") +
        '</td><td class="sum">' + esc(names.join(", ")) + "</td><td>" + statusChip(r) + "</td></tr>";
    }).join("");
  }

  // ---------- settings ----------
  function renderSettings() {
    $("set-auto").checked = !!S.settings().autoPublish;
    $("sender-rows").innerHTML = S.sites.orgs.map(function (o) {
      var n = S.sites.sites.filter(function (s) { return s.org === o.id; }).length;
      return "<tr><td>" + esc(o.name) + "</td><td>" + o.senderDomains.map(esc).join("<br>") + "</td><td>" + n + "</td></tr>";
    }).join("");
  }

  // ---------- shell ----------
  var TABS = [["inbox", "t-inbox", "p-inbox"], ["sites", "t-sites", "p-sites"], ["activity", "t-activity", "p-activity"], ["settings", "t-settings", "p-settings"]];
  function say(msg) { $("a-status").textContent = msg; }

  function renderAll() {
    var reps = S.reports();
    var review = reps.filter(function (r) { return r.status === "review"; }).length;
    var cur = S.current();
    var fresh = S.sites.sites.filter(function (s) { return cur[s.id] && OB.when(cur[s.id].report.receivedAt).hours < 24; }).length;
    $("admin-meta").textContent = fresh + " of " + S.sites.sites.length + " sites updated in the last 24 hours · " + OB.plural(review, "email") + " waiting for review.";
    $("review-badge").hidden = !review;
    $("review-badge").textContent = review;
    $("review-badge").setAttribute("aria-label", review + " need review");
    TABS.forEach(function (t) {
      var on = ui.tab === t[0];
      $(t[1]).setAttribute("aria-selected", on);
      $(t[1]).tabIndex = on ? 0 : -1;
      $(t[2]).hidden = !on;
    });
    renderMailFilter();
    renderInbox();
    renderSites();
    renderActivity();
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
  $("mail-filter").addEventListener("change", function (e) { ui.mailFilter = e.target.value; renderInbox(); });
  $("mail-list").addEventListener("click", onInboxClick);
  $("site-rows").addEventListener("click", function (e) { var b = e.target.closest("[data-site]"); if (b) openSiteUpdate(b.getAttribute("data-site")); });
  $("add-site").addEventListener("click", openAddFacility);
  $("stale-only").addEventListener("change", function (e) { ui.staleOnly = e.target.checked; renderSites(); });
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
