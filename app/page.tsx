"use client";

import { useEffect, useRef } from "react";
import { Map, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type BirdLocation = {
  timestamp: number;
  location_lat: number;
  location_long: number;
};

type BirdIndividual = {
  individual_local_identifier: string;
  individual_taxon_canonical_name: string;
  study_id: number;
  locations: BirdLocation[];
};

type BirdApiResponse = {
  individuals: BirdIndividual[];
  partialErrors?: string[];
};

const COLORS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    // ==========================================
    // CREATE MAP
    // ==========================================

    const map = new Map({
      container: mapContainerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [2.8326, 50.3174],
      zoom: 12,
    });

    mapRef.current = map;

    // ==========================================
    // MAP LOAD
    // ==========================================

    map.on("load", async () => {
      console.log("Map loaded");

      // ========================================
      // TEST POINT
      // ========================================

      map.addSource("test-point", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [2.8326, 50.3174],
          },
          properties: {},
        },
      });

      map.addLayer({
        id: "test-point-layer",
        type: "circle",
        source: "test-point",
        paint: {
          "circle-radius": 15,
          "circle-color": "#ff0000",
          "circle-stroke-width": 4,
          "circle-stroke-color": "#ffffff",
        },
      });

      // ========================================
      // TEST LINE
      // ========================================

      map.addSource("test-line", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
  [2.80, 50.30],
  [2.82, 50.31],
  [2.84, 50.32],
  [2.86, 50.33],
],
          },
        },
      });

      map.addLayer({
  id: "test-line-layer",
  type: "line",
  source: "test-line",

  layout: {
    "line-cap": "round",
    "line-join": "round",
  },

  paint: {
    "line-color": "#ff0000",
    "line-width": 12,
    "line-opacity": 1,
  },
});

// Force the line above all existing map layers
map.moveLayer("test-line-layer");

