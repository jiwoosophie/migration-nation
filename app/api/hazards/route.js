import { NextResponse } from "next/server";
import * as turf from "@turf/turf";
import { fetchAllBirds } from "@/lib/movebank";
import { fetchFires } from "@/lib/nifc";

/**
 * GET /api/hazards
 *
 * Returns everything the Mapbox frontend needs in one call, as GeoJSON:
 *
 * {
 *   birds: {
 *     type: "FeatureCollection",
 *     features: [
 *       {
 *         type: "Feature",
 *         geometry: { type: "Point", coordinates: [lng, lat] },
 *         properties: {
 *           individual_local_identifier: "...",
 *           species: "...",
 *           study_id: 1258895879,
 *           timestamp: 1234567890000,   // ms since epoch, latest ping
 *           in_hazard: true | false,
 *           hazard_names: ["Some Fire Name"],
 *           trail: [[lng, lat], [lng, lat], ...]  // recent path, oldest -> newest
 *         }
 *       },
 *       ...
 *     ]
 *   },
 *   fires: {
 *     type: "FeatureCollection",
 *     features: [ ...NIFC polygons, unmodified... ]
 *   },
 *   meta: {
 *     birdCount: number,
 *     fireCount: number,
 *     inHazardCount: number,
 *     generatedAt: "2026-09-19T12:00:00.000Z"
 *   }
 * }
 *
 * Mapbox GL usage on the frontend is then just:
 *   map.addSource("birds", { type: "geojson", data: hazardsResponse.birds });
 *   map.addSource("fires", { type: "geojson", data: hazardsResponse.fires });
 */

function birdToFeature(individual, fires) {
  const locations = individual.locations;
  const latest = locations[locations.length - 1];
  const point = turf.point([latest.location_long, latest.location_lat]);

  const hazardNames = [];
  for (const fireFeature of fires.features || []) {
    try {
      if (turf.booleanPointInPolygon(point, fireFeature)) {
        hazardNames.push(
          fireFeature.properties?.poly_IncidentName || "Unnamed fire"
        );
      }
    } catch {
      // skip malformed multipolygons rather than fail the whole response
    }
  }

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [latest.location_long, latest.location_lat],
    },
    properties: {
      individual_local_identifier: individual.individual_local_identifier,
      species: individual.individual_taxon_canonical_name || null,
      study_id: individual.study_id,
      timestamp: latest.timestamp,
      in_hazard: hazardNames.length > 0,
      hazard_names: hazardNames,
      trail: locations.map((loc) => [loc.location_long, loc.location_lat]),
    },
  };
}

export async function GET() {
  try {
    const [birdsResult, fires] = await Promise.all([
      fetchAllBirds(),
      fetchFires(),
    ]);

    const { individuals, errors } = birdsResult;

    const birdFeatures = individuals
      .filter((ind) => ind.locations && ind.locations.length > 0)
      .map((ind) => birdToFeature(ind, fires));

    const birds = { type: "FeatureCollection", features: birdFeatures };
    const inHazardCount = birdFeatures.filter(
      (f) => f.properties.in_hazard
    ).length;

    return NextResponse.json({
      birds,
      fires,
      meta: {
        birdCount: birdFeatures.length,
        fireCount: fires.features?.length ?? 0,
        inHazardCount,
        generatedAt: new Date().toISOString(),
      },
      ...(errors.length ? { partialErrors: errors } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}