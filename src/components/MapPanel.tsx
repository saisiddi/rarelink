"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/MapView";

/**
 * Leaflet touches `window`, so the map is loaded client-only. Keeping the
 * wrapper here means every page can import this without the `ssr: false`
 * restriction leaking into server components.
 */
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-shell grid place-items-center bg-line/60 text-sm text-ink-mute">
      Loading map…
    </div>
  ),
});

export default function MapPanel(props: {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return <MapView {...props} />;
}

export type { MapPoint };
