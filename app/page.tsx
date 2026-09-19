"use client";

import { useEffect, useState } from "react";
import MigrationMap from "./components/MigrationMap";

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

export default function Home() {
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBirds() {
      try {
        const response = await fetch("/api/birds");

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();

        setIndividuals(data.individuals ?? []);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }

    loadBirds();
  }, []);

  if (loading) {
    return <main>Loading migration data...</main>;
  }

  if (error) {
    return <main>Error: {error}</main>;
  }

  return (
    <main>
      <h1>Migration Nation</h1>

      <p>
        Tracking {individuals.length} individual birds.
      </p>

      <MigrationMap individuals={individuals} />
    </main>
  );
}
