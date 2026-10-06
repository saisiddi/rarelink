/**
 * Headless UI check: renders every route at mobile and desktop widths and
 * reports console errors, failed requests, accessibility problems and
 * horizontal overflow.
 *
 * Usage:  npm run check:ui
 *         BASE_URL=http://localhost:3000 npm run check:ui
 *
 * Screenshots land in ./screenshots/ (gitignored).
 */

import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = path.resolve(process.cwd(), "screenshots");

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/search?bloodGroup=O-&city=Bengaluru", name: "search" },
  { path: "/search?bloodGroup=OH&city=Chennai", name: "search-bombay" },
  { path: "/map", name: "map" },
  { path: "/donors", name: "donors" },
  { path: "/rare", name: "rare" },
  { path: "/emergency", name: "emergency" },
  { path: "/emergency/emr_does_not_exist", name: "emergency-404" },
  { path: "/does-not-exist", name: "not-found" },
  { path: "/demo", name: "demo" },
  { path: "/admin", name: "admin" },
  { path: "/about", name: "about" },
  { path: "/privacy", name: "privacy" },
];

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  { name: "desktop", width: 1280, height: 900, isMobile: false, deviceScaleFactor: 1 },
] as const;

interface Audit {
  h1Count: number;
  htmlLang: string;
  hasViewportMeta: boolean;
  imagesNoAlt: string[];
  unnamedControls: string[];
  unnamedActions: string[];
  duplicateIds: string[];
  positiveTabindex: string[];
  unsafeBlankLinks: string[];
  overflowPx: number;
  overflowing: string[];
  tapTargetsUnder24: number;
  tinyTargets: string[];
}

function findChromium(): string {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ].filter((p): p is string => Boolean(p));
  for (const c of candidates) if (fs.existsSync(c)) return c;

  const cache = path.join(process.env.HOME ?? "", ".cache", "ms-playwright");
  if (fs.existsSync(cache)) {
    for (const entry of fs.readdirSync(cache).sort().reverse()) {
      if (entry.startsWith("chromium-")) {
        const bin = path.join(cache, entry, "chrome-linux", "chrome");
        if (fs.existsSync(bin)) return bin;
      }
    }
  }
  throw new Error("No Chromium found. Set CHROMIUM_PATH.");
}

