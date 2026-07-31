import { readFileSync } from "node:fs";

import { compileRmlLaw } from "@red-cup-engineering/rmn-semantic-conformance/law";

// Split 2026-07-30: the formal carrier's own RML law now lives in the sibling
// package `hoare-program-carrier`, not in this package. contract-finite-hoare-
// measurement.mjs still names the formal carrier's exact normalized law in its
// output (qualification.formalCarrier) as a cross-reference, without claiming
// implementation equivalence, so this still reads the sibling's RML file
// directly rather than duplicating or guessing its content-derived id.
export const FORMAL_HOARE_CARRIER_LAW = compileRmlLaw(
  readFileSync(new URL("../../hoare-program-carrier/content/contracts/formal-hoare-carrier.rml", import.meta.url), "utf8"),
);

export const FORMAL_HOARE_CARRIER_CONTRACT = FORMAL_HOARE_CARRIER_LAW.id;

export const FINITE_HOARE_PROGRAM_MEASUREMENT_LAW = compileRmlLaw(
  readFileSync(new URL("../content/contracts/finite-hoare-program-measurement.rml", import.meta.url), "utf8"),
);

export const FINITE_HOARE_PROGRAM_MEASUREMENT_CONTRACT = FINITE_HOARE_PROGRAM_MEASUREMENT_LAW.id;
