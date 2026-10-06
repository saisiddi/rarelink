import { getDb, isDemoDataset } from "@/lib/db";
import { guard, json } from "@/lib/api";
import { providerAttribution } from "@/lib/providers/registry";
import { isAiConfigured, modelId } from "@/lib/ai/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async () => {
  const db = getDb();
  const count = (table: string): number => {
    try {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as
        | { n?: number | bigint }
        | undefined;
      return Number(row?.n ?? 0);
    } catch {
      return 0;
    }
  };

  return json({
    ok: true,
    demoMode: isDemoDataset(),
    ai: { configured: isAiConfigured(), model: isAiConfigured() ? modelId() : null },
    providers: providerAttribution,
    counts: {
      bloodBanks: count("blood_banks"),
      inventory: count("blood_inventory"),
      donors: count("donors"),
      rareGroups: count("rare_blood_groups"),
      emergencyRequests: count("emergency_requests"),
    },
    timestamp: new Date().toISOString(),
  });
});
