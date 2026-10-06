import type { Metadata } from "next";
import { ShieldCheck, Lock, BellRing } from "lucide-react";

import { DonorExplorer, DonorRegisterForm } from "@/components/Donors";

export const metadata: Metadata = {
  title: "Donors",
  description:
    "Find registered voluntary donors by blood group and location, or register yourself as a donor.",
};

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function DonorsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Donor registry</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        Find a donor — without exposing anyone&apos;s privacy
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Every result shows verification state, approximate distance and when it was last verified.
        Contact details are only exchanged after the donor accepts your request.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section>
          <DonorExplorer initialGroup={first(sp.group) ?? ""} initialCity={first(sp.city) ?? ""} />
        </section>

        <aside className="space-y-4">
          <div id="register" className="scroll-mt-24">
            <DonorRegisterForm />
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-info" aria-hidden="true" />
              Verification states
            </h2>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><strong className="text-ink">Blood-bank verified</strong> — group confirmed by a blood bank.</li>
              <li><strong className="text-ink">Phone verified</strong> — contact confirmed by OTP.</li>
              <li><strong className="text-ink">Self-reported</strong> — never presented as medically confirmed.</li>
              <li><strong className="text-ink">Suspended</strong> — excluded from all searches.</li>
            </ul>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <Lock className="h-4 w-4 text-ok" aria-hidden="true" />
              What is never shown
            </h2>
            <ul className="space-y-1.5 text-sm text-ink-soft">
              <li>✗ Home address or exact coordinates</li>
              <li>✗ Phone numbers and email addresses</li>
              <li>✗ Aadhaar, ABHA, government IDs</li>
              <li>✗ Medical history or donation records</li>
            </ul>
          </div>

          <div className="card space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <BellRing className="h-4 w-4 text-brand" aria-hidden="true" />
              Alerting policy
            </h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              Alerts respect opt-out, daily limits and quiet hours. Emergency overrides only apply
              to donors who explicitly opted in to emergency notifications.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
