import { parseSearchParams } from "@/lib/searchParams";
import { publicResult, runSearch } from "@/lib/search";
import { guard, json } from "@/lib/api";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async (req: Request) => {
  const query = parseSearchParams(new URL(req.url).searchParams);
  const outcome = await runSearch({ ...query, intent: "find_donor" });

  await track("donor_search", { group: query.bloodGroup, city: outcome.resolvedCity });

  return json({
    city: outcome.resolvedCity,
    point: outcome.resolvedPoint,
    donors: outcome.donors.map(publicResult),
    notices: outcome.notices,
    safety: outcome.safety,
    searchedAt: outcome.searchedAt,
    tookMs: outcome.tookMs,
  });
});
