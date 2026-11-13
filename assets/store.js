/*
 * Open Beds — store.
 *
 * Every change to the board is a REPORT in one append-only log, whatever its source:
 *   source "email"  a provider email to the alias, parsed automatically
 *   source "form"   a provider using the update form
 *   source "admin"  DHS staff editing on the admin page
 *   source "referral"  intake staff marking that they referred someone: takes one bed
 *                      off the site's latest count until the provider reports again
 *
 * Facilities DHS adds on the admin page are kept with the log (state.customSites / customOrgs)
 * and merged into the site list, so every page and the email parser see them.
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
          email: { from: em.from, subject: em.subject, body: em.body, originalSent: em.originalSent },
          parse: { template: parsed.template, confidence: parsed.confidence, warnings: parsed.warnings, summary: parsed.summary },
          entries: parsed.entries
        };
      });
      return { version: 2, seededAt: new Date(now).toISOString(), touched: false, settings: { autoPublish: true }, reports: reports };
    }

    // Bed layouts providers have grown (a new bed type, or a men/women split) since data/sites.js.
    var baseBeds = {}, baseProfile = {};
    function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
    SITES.sites.forEach(function (p) {
      baseBeds[p.id] = clone(p.beds || []);
      baseProfile[p.id] = { fit: clone(p.fit || {}), reach: clone(p.reach || {}) };
    });
    function growLayout(st, entry) {
      var site = siteById[entry.siteId];
      if (!site) return;
      var beds = JSON.parse(JSON.stringify((st.layouts || {})[site.id] || site.beds || []));
      var changed = false;
      function row(t) { return beds.filter(function (b) { return b.type === t; })[0]; }
      Object.keys(entry.counts || {}).forEach(function (t) {
        if (t === "outpatient") { if (!row("outpatient")) { beds.push({ type: "outpatient", mode: "yesno" }); changed = true; } return; }
        Object.keys(entry.counts[t]).forEach(function (sx) {
          var b = row(t);
          if (!b) { beds.push({ type: t, sexes: [sx] }); changed = true; return; }
          if (b.sexes && b.sexes.indexOf(sx) < 0) { b.sexes.push(sx); changed = true; }
        });
      });
      (entry.qualitative || []).forEach(function (q) {
        if (q.types.indexOf("outpatient") > -1 && !row("outpatient")) { beds.push({ type: "outpatient", mode: "yesno" }); changed = true; }
      });
      if (!changed) return;
      var order = ["detox", "shared", "residential", "php", "outpatient"];
      beds.sort(function (a, b) { return order.indexOf(a.type) - order.indexOf(b.type); });
      beds.forEach(function (b) { if (b.sexes) b.sexes.sort(function (x, y) { return ["male", "female", "any"].indexOf(x) - ["male", "female", "any"].indexOf(y); }); });
      st.layouts = st.layouts || {};
      st.layouts[site.id] = beds;
    }

    // Merge facilities added on the admin page into the shared site list.
    function hydrate(s) {
      (s.customOrgs || []).forEach(function (o) { if (!orgById[o.id]) { SITES.orgs.push(o); orgById[o.id] = o; } });
      (s.customSites || []).forEach(function (p) {
        if (!siteById[p.id]) { SITES.sites.push(p); siteById[p.id] = p; }
        else siteById[p.id].pending = p.pending; // approval may have happened in another tab
      });
      Object.keys(s.layouts || {}).forEach(function (id) { if (siteById[id]) siteById[id].beds = s.layouts[id]; });
      // Facility details edited by providers or DHS (levels of care, who they take, contact).
      Object.keys(s.profiles || {}).forEach(function (id) {
        var p = siteById[id], pr = s.profiles[id];
        if (!p) return;
        p.fit = clone(pr.fit); p.reach = clone(pr.reach); p.contact = (pr.reach && pr.reach.phone) || null;
      });
    }
    function dropCustom() {
      SITES.sites.forEach(function (p) {
        if (baseBeds[p.id]) p.beds = clone(baseBeds[p.id]);
        if (baseProfile[p.id]) { p.fit = clone(baseProfile[p.id].fit); p.reach = clone(baseProfile[p.id].reach); p.contact = p.reach.phone || null; }
      });
      for (var i = SITES.sites.length - 1; i >= 0; i--) if (SITES.sites[i].custom) { delete siteById[SITES.sites[i].id]; SITES.sites.splice(i, 1); }
      for (var j = SITES.orgs.length - 1; j >= 0; j--) if (SITES.orgs[j].custom) { delete orgById[SITES.orgs[j].id]; SITES.orgs.splice(j, 1); }
    }

    function load() {
      var s = read();
      if (!s || s.version !== 2 || (!s.touched && (Date.now() - new Date(s.seededAt)) / 36e5 > RESEED_AFTER_H)) {
        s = seed();
        memory = s;
        try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
      }
      hydrate(s);
      return s;
    }

    function mutate(fn) { var s = load(); fn(s); s.touched = true; write(s); }

    function reports() {
      return load().reports.slice().sort(function (a, b) { return new Date(b.receivedAt) - new Date(a.receivedAt); });
    }

    // Latest published entry per site. With {adjusted: true}, referrals marked since are taken off,
    // so forms start from what the board actually shows.
    function current(opts) {
      if (opts && opts.adjusted) {
        var base = current(), refs = reports().filter(function (r) { return r.source === "referral" && r.status === "published"; });
        Object.keys(base).forEach(function (id) {
          var c = base[id], mine = refs.filter(function (r) { return r.referral.siteId === id && new Date(r.receivedAt) > new Date(c.report.receivedAt); });
          if (!mine.length) return;
          var ap = applyReferrals(c.entry.counts, c.entry.shared, mine);
          base[id] = { report: c.report, entry: Object.assign({}, c.entry, { counts: ap.counts, shared: ap.shared }) };
        });
        return base;
      }
      var out = {};
      reports().forEach(function (r) {
        if (r.status !== "published") return;
        r.entries.forEach(function (e) {
          if (e.siteId && !out[e.siteId]) out[e.siteId] = { entry: e, report: r };
        });
      });
      return out;
    }

    // Referrals marked since a count was reported take one bed each off that count.
    function applyReferrals(counts, shared, refs) {
      counts = JSON.parse(JSON.stringify(counts || {}));
      shared = shared ? JSON.parse(JSON.stringify(shared)) : shared;
      refs.slice().reverse().forEach(function (r) {
        var t = r.referral.type, sx = r.referral.sex;
        if (t === "shared") { if (shared && shared.open > 0) shared.open--; return; }
        if (counts[t] && typeof counts[t][sx] === "number" && counts[t][sx] > 0) counts[t][sx]--;
      });
      return { counts: counts, shared: shared };
    }

    // Profile + current counts, in the shape the board renders.
    function boardSites() {
      var cur = current();
      var refs = reports().filter(function (r) { return r.source === "referral" && r.status === "published"; });
      return SITES.sites.filter(function (p) { return !p.pending; }).map(function (p) {
        var c = cur[p.id];
        var site = {
          id: p.id, name: p.name, fullName: p.fullName, org: orgById[p.org].short, orgId: p.org, town: p.town, region: p.region,
          population: p.population, services: p.services, contact: p.contact, reach: p.reach || {}, custom: !!p.custom, fit: p.fit || {}, geo: p.geo || null, beds: p.beds
        };
        if (!c) { site.noReport = true; return site; }
        var e = c.entry;
        var mine = refs.filter(function (r) { return r.referral.siteId === p.id && new Date(r.receivedAt) > new Date(c.report.receivedAt); });
        var applied = applyReferrals(e.counts, e.shared, mine);
        site.counts = applied.counts;
        site.referrals = mine.map(function (r) { return { id: r.id, type: r.referral.type, sex: r.referral.sex, receivedAt: r.receivedAt, by: r.by }; });
        e = Object.assign({}, e, { shared: applied.shared });
        if (e.shared) {
          var layout = (p.beds || []).filter(function (b) { return b.type === "shared"; })[0];
          site.shared = { types: e.shared.types || (layout ? layout.covers : ["detox", "residential"]), open: e.shared.open, label: e.shared.label || (layout && layout.label) || "detox or rehab" };
        }
        site.qualitative = e.qualitative;
        site.notes = e.notes;
        site.sexSplitInferred = (e.flags || []).indexOf("sexSplitInferred") > -1;
        site.report = { id: c.report.id, source: c.report.source, orgId: c.report.orgId, receivedAt: c.report.receivedAt, by: c.report.by, template: c.report.parse && c.report.parse.template, reason: c.report.reason, from: c.report.email && c.report.email.from };
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

    // Form and DHS updates only send what was typed: blank means "no change", so start from the site's
    // current entry and lay the new values over it.
    function mergeEntry(prev, e) {
      if (!prev) return e;
      var out = clone(prev);
      out.siteId = e.siteId;
      out.counts = out.counts || {};
      Object.keys(e.counts || {}).forEach(function (t) { out.counts[t] = Object.assign({}, out.counts[t] || {}, e.counts[t]); });
      if (e.shared) out.shared = e.shared;
      var q = (out.qualitative || []).filter(function (x) { return x.types.indexOf("unknown") < 0; });
      if (e.counts && e.counts.outpatient) q = q.filter(function (x) { return x.types.indexOf("outpatient") < 0; });
      (e.qualitative || []).forEach(function (x) {
        if (x.types.indexOf("outpatient") > -1 && out.counts.outpatient) delete out.counts.outpatient;
        q = q.filter(function (y) { return y.types.join() !== x.types.join(); }).concat([x]);
      });
      out.qualitative = q;
      out.notes = e.notes || [];
      out.flags = [];
      return out;
    }
    function merged(entries) {
      var cur = current({ adjusted: true });
      return entries.map(function (e) { return mergeEntry(cur[e.siteId] && cur[e.siteId].entry, e); });
    }

    function submitForm(input) {
      input.entries = merged(input.entries);
      var r = { id: uid(), source: "form", status: "published", receivedAt: nowIso(), orgId: input.orgId, by: input.by || "Provider form", entries: input.entries, note: input.note };
      mutate(function (st) { st.reports.push(r); input.entries.forEach(function (e) { growLayout(st, e); }); hydrate(st); });
      return r;
    }

    function adminUpdate(input) {
      input.entries = merged(input.entries);
      var r = { id: uid(), source: "admin", status: "published", receivedAt: nowIso(), orgId: input.orgId, by: "DHS admin" + (input.by ? ": " + input.by : ""), reason: input.reason, entries: input.entries };
      mutate(function (st) { st.reports.push(r); input.entries.forEach(function (e) { growLayout(st, e); }); hydrate(st); });
      return r;
    }

    // Facility details change: applied at once, logged with before/after so DHS can revert.
    function updateProfile(input) {
      var site = siteById[input.siteId], r = null;
      if (!site) return null;
      mutate(function (st) {
        st.profiles = st.profiles || {};
        var before = { fit: clone(site.fit || {}), reach: clone(site.reach || {}) };
        var after = { fit: clone(input.fit), reach: clone(input.reach) };
        st.profiles[site.id] = after;
        if (site.custom) (st.customSites || []).forEach(function (c) { if (c.id === site.id) { c.fit = clone(after.fit); c.reach = clone(after.reach); c.contact = after.reach.phone || null; } });
        r = { id: uid(), source: input.source || "admin", status: "published", receivedAt: nowIso(), orgId: site.org,
          by: input.by, reason: input.reason, profile: { siteId: site.id, before: before, after: after, changes: input.changes || [] }, entries: [] };
        st.reports.push(r);
        hydrate(st);
      });
      return r;
    }

    function refer(input) {
      var site = siteById[input.siteId];
      var r = { id: uid(), source: "referral", status: "published", receivedAt: nowIso(), orgId: site ? site.org : null,
        by: "Pathways" + (input.by ? ": " + input.by : ""), referral: { siteId: input.siteId, type: input.type, sex: input.sex }, entries: [] };
      mutate(function (st) { st.reports.push(r); });
      return r;
    }

    // New facilities (and maybe a new provider). From DHS they publish at once; from the provider
    // form they wait for DHS review and stay off the board until approved.
    function addSites(input) {
      var review = !!input.review, r = null;
      mutate(function (st) {
        st.customSites = st.customSites || [];
        st.customOrgs = st.customOrgs || [];
        if (input.org) st.customOrgs.push(input.org);
        input.sites.forEach(function (x) { x.site.pending = review; st.customSites.push(x.site); });
        hydrate(st);
        r = { id: uid(), source: input.source || "admin", status: review ? "review" : "published", receivedAt: nowIso(),
          orgId: input.sites[0].site.org, by: input.by, reason: input.reason,
          newSites: input.sites.map(function (x) { return x.site.id; }), newOrg: input.org ? input.org.id : null,
          entries: input.sites.map(function (x) { return x.entry; }).filter(Boolean) };
        st.reports.push(r);
      });
      return r;
    }
    function addSite(input) {
      return addSites({ org: input.org, sites: [{ site: input.site, entry: input.entry }], by: "DHS admin" + (input.by ? ": " + input.by : ""), reason: input.reason || "New facility added", source: "admin" });
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
          // Reverting a profile change restores what it replaced.
          if (r.profile && status === "rejected") { st.profiles = st.profiles || {}; st.profiles[r.profile.siteId] = clone(r.profile.before); }
          // Approving a provider's new facility puts it on the board.
          if (r.newSites) (st.customSites || []).forEach(function (p) {
            if (r.newSites.indexOf(p.id) > -1) { p.pending = status !== "published"; if (siteById[p.id]) siteById[p.id].pending = p.pending; }
          });
        });
        hydrate(st);
      });
    }

    return {
      sites: SITES, siteById: siteById, orgById: orgById,
      reports: reports, current: current, boardSites: boardSites,
      receiveEmail: receiveEmail, submitForm: submitForm, adminUpdate: adminUpdate, refer: refer, addSite: addSite, addSites: addSites, updateProfile: updateProfile,
      undoReferral: function (id, opts) { decide(id, "undone", opts); },
      publish: function (id, opts) { decide(id, "published", opts); },
      reject: function (id, opts) { decide(id, "rejected", opts); },
      settings: function () { return load().settings; },
      setSetting: function (k, v) { mutate(function (st) { st.settings[k] = v; }); },
      reset: function () { dropCustom(); var s = seed(); write(s); },
      subscribe: function (fn) {
        listeners.push(fn);
        if (root.addEventListener) root.addEventListener("storage", function (e) { if (e.key === KEY) fn(); });
      },
      mode: "demo"
    };
  }

  root.OpenBedsStore = createStore(root.OPEN_BEDS_SITES, root.OpenBedsParser, root.OPEN_BEDS_EMAILS);
})(window);
