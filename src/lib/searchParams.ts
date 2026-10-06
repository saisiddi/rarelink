import type { BloodComponent, SearchQuery, Urgency } from "@/lib/types";
import { normalizeBloodGroup } from "@/lib/blood/compatibility";
import { resolvePlace } from "@/lib/geo/places";

/** Every component RARELINK understands — also used to validate API input. */
export const SUPPORTED_COMPONENTS = [
  "WHOLE_BLOOD",
  "PRBC",
  "PLATELETS",
  "SDP",
  "FFP",
  "CRYO",
  "GRANULOCYTES",
] as const;

const COMPONENTS = new Set<string>(SUPPORTED_COMPONENTS);

const INTENTS = new Set([
  "find_blood",
  "find_donor",
  "find_blood_bank",
  "emergency_request",
  "donor_registration",
  "blood_compatibility",
  "blood_group_information",
  "request_status",
  "nearby_hospital",
  "nearby_blood_bank",
  "help",
]);

function num(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseSearchParams(params: URLSearchParams): SearchQuery {
  const rawGroup = params.get("bloodGroup") || params.get("group");
  const group = rawGroup ? normalizeBloodGroup(rawGroup)?.code ?? null : null;

  const rawComponent = params.get("component")?.toUpperCase() ?? null;
  const component =
    rawComponent && COMPONENTS.has(rawComponent) ? (rawComponent as BloodComponent) : null;

  const rawIntent = params.get("intent");
  const intent = rawIntent && INTENTS.has(rawIntent)
    ? (rawIntent as SearchQuery["intent"])
    : group
      ? "find_blood"
      : "find_blood_bank";

  const rawUrgency = params.get("urgency");
  const urgency: Urgency =
    rawUrgency === "emergency" || rawUrgency === "urgent" || rawUrgency === "routine"
      ? rawUrgency
      : "routine";

  const lat = params.get("lat");
  const lon = params.get("lon");
  const hasCoords =
    lat !== null && lon !== null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));

  const cityParam = params.get("city")?.trim() || null;
  const city = cityParam ? resolvePlace(cityParam)?.name ?? cityParam : null;

  return {
    bloodGroup: group,
    component,
    quantity: Math.max(1, Math.min(50, Math.floor(num(params.get("quantity"), 1)))),
    city,
    location: hasCoords
      ? { latitude: Number(lat), longitude: Number(lon) }
      : city
        ? placeCoords(city)
        : null,
    radiusKm: Math.max(1, Math.min(300, Math.round(num(params.get("radius"), urgency === "emergency" ? 25 : 50)))),
    urgency,
    rareBlood: params.get("rare") === "true" || group === "OH" || group === "P-BOMBAY",
    intent,
  };
}

function placeCoords(city: string): { latitude: number; longitude: number } | null {
  const place = resolvePlace(city);
  return place ? { latitude: place.latitude, longitude: place.longitude } : null;
}
