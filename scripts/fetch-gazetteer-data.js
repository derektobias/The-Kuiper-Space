#!/usr/bin/env node
/**
 * scripts/fetch-gazetteer-data.js
 *
 * Pulls named-surface-feature data from the USGS Gazetteer of Planetary
 * Nomenclature and writes it to data/gazetteer.json — a plain array, same
 * shape convention as data/exoplanets.json and data/asteroids.json, so
 * js/planetary-gazetteer.js can fetch() and use it directly.
 *
 * SOURCE & WHY THIS APPROACH
 * ---------------------------
 * Unlike the Exoplanet Archive (TAP/JSON) or NeoWs (REST/JSON), the
 * Gazetteer doesn't expose a documented JSON API — its search results page
 * is server-rendered HTML. Instead, USGS publishes per-target GIS
 * Shapefile downloads, regenerated nightly, at:
 *   https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/{TARGET}_nomenclature_center_pts.zip
 * (e.g. IO_nomenclature_center_pts.zip) — confirmed against a real link,
 * not guessed. This script downloads each target's zip, extracts the
 * .shp/.dbf pair, and reads the attribute table directly.
 *
 * CONFIRMED SCHEMA (verified via a real run, 2026-08-01)
 * --------------------------------------------------------
 * Every one of the 27 targets below shares this exact attribute schema —
 * one consistent shape across the whole dataset, no per-body variance:
 *   name, clean_name, approvaldt, origin, diameter, center_lon, center_lat,
 *   type, code, approval, min_lon, max_lon, min_lat, max_lat, ethnicity,
 *   continent, quad_name, quad_code, link
 * resolveRecord() below reads these directly by exact key.
 *
 * CONFIRMED: `approval` VALUES AND FILTER BEHAVIOR (verified 2026-08-01)
 * ------------------------------------------------------------------------
 * A full run against Io showed `approval` is a plain text string, and every
 * one of its 260 features carries the identical value "Adopted by IAU".
 * That means this point-file export apparently only ever contains
 * currently-adopted names — dropped/never-approved names likely live only
 * in USGS's full search database, not here. isCurrentlyAdopted() below is
 * now grounded in that real value (checks for "adopted") rather than
 * guessed drop-codes (6/7) that have never actually been observed in this
 * data. The sample-record and distinct-value logging in fetchTarget/main
 * are left in as ongoing monitoring — if a future weekly refresh ever
 * shows a different `approval` value, that log line is the signal to
 * revisit this.
 *
 * TESTING A SINGLE BODY
 * -----------------------
 * The full run takes a while (15,772 features across 27 targets). While
 * iterating, fetch just one target:
 *   GAZETTEER_TARGET=IO node scripts/fetch-gazetteer-data.js
 *
 * Usage (run from repo root):
 *   npm install shapefile adm-zip
 *   node scripts/fetch-gazetteer-data.js
 *
 * Requires Node 18+ (built-in fetch). Two npm dependencies — a deviation
 * from the zero-dependency pattern of the other two fetch scripts, but
 * there's no REST/TAP equivalent here, so a shapefile can't be avoided.
 */

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const shapefile = require("shapefile");

const DOWNLOAD_BASE_URL = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "gazetteer.json");

