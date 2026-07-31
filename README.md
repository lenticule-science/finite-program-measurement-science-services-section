# Finite Program Measurement Service

This is the application half of the former `hoare-program-measurement` micro-enterprise, split 2026-07-30 from its sibling formal library, [`hoare-program-carrier`](../hoare-program-carrier) (zero registry dependents verified before the split).

This is an OSS application service, not part of the Obsmetrologia mathematics library and not itself a Lean package. It is an ActivityStreams solicitation and invocation carrier over process standard input. It measures an explicitly supplied finite total relation and optional source-digested, customer-authored observations, then appends its own result, receipt, book, event, ActivityStreams, and EAVT evidence. The finite model is measured exhaustively; the truth of supplied observations is not independently verified. Direct runtime instrumentation and network ActivityPub remain explicitly unimplemented.

Run `make check` (or `npm run verify`) to verify the enterprise records and elaborate the application package. The executable operations are `solicit-service` and `invoke-service`; both read one ActivityStreams JSON value from standard input.

`src/verify-enterprise.mjs` only audits this half's own records now. It no longer checks `lib/ownership.json`, `lib/management/roster.json`, `content/offices/formal-program-measurer.json`, the Lean sources (`HoareProgramMeasurement.lean`, `HoareProgramMeasurement/Program.lean`, `lakefile.toml`, `lean-toolchain`), or `content/services/formal-hoare-carrier.json` and its RML law — those records and their audit now belong to `hoare-program-carrier`, which retains the enterprise's standing identity.
