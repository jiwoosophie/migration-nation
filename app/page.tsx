"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const MigrationMap = dynamic(() => import('./components/MigrationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#F5F8F2] text-[#2D4029] font-bold">
      Loading interactive map...
    </div>
  ),
});

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
  const [activeTab, setActiveTab] = useState<'all' | 'birds' | 'fires'>('all');
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [wildfires, setWildfires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
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

  // Derive what actually gets shown on the map based on the tab selection
  const visibleIndividuals = activeTab === 'fires' ? [] : individuals;
  const visibleWildfires = activeTab === 'birds' ? [] : wildfires;

  return (
    <main className="min-h-screen bg-[#F5F8F2] text-[#1A1A1A] font-sans antialiased selection:bg-[#E63989] selection:text-white p-4 sm:p-8 lg:p-12">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Dancing+Script:wght@700&display=swap');
        .font-editorial { font-family: 'Playfair Display', serif; }
        .font-script { font-family: 'Dancing Script', cursive; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-8">

        {/* ================= HERO SECTION ================= */}
        <section className="bg-[#B5CD99] rounded-[2.5rem] p-8 sm:p-12 lg:p-16 border-4 border-[#8FA874] shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[500px]">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#A4C686] opacity-60 pointer-events-none" />
          <div className="absolute right-32 bottom-[-10%] w-48 h-48 rounded-full bg-[#C7DCB3] opacity-50 pointer-events-none" />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10">
            <div className="bg-white/90 backdrop-blur-sm px-5 py-2 rounded-full border border-[#8FA874] shadow-sm">
              <span className="text-xs uppercase tracking-widest font-extrabold text-[#2D4029]">
                STEELHACKS XIII
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[#2D4029] bg-[#A4C686] px-4 py-1.5 rounded-full shadow-sm">
                Live Migration & Fire Tracking
              </span>
            </div>
          </div>

          <div className="my-12 z-10 max-w-4xl">
            <div className="inline-block mb-3 bg-[#E63989] text-white px-4 py-1 rounded-md text-sm font-bold tracking-wider uppercase transform -rotate-1 shadow-md">
              Climate & Ecosystem Initiative
            </div>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-editorial font-extrabold text-[#111111] tracking-tight leading-[1.05]">
              PHOENIX <span className="text-[#E63989] italic font-script font-normal text-6xl sm:text-8xl">project</span>
            </h1>
            <p className="mt-6 text-xl sm:text-2xl text-[#2B3E27] font-medium max-w-2xl leading-relaxed">
              Tracking how rapid climate shifts and intensifying wildfires disrupt migratory bird pathways across the globe.
            </p>
          </div>

          <div className="z-10 flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-[#9EB683]">
            <div className="text-sm font-bold text-[#2B3E27] uppercase tracking-wider">
              Establishing Long-Term Ecological Direction
            </div>
            <a
              href="#map-section"
              className="bg-[#1A1A1A] text-white hover:bg-[#E63989] transition-colors px-8 py-3.5 rounded-xl font-bold shadow-lg flex items-center gap-2 group"
            >
              Explore Live Map
              <span className="group-hover:translate-x-1 transition-transform">{'\u2192'}</span>
            </a>
          </div>
        </section>

        {/* ================= STATISTICS SECTION ================= */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#A4C686] rounded-3xl p-8 border-4 border-[#8FA874] shadow-lg flex flex-col justify-between transition-transform hover:-translate-y-1 duration-300">
            <div>
              <div className="bg-[#E63989] text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-4 shadow-sm">
                Migration Shift
              </div>
              <h3 className="text-xl font-bold text-[#111] mb-2 font-editorial">Springs Are Coming Earlier</h3>
              <p className="text-[#2D4029] text-sm leading-relaxed">
                Weather radar data shows North American birds arriving earlier each spring as the climate warms.{" "}
                <a
                  href="https://www.scientificamerican.com/article/millions-of-birds-are-migrating-earlier-because-of-warming/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[#E63989]"
                >
                  Source: Scientific American
                </a>
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#8FA874]/50 flex items-baseline justify-between">
              <span className="text-4xl sm:text-5xl font-extrabold text-[#111]">2 Days</span>
              <span className="text-xs font-bold text-[#E63989] bg-white px-2.5 py-1 rounded-md">Earlier Per Decade</span>
            </div>
          </div>

          <div className="bg-[#B5CD99] rounded-3xl p-8 border-4 border-[#9EB683] shadow-lg flex flex-col justify-between transition-transform hover:-translate-y-1 duration-300">
            <div>
              <div className="bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-4 shadow-sm">
                Habitat Disruption
              </div>
              <h3 className="text-xl font-bold text-[#111] mb-2 font-editorial">Fire Risk Meets Bird Diversity</h3>
              <p className="text-[#2D4029] text-sm leading-relaxed">
                Up to 58% of bird diversity hotspots occur in areas predicted to experience low-severity fires.{" "}
                <a
                  href="https://www.birds.cornell.edu/home/forecasting-impacts-of-fire-on-birds/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[#E63989]"
                >
                  Source: Cornell Lab of Ornithology
                </a>
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#9EB683]/50 flex items-baseline justify-between">
              <span className="text-4xl sm:text-5xl font-extrabold text-[#E63989]">58%</span>
              <span className="text-xs font-bold text-[#111] bg-white px-2.5 py-1 rounded-md">Hotspots at Low-Severity</span>
            </div>
          </div>

          <div className="bg-[#A4C686] rounded-3xl p-8 border-4 border-[#8FA874] shadow-lg flex flex-col justify-between transition-transform hover:-translate-y-1 duration-300">
            <div>
              <div className="bg-[#E63989] text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full inline-block mb-4 shadow-sm">
                Species Monitored
              </div>
              <h3 className="text-xl font-bold text-[#111] mb-2 font-editorial">Global Tracking Network</h3>
              <p className="text-[#2D4029] text-sm leading-relaxed">
                Active telemetry sensors monitoring vulnerable avian populations across critical North American and European flyways.
              </p>
            </div>
            <div className="mt-8 pt-4 border-t border-[#8FA874]/50 flex items-baseline justify-between">
              <span className="text-4xl sm:text-5xl font-extrabold text-[#111]">
                {loading ? '...' : individuals.length.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-[#E63989] bg-white px-2.5 py-1 rounded-md">Tracked Birds</span>
            </div>
          </div>
        </section>

        {/* ================= MAP SECTION ================= */}
        <section id="map-section" className="bg-[#A4C686] rounded-[2.5rem] p-6 sm:p-10 border-4 border-[#8FA874] shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest bg-[#E63989] text-white px-3 py-1 rounded-md">
                Live Telemetry
              </span>
              <h2 className="text-3xl sm:text-4xl font-editorial font-extrabold text-[#111] mt-2">
                Birds & Wildfires Map
              </h2>
              <p className="text-sm text-[#2D4029] mt-1 font-medium">
                {loading
                  ? 'Loading live telemetry data from API...'
                  : error
                  ? `Error loading data: ${error}`
                  : `Tracking ${individuals.length} birds and ${wildfires.length} active fires.`}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-[#8FA874] flex items-center gap-1 shadow-sm">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'all' ? 'bg-[#1A1A1A] text-white shadow-md' : 'text-[#2D4029] hover:bg-black/5'
                }`}
              >
                All Layers
              </button>
              <button
                onClick={() => setActiveTab('birds')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'birds' ? 'bg-[#E63989] text-white shadow-md' : 'text-[#2D4029] hover:bg-black/5'
                }`}
              >
                Birds Only
              </button>
              <button
                onClick={() => setActiveTab('fires')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'fires' ? 'bg-[#E63989] text-white shadow-md' : 'text-[#2D4029] hover:bg-black/5'
                }`}
              >
                Wildfires Only
              </button>
            </div>
          </div>

          <div className="w-full h-[600px] rounded-3xl overflow-hidden border-4 border-[#8FA874] shadow-inner bg-[#F5F8F2]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center font-bold text-[#2D4029]">
                Loading migration data...
              </div>
            ) : error ? (
              <div className="w-full h-full flex items-center justify-center font-bold text-red-600">
                Error: {error}
              </div>
            ) : (
              <MigrationMap individuals={visibleIndividuals} wildfires={visibleWildfires} />
            )}
          </div>

          <p className="text-xs text-[#2D4029]/70 mt-4 text-center font-medium">
            Live bird tracking data provided by{" "}
            <a
              href="https://www.movebank.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#E63989]"
            >
              Movebank
            </a>
            . Wildfire detection data provided by{" "}
            <a
              href="https://firms.modaps.eosdis.nasa.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#E63989]"
            >
              NASA FIRMS
            </a>
            .
          </p>
        </section>

        {/* ================= FOOTER ================= */}
        <footer className="text-center py-8 text-[#2D4029] text-sm font-bold flex flex-col sm:flex-row items-center justify-between px-4">
          <p>&copy; {new Date().getFullYear()} The Phoenix Project. All rights reserved.</p>
          <div className="flex gap-6 mt-4 sm:mt-0">
            <span className="hover:text-[#E63989] cursor-pointer">Birds tracked over 7 days, fires tracked over 2 days</span>
          </div>
        </footer>

      </div>
    </main>
  );
}