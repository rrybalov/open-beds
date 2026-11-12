/* Open Beds — admin: email inbox and review, site updates, activity, settings. */
(function () {
  "use strict";
  var S = window.OpenBedsStore, OB = window.OB, ED = window.OpenBedsEditor, esc = OB.esc;
  function $(id) { return document.getElementById(id); }
  var ui = { tab: "inbox", mailFilter: "all", staleOnly: false };
  var lastFocus = null;

  function siteName(id) { return S.siteById[id] ? S.siteById[id].name : id; }
  function orgShort(id) { return id && S.orgById[id] ? S.orgById[id].short : "Unknown sender"; }
  var STATUS = { published: "Published", review: "Needs review", rejected: "Rejected" };
  function statusChip(r) {
    var label = r.status === "published" && r.source === "email" ? (r.auto ? "Auto-published" : "Published by DHS") : STATUS[r.status];
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

  // ---------- sites ----------
  function renderSites() {
    var cur = S.current();
    var rows = S.sites.sites.filter(function (s) {
      if (!ui.staleOnly) return true;
      return !cur[s.id] || OB.when(cur[s.id].report.receivedAt).hours >= 24;
    }).map(function (s) {
      var c = cur[s.id];
      var upd = c ? '<span class="fr ' + OB.when(c.report.receivedAt).level + '">' + esc(OB.when(c.report.receivedAt).label) + "</span> " + OB.sourceChip(c.report.source) : '<span class="fr stale">No update</span>';
      return '<tr><th scope="row"><b>' + esc(s.name) + '</b><br><span class="conf">' + esc(S.orgById[s.org].short) + " · " + esc(s.town) + "</span></th><td>" + upd + '</td><td class="sum">' + esc(c ? OB.entrySummary(c.entry) : "—") +
        '</td><td><button type="button" class="btn small" data-site="' + s.id + '">Update<span class="sr"> ' + esc(s.name) + "</span></button></td></tr>";
    });
    $("site-rows").innerHTML = rows.join("") || '<tr><td colspan="4">Every site has updated in the last 24 hours.</td></tr>';
  }

  // ---------- activity ----------
  var SRC = { email: "Email", form: "Provider form", admin: "DHS update" };
  function renderActivity() {
    $("act-rows").innerHTML = S.reports().map(function (r) {
      var f = OB.when(r.receivedAt);
      var names = r.entries.map(function (e) { return e.siteId ? siteName(e.siteId) : "Unassigned"; });
      return "<tr><td>" + esc(f.label) + "</td><td>" + OB.sourceChip(r.source) + "</td><td>" + esc(r.by) + (r.reason ? '<br><span class="conf">“' + esc(r.reason) + "”</span>" : "") +
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
