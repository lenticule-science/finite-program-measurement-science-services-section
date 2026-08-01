#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { semanticId } from "@red-cup-engineering/rmn-semantic-conformance";
import { encodeRelationalValue } from "@red-cup-engineering/rmn-semantic-conformance/relational-value";
import { createSettlementStore } from "@lenticule-science/witness-journal-rdf-projection-service/client";

const CONTEXT = "https://www.w3.org/ns/activitystreams";
const ACTOR = "urn:ame:hoare-program-measurement";
const NODE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EFFECTS = ["provider-local-witness-journal-evidence"];
const FORMAL_CARRIER = {
  file: "HoareProgramMeasurement/Program.lean",
  source: "ni:///sha-256;5QKTj0THwa4B4Lw1SGDlCQVwYDLnCTZR47UMO9luXXM",
  relationship: "The runtime readout implements a separate finite-relation measurement law; this identity names the generic formal carrier but does not prove implementation equivalence.",
};

export function semanticDigest(value) {
  const relational = encodeRelationalValue(value);
  return semanticId(["ascribe", relational.type, relational.term]);
}
function identify(body) { return { id: semanticDigest(body), ...body }; }
function contentValid(value) { const { id: _id, ...body } = value ?? {}; return value?.id === semanticDigest(body); }
function operation() {
  const index = process.argv.indexOf("--operation");
  if (index >= 0) return process.argv[index + 1];
  const invoked = basename(process.argv[1] ?? "");
  return invoked === "solicit-service" || invoked === "invoke-service" ? invoked : "invoke-service";
}
function instant() { const index = process.argv.indexOf("--now"); return index >= 0 ? process.argv[index + 1] : new Date().toISOString(); }
function response(type, source, object, at) {
  return identify({ "@context": CONTEXT, type, actor: ACTOR, target: source?.actor ?? null,
    inReplyTo: source?.id ?? null, object, published: at });
}
async function append(store, category, record) {
  await store.record({ category: `finite-hoare-program-measurement-${category}`,
    recordedAt: record.published ?? record.recordedAt, record });
}
async function reject(store, source, reason, at, unmet = []) {
  const value = response("Reject", source, { type: "FiniteHoareProgramMeasurementRefusal", reason, unmet,
    prohibitedEffectsPerformed: false, customerMutation: false, foreignMutation: false }, at);
  await append(store, "refusals", value); return value;
}
function nonemptyString(value) { return typeof value === "string" && value.trim() !== ""; }
function exactKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.includes(key));
}

export function requestProblems(request) {
  const problems = [];
  if (!exactKeys(request, ["programId", "semantics", "states", "precondition", "postcondition", "transitions", "observations", "authority"])) {
    return ["request must be an object carrying only the declared measurement fields"];
  }
  if (!nonemptyString(request.programId)) problems.push("programId(non-empty-string)");
  if (request.semantics !== "finite-total-relation") problems.push("semantics(finite-total-relation)");
  const states = request.states;
  if (!Array.isArray(states) || states.length === 0 || !states.every(nonemptyString) || new Set(states).size !== states.length) {
    problems.push("states(non-empty-unique-string-array)");
  }
  const stateSet = new Set(Array.isArray(states) ? states : []);
  for (const field of ["precondition", "postcondition"]) {
    const values = request[field];
    if (!Array.isArray(values) || new Set(values).size !== values.length || !values.every((state) => stateSet.has(state))) {
      problems.push(`${field}(unique-subset-of-states)`);
    }
  }
  const transitions = request.transitions;
  if (!Array.isArray(transitions) || transitions.length === 0) problems.push("transitions(non-empty-array)");
  else {
    const ids = new Set();
    for (const [index, transition] of transitions.entries()) {
      if (!exactKeys(transition, ["id", "from", "to"]) || !nonemptyString(transition.id)
          || !stateSet.has(transition.from) || !stateSet.has(transition.to)) problems.push(`transitions/${index}(id-and-state-endpoints)`);
      else if (ids.has(transition.id)) problems.push(`transitions/${index}/id(unique)`);
      else ids.add(transition.id);
    }
    for (const state of Array.isArray(request.precondition) ? request.precondition : []) {
      if (!transitions.some((transition) => transition?.from === state)) {
        problems.push(`precondition state ${JSON.stringify(state)} has no terminating transition under finite-total-relation semantics`);
      }
    }
  }
  const observations = request.observations ?? [];
  if (!Array.isArray(observations)) problems.push("observations(array)");
  else {
    const ids = new Set();
    for (const [index, observation] of observations.entries()) {
      if (!exactKeys(observation, ["id", "input", "output", "observedAt", "sourceDigest"])) {
        problems.push(`observations/${index}(declared-fields-only)`); continue;
      }
      if (!nonemptyString(observation.id) || ids.has(observation.id)) problems.push(`observations/${index}/id(unique-non-empty)`);
      else ids.add(observation.id);
      if (!stateSet.has(observation.input) || !stateSet.has(observation.output)) problems.push(`observations/${index}(state-endpoints)`);
      if (!nonemptyString(observation.observedAt) || Number.isNaN(Date.parse(observation.observedAt))) problems.push(`observations/${index}/observedAt(ISO-instant)`);
      if (typeof observation.sourceDigest !== "string" || !/^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u.test(observation.sourceDigest)) {
        problems.push(`observations/${index}/sourceDigest(RFC6920-ni-sha-256)`);
      }
    }
  }
  const authority = request.authority;
  if (!exactKeys(authority, ["controller", "basis", "customerOwnsObservations", "sensitiveDataExcluded"])
      || !nonemptyString(authority?.controller) || !nonemptyString(authority?.basis)
      || authority?.customerOwnsObservations !== true || authority?.sensitiveDataExcluded !== true) {
    problems.push("authority(controller,basis,customerOwnsObservations=true,sensitiveDataExcluded=true)");
  }
  return [...new Set(problems)];
}