console.log("TEST LINE ADDED");
console.log(
  "Test line layer:",
  map.getLayer("test-line-layer")
);

      console.log(
        "TEST LINE SOURCE:",
        map.getSource("test-line")
      );

      console.log(
        "TEST LINE LAYER:",
        map.getLayer("test-line-layer")
      );

      // ========================================
      // GET BIRD DATA
      // ========================================

      try {
        const birdsRes = await fetch("/api/birds");

        if (!birdsRes.ok) {
          throw new Error(
            `Bird API returned ${birdsRes.status}`
          );
        }

        const birdsData: BirdApiResponse =
          await birdsRes.json();

        console.log("Bird data:", birdsData);

        console.log(
          "Number of birds:",
          birdsData.individuals.length
        );

        if (birdsData.partialErrors) {
          console.warn(
            "Movebank errors:",
            birdsData.partialErrors
          );
        }

        // ========================================
        // CREATE LAYERS FOR EACH BIRD
        // ========================================

        birdsData.individuals.forEach((bird, index) => {
          console.log(
            `Bird ${bird.individual_local_identifier}:`,
            bird.locations.length,
            "locations"
          );

          if (bird.locations.length === 0) {
            return;
          }

          // Give each bird its own color.
          const color =
            COLORS[index % COLORS.length];

          // ======================================
          // SORT LOCATIONS BY TIME
          // ======================================

          const locations = [...bird.locations].sort(
            (a, b) => a.timestamp - b.timestamp
          );

          // ======================================
          // VALIDATE COORDINATES
          // ======================================

          const validLocations =
            locations.filter(
              (location) =>
                Number.isFinite(
                  location.location_long
                ) &&
                Number.isFinite(
                  location.location_lat
                ) &&
                location.location_long >= -180 &&
                location.location_long <= 180 &&
                location.location_lat >= -90 &&
                location.location_lat <= 90
            );

          console.log(
            "VALID LOCATIONS:",
            bird.individual_local_identifier,
            validLocations.length,
            validLocations
          );

          if (validLocations.length === 0) {
            console.warn(
              `No valid coordinates for bird ${bird.individual_local_identifier}`
            );
            return;
          }

          // ======================================
          // UNIQUE IDS
          // ======================================

          const id =
            `${bird.study_id}-${bird.individual_local_identifier}`
              .replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
              );

          const pointSourceId =
            `bird-points-${id}`;

          const pointLayerId =
            `bird-points-layer-${id}`;

          const lineSourceId =
            `bird-line-${id}`;

          const lineLayerId =
            `bird-line-layer-${id}`;

          // ======================================
          // LINE SOURCE
          // ======================================

          if (validLocations.length >= 2) {
            const lineCoordinates =
              validLocations.map(
                (location) => [
                  location.location_long,
                  location.location_lat,
                ]
              );

            console.log(
              "LINE COORDINATES:",
              bird.individual_local_identifier,
              lineCoordinates
            );

            map.addSource(lineSourceId, {
              type: "geojson",

              data: {
                type: "Feature",

                properties: {
                  identifier:
                    bird.individual_local_identifier,

                  species:
                    bird.individual_taxon_canonical_name,

                  study_id: bird.study_id,
                },

                geometry: {
                  type: "LineString",

                  coordinates: lineCoordinates,
                },
              },
            });

            // ==================================
            // LINE LAYER
            // ==================================

            map.addLayer({
              id: lineLayerId,

              type: "line",

              source: lineSourceId,

              layout: {
                "line-join": "round",
                "line-cap": "round",
              },

              paint: {
                "line-color": color,
                "line-width": 4,
                "line-opacity": 1,
              },
            });

            console.log(
              "ADDED BIRD LINE:",
              bird.individual_local_identifier,
              validLocations.length,
              "coordinates"
            );
          } else {
            console.warn(
              "Not enough locations for line:",
              bird.individual_local_identifier,
              validLocations.length
            );
          }

          // ======================================
          // POINT SOURCE
          // ======================================

          map.addSource(pointSourceId, {
            type: "geojson",

            data: {
              type: "FeatureCollection",

              features: validLocations.map(
                (location) => ({
                  type: "Feature",

                  geometry: {
                    type: "Point",

                    coordinates: [
                      location.location_long,
                      location.location_lat,
                    ],
                  },

                  properties: {
                    identifier:
                      bird.individual_local_identifier,

                    species:
                      bird.individual_taxon_canonical_name,

                    study_id:
                      bird.study_id,

                    timestamp:
                      location.timestamp,

                    time_readable:
                      new Date(
                        location.timestamp
                      ).toLocaleString(),
                  },
                })
              ),
            },
          });

          // ======================================
          // POINT LAYER
          // ======================================

          map.addLayer({
            id: pointLayerId,

            type: "circle",

            source: pointSourceId,

            paint: {
              "circle-radius": 7,

              "circle-color": color,

              "circle-opacity": 1,

              "circle-stroke-width": 2,

              "circle-stroke-color":
                "#ffffff",
            },
          });

          console.log(
            "ADDED BIRD POINTS:",
            bird.individual_local_identifier
          );

          // ======================================
          // CLICK ON POINT
          // ======================================

          map.on(
            "click",
            pointLayerId,
            (event) => {
              const feature =
                event.features?.[0];

              if (!feature) {
                return;
              }

              if (
                feature.geometry.type !==
                "Point"
              ) {
                return;
              }

              const coordinates =
                feature.geometry
                  .coordinates as [
                  number,
                  number
                ];

              const properties =
                feature.properties;

              new Popup()
                .setLngLat(coordinates)
                .setHTML(
                  `
                    <strong>
                      ${
                        properties?.species ??
                        "Unknown species"
                      }
                    </strong>
                    <br />
                    Bird ID:
                    ${
                      properties?.identifier ??
                      "Unknown"
                    }
                    <br />
                    Study:
                    ${
                      properties?.study_id ??
                      "Unknown"
                    }
                    <br />
                    Time:
                    ${
                      properties?.time_readable ??
                      "Unknown"
                    }
                  `
                )
                .addTo(map);
            }
          );

          // ======================================
          // POINTER
          // ======================================

          map.on(
            "mouseenter",
            pointLayerId,
            () => {
              map.getCanvas().style.cursor =
                "pointer";
            }
          );

          map.on(
            "mouseleave",
            pointLayerId,
            () => {
              map.getCanvas().style.cursor =
                "";
            }
          );
        });
      } catch (error) {
        console.error(
          "Failed to load bird data:",
          error
        );
      }
    });

    // ==========================================
    // CLEANUP
    // ==========================================

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-screen"
    />
  );
}