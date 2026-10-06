import type { Metadata } from "next";

import { SearchExplorer } from "@/components/SearchExplorer";

export const metadata: Metadata = {
  title: "Find blood",
  description:
    "Search verified blood-bank inventory and registered donors by blood group, component, distance and urgency.",
};

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Search</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Verified blood, ranked by what matters
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Availability 35% · freshness 20% · distance 20% · verification 15% · emergency capability
          10%. Unverified entries never outrank verified ones.
        </p>
      </div>

      <SearchExplorer
        initial={{
          bloodGroup: first(sp.bloodGroup),
          component: first(sp.component),
          city: first(sp.city),
          lat: first(sp.lat),
          lon: first(sp.lon),
          radius: first(sp.radius),
          urgency: first(sp.urgency),
          intent: first(sp.intent),
        }}
        mode="search"
      />
    </div>
  );
}
