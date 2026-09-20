// lib/nifc.js - Live Global Fire Data via NASA FIRMS CSV API
export async function fetchFires() {
  const MAP_KEY = process.env.FIRMS_MAP_KEY;

  if (!MAP_KEY) {
    throw new Error("FIRMS_MAP_KEY is not set in environment variables");
  }

  // Pulling 3 days of live VIIRS/MODIS thermal anomalies worldwide ("world" instead of a bounding box)
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_SNPP_NRT/world/3`;

  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error("Failed to fetch live NASA data: " + res.status);
  }

  const csvText = await res.text();
  const lines = csvText.trim().split("\n");

  // FIRMS returns plain-text errors (e.g. "Invalid MAP_KEY" or
  // "No transactions left for this MAP_KEY") instead of CSV when
  // something is wrong. Those come back as a single line with no commas,
  // so catch that case explicitly instead of treating it as "zero fires".
  if (lines.length === 1 && !lines[0].includes(",")) {
    throw new Error(`FIRMS API error: ${lines[0]}`);
  }

  if (lines.length <= 1) {
    // Valid CSV with header row only — genuinely zero fires detected
    return { type: "FeatureCollection", features: [] };
  }

  // Parse CSV headers
  const headers = lines[0].split(",");
  const latIndex = headers.indexOf("latitude");
  const lonIndex = headers.indexOf("longitude");
  const brightIndex = headers.indexOf("brightness") !== -1 ? headers.indexOf("brightness") : headers.indexOf("bright_ti4");

  if (latIndex === -1 || lonIndex === -1) {
    throw new Error("Unexpected FIRMS CSV format: missing latitude/longitude columns");
  }

  const features = [];

  // Loop through CSV rows and convert to GeoJSON points
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    const lat = parseFloat(row[latIndex]);
    const lon = parseFloat(row[lonIndex]);

    if (!isNaN(lat) && !isNaN(lon)) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lon, lat] // GeoJSON expects [longitude, latitude]
        },
        properties: {
          IncidentName: `Live Thermal Hotspot (${row[brightIndex] || 'Active'})`
        }
      });
    }
  }

  return {
    type: "FeatureCollection",
    features: features
  };
}