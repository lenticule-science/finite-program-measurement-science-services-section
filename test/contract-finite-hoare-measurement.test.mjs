import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";

import { startRwilProviderProcess } from "@lenticule-science/rwil-rdf-projection-service/test-provider";

import { measureFiniteHoareProgram, run, semanticDigest } from "../src/contract-finite-hoare-measurement.mjs";
import { FINITE_HOARE_PROGRAM_MEASUREMENT_CONTRACT } from "../src/law.mjs";

const CONTEXT = "https://www.w3.org/ns/activitystreams";
const PROVIDER = "urn:ame:hoare-program-measurement";
const BUYER = "urn:ame:test-customer";
const AT = "2026-07-18T15:00:00.000Z";
let rwil;

before(async () => { rwil = await startRwilProviderProcess(); });
after(async () => { await rwil?.close(); });

function request(overrides = {}) {
  return { programId: "door-controller-v1", semantics: "finite-total-relation",
    states: ["closed", "opening", "open", "fault"], precondition: ["closed", "opening"], postcondition: ["opening", "open"],
    transitions: [{ id: "begin-open", from: "closed", to: "opening" }, { id: "finish-open", from: "opening", to: "open" }, { id: "fault-loop", from: "fault", to: "fault" }],
    observations: [{ id: "obs-1", input: "closed", output: "opening", observedAt: AT, sourceDigest: `ni:///sha-256;${"A".repeat(43)}` },
      { id: "obs-2", input: "opening", output: "open", observedAt: AT, sourceDigest: `ni:///sha-256;${"B".repeat(43)}` }],
    authority: { controller: BUYER, basis: "customer-authored test fixture", customerOwnsObservations: true, sensitiveDataExcluded: true },
    ...overrides };
}
function solicitation(measurementRequest = request()) {
  return { "@context": CONTEXT, id: "urn:test:hoare-solicitation", type: "Offer", actor: BUYER, target: PROVIDER,
    object: { type: "ServiceSolicitation", contract: FINITE_HOARE_PROGRAM_MEASUREMENT_CONTRACT, request: measurementRequest } };
}
function acceptance(offer, overrides = {}) {
  return { "@context": CONTEXT, id: "urn:test:hoare-acceptance", type: "Accept", actor: BUYER, target: PROVIDER,
    object: { type: "ServiceContract", law: FINITE_HOARE_PROGRAM_MEASUREMENT_CONTRACT, offer,
      termsAcceptance: { termDigest: offer.object.termsDigest },
      capability: { type: "Capability", holder: PROVIDER, invocationTarget: PROVIDER, parentOffer: offer.id,
        attenuation: { requestDigest: offer.object.requestDigest }, capTP: { target: PROVIDER, method: "invoke-service" },
        allowedActions: ["invoke-service", "provider-local-rwil-evidence"] }, ...overrides } };
}
async function execute(activity, operation, root) {
  return run(activity, operation, AT, { dataRoot: root, agentUrl: rwil.agentCardUrl });
}

test("finite program measurement reports bounded model and observation evidence", () => {
  const result = measureFiniteHoareProgram(request());
  assert.equal(result.model.preservesPostcondition, true); assert.equal(result.model.assessedTransitionCount, 2);
  assert.deepEqual(result.model.weakestCompatiblePrecondition, ["closed", "opening"]);
  assert.equal(result.observations.declaredTransitionPairCoverage, 2 / 3);
  assert.equal(result.qualification.observationTruth, "not verified from replay evidence by this service");
  assert.equal(result.customerMutation, false); assert.equal(result.requestDigest, semanticDigest(request()));
});

test("a counterexample is measured rather than repaired or hidden", () => {
  const bad = request({ transitions: [{ id: "begin-open", from: "closed", to: "opening" }, { id: "jam", from: "opening", to: "fault" }] });
  const result = measureFiniteHoareProgram(bad);
  assert.equal(result.model.preservesPostcondition, false);
  assert.deepEqual(result.model.violations, [{ transitionId: "jam", input: "opening", output: "fault" }]);
  assert.deepEqual(result.model.weakestCompatiblePrecondition, ["closed"]);
});

test("the exact RMN law closes with typed resources and RWIL evidence", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoare-measurement-provider-test-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const offer = await execute(solicitation(), "solicit-service", root);
  assert.equal(offer.type, "Offer"); assert.equal(offer.object.requestDigest, semanticDigest(offer.object.request));
  assert.equal(offer.object.terms.assetPaymentRequired, false);
  const result = await execute(acceptance(offer), "invoke-service", root);
  assert.equal(result.type, "Accept"); assert.equal(result.object.exchange.measurement.model.preservesPostcondition, true);
  assert.equal(result.object.receipt.provider, PROVIDER); assert.equal(result.object.receipt.customer, BUYER);
  assert.equal(result.object.receipt.assetSettlementClaimed, false); assert.equal(result.object.customerMutation, false);
  assert.deepEqual(Object.keys(result.object.exchange.resources).sort(),
    ["assetAmount", "computeSeconds", "erasure", "gas", "type", "wallTimeSeconds", "wit"].sort());
  const graphDirectory = join(root, "rwil", "2026", "07", "18");
  assert.equal(readdirSync(graphDirectory).length >= 3, true);
  assert.equal(readFileSync(join(graphDirectory, readdirSync(graphDirectory)[0]), "utf8").includes("urn:emsenn:rwil:category"), true);
});

test("changed terms and overbroad capabilities are refused before measurement", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoare-measurement-refusal-test-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const offer = await execute(solicitation(), "solicit-service", root);
  const changed = await execute(acceptance(offer, { termsAcceptance: { termDigest: "ni:///sha-256;changed" } }), "invoke-service", root);
  assert.equal(changed.type, "Reject"); assert.match(changed.object.reason, /did not accept/);
  const overbroad = acceptance(offer); overbroad.object.capability.allowedActions.push("customer-write");
  const refused = await execute(overbroad, "invoke-service", root);
  assert.equal(refused.type, "Reject"); assert.equal(refused.object.prohibitedEffectsPerformed, false);
});

test("missing observation authority and non-ni evidence are typed refusals", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoare-measurement-authority-test-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const absentAuthority = await execute(solicitation(request({ authority: { controller: BUYER } })), "solicit-service", root);
  assert.equal(absentAuthority.type, "Reject"); assert.match(absentAuthority.object.reason, /authority/);
  const oldDigest = request(); oldDigest.observations[0].sourceDigest = `sha256:${"a".repeat(64)}`;
  const nonstandard = await execute(solicitation(oldDigest), "solicit-service", root);
  assert.equal(nonstandard.type, "Reject"); assert.match(nonstandard.object.reason, /RFC6920/);
});

test("absence of the hired RWIL provider fails closed", async () => {
  await assert.rejects(run(solicitation(), "solicit-service", AT, { dataRoot: mkdtempSync(join(tmpdir(), "hoare-no-rwil-")) }), /RWIL_RDF_AGENT/u);
});
