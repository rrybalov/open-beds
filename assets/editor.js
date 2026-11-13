/*
 * Open Beds — bed-count editor, shared by the provider form and the admin page.
 * One block per site, built from the site's profile layout (data/sites.js).
 *
 * Inputs accept a number (0–999) or NA. Blank means "no change for this bed".
 *   mode "provider": last values shown as grey placeholders, inputs start empty
 *   mode "admin":    inputs prefilled with the current values
 *
 * "Add a bed type or split by men / women" switches a block to every bed type (detox, residential,
 * PHP × men / women / sex not given, plus outpatient), keeping anything already typed. Counts
 * saved that way grow the site's layout in the store, so the extra rows stay next time.
 */
(function (root) {
  "use strict";
  var OB = root.OB, esc = OB.esc;
  var SEX_COL = { male: "Male", female: "Female", any: "Open beds" };

  var ALL_TYPES = ["detox", "residential", "php"];
  function fullLayout(site) {
    var out = (site.beds || []).filter(function (b) { return b.type === "shared"; });
    ALL_TYPES.forEach(function (t) { out.push({ type: t, sexes: ["male", "female", "any"] }); });
    out.push({ type: "outpatient", mode: "yesno" });
    return out;
  }
  function isFull(site, layout) {
    return ALL_TYPES.every(function (t) { return layout.some(function (b) { return b.type === t && b.sexes && b.sexes.length === 3; }); }) &&
      layout.some(function (b) { return b.type === "outpatient"; });
  }
  function layoutFor(site, p) {
    var notes = document.getElementById(p + "-" + site.id + "-notes");
    var sec = notes && notes.closest(".site-edit");
    return sec && sec.getAttribute("data-full") === "1" ? fullLayout(site) : site.beds;
  }

  function valStr(v) { return v === undefined || v === null ? "" : v === "na" ? "NA" : String(v); }

  function siteBlock(site, cur, opts) {
    var p = opts.prefix + "-" + site.id;
    var e = cur ? cur.entry : null;
    var counts = (e && e.counts) || {};
    var layout = opts.full ? fullLayout(site) : site.beds;
    var sexCols = [];
    layout.forEach(function (b) { (b.sexes || []).forEach(function (s) { if (sexCols.indexOf(s) < 0) sexCols.push(s); }); });
    if (!sexCols.length) sexCols = ["any"];
    sexCols.sort(function (a, b) { return ["male", "female", "any"].indexOf(a) - ["male", "female", "any"].indexOf(b); });

    var colName = function (s) { return s === "any" && sexCols.length > 1 ? "Sex not given" : SEX_COL[s]; };
    function input(id, label, v) {
      var pre = opts.mode === "admin" ? ' value="' + esc(valStr(v)) + '"' : "";
      var ph = opts.mode === "provider" && valStr(v) !== "" ? ' placeholder="' + esc(valStr(v)) + '"' : ' placeholder="—"';
      return '<input class="num-in" id="' + id + '" type="text" inputmode="numeric" autocomplete="off" maxlength="3" aria-label="' + esc(label) + '"' + pre + ph + ">";
    }

    var rows = "";
    layout.forEach(function (b) {
      if (b.type === "shared") {
        var sv = e && e.shared ? e.shared.open : undefined;
        rows += "<tr><th scope=\"row\">" + esc(OB.TYPE_LABEL.detox + " or rehab") + ' <span class="help">(one count)</span></th><td colspan="' + sexCols.length + '">' +
          input(p + "-shared", site.name + ", detox or rehab, open beds", sv) + "</td></tr>";
        return;
      }
      if (b.type === "outpatient") {
        var q = e && (e.qualitative || []).some(function (x) { return x.types.indexOf("outpatient") > -1; });
        var no = counts.outpatient && counts.outpatient.any === 0;
        var sel = opts.mode === "admin" ? (q ? "yes" : no ? "no" : "") : "";
        rows += '<tr><th scope="row">Outpatient</th><td colspan="' + sexCols.length + '"><select class="sel-in" id="' + p + '-outpatient" aria-label="' + esc(site.name) + ', accepting new outpatient clients">' +
          '<option value=""' + (sel === "" ? " selected" : "") + ">—</option><option value=\"yes\"" + (sel === "yes" ? " selected" : "") + ">Accepting new clients</option><option value=\"no\"" + (sel === "no" ? " selected" : "") + ">Not accepting</option></select></td></tr>";
        return;
      }
      rows += '<tr><th scope="row">' + esc(OB.TYPE_LABEL[b.type]) + "</th>" + sexCols.map(function (s) {
        if (b.sexes.indexOf(s) < 0) return "<td></td>";
        var v = counts[b.type] ? counts[b.type][s] : undefined;
        return "<td>" + input(p + "-" + b.type + "-" + s, site.name + ", " + OB.TYPE_LABEL[b.type] + ", " + colName(s).toLowerCase() + " — open beds", v) + "</td>";
      }).join("") + "</tr>";
    });

    var last = cur
      ? '<span class="last">Last update ' + esc(OB.when(cur.report.receivedAt).label) + " " + OB.sourceChip(cur.report.source) + "</span>"
      : '<span class="last">No update yet</span>';
    var noteVal = opts.mode === "admin" && e && e.notes ? e.notes.join("; ") : "";
    var canGrow = opts.expandable !== false && !opts.full && !isFull(site, layout);
    var grow = canGrow ? '<button type="button" class="linkbtn grow-btn" data-expand>Add a bed type or split by men / women<span class="sr"> at ' + esc(site.name) + "</span></button>" : "";
    var fullHint = opts.full && layout.some(function (b) { return b.type === "shared"; }) ? '<p class="help" style="margin:6px 0 0">Splitting detox and rehab now? Leave “Detox or rehab” blank and fill the separate rows.</p>' : "";
    var copy = opts.mode === "provider" && cur ? '<button type="button" class="btn small" data-copy="' + esc(site.id) + '">Same as last update</button>' : "";
    return '<section class="site-edit" data-site="' + esc(site.id) + '" data-prefix="' + esc(opts.prefix) + '" data-mode="' + esc(opts.mode) + '" data-full="' + (opts.full ? "1" : "0") + '"><div class="site-edit-h"><h3>' + esc(site.name) +
      (site.fullName && site.fullName !== site.name ? ' <span class="full-name">' + esc(site.fullName) + "</span>" : "") + "</h3>" + last + "</div>" +
      '<table class="bedtbl"><thead><tr><th scope="col">Bed type</th>' + sexCols.map(function (s) { return '<th scope="col">' + colName(s) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows + "</tbody></table>" + fullHint +
      (grow || copy ? '<div class="site-edit-acts">' + grow + copy + "</div>" : "") +
      '<div class="field" style="margin:10px 0 0"><label class="lbl" for="' + p + '-notes">Note for intake staff <span class="help">(optional)</span></label>' +
      '<input class="input wide" id="' + p + '-notes" type="text" maxlength="160" placeholder="e.g. 2 discharges expected this afternoon" value="' + esc(noteVal) + '"></div>' +
      '<div class="err" id="' + p + '-err" role="alert" hidden></div></section>';
  }

  // Returns { entry | null (nothing entered), errors: [] }
  function readSite(site, opts) {
    var p = opts.prefix + "-" + site.id;
    var entry = { siteId: site.id, counts: {}, notes: [], flags: [] };
    var any = false, errors = [];
    var layout = layoutFor(site, opts.prefix);
    function parse(el) {
      var raw = el.value.trim();
      el.removeAttribute("aria-invalid");
      if (raw === "") return undefined;
      if (/^na$/i.test(raw)) return "na";
      if (/^\d{1,3}$/.test(raw)) return parseInt(raw, 10);
      el.setAttribute("aria-invalid", "true");
      errors.push(el.getAttribute("aria-label") + ": enter a number or NA");
      return undefined;
    }
    layout.forEach(function (b) {
      if (b.type === "shared") {
        var v = parse(document.getElementById(p + "-shared"));
        if (typeof v === "number") { entry.shared = { open: v, types: b.covers, label: b.label }; any = true; }
        return;
      }
      if (b.type === "outpatient") {
        var s = document.getElementById(p + "-outpatient").value;
        if (s === "yes") { entry.qualitative = [{ types: ["outpatient"], label: "Accepting outpatient clients" }]; any = true; }
        else if (s === "no") { entry.counts.outpatient = { any: 0 }; any = true; }
        return;
      }
      b.sexes.forEach(function (sx) {
        var el = document.getElementById(p + "-" + b.type + "-" + sx);
        var v = parse(el);
        if (v === undefined) return;
        (entry.counts[b.type] = entry.counts[b.type] || {})[sx] = v;
        any = true;
      });
    });
    var note = document.getElementById(p + "-notes").value.trim();
    if (note) entry.notes.push(note);
    var errEl = document.getElementById(p + "-err");
    errEl.hidden = !errors.length;
    errEl.textContent = errors.join(". ");
    return { entry: any ? entry : null, errors: errors };
  }

  // Expand a block to every bed type, keeping typed values.
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest("[data-expand]");
    if (!btn) return;
    var sec = btn.closest(".site-edit"), S = root.OpenBedsStore;
    var site = S.siteById[sec.getAttribute("data-site")];
    var kept = {};
    Array.prototype.forEach.call(sec.querySelectorAll("input, select"), function (el) { kept[el.id] = el.value; });
    var cur = S.current()[site.id];
    var tmp = document.createElement("div");
    tmp.innerHTML = siteBlock(site, cur, { prefix: sec.getAttribute("data-prefix"), mode: sec.getAttribute("data-mode"), full: true });
    var fresh = tmp.firstChild;
    sec.parentNode.replaceChild(fresh, sec);
    var firstNew = null;
    Array.prototype.forEach.call(fresh.querySelectorAll("input, select"), function (el) {
      if (Object.prototype.hasOwnProperty.call(kept, el.id)) el.value = kept[el.id];
      else if (!firstNew && el.classList.contains("num-in")) firstNew = el;
    });
    (firstNew || fresh.querySelector("input")).focus();
  });

  root.OpenBedsEditor = { siteBlock: siteBlock, readSite: readSite, fullLayout: fullLayout };
})(window);
