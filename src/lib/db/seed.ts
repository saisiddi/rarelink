/**
 * Demo / reference dataset.
 *
 * All rows created here are clearly marked `is_demo = 1` and the UI labels
 * them "DEMO DATASET". Names are fictional, phone numbers use obviously
 * fake all-zero exchanges so they can never be dialled by accident.
 *
 * Switching to real data means configuring a provider (see
 * `src/lib/providers`) — no part of the application logic changes.
 */

import type { DatabaseSync } from "node:sqlite";

import type { BloodComponent, BloodGroup } from "../types";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------
// Blood banks
// ---------------------------------------------------------------------------

interface BankSeed {
  id: string;
  name: string;
  hospital?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lon: number;
  std: string;
  category: "GOVERNMENT" | "PRIVATE" | "RED_CROSS" | "NGO" | "OTHER";
  license: string;
  apheresis: boolean;
  open24x7: boolean;
  components: BloodComponent[];
  verified: boolean;
}

const ALL: BloodComponent[] = [
  "WHOLE_BLOOD",
  "PRBC",
  "PLATELETS",
  "SDP",
  "FFP",
  "CRYO",
];

const BANKS: BankSeed[] = [
  {
    id: "bb_blr_city",
    name: "City Blood Centre",
    address: "100 Feet Road, Indiranagar, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    lat: 12.9719,
    lon: 77.6412,
    std: "080",
    category: "PRIVATE",
    license: "KA/BB/2019/0442",
    apheresis: true,
    open24x7: true,
    components: ALL,
    verified: true,
  },
  {
    id: "bb_blr_arogya",
    name: "Arogya Blood Bank",
    hospital: "Arogya Multispeciality Hospital",
    address: "4th Block, Jayanagar, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560011",
    lat: 12.925,
    lon: 77.5938,
    std: "080",
    category: "PRIVATE",
    license: "KA/BB/2017/0193",
    apheresis: false,
    open24x7: true,
    components: ALL,
    verified: true,
  },
  {
    id: "bb_blr_nandi",
    name: "Nandi Regional Blood Centre",
    address: "Airport Road, Yelahanka, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560064",
    lat: 13.1007,
    lon: 77.5963,
    std: "080",
    category: "GOVERNMENT",
    license: "KA/BB/2015/0071",
    apheresis: false,
    open24x7: false,
    components: ["WHOLE_BLOOD", "PRBC", "SDP", "FFP"],
    verified: true,
  },
  {
    id: "bb_mnl_coastal",
    name: "Coastal Blood Centre",
    address: "University Road, Manipal, Udupi",
    city: "Manipal",
    state: "Karnataka",
    pincode: "576104",
    lat: 13.3514,
    lon: 74.7844,
    std: "08202",
    category: "PRIVATE",
    license: "KA/BB/2018/0655",
    apheresis: true,
    open24x7: true,
    components: ALL,
    verified: true,
  },
  {
    id: "bb_pne_sahyadri",
    name: "Sahyadri Blood Centre",
    address: "Deccan Gymkhana, Pune",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411004",
    lat: 18.5308,
    lon: 73.8478,
    std: "020",
    category: "PRIVATE",
    license: "MH/BB/2016/0288",
    apheresis: true,
    open24x7: true,
    components: ALL,
    verified: true,
  },
  {
    id: "bb_mum_gateway",
    name: "Gateway Blood Bank",
    address: "Fort Area, Mumbai",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    lat: 18.9388,
    lon: 72.8354,
    std: "022",
    category: "RED_CROSS",
    license: "MH/BB/2014/0017",
    apheresis: true,
    open24x7: true,
    components: ALL,
    verified: true,
  },
  {
    id: "bb_del_capital",
    name: "Capital Blood Centre",
    address: "Connaught Place, New Delhi",
    city: "Delhi",
    state: "Delhi",
    pincode: "110001",
    lat: 28.6315,
    lon: 77.2167,
    std: "011",
    category: "GOVERNMENT",
    license: "DL/BB/2013/0104",
    apheresis: false,
    open24x7: true,
    components: ["WHOLE_BLOOD", "PRBC", "PLATELETS", "SDP", "FFP"],
    verified: true,
  },
  {
    id: "bb_hyd_charminar",
    name: "Charminar Transfusion Centre",
    address: "Banjara Hills, Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500034",
    lat: 17.4126,
    lon: 78.4392,
    std: "040",
    category: "PRIVATE",
    license: "TS/BB/2019/0321",
    apheresis: false,
    open24x7: true,
    components: ALL,
    verified: true,
  },
  {
    id: "bb_maa_marina",
    name: "Marina Blood Centre",
    address: "Guindy, Chennai",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600032",
    lat: 13.0067,
    lon: 80.2206,
    std: "044",
    category: "PRIVATE",
    license: "TN/BB/2018/0512",
    apheresis: true,
    open24x7: false,
    components: ALL,
    verified: true,
  },
  {
    id: "bb_ccu_hooghly",
    name: "Hooghly Voluntary Blood Centre",
    address: "Salt Lake Sector II, Kolkata",
    city: "Kolkata",
    state: "West Bengal",
    pincode: "700091",
    lat: 22.5849,
    lon: 88.4166,
    std: "033",
    category: "NGO",
    license: "WB/BB/2016/0139",
    apheresis: false,
    open24x7: false,
    components: ["WHOLE_BLOOD", "PRBC", "SDP"],
    verified: true,
  },
  {
    id: "bb_jai_pink",
    name: "Pink City Blood Centre",
    address: "C-Scheme, Jaipur",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001",
    lat: 26.9124,
    lon: 75.7873,
    std: "0141",
    category: "PRIVATE",
    license: "RJ/BB/2020/0776",
    apheresis: false,
    open24x7: false,
    components: ["WHOLE_BLOOD", "PRBC", "SDP", "FFP"],
    verified: false,
  },
  {
    id: "bb_cok_arabian",
    name: "Arabian Sea Blood Centre",
    address: "Ernakulam, Kochi",
    city: "Kochi",
    state: "Kerala",
    pincode: "682035",
    lat: 9.9312,
    lon: 76.2673,
    std: "0484",
    category: "RED_CROSS",
    license: "KL/BB/2017/0229",
    apheresis: true,
    open24x7: true,
    components: ALL,
    verified: true,
  },
];

const GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ---------------------------------------------------------------------------
// Donors
// ---------------------------------------------------------------------------

interface DonorSeed {
  id: string;
  name: string;
  group: BloodGroup;
  rare?: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  verified: boolean;
  label: "Blood-bank verified" | "Phone verified" | "Self-reported";
  availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  lastDonationDaysAgo?: number;
  eligibleInDays?: number;
  contact: "SMS" | "WHATSAPP" | "CALL" | "EMAIL";
  notifications: boolean;
}

const DONORS: DonorSeed[] = [
  // --- Bengaluru (normal) ---
  { id: "dn_blr_01", name: "Aditi S.", group: "O-", city: "Bengaluru", state: "Karnataka", lat: 12.9784, lon: 77.6408, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 48, contact: "WHATSAPP", notifications: true },
  { id: "dn_blr_02", name: "Rahul M.", group: "O-", city: "Bengaluru", state: "Karnataka", lat: 12.9352, lon: 77.6245, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 96, contact: "CALL", notifications: true },
  { id: "dn_blr_03", name: "Sneha K.", group: "O+", city: "Bengaluru", state: "Karnataka", lat: 12.9116, lon: 77.6389, verified: true, label: "Phone verified", availability: "AVAILABLE", lastDonationDaysAgo: 30, contact: "SMS", notifications: true },
  { id: "dn_blr_04", name: "Vikram J.", group: "B+", city: "Bengaluru", state: "Karnataka", lat: 12.9299, lon: 77.5826, verified: true, label: "Blood-bank verified", availability: "LIMITED", lastDonationDaysAgo: 120, contact: "WHATSAPP", notifications: true },
  { id: "dn_blr_05", name: "Fatima B.", group: "A+", city: "Bengaluru", state: "Karnataka", lat: 12.9698, lon: 77.75, verified: false, label: "Self-reported", availability: "AVAILABLE", contact: "SMS", notifications: true },
  { id: "dn_blr_06", name: "Joseph P.", group: "AB+", city: "Bengaluru", state: "Karnataka", lat: 13.1007, lon: 77.5963, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 60, contact: "CALL", notifications: false },
  { id: "dn_blr_07", name: "Meera R.", group: "B-", city: "Bengaluru", state: "Karnataka", lat: 12.9166, lon: 77.6101, verified: true, label: "Phone verified", availability: "AVAILABLE", lastDonationDaysAgo: 75, contact: "WHATSAPP", notifications: true },
  { id: "dn_blr_08", name: "Arjun N.", group: "O+", city: "Bengaluru", state: "Karnataka", lat: 12.9915, lon: 77.5554, verified: false, label: "Self-reported", availability: "UNAVAILABLE", eligibleInDays: 42, contact: "SMS", notifications: true },
  { id: "dn_blr_09", name: "Kavya D.", group: "A-", city: "Bengaluru", state: "Karnataka", lat: 12.9432, lon: 77.5967, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 110, contact: "CALL", notifications: true },
  { id: "dn_blr_10", name: "Imran H.", group: "AB-", city: "Bengaluru", state: "Karnataka", lat: 12.9592, lon: 77.6484, verified: true, label: "Blood-bank verified", availability: "LIMITED", lastDonationDaysAgo: 45, contact: "WHATSAPP", notifications: true },

  // --- Rare donors (Bombay / Para-Bombay) ---
  { id: "dn_rare_01", name: "Lakshmi V.", group: "OH", rare: "Bombay phenotype (Oh)", city: "Bengaluru", state: "Karnataka", lat: 13.015, lon: 77.57, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 210, contact: "CALL", notifications: true },
  { id: "dn_rare_02", name: "Harish G.", group: "OH", rare: "Bombay phenotype (Oh)", city: "Bengaluru", state: "Karnataka", lat: 12.88, lon: 77.62, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 260, contact: "CALL", notifications: true },
  { id: "dn_rare_03", name: "Zoya R.", group: "OH", rare: "Bombay phenotype (Oh)", city: "Mumbai", state: "Maharashtra", lat: 19.076, lon: 72.8777, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 190, contact: "CALL", notifications: true },
  { id: "dn_rare_04", name: "Nithin T.", group: "P-BOMBAY", rare: "Para-Bombay", city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lon: 80.2707, verified: true, label: "Blood-bank verified", availability: "LIMITED", lastDonationDaysAgo: 300, contact: "CALL", notifications: true },
  { id: "dn_rare_05", name: "Sana A.", group: "OH", rare: "Bombay phenotype (Oh)", city: "Delhi", state: "Delhi", lat: 28.6139, lon: 77.209, verified: false, label: "Self-reported", availability: "AVAILABLE", contact: "SMS", notifications: false },

  // --- Other cities ---
  { id: "dn_pne_01", name: "Prasad L.", group: "O-", city: "Pune", state: "Maharashtra", lat: 18.5204, lon: 73.8567, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 55, contact: "WHATSAPP", notifications: true },
  { id: "dn_pne_02", name: "Neha B.", group: "A+", city: "Pune", state: "Maharashtra", lat: 18.5433, lon: 73.8889, verified: true, label: "Phone verified", availability: "AVAILABLE", lastDonationDaysAgo: 88, contact: "SMS", notifications: true },
  { id: "dn_mum_01", name: "Rohan D.", group: "B+", city: "Mumbai", state: "Maharashtra", lat: 19.076, lon: 72.8777, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 40, contact: "CALL", notifications: true },
  { id: "dn_mum_02", name: "Ayesha K.", group: "O-", city: "Mumbai", state: "Maharashtra", lat: 19.0176, lon: 72.8562, verified: true, label: "Blood-bank verified", availability: "LIMITED", lastDonationDaysAgo: 65, contact: "WHATSAPP", notifications: true },
  { id: "dn_del_01", name: "Gaurav S.", group: "O-", city: "Delhi", state: "Delhi", lat: 28.6139, lon: 77.209, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 72, contact: "CALL", notifications: true },
  { id: "dn_del_02", name: "Priya W.", group: "AB-", city: "Delhi", state: "Delhi", lat: 28.5355, lon: 77.391, verified: false, label: "Self-reported", availability: "AVAILABLE", contact: "SMS", notifications: true },
  { id: "dn_hyd_01", name: "Sandeep Y.", group: "A-", city: "Hyderabad", state: "Telangana", lat: 17.385, lon: 78.4867, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 50, contact: "WHATSAPP", notifications: true },
  { id: "dn_maa_01", name: "Divya M.", group: "B-", city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lon: 80.2707, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 67, contact: "CALL", notifications: true },
  { id: "dn_ccu_01", name: "Anirban C.", group: "O+", city: "Kolkata", state: "West Bengal", lat: 22.5726, lon: 88.3639, verified: true, label: "Phone verified", availability: "AVAILABLE", lastDonationDaysAgo: 91, contact: "SMS", notifications: true },
  { id: "dn_cok_01", name: "Anjali T.", group: "A+", city: "Kochi", state: "Kerala", lat: 9.9312, lon: 76.2673, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 34, contact: "WHATSAPP", notifications: true },
  { id: "dn_jai_01", name: "Mahendra P.", group: "O+", city: "Jaipur", state: "Rajasthan", lat: 26.9124, lon: 75.7873, verified: false, label: "Self-reported", availability: "AVAILABLE", contact: "SMS", notifications: true },
  { id: "dn_mnl_01", name: "Shreya B.", group: "O-", city: "Manipal", state: "Karnataka", lat: 13.3514, lon: 74.7844, verified: true, label: "Blood-bank verified", availability: "AVAILABLE", lastDonationDaysAgo: 58, contact: "CALL", notifications: true },
];

