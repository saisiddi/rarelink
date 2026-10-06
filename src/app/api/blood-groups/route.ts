import { guard, json } from "@/lib/api";
import {
  bloodGroupLabel,
  checkCompatibility,
  normalizeBloodGroup,
} from "@/lib/blood/compatibility";
import { STANDARD_BLOOD_GROUPS, BLOOD_COMPONENTS, type BloodComponent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_COMPONENTS = new Set<string>(BLOOD_COMPONENTS);

export const GET = guard(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const group = params.get("group");
  const rawComponent = params.get("component");
  const component =
    rawComponent && VALID_COMPONENTS.has(rawComponent.toUpperCase())
      ? (rawComponent.toUpperCase() as BloodComponent)
      : "PRBC";

  if (!group) {
    return json({
      groups: STANDARD_BLOOD_GROUPS.map((code) => ({
        code,
        label: bloodGroupLabel(code),
      })),
      components: BLOOD_COMPONENTS,
    });
  }

  const normalized = normalizeBloodGroup(group);
  if (!normalized) {
    return json({ error: `Unrecognised blood group: ${group}` }, { status: 400 });
  }

  const result = checkCompatibility(normalized.code, component);
  return json({
    recipient: normalized.code,
    label: normalized.label,
    component,
    compatible: result.compatible,
    candidates: result.candidates.map(bloodGroupLabel),
    conditional: result.conditional.map(bloodGroupLabel),
    confidence: result.confidence,
    notes: result.notes,
    disclaimer:
      "Compatibility rules are a deterministic decision aid. Final transfusion decisions rest with the treating clinician and the blood bank.",
  });
});
