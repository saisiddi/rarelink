import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-black text-white">
              R
            </span>
            <span className="text-lg font-bold tracking-tight text-ink">
              RARE<span className="text-brand">LINK</span>
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
            An emergency blood-intelligence layer: natural-language requests turned into verified,
            location-aware blood-bank and rare-donor matches.
          </p>
          <p className="mt-4 max-w-md rounded-xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink-mute">
            RARELINK is an information and coordination platform. It is not a medical diagnosis
            system and not a replacement for doctors, hospitals, blood banks or official
            transfusion services. Always confirm availability by phone before travelling.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-mute">Product</h3>
          <ul className="mt-3 text-sm">
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/search">Find blood</Link></li>
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/map">Live map</Link></li>
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/donors">Donor registry</Link></li>
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/rare">Rare blood groups</Link></li>
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/emergency">Emergency request</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-mute">Trust</h3>
          <ul className="mt-3 text-sm">
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/about">How it works</Link></li>
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/demo">Demo dataset</Link></li>
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/privacy">Privacy &amp; consent</Link></li>
            <li><Link className="inline-block py-1 text-ink-soft hover:text-brand" href="/admin">Admin</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} RARELINK · Built for emergencies, not for diagnosis.</p>
          <p>
            Map data ©{" "}
            <a className="underline hover:text-brand" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
              OpenStreetMap</a>{" "}
            contributors
          </p>
        </div>
      </div>
    </footer>
  );
}
