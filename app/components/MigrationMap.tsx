"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

type Location = {
  timestamp: number;
  location_lat: number;
  location_long: number;
};

type Individual = {
  individual_local_identifier: string;
  individual_taxon_canonical_name?: string;
  study_id: number;
  locations: Location[];
};

type Props = {
  individuals: Individual[];
  wildfires: any[];
};

// Default bird color: warm amber instead of the old blue, which blended
// into the map's water/land tiles. Selected bird color matches the site's
// pink brand accent so the highlighted path reads as "active/selected."
const BIRD_DEFAULT_COLOR = "#FFB800";
const BIRD_SELECTED_COLOR = "#E63989";

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function getBirdKey(bird: Individual) {
  return `${bird.study_id}-${bird.individual_local_identifier}`;
}

function formatTimestamp(timestamp: number | undefined) {
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getAllCoordinates(
  individuals: Individual[],
  wildfires: any[]
): [number, number][] {
  const coordinates: [number, number][] = [];

  for (const bird of individuals) {
    for (const location of bird.locations) {
      if (isValidCoord(location.location_lat, location.location_long)) {
        coordinates.push([location.location_lat, location.location_long]);
      }
    }
  }

  for (const fire of wildfires) {
    const coords = fire?.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (isValidCoord(lat, lng)) {
      coordinates.push([lat, lng]);
    }
  }

  return coordinates;
}

// Leaflet measures its container's size once on init. If that happens
// before the surrounding layout (loading states, dynamic import, flex
// containers) has settled into its final size, the map renders broken —
// often as a repeating, badly-zoomed world. Forcing a size recheck shortly
// after mount fixes this without needing to restructure the loading flow.
function InvalidateMapSize() {
  const map = useMap();

  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timeout);
  }, [map]);

  return null;
}

function FitMapToData({
  individuals,
  wildfires,
}: {
  individuals: Individual[];
  wildfires: any[];
}) {
  const map = useMap();

  useEffect(() => {
    const coordinates = getAllCoordinates(individuals, wildfires);
    if (coordinates.length === 0) return;

    map.fitBounds(coordinates, {
      padding: [50, 50],
    });
  }, [individuals, wildfires, map]);

  return null;
}

// Zooms/fits the map to a specific bird's full track whenever the
// selected bird changes. Runs as its own child component so it can use
// useMap(), same pattern as FitMapToData above.
function ZoomToSelectedBird({
  track,
}: {
  track: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (track.length === 0) return;

    if (track.length === 1) {
      map.setView(track[0], 10);
      return;
    }

    map.fitBounds(track, { padding: [60, 60] });
  }, [track, map]);

  return null;
}

// Clicking anywhere on the map that isn't a marker/track clears the
// current selection and zooms back out to show everything again.
function DeselectOnMapClick({
  individuals,
  wildfires,
  onDeselect,
}: {
  individuals: Individual[];
  wildfires: any[];
  onDeselect: () => void;
}) {
  const map = useMap();

  useMapEvents({
    click: () => {
      onDeselect();
      const coordinates = getAllCoordinates(individuals, wildfires);
      if (coordinates.length > 0) {
        map.fitBounds(coordinates, { padding: [50, 50] });
      }
    },
  });
  return null;
}

