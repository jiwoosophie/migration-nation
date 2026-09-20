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
    id: 1609400843,
    label: "MEDGULL_ANTWERPEN — Mediterranean gulls, Antwerp (Belgium)",
  },
  {
    id: 1259686571,
    label: "LBBG_JUVENILE — Juvenile lesser black-backed gulls & herring gulls, Zeebrugge (Belgium)",
  },
  {
    id: 1841091905,
    label: "CURLEW_VLAANDEREN — Eurasian curlews, Flanders (Belgium)",
  },
  {
    id: 2313947453,
    label: "SPOONBILL_VLAANDEREN — Eurasian spoonbills, Flanders (Belgium)",
  },
  {
    id: 4194049025,
    label: "ARMENIAN_GULL — Armenian gulls, Sevan & Lake Arpi National Parks (Armenia)",
  },
  {
    id: 1233933180,
    label: "Multi-Scale Spatial and Movement Ecology of Gray Hawks in a Fragmented Subtropical Landscape",
  },
  {
    id: 9343041295,
    label: "RRP_VLAANDEREN — Rose-ringed parakeets, Ghent (Belgium)",
  },
  {
    id: 1278021460,
    label: "BOP_RODENT — Rodent specialized birds of prey, Flanders (Belgium)",
  },
  {
    id: 7675204759,
    label: "TURTUR_VLAANDEREN — European turtle doves, Flanders (Belgium)",
  },
  {
    id: 1229945587,
    label: "Common Crane 2020 (Lithuanian University of Educational Studies; LEU)",
  },
  {
    id: 1941203363,
    label: "South Africa vultures VfA MPIAB",
  },
  {
    id: 10449318,
    label: "LifeTrack White Stork Loburg",
  },
  {
    id: 430263960,
    label: "Bald Eagle (Haliaeetus leucocephalus) in the Pacific Northwest",
  },
  {
    id: 3413045568,
    label: "Habitrack European Turtle Dove",
  },
  {
    id: 42451582,
    label: "Long-billed Curlew Migration from the Intermountain West",
  },
  {
    id: 2217728245,
    label: "HG_JUVENILE — Juvenile herring gulls, southern North Sea coast (Belgium)",
  },
  {
    id: 2961927604,
    label: "(EBD) Lesser Kestrel (Falco naumanni) Spain, MERCURIO-SUMHAL",
  },
  {
    id: 481458,
    label: "Vultures Acopian Center USA GPS",
  },
  {
    id: 186178781,
    label: "Raptors NABU Moessingen public",
  },
  {
    id: 21231406,
    label: "LifeTrack White Stork SW Germany",
  },
  {
    id: 1393954358,
    label: "Cathartes aura MPIAB Cuba",
  },
  {
    id: 28691134,
    label: "Broad-winged Hawk habitat use, range, and movement ecology",
  },
];

const LOOKBACK_HOURS = 72;

// Retry/backoff config for rate-limited (429) requests
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000; // 1s, 2s, 4s...

// Movebank's own API docs state the real limit: "one concurrent request
// per IP and 20 concurrent requests total." Firing 5 at once (our previous
// approach) violated this — it usually worked because most of the 5 still
// resolved, but occasionally one straggler got rejected with a 429, which
// is exactly what we were seeing intermittently. Setting BATCH_SIZE to 1
// makes every study fetch fully sequential, matching the documented rule.
const BATCH_SIZE = 1;

// Delay between each sequential request, on top of the request's own
// round-trip time, as extra headroom against rate limiting.
const BATCH_DELAY_MS = 750;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function cleanCsvString(value) {
  if (typeof value !== "string") return value;
  // Some Movebank studies' CSV export leaves a stray trailing quote
  // character on this field (e.g. "Larus fuscus\"") that our normal
  // per-value quote trimming in parseCsv doesn't fully catch. Strip any
  // leftover quote characters wherever they appear, not just the edges.
  return value.replace(/"/g, "").trim();
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
        individual_local_identifier: cleanCsvString(localId),
        individual_taxon_canonical_name: cleanCsvString(
          row.individual_taxon_canonical_name
        ),
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

// Fetch a single study, retrying with exponential backoff if Movebank
// returns 429 (rate limited). Honors a Retry-After header if present.
async function fetchStudyWithRetry(study) {
  let lastStatus;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(buildUrl(study.id), {
      headers: buildAuthHeaders(),
      // Some studies (e.g. MigraLion, with 500+ individuals) return
      // multi-megabyte responses that exceed Next.js's 2MB data-cache
      // limit per item, which throws a noisy "Failed to set fetch cache"
      // error. Rather than caching some studies and not others depending
      // on their size, skip Next's fetch cache entirely for these calls.
      cache: "no-store",
    });

    if (res.status !== 429) {
      return res;
    }

    lastStatus = res.status;

    if (attempt < MAX_RETRIES) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : null;
      const backoffMs =
        retryAfterMs && !Number.isNaN(retryAfterMs)
          ? retryAfterMs
          : BASE_BACKOFF_MS * 2 ** attempt;

      await sleep(backoffMs);
    }
  }

  // Exhausted retries — return a synthetic response-like object so the
  // caller's res.ok / res.status checks still work.
  return { ok: false, status: lastStatus ?? 429 };
}

async function fetchStudy(study) {
  const res = await fetchStudyWithRetry(study);

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

// Our own in-memory cache for the combined result, since Next's built-in
// fetch cache can't handle several of these studies' multi-megabyte
// payloads. This lives in module scope, so it persists across requests
// as long as the server process stays running (works well in dev and in
// a normal long-running Node server; a serverless/edge deployment that
// spins up a fresh process per request wouldn't benefit from this and
// would need a shared store like Redis instead).
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedResult = null;
let cachedAt = 0;

// Public entry point: fetch all configured studies, merge results.
// Studies are fetched in batches of BATCH_SIZE, with each batch fully
// resolved (all requests done) before the next batch starts, so no more
// than BATCH_SIZE requests are ever in flight at once — this is what
// actually avoids Movebank's concurrent-connection rate limit, as opposed
// to just staggering start times.
export async function fetchAllBirds() {
  const now = Date.now();
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }

  const settled = [];

  for (let i = 0; i < STUDIES.length; i += BATCH_SIZE) {
    const batch = STUDIES.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchStudy));
    settled.push(...batchResults);

    const isLastBatch = i + BATCH_SIZE >= STUDIES.length;
    if (!isLastBatch) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const individuals = settled.flatMap((r) => r.individuals);
  const errors = settled
    .filter((r) => r.error)
    .map((r) => `${r.study.label}: ${r.error}`);

  cachedResult = { individuals, errors };
  cachedAt = now;

  return cachedResult;
}