export function measureFiniteHoareProgram(request) {
  const problems = requestProblems(request);
  if (problems.length) throw new TypeError(`inadmissible measurement request: ${problems.join(", ")}`);
  const precondition = new Set(request.precondition); const postcondition = new Set(request.postcondition);
  const assessed = request.transitions.filter((transition) => precondition.has(transition.from));
  const violations = assessed.filter((transition) => !postcondition.has(transition.to))
    .map((transition) => ({ transitionId: transition.id, input: transition.from, output: transition.to }));
  const outgoing = new Map(request.states.map((state) => [state, []]));
  for (const transition of request.transitions) outgoing.get(transition.from).push(transition);
  const weakestCompatiblePrecondition = request.states.filter((state) => {
    const transitions = outgoing.get(state); return transitions.length > 0 && transitions.every((transition) => postcondition.has(transition.to));
  });
  const declaredPairs = new Set(request.transitions.map((transition) => `${transition.from}\u0000${transition.to}`));
  const observations = request.observations ?? [];
  const admittedObservations = observations.filter((observation) => precondition.has(observation.input));
  const observationViolations = admittedObservations.filter((observation) => !postcondition.has(observation.output))
    .map((observation) => ({ observationId: observation.id, input: observation.input, output: observation.output }));
  const outOfModelObservations = observations.filter((observation) => !declaredPairs.has(`${observation.input}\u0000${observation.output}`))
    .map((observation) => observation.id);
  const observedDeclaredPairs = new Set(observations.map((observation) => `${observation.input}\u0000${observation.output}`)
    .filter((pair) => declaredPairs.has(pair)));
  return {
    type: "FiniteHoareProgramMeasurement",
    programId: request.programId, requestDigest: semanticDigest(request), semantics: request.semantics,
    model: { stateCount: request.states.length, transitionCount: request.transitions.length,
      preconditionStateCount: request.precondition.length, postconditionStateCount: request.postcondition.length,
      assessedTransitionCount: assessed.length, preservingTransitionCount: assessed.length - violations.length,
      violationCount: violations.length, preservesPostcondition: violations.length === 0, violations, weakestCompatiblePrecondition },
    observations: { suppliedCount: observations.length, admittedPreconditionCount: admittedObservations.length,
      postconditionViolationCount: observationViolations.length, observationViolations,
      outOfModelCount: outOfModelObservations.length, outOfModelObservationIds: outOfModelObservations,
      declaredTransitionPairCoverage: request.transitions.length === 0 ? 0 : observedDeclaredPairs.size / declaredPairs.size },
    qualification: { exhaustiveScope: "the finite relation supplied in this exact request",
      observationScope: "customer-authored observation records whose endpoint identifiers and source identities were admitted",
      observationTruth: "not verified from replay evidence by this service", deploymentClaim: "none", formalCarrier: FORMAL_CARRIER },
    customerAuthority: request.authority, customerMutation: false, foreignMutation: false,
  };
}
function solicitationProblems(activity) {
  if (activity?.["@context"] !== CONTEXT || activity.type !== "Offer" || activity.target !== ACTOR
      || activity.object?.type !== "ServiceSolicitation") {
    return ["solicitation must be an ActivityStreams Offer<ServiceSolicitation> addressed to Hoare Program Measurement"];
  }
  return requestProblems(activity.object.request);
}
async function solicit(store, activity, at) {
  const problems = solicitationProblems(activity);
  if (problems.length) return reject(store, activity, `invalid-solicitation:${problems.join(",")}`, at, problems);
  const request = structuredClone(activity.object.request);
  const terms = { type: "UnpricedServiceTerms",
    assetPaymentRequired: false, resourceMeasures: ["compute-seconds", "wall-time-seconds"],
    witInterchangeabilityClaimed: false, erasureInterchangeabilityClaimed: false, gasInterchangeabilityClaimed: false };
  const object = { type: "ExecutableServiceOffer",
    sourceActivity: activity.id, request, requestDigest: semanticDigest(request), terms, termsDigest: semanticDigest(terms),
    operation: "invoke-service", effects: EFFECTS,
    evidence: ["provider-local-witness-journal-evidence", "typed-resource-measures", "completion-or-typed-refusal"] };
  const offer = response("Offer", activity, object, at); await append(store, "offers", offer); return offer;
}
function invocationProblem(activity) {
  if (activity?.["@context"] !== CONTEXT || activity.type !== "Accept" || activity.target !== ACTOR) return "invocation must be an ActivityStreams Accept addressed to Hoare Program Measurement";
  const contract = activity.object; const offer = contract?.offer;
  if (contract?.type !== "ServiceContract") return "invocation must accept the exact normalized RMN law";
  if (offer?.type !== "Offer" || offer.actor !== ACTOR
      || !contentValid(offer) || offer.object?.type !== "ExecutableServiceOffer") return "ServiceContract must carry this provider's exact authored offer";
  if (offer.object.requestDigest !== semanticDigest(offer.object.request)) return "accepted request differs from provider-authored term";
  if (offer.object.termsDigest !== semanticDigest(offer.object.terms)
      || contract.termsAcceptance?.termDigest !== offer.object.termsDigest) return "customer did not accept the provider-authored terms";
  const capability = contract.capability;
  if (capability?.type !== "Capability" || capability.holder !== ACTOR || capability.invocationTarget !== ACTOR) return "invocation requires a capability held by this provider";
  if (capability.parentOffer !== offer.id || capability.attenuation?.requestDigest !== offer.object.requestDigest) return "capability is not attenuated to the accepted offer";
  if (capability.capTP?.target !== ACTOR || capability.capTP.method !== "invoke-service" || !(capability.allowedActions ?? []).includes("invoke-service")) return "capability does not authorize the exact invoke-service method";
  if (!EFFECTS.every((effect) => (capability.allowedActions ?? []).includes(effect)) || (capability.allowedActions ?? []).includes("customer-write")) return "capability must permit only provider-local WitnessJournal evidence";
  return null;
}
async function invoke(store, activity, at) {
  const invalid = invocationProblem(activity); if (invalid) return reject(store, activity, invalid, at, [invalid]);
  const startWall = process.hrtime.bigint(); const startCpu = process.cpuUsage(); const offer = activity.object.offer;
  let measurement;
  try { measurement = measureFiniteHoareProgram(offer.object.request); }
  catch (error) { return reject(store, activity, `measurement-could-not-settle:${error.message}`, at, [error.message]); }
  const cpu = process.cpuUsage(startCpu);
  const resources = { type: "TypedResourceVector", computeSeconds: (cpu.user + cpu.system) / 1e6,
    wallTimeSeconds: Number(process.hrtime.bigint() - startWall) / 1e9, assetAmount: null, wit: null, erasure: null, gas: null };
  const exchange = identify({ type: "FiniteHoareProgramMeasurementExchange",
    outcome: "completion", request: offer.object.request, measurement, resources, recordedAt: at,
    customerMutation: false, foreignMutation: false });
  const receipt = identify({ type: "ServicePerformanceReceipt",
    provider: ACTOR, customer: activity.actor, offer: offer.id, invocation: activity.id,
    fulfillment: exchange.id, outcome: exchange.outcome, recordedAt: at, assetSettlementClaimed: false });
  const result = response("Accept", activity, { type: "HoareProgramMeasurementResult", exchange, receipt, customerMutation: false, foreignMutation: false }, at);
  await append(store, "measurements", exchange); await append(store, "receipts", receipt); await append(store, "results", result);
  return result;
}

export async function run(activity, op = "invoke-service", at = new Date().toISOString(), options = {}) {
  const dataRoot = resolve(options.dataRoot ?? process.env.HOARE_PROGRAM_MEASUREMENT_DATA_ROOT ?? join(NODE_ROOT, "data"));
  const store = createSettlementStore({ settlementRoot: NODE_ROOT, agentUrl: options.agentUrl ?? process.env.WITNESS_JOURNAL_RDF_AGENT });
  if (op === "solicit-service") return solicit(store, activity, at);
  if (op === "invoke-service") return invoke(store, activity, at);
  return reject(store, activity, `unknown-provider-operation:${op}`, at, ["operation"]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const activity = JSON.parse(readFileSync(0, "utf8")); const output = await run(activity, operation(), instant());
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`); if (output.type === "Reject") process.exitCode = 2;
  } catch (error) { process.stderr.write(`hoare-program-measurement: ${error.message}\n`); process.exitCode = 1; }
}
