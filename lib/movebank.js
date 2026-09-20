// Shared Movebank fetch/parse logic — used by both
// app/api/birds/route.js and app/api/hazards/route.js
// so there's one source of truth and no duplicate network calls.

import STUDIES from "../app/api/birds/studies.json";

const LOOKBACK_HOURS = 168;

// Retry/backoff config for rate-limited (429) requests
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000; // 1s, 2s, 4s...

// Movebank's API docs state the real limit:
// "one concurrent request per IP and 20 concurrent requests total."
// We use one request at a time to avoid rate limiting.
const BATCH_SIZE = 1;

// Delay between each sequential request, on top of the request's
// own round-trip time, as extra headroom against rate limiting.
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

  const start = new Date(
    now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000
  );

  const params = new URLSearchParams();

  params.set("entity_type", "event");
  params.set("study_id", String(studyId));
  params.set("sensor_type_id", "653"); // GPS

  params.set(
    "attributes",
    [
      "individual_local_identifier",
      "tag_local_identifier",
      "timestamp",
      "location_long",
      "location_lat",
      "visible",
      "individual_taxon_canonical_name",
    ].join(",")
  );

  params.set(
    "timestamp_start",
    formatMovebankTimestamp(start)
  );

  params.set(
    "timestamp_end",
    formatMovebankTimestamp(now)
  );

  return `https://www.movebank.org/movebank/service/direct-read?${params.toString()}`;
}

function parseCsv(text) {
  const lines = text.trim().split("\n");

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((h) =>
      h.replace(/^"+|"+$/g, "").trim()
    );

  return lines.slice(1).map((line) => {
    const values = line
      .split(",")
      .map((v) =>
        v.replace(/^"+|"+$/g, "").trim()
      );

    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    return row;
  });
}

function cleanCsvString(value) {
  if (typeof value !== "string") {
    return value;
  }

  // Some Movebank studies' CSV export leaves stray quote
  // characters on fields. Remove them.
  return value.replace(/"/g, "").trim();
}

function groupByIndividual(rows, studyId) {
  const byId = {};

  for (const row of rows) {
    const localId = row.individual_local_identifier;

    if (!localId) {
      continue;
    }

    // Skip hidden records
    if (row.visible === "false") {
      continue;
    }

    const lat = parseFloat(row.location_lat);
    const lng = parseFloat(row.location_long);

    // Skip invalid coordinates
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      continue;
    }

    const key = `${studyId}:${localId}`;

    if (!byId[key]) {
      byId[key] = {
        individual_local_identifier:
          cleanCsvString(localId),

        individual_taxon_canonical_name:
          cleanCsvString(
            row.individual_taxon_canonical_name
          ),

        study_id: studyId,

        locations: [],
      };
    }

    byId[key].locations.push({
      timestamp: new Date(
        row.timestamp.replace(" ", "T") + "Z"
      ).getTime(),

      location_lat: lat,

      location_long: lng,
    });
  }

  // Sort each bird's locations chronologically
  Object.values(byId).forEach((individual) => {
    individual.locations.sort(
      (a, b) => a.timestamp - b.timestamp
    );
  });

  return Object.values(byId);
}

function buildAuthHeaders() {
  const username = process.env.MOVEBANK_USERNAME;
  const password = process.env.MOVEBANK_PASSWORD;

  if (!username || !password) {
    return {};
  }

  const encoded = Buffer.from(
    `${username}:${password}`
  ).toString("base64");

  return {
    Authorization: `Basic ${encoded}`,
  };
}

// Fetch a single study, retrying with exponential backoff
// if Movebank returns 429 (rate limited).
async function fetchStudyWithRetry(study) {
  let lastStatus;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    const res = await fetch(buildUrl(study.id), {
      headers: buildAuthHeaders(),

      // Skip Next.js fetch cache because some studies return
      // multi-megabyte responses.
      cache: "no-store",
    });

    if (res.status !== 429) {
      return res;
    }

    lastStatus = res.status;

    if (attempt < MAX_RETRIES) {
      const retryAfterHeader =
        res.headers.get("retry-after");

      const retryAfterMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : null;

      const backoffMs =
        retryAfterMs &&
        !Number.isNaN(retryAfterMs)
          ? retryAfterMs
          : BASE_BACKOFF_MS * 2 ** attempt;

      await sleep(backoffMs);
    }
  }

  // Exhausted retries.
  // Return a response-like object so the caller's
  // res.ok / res.status checks still work.
  return {
    ok: false,
    status: lastStatus ?? 429,
  };
}

async function fetchStudy(study) {
  const res = await fetchStudyWithRetry(study);

  if (!res.ok) {
    return {
      study,
      error: `fetch failed: ${res.status}`,
      individuals: [],
    };
  }

  const text = await res.text();

  // Movebank sometimes returns HTML when a study's
  // license terms haven't been accepted.
  if (text.trim().startsWith("<")) {
    return {
      study,

      error:
        "license terms not yet accepted for this study — log into movebank.org and accept once",

      individuals: [],
    };
  }

  const rows = parseCsv(text);

  const individuals = groupByIndividual(
    rows,
    study.id
  );

  return {
    study,
    error: null,
    individuals,
  };
}

// In-memory cache for the combined result.
//
// This persists as long as the server process stays running.
// In a serverless deployment, a shared store such as Redis
// would be needed for persistent caching.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedResult = null;
let cachedAt = 0;

// Public entry point.
//
// Fetches all configured studies, merges their results,
// and returns:
// {
//   individuals: [...],
//   errors: [...]
// }
export async function fetchAllBirds() {
  const now = Date.now();

  // Return cached data if it's still fresh.
  if (
    cachedResult &&
    now - cachedAt < CACHE_TTL_MS
  ) {
    return cachedResult;
  }

  const settled = [];

  // Fetch studies sequentially to respect Movebank's
  // concurrent-request limitations.
  for (
    let i = 0;
    i < STUDIES.length;
    i += BATCH_SIZE
  ) {
    const batch = STUDIES.slice(
      i,
      i + BATCH_SIZE
    );

    const batchResults = await Promise.all(
      batch.map(fetchStudy)
    );

    settled.push(...batchResults);

    const isLastBatch =
      i + BATCH_SIZE >= STUDIES.length;

    if (!isLastBatch) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Combine all birds from all studies.
  const individuals = settled.flatMap(
    (result) => result.individuals
  );

  // Collect errors without failing the entire request.
  const errors = settled
    .filter((result) => result.error)
    .map(
      (result) =>
        `${result.study.label}: ${result.error}`
    );

  cachedResult = {
    individuals,
    errors,
  };

  cachedAt = now;

  return cachedResult;
}