// Every target this site covers, with the metadata the Gazetteer itself
// doesn't provide (body classification) so js/planetary-gazetteer.js can group the
// target-picker without a second lookup table. usgsTarget must match the
// filename USGS uses, e.g. "IO_nomenclature_center_pts.zip" -> "IO".
const TARGETS = [
  { usgsTarget: "MERCURY", displayName: "Mercury", bodyType: "planet" },
  { usgsTarget: "VENUS", displayName: "Venus", bodyType: "planet" },
  { usgsTarget: "MOON", displayName: "The Moon", bodyType: "moon" },
  { usgsTarget: "MARS", displayName: "Mars", bodyType: "planet" },
  { usgsTarget: "PHOBOS", displayName: "Phobos", bodyType: "moon" },
  { usgsTarget: "DEIMOS", displayName: "Deimos", bodyType: "moon" },
  { usgsTarget: "CERES", displayName: "Ceres", bodyType: "dwarf_planet" },
  { usgsTarget: "VESTA", displayName: "Vesta", bodyType: "asteroid" },
  { usgsTarget: "IO", displayName: "Io", bodyType: "moon" },
  { usgsTarget: "EUROPA", displayName: "Europa", bodyType: "moon" },
  { usgsTarget: "GANYMEDE", displayName: "Ganymede", bodyType: "moon" },
  { usgsTarget: "CALLISTO", displayName: "Callisto", bodyType: "moon" },
  { usgsTarget: "MIMAS", displayName: "Mimas", bodyType: "moon" },
  { usgsTarget: "ENCELADUS", displayName: "Enceladus", bodyType: "moon" },
  { usgsTarget: "TETHYS", displayName: "Tethys", bodyType: "moon" },
  { usgsTarget: "DIONE", displayName: "Dione", bodyType: "moon" },
  { usgsTarget: "RHEA", displayName: "Rhea", bodyType: "moon" },
  { usgsTarget: "TITAN", displayName: "Titan", bodyType: "moon" },
  { usgsTarget: "IAPETUS", displayName: "Iapetus", bodyType: "moon" },
  { usgsTarget: "MIRANDA", displayName: "Miranda", bodyType: "moon" },
  { usgsTarget: "ARIEL", displayName: "Ariel", bodyType: "moon" },
  { usgsTarget: "UMBRIEL", displayName: "Umbriel", bodyType: "moon" },
  { usgsTarget: "TITANIA", displayName: "Titania", bodyType: "moon" },
  { usgsTarget: "OBERON", displayName: "Oberon", bodyType: "moon" },
  { usgsTarget: "TRITON", displayName: "Triton", bodyType: "moon" },
  { usgsTarget: "PLUTO", displayName: "Pluto", bodyType: "dwarf_planet" },
  { usgsTarget: "CHARON", displayName: "Charon", bodyType: "moon" }
];

// Optional single-target filter for fast iteration (see header note).
const TARGET_FILTER = process.env.GAZETTEER_TARGET;
const TARGETS_TO_FETCH = TARGET_FILTER
  ? TARGETS.filter(t => t.usgsTarget === TARGET_FILTER.toUpperCase())
  : TARGETS;
if (TARGET_FILTER && TARGETS_TO_FETCH.length === 0) {
  console.error(`No target matches GAZETTEER_TARGET="${TARGET_FILTER}". Valid values: ${TARGETS.map(t => t.usgsTarget).join(", ")}`);
  process.exit(1);
}

// Builds one clean feature record from a shapefile Feature (GeoJSON-ish:
// { properties, geometry }), reading the confirmed schema by exact key.
// Falls back to point geometry for center lat/lon only in the unlikely
// case a future body's export is missing those attributes outright.
function resolveRecord(feature, targetMeta) {
  const props = feature.properties || {};
  const geomCoords = feature.geometry && feature.geometry.type === "Point"
    ? feature.geometry.coordinates // [lon, lat] per GeoJSON convention
    : null;

  const centerLon = props.center_lon !== undefined ? asNumber(props.center_lon) : (geomCoords ? geomCoords[0] : null);
  const centerLat = props.center_lat !== undefined ? asNumber(props.center_lat) : (geomCoords ? geomCoords[1] : null);

  return {
    clean_name: props.clean_name ?? props.name ?? null,
    feature_name: props.name ?? null,
    target: targetMeta.displayName,
    body_type: targetMeta.bodyType,
    feature_type: props.type ?? null,
    feature_type_code: props.code ?? null,
    center_lat: centerLat,
    center_lon: centerLon,
    min_lat: asNumber(props.min_lat),
    max_lat: asNumber(props.max_lat),
    // ⚠️ FUTURE MAP CODE NOTE: longitude wraps at 360°→0°, so a feature
    // centered near that seam can legitimately have min_lon > max_lon
    // (e.g. min_lon: 358.5, max_lon: 1.5 for a box spanning across 0°).
    // Any future code computing a bounding-box width or a "is this point
    // within range" check must handle that case specially (e.g. width =
    // max_lon >= min_lon ? max_lon - min_lon : (360 - min_lon) + max_lon)
    // rather than assuming min is always the smaller number. Stored as-is
    // here; nothing to fix in this fetch script itself.
    min_lon: asNumber(props.min_lon),
    max_lon: asNumber(props.max_lon),
    diameter_km: asNumber(props.diameter),
    origin: props.origin ?? null,
    continent_code: props.continent ?? null,
    ethnicity_code: props.ethnicity ?? null,
    approval_status: props.approval ?? null,
    // Confirmed format: "1985/01/01 00:00:00" — the time is always
    // midnight (a dummy placeholder, not a real timestamp); only the date
    // portion is meaningful. Kept as the raw string here; format/truncate
    // for display in js/planetary-gazetteer.js rather than reparsing at fetch time.
    approval_date: props.approvaldt ?? null,
    quad: props.quad_name ?? null,
    quad_code: props.quad_code ?? null,
    detail_url: props.link ?? null
  };
}

