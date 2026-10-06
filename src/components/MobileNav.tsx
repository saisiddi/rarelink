"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Siren, HeartHandshake, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Find", icon: Search },
  { href: "/emergency", label: "Emergency", icon: Siren, accent: true },
  { href: "/donors", label: "Donors", icon: HeartHandshake },
  { href: "/rare", label: "Rare", icon: Sparkles },
];

/** Mobile-first bottom navigation with large touch targets. */
export function MobileNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur lg:hidden"
      aria-label="Bottom navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition",
                  item.accent
                    ? "text-brand"
                    : active
                      ? "text-ink"
                      : "text-ink-mute hover:text-ink",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "grid h-7 w-11 place-items-center rounded-full",
                    item.accent ? "bg-brand-soft" : active ? "bg-line" : "",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
