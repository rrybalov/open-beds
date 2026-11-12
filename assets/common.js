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
    admin: { label: "DHS update", long: "Updated by DHS staff" }
  };
  var ICON = {
    email: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    form: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    admin: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6Z"/></svg>'
  };
  function sourceChip(source) {
    var s = SOURCE[source] || { label: source };
    return '<span class="src-chip src-' + esc(source) + '">' + (ICON[source] || "") + esc(s.label) + "</span>";
  }

  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }

  var TYPE_LABEL = { detox: "Detox", residential: "Residential", php: "PHP", outpatient: "Outpatient", shared: "Detox or rehab" };
  var SEX_LABEL = { male: "Male", female: "Female", any: "All" };

  // Short text summary of one entry: "Detox 6 M · 3 F; Residential 0 M · 4 F"
  function entrySummary(e) {
    var parts = [];
    Object.keys(e.counts || {}).forEach(function (t) {
      var c = e.counts[t];
      var sx = Object.keys(c).map(function (k) { var v = c[k] === "na" ? "NA" : c[k]; return k === "any" ? String(v) : v + " " + k.charAt(0).toUpperCase(); });
      parts.push((TYPE_LABEL[t] || t) + " " + sx.join(" · "));
    });
    if (e.shared) parts.push(e.shared.open + " " + (e.shared.label || "detox or rehab"));
    (e.qualitative || []).forEach(function (q) { parts.push(q.label); });
    return parts.join("; ") || "No counts";
  }

  root.OB = { esc: esc, when: when, timeOf: timeOf, sourceChip: sourceChip, SOURCE: SOURCE, plural: plural, TYPE_LABEL: TYPE_LABEL, SEX_LABEL: SEX_LABEL, entrySummary: entrySummary, TZ: TZ };
})(window);
