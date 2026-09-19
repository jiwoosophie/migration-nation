"use client";

import { useEffect, useRef } from "react";
import { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = new Map({
      container: mapContainerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty", // free, no API key
      center: [0, 0],
      zoom: 2,
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapContainerRef} className="w-full h-screen" />;
}