---
name: pdf-playwright
description: Render PDFs from web pages using Playwright and headless Chromium with strict origin isolation, print styling, and deterministic resource cleanup. Use when working on browser lifecycle, page navigation boundaries, print CSS/media settings, readiness, or PDF rendering timeouts.
---

# Playwright Chromium & PDF Rendering Guide

Read the repository's [AGENTS.md](../../../AGENTS.md) before making changes.
Keep browser lifecycle/concurrency management separate from per-page navigation,
print styling, and PDF generation.

## Enforce Isolation and Navigation Boundaries

- **Shared Browser, Isolated Contexts**: Share a single Chromium launch promise
  across requests (clearing it on launch failure or `disconnected` so subsequent
  requests can relaunch), and create a fresh `BrowserContext` with
  `serviceWorkers: 'block'` for every render.
- **Defense-in-Depth Origin Locking**: Validate that the target URL belongs to
  the configured origin before opening a page. Enforce the origin boundary on
  both Playwright context routes (`context.route('**/*', ...)` to block popups
  and cross-origin frames) and a page CDP session (`Fetch.requestPaused` on
  `Document` requests to catch server redirect hops that Playwright routes skip).
- **Deterministic Cleanup**: Always clear render timers, close the
  `BrowserContext`, and decrement active concurrency counters inside a `finally`
  block so failed or timed-out renders never leak pages or block concurrency
  slots.

## Synchronize Page Readiness and Print Styling

- **Readiness Sequence**: Navigate with `waitUntil: 'load'`, verify an `ok()`
  upstream HTTP response, await any configured `waitForSelector` (`visible`) or
  `waitForLoadState('networkidle')`, apply media emulation and print style tags,
  and await `document.fonts.ready` before calling `page.pdf()`.
- **Print Settings & Overrides**: Merge global print defaults with report-level
  overrides through the Zod print settings schema, converting numeric millimeter
  margins to `'${mm}mm'` strings and injecting CSS rules for `printImages: false`
  and `hideSelectors`.

## Verify Proportionally

Run the static checks in `AGENTS.md` (`typecheck`, `lint:code`, `knip`, and
Prettier on changed files). Do not install browsers or run Playwright tests
unless explicitly requested by the user.
