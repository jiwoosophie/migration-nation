// Shared Movebank fetch/parse logic — used by both app/api/birds/route.js
// and app/api/hazards/route.js so there's one source of truth and no
// duplicate network calls between routes.

const STUDIES = [
  {
    id: 1258895879,
    label: "DELTATRACK — gulls, Neeltje Jans (Netherlands)",
  },
  {
    id: 22390461,
    label: "Arctic breeding shorebirds; Rausch; various Canadian arctic locations",
  },
  {
    id:	5620521529,
    label: "Birds of prey (B. buteo, C. aeruginosus, C. pomarina) Latvia"
  },
  // {
  //   id: 0000000000,
  //   label: "MEDGULL_ANTWERPEN — Mediterranean gulls, Antwerp (Belgium)",
  // },
];

const LOOKBACK_HOURS = 72;
 
function formatMovebankTimestamp(date) {
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
 
function buildUrl(studyId) {
  const now = new Date();
  const start = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
 
  const params = new URLSearchParams();
  params.set("entity_type", "event");
  params.set("study_id", String(studyId));
  params.set("sensor_type_id", "653"); // GPS
  params.set(
    "attributes",
    "individual_local_identifier,tag_local_identifier,timestamp,location_long,location_lat,visible,individual_taxon_canonical_name"
  );
  params.set("timestamp_start", formatMovebankTimestamp(start));
  params.set("timestamp_end", formatMovebankTimestamp(now));
 
  return `https://www.movebank.org/movebank/service/direct-read?${params.toString()}`;
}
 
function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/^"+|"+$/g, "").trim());
 
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.replace(/^"+|"+$/g, "").trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
}
 
function groupByIndividual(rows, studyId) {
  const byId = {};
 
  for (const row of rows) {
    const localId = row.individual_local_identifier;
    if (!localId) continue;
    if (row.visible === "false") continue;
 
    const lat = parseFloat(row.location_lat);
    const lng = parseFloat(row.location_long);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
 
    const key = `${studyId}:${localId}`;
 
    if (!byId[key]) {
      byId[key] = {
        individual_local_identifier: localId,
        individual_taxon_canonical_name: row.individual_taxon_canonical_name,
        study_id: studyId,
        locations: [],
      };
    }
 
    byId[key].locations.push({
      timestamp: new Date(row.timestamp.replace(" ", "T") + "Z").getTime(),
      location_lat: lat,
      location_long: lng,
    });
  }
 
  Object.values(byId).forEach((ind) => {
    ind.locations.sort((a, b) => a.timestamp - b.timestamp);
  });
 
  return Object.values(byId);
}
 
function buildAuthHeaders() {
  const username = process.env.MOVEBANK_USERNAME;
  const password = process.env.MOVEBANK_PASSWORD;
  if (!username || !password) return {};
  const encoded = Buffer.from(`${username}:${password}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}
 
async function fetchStudy(study) {
  const res = await fetch(buildUrl(study.id), {
    headers: buildAuthHeaders(),
    next: { revalidate: 300 },
  });
 
  if (!res.ok) {
    return { study, error: `fetch failed: ${res.status}`, individuals: [] };
  }
 
  const text = await res.text();
 
  if (text.trim().startsWith("<")) {
    return {
      study,
      error:
        "license terms not yet accepted for this study — log into movebank.org and accept once",
      individuals: [],
    };
  }
 
  const rows = parseCsv(text);
  const individuals = groupByIndividual(rows, study.id);
  return { study, error: null, individuals };
}
 
// Public entry point: fetch all configured studies, merge results.
export async function fetchAllBirds() {
  const results = await Promise.all(STUDIES.map(fetchStudy));
  const individuals = results.flatMap((r) => r.individuals);
  const errors = results
    .filter((r) => r.error)
    .map((r) => `${r.study.label}: ${r.error}`);
  return { individuals, errors };
}