function asNumber(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

// Confirmed via a real run (see header note): `approval` is a plain text
// string, and every currently-adopted feature seen so far carries exactly
// "Adopted by IAU". Rather than guess at what a dropped record's value
// might look like (never observed), this checks for the one positive
// value we know is real. If a future refresh encounters something else,
// distinctApprovalValues in main() below will surface it in the logs.
function isCurrentlyAdopted(record) {
  const status = record.approval_status;
  if (status === null || status === undefined) return true; // don't drop data on a missing field
  return String(status).toLowerCase().includes("adopted");
}

// ================================
// DOWNLOAD + UNZIP + PARSE
// ================================
let sampleRecordLogged = false;
const distinctApprovalValues = new Set();

async function fetchTarget(targetMeta) {
  const url = `${DOWNLOAD_BASE_URL}/${targetMeta.usgsTarget}_nomenclature_center_pts.zip`;
  console.log(`Fetching ${targetMeta.displayName}: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`  ⚠️  Skipped ${targetMeta.displayName}: HTTP ${response.status}`);
    return [];
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = new AdmZip(Buffer.from(arrayBuffer));
  const entries = zip.getEntries().map(e => e.entryName);

  const shpEntries = entries.filter(e => e.toLowerCase().endsWith(".shp"));
  if (shpEntries.length === 0) {
    console.warn(`  ⚠️  No .shp file found — entries were: ${entries.join(", ")}`);
    return [];
  }
  const preferred = shpEntries[0]; // filename is already "..._center_pts", so only one shapefile set is expected per zip
  if (shpEntries.length > 1) {
    console.log(`  Multiple shapefiles found, using: ${preferred} (others: ${shpEntries.filter(e => e !== preferred).join(", ")})`);
  }

  const base = preferred.replace(/\.shp$/i, "");
  const dbfName = entries.find(e => e.toLowerCase() === `${base}.dbf`.toLowerCase());
  if (!dbfName) {
    console.warn(`  ⚠️  No matching .dbf found for ${preferred}`);
    return [];
  }

  const shpBuffer = zip.getEntry(preferred).getData();
  const dbfBuffer = zip.getEntry(dbfName).getData();

  const records = [];
  // ⚠️ The `shapefile` package defaults to windows-1252 for DBF text, but
  // USGS's data is actually UTF-8 — without this override, any non-ASCII
  // character (ö, ū, ē, etc. in origin names and feature-type terms) comes
  // back double-mangled, e.g. "Schrödinger" → "SchrÃ¶dinger". Confirmed via
  // a real run before this fix (see conversation), not guessed.
  const source = await shapefile.open(shpBuffer, dbfBuffer, { encoding: "utf-8" });
  let result = await source.read();
  while (!result.done) {
    if (!sampleRecordLogged) {
      console.log(`\nSample raw record (${targetMeta.displayName}):`, JSON.stringify(result.value.properties, null, 2));
      sampleRecordLogged = true;
    }
    distinctApprovalValues.add(JSON.stringify(result.value.properties?.approval));
    records.push(resolveRecord(result.value, targetMeta));
    result = await source.read();
  }

  const adopted = records.filter(isCurrentlyAdopted);
  console.log(`  ${targetMeta.displayName}: ${adopted.length} adopted features (${records.length - adopted.length} dropped/unapproved excluded)`);
  return adopted;
}

async function main() {
  const allFeatures = [];
  for (const targetMeta of TARGETS_TO_FETCH) {
    try {
      const features = await fetchTarget(targetMeta);
      allFeatures.push(...features);
    } catch (err) {
      console.error(`Failed to fetch ${targetMeta.displayName}:`, err.message);
    }
  }

  console.log(`\nDistinct "approval" values seen across this run: ${[...distinctApprovalValues].join(", ")}`);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allFeatures, null, 2) + "\n");
  console.log(`Wrote ${allFeatures.length} features across ${TARGETS_TO_FETCH.length} target(s) to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Failed to fetch gazetteer data:", err);
  process.exit(1);
});