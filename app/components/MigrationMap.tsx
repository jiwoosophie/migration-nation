"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet-ant-path";

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

const BIRD_DEFAULT_COLOR = "#0ea5e9"; // Crisp sky blue
const BIRD_SELECTED_COLOR = "#E63989"; // Brand pink for active selection

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

// Robust manager component to draw and update animated trails for ALL birds cleanly
function BirdAntPathsLayer({
  individuals,
  selectedKey,
  onSelectBird,
}: {
  individuals: Individual[];
  selectedKey: string | null;
  onSelectBird: (key: string) => void;
}) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    individuals.forEach((bird) => {
      const birdKey = getBirdKey(bird);
      const isSelected = birdKey === selectedKey;

      const track: [number, number][] = bird.locations
        .filter((loc) => isValidCoord(loc.location_lat, loc.location_long))
        .map((loc) => [loc.location_lat, loc.location_long]);

      if (track.length >= 2) {
        // @ts-ignore
        const antPath = L.polyline.antPath(track, {
          delay: 700,
          dashArray: [14, 28],
          weight: isSelected ? 7 : 5,
          color: isSelected ? BIRD_SELECTED_COLOR : BIRD_DEFAULT_COLOR,
          pulseColor: "#ffffff",
          paused: false,
          reverse: false,
          hardwareAccelerated: true,
        });

        antPath.on("click", () => onSelectBird(birdKey));
        layerGroup.addLayer(antPath);
      }
    });

    return () => {
      layerGroup.clearLayers();
    };
  }, [individuals, selectedKey, map, onSelectBird]);

  return null;
}

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

function ZoomToSelectedBird({ track }: { track: [number, number][] }) {
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

export default function MigrationMap({ individuals, wildfires }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

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
      {/* CSS overrides for seamless heat-map fire clusters (No numbers, large glowing red clouds when zoomed out) */}
      <style jsx global>{`
        .marker-cluster-small,
        .marker-cluster-medium,
        .marker-cluster-large {
          background: radial-gradient(circle, rgba(239, 68, 68, 0.85) 0%, rgba(220, 38, 38, 0.4) 60%, rgba(185, 28, 28, 0) 100%) !important;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
        }
        .marker-cluster-small div,
        .marker-cluster-medium div,
        .marker-cluster-large div {
          display: none !important;
        }
      `}</style>

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

        <FitMapToData individuals={individuals} wildfires={wildfires} />

        {selectedKey && <ZoomToSelectedBird track={selectedTrack} />}

        <DeselectOnMapClick
          individuals={individuals}
          wildfires={wildfires}
          onDeselect={() => setSelectedKey(null)}
        />

        {/* Centralized manager to ensure ALL active birds have animated movement trails */}
        <BirdAntPathsLayer
          individuals={individuals}
          selectedKey={selectedKey}
          onSelectBird={(key) => setSelectedKey(key)}
        />

        {/* Render Bird Origin and Current Location Markers */}
        {individuals.map((bird) => {
          const birdKey = getBirdKey(bird);
          const isSelected = birdKey === selectedKey;

          const validLocations = bird.locations.filter((location) =>
            isValidCoord(location.location_lat, location.location_long)
          );
          const startLocation = validLocations[0];
          const lastLocation = validLocations[validLocations.length - 1];

          const handleSelect = () => setSelectedKey(birdKey);

          return (
            <div key={birdKey}>
              {/* Origin Marker */}
              {startLocation && (
                <CircleMarker
                  center={[
                    startLocation.location_lat,
                    startLocation.location_long,
                  ]}
                  radius={4}
                  pathOptions={{
                    color: "#0369a1",
                    weight: 1,
                    fillColor: "#bae6fd",
                    fillOpacity: 0.9,
                  }}
                  eventHandlers={{
                    click: handleSelect,
                  }}
                >
                  <Popup>
                    <strong>{bird.individual_local_identifier} (Origin)</strong>
                    <br />
                    {bird.individual_taxon_canonical_name ?? "Gull Specimen"}
                    <br />
                    Started: {formatTimestamp(startLocation.timestamp)}
                  </Popup>
                </CircleMarker>
              )}

              {/* Current Position Marker */}
              {lastLocation && (
                <CircleMarker
                  center={[
                    lastLocation.location_lat,
                    lastLocation.location_long,
                  ]}
                  radius={isSelected ? 9 : 7}
                  pathOptions={{
                    color: "#000000",
                    weight: 2,
                    fillColor: isSelected
                      ? BIRD_SELECTED_COLOR
                      : BIRD_DEFAULT_COLOR,
                    fillOpacity: 1,
                  }}
                  eventHandlers={{
                    click: handleSelect,
                  }}
                >
                  <Popup>
                    <strong>{bird.individual_local_identifier} (Current)</strong>
                    <br />
                    {bird.individual_taxon_canonical_name ?? "Gull Specimen"}
                    <br />
                    Last updated: {formatTimestamp(lastLocation.timestamp)}
                  </Popup>
                </CircleMarker>
              )}
            </div>
          );
        })}

        {/* Render Wildfires as Heat-Map Glowing Thermal Blobs */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={90}
          spiderfyOnMaxZoom={true}
        >
          {wildfires.map((fire, index) => {
            const coords = fire.geometry?.coordinates;
            if (!coords || coords.length < 2) return null;

            const [lng, lat] = coords;
            if (!isValidCoord(lat, lng)) return null;

            const incidentName =
              fire.properties?.IncidentName || "Thermal Hotspot";

            return (
              <CircleMarker
                key={`fire-${index}`}
                center={[lat, lng]}
                radius={6}
                pathOptions={{
                  color: "#7f1d1d",
                  weight: 1,
                  fillColor: "#ef4444",
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: "sans-serif" }}>
                    <strong style={{ color: "#dc2626" }}>
                      🔥 Satellite Thermal Anomaly
                    </strong>
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