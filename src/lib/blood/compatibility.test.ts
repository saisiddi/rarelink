import { describe, expect, it } from "vitest";

import {
  bloodGroupLabel,
  checkCompatibility,
  isRareGroup,
  normalizeBloodGroup,
  searchableGroups,
} from "@/lib/blood/compatibility";
import { STANDARD_BLOOD_GROUPS } from "@/lib/types";

describe("normalizeBloodGroup", () => {
  it("parses every standard group in short form", () => {
    for (const g of STANDARD_BLOOD_GROUPS) {
      expect(normalizeBloodGroup(g)?.code).toBe(g);
    }
  });

  it("parses spoken forms", () => {
    expect(normalizeBloodGroup("o negative")?.code).toBe("O-");
    expect(normalizeBloodGroup("B positive")?.code).toBe("B+");
    expect(normalizeBloodGroup("ab -")?.code).toBe("AB-");
    expect(normalizeBloodGroup("A Rh-")?.code).toBe("A-");
  });

  it("normalises unicode minus signs", () => {
    expect(normalizeBloodGroup("O\u2212")?.code).toBe("O-");
    expect(normalizeBloodGroup("O\u2013")?.code).toBe("O-");
  });

  it("treats a bare ABO letter as Rh positive", () => {
    expect(normalizeBloodGroup("O")?.code).toBe("O+");
  });

  it("NEVER collapses Bombay / O(H) into O-", () => {
    for (const raw of ["bombay", "Bombay phenotype", "O(H)", "Oh", "HH", "bombay blood group"]) {
      const parsed = normalizeBloodGroup(raw);
      expect(parsed, `parsed ${raw}`).not.toBeNull();
      expect(parsed?.code, raw).toBe("OH");
      expect(parsed?.isRare, raw).toBe(true);
      expect(parsed?.code, raw).not.toBe("O-");
    }
  });

  it("recognises para-Bombay separately", () => {
    expect(normalizeBloodGroup("para-bombay")?.code).toBe("P-BOMBAY");
    expect(normalizeBloodGroup("Para Bombay")?.code).toBe("P-BOMBAY");
  });

  it("rejects nonsense", () => {
    expect(normalizeBloodGroup("")).toBeNull();
    expect(normalizeBloodGroup("   ")).toBeNull();
    expect(normalizeBloodGroup("XY+")).toBeNull();
    expect(normalizeBloodGroup("unknown")).toBeNull();
  });
});

describe("labels", () => {
  it("renders human labels", () => {
    expect(bloodGroupLabel("A+")).toBe("A positive");
    expect(bloodGroupLabel("O-")).toBe("O negative");
    expect(bloodGroupLabel("OH")).toBe("Bombay (Oh)");
    expect(bloodGroupLabel("P-BOMBAY")).toBe("Para-Bombay");
  });

  it("flags rarity", () => {
    expect(isRareGroup("OH")).toBe(true);
    expect(isRareGroup("P-BOMBAY")).toBe(true);
    expect(isRareGroup("O-")).toBe(false);
  });
});

describe("red cell (PRBC) compatibility", () => {
  it("gives A+ only A and O donors", () => {
    expect(searchableGroups("A+", "PRBC").sort()).toEqual(["A+", "A-", "O+", "O-"]);
  });

  it("restricts Rh-negative recipients to Rh-negative donors", () => {
    expect(searchableGroups("O-", "PRBC")).toEqual(["O-"]);
    expect(searchableGroups("B-", "PRBC")).toEqual(["B-", "O-"]);
  });

  it("lets Rh-positive recipients take either Rh type", () => {
    expect(searchableGroups("O+", "PRBC").sort()).toEqual(["O+", "O-"]);
  });

  it("gives AB+ every red cell group (universal recipient)", () => {
    expect(new Set(searchableGroups("AB+", "PRBC"))).toEqual(new Set(STANDARD_BLOOD_GROUPS));
  });

  it("gives O- only O- (universal donor is not a free-for-all for recipients)", () => {
    expect(checkCompatibility("O-", "PRBC").candidates).toEqual(["O-"]);
  });

  it("asserts confidence for ordinary red cell matches", () => {
    expect(checkCompatibility("A+", "PRBC").confidence).toBe("confirmed");
  });
});

describe("plasma compatibility", () => {
  it("is the inverse ABO rule and ignores Rh", () => {
    // O- recipient can receive plasma from every ABO group, Rh+ included.
    expect(new Set(searchableGroups("O-", "FFP"))).toEqual(new Set(STANDARD_BLOOD_GROUPS));
    // AB recipient only takes AB plasma.
    expect(searchableGroups("AB+", "FFP").sort()).toEqual(["AB+", "AB-"]);
    // A recipient takes A or AB.
    expect(searchableGroups("A+", "FFP").sort()).toEqual(["A+", "A-", "AB+", "AB-"]);
  });

  it("applies the same rule to SDP", () => {
    expect(searchableGroups("B+", "SDP")).toEqual(searchableGroups("B+", "FFP"));
  });

  it("documents that Rh is not a plasma criterion", () => {
    const result = checkCompatibility("A+", "FFP");
    expect(result.notes.join(" ")).toMatch(/Rh type is not a plasma-matching criterion/);
  });
});

describe("platelets", () => {
  it("escalates rather than asserting", () => {
    expect(checkCompatibility("A+", "PLATELETS").confidence).toBe("confirmation_required");
  });

  it("prefers Rh-negative platelets for Rh-negative recipients", () => {
    const result = checkCompatibility("O-", "PLATELETS");
    expect(result.candidates.every((g) => g.endsWith("-"))).toBe(true);
    expect(result.conditional.length).toBeGreaterThan(0);
    expect(result.conditional.every((g) => g.endsWith("+"))).toBe(true);
  });
});

describe("cryoprecipitate", () => {
  it("is ABO-non-specific but never confidently asserted", () => {
    const result = checkCompatibility("A+", "CRYO");
    expect(result.candidates).toEqual(STANDARD_BLOOD_GROUPS);
    expect(result.confidence).toBe("confirmation_required");
  });
});

describe("rare phenotypes", () => {
  it("Bombay recipients only ever match Bombay — never ordinary O-", () => {
    for (const component of ["PRBC", "WHOLE_BLOOD", "FFP", "PLATELETS"] as const) {
      const result = checkCompatibility("OH", component);
      expect(result.candidates, component).toEqual(["OH"]);
      expect(result.candidates, component).not.toContain("O-");
      expect(result.confidence, component).toBe("confirmation_required");
    }
  });

  it("says explicitly that Oh is not O−", () => {
    const result = checkCompatibility("OH", "PRBC");
    expect(result.notes.join(" ")).toMatch(/not ordinary O/);
    expect(result.notes.join(" ")).toMatch(/qualified blood bank/);
  });

  it("para-Bombay matches only itself", () => {
    expect(checkCompatibility("P-BOMBAY", "PRBC").candidates).toEqual(["P-BOMBAY"]);
    expect(checkCompatibility("P-BOMBAY", "PRBC").confidence).toBe("confirmation_required");
  });
});

describe("digit-zero typos", () => {
  it("reads 0 as O in group position", () => {
    expect(normalizeBloodGroup("0-")?.code).toBe("O-");
    expect(normalizeBloodGroup("0+")?.code).toBe("O+");
    expect(normalizeBloodGroup("0 negative")?.code).toBe("O-");
    expect(normalizeBloodGroup("0 Rh+")?.code).toBe("O+");
  });

  it("leaves quantities alone", () => {
    expect(normalizeBloodGroup("0 units")).toBeNull();
    expect(normalizeBloodGroup("10")).toBeNull();
  });
});
