"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-strong shadow-[0_8px_20px_-10px_rgb(200_16_46_/_0.9)]",
  secondary: "bg-navy text-white hover:bg-navy-soft",
  ghost: "bg-transparent text-ink hover:bg-line/70",
  outline: "bg-surface text-ink border border-line hover:border-ink-mute",
  danger: "bg-danger text-white hover:brightness-95",
  dark: "glass text-ink hover:bg-white",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-13 px-6 text-base rounded-2xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all",
        "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        "whitespace-nowrap select-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

interface LinkButtonProps {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  prefetch?: boolean;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  prefetch,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all",
        "active:scale-[0.98] whitespace-nowrap select-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag className={cn("card", className)}>{children}</Tag>;
}

/* -------------------------------------------------------------------------- */
/* Small parts                                                                 */
/* -------------------------------------------------------------------------- */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "")}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      ) : null}
      <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-ink-soft">{description}</p>
      ) : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}
