"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Siren, X } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/search", label: "Find blood" },
  { href: "/map", label: "Map" },
  { href: "/donors", label: "Donors" },
  { href: "/rare", label: "Rare blood" },
  { href: "/about", label: "How it works" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-line/70 bg-navy/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-black text-white">
            R
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            RARE<span className="text-brand">LINK</span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/emergency"
            className="hidden h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong sm:inline-flex"
          >
            <Siren className="h-4 w-4" aria-hidden="true" />
            Emergency
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl text-white/80 hover:bg-white/10 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-navy-line px-4 py-3 lg:hidden" aria-label="Mobile">
          <ul className="grid gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/emergency"
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-lg bg-brand px-3 py-2.5 text-center text-sm font-semibold text-white"
              >
                🚨 Emergency request
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
    </header>
  );
}