/** Runs inside the page — must be plain, dependency-free browser JS. */
function auditPage(): Audit {
  const accessibleName = (el: Element): string => {
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")
        .trim();
      if (text) return text;
    }
    const title = el.getAttribute("title");
    if (title && title.trim()) return title.trim();
    const text = (el as HTMLElement).innerText ?? el.textContent ?? "";
    if (text.trim()) return text.trim();
    const imgAlt = el.querySelector("img[alt]")?.getAttribute("alt");
    return (imgAlt ?? "").trim();
  };

  const describe = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${tag}${id}${cls ? `.${cls}` : ""}`;
  };

  const imagesNoAlt = [...document.querySelectorAll("img:not([alt])")].map(describe);

  const controlSel = "input:not([type=hidden]), select, textarea";
  const unnamedControls = [...document.querySelectorAll(controlSel)]
    .filter((el) => {
      if (accessibleName(el)) return false;
      if (el.closest("label")) return false;
      const id = el.getAttribute("id");
      if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return false;
      return true;
    })
    .map(describe);

  const unnamedActions = [...document.querySelectorAll("a[href], button")]
    .filter((el) => !accessibleName(el))
    .map(describe);

  const seen = new Map<string, number>();
  for (const el of document.querySelectorAll("[id]")) {
    seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
  }
  const duplicateIds = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);

  const positiveTabindex = [...document.querySelectorAll("[tabindex]")]
    .filter((el) => Number(el.getAttribute("tabindex")) > 0)
    .map(describe);

  const unsafeBlankLinks = [...document.querySelectorAll('a[target="_blank"]')]
    .filter((el) => !/\bnoopener\b/.test(el.getAttribute("rel") ?? ""))
    .map(describe);

  // Horizontal overflow: which elements push past the viewport?
  const vw = document.documentElement.clientWidth;
  const overflowing: string[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1) {
      overflowing.push(`${describe(el)} right=${Math.round(r.right)}`);
      if (overflowing.length >= 5) break;
    }
  }

  let tapTargetsUnder24 = 0;
  const tinyTargets: string[] = [];
  for (const el of document.querySelectorAll("a[href], button")) {
    // Skip link: 1x1 until it is focused, at which point it becomes a real
    // target. Not a finding.
    if (el.classList.contains("sr-only")) continue;
    // WCAG 2.5.8 exempts a target that sits inside a sentence or block of
    // text — an inline link is not expected to be a 24px box.
    if (getComputedStyle(el).display === "inline") continue;
    // Leaflet's attribution strip renders its source links at text size —
    // that is how every Leaflet map ships and the control is the real target.
    if (el.closest(".leaflet-control-attribution")) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24)) {
      tapTargetsUnder24++;
      if (tinyTargets.length < 8) {
        tinyTargets.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
  }

  return {
    h1Count: document.querySelectorAll("h1").length,
    htmlLang: document.documentElement.getAttribute("lang") ?? "",
    hasViewportMeta: Boolean(
      document.querySelector('meta[name="viewport"]')?.getAttribute("content"),
    ),
    imagesNoAlt,
    unnamedControls,
    unnamedActions,
    duplicateIds,
    positiveTabindex,
    unsafeBlankLinks,
    overflowPx: Math.max(0, document.documentElement.scrollWidth - vw),
    overflowing,
    tapTargetsUnder24,
    tinyTargets,
  };
}

interface Finding {
  level: "error" | "warn";
  route: string;
  viewport: string;
  message: string;
}

async function checkRoute(
  browser: Browser,
  route: (typeof ROUTES)[number],
  viewport: (typeof VIEWPORTS)[number],
  findings: Finding[],
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    deviceScaleFactor: viewport.deviceScaleFactor,
    hasTouch: viewport.isMobile,
  });
  const page = await context.newPage();

  const expectNotFound =
    route.path === "/does-not-exist" || route.path.startsWith("/emergency/emr_");

  /**
   * Errors we have verified are not our bug.
   *
   * `KNOWN_DEV_ONLY` — React 19's dev-mode component profiler calls
   * `performance.measure()` for a component that `notFound()` tears down
   * mid-render. Confirmed absent in a production build
   * (`npm run build && npm start`): /emergency/<unknown-id> logs nothing.
   */
  const KNOWN_DEV_ONLY = ["cannot have a negative time stamp"];

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // The page's own 404 response is logged by the browser; that is expected
    // on routes we deliberately ask for a missing record.
    const at = msg.location().url ?? "";
    if (at === `${BASE}${route.path}` && expectNotFound) return;
    consoleErrors.push(`${msg.text()} @ ${at || "unknown"}`);
  });
  page.on("pageerror", (err) => {
    if (KNOWN_DEV_ONLY.some((m) => err.message.includes(m))) return;
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText ?? "unknown";
    // Aborted navigations during teardown are not interesting.
    if (failure !== "net::ERR_ABORTED") failedRequests.push(`${req.url()} — ${failure}`);
  });

  const label = `${route.path} @ ${viewport.name}`;
  const add = (level: "error" | "warn", message: string) =>
    findings.push({ level, route: route.path, viewport: viewport.name, message });

  try {
    const res = await page.goto(`${BASE}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!res) add("error", "no response");
    else if (res.status() >= 400 && route.path !== "/does-not-exist" && !route.path.startsWith("/emergency/emr_")) {
      add("error", `HTTP ${res.status()}`);
    }
    if (res && route.path === "/does-not-exist" && res.status() !== 404) {
      add("error", `expected 404, got ${res.status()}`);
    }

    // Give hydration, Leaflet and client fetches a moment to settle.
    await page.waitForTimeout(1_500);

    const audit = (await page.evaluate(auditPage)) as Audit;

    if (audit.h1Count !== 1) add("error", `${audit.h1Count} <h1> elements (expected exactly 1)`);
    if (!audit.htmlLang) add("error", "<html> has no lang attribute");
    if (!audit.hasViewportMeta) add("error", "no viewport meta tag");
    if (audit.imagesNoAlt.length) add("error", `images without alt: ${audit.imagesNoAlt.join(", ")}`);
    if (audit.unnamedControls.length)
      add("error", `form controls without a label: ${audit.unnamedControls.join(", ")}`);
    if (audit.unnamedActions.length)
      add("error", `links/buttons without an accessible name: ${audit.unnamedActions.join(", ")}`);
    if (audit.duplicateIds.length) add("error", `duplicate ids: ${audit.duplicateIds.join(", ")}`);
    if (audit.positiveTabindex.length)
      add("warn", `positive tabindex: ${audit.positiveTabindex.join(", ")}`);
    if (audit.unsafeBlankLinks.length)
      add("error", `target=_blank without rel=noopener: ${audit.unsafeBlankLinks.join(", ")}`);
    if (audit.overflowPx > 2) {
      add("error", `horizontal overflow of ${audit.overflowPx}px — ${audit.overflowing.join(" | ")}`);
    }
    if (viewport.isMobile && audit.tapTargetsUnder24 > 0) {
      add(
        "warn",
        `${audit.tapTargetsUnder24} tap targets smaller than 24px — ${audit.tinyTargets.join(", ")}`,
      );
    }

    // Ignore the browser's own noise (favicon, blocked extensions, …).
    const real = consoleErrors.filter(
      (m) => !/favicon|Download the React DevTools|\[HMR\]|React DevTools/i.test(m),
    );
    if (real.length) add("error", `console: ${real.slice(0, 3).join(" || ")}`);

    const realFailed = failedRequests.filter((u) => !/favicon/.test(u));
    if (realFailed.length) add("error", `failed requests: ${realFailed.slice(0, 3).join(" || ")}`);

    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({
      path: path.join(SHOTS, `${route.name}-${viewport.name}.png`),
      fullPage: false,
    });
    process.stdout.write(`  ${res?.status() ?? "???"} ${label}\n`);
  } catch (err) {
    add("error", err instanceof Error ? err.message : String(err));
    process.stdout.write(`  ERR ${label}\n`);
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const executablePath = findChromium();
  process.stdout.write(`RARELINK UI check → ${BASE}\nChromium: ${executablePath}\n\n`);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const findings: Finding[] = [];
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      await checkRoute(browser, route, viewport, findings);
    }
  }
  await browser.close();

  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warn");

  if (findings.length === 0) {
    process.stdout.write(`\n✔ ${ROUTES.length * VIEWPORTS.length} page renders clean.\n`);
    return;
  }

  process.stdout.write(`\n${errors.length} error(s), ${warnings.length} warning(s)\n\n`);
  for (const f of findings) {
    const tag = f.level === "error" ? "ERROR" : "warn ";
    process.stdout.write(`  [${tag}] ${f.route} @ ${f.viewport} — ${f.message}\n`);
  }
  process.stdout.write(`\nScreenshots: ${SHOTS}\n`);
  process.exitCode = errors.length > 0 ? 1 : 0;
}

await main();
