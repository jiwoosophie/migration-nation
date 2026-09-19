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
  const [wildfires, setWildfires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch birds and fires at the same time
        const [birdRes, fireRes] = await Promise.all([
          fetch("/api/birds"),
          fetch("/api/wildfires"),
        ]);

        if (!birdRes.ok) throw new Error(`Bird request failed: ${birdRes.status}`);
        
        const birdData = await birdRes.json();
        setIndividuals(birdData.individuals ?? []);

        if (fireRes.ok) {
          const fireData = await fireRes.json();
          setWildfires(fireData.fires ?? fireData.features ?? []);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <main>Loading migration & hazard data...</main>;
  }

  if (error) {
    return <main>Error: {error}</main>;
  }

  return (
    <main>
      <h1>Migration Nation</h1>
      <p>
        Tracking {individuals.length} individual birds and {wildfires.length} active European fires.
      </p>
      <MigrationMap individuals={individuals} wildfires={wildfires} />
    </main>
  );
}