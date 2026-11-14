/*
 * Open Beds — facility details editor, shared by the provider form and the admin page.
 * Lets a provider (or DHS) keep a facility's profile current: levels of care, who they take
 * and don't, what they need before admission, situation-specific context, payment, contact.
 *
 *   OpenBedsProfile.fields(site, prefix, {open})  → HTML (a <details> panel)
 *   OpenBedsProfile.read(site, prefix)            → { fit, reach, changes: [plain-English lines], errors }
 *   OpenBedsProfile.TOPICS                        → situation topics shown on the board
 */
(function (root) {
  "use strict";
  var OB = root.OB, S = root.OpenBedsStore, esc = OB.esc;
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value.trim() : ""; }
  function lines(id) { return val(id) ? val(id).split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean) : []; }

  // Situations intake asks about. Text the provider writes shows on the board under "Who they take".
  var TOPICS = [
    ["pregnancy", "Pregnancy", "e.g. Accepts pregnant women; must be under 28 weeks"],
    ["moud", "MOUD (methadone, buprenorphine)", "e.g. Continues buprenorphine; no methadone induction"],
    ["medical", "Medical needs", "e.g. No IV antibiotics; wound care OK"],
    ["legal", "Legal history", "e.g. No arson or sex offense convictions"]
  ];
  var PAY_CHOICES = [["", "Not sure"], ["yes", "Yes"], ["no", "No"]];

  function area(id, label, help, value, placeholder) {
    return '<div class="field"><label class="lbl" for="' + id + '">' + esc(label) + (help ? ' <span class="help">' + esc(help) + "</span>" : "") + "</label>" +
      '<textarea id="' + id + '" class="input wide" rows="2"' + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : "") + ">" + esc(value || "") + "</textarea></div>";
  }
  function text(id, label, help, value, type, placeholder) {
    return '<div class="field"><label class="lbl" for="' + id + '">' + esc(label) + (help ? ' <span class="help">' + esc(help) + "</span>" : "") + "</label>" +
      '<input id="' + id + '" class="input wide" type="' + (type || "text") + '" autocomplete="off" value="' + esc(value || "") + '"' + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : "") + "></div>";
  }

  function fields(site, p, opts) {
    opts = opts || {};
    var h = "h" + (opts.h || 4);
    var f = site.fit || {}, r = site.reach || {}, pol = f.policies || {}, pay = f.pay || {};
    var lv = S.sites.levels.map(function (l) {
      return '<label class="check"><input type="checkbox" name="' + p + '-lv" value="' + esc(l[0]) + '"' + ((f.levels || []).indexOf(l[0]) > -1 ? " checked" : "") + "> " + esc(l[1]) + ' <span class="help">' + esc(l[2]) + "</span></label>";
    }).join("");
    var payRows = S.sites.payTypes.map(function (t) {
      var cur = pay[t[0]] === true ? "yes" : pay[t[0]] === false ? "no" : "";
      return '<div class="field pay-field"><label class="lbl" for="' + p + "-pay-" + t[0] + '">' + esc(t[1]) + '</label><select id="' + p + "-pay-" + t[0] + '" class="sel-in">' +
        PAY_CHOICES.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === cur ? " selected" : "") + ">" + c[1] + "</option>"; }).join("") + "</select></div>";
    }).join("");
    return '<details class="profile-edit"' + (opts.open ? " open" : "") + ' data-profile="' + esc(site.id) + '">' +
      "<summary>Facility details <span class=\"help\">— levels of care, who you take, payment, contact</span></summary>" +
      '<p class="hint">Pathways uses these to decide who to send you. Changes show on the bed board when you submit.</p>' +
      '<' + h + ' class="form-sub">Levels of care</' + h + '>' +
      '<fieldset class="lv-grid"><legend class="sr">LOCA levels accepted at ' + esc(site.name) + "</legend>" + lv + "</fieldset>" +
      text(p + "-lvnote", "Anything to add about levels?", "(optional)", f.levelsNote, "text", "e.g. 3.7 only for men") +
      '<' + h + ' class="form-sub">Who you take</' + h + '>' +
      '<div class="row2">' + text(p + "-serves", "Who you serve", "", f.serves, "text", "e.g. Adult men 18+") +
      area(p + "-takes", "Also takes or specializes in", "(one per line)", (f.takes || []).join("\n"), "e.g. Co-occurring mental health") + "</div>" +
      '<div class="row2">' + area(p + "-excl", "Won’t take", "(one per line)", (f.excludes || []).join("\n"), "e.g. Active suicidal ideation") +
      area(p + "-req", "Needed before admission", "(one per line)", (f.requires || []).join("\n"), "e.g. Negative TB test") + "</div>" +
      '<' + h + ' class="form-sub">Specific situations</' + h + '><p class="help" style="margin:-4px 0 8px">Intake asks about these on most calls. Leave blank if it depends — staff will ask.</p>' +
      '<div class="row2">' + TOPICS.map(function (t) { return text(p + "-pol-" + t[0], t[1], "", pol[t[0]], "text", t[2]); }).join("") + "</div>" +
      '<' + h + ' class="form-sub">Payment</' + h + '><div class="pay-grid">' + payRows + "</div>" +
      text(p + "-payer", "Payment notes", "(optional)", f.payer, "text", "e.g. Pre-certification handled by us") +
      area(p + "-notes", "Admissions notes", "(one per line)", (f.notes || []).join("\n"), "e.g. Admissions until 9 PM; call ahead after 5") +
      '<' + h + ' class="form-sub">Admissions contact</' + h + '>' +
      text(p + "-address", "Street address", "", r.address, "text", "e.g. 1375 Newark Rd, Kennett Square, PA 19348") +
      '<div class="row3">' + text(p + "-phone", "Phone", "", r.phone, "tel") + text(p + "-email", "Intake email", "", r.email, "email") + text(p + "-web", "Website", "", r.web, "url", "https://") + "</div>" +
      '<div class="err" id="' + p + '-perr" role="alert" hidden></div></details>';
  }

  function same(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }
  function listDiff(label, a, b, out) {
    a = a || []; b = b || [];
    var add = b.filter(function (x) { return a.indexOf(x) < 0; }), rem = a.filter(function (x) { return b.indexOf(x) < 0; });
    if (!add.length && !rem.length) return;
    out.push(label + ": " + [add.length ? "added " + add.map(function (x) { return "“" + x + "”"; }).join(", ") : "", rem.length ? "removed " + rem.map(function (x) { return "“" + x + "”"; }).join(", ") : ""].filter(Boolean).join("; "));
  }
  function textDiff(label, a, b, out) {
    if ((a || "") === (b || "")) return;
    out.push(label + ": " + (b ? "“" + b + "”" : "cleared") + (a ? " (was “" + a + "”)" : ""));
  }

  function read(site, p) {
    var f0 = site.fit || {}, r0 = site.reach || {}, errors = [];
    var levels = Array.prototype.map.call(document.querySelectorAll('input[name="' + p + '-lv"]:checked'), function (x) { return x.value; });
    var pol = {}, pay = {};
    TOPICS.forEach(function (t) { if (val(p + "-pol-" + t[0])) pol[t[0]] = val(p + "-pol-" + t[0]); });
    S.sites.payTypes.forEach(function (t) { var v = $(p + "-pay-" + t[0]).value; if (v) pay[t[0]] = v === "yes"; });
    if (val(p + "-email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val(p + "-email"))) errors.push(site.name + ": check the intake email.");
    var fit = Object.assign({}, f0, {
      levels: levels, levelsNote: val(p + "-lvnote") || undefined, serves: val(p + "-serves") || undefined,
      takes: lines(p + "-takes"), excludes: lines(p + "-excl"), requires: lines(p + "-req"), notes: lines(p + "-notes"),
      policies: pol, pay: pay, payer: val(p + "-payer") || undefined
    });
    // Topics with an answer count as "on file" on the board.
    fit.known = (f0.known || []).slice();
    TOPICS.forEach(function (t) { if (pol[t[0]] && fit.known.indexOf(t[0]) < 0) fit.known.push(t[0]); });
    var reach = Object.assign({}, r0, { address: val(p + "-address") || null, phone: val(p + "-phone") || null, email: val(p + "-email") || null, web: val(p + "-web") || null });
    if (reach.phone !== r0.phone) reach.phoneFrom = reach.phone ? "updated by the provider" : null;
    if (reach.email !== r0.email) reach.emailFrom = reach.email ? "updated by the provider" : null;

    var ch = [];
    var LV = {}; S.sites.levels.forEach(function (l) { LV[l[0]] = l[1]; });
    listDiff("Levels of care", (f0.levels || []).map(function (c) { return LV[c]; }), levels.map(function (c) { return LV[c]; }), ch);
    textDiff("Levels note", f0.levelsNote, fit.levelsNote, ch);
    textDiff("Serves", f0.serves, fit.serves, ch);
    listDiff("Also takes", f0.takes, fit.takes, ch);
    listDiff("Won’t take", f0.excludes, fit.excludes, ch);
    listDiff("Needed before admission", f0.requires, fit.requires, ch);
    TOPICS.forEach(function (t) { textDiff(t[1], (f0.policies || {})[t[0]], pol[t[0]], ch); });
    S.sites.payTypes.forEach(function (t) {
      var a = (f0.pay || {})[t[0]], b = pay[t[0]];
      if (a !== b) ch.push(t[1] + ": " + (b === true ? "yes" : b === false ? "no" : "not sure") + (a !== undefined ? " (was " + (a ? "yes" : "no") + ")" : ""));
    });
    textDiff("Payment notes", f0.payer, fit.payer, ch);
    listDiff("Admissions notes", f0.notes, fit.notes, ch);
    textDiff("Address", r0.address, reach.address, ch);
    textDiff("Phone", r0.phone, reach.phone, ch);
    textDiff("Intake email", r0.email, reach.email, ch);
    textDiff("Website", r0.web, reach.web, ch);
    var e = $(p + "-perr");
    if (e) { e.textContent = errors.join(" "); e.hidden = !errors.length; }
    return { fit: fit, reach: reach, changes: ch, errors: errors, changed: ch.length > 0 };
  }

  root.OpenBedsProfile = { fields: fields, read: read, TOPICS: TOPICS, same: same };
})(window);
