#!/usr/bin/env node
/**
 * scripts/fetch-exoplanet-data.js
 *
 * Pulls the current confirmed-planet dataset from the NASA Exoplanet Archive's
 * TAP service and writes it to data/exoplanets.json — a plain array, same
 * shape convention as data/planets.json, so js/exoplanet-explorer.js can
 * fetch() and use it directly with no wrapper object to unwrap.
 *
 * This is a BUILD-TIME / CRON script, not something that runs in the browser.
 * Regenerate on a schedule (weekly is plenty — the archive doesn't update
 * hourly) rather than querying TAP live on every pageview.
 *
 * Usage (run from repo root):
 *   node scripts/fetch-exoplanet-data.js
 *
 * Requires Node 18+ (built-in fetch). No npm dependencies.
 *
 * Suggested automation: see .github/workflows/refresh-exoplanet-data.yml —
 * a weekly Action that runs this and commits data/exoplanets.json if changed.
 */

const fs = require("fs");
const path = require("path");

// Keep this list in sync with the field keys used by js/exoplanet-explorer.js
// and data/exoplanet-column-map.json. pscomppars has 300+ columns; only pull
// what the UI actually displays to keep the payload small.
const COLUMNS = [
  "pl_name", "hostname", "sy_pnum", "sy_snum",
  "discoverymethod", "disc_year", "disc_facility",
  "pl_orbper", "pl_orbpererr1", "pl_orbpererr2",
  "pl_orbsmax", "pl_orbsmaxerr1", "pl_orbsmaxerr2",
  "pl_orbeccen", "pl_orbeccenerr1", "pl_orbeccenerr2",
  "pl_rade", "pl_radeerr1", "pl_radeerr2", "pl_radj",
  "pl_bmasse", "pl_bmasseerr1", "pl_bmasseerr2", "pl_bmassj",
  "pl_dens", "pl_denserr1", "pl_denserr2",
  "pl_eqt", "pl_insol",
  "st_teff", "st_tefferr1", "st_tefferr2",
  "st_rad", "st_raderr1", "st_raderr2",
  "st_mass", "st_masserr1", "st_masserr2",
  "st_spectype",
  "st_met", "st_meterr1", "st_meterr2",
  "sy_dist", "sy_disterr1", "sy_disterr2",
  "sy_vmag", "ra", "dec",
  "tran_flag", "pl_controv_flag"
];

const TAP_BASE = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "exoplanets.json");

function buildTapUrl(columns, table, orderBy) {
  const select = columns.join(",");
  let query = `select+${select}+from+${table}`;
  if (orderBy) query += `+order+by+${orderBy}`;
  return `${TAP_BASE}?query=${query}&format=csv`;
}

// Minimal CSV parser — handles quoted fields containing commas (a handful of
// text columns, e.g. some facility names, contain them). Not general-purpose;
// sufficient for this API's output shape.
function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = coerceValue(values[i], header);
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

const STRING_COLUMNS = new Set(["pl_name", "hostname", "discoverymethod", "disc_facility", "st_spectype"]);

function coerceValue(raw, columnName) {
  if (raw === undefined || raw === "") return null;
  if (STRING_COLUMNS.has(columnName)) return raw;
  const num = Number(raw);
  return Number.isFinite(num) ? num : raw;
}

async function main() {
  const url = buildTapUrl(COLUMNS, "pscomppars", "pl_name");
  console.log(`Fetching from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TAP request failed: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  const planets = parseCsv(csvText);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(planets, null, 2) + "\n");
  console.log(`Wrote ${planets.length} planets to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Failed to fetch exoplanet data:", err);
  process.exit(1);
});