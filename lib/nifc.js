// lib/nifc.js - Live Western Europe Fire Data via NASA FIRMS CSV API
export async function fetchFires() {
  const MAP_KEY = "7517e2b3dbc1a8980b42bdfc1df2240a"; 
  
  // Western Europe bounding box: [West, South, East, North] covering Spain, France, Italy, UK, etc.
  // Format: minLon,minLat,maxLon,maxLat
  const bbox = "-10,35,20,60";
  
  // Pulling 1 day of live VIIRS/MODIS thermal anomalies for Western Europe
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_SNPP_NRT/${bbox}/1`;

  const res = await fetch(url, { cache: 'no-store' });
  
  if (!res.ok) {
    throw new Error("Failed to fetch live NASA data: " + res.status);
  }

  const csvText = await res.text();
  const lines = csvText.trim().split("\n");
  
  if (lines.length <= 1) {
    // If no fires found or invalid key response
    return { type: "FeatureCollection", features: [] };
  }

  // Parse CSV headers
  const headers = lines[0].split(",");
  const latIndex = headers.indexOf("latitude");
  const lonIndex = headers.indexOf("longitude");
  const brightIndex = headers.indexOf("brightness") !== -1 ? headers.indexOf("brightness") : headers.indexOf("bright_ti4");

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