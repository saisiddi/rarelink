import type { Metadata } from "next";

import { SearchExplorer } from "@/components/SearchExplorer";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Interactive map of blood banks and verified donors with availability, distance and freshness filters.",
};

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function MapPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Map view</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Blood banks &amp; donors around you
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Click a marker to jump to its card. Distances come from coordinates — never from the
          assistant.
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
        mode="map"
      />
    </div>
  );
}
