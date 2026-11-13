/*
 * Open Beds — "new facility" form, shared by the admin page and the provider update form.
 * Every bed type is offered on a new facility; blanks mean "not reported yet".
 *
 *   OpenBedsFacility.fields(prefix)        → HTML for one facility (details, contact, who they take, beds)
 *   OpenBedsFacility.read(prefix)          → { errors, data, entry }   (entry has siteId "new")
 *   OpenBedsFacility.build(data, orgId, entry, geo) → { site, entry } ready for store.addSites
 *   OpenBedsFacility.providerFields(prefix) / readProvider(prefix) → a new provider (name + email domain)
 *   OpenBedsFacility.geocode(text)         → Promise<{lat, lng} | null>
 */
(function (root) {
  "use strict";
  var OB = root.OB, ED = root.OpenBedsEditor, S = root.OpenBedsStore, esc = OB.esc;

  var FULL_LAYOUT = [
    { type: "detox", sexes: ["male", "female", "any"] },
    { type: "residential", sexes: ["male", "female", "any"] },
    { type: "php", sexes: ["male", "female", "any"] },
    { type: "outpatient", mode: "yesno" }
  ];
  function temp(p) { return { id: "new", name: "New facility", beds: FULL_LAYOUT, _p: p }; }
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value.trim() : ""; }
  function slug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "site"; }
  function rand(n) { return Math.random().toString(36).slice(2, 2 + n); }

  function geocode(q) {
    return fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&viewbox=-80.6,42.3,-74.6,39.6&q=" + encodeURIComponent(q), { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) { return j && j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null; })
      .catch(function () { return null; });
  }

  function field(id, label, opts) {
    opts = opts || {};
    var input = opts.textarea
      ? '<textarea id="' + id + '" class="input wide" rows="2">' + "</textarea>"
      : '<input id="' + id + '" class="input wide" type="' + (opts.type || "text") + '" autocomplete="off"' + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "") + (opts.value ? ' value="' + esc(opts.value) + '"' : "") + ">";
    return '<div class="field"><label class="lbl" for="' + id + '">' + label + (opts.help ? ' <span class="help">(' + esc(opts.help) + ")</span>" : "") + "</label>" + input + "</div>";
  }

  function providerFields(p) {
    return '<div class="row2">' + field(p + "-orgname", "Provider name", { help: "required" }) +
      field(p + "-domain", "Email domain you send from", { help: "optional, e.g. provider.org" }) + "</div>";
  }
  function readProvider(p) {
    var name = val(p + "-orgname");
    if (!name) return { errors: ["Add the provider’s name."] };
    if (S.sites.orgs.some(function (o) { return o.name.toLowerCase() === name.toLowerCase(); })) return { errors: ["“" + name + "” is already a provider — choose it from the list."] };
    return { errors: [], org: { id: "org-" + slug(name) + "-" + rand(3), name: name, short: name,
      senderDomains: val(p + "-domain") ? [val(p + "-domain").replace(/^.*@/, "").toLowerCase()] : [], custom: true } };
  }

  function fields(p) {
    var regionOpts = Object.keys(S.sites.regions).sort(function (a, b) { return S.sites.regions[a].order - S.sites.regions[b].order; })
      .map(function (k) { return '<option value="' + k + '">' + esc(S.sites.regions[k].label) + "</option>"; }).join("");
    var levels = S.sites.levels.map(function (l) {
      return '<label class="check"><input type="checkbox" name="' + p + '-lv" value="' + esc(l[0]) + '"> ' + esc(l[1]) + ' <span class="help">' + esc(l[2]) + "</span></label>";
    }).join("");
    return '<div class="facility" data-fac="' + p + '">' +
      '<h3 class="form-sub">Facility</h3>' +
      '<div class="row2">' + field(p + "-name", "Facility name", { help: "required" }) + field(p + "-town", "Town", { help: "required" }) + "</div>" +
      '<div class="row2">' + field(p + "-address", "Street address", { help: "optional — places it on the map" }) +
      '<div class="field"><label class="lbl" for="' + p + '-region">Region</label><select id="' + p + '-region" class="sel-in">' + regionOpts + "</select></div></div>" +
      '<div class="row2"><div class="field"><span class="lbl" id="' + p + '-pop-l">Serves</span><div class="radio-row" role="radiogroup" aria-labelledby="' + p + '-pop-l">' +
      '<label class="check"><input type="radio" name="' + p + '-pop" value="adult" checked> Adults</label><label class="check"><input type="radio" name="' + p + '-pop" value="adolescent"> Adolescents</label></div></div>' +
      '<div class="field"><span class="lbl" id="' + p + '-svc-l">Treats</span><div class="radio-row" role="group" aria-labelledby="' + p + '-svc-l">' +
      '<label class="check"><input type="checkbox" name="' + p + '-svc" value="SUD" checked> Substance use</label><label class="check"><input type="checkbox" name="' + p + '-svc" value="MH"> Mental health</label></div></div></div>' +
      '<h3 class="form-sub">Admissions contact</h3>' +
      '<div class="row3">' + field(p + "-phone", "Phone", { type: "tel" }) + field(p + "-email", "Intake email", { type: "email" }) + field(p + "-web", "Website", { type: "url", placeholder: "https://" }) + "</div>" +
      '<h3 class="form-sub">Who they take</h3>' +
      '<fieldset class="lv-grid"><legend class="lbl">LOCA levels accepted</legend>' + levels + "</fieldset>" +
      '<div class="row2">' + field(p + "-excl", "Won’t take", { help: "optional, one per line", textarea: true }) + field(p + "-pay", "Payment accepted", { help: "optional", placeholder: "e.g. Medical Assistance and SCA" }) + "</div>" +
      '<h3 class="form-sub">Open beds now</h3><p class="hint">Every bed type is here. Enter a number, <b>0</b> if full, <b>NA</b> if not offered, or leave blank.</p>' +
      '<div class="nf-beds">' + ED.siteBlock(temp(p), null, { prefix: p, mode: "admin" }) + "</div>" +
      '<div class="err" id="' + p + '-ferr" role="alert" hidden></div></div>';
  }

  function read(p) {
    var errors = [];
    var name = val(p + "-name"), town = val(p + "-town");
    if (!name) errors.push("Add the facility name.");
    if (name && S.sites.sites.some(function (s) { return s.name.toLowerCase() === name.toLowerCase(); })) errors.push("A facility called “" + name + "” is already listed.");
    if (!town) errors.push("Add the town.");
    if (val(p + "-email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val(p + "-email"))) errors.push("Check the intake email.");
    var svc = Array.prototype.map.call(document.querySelectorAll('input[name="' + p + '-svc"]:checked'), function (x) { return x.value; });
    if (!svc.length) errors.push("Choose what the facility treats.");
    var counts = ED.readSite(temp(p), { prefix: p });
    if (counts.errors.length) errors.push("Fix the highlighted counts — use a number or NA.");
    var e = $(p + "-ferr");
    if (e) { e.textContent = errors.join(" "); e.hidden = !errors.length; }
    return {
      errors: errors, entry: counts.entry,
      data: {
        name: name, town: town, address: val(p + "-address"), region: $(p + "-region").value, services: svc,
        population: document.querySelector('input[name="' + p + '-pop"]:checked').value,
        phone: val(p + "-phone"), email: val(p + "-email"), web: val(p + "-web"), payer: val(p + "-pay"),
        excludes: val(p + "-excl") ? val(p + "-excl").split(/\n|;/).map(function (x) { return x.trim(); }).filter(Boolean) : [],
        levels: Array.prototype.map.call(document.querySelectorAll('input[name="' + p + '-lv"]:checked'), function (x) { return x.value; })
      }
    };
  }

  function build(d, orgId, entry, geo, from) {
    var id = slug(d.name) + "-" + rand(4);
    var site = {
      id: id, org: orgId, name: d.name, aliases: [d.name.toLowerCase()], town: d.town, region: d.region, population: d.population, services: d.services,
      contact: d.phone || null, beds: FULL_LAYOUT, custom: true,
      fit: { levels: d.levels, serves: d.population === "adult" ? "Adults" : "Adolescents", excludes: d.excludes.length ? d.excludes : undefined, payer: d.payer || undefined, known: [], source: [from] },
      reach: { phone: d.phone || null, phoneFrom: d.phone ? (from === "admin" ? "DHS entry" : "provider’s form") : null, email: d.email || null, emailFrom: d.email ? (from === "admin" ? "DHS entry" : "provider’s form") : null, web: d.web || null },
      geo: geo ? { lat: geo.lat, lng: geo.lng, precision: d.address ? "address" : "town" } : null
    };
    return { site: site, entry: entry ? Object.assign({}, entry, { siteId: id }) : null };
  }
  // Look up each facility's address or town, then build them.
  function buildAll(list, orgId, from) {
    return Promise.all(list.map(function (r) { return geocode((r.data.address ? r.data.address + ", " : "") + r.data.town + ", PA"); }))
      .then(function (geos) { return list.map(function (r, i) { return build(r.data, orgId, r.entry, geos[i], from); }); });
  }

  root.OpenBedsFacility = { fields: fields, read: read, build: build, buildAll: buildAll, providerFields: providerFields, readProvider: readProvider, geocode: geocode, FULL_LAYOUT: FULL_LAYOUT };
})(window);
