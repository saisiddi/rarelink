import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";

import { sanitise, track } from "@/lib/analytics";
import { closeDb, getDb } from "@/lib/db";

const DB_PATH = process.env.DATABASE_PATH as string;

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
});

describe("sanitise — keys that must never reach storage", () => {
  const identifiers: Record<string, unknown> = {
    phone: "+91 9876543210",
    mobileNumber: "9876543210",
    email: "donor@example.com",
    patientName: "Asha Rao",
    displayName: "Asha",
    address: "12 MG Road",
    donorId: "dnr_123",
    id: "abc",
    idNumber: "ABCDE1234F",
    handle: "@asha",
    contact: "call me",
    otp: "493812",
    aadhaar: "1234 5678 9012",
    passport: "M1234567",
    license: "KA01 2020",
    secret: "s3cr3t",
    token: "eyJhbGciOi",
    apiKey: "sk-or-v1-abcdef",
    password: "hunter2",
    consent: true,
    govtId: "X",
    panNumber: "ABCDE1234F",
    voterId: "ABC1234567",
    drivingLicence: "KA01",
    sessionId: "sess_1",
  };

  it("drops every identifier key", () => {
    const out = sanitise(identifiers);
    expect(out).toEqual({});
    for (const key of Object.keys(identifiers)) {
      expect(out, `key ${key} survived`).not.toHaveProperty(key);
    }
  });

  it("keeps the aggregate, non-identifying fields the app actually records", () => {
    const out = sanitise({
      group: "O-",
      component: "PRBC",
      city: "Bengaluru",
      urgency: "emergency",
      resultCount: 7,
      radiusKm: 50,
      lat: 12.97,
      fromMap: true,
      note: null,
    });
    expect(out).toEqual({
      group: "O-",
      component: "PRBC",
      city: "Bengaluru",
      urgency: "emergency",
      resultCount: 7,
      radiusKm: 50,
      lat: 12.97,
      fromMap: true,
      note: null,
    });
  });
});

describe("sanitise — values that must never reach storage", () => {
  it("redacts a phone number smuggled through a neutral key", () => {
    expect(sanitise({ note: "call 9876543210" })).toEqual({ note: "[redacted]" });
    expect(sanitise({ detail: "+91-98765 43210" })).toEqual({ detail: "[redacted]" });
  });

  it("redacts long digit runs (OTP / Aadhaar / PAN)", () => {
    expect(sanitise({ ref: "12345678" })).toEqual({ ref: "[redacted]" });
    expect(sanitise({ ref: "ABCDE1234567F" })).toEqual({ ref: "[redacted]" });
  });

  it("redacts email-shaped values", () => {
    expect(sanitise({ from: "a.b+c@gmail.com" })).toEqual({ from: "[redacted]" });
  });

  it("truncates rather than stores free text", () => {
    const long = "a".repeat(500);
    expect(sanitise({ note: long }).note).toHaveLength(60);
  });

  it("passes ordinary short strings through untouched", () => {
    expect(sanitise({ note: "O- blood in Bengaluru" })).toEqual({ note: "O- blood in Bengaluru" });
  });

  it("drops objects and arrays instead of serialising them", () => {
    expect(sanitise({ payload: { phone: "123" }, list: [1, 2], fn: () => 1 })).toEqual({});
  });
});

describe("track", () => {
  it("writes nothing for an event outside the allowlist", async () => {
    const before = count("not_a_real_event");
    await track("patient_diagnosis", { group: "O-" });
    await track("some_random_event");
    expect(count("not_a_real_event")).toBe(before);
    expect(count("patient_diagnosis")).toBe(0);
  });

  it("stores only sanitised metadata for an allowed event", async () => {
    await track("blood_search", {
      group: "O-",
      component: "PRBC",
      city: "Bengaluru",
      urgency: "emergency",
      // A hostile or careless client could send any of these:
      phone: "+91 9876543210",
      note: "patient needs 9876543210",
      nested: { email: "x@y.z" },
    });

    const row = getDb()
      .prepare(
        "SELECT metadata FROM analytics_events WHERE event = 'blood_search' ORDER BY created_at DESC, rowid DESC LIMIT 1",
      )
      .get() as { metadata?: string | null } | undefined;

    expect(row?.metadata).toBeTruthy();
    const meta = JSON.parse(row?.metadata ?? "{}") as Record<string, unknown>;
    expect(meta).toMatchObject({
      group: "O-",
      component: "PRBC",
      city: "Bengaluru",
      urgency: "emergency",
    });
    expect(meta).not.toHaveProperty("phone");
    expect(meta).not.toHaveProperty("nested");
    // The value was neutralised, not stored.
    expect(meta.note).toBe("[redacted]");
    expect(row?.metadata).not.toContain("9876543210");
    expect(row?.metadata).not.toContain("@y.z");
  });

  it("resolves quietly — analytics must never break a request", async () => {
    await expect(track("blood_search", { group: "O-" })).resolves.toBeUndefined();
  });

  function count(event: string): number {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS n FROM analytics_events WHERE event = ?")
      .get(event) as { n: number | bigint } | undefined;
    return Number(row?.n ?? 0);
  }
});