export default function MigrationMap({
  individuals,
  wildfires,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  console.log(
    "MigrationMap received:",
    individuals.length,
    "birds and",
    wildfires.length,
    "fires"
  );

  const selectedBird = individuals.find(
    (bird) => getBirdKey(bird) === selectedKey
  );

  const selectedTrack: [number, number][] = selectedBird
    ? selectedBird.locations
        .filter((location) =>
          isValidCoord(location.location_lat, location.location_long)
        )
        .map((location) => [location.location_lat, location.location_long])
    : [];

  const handleZoomToAll = () => {
    setSelectedKey(null);
    const coordinates = getAllCoordinates(individuals, wildfires);
    if (coordinates.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(coordinates, { padding: [50, 50] });
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "600px",
        position: "relative",
      }}
    >
      {selectedKey && (
        <button
          onClick={handleZoomToAll}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1000,
            background: "#1A1A1A",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          }}
        >
          Zoom to all
        </button>
      )}

      <MapContainer
        ref={mapRef}
        center={[50, 4] as [number, number]}
        zoom={5}
        minZoom={2}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          noWrap={true}
        />

        <InvalidateMapSize />

        <FitMapToData
          individuals={individuals}
          wildfires={wildfires}
        />

        {selectedKey && <ZoomToSelectedBird track={selectedTrack} />}

        <DeselectOnMapClick
          individuals={individuals}
          wildfires={wildfires}
          onDeselect={() => setSelectedKey(null)}
        />

        {/* 1. Render Bird Tracks & Markers */}
        {individuals.map((bird) => {
          const birdKey = getBirdKey(bird);
          const isSelected = birdKey === selectedKey;

          const track: [number, number][] = bird.locations
            .filter((location) =>
              isValidCoord(location.location_lat, location.location_long)
            )
            .map((location) => [
              location.location_lat,
              location.location_long,
            ]);

          const validLocations = bird.locations.filter((location) =>
            isValidCoord(location.location_lat, location.location_long)
          );
          const lastLocation = validLocations[validLocations.length - 1];

          const handleSelect = () => setSelectedKey(birdKey);

          return (
            <div key={birdKey}>
              {track.length >= 2 && (
                <Polyline
                  positions={track}
                  pathOptions={{
                    color: isSelected ? BIRD_SELECTED_COLOR : BIRD_DEFAULT_COLOR,
                    weight: isSelected ? 6 : 4,
                    opacity: isSelected ? 1 : 0.8,
                  }}
                  eventHandlers={{
                    click: handleSelect,
                  }}
                >
                  <Popup>
                    <strong>
                      {bird.individual_taxon_canonical_name ?? "Unknown species"}
                    </strong>
                    <br />
                    Last updated: {formatTimestamp(track.length ? bird.locations[bird.locations.length - 1]?.timestamp : undefined)}
                  </Popup>
                </Polyline>
              )}

              {lastLocation && (
                <CircleMarker
                  center={[
                    lastLocation.location_lat,
                    lastLocation.location_long,
                  ]}
                  radius={isSelected ? 10 : 8}
                  pathOptions={{
                    color: "#000000",
                    weight: 2,
                    fillColor: isSelected ? BIRD_SELECTED_COLOR : BIRD_DEFAULT_COLOR,
                    fillOpacity: 1,
                  }}
                  eventHandlers={{
                    click: handleSelect,
                  }}
                >
                  <Popup>
                    <strong>
                      {bird.individual_taxon_canonical_name ?? "Unknown species"}
                    </strong>
                    <br />
                    Last updated: {formatTimestamp(lastLocation.timestamp)}
                  </Popup>
                </CircleMarker>
              )}
            </div>
          );
        })}

        {/* 2. Render Live Wildfires (Red Markers), clustered */}
        <MarkerClusterGroup>
          {wildfires.map((fire, index) => {
            // Extract coordinates safely from GeoJSON format [lng, lat]
            const coords = fire.geometry?.coordinates;
            if (!coords || coords.length < 2) return null;

            const [lng, lat] = coords;

            // Guard against null/undefined/NaN values sneaking through —
            // this check was present before but got dropped in a merge;
            // without it, malformed fire data crashes the whole map.
            if (!isValidCoord(lat, lng)) return null;

            const incidentName = fire.properties?.IncidentName || "Active Hotspot";

            return (
              <CircleMarker
                key={`fire-${index}`}
                center={[lat, lng]}
                radius={5}
                pathOptions={{
                  color: "#990000",
                  weight: 1,
                  fillColor: "#ff3333",
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "sans-serif" }}>
                    <strong style={{ color: "#cc0000" }}>🔥 Satellite Thermal Anomaly</strong>
                    <br />
                    <span>{incidentName}</span>
                    <br />
                    <span style={{ fontSize: "0.85rem", color: "#555" }}>
                      Coordinates: {lat.toFixed(2)}, {lng.toFixed(2)}
                    </span>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}