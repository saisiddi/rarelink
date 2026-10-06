/**
 * Deterministic blood compatibility rules engine.
 *
 * ⚠️ This module is the ONLY place in RARELINK that decides compatibility.
 * The LLM must never be asked to reason about compatibility — it calls
 * `checkCompatibility()` and reports what comes back.
 *
 * References: standard ABO/Rh red-cell, plasma and platelet selection
 * guidance, plus DGHS guidance that Bombay-phenotype (Oh) patients require
 * Bombay-phenotype blood — Oh is NOT ordinary O−.
 */

import type {
  BloodComponent,
  BloodGroup,
  RareBloodGroup,
  StandardBloodGroup,
} from "@/lib/types";
import { STANDARD_BLOOD_GROUPS } from "@/lib/types";

const STANDARD = new Set<string>(STANDARD_BLOOD_GROUPS);

export interface NormalizedGroup {
  code: BloodGroup;
  isRare: boolean;
  /** Human display label, e.g. "Bombay (Oh)". */
  label: string;
}

const RARE_ALIASES: Record<string, RareBloodGroup> = {
  OH: "OH",
  "O(H)": "OH",
  BOMBAY: "OH",
  "BOMBAY PHENOTYPE": "OH",
  "BOMBAY BLOOD": "OH",
  "BOMBAY BLOOD GROUP": "OH",
  "BOMBAY GROUP": "OH",
  HH: "OH",
  "O H": "OH",
  "O-H": "OH",
  "P-BOMBAY": "P-BOMBAY",
  "PARA BOMBAY": "P-BOMBAY",
  "PARA-BOMBAY": "P-BOMBAY",
  "PARABOMBAY": "P-BOMBAY",
  PBOMBAY: "P-BOMBAY",
};

/**
 * Parse whatever the user typed into a canonical blood group code.
 * Accepts: "o-", "o neg", "b negative", "a positive", "oh", "bombay",
 * "bombay phenotype", "para-bombay", "O Rh-", "AB -".
 */
export function normalizeBloodGroup(raw: string): NormalizedGroup | null {
  if (!raw) return null;
  const cleaned = raw
    .toUpperCase()
    .replace(/[−–—]/g, "-")
    .replace(/[.\t]/g, " ")
    // Digit-zero typo: "0-", "0+", "0 negative" all mean O. Only in group
    // position (directly before +/- or pos/neg) so "0 units" is untouched.
    .replace(/\b0(?=\s*(?:RH\s*)?(?:\+|-|POS|NEG))/g, "O")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  // Rare phenotypes first — "O(H)" and "bombay" must never collapse to O-.
  const rareKey = cleaned.replace(/\s*\(?\s*RH?\s*\)?$/i, "").trim();
  const rareHit =
    RARE_ALIASES[cleaned] ??
    RARE_ALIASES[cleaned.replace(/\s*PHENOTYPE$/, "").trim()] ??
    RARE_ALIASES[rareKey];
  if (rareHit) {
    return {
      code: rareHit,
      isRare: true,
      label: rareHit === "OH" ? "Bombay (Oh)" : "Para-Bombay",
    };
  }

  const withWordRh = cleaned
    .replace(/\bNEG(ATIVE)?\b/g, "-")
    .replace(/\bPOS(ITIVE)?\b/g, "+")
    .replace(/\bRH\b/g, "")
    .replace(/\s+/g, "");

  const aboMatch = /^(A|B|AB|O)([+-])?$/.exec(withWordRh);
  if (!aboMatch) return null;
  const [, abo, sign] = aboMatch;
  const rh = sign === "-" ? "-" : "+";
  const code = `${abo}${rh}` as StandardBloodGroup;
  if (!STANDARD.has(code)) return null;
  return { code, isRare: false, label: code };
}

export function isRareGroup(code: BloodGroup): boolean {
  return code === "OH" || code === "P-BOMBAY";
}

export function bloodGroupLabel(code: BloodGroup): string {
  if (code === "OH") return "Bombay (Oh)";
  if (code === "P-BOMBAY") return "Para-Bombay";
  return code.replace("+", " positive").replace("-", " negative");
}

const abo = (g: StandardBloodGroup) => g.replace(/[+-]$/, "");
const isRhNeg = (g: StandardBloodGroup) => g.endsWith("-");

