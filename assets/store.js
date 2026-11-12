/*
 * Open Beds — store.
 *
 * Every change to the board is a REPORT in one append-only log, whatever its source:
 *   source "email"  a provider email to the alias, parsed automatically
 *   source "form"   a provider using the update form
 *   source "admin"  DHS staff editing on the admin page
 *
 * A report holds one entry per site. The board shows, for each site, the entry
 * from its most recent PUBLISHED report. Emails the parser isn't sure about wait
 * in "review" until an admin publishes or rejects them.
 *
 * This file is the DEMO adapter: the log lives in the viewer's browser
 * (localStorage), seeded with the 7 sample emails. A production adapter
 * implements the same methods against the API in docs/architecture.md.
 */
(function (root) {
  "use strict";

  var KEY = "openbeds.demo.v1";
  var RESEED_AFTER_H = 12;

  function createStore(SITES, PARSER, EMAILS) {
    var memory = null;
    var listeners = [];
    var siteById = {};
    SITES.sites.forEach(function (s) { siteById[s.id] = s; });
    var orgById = {};
    SITES.orgs.forEach(function (o) { orgById[o.id] = o; });

    function uid() { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function nowIso() { return new Date().toISOString(); }

    function read() {
      try { var raw = root.localStorage && root.localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* storage blocked */ }
      return memory;
    }
    function write(state) {
      memory = state;
      try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* in-memory only */ }
      listeners.forEach(function (fn) { fn(); });
    }

    function seed() {
      var now = Date.now();
      var reports = EMAILS.samples.map(function (em) {
        var parsed = PARSER.parseEmail(em, SITES);
        return {
          id: "seed-" + em.key, source: "email", status: "published", auto: true,
          receivedAt: new Date(now - em.hoursAgo * 36e5).toISOString(),
          orgId: parsed.orgId, by: "Email from " + em.from.split("@")[1],
          email: { from: em.from, subject: em.subject, body: em.body },
          parse: { template: parsed.template, confidence: parsed.confidence, warnings: parsed.warnings, summary: parsed.summary },
          entries: parsed.entries
        };
      });
      return { version: 1, seededAt: new Date(now).toISOString(), touched: false, settings: { autoPublish: true }, reports: reports };
    }

    function load() {
      var s = read();
      if (!s || s.version !== 1 || (!s.touched && (Date.now() - new Date(s.seededAt)) / 36e5 > RESEED_AFTER_H)) {
        s = seed();
        memory = s;
        try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
      }
      return s;
    }

    function mutate(fn) { var s = load(); fn(s); s.touched = true; write(s); }

    function reports() {
      return load().reports.slice().sort(function (a, b) { return new Date(b.receivedAt) - new Date(a.receivedAt); });
    }

    // Latest published entry per site.
    function current() {
      var out = {};
      reports().forEach(function (r) {
        if (r.status !== "published") return;
        r.entries.forEach(function (e) {
          if (e.siteId && !out[e.siteId]) out[e.siteId] = { entry: e, report: r };
        });
      });
      return out;
    }

    // Profile + current counts, in the shape the board renders.
    function boardSites() {
      var cur = current();
      return SITES.sites.map(function (p) {
        var c = cur[p.id];
        var site = {
          id: p.id, name: p.name, fullName: p.fullName, org: orgById[p.org].short, orgId: p.org, town: p.town, region: p.region,
          population: p.population, services: p.services, contact: p.contact, fit: p.fit || {}, beds: p.beds
        };
        if (!c) { site.noReport = true; return site; }
        var e = c.entry;
        site.counts = e.counts || {};
        if (e.shared) {
          var layout = (p.beds || []).filter(function (b) { return b.type === "shared"; })[0];
          site.shared = { types: e.shared.types || (layout ? layout.covers : ["detox", "residential"]), open: e.shared.open, label: e.shared.label || (layout && layout.label) || "detox or rehab" };
        }
        site.qualitative = e.qualitative;
        site.notes = e.notes;
        site.sexSplitInferred = (e.flags || []).indexOf("sexSplitInferred") > -1;
        site.report = { id: c.report.id, source: c.report.source, receivedAt: c.report.receivedAt, by: c.report.by, template: c.report.parse && c.report.parse.template, reason: c.report.reason };
        return site;
      });
    }

    function receiveEmail(email) {
      var parsed = PARSER.parseEmail(email, SITES);
      var s = load();
      var publish = s.settings.autoPublish && parsed.confidence !== "low";
      var r = {
        id: uid(), source: "email", status: publish ? "published" : "review", auto: publish,
        receivedAt: nowIso(), orgId: parsed.orgId, by: "Email from " + (String(email.from).split("@")[1] || "unknown sender"),
        email: { from: email.from, subject: email.subject, body: email.body },
        parse: { template: parsed.template, confidence: parsed.confidence, warnings: parsed.warnings, summary: parsed.summary },
        entries: parsed.entries
      };
      mutate(function (st) { st.reports.push(r); });
      return r;
    }

    function submitForm(input) {
      var r = { id: uid(), source: "form", status: "published", receivedAt: nowIso(), orgId: input.orgId, by: input.by || "Provider form", entries: input.entries, note: input.note };
      mutate(function (st) { st.reports.push(r); });
      return r;
    }

    function adminUpdate(input) {
      var r = { id: uid(), source: "admin", status: "published", receivedAt: nowIso(), orgId: input.orgId, by: "DHS admin" + (input.by ? ": " + input.by : ""), reason: input.reason, entries: input.entries };
      mutate(function (st) { st.reports.push(r); });
      return r;
    }

    function decide(id, status, opts) {
      opts = opts || {};
      mutate(function (st) {
        st.reports.forEach(function (r) {
          if (r.id !== id) return;
          r.status = status;
          r.decidedAt = nowIso();
          r.decidedBy = opts.by || "DHS admin";
          if (opts.entries) r.entries = opts.entries;
          if (opts.orgId) r.orgId = opts.orgId;
        });
      });
    }

    return {
      sites: SITES, siteById: siteById, orgById: orgById,
      reports: reports, current: current, boardSites: boardSites,
      receiveEmail: receiveEmail, submitForm: submitForm, adminUpdate: adminUpdate,
      publish: function (id, opts) { decide(id, "published", opts); },
      reject: function (id, opts) { decide(id, "rejected", opts); },
      settings: function () { return load().settings; },
      setSetting: function (k, v) { mutate(function (st) { st.settings[k] = v; }); },
      reset: function () { var s = seed(); write(s); },
      subscribe: function (fn) {
        listeners.push(fn);
        if (root.addEventListener) root.addEventListener("storage", function (e) { if (e.key === KEY) fn(); });
      },
      mode: "demo"
    };
  }

  root.OpenBedsStore = createStore(root.OPEN_BEDS_SITES, root.OpenBedsParser, root.OPEN_BEDS_EMAILS);
})(window);