// ---------------------------------------------------------------------------
// Inventory generation (deterministic)
// ---------------------------------------------------------------------------

function statusFor(units: number): string {
  if (units <= 0) return "UNAVAILABLE";
  if (units <= 3) return "LOW";
  return "AVAILABLE";
}

/**
 * Stable primary key for an inventory row.
 *
 * The +/- in a blood group must survive sanitising — stripping them would make
 * "A+" and "A-" collapse onto the same id and silently drop every Rh-negative
 * row (a bug this helper exists to prevent).
 */
function inventoryId(bankId: string, component: BloodComponent, group: BloodGroup): string {
  const groupKey = group.replace(/\+/g, "pos").replace(/-/g, "neg");
  return `inv_${bankId}_${component}_${groupKey}`.replace(/[^a-z0-9_]/gi, "");
}

function buildInventory(now: number) {
  const rows: Array<{
    id: string;
    bank: string;
    group: BloodGroup;
    component: BloodComponent;
    units: number;
    status: string;
    updatedAt: number;
    source: string;
    sourceRecordId: string | null;
  }> = [];

  for (const bank of BANKS) {
    const components = bank.components.filter((c) =>
      ["PRBC", "PLATELETS", "FFP"].includes(c),
    );
    for (const component of components) {
      for (const group of GROUPS) {
        const r = hash(`${bank.id}|${component}|${group}`);
        const r2 = hash(`${group}|${component}|${bank.id}`);
        let units = r < 0.12 ? 0 : Math.floor(r2 * 12);
        if (component === "FFP" && group === "O-") units = Math.min(units, 4);
        if (component === "PLATELETS" && r2 < 0.35) units = Math.floor(r2 * 6);

        // Freshness spread so LIVE / RECENT / STALE are all demoable.
        const ageRoll = hash(`age|${bank.id}|${component}|${group}`);
        let ageMs: number;
        if (ageRoll < 0.45) ageMs = Math.floor(ageRoll * 50 * MINUTE);
        else if (ageRoll < 0.78) ageMs = 45 * MINUTE + Math.floor(ageRoll * 2.5 * HOUR);
        else ageMs = 5 * HOUR + Math.floor(ageRoll * 30 * HOUR);

        rows.push({
          id: inventoryId(bank.id, component, group),
          bank: bank.id,
          group,
          component,
          units,
          status: statusFor(units),
          updatedAt: now - ageMs,
          source: "demo",
          sourceRecordId: `DEMO-${bank.id}-${component}-${group}`,
        });
      }
    }

    // One deliberately stale Whole Blood row per bank (no units modelled).
    rows.push({
      id: inventoryId(bank.id, "WHOLE_BLOOD", "O+"),
      bank: bank.id,
      group: "O+",
      component: "WHOLE_BLOOD",
      units: 5,
      status: "AVAILABLE",
      updatedAt: now - 9 * DAY,
      source: "demo",
      sourceRecordId: `DEMO-${bank.id}-WB-O+`,
    });
  }

  // Rare phenotype: never "in stock" — always confirm-by-phone.
  rows.push({
    id: "inv_bb_blr_city_OH_PRBC",
    bank: "bb_blr_city",
    group: "OH",
    component: "PRBC",
    units: 0,
    status: "UNKNOWN",
    updatedAt: now - 40 * MINUTE,
    source: "demo",
    sourceRecordId: "DEMO-rare-OH-blr",
  });
  rows.push({
    id: "inv_bb_mum_gateway_OH_PRBC",
    bank: "bb_mum_gateway",
    group: "OH",
    component: "PRBC",
    units: 0,
    status: "UNKNOWN",
    updatedAt: now - 3 * HOUR,
    source: "demo",
    sourceRecordId: "DEMO-rare-OH-mum",
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

const RARE_GROUPS = [
  {
    id: "rbg_oh",
    name: "Bombay phenotype",
    code: "OH",
    system: "Hh / ABO",
    description:
      "Red cells lacking A, B and H antigens. Individuals with this phenotype cannot receive ordinary O− blood.",
    compatibility_notes:
      "Bombay phenotype patients require Bombay-phenotype (Oh) blood. Compatibility must be confirmed by a qualified blood bank / transfusion service before transfusion.",
    verification_required: 1,
    source: "DGHS guidance / eRaktKosh rare-group registry",
  },
  {
    id: "rbg_pbombay",
    name: "Para-Bombay",
    code: "P-BOMBAY",
    system: "Hh / ABO",
    description:
      "Weak or absent H expression with residual A/B activity; serologically easy to mis-type as ABO-unspecified.",
    compatibility_notes:
      "Phenotype-matched blood must be arranged and confirmed by a qualified blood bank. Do not substitute on the basis of ABO group alone.",
    verification_required: 1,
    source: "DGHS guidance / eRaktKosh rare-group registry",
  },
  {
    id: "rbg_kell",
    name: "Kell-null (K₀)",
    code: "K0",
    system: "Kell",
    description: "Absence of Kell antigen system expression; extremely rare.",
    compatibility_notes:
      "Rare-donor registry lookup and blood-bank confirmation required before transfusion.",
    verification_required: 1,
    source: "Rare donor registry reference",
  },
  {
    id: "rbg_kel",
    name: "Kel-negative (antigen-negative phenotype)",
    code: "KEL",
    system: "Kell",
    description: "Antigen-negative red cells required for alloimmunised patients.",
    compatibility_notes:
      "Antigen-negative units must be requested through a blood bank with rare-donor registry access.",
    verification_required: 1,
    source: "Rare donor registry reference",
  },
];

export function ensureSeed(db: DatabaseSync): void {
  const row = db.prepare("SELECT COUNT(*) AS n FROM blood_banks").get() as
    | { n?: number | bigint }
    | undefined;
  if (Number(row?.n ?? 0) > 0) return;
  seedDatabase(db);
}

export function resetAndSeed(db: DatabaseSync): void {
  const tables = [
    "analytics_events",
    "chat_messages",
    "chat_sessions",
    "donor_matches",
    "donor_requests",
    "verification_records",
    "audit_logs",
    "emergency_requests",
    "blood_inventory",
    "donors",
    "blood_banks",
    "rare_blood_groups",
    "data_sources",
  ];
  for (const t of tables) db.exec(`DELETE FROM ${t}`);
  seedDatabase(db);
}

export function seedDatabase(db: DatabaseSync, now = Date.now()): void {
  const isoNow = iso(now);

  const insertSource = db.prepare(
    `INSERT OR IGNORE INTO data_sources (id, name, kind, base_url, attribution, is_live, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertSource.run("ds_demo", "RARELINK demo dataset", "demo", null, "Fictional data for demonstration", 0, isoNow, isoNow);
  insertSource.run(
    "ds_eraktkosh",
    "eRaktKosh",
    "official",
    "https://eraktkosh.mohfw.gov.in/",
    "Government of India blood bank inventory & directory",
    process.env.ERAKTKOSH_BASE_URL ? 1 : 0,
    isoNow,
    isoNow,
  );
  insertSource.run(
    "ds_ircs",
    "Indian Red Cross Society",
    "partner",
    "https://www.indianredcross.org/ebloodservices/",
    "IRCS blood centre network / eBloodServices",
    process.env.IRCS_BASE_URL ? 1 : 0,
    isoNow,
    isoNow,
  );

  const insertBank = db.prepare(
    `INSERT OR IGNORE INTO blood_banks
      (id, name, hospital_name, address, city, district, state, pincode, latitude, longitude,
       phone, emergency_phone, email, website, category, license_number, components_supported,
       apheresis_available, opening_hours, emergency_24x7, source, source_id, verified, is_demo,
       last_verified_at, last_inventory_update, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const b of BANKS) {
    insertBank.run(
      b.id,
      b.name,
      b.hospital ?? null,
      b.address,
      b.city,
      b.city,
      b.state,
      b.pincode,
      b.lat,
      b.lon,
      `${b.std}-0000 0001`,
      `${b.std}-0000 1100`,
      `contact@${b.id}.example.org`,
      null,
      b.category,
      b.license,
      JSON.stringify(b.components),
      b.apheresis ? 1 : 0,
      b.open24x7 ? "24×7" : "Mon–Sat 09:00–20:00",
      b.open24x7 ? 1 : 0,
      "demo",
      `DEMO-${b.id}`,
      b.verified ? 1 : 0,
      1,
      iso(now - 6 * DAY),
      null,
      isoNow,
      isoNow,
    );
  }

  const inventory = buildInventory(now);
  const insertInv = db.prepare(
    `INSERT OR IGNORE INTO blood_inventory
      (id, blood_bank_id, blood_group, component, units_available, availability_status,
       last_updated_at, source, source_record_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of inventory) {
    insertInv.run(
      row.id,
      row.bank,
      row.group,
      row.component,
      row.units,
      row.status,
      iso(row.updatedAt),
      row.source,
      row.sourceRecordId,
      isoNow,
      isoNow,
    );
  }

  // Propagate the newest inventory timestamp onto each bank.
  db.exec(`
    UPDATE blood_banks SET last_inventory_update = (
      SELECT MAX(last_updated_at) FROM blood_inventory
      WHERE blood_inventory.blood_bank_id = blood_banks.id
    );
  `);

  for (const rg of RARE_GROUPS) {
    db.prepare(
      `INSERT OR IGNORE INTO rare_blood_groups
        (id, name, code, system, description, compatibility_notes, verification_required, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      rg.id,
      rg.name,
      rg.code,
      rg.system,
      rg.description,
      rg.compatibility_notes,
      rg.verification_required,
      rg.source,
      isoNow,
    );
  }

  const insertDonor = db.prepare(
    `INSERT OR IGNORE INTO donors
      (id, display_name, blood_group, rare_phenotype, city, district, state, latitude, longitude,
       availability_status, verification_status, verification_label, last_donation_date,
       eligible_from, consent_status, consent_at, last_verified_at, preferred_contact_method,
       emergency_notifications, is_demo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const d of DONORS) {
    const verificationStatus = d.verified ? "VERIFIED" : "PENDING";
    const lastDonation = d.lastDonationDaysAgo ? iso(now - d.lastDonationDaysAgo * DAY) : null;
    const eligibleFrom = d.eligibleInDays ? iso(now + d.eligibleInDays * DAY) : null;
    insertDonor.run(
      d.id,
      d.name,
      d.group,
      d.rare ?? null,
      d.city,
      d.city,
      d.state,
      d.lat,
      d.lon,
      d.availability,
      verificationStatus,
      d.label,
      lastDonation,
      eligibleFrom,
      "GRANTED",
      iso(now - 30 * DAY),
      d.verified ? iso(now - Math.floor(hash(d.id) * 20) * HOUR - 2 * HOUR) : null,
      d.contact,
      d.notifications ? 1 : 0,
      1,
      isoNow,
      isoNow,
    );
  }

  seedEmergencyRequests(db, now);
}

function seedEmergencyRequests(db: DatabaseSync, now: number): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO emergency_requests
      (id, request_code, patient_reference, blood_group, component, units_required, units_found,
       rare_phenotype, hospital_name, hospital_address, latitude, longitude, city, urgency,
       needed_by, status, contact_handle, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const requests = [
    {
      id: "emr_demo_01",
      code: "RL-DEMO-4192",
      group: "O-",
      component: "PRBC",
      units: 2,
      found: 2,
      city: "Bengaluru",
      status: "MATCHED",
      hospital: "City General Hospital (demo)",
      address: "Ulsoor, Bengaluru",
      lat: 12.9784,
      lon: 77.6408,
      ageMin: 46,
      neededBy: now + 3 * 60 * MINUTE,
      handle: "+91 90000 00001",
    },
    {
      id: "emr_demo_02",
      code: "RL-DEMO-4193",
      group: "OH",
      component: "PRBC",
      units: 1,
      found: 0,
      rare: "Bombay phenotype (Oh)",
      city: "Bengaluru",
      status: "OPEN",
      hospital: "Manipal Blood Centre (demo)",
      address: "Old Airport Road, Bengaluru",
      lat: 12.9592,
      lon: 77.6484,
      ageMin: 18,
      neededBy: now + 8 * 60 * MINUTE,
      handle: "+91 90000 00002",
    },
    {
      id: "emr_demo_03",
      code: "RL-DEMO-4188",
      group: "B+",
      component: "PLATELETS",
      units: 3,
      found: 3,
      city: "Pune",
      status: "FULFILLED",
      hospital: "Sahyadri Care Centre (demo)",
      address: "Deccan, Pune",
      lat: 18.5308,
      lon: 73.8478,
      ageMin: 60 * 26,
      neededBy: now - 20 * 60 * MINUTE,
      handle: "+91 90000 00003",
    },
  ];

  for (const r of requests) {
    insert.run(
      r.id,
      r.code,
      null,
      r.group,
      r.component,
      r.units,
      r.found,
      ("rare" in r ? (r.rare as string) : null) ?? null,
      r.hospital,
      r.address,
      r.lat,
      r.lon,
      r.city,
      "emergency",
      iso(r.neededBy),
      r.status,
      r.handle,
      "demo",
      iso(now - r.ageMin * MINUTE),
      iso(now - Math.floor(r.ageMin / 3) * MINUTE),
    );
  }
}