/** RBC / PRBC donor selection — donor must not carry antigens the recipient lacks. */
function rbcDonors(recipient: StandardBloodGroup): StandardBloodGroup[] {
  const allowByAbo: Record<string, string[]> = {
    A: ["A", "O"],
    B: ["B", "O"],
    AB: ["A", "B", "AB", "O"],
    O: ["O"],
  };
  const aboAllowed = allowByAbo[abo(recipient)];
  const recipientRhNeg = isRhNeg(recipient);
  return STANDARD_BLOOD_GROUPS.filter((g) => {
    if (!aboAllowed.includes(abo(g))) return false;
    if (recipientRhNeg && !isRhNeg(g)) return false;
    return true;
  });
}

/** Plasma / FFP donor selection — donor plasma must not contain antibodies the recipient's cells carry. */
function plasmaDonors(recipient: StandardBloodGroup): StandardBloodGroup[] {
  // Donor AB plasma carries no anti-A / anti-B → acceptable for anyone ABO-wise.
  const allowByAbo: Record<string, string[]> = {
    A: ["A", "AB"],
    B: ["B", "AB"],
    AB: ["AB"],
    O: ["O", "A", "B", "AB"],
  };
  const allowed = allowByAbo[abo(recipient)];
  // ABO drives plasma selection; Rh(D) is not a plasma-matching criterion.
  return STANDARD_BLOOD_GROUPS.filter((g) => allowed.includes(abo(g)));
}

export interface CompatibilityResult {
  /** True only when the data is a match this engine will assert. */
  compatible: boolean;
  /** Codes safe to return to the user as candidates. */
  candidates: BloodGroup[];
  /** Codes that are acceptable only after blood-bank confirmation. */
  conditional: BloodGroup[];
  notes: string[];
  /** "confirmed" = engine asserts, "confirmation_required" = escalate. */
  confidence: "confirmed" | "confirmation_required";
}

export function checkCompatibility(
  recipient: BloodGroup,
  component: BloodComponent,
): CompatibilityResult {
  // Rare phenotypes: never assert cross-phenotype compatibility.
  if (isRareGroup(recipient)) {
    const notes =
      recipient === "OH"
        ? [
            "Bombay phenotype (Oh) red cells lack A, B and H antigens — Oh patients require Bombay-phenotype blood, not ordinary O−.",
            "Compatibility must be confirmed by a qualified blood bank / transfusion service before transfusion.",
          ]
        : [
            "Para-Bombay phenotypes require phenotype-matched blood confirmed by a qualified blood bank.",
          ];
    return {
      compatible: true,
      candidates: [recipient],
      conditional: [],
      notes,
      confidence: "confirmation_required",
    };
  }

  const r = recipient as StandardBloodGroup;
  switch (component) {
    case "FFP":
    case "SDP": {
      const candidates = plasmaDonors(r);
      return {
        compatible: true,
        candidates,
        conditional: [],
        notes: [
          "Plasma components are selected by ABO compatibility (Rh type is not a plasma-matching criterion).",
          "Confirm component availability with the blood bank before travel.",
        ],
        confidence: "confirmed",
      };
    }
    case "CRYO":
      return {
        compatible: true,
        candidates: STANDARD_BLOOD_GROUPS,
        conditional: [],
        notes: [
          "Cryoprecipitate is generally ABO-non-specific; local blood-bank policy applies.",
        ],
        confidence: "confirmation_required",
      };
    case "PLATELETS": {
      const candidates = plasmaDonors(r);
      const rhRestricted = isRhNeg(r);
      return {
        compatible: true,
        candidates: rhRestricted
          ? candidates.filter((g) => isRhNeg(g as StandardBloodGroup))
          : candidates,
        conditional: rhRestricted ? candidates.filter((g) => !isRhNeg(g as StandardBloodGroup)) : [],
        notes: [
          "Platelets are preferred ABO-compatible; RhD-negative recipients should receive RhD-negative platelets.",
          "Platelet compatibility must be confirmed by the blood bank.",
        ],
        confidence: "confirmation_required",
      };
    }
    case "WHOLE_BLOOD":
    case "PRBC":
    case "GRANULOCYTES":
    default: {
      const candidates = rbcDonors(r);
      return {
        compatible: true,
        candidates,
        conditional: [],
        notes: [
          r === "O-"
            ? "O− red cells are the conventional universal red-cell donor group, but this does not extend to every component."
            : "Red cells are selected so the donor does not carry antigens the recipient lacks.",
          "Confirm component availability with the blood bank before travel.",
        ],
        confidence: "confirmed",
      };
    }
  }
}

/** Given a recipient group + component, which groups should the search look for? */
export function searchableGroups(
  recipient: BloodGroup,
  component: BloodComponent,
): BloodGroup[] {
  return checkCompatibility(recipient, component).candidates;
}
