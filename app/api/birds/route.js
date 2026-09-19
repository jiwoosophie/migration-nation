import { NextResponse } from "next/server";

// DELTATRACK — Herring gulls & lesser black-backed gulls breeding at
// Neeltje Jans (Netherlands). Public, CC_0, ~99 individuals, actively
// reporting as of Sept 2026.
const STUDY_ID = 1258895879;

// Only pull events from the last N hours — keeps payload small and
// keeps the map focused on "where are they right now" rather than
// full historical trails.
const LOOKBACK_HOURS = 72;

function formatMovebankTimestamp(date) {
  // Movebank's CSV/direct-read endpoint wants yyyyMMddHHmmssSSS (UTC)
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    pad(date.getUTCMilliseconds(), 3)
  );
}

function buildUrl() {
  const now = new Date();
  const start = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);

  const params = new URLSearchParams();
  params.set("entity_type", "event");
  params.set("study_id", String(STUDY_ID));
  params.set("sensor_type_id", "653"); // GPS
  params.set(
    "attributes",
    "individual_local_identifier,tag_local_identifier,timestamp,location_long,location_lat,visible,individual_taxon_canonical_name"
  );
  params.set("timestamp_start", formatMovebankTimestamp(start));
  params.set("timestamp_end", formatMovebankTimestamp(now));

  return `https://www.movebank.org/movebank/service/direct-read?${params.toString()}`;
}

// Very small CSV parser — safe here because none of the requested
// attributes contain embedded commas or quoted newlines.
function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
}

// Reshape flat CSV rows into the same { individuals: [...] } shape the
// frontend component already expects from the old JSON endpoint.
function groupByIndividual(rows) {
  const byId = {};

  for (const row of rows) {
    const id = row.individual_local_identifier;
    if (!id) continue;
    if (row.visible === "false") continue; // skip flagged outliers

    const lat = parseFloat(row.location_lat);
    const lng = parseFloat(row.location_long);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    if (!byId[id]) {
      byId[id] = {
        individual_local_identifier: id,
        individual_taxon_canonical_name: row.individual_taxon_canonical_name,
        locations: [],
      };
    }

    byId[id].locations.push({
      timestamp: new Date(row.timestamp.replace(" ", "T") + "Z").getTime(),
      location_lat: lat,
      location_long: lng,
    });
  }

  // sort each bird's locations oldest -> newest, matching what the
  // map component expects (it reads the last item as "latest")
  Object.values(byId).forEach((ind) => {
    ind.locations.sort((a, b) => a.timestamp - b.timestamp);
  });

  return Object.values(byId);
}

export async function GET() {
  try {
    const res = await fetch(buildUrl(), { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Movebank fetch failed: ${res.status}` },
        { status: 502 }
      );
    }
    const text = await res.text();

    // Movebank returns an HTML license-terms page instead of CSV if
    // terms haven't been accepted yet for this study/account.
    if (text.trim().startsWith("<")) {
      return NextResponse.json(
        {
          error:
            "Movebank returned license terms instead of data — log into movebank.org and accept the terms for this study once, then retry.",
        },
        { status: 403 }
      );
    }

    const rows = parseCsv(text);
    const individuals = groupByIndividual(rows);

    return NextResponse.json({ individuals });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}