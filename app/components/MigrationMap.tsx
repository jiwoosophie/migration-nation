"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
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

function FitMapToData({
  individuals,
  wildfires,
}: {
  individuals: Individual[];
  wildfires: any[];
}) {
  const map = useMap();

  useEffect(() => {
    const coordinates: [number, number][] = [];

    for (const bird of individuals) {
      for (const location of bird.locations) {
        coordinates.push([
          location.location_lat,
          location.location_long,
        ]);
      }
    }

    if (coordinates.length === 0) return;

    map.fitBounds(coordinates, {
      padding: [50, 50],
    });
  }, [individuals, wildfires, map]);

  return null;
}

// Custom cluster generator that creates soft red heat/hazard zones with ZERO numbers
const createFireHeatAreaIcon = function (cluster: any) {
  const count = cluster.getChildCount();
  
  // Scale the regional hazard zone size based on how dense the fire group is
  let size = 65;
  if (count > 25) size = 90;
  if (count > 100) size = 120;

  return L.divIcon({
    html: `
      <div style="
        background: radial-gradient(circle, rgba(255, 45, 0, 0.65) 0%, rgba(255, 0, 0, 0.3) 55%, rgba(255, 0, 0, 0) 100%);
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
      "></div>
    `,
    className: 'fire-heat-blob-container',
    iconSize: L.point(size, size, true),
  });
};

export default function MigrationMap({
  individuals,
  wildfires,
}: Props) {
  return (
    <div
      style={{
        width: "100%",
        height: "600px",
      }}
    >
      <MapContainer
        center={[30, 0] as [number, number]}
        zoom={2}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitMapToData
          individuals={individuals}
          wildfires={wildfires}
        />

        {/* 1. Render Bird Tracks & Markers */}
        {individuals.map((bird) => {
          const track: [number, number][] = bird.locations.map((location) => [
            location.location_lat,
            location.location_long,
          ]);

          const lastLocation = bird.locations[bird.locations.length - 1];

          return (
            <div key={`${bird.study_id}-${bird.individual_local_identifier}`}>
              {track.length >= 2 && (
                <Polyline
                  positions={track}
                  pathOptions={{
                    color: "#7ebee6",
                    weight: 4,
                    opacity: 0.8,
                  }}
                >
                  <Popup>
                    <strong>{bird.individual_local_identifier}</strong>
                    <br />
                    {bird.individual_taxon_canonical_name ?? "Unknown species"}
                    <br />
                    {bird.locations.length} GPS locations
                  </Popup>
                </Polyline>
              )}

              {lastLocation && (
                <CircleMarker
                  center={[
                    lastLocation.location_lat,
                    lastLocation.location_long,
                  ]}
                  radius={8}
                  pathOptions={{
                    color: "#000000",
                    weight: 2,
                    fillColor: "#004ecc",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <strong>{bird.individual_local_identifier}</strong>
                    <br />
                    {bird.individual_taxon_canonical_name ?? "Unknown species"}
                    <br />
                    Latest position
                  </Popup>
                </CircleMarker>
              )}
            </div>
          );
        })}

        {/* 2. Soft Red Shaded Heat Clusters (Aggregates globally into glowing red regions, splits into individual fires on zoom) */}
        <MarkerClusterGroup 
          chunkedLoading 
          iconCreateFunction={createFireHeatAreaIcon}
          maxClusterRadius={110}
          spiderfyOnMaxZoom={true}
        >
          {Array.isArray(wildfires) && wildfires.map((fire, index) => {
            const coords = fire.geometry?.coordinates;
            if (!coords || coords.length < 2) return null;

            const [lng, lat] = coords;
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