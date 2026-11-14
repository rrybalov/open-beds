/* Open Beds — helpers shared by the board, provider form and admin pages. */
(function (root) {
  "use strict";
  var TZ = "America/New_York";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function dayKey(d) { return d.toLocaleDateString("en-US", { timeZone: TZ }); }
  function timeOf(d) { return d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }); }

  // "Today 9:55 AM" / "Yesterday 9:57 AM" / "Nov 2 9:57 AM", plus a freshness level by age.
  function when(iso) {
    var d = new Date(iso), now = new Date();
    var hours = (now - d) / 36e5;
    var label;
    if (dayKey(d) === dayKey(now)) label = "Today " + timeOf(d);
    else if (dayKey(d) === dayKey(new Date(now - 864e5))) label = "Yesterday " + timeOf(d);
    else label = d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" }) + " " + timeOf(d);
    var level = hours < 24 ? "fresh" : hours < 48 ? "aging" : "stale";
    var age = hours < 1 ? Math.max(1, Math.round(hours * 60)) + " min ago" : Math.round(hours) + " h ago";
    return { label: label, level: level, age: age, hours: hours, date: d };
  }

  var SOURCE = {
    email: { label: "Email", long: "Provider email" },
    form: { label: "Provider form", long: "Provider update form" },
    admin: { label: "DHS update", long: "Updated by DHS staff" },
    referral: { label: "Referral", long: "Referral marked by Pathways" }
  };
  var ICON = {
    email: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    form: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    admin: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6Z"/></svg>',
    referral: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path d="M5 12h12M13 6l6 6-6 6"/></svg>'
  };
  // How the board says where a count came from, as plain text.
  function sourceText(report, S) {
    var org = report.orgId && S && S.orgById[report.orgId] ? S.orgById[report.orgId].short : "the provider";
    if (report.source === "email") return "from " + org + "’s email";
    if (report.source === "form") return "on " + org + "’s update form";
    if (report.source === "admin") return "by DHS staff" + (report.by && report.by.indexOf(": ") > -1 ? " (" + report.by.split(": ")[1] + ")" : "");
    return "";
  }
  // With a report id the chip is a button that opens the source (the email itself, the form submission, or the DHS edit).
  function sourceChip(source, reportId, siteId) {
    var s = SOURCE[source] || { label: source };
    if (!reportId) return '<span class="src-chip src-' + esc(source) + '">' + (ICON[source] || "") + esc(s.label) + "</span>";
    return '<button type="button" class="src-chip src-' + esc(source) + '" data-report="' + esc(reportId) + '"' + (siteId ? ' data-site="' + esc(siteId) + '"' : "") +
      ' aria-haspopup="dialog">' + (ICON[source] || "") + esc(s.label) + '<span class="sr"> — view source</span></button>';
  }
  var VIEW_LABEL = { email: "View the source email", form: "View the form submission", admin: "View the DHS update" };
  function sourceLink(source, reportId, siteId) {
    return '<button type="button" class="linkbtn" data-report="' + esc(reportId) + '"' + (siteId ? ' data-site="' + esc(siteId) + '"' : "") + ' aria-haspopup="dialog">' + esc(VIEW_LABEL[source] || "View source") + "</button>";
  }

  // ---------- source viewer ----------
  var BED_WORDS = /(beds?|available|open|cap\b|rehab|detox|residential|php|male|female|census)/i;
  function siteWords(site) {
    if (!site) return [];
    return (site.aliases || []).concat([site.name]).map(function (a) { return a.toLowerCase(); }).sort(function (a, b) { return b.length - a.length; });
  }
  // Highlight the sentences the parser read for this site.
  function highlightBody(body, site, single) {
    var words = siteWords(site);
    var lines = String(body || "").split("\n");
    return lines.map(function (line, i) {
      var parts = line.split(/(?<=[.!?])\s+/);
      return parts.map(function (seg) {
        var low = seg.toLowerCase();
        var hit = words.some(function (w) { return new RegExp("(^|[^a-z])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z])").test(low) && (/\d/.test(seg) || BED_WORDS.test(seg)); });
        if (!hit && single && /\b\d+\b/.test(seg) && !/\b(19|20)\d{2}\b/.test(seg) && !/^\s*(from|sent|subject):/i.test(seg)) {
          hit = BED_WORDS.test(seg) || BED_WORDS.test(lines[i - 1] || "") || BED_WORDS.test(lines[i + 1] || "");
        }
        return hit ? "<mark>" + esc(seg) + "</mark>" : esc(seg);
      }).join(" ");
    }).join("\n");
  }

  // Keep keyboard focus on the same control when a page re-renders (WCAG 2.4.3 / 3.2.1).
  var FOCUS_ATTRS = ["data-refer", "data-report", "data-site", "data-undo", "data-sel", "data-pin", "data-act", "data-id", "data-fix", "data-type", "data-loc", "data-org", "data-copy", "data-expand", "data-remove", "data-profile"];
  function focusKey(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (el.id) return "#" + CSS.escape(el.id);
    var base = el.tagName.toLowerCase(), sel = base;
    FOCUS_ATTRS.forEach(function (a) { if (el.hasAttribute(a)) sel += "[" + a + '="' + CSS.escape(el.getAttribute(a)) + '"]'; });
    return sel === base ? null : sel;
  }
  function keepFocus(fn) {
    var key = focusKey(document.activeElement);
    fn();
    if (!key) return;
    var n = document.querySelector(key);
    if (n && n !== document.activeElement) n.focus({ preventScroll: true });
  }
  // While a modal is open, everything behind it is inert, so Tab stays inside (WCAG 2.4.3).
  function setBehindInert(on) {
    Array.prototype.forEach.call(document.querySelectorAll(".hub, .skip"), function (el) { el.inert = !!on; });
  }
  function remembered(key) { try { return localStorage.getItem("openbeds." + key) || ""; } catch (e) { return ""; } }
  function remember(key, v) { try { localStorage.setItem("openbeds." + key, v); } catch (e) { /* ignore */ } }

  var dlg = null, returnFocus = null;
  // Shared modal for pages without their own (board): OB.openDialog(html) / OB.closeDialog().
  function openDialog(html, label) {
    returnFocus = document.activeElement;
    ensureDialog();
    dlg.firstChild.setAttribute("aria-labelledby", label || "srcdlg-h");
    dlg.firstChild.innerHTML = html;
    dlg.hidden = false;
    setBehindInert(true);
    var first = dlg.firstChild.querySelector("input:checked, input, select, button");
    if (first) first.focus();
    return dlg.firstChild;
  }
  function ensureDialog() {
    if (dlg) return dlg;
    var wrap = document.createElement("div");
    wrap.className = "dialog-wrap";
    wrap.hidden = true;
    wrap.innerHTML = '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="srcdlg-h"></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) { if (e.target === wrap || e.target.closest("[data-close]")) closeSource(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !wrap.hidden) closeSource(); });
    dlg = wrap;
    return dlg;
  }
  function closeSource() { dlg.hidden = true; dlg.firstChild.innerHTML = ""; setBehindInert(false); if (returnFocus && returnFocus.isConnected) returnFocus.focus(); }

  function openSource(report, siteId, S) {
    var site = siteId ? S.siteById[siteId] : null;
    var org = report.orgId && S.orgById[report.orgId] ? S.orgById[report.orgId].short : "Unknown sender";
    var f = when(report.receivedAt);
    var title = report.source === "email" ? "Email from " + org : report.source === "form" ? "Provider form — " + org :
      report.source === "referral" ? "Referral to " + (S.siteById[report.referral.siteId] || { name: "a site" }).name : "DHS update — " + (site ? site.name : org);
    var meta = [];
    if (report.source === "email") {
      meta.push(["From", esc(report.email.from)], ["Subject", esc(report.email.subject)]);
      meta.push(["Received", esc(f.label) + " (" + esc(f.age) + ")"]);
      if (report.email.originalSent) meta.push(["Original", esc(new Date(report.email.originalSent).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })) + ' <span class="conf">— the demo re-times sample emails to today</span>']);
      if (report.parse) meta.push(["Read as", esc(report.parse.template) + " layout · confidence " + esc(report.parse.confidence)]);
    } else {
      meta.push(["By", esc(report.by)], ["Received", esc(f.label) + " (" + esc(f.age) + ")"]);
      if (report.reason) meta.push(["Reason", "“" + esc(report.reason) + "”"]);
    }
    if (report.decidedBy && report.source === "email") meta.push(["Published", esc(report.decidedBy) + (report.decidedAt ? ", " + esc(when(report.decidedAt).label) : "")]);
    var entries = report.entries.slice().sort(function (a, b) { return (b.siteId === siteId) - (a.siteId === siteId); });
    if (report.source === "referral") {
      var rf = report.referral;
      entries = [];
      meta.push(["Status", report.status === "undone" ? "Undone" + (report.decidedBy ? " by " + esc(report.decidedBy) : "") : "Counted on the board until the provider’s next update"]);
      var tookRef = "<li><b>" + esc((S.siteById[rf.siteId] || { name: rf.siteId }).name) + "</b> — one " + esc(rf.type === "shared" ? "detox or rehab" : TYPE_LABEL[rf.type].toLowerCase()) + " bed" +
        (rf.sex === "male" ? " (men)" : rf.sex === "female" ? " (women)" : "") + " taken off the count</li>";
    }
    var took = (tookRef || "") + entries.map(function (e) {
      var name = e.siteId && S.siteById[e.siteId] ? S.siteById[e.siteId].name : "Unassigned";
      var mine = e.siteId === siteId;
      return "<li" + (mine ? ' class="mine"' : "") + "><b>" + esc(name) + "</b> — " + esc(entrySummary(e)) + ((e.notes || []).length ? " · " + esc(e.notes.join("; ")) : "") + "</li>";
    }).join("");
    var warns = report.parse ? (report.parse.warnings || []).map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") : "";
    var body = report.source === "email"
      ? '<h3 class="srcdlg-sub">The email</h3><pre class="mailbody">' + highlightBody(report.email.body, site, report.entries.length === 1) + "</pre>" +
        (site ? '<p class="conf">Highlighted: the lines the board read for ' + esc(site.name) + ".</p>" : "")
      : "";
    var html = '<div class="srcdlg-h"><div><p class="srcdlg-kind">' + (ICON[report.source] || "") + esc((SOURCE[report.source] || {}).long || "") + '</p><h2 id="srcdlg-h">' + esc(title) + '</h2></div><button type="button" class="btn small" data-close>Close</button></div>' +
      '<dl class="srcdlg-meta">' + meta.map(function (m) { return "<dt>" + m[0] + "</dt><dd>" + m[1] + "</dd>"; }).join("") + "</dl>" +
      '<h3 class="srcdlg-sub">What the board took from it</h3><ul class="srcdlg-took">' + took + "</ul>" +
      (warns ? '<h3 class="srcdlg-sub">Parser warnings</h3><ul class="srcdlg-took">' + warns + "</ul>" : "") + body;
    openDialog(html);
    dlg.querySelector("[data-close]").focus();
  }

  // Tab and Shift+Tab cycle inside an open modal dialog (WCAG 2.4.3).
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var wrap = document.querySelector(".dialog-wrap:not([hidden])");
    if (!wrap) return;
    var box = wrap.querySelector(".dialog");
    var items = Array.prototype.filter.call(box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'), function (el) {
      return el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && !(el.type === "radio" && !el.checked && box.querySelector('input[type=radio][name="' + el.name + '"]:checked'));
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1], cur = document.activeElement;
    if (!box.contains(cur)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && (cur === first || cur === box)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
  });

  // Any [data-report] button on any page opens its source.
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-report]");
    var S = root.OpenBedsStore;
    if (!b || !S) return;
    var id = b.getAttribute("data-report");
    var r = S.reports().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    openSource(r, b.getAttribute("data-site"), S);
  });

  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }

  var TYPE_LABEL = { detox: "Detox", residential: "Residential", php: "PHP", outpatient: "Outpatient", shared: "Detox or rehab" };
  var SEX_LABEL = { male: "Men", female: "Women", any: "All" };

  // Short text summary of one entry: "Detox 6 M · 3 F; Residential 0 M · 4 F"
  // Toast with an optional Undo: OB.toast(message, onUndo). Esc or × dismisses it; it stays 12 seconds.
  var toastTimer = null, toastUndo = null;
  function toast(msg, onUndo) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    toastUndo = onUndo || null;
    t.innerHTML = "<span>" + esc(msg) + "</span>" + (onUndo ? '<button type="button" class="linkbtn toast-undo">Undo</button>' : "") +
      '<button type="button" class="toast-x" aria-label="Dismiss message"><svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    t.hidden = false;
    // Focused controls scroll clear of the toast while it shows (WCAG 2.4.11).
    document.documentElement.style.scrollPaddingBottom = "96px";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 12000);
  }
  function hideToast() {
    var t = document.getElementById("toast");
    if (t) t.hidden = true;
    toastUndo = null;
    document.documentElement.style.scrollPaddingBottom = "";
  }
  document.addEventListener("keydown", function (e) { var t = document.getElementById("toast"); if (e.key === "Escape" && t && !t.hidden && !document.querySelector(".dialog-wrap:not([hidden])")) hideToast(); });
  document.addEventListener("click", function (e) {
    if (e.target.closest(".toast-x")) { hideToast(); return; }
    if (e.target.closest(".toast-undo") && toastUndo) {
      var fn = toastUndo; hideToast(); fn();
      var x = document.querySelector("#toast:not([hidden]) .toast-x"); if (x) x.focus();
    }
  });

  function entrySummary(e) {
    var parts = [];
    Object.keys(e.counts || {}).forEach(function (t) {
      var c = e.counts[t];
      var keys = Object.keys(c);
      var sx = keys.map(function (k) { var v = c[k] === "na" ? "NA" : c[k]; return k === "male" ? "men " + v : k === "female" ? "women " + v : keys.length > 1 ? "sex not given " + v : String(v); });
      parts.push((TYPE_LABEL[t] || t) + " " + sx.join(" · "));
    });
    if (e.shared) parts.push(e.shared.open + " " + (e.shared.label || "detox or rehab"));
    (e.qualitative || []).forEach(function (q) { parts.push(q.label); });
    return parts.join("; ") || "No counts";
  }

  root.OB = { esc: esc, when: when, timeOf: timeOf, sourceChip: sourceChip, sourceLink: sourceLink, sourceText: sourceText, openDialog: openDialog, keepFocus: keepFocus, setBehindInert: setBehindInert, remembered: remembered, remember: remember, closeDialog: function () { if (dlg) closeSource(); }, SOURCE: SOURCE, ICON: ICON, plural: plural, TYPE_LABEL: TYPE_LABEL, SEX_LABEL: SEX_LABEL, entrySummary: entrySummary, toast: toast, hideToast: hideToast, TZ: TZ };
})(window);
