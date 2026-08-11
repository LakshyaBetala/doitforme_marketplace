// Guards vercel.json against the two mistakes that fail a deploy silently at
// build time rather than in any local check.
//
// Both have now bitten this project:
//   1. An unknown top-level key ("comment"). vercel.json is schema-validated and
//      does NOT support comments — JSON has no comment syntax and Vercel rejects
//      properties it doesn't recognise.
//   2. A cron more frequent than daily. Vercel Hobby refuses those with
//      "Hobby accounts are limited to daily cron jobs".

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cfgPath = path.join(process.cwd(), "vercel.json");
const raw = fs.readFileSync(cfgPath, "utf8");

// The full set of properties Vercel accepts at the top level.
const ALLOWED = new Set([
  "$schema", "buildCommand", "bunVersion", "cleanUrls", "crons", "devCommand",
  "fluid", "framework", "functions", "headers", "ignoreCommand", "images",
  "installCommand", "outputDirectory", "public", "redirects", "bulkRedirectsPath",
  "regions", "functionFailoverRegions", "rewrites", "trailingSlash", "git",
]);

test("vercel.json is valid JSON", () => {
  assert.doesNotThrow(() => JSON.parse(raw));
});

test("vercel.json has no unknown top-level keys", () => {
  const cfg = JSON.parse(raw);
  const unknown = Object.keys(cfg).filter((k) => !ALLOWED.has(k));
  assert.deepEqual(
    unknown,
    [],
    `Vercel rejects unknown properties and the deploy fails: ${unknown.join(", ")}. ` +
      `There is no comment syntax in vercel.json — document constraints in CLAUDE.md instead.`
  );
});

test("every cron runs at most once per day (Hobby limit)", () => {
  const cfg = JSON.parse(raw);
  for (const job of cfg.crons ?? []) {
    const [minute, hour, dom, month, dow] = job.schedule.trim().split(/\s+/);

    assert.ok(
      !minute.includes("*") && !minute.includes("/") && !minute.includes(","),
      `${job.path}: "${job.schedule}" runs multiple times per hour — Hobby allows daily only.`
    );
    assert.ok(
      !hour.includes("*") && !hour.includes("/") && !hour.includes(","),
      `${job.path}: "${job.schedule}" runs multiple times per day — Hobby allows daily only.`
    );
    // A pinned minute+hour with wildcard date fields is exactly once per day.
    assert.equal(dom, "*", `${job.path}: unexpected day-of-month "${dom}"`);
    assert.equal(month, "*", `${job.path}: unexpected month "${month}"`);
    assert.ok(dow === "*" || /^[0-9-]+$/.test(dow), `${job.path}: unexpected day-of-week "${dow}"`);
  }
});

test("every cron path points at a route that exists", () => {
  const cfg = JSON.parse(raw);
  for (const job of cfg.crons ?? []) {
    const routeFile = path.join(process.cwd(), "app", job.path, "route.ts");
    assert.ok(
      fs.existsSync(routeFile),
      `${job.path} is scheduled but ${routeFile} does not exist — the cron would 404 daily.`
    );
  }
});
