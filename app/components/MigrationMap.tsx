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

import "leaflet/dist/leaflet.css";

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

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
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

    if (coordinates.length === 0) return;

    map.fitBounds(coordinates, {
      padding: [50, 50],
    });
  }, [individuals, wildfires, map]);

  return null;
}

export default function MigrationMap({
  individuals,
  wildfires,
}: Props) {
  console.log(
    "MigrationMap received:",
    individuals.length,
    "birds and",
    wildfires.length,
    "fires"
  );

  return (
    <div
      style={{
        width: "100%",
        height: "600px",
      }}
    >
      <MapContainer
        center={[50, 4] as [number, number]}
        zoom={5}
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

        {/* 2. Render Live European Wildfires (Red Markers) */}
        {wildfires.map((fire, index) => {
          // Extract coordinates safely from GeoJSON format [lng, lat]
          const coords = fire.geometry?.coordinates;
          if (!coords || coords.length < 2) return null;

          const [lng, lat] = coords;

          // Guard against null/undefined/NaN values sneaking through
          if (!isValidCoord(lat, lng)) return null;

          return (
            <CircleMarker
              key={`fire-${index}`}
              center={[lat, lng]}
              radius={6}
              pathOptions={{
                color: "#ff0000",
                weight: 1,
                fillColor: "#ff4d4d",
                fillOpacity: 0.8,
              }}
            >
              <Popup>
                <strong>Wildfire / Thermal Alert</strong>
                <br />
                {fire.properties?.IncidentName || "Active Hotspot"}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}