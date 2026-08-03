#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Split 2026-07-30 from the former combined `hoare-program-measurement`
// enterprise: this audits only the application/finite half now seated in
// this package. Checks for records that moved to the sibling Lean package
// `hoare-program-carrier` — lib/ownership.json, lib/management/roster.json,
// content/offices/formal-program-measurer.json, the Lean sources
// (HoareProgramMeasurement.lean, HoareProgramMeasurement/Program.lean,
// lakefile.toml, lean-toolchain), and content/services/formal-hoare-carrier.json
// with its RML law — were trimmed out; that package now audits its own
// records on its own terms.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "content/services/finite-hoare-program-measurement.json",
  "lib/schemas/finite-hoare-program-measurement-request.schema.json",
  "lib/schemas/finite-hoare-program-measurement.schema.json",
  "src/contract-finite-hoare-measurement.mjs",
  "test/contract-finite-hoare-measurement.test.mjs",
  "package.json",
];

const failures = [];
for (const path of required) {
  if (!existsSync(join(ROOT, path))) failures.push(`missing ${path}`);
}

const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
if (manifest.name !== "@lenticule-science/finite-program-measurement-service") failures.push("package node identity is absent or wrong");
if (manifest.version !== "0.2.1") failures.push("package version is not the current semantic-address migration");
for (const dependency of [
  "@red-cup-engineering/semantic-content-identify-service",
  "@red-cup-engineering/witness-journal-entry-service",
  "@red-cup-engineering/witness-journal-log-service",
]) if (!manifest.dependencies?.[dependency]) failures.push(`missing current dependency ${dependency}`);
for (const displaced of [
  "@red-cup-engineering/relation-model-notation-runtime",
  "@red-cup-engineering/witness-journal-rdf-projection-service",
  "@lenticule-science/witness-journal-rdf-projection-service",
]) if (manifest.dependencies?.[displaced]) failures.push(`displaced dependency remains ${displaced}`);
for (const path of [
  "lib/schemas/finite-hoare-program-measurement-request.schema.json",
  "lib/schemas/finite-hoare-program-measurement.schema.json",
  "content/services/finite-hoare-program-measurement.json",
]) {
  try { JSON.parse(readFileSync(join(ROOT, path), "utf8")); }
  catch (error) { failures.push(`${path} is not valid JSON: ${error.message}`); }
}

const result = { enterprise: "finite-program-measurement-service", ok: failures.length === 0, failures };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
