#!/usr/bin/env node
/**
 * scripts/fetch-asteroid-data.js
 *
 * Pulls near-Earth object close-approach data from NASA's NeoWs (Near Earth
 * Object Web Service) and writes it to data/asteroids.json — a plain array,
 * same shape convention as data/planets.json and data/exoplanets.json, so
 * js/asteroid-tracker.js can fetch() and use it directly with no wrapper
 * object to unwrap.
 *
 * NeoWs's feed endpoint only accepts a MAXIMUM 7-day date range per request
 * (a hard API limit, not configurable) — see the "start/end" values below.
 * To cover the full 120-day window this script queries the feed endpoint
 * repeatedly in 7-day chunks and combines the results.
 *
 * Each row in the output represents ONE close-approach EVENT, not one
 * asteroid — an asteroid with two close approaches inside the window
 * (rare, but the API allows it) will appear as two separate rows, since
 * "close approach date" is itself one of the things this tool lets you
 * sort and browse by.
 *
 * This is a BUILD-TIME / CRON script, not something that runs in the
 * browser. Requires an API key — the shared DEMO_KEY is capped at 30
 * requests/hour, well below what a single run needs (~18 requests), so
 * this script expects a personal key in the NASA_API_KEY environment
 * variable. Get one free at https://api.nasa.gov.
 *
 * Usage (run from repo root):
 *   NASA_API_KEY=your_key_here node scripts/fetch-asteroid-data.js
 *
 * Requires Node 18+ (built-in fetch). No npm dependencies.
 *
 * Suggested automation: see .github/workflows/refresh-catalog-data.yml —
 * a weekly Action that runs this (and the exoplanet fetch script) and
 * commits data/asteroids.json if changed.
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.NASA_API_KEY;
if (!API_KEY) {
  console.error("Missing NASA_API_KEY environment variable. Get a free key at https://api.nasa.gov");
  process.exit(1);
}

const FEED_BASE = "https://api.nasa.gov/neo/rest/v1/feed";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "asteroids.json");

const DAYS_PAST = 30;
const DAYS_FUTURE = 90;
const CHUNK_DAYS = 7; // NeoWs feed hard limit — do not increase

function formatDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function addDays(d, days) {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Build the list of [start, end] date-string pairs covering the full
// window in <=7-day chunks (the feed endpoint's start/end are inclusive,
// so a 7-day chunk spans start through start+6).
function buildDateChunks() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const windowStart = addDays(today, -DAYS_PAST);
  const windowEnd   = addDays(today, DAYS_FUTURE);

  const chunks = [];
  let chunkStart = windowStart;
  while (chunkStart <= windowEnd) {
    const chunkEnd = new Date(Math.min(
      addDays(chunkStart, CHUNK_DAYS - 1).getTime(),
      windowEnd.getTime()
    ));
    chunks.push([formatDate(chunkStart), formatDate(chunkEnd)]);
    chunkStart = addDays(chunkEnd, 1);
  }
  return chunks;
}

async function fetchChunk(startDate, endDate) {
  const url = `${FEED_BASE}?start_date=${startDate}&end_date=${endDate}&api_key=${API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NeoWs request failed (${startDate} to ${endDate}): ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Flattens NeoWs's { near_earth_objects: { "date": [asteroid, ...] } } shape
// into one row per close-approach event. Each asteroid object from the API
// includes a close_approach_data array — for a feed response this is
// reliably a single entry (the approach that placed it in that day's
// bucket), but we still read it defensively in case that ever changes.
function flattenFeedResponse(feedJson) {
  const rows = [];
  const byDate = feedJson.near_earth_objects || {};

  for (const dateKey of Object.keys(byDate)) {
    for (const neo of byDate[dateKey]) {
      const approach = (neo.close_approach_data && neo.close_approach_data[0]) || {};
      const diameterKm = neo.estimated_diameter?.kilometers || {};

      rows.push({
        id: neo.id,
        name: neo.name,
        nasa_jpl_url: neo.nasa_jpl_url,
        absolute_magnitude_h: neo.absolute_magnitude_h ?? null,
        is_potentially_hazardous: !!neo.is_potentially_hazardous_asteroid,
        estimated_diameter_km_min: diameterKm.estimated_diameter_min ?? null,
        estimated_diameter_km_max: diameterKm.estimated_diameter_max ?? null,
        close_approach_date: approach.close_approach_date ?? dateKey,
        close_approach_date_full: approach.close_approach_date_full ?? null,
        relative_velocity_km_s: approach.relative_velocity?.kilometers_per_second
          ? Number(approach.relative_velocity.kilometers_per_second) : null,
        relative_velocity_km_h: approach.relative_velocity?.kilometers_per_hour
          ? Number(approach.relative_velocity.kilometers_per_hour) : null,
        miss_distance_km: approach.miss_distance?.kilometers
          ? Number(approach.miss_distance.kilometers) : null,
        miss_distance_lunar: approach.miss_distance?.lunar
          ? Number(approach.miss_distance.lunar) : null,
        miss_distance_au: approach.miss_distance?.astronomical
          ? Number(approach.miss_distance.astronomical) : null,
        orbiting_body: approach.orbiting_body ?? null
      });
    }
  }
  return rows;
}

// De-duplicate (id + close_approach_date) pairs — chunk boundaries are
// inclusive on both ends, so if a chunk ever got misaligned this would
// catch an accidental double-count rather than silently duplicating rows.
function dedupe(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.id}_${row.close_approach_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const chunks = buildDateChunks();
  console.log(`Fetching ${chunks.length} chunk(s) covering ${DAYS_PAST} days past through ${DAYS_FUTURE} days future...`);

  let allRows = [];
  for (const [start, end] of chunks) {
    console.log(`  Fetching ${start} to ${end}`);
    const json = await fetchChunk(start, end);
    allRows = allRows.concat(flattenFeedResponse(json));
  }

  const deduped = dedupe(allRows);
  deduped.sort((a, b) => a.close_approach_date.localeCompare(b.close_approach_date));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(deduped, null, 2) + "\n");
  console.log(`Wrote ${deduped.length} close-approach events to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Failed to fetch asteroid data:", err);
  process.exit(1);
});