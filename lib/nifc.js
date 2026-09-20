
// lib/nifc.js - Balanced Global Live Fire Data (Optimized for Europe & World)
export async function fetchFires() {
  const MAP_KEY = process.env.FIRMS_MAP_KEY;


  if (!MAP_KEY) {
    throw new Error("FIRMS_MAP_KEY is not set in environment variables");
  }


  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_SNPP_NRT/world/2`;


  const res = await fetch(url, { cache: 'no-store' });


  if (!res.ok) {
    throw new Error("Failed to fetch live NASA data: " + res.status);
  }


  const csvText = await res.text();  
  const lines = csvText.trim().split("\n");


  if (lines.length === 1 && !lines[0].includes(",")) {
    throw new Error(`FIRMS API error: ${lines[0]}`);
  }


  if (lines.length <= 1) {
    return { type: "FeatureCollection", features: [] };
  }


  const headers = lines[0].split(",");
  const latIndex = headers.indexOf("latitude");
  const lonIndex = headers.indexOf("longitude");
  const brightIndex = headers.indexOf("brightness") !== -1 ? headers.indexOf("brightness") : headers.indexOf("bright_ti4");
  const confidenceIndex = headers.indexOf("confidence");


  if (latIndex === -1 || lonIndex === -1) {
    throw new Error("Unexpected FIRMS CSV format: missing latitude/longitude columns");
  }


  let rawFeatures = [];


  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    const lat = parseFloat(row[latIndex]);
    const lon = parseFloat(row[lonIndex]);
    const brightness = parseFloat(row[brightIndex]) || 0;
    const confidence = confidenceIndex !== -1 ? row[confidenceIndex] : 'high';


    if (!isNaN(lat) && !isNaN(lon)) {
      // Filter out low-confidence background noise
      const isLowConfidence = confidence === 'l' || confidence === 'low';
      if (isLowConfidence && brightness < 310) continue;


      rawFeatures.push({
        brightness,
        feature: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lon, lat]
          },
          properties: {
            IncidentName: `Global Thermal Hotspot (Brightness: ${brightness})`
          }
        }
      });
    }
  }


  // Sort by highest brightness/intensity first
  rawFeatures.sort((a, b) => b.brightness - a.brightness);


  // BALANCED CAP: Bumping to 2,500 ensures Europe gets plenty of detailed coverage
  // while keeping the browser load lightning fast.
  const cappedFeatures = rawFeatures.slice(0, 5000).map(item => item.feature);


  return {
    type: "FeatureCollection",
    features: cappedFeatures
  };
}

