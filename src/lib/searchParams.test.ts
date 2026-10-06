import { describe, expect, it } from "vitest";

import { parseSearchParams, SUPPORTED_COMPONENTS } from "@/lib/searchParams";

const q = (s: string) => parseSearchParams(new URLSearchParams(s));

describe("blood group", () => {
  it("parses the canonical short forms", () => {
    expect(q("bloodGroup=O-").bloodGroup).toBe("O-");
    expect(q("bloodGroup=AB%2B").bloodGroup).toBe("AB+");
    expect(q("group=B-").bloodGroup).toBe("B-");
  });

  it("survives the '+' being swallowed as a space by URLSearchParams", () => {
    expect(q("bloodGroup=O+").bloodGroup).toBe("O+");
  });

  it("accepts unicode minus and spoken forms", () => {
    expect(q(`bloodGroup=${encodeURIComponent("O\u2212")}`).bloodGroup).toBe("O-");
    expect(q("bloodGroup=o%20negative").bloodGroup).toBe("O-");
  });

  it("recognises rare groups", () => {
    expect(q("bloodGroup=OH").bloodGroup).toBe("OH");
    expect(q("bloodGroup=bombay").bloodGroup).toBe("OH");
    expect(q("bloodGroup=P-BOMBAY").bloodGroup).toBe("P-BOMBAY");
    expect(q("bloodGroup=OH").rareBlood).toBe(true);
    expect(q("bloodGroup=O-").rareBlood).toBe(false);
  });

  it("nulls an unknown group rather than guessing", () => {
    expect(q("bloodGroup=XY").bloodGroup).toBeNull();
  });
});

describe("component", () => {
  it("is case-insensitive", () => {
    expect(q("component=platelets").component).toBe("PLATELETS");
    expect(q("component=prbc").component).toBe("PRBC");
  });

  it("nulls anything outside the supported list", () => {
    expect(q("component=UNICORN").component).toBeNull();
    expect(q("component=").component).toBeNull();
  });

  it("covers the documented component set", () => {
    expect(SUPPORTED_COMPONENTS).toContain("PRBC");
    expect(SUPPORTED_COMPONENTS).toContain("FFP");
    expect(SUPPORTED_COMPONENTS).toHaveLength(7);
  });
});

describe("numeric clamping", () => {
  it("clamps radius into 1..300 km", () => {
    expect(q("radius=25").radiusKm).toBe(25);
    expect(q("radius=0").radiusKm).toBe(1);
    expect(q("radius=9999").radiusKm).toBe(300);
    expect(q("radius=abc").radiusKm).toBe(50);
  });

  it("defaults to a wider radius during an emergency", () => {
    expect(q("urgency=emergency").radiusKm).toBe(25);
    expect(q("urgency=urgent").radiusKm).toBe(50);
  });

  it("clamps quantity into 1..50", () => {
    expect(q("quantity=4").quantity).toBe(4);
    expect(q("quantity=0").quantity).toBe(1);
    expect(q("quantity=500").quantity).toBe(50);
    expect(q("quantity=many").quantity).toBe(1);
  });
});

describe("urgency and intent", () => {
  it("accepts only the three urgency values", () => {
    expect(q("urgency=emergency").urgency).toBe("emergency");
    expect(q("urgency=urgent").urgency).toBe("urgent");
    expect(q("urgency=routine").urgency).toBe("routine");
    expect(q("urgency=panicked").urgency).toBe("routine");
    expect(q("").urgency).toBe("routine");
  });

  it("rejects an unknown intent and falls back sensibly", () => {
    expect(q("intent=do_something").intent).toBe("find_blood_bank");
    expect(q("intent=do_something&bloodGroup=O-").intent).toBe("find_blood");
    expect(q("intent=find_donor&bloodGroup=O-").intent).toBe("find_donor");
  });
});

describe("location", () => {
  it("canonicalises a city through the gazetteer", () => {
    const parsed = q("city=bangalore");
    expect(parsed.city).toBe("Bengaluru");
    expect(parsed.location).toEqual({ latitude: 12.9716, longitude: 77.5946 });
  });

  it("keeps an unrecognised city typed verbatim, with no coordinates", () => {
    const parsed = q("city=Some%20Village");
    expect(parsed.city).toBe("Some Village");
    expect(parsed.location).toBeNull();
  });

  it("prefers explicit coordinates when supplied", () => {
    const parsed = q("lat=12.97&lon=77.59&city=Delhi");
    expect(parsed.location).toEqual({ latitude: 12.97, longitude: 77.59 });
    expect(parsed.city).toBe("Delhi");
  });

  it("ignores malformed coordinates", () => {
    expect(q("lat=abc&lon=xyz").location).toBeNull();
    expect(q("lat=12.97").location).toBeNull();
  });

  it("resolves nothing when neither city nor coordinates are given", () => {
    const parsed = q("bloodGroup=O-");
    expect(parsed.city).toBeNull();
    expect(parsed.location).toBeNull();
  });
});

describe("rare flag", () => {
  it("can be set explicitly", () => {
    expect(q("rare=true").rareBlood).toBe(true);
    expect(q("rare=yes").rareBlood).toBe(false);
  });

  it("is implied by a rare blood group", () => {
    expect(q("bloodGroup=P-BOMBAY").rareBlood).toBe(true);
  });
});
