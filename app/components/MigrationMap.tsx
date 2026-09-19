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
};

function FitMapToBirds({
  individuals,
}: {
  individuals: Individual[];
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
  }, [individuals, map]);

  return null;
}

export default function MigrationMap({
  individuals,
}: Props) {
  console.log(
    "MigrationMap received:",
    individuals.length,
    "birds"
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

        <FitMapToBirds
          individuals={individuals}
        />

        {individuals.map((bird) => {
          /*
           * The complete migration track.
           */
          const track: [number, number][] =
            bird.locations.map((location) => [
              location.location_lat,
              location.location_long,
            ]);

          /*
           * The most recent position.
           */
          const lastLocation =
            bird.locations[
              bird.locations.length - 1
            ];

          return (
            <div
              key={`${bird.study_id}-${bird.individual_local_identifier}`}
            >
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
                    <strong>
                      {bird.individual_local_identifier}
                    </strong>

                    <br />

                    {bird.individual_taxon_canonical_name ??
                      "Unknown species"}

                    <br />

                    {bird.locations.length} GPS
                    locations
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
                    <strong>
                      {bird.individual_local_identifier}
                    </strong>

                    <br />

                    {bird.individual_taxon_canonical_name ??
                      "Unknown species"}

                    <br />

                    Latest position
                  </Popup>
                </CircleMarker>
              )}
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}