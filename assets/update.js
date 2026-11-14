/* Open Beds — provider update form: counts for listed facilities (collapsed, with a jump list and a review step), plus new providers and facilities (held for DHS review). */
(function () {
  "use strict";
  var S = window.OpenBedsStore, OB = window.OB, ED = window.OpenBedsEditor, FAC = window.OpenBedsFacility, PR = window.OpenBedsProfile, esc = OB.esc;
  function $(id) { return document.getElementById(id); }
  var PREFIX = "pf", NEW = "__new";
  var facs = [], facSeq = 0; // prefixes of the "new facility" blocks on the page

  function orgSites(orgId) { return S.sites.sites.filter(function (s) { return s.org === orgId && !s.pending; }); }

  function renderOrgs() {
    var want = new URLSearchParams(location.search).get("org");
    var keep = $("org").value || want;
    $("org").innerHTML = '<option value="">Choose your organization</option>' + S.sites.orgs.filter(function (o) { return orgSites(o.id).length; }).map(function (o) {
      return '<option value="' + o.id + '">' + esc(o.name) + "</option>";
    }).join("") + '<option value="' + NEW + '">My organization isn’t listed — add it</option>';
    if (keep) $("org").value = keep;
  }

  function renderSites() {
    var orgId = $("org").value, isNew = orgId === NEW;
    $("neworg").hidden = !isNew;
    $("beds-panel").hidden = !orgId || isNew;
    $("facs-panel").hidden = !orgId;
    $("facs-h").textContent = isNew ? "Your facilities" : "A facility that isn’t listed?";
    $("facs-hint").textContent = isNew
      ? "Add each location where you have beds. DHS checks new providers and facilities before they appear on the board."
      : "Add any location that’s missing. DHS checks new facilities before they appear on the board.";
    facs = []; $("new-facs").innerHTML = ""; $("jump").hidden = true; $("jump-list").innerHTML = "";
    if (isNew) addFacility();
    if (!orgId) { $("sites").innerHTML = ""; $("org-hint").hidden = false; $("tmpl").textContent = template([]); return; }
    $("org-hint").hidden = true;
    if (isNew) { $("tmpl").textContent = template([]); return; }
    var cur = S.current({ adjusted: true });
    var sites = orgSites(orgId);
    confirmed = {}; touched = {};
    $("sites").innerHTML = sites.map(function (s) {
      var c = cur[s.id], open = sites.length === 1;
      var last = c ? "Last update " + OB.when(c.report.receivedAt).label + ": " + OB.entrySummary(c.entry) : "No update yet";
      return '<div class="site-wrap" id="sw-' + s.id + '"><h3 class="sum-h"><button type="button" class="sum-btn" id="sb-' + s.id + '" aria-expanded="' + open + '" aria-controls="sbody-' + s.id + '">' +
        '<span class="sum-name">' + esc(s.name) + (s.fullName && s.fullName !== s.name ? ' <span class="full-name">' + esc(s.fullName) + "</span>" : "") + "</span>" +
        '<span class="sum-last">' + esc(last) + "</span>" +
        '<span class="sum-st" id="ss-' + s.id + '">Not updated</span>' +
        '<svg class="icon chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></h3>' +
        '<div class="sum-body" id="sbody-' + s.id + '"' + (open ? "" : " hidden") + ">" + ED.siteBlock(s, c, { prefix: PREFIX, mode: "provider" }) + PR.fields(s, "pp-" + s.id) + "</div></div>";
    }).join("");
    $("jump").hidden = sites.length < 2;
    $("jump-list").innerHTML = sites.length < 2 ? "" : sites.map(function (s) {
      return '<li><a href="#sw-' + s.id + '" data-jump="' + s.id + '">' + esc(s.name) + ' <span class="jump-st" id="js-' + s.id + '">Not updated</span></a></li>';
    }).join("");
    $("tmpl").textContent = template(sites);
  }

  // ---------- collapsed facility blocks: status, jump list, open/close ----------
  var confirmed = {}, touched = {};
  function setOpen(id, open) {
    var b = $("sb-" + id); if (!b) return;
    b.setAttribute("aria-expanded", open);
    $("sbody-" + id).hidden = !open;
  }
  function statusOf(id) {
    var body = $("sbody-" + id), n = 0;
    Array.prototype.forEach.call(body.querySelectorAll(".site-edit .num-in, .site-edit select"), function (el) { if (el.value.trim()) n++; });
    var note = body.querySelector('.site-edit input[id$="-notes"]');
    var bits = [];
    if (confirmed[id] && confirmed[id].sig === countSig(id)) bits.push("Last counts confirmed");
    else if (n) bits.push(OB.plural(n, "count") + " entered");
    if (note && note.value.trim()) bits.push("note added");
    if (touched[id]) bits.push("details edited");
    return bits.length ? bits.join(" · ") : "Not updated";
  }
  function countSig(id) {
    return Array.prototype.map.call($("sbody-" + id).querySelectorAll(".site-edit .num-in, .site-edit select"), function (el) { return el.id + "=" + el.value.trim(); }).join("|");
  }
  function refreshStatus(id) {
    var t = statusOf(id), done = t !== "Not updated";
    [$("ss-" + id), $("js-" + id)].forEach(function (el) { if (el) { el.textContent = t; el.classList.toggle("done", done); } });
  }
  function reveal(el) {
    var w = el && el.closest(".site-wrap");
    if (w) setOpen(w.id.replace(/^sw-/, ""), true);
    var d = el && el.closest("details");
    if (d) d.open = true;
  }

  function addFacility() {
    var p = "nfac" + (facSeq++);
    facs.push(p);
    var wrap = document.createElement("section");
    wrap.className = "newfac";
    wrap.id = "w-" + p;
    wrap.setAttribute("aria-labelledby", "h-" + p);
    wrap.innerHTML = '<div class="newfac-h"><h3 id="h-' + p + '">New facility ' + facs.length + "</h3>" +
      (facs.length > 1 || $("org").value !== NEW ? '<button type="button" class="btn small" data-remove="' + p + '">Remove<span class="sr"> new facility ' + facs.length + "</span></button>" : "") + "</div>" + FAC.fields(p);
    $("new-facs").appendChild(wrap);
    $(p + "-name").focus();
  }
  function removeFacility(p) {
    facs = facs.filter(function (x) { return x !== p; });
    var w = $("w-" + p); if (w) w.remove();
    $("add-fac").focus();
  }

  // "No change": copy the last values into the inputs (still sent with the form) and say what was copied.
  function confirmLast(siteId) {
    var sec = document.querySelector('#sites [data-site="' + siteId + '"]');
    var copied = [];
    Array.prototype.forEach.call(sec.querySelectorAll(".num-in"), function (el) {
      if (el.placeholder && el.placeholder !== "—") { el.value = el.placeholder; el.removeAttribute("aria-invalid"); copied.push(el.getAttribute("aria-label").replace(/^[^,]+, /, "").replace(/ — open beds$/, "") + ": " + el.placeholder); }
    });
    confirmed[siteId] = { sig: countSig(siteId) };
    var msg = sec.querySelector(".copied");
    if (msg) msg.textContent = copied.length ? "Copied your last counts (" + copied.join("; ") + "). Send the form to confirm them." : "There were no counts to copy — enter them above.";
    refreshStatus(siteId);
  }

  function template(sites) {
    var list = sites.length ? sites : [S.sites.sites.filter(function (s) { return s.id === "gaiser"; })[0]];
    return "To: [Pathways bed alias — to be set up]\nSubject: Open beds\n\n" + list.map(function (s) {
      var lines = ["Site: " + s.name];
      s.beds.forEach(function (b) {
        if (b.type === "shared") lines.push("Detox or rehab: 0");
        else if (b.type === "outpatient") lines.push("Outpatient: yes");
        else b.sexes.forEach(function (sx) { lines.push(OB.TYPE_LABEL[b.type] + (sx === "any" ? "" : " " + sx) + ": 0"); });
      });
      lines.push("Notes: (optional)");
      return lines.join("\n");
    }).join("\n\n");
  }

  function submit(e) {
    e.preventDefault();
    var orgId = $("org").value, isNew = orgId === NEW, errs = [];
    $("form-err").hidden = true;
    if (!orgId) errs.push("Choose your organization.");
    var prov = isNew ? FAC.readProvider("np") : { errors: [] };
    errs = errs.concat(prov.errors);
    var entries = [], fieldErrors = 0;
    if (orgId && !isNew) orgSites(orgId).forEach(function (s) {
      var r = ED.readSite(s, { prefix: PREFIX });
      fieldErrors += r.errors.length;
      if (r.entry) entries.push(r.entry);
    });
    var profiles = [], profileErrors = [];
    if (orgId && !isNew) orgSites(orgId).forEach(function (s) {
      var pr = PR.read(s, "pp-" + s.id);
      profileErrors = profileErrors.concat(pr.errors);
      if (pr.changed) profiles.push({ site: s, pr: pr });
    });
    errs = errs.concat(profileErrors);
    var newFacs = facs.map(function (p) { return FAC.read(p); });
    var facErrors = newFacs.filter(function (f) { return f.errors.length; }).length;
    if (fieldErrors) errs.push("Fix the highlighted counts — use a number or NA.");
    if (facErrors) errs.push("Check the new facilit" + (facErrors === 1 ? "y" : "ies") + " — see the notes in red.");
    if (isNew && !facs.length) errs.push("Add at least one facility.");
    if (orgId && !isNew && !fieldErrors && !facErrors && !entries.length && !newFacs.length && !profiles.length) errs.push("Open a facility and enter its counts, confirm its last counts, or change its details.");
    if (!$("confirm").checked) errs.push("Confirm the counts are current.");
    if (errs.length) {
      $("form-err").textContent = errs.join(" ");
      $("form-err").hidden = false;
      var bad = document.querySelector('[aria-invalid="true"]') || document.querySelector('.profile-edit .err:not([hidden])') || document.querySelector(".newfac .err:not([hidden])");
      if (bad) { reveal(bad); (bad.tagName === "INPUT" ? bad : (bad.closest(".newfac") || bad.closest(".profile-edit")).querySelector("input")).focus(); }
      else if (!orgId) $("org").focus(); else if (isNew && prov.errors.length) $("np-orgname").focus(); else if (!$("confirm").checked) $("confirm").focus();
      return;
    }
    review({ orgId: orgId, isNew: isNew, prov: prov, entries: entries, profiles: profiles, newFacs: newFacs });
  }

  // Review step: list every change before anything reaches the board.
  function review(x) {
    var li = function (name, text) { return "<li><b>" + esc(name) + "</b> — " + text + "</li>"; };
    var counts = x.entries.map(function (e) {
      var same = confirmed[e.siteId] && confirmed[e.siteId].sig === countSig(e.siteId);
      return li(S.siteById[e.siteId].name, esc(OB.entrySummary(e)) + (same ? " <span class=\"help\">(no change — confirming)</span>" : "") + ((e.notes || []).length ? " · note: “" + esc(e.notes.join("; ")) + "”" : ""));
    }).join("");
    var skipped = x.isNew ? [] : orgSites(x.orgId).filter(function (s) { return !x.entries.some(function (e) { return e.siteId === s.id; }); }).map(function (s) { return s.name; });
    var details = x.profiles.map(function (p) {
      return "<li><b>" + esc(p.site.name) + "</b><ul>" + p.pr.changes.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></li>";
    }).join("");
    var facs = x.newFacs.map(function (f) { return li(f.data.name + ", " + f.data.town, esc(f.entry ? OB.entrySummary(f.entry) : "no counts yet")); }).join("");
    var html = '<div class="srcdlg-h"><div><p class="srcdlg-kind">Step 2 of 2</p><h2 id="rv-h">Check before you send</h2></div></div>' +
      (x.isNew ? "<p>New provider: <b>" + esc(x.prov.org.name) + "</b>. DHS checks it before it shows on the board.</p>" : "") +
      (counts ? '<h3 class="srcdlg-sub">Bed counts — show on the board right away</h3><ul class="srcdlg-took">' + counts + "</ul>" : "") +
      (skipped.length ? '<p class="help">Not changing: ' + esc(skipped.join(", ")) + ".</p>" : "") +
      (details ? '<h3 class="srcdlg-sub">Facility details</h3><ul class="srcdlg-took">' + details + "</ul>" : "") +
      (facs ? '<h3 class="srcdlg-sub">New facilities — DHS checks these first</h3><ul class="srcdlg-took">' + facs + "</ul>" : "") +
      '<div class="btnrow"><button type="button" class="btn primary" id="rv-send">Send to the bed board</button><button type="button" class="btn" data-close>Go back and edit</button></div>';
    var box = OB.openDialog(html, "rv-h");
    $("rv-send").focus();
    $("rv-send").addEventListener("click", function () { OB.closeDialog(); send(x); });
    void box;
  }

  function send(x) {
    var orgId = x.orgId, isNew = x.isNew, prov = x.prov, entries = x.entries, profiles = x.profiles, newFacs = x.newFacs;
    var role = $("who").value.trim();
    var orgName = isNew ? prov.org.short : S.orgById[orgId].short;
    var by = orgName + (role ? " — " + role : "");
    if (entries.length) S.submitForm({ orgId: orgId, entries: entries, by: by });
    profiles.forEach(function (x) { S.updateProfile({ siteId: x.site.id, fit: x.pr.fit, reach: x.pr.reach, changes: x.pr.changes, by: by, source: "form" }); });
    var names = entries.map(function (x) { return S.siteById[x.siteId].name; });
    var profNames = profiles.map(function (x) { return x.site.name; });

    var finish = function (added) {
      var parts = [];
      if (names.length) parts.push("<p>" + esc(OB.plural(names.length, "facility", "facilities")) + " updated on the board at " + esc(OB.timeOf(new Date())) + ": " + esc(names.join(", ")) + ".</p>");
      if (profNames.length) parts.push("<p>Facility details updated for " + esc(profNames.join(", ")) + ".</p>");
      if (added.length) parts.push("<p>" + (isNew ? "Your organization and " : "") + esc(OB.plural(added.length, "new facility", "new facilities")) + " (" + esc(added.join(", ")) + ") went to DHS to check. They’ll show on the board, with the counts you entered, once approved.</p>");
      $("done").innerHTML = "<h2>Thanks — " + (names.length || profNames.length ? "the bed board is updated." : "we have it.") + "</h2>" + parts.join("") +
        '<div class="btnrow"><a class="btn primary" href="index.html">See the bed board</a><button type="button" class="btn" id="again">Update again</button></div>';
      $("done").hidden = false;
      $("upd").hidden = true;
      $("done").focus();
      $("again").addEventListener("click", function () { $("done").hidden = true; $("upd").hidden = false; $("confirm").checked = false; renderOrgs(); renderSites(); });
    };
    if (!newFacs.length) { finish([]); return; }
    $("submit").disabled = true;
    $("submit").textContent = "Sending…";
    FAC.buildAll(newFacs, isNew ? prov.org.id : orgId, "form").then(function (built) {
      S.addSites({ org: isNew ? prov.org : null, sites: built, by: by, reason: "Added on the provider form", source: "form", review: true });
      $("submit").disabled = false;
      $("submit").textContent = "Review and send";
      finish(built.map(function (b) { return b.site.name; }));
    });
  }

  renderOrgs();
  renderSites();
  if (!$("who").value) $("who").value = OB.remembered("providerRole");
  $("who").addEventListener("change", function () { OB.remember("providerRole", $("who").value.trim()); });
  $("org").addEventListener("change", renderSites);
  $("upd").addEventListener("submit", submit);
  $("add-fac").addEventListener("click", addFacility);
  // Top-right button: add a facility for the chosen provider, or start a new provider.
  $("cta-add").addEventListener("click", function () {
    var orgId = $("org").value;
    if (orgId && orgId !== NEW) { addFacility(); $("w-" + facs[facs.length - 1]).scrollIntoView({ block: "start", behavior: "smooth" }); return; }
    if (orgId !== NEW) { $("org").value = NEW; renderSites(); }
    $("neworg").scrollIntoView({ block: "start", behavior: "smooth" });
    $("np-orgname").focus({ preventScroll: true });
  });
  $("upd").addEventListener("click", function (e) {
    var c = e.target.closest("[data-copy]"); if (c) confirmLast(c.getAttribute("data-copy"));
    var sb = e.target.closest(".sum-btn"); if (sb) { var id = sb.id.replace(/^sb-/, ""); setOpen(id, sb.getAttribute("aria-expanded") !== "true"); }
    var j = e.target.closest("[data-jump]");
    if (j) { e.preventDefault(); var jid = j.getAttribute("data-jump"); setOpen(jid, true); $("sw-" + jid).scrollIntoView({ block: "start", behavior: "smooth" }); $("sb-" + jid).focus({ preventScroll: true }); }
    var r = e.target.closest("[data-remove]"); if (r) removeFacility(r.getAttribute("data-remove"));
  });
  function onEdit(e) {
    if (e.target.removeAttribute) e.target.removeAttribute("aria-invalid");
    var w = e.target.closest && e.target.closest(".site-wrap");
    if (!w) return;
    var id = w.id.replace(/^sw-/, "");
    if (e.target.closest(".profile-edit")) touched[id] = true;
    refreshStatus(id);
  }
  $("upd").addEventListener("input", onEdit);
  $("upd").addEventListener("change", onEdit);
})();
