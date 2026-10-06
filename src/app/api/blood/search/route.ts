import { parseSearchParams, SUPPORTED_COMPONENTS } from "@/lib/searchParams";
import { normalizeBloodGroup } from "@/lib/blood/compatibility";
import { publicResult, runSearch } from "@/lib/search";
import { guard, json, badRequest } from "@/lib/api";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async (req: Request) => {
  const params = new URL(req.url).searchParams;

  // Validate before searching: silently ignoring an unknown group would turn
  // "bloodGroup=XY" into an unfiltered search, which is worse than an error.
  const rawGroup = params.get("bloodGroup") || params.get("group");
  if (rawGroup && !normalizeBloodGroup(rawGroup)) {
    return badRequest(
      `Unknown blood group "${rawGroup}". Use A+/A-/B+/B-/AB+/AB-/O+/O-, OH (Bombay phenotype) or P-BOMBAY.`,
    );
  }
  const rawComponent = params.get("component")?.toUpperCase();
  if (rawComponent && !SUPPORTED_COMPONENTS.includes(rawComponent as never)) {
    return badRequest(
      `Unknown component "${rawComponent}". Use ${SUPPORTED_COMPONENTS.join(", ")}.`,
    );
  }

  const query = parseSearchParams(params);
  const outcome = await runSearch(query);

  if (query.bloodGroup) {
    await track("blood_search", {
      group: query.bloodGroup,
      component: query.component,
      city: outcome.resolvedCity,
      urgency: query.urgency,
    });
  }

  return json({
    query: outcome.query,
    city: outcome.resolvedCity,
    point: outcome.resolvedPoint,
    bloodBanks: outcome.bloodBanks.map(publicResult),
    donors: outcome.donors.map(publicResult),
    notices: outcome.notices,
    safety: outcome.safety,
    searchedAt: outcome.searchedAt,
    tookMs: outcome.tookMs,
  });
});
