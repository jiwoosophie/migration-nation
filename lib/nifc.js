// Shared NIFC fetch logic — used by both app/api/wildfires/route.js and
// app/api/hazards/route.js.

const NIFC_URL =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson";

// Returns a raw GeoJSON FeatureCollection ({ type, features }), or throws
// on failure. Kept as raw GeoJSON (not wrapped) here because this is the
// shape app/api/hazards/route.js needs for turf's polygon checks — the
// wildfires route wraps this in its own {success, count, fires} shape.
export async function fetchFires() {
  const res = await fetch(NIFC_URL, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error("External API responded with status " + res.status);
  }
  return res.json();
}