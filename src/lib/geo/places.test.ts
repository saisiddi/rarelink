import { describe, expect, it } from "vitest";

import { resolvePlace } from "@/lib/geo/places";

describe("resolvePlace — typo tolerance", () => {
  it("resolves a one-letter misspelling to the right city", () => {
    expect(resolvePlace("banglore")?.name).toBe("Bengaluru");
    expect(resolvePlace("delhii")?.name).toBe("Delhi");
  });

  it("resolves a misspelling inside a full sentence", () => {
    expect(resolvePlace("i want 0- blood from banglore")?.name).toBe("Bengaluru");
  });

  it("still returns null for genuine unknowns", () => {
    expect(resolvePlace("xyz")).toBeNull();
    expect(resolvePlace("urgent")).toBeNull();
    expect(resolvePlace("want")).toBeNull();
    expect(resolvePlace("blood")).toBeNull();
    expect(resolvePlace("units")).toBeNull();
  });

  it("exact and substring matches still win", () => {
    expect(resolvePlace("Bangalore")?.name).toBe("Bengaluru");
    expect(resolvePlace("Pune")?.name).toBe("Pune");
  });
});
