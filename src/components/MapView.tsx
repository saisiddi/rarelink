"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  kind: "blood_bank" | "donor" | "emergency";
  label: string;
  detail?: string | null;
}

const COLORS: Record<MapPoint["kind"], string> = {
  blood_bank: "#0b1220",
  donor: "#c8102e",
  emergency: "#b3261e",
};

const GLYPH: Record<MapPoint["kind"], string> = {
  blood_bank: "🩸",
  donor: "❤",
  emergency: "!",
};

export default function MapView({
  points,
  selectedId,
  onSelect,
  className,
}: {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  // Latest-ref pattern: written in an effect, never during render.
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // --- init once ------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([12.9716, 77.5946], 11);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // --- markers --------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const valid = points.filter(
      (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
    );
    if (valid.length === 0) return;

    const bounds: L.LatLngBoundsExpression = [];

    for (const p of valid) {
      const active = p.id === selectedId;
      const color = COLORS[p.kind];
      const icon = L.divIcon({
        className: "",
        html: `<div class="rarelink-pin" style="background:${color};${active ? "transform:rotate(-45deg) scale(1.18);" : ""}"><span>${GLYPH[p.kind]}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 28],
      });
      const marker = L.marker([p.latitude, p.longitude], { icon, title: p.label }).addTo(layer);
      marker.bindTooltip(
        `<strong>${escapeHtml(p.label)}</strong>${p.detail ? `<br/>${escapeHtml(p.detail)}` : ""}`,
        { direction: "top", offset: [0, -26] },
      );
      marker.on("click", () => onSelectRef.current?.(p.id));
      bounds.push([p.latitude, p.longitude]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [46, 46], maxZoom: 13 });
    } else {
      map.setView(bounds[0] as L.LatLngTuple, 13);
    }
  }, [points, selectedId]);

  // Recalculate size when the layout settles (mobile/panel switches).
  useEffect(() => {
    const id = window.setTimeout(() => mapRef.current?.invalidateSize(), 220);
    return () => window.clearTimeout(id);
  }, [points.length]);

  return <div ref={containerRef} className={`map-shell ${className ?? ""}`} role="application" aria-label="Map of blood banks and donors" />;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
