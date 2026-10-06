/**
 * Local gazetteer used by the default `GeocodingProvider`.
 *
 * Why not call the public Nominatim instance? Its usage policy explicitly
 * forbids building generic search/geocoding on it. `GEOCODING_PROVIDER=nominatim`
 * switches to a self-hosted endpoint (see `src/lib/geocoding`), and every
 * result is cached either way.
 */

import type { GeoPoint } from "@/lib/types";

export interface Place extends GeoPoint {
  name: string;
  state: string;
  kind: "city" | "area" | "landmark";
  /** Parent city name — lets "Manipal Hospital" resolve inside Bengaluru. */
  parent?: string;
  aliases?: string[];
}

const P = (
  name: string,
  state: string,
  latitude: number,
  longitude: number,
  kind: Place["kind"] = "city",
  extra: Partial<Place> = {},
): Place => ({ name, state, latitude, longitude, kind, ...extra });

export const PLACES: Place[] = [
  // --- Cities -------------------------------------------------------------
  P("Bengaluru", "Karnataka", 12.9716, 77.5946, "city", {
    aliases: ["Bangalore", "Bengaluru Urban", "Bangalore City"],
  }),
  P("Mumbai", "Maharashtra", 19.076, 72.8777, "city"),
  P("Delhi", "Delhi", 28.6139, 77.209, "city", { aliases: ["New Delhi", "Delhi NCR"] }),
  P("Hyderabad", "Telangana", 17.385, 78.4867, "city", { aliases: ["Secunderabad"] }),
  P("Chennai", "Tamil Nadu", 13.0827, 80.2707, "city", { aliases: ["Madras"] }),
  P("Kolkata", "West Bengal", 22.5726, 88.3639, "city", { aliases: ["Calcutta"] }),
  P("Pune", "Maharashtra", 18.5204, 73.8567, "city"),
  P("Ahmedabad", "Gujarat", 23.0225, 72.5714, "city"),
  P("Jaipur", "Rajasthan", 26.9124, 75.7873, "city"),
  P("Lucknow", "Uttar Pradesh", 26.8467, 80.9462, "city"),
  P("Surat", "Gujarat", 21.1702, 72.8311, "city"),
  P("Kanpur", "Uttar Pradesh", 26.4499, 80.3319, "city"),
  P("Nagpur", "Maharashtra", 21.1458, 79.0882, "city"),
  P("Indore", "Madhya Pradesh", 22.7196, 75.8577, "city"),
  P("Bhopal", "Madhya Pradesh", 23.2599, 77.4126, "city"),
  P("Patna", "Bihar", 25.5941, 85.1376, "city"),
  P("Vadodara", "Gujarat", 22.3072, 73.1812, "city"),
  P("Ghaziabad", "Uttar Pradesh", 28.6692, 77.4538, "city"),
  P("Ludhiana", "Punjab", 30.901, 75.8573, "city"),
  P("Agra", "Uttar Pradesh", 27.1767, 78.0081, "city"),
  P("Nashik", "Maharashtra", 19.9975, 73.7898, "city"),
  P("Faridabad", "Haryana", 28.4089, 77.3178, "city"),
  P("Meerut", "Uttar Pradesh", 28.9845, 77.7064, "city"),
  P("Rajkot", "Gujarat", 22.3039, 70.8022, "city"),
  P("Varanasi", "Uttar Pradesh", 25.3176, 82.9739, "city"),
  P("Srinagar", "Jammu and Kashmir", 34.0837, 74.7973, "city"),
  P("Amritsar", "Punjab", 31.634, 74.8723, "city"),
  P("Chandigarh", "Chandigarh", 30.7333, 76.7794, "city"),
  P("Kochi", "Kerala", 9.9312, 76.2673, "city", { aliases: ["Cochin", "Ernakulam"] }),
  P("Thiruvananthapuram", "Kerala", 8.5241, 76.9366, "city", {
    aliases: ["Trivandrum"],
  }),
  P("Kozhikode", "Kerala", 11.2588, 75.7804, "city", { aliases: ["Calicut"] }),
  P("Coimbatore", "Tamil Nadu", 11.0168, 76.9558, "city"),
  P("Madurai", "Tamil Nadu", 9.9252, 78.1198, "city"),
  P("Vizag", "Andhra Pradesh", 17.6868, 83.2185, "city", {
    aliases: ["Visakhapatnam", "Vishakapatnam"],
  }),
  P("Vijayawada", "Andhra Pradesh", 16.5062, 80.648, "city"),
  P("Guwahati", "Assam", 26.1445, 91.7362, "city"),
  P("Bhubaneswar", "Odisha", 20.2961, 85.8245, "city"),
  P("Ranchi", "Jharkhand", 23.3441, 85.3096, "city"),
  P("Raipur", "Chhattisgarh", 21.2514, 81.6296, "city"),
  P("Dehradun", "Uttarakhand", 30.3165, 78.0322, "city"),
  P("Shimla", "Himachal Pradesh", 31.1048, 77.1734, "city"),
  P("Jodhpur", "Rajasthan", 26.2389, 73.0243, "city"),
  P("Udaipur", "Rajasthan", 24.5854, 73.7125, "city"),
  P("Mysuru", "Karnataka", 12.2958, 76.6394, "city", { aliases: ["Mysore"] }),
  P("Mangaluru", "Karnataka", 12.9141, 74.856, "city", { aliases: ["Mangalore"] }),
  P("Hubballi", "Karnataka", 15.3647, 75.124, "city", { aliases: ["Hubli"] }),
  P("Manipal", "Karnataka", 13.3514, 74.7844, "area", {
    aliases: ["Manipal Town", "Udupi"],
  }),
  P("Belagavi", "Karnataka", 15.8497, 74.4977, "city", { aliases: ["Belgaum"] }),
  P("Kalaburagi", "Karnataka", 17.329, 76.8342, "city", { aliases: ["Gulbarga"] }),
  P("Tumakuru", "Karnataka", 13.3392, 77.1139, "city", { aliases: ["Tumkur"] }),
  P("Navi Mumbai", "Maharashtra", 19.033, 73.0297, "city"),
  P("Thane", "Maharashtra", 19.2183, 72.9781, "city"),
  P("Noida", "Uttar Pradesh", 28.5355, 77.391, "city"),
  P("Gurugram", "Haryana", 28.4595, 77.0266, "city", { aliases: ["Gurgaon"] }),

  // --- Bengaluru areas (for "near me" style queries) -----------------------
  P("Indiranagar", "Karnataka", 12.9784, 77.6408, "area", { parent: "Bengaluru" }),
  P("Koramangala", "Karnataka", 12.9352, 77.6245, "area", { parent: "Bengaluru" }),
  P("HSR Layout", "Karnataka", 12.9116, 77.6389, "area", { parent: "Bengaluru" }),
  P("Jayanagar", "Karnataka", 12.9299, 77.5826, "area", { parent: "Bengaluru" }),
  P("Whitefield", "Karnataka", 12.9698, 77.75, "area", { parent: "Bengaluru" }),
  P("Yelahanka", "Karnataka", 13.1007, 77.5963, "area", { parent: "Bengaluru" }),
  P("Rajajinagar", "Karnataka", 12.9915, 77.5554, "area", { parent: "Bengaluru" }),
  P("BTM Layout", "Karnataka", 12.9166, 77.6101, "area", { parent: "Bengaluru" }),

  // --- Landmarks / hospitals named in real user queries --------------------
  P("Manipal Hospital Old Airport Road", "Karnataka", 12.9592, 77.6484, "landmark", {
    parent: "Bengaluru",
    aliases: ["Manipal Hospital Bengaluru"],
  }),
  P("Victoria Hospital", "Karnataka", 12.9634, 77.5755, "landmark", {
    parent: "Bengaluru",
  }),
  P("NIMHANS", "Karnataka", 12.9432, 77.5967, "landmark", { parent: "Bengaluru" }),
  P("Manipal Hospital Goa", "Goa", 15.4989, 73.8272, "landmark", { parent: "Panaji" }),
  P("Safdarjung Hospital", "Delhi", 28.5688, 77.2057, "landmark", { parent: "Delhi" }),
  P("AIIMS Delhi", "Delhi", 28.5672, 77.21, "landmark", {
    parent: "Delhi",
    aliases: ["AIIMS"],
  }),
];

export interface ResolvedPlace extends GeoPoint {
  name: string;
  state: string;
  matchedQuery: string;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Longest-match-first lookup so "Manipal Hospital Old Airport Road" wins over "Manipal". */
export function resolvePlace(query: string): ResolvedPlace | null {
  const q = norm(query);
  if (!q) return null;

  const candidates = [...PLACES].sort(
    (a, b) => norm(b.name).length - norm(a.name).length,
  );

  for (const place of candidates) {
    const names = [place.name, ...(place.aliases ?? [])].map(norm);
    for (const n of names) {
      if (q === n) return { ...place, matchedQuery: query };
    }
  }
  for (const place of candidates) {
    const names = [place.name, ...(place.aliases ?? [])].map(norm);
    for (const n of names) {
      if (n && (q.includes(n) || n.includes(q))) {
        return { ...place, matchedQuery: query };
      }
    }
  }
  return null;
}

/** Cheap "which city is this text talking about" helper for the intent layer. */
export function detectCity(text: string): ResolvedPlace | null {
  return resolvePlace(text);
}
