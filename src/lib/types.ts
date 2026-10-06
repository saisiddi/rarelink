/**
 * RARELINK shared domain types.
 *
 * Everything in here is deliberately provider-agnostic: the UI and the
 * ranking engine speak these types, not any particular data source.
 */

/** The eight standard ABO/Rh groups plus registered rare phenotypes. */
export type StandardBloodGroup =
  | "A+"
  | "A-"
  | "B+"
  | "B-"
  | "AB+"
  | "AB-"
  | "O+"
  | "O-";

export type RareBloodGroup = "OH" | "P-BOMBAY";

export type BloodGroup = StandardBloodGroup | RareBloodGroup;

export const STANDARD_BLOOD_GROUPS: StandardBloodGroup[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

export type BloodComponent =
  | "WHOLE_BLOOD"
  | "PRBC"
  | "PLATELETS"
  | "SDP"
  | "FFP"
  | "CRYO"
  | "GRANULOCYTES";

export const BLOOD_COMPONENTS: BloodComponent[] = [
  "WHOLE_BLOOD",
  "PRBC",
  "PLATELETS",
  "SDP",
  "FFP",
  "CRYO",
  "GRANULOCYTES",
];

export type AvailabilityStatus =
  | "AVAILABLE"
  | "LOW"
  | "UNAVAILABLE"
  | "UNKNOWN"
  | "STALE";

export type Freshness = "LIVE" | "RECENT" | "STALE" | "OUTDATED" | "UNKNOWN";

export type Urgency = "emergency" | "urgent" | "routine";

export type VerificationStatus =
  | "VERIFIED"
  | "PENDING"
  | "EXPIRED"
  | "SUSPENDED";

export type DonorAvailability = "AVAILABLE" | "LIMITED" | "UNAVAILABLE";

export type EmergencyStatus =
  | "OPEN"
  | "MATCHING"
  | "PARTIALLY_MATCHED"
  | "MATCHED"
  | "FULFILLED"
  | "CANCELLED"
  | "EXPIRED";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface BloodBank {
  id: string;
  name: string;
  hospitalName: string | null;
  address: string;
  city: string;
  district: string | null;
  state: string;
  pincode: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  emergencyPhone: string | null;
  email: string | null;
  website: string | null;
  category: "GOVERNMENT" | "PRIVATE" | "RED_CROSS" | "NGO" | "OTHER";
  licenseNumber: string | null;
  componentsSupported: BloodComponent[];
  apheresisAvailable: boolean;
  openingHours: string | null;
  emergency24x7: boolean;
  source: string;
  sourceId: string | null;
  verified: boolean;
  isDemo: boolean;
  lastVerifiedAt: string | null;
  lastInventoryUpdate: string | null;
}

export interface InventoryRecord {
  id: string;
  bloodBankId: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsAvailable: number;
  availabilityStatus: AvailabilityStatus;
  lastUpdatedAt: string;
  source: string;
  sourceRecordId: string | null;
}

export interface Donor {
  id: string;
  displayName: string;
  bloodGroup: BloodGroup;
  rarePhenotype: string | null;
  city: string;
  district: string | null;
  state: string;
  /** Coarse coordinates only — never a home address. */
  latitude: number;
  longitude: number;
  availabilityStatus: DonorAvailability;
  verificationStatus: VerificationStatus;
  verificationLabel: "Blood-bank verified" | "Phone verified" | "Self-reported";
  lastDonationDate: string | null;
  eligibleFrom: string | null;
  lastVerifiedAt: string | null;
  preferredContactMethod: "SMS" | "WHATSAPP" | "CALL" | "EMAIL";
  emergencyNotifications: boolean;
  isDemo: boolean;
}

export interface RareBloodGroupRecord {
  id: string;
  name: string;
  code: RareBloodGroup;
  system: string;
  description: string;
  compatibilityNotes: string;
  verificationRequired: boolean;
  source: string;
  updatedAt: string;
}

export type ResultKind = "blood_bank" | "inventory" | "donor";

/**
 * A single ranked, actionable result. Every result must be able to answer:
 * WHAT / WHERE / HOW FAR / HOW FRESH / CAN I CONTACT / IS IT VERIFIED.
 */
export interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  bloodGroup: BloodGroup | null;
  component: BloodComponent | null;
  unitsAvailable: number | null;
  availabilityStatus: AvailabilityStatus | null;
  freshness: Freshness;
  lastUpdatedAt: string | null;
  distanceKm: number | null;
  city: string;
  address: string;
  phone: string | null;
  emergencyPhone: string | null;
  verified: boolean;
  verificationLabel: string;
  source: string;
  isDemo: boolean;
  emergency24x7: boolean;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  notes: string[];
  /** Set when this candidate matches a requested rare phenotype. */
  rareMatch?: boolean;
  /** Uniqueness key for React lists / map markers. */
  key?: string;
  /**
   * Coordinates for map markers. Donor coordinates are deliberately coarse
   * (≈1 km) even here — `publicResult()` rounds them again before the
   * payload leaves the server.
   */
  coordinates: GeoPoint | null;
}

export interface ScoreBreakdown {
  availability: number;
  freshness: number;
  proximity: number;
  verification: number;
  emergencyCapability: number;
  rareBoost: number;
  total: number;
}

export interface SearchQuery {
  bloodGroup: BloodGroup | null;
  component: BloodComponent | null;
  quantity: number;
  city: string | null;
  location: GeoPoint | null;
  radiusKm: number;
  urgency: Urgency;
  rareBlood: boolean;
  intent: AiIntent;
}

export type AiIntent =
  | "find_blood"
  | "find_donor"
  | "find_blood_bank"
  | "emergency_request"
  | "donor_registration"
  | "blood_compatibility"
  | "blood_group_information"
  | "request_status"
  | "nearby_hospital"
  | "nearby_blood_bank"
  | "help";

export const AI_INTENTS: AiIntent[] = [
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
];

export interface StructuredIntent {
  intent: AiIntent;
  blood_group: BloodGroup | null;
  component: BloodComponent | null;
  quantity: number;
  location: {
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  radius_km: number;
  urgency: Urgency;
  time_window_hours: number | null;
  rare_blood: boolean;
  /** Fields the assistant still needs from the user, in ask order. */
  missing: string[];
}

export interface EmergencyRequest {
  id: string;
  requestCode: string;
  patientReference: string | null;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  unitsRequired: number;
  unitsFound: number;
  rarePhenotype: string | null;
  hospitalName: string | null;
  hospitalAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string;
  urgency: Urgency;
  neededBy: string | null;
  status: EmergencyStatus;
  contactHandle: string | null;
  createdAt: string;
  updatedAt: string;
}
