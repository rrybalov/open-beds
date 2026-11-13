/* Open Beds — provider update form: counts for listed sites, plus new providers and facilities (held for DHS review). */
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
    facs = []; $("new-facs").innerHTML = "";
    if (isNew) addFacility();
    if (!orgId) { $("sites").innerHTML = ""; $("org-hint").hidden = false; $("tmpl").textContent = template([]); return; }
    $("org-hint").hidden = true;
    if (isNew) { $("tmpl").textContent = template([]); return; }
    var cur = S.current({ adjusted: true });
    var sites = orgSites(orgId);
    $("sites").innerHTML = sites.map(function (s) {
      var c = cur[s.id];
      return '<div class="site-wrap">' + ED.siteBlock(s, c, { prefix: PREFIX, mode: "provider" }) + PR.fields(s, "pp-" + s.id) + "</div>";
    }).join("");
    $("tmpl").textContent = template(sites);
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

  // Copy the last values into the inputs (provider still has to submit).
  function copyLast(siteId) {
    Array.prototype.forEach.call(document.querySelectorAll('#sites [data-site="' + siteId + '"] .num-in'), function (el) {
      if (el.placeholder && el.placeholder !== "—") el.value = el.placeholder;
    });
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
    if (orgId && !isNew && !fieldErrors && !facErrors && !entries.length && !newFacs.length && !profiles.length) errs.push("Enter counts for at least one site, or change its details.");
    if (!$("confirm").checked) errs.push("Confirm the counts are current.");
    if (errs.length) {
      $("form-err").textContent = errs.join(" ");
      $("form-err").hidden = false;
      var bad = document.querySelector('[aria-invalid="true"]') || document.querySelector(".newfac .err:not([hidden])");
      if (bad) (bad.tagName === "INPUT" ? bad : bad.closest(".newfac").querySelector("input")).focus();
      else if (!orgId) $("org").focus(); else if (isNew && prov.errors.length) $("np-orgname").focus(); else if (!$("confirm").checked) $("confirm").focus();
      return;
    }
    var role = $("who").value.trim();
    var orgName = isNew ? prov.org.short : S.orgById[orgId].short;
    var by = orgName + (role ? " — " + role : "");
    if (entries.length) S.submitForm({ orgId: orgId, entries: entries, by: by });
    profiles.forEach(function (x) { S.updateProfile({ siteId: x.site.id, fit: x.pr.fit, reach: x.pr.reach, changes: x.pr.changes, by: by, source: "form" }); });
    var names = entries.map(function (x) { return S.siteById[x.siteId].name; });
    var profNames = profiles.map(function (x) { return x.site.name; });

    var finish = function (added) {
      var parts = [];
      if (names.length) parts.push("<p>" + esc(OB.plural(names.length, "site")) + " updated on the board at " + esc(OB.timeOf(new Date())) + ": " + esc(names.join(", ")) + ".</p>");
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
      $("submit").textContent = "Update the bed board";
      finish(built.map(function (b) { return b.site.name; }));
    });
  }

  renderOrgs();
  renderSites();
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
    var c = e.target.closest("[data-copy]"); if (c) copyLast(c.getAttribute("data-copy"));
    var r = e.target.closest("[data-remove]"); if (r) removeFacility(r.getAttribute("data-remove"));
  });
  $("upd").addEventListener("input", function (e) { if (e.target.removeAttribute) e.target.removeAttribute("aria-invalid"); });
})();
