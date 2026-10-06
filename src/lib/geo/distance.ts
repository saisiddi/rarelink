/**
 * Geospatial helpers.
 *
 * Distances are computed here — never by the LLM. On Postgres/PostGIS this
 * module is replaced by `ST_DWithin` / `ST_Distance` on `GEOGRAPHY(Point,4326)`
 * columns; the SQL layer only ever does a bounding-box pre-filter so the
 * haversine step stays portable.
 */

import type { GeoPoint } from "@/lib/types";

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bounding box for a radius — pushed into SQL so we never scan the whole table.
 * 1 degree of latitude ≈ 110.574 km; longitude shrinks toward the poles.
 */
export function boundingBox(
  center: GeoPoint,
  radiusKm: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const dLat = radiusKm / 110.574;
  const cosLat = Math.max(0.01, Math.cos(toRad(center.latitude)));
  const dLon = radiusKm / (111.32 * cosLat);
  return {
    minLat: center.latitude - dLat,
    maxLat: center.latitude + dLat,
    minLon: center.longitude - dLon,
    maxLon: center.longitude + dLon,
  };
}

/** 1..0 proximity score; full marks inside 1 km, decaying to 0 at the radius edge. */
export function proximityScore(distanceKm: number | null, radiusKm: number): number {
  if (distanceKm === null) return 0.4; // unknown location — neutral, not a free pass
  const edge = Math.max(radiusKm, 1);
  if (distanceKm <= 1) return 1;
  const score = 1 - (distanceKm - 1) / (edge - 1);
  return Math.max(0, Math.min(1, score));
}

export function formatDistance(distanceKm: number | null): string {
  if (distanceKm === null) return "Distance unknown";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

export function directionsUrl(point: GeoPoint, label?: string): string {
  const q = label ? `${label}@${point.latitude},${point.longitude}` : `${point.latitude},${point.longitude}`;
  return `https://www.openstreetmap.org/directions?to=${encodeURIComponent(q)}`;
}
