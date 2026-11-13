// Pulls the FAA's public airport event feed and writes a compact airports.json.
// Usage: node scripts/fetch-faa.mjs <output-path>
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const out = process.argv[2] || "data/airports.json";
const FEED = "https://nasstatus.faa.gov/api/airport-events";

const res = await fetch(FEED, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
if (!res.ok) throw new Error(`FAA feed returned ${res.status}`);
const events = await res.json();
if (!Array.isArray(events)) throw new Error("FAA feed was not a list");

const airports = {};
for (const e of events) {
  const a = {};
  if (e.groundStop) {
    a.groundStop = {
      reason: e.groundStop.impactingCondition ?? null,
      end: e.groundStop.endTime ?? null,
    };
  }
  if (e.groundDelay) {
    a.groundDelay = {
      reason: e.groundDelay.impactingCondition ?? null,
      avgMin: e.groundDelay.avgDelay ?? null,
      maxMin: e.groundDelay.maxDelay ?? null,
      end: e.groundDelay.endTime ?? null,
    };
  }
  for (const k of ["departureDelay", "arrivalDelay"]) {
    if (e[k]) {
      a[k] = {
        reason: e[k].reason ?? null,
        min: e[k].arrivalDeparture?.min ?? null,
        max: e[k].arrivalDeparture?.max ?? null,
        trend: e[k].trend ?? null,
      };
    }
  }
  if (e.airportClosure) {
    a.closure = {
      text: e.airportClosure.simpleText ?? e.airportClosure.text ?? null,
      start: e.airportClosure.startTime ?? null,
      end: e.airportClosure.endTime ?? null,
    };
  }
  if (Object.keys(a).length) {
    a.name = e.airportLongName ?? null;
    airports[e.airportId] = a;
  }
}

// Only rewrite when the airport data changed, so the fetch time stays honest
// about the last successful pull while avoiding needless commits.
const next = { fetchedAt: new Date().toISOString(), airports };
if (existsSync(out)) {
  try {
    const prev = JSON.parse(readFileSync(out, "utf8"));
    const age = Date.now() - Date.parse(prev.fetchedAt);
    if (JSON.stringify(prev.airports) === JSON.stringify(airports) && age < 4 * 60 * 1000) {
      console.log("unchanged");
      process.exit(0);
    }
  } catch {}
}
writeFileSync(out, JSON.stringify(next, null, 1) + "\n");
console.log(`wrote ${Object.keys(airports).length} airports`);
