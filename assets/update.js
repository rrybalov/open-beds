/* Open Beds — provider update form. */
(function () {
  "use strict";
  var S = window.OpenBedsStore, OB = window.OB, ED = window.OpenBedsEditor, esc = OB.esc;
  function $(id) { return document.getElementById(id); }
  var PREFIX = "pf";

  function orgSites(orgId) { return S.sites.sites.filter(function (s) { return s.org === orgId; }); }

  function renderOrgs() {
    var params = new URLSearchParams(location.search);
    var want = params.get("org");
    $("org").innerHTML = '<option value="">Choose your organization</option>' + S.sites.orgs.map(function (o) {
      return '<option value="' + o.id + '"' + (o.id === want ? " selected" : "") + ">" + esc(o.name) + "</option>";
    }).join("");
  }

  function renderSites() {
    var orgId = $("org").value;
    if (!orgId) { $("sites").innerHTML = '<p class="hint">Choose your organization to see your sites.</p>'; $("tmpl").textContent = template([]); return; }
    var cur = S.current();
    var sites = orgSites(orgId);
    $("sites").innerHTML = sites.map(function (s) {
      var c = cur[s.id];
      return ED.siteBlock(s, c, { prefix: PREFIX, mode: "provider" }).replace("</section>",
        (c ? '<div class="btnrow"><button type="button" class="btn small" data-copy="' + s.id + '">Same as last update</button></div>' : "") + "</section>");
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (b) {
      b.addEventListener("click", function () { copyLast(b.getAttribute("data-copy")); });
    });
    $("tmpl").textContent = template(sites);
  }

  // Copy the last values into the inputs (provider still has to submit).
  function copyLast(siteId) {
    var c = S.current()[siteId];
    if (!c) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-site="' + siteId + '"] .num-in'), function (el) {
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
    var orgId = $("org").value, errs = [];
    $("form-err").hidden = true;
    if (!orgId) errs.push("Choose your organization.");
    var entries = [], fieldErrors = 0;
    orgSites(orgId).forEach(function (s) {
      var r = ED.readSite(s, { prefix: PREFIX });
      fieldErrors += r.errors.length;
      if (r.entry) entries.push(r.entry);
    });
    if (fieldErrors) errs.push("Fix the highlighted counts — use a number or NA.");
    if (orgId && !fieldErrors && !entries.length) errs.push("Enter counts for at least one site.");
    if (!$("confirm").checked) errs.push("Confirm the counts are current.");
    if (errs.length) {
      $("form-err").textContent = errs.join(" ");
      $("form-err").hidden = false;
      var bad = document.querySelector('[aria-invalid="true"]');
      if (bad) bad.focus(); else if (!orgId) $("org").focus(); else if (!$("confirm").checked) $("confirm").focus();
      return;
    }
    var role = $("who").value.trim();
    var org = S.orgById[orgId];
    S.submitForm({ orgId: orgId, entries: entries, by: org.short + (role ? " — " + role : "") });
    var names = entries.map(function (x) { return S.siteById[x.siteId].name; });
    $("done").innerHTML = "<h2>Thanks — the bed board is updated.</h2><p>" + esc(OB.plural(names.length, "site")) + " updated at " + esc(OB.timeOf(new Date())) + ": " + esc(names.join(", ")) +
      '.</p><div class="btnrow"><a class="btn primary" href="index.html">See the bed board</a><button type="button" class="btn" id="again">Update again</button></div>';
    $("done").hidden = false;
    $("upd").hidden = true;
    $("done").focus();
    $("again").addEventListener("click", function () { $("done").hidden = true; $("upd").hidden = false; $("confirm").checked = false; renderSites(); });
  }

  renderOrgs();
  renderSites();
  $("org").addEventListener("change", renderSites);
  $("upd").addEventListener("submit", submit);
  $("sites").addEventListener("input", function (e) { if (e.target.removeAttribute) e.target.removeAttribute("aria-invalid"); });
})();
