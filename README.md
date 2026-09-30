# AI Deal Scoping Assistant

Phase 4 controlled change, selective updates and deterministic quality validation for the Topcoder AI Deal Scoping Assistant. This is **not the completed challenge submission**. Final package and export work belongs to Phase 5.

Implemented: exact text/Markdown ingestion, immutable source versions and sections, four substantive MOCK analyses, canonical requirements/assumptions/questions, source inspection, explicit edits and review, scope approval fingerprints, and downstream eligibility. Phase 2 adds structured PRD/capabilities, coverage, AWS architecture and Mermaid diagrams, coordinated data/integration/AI strategies, non-numeric delivery workstreams, and individual proposal acceptance. Phase 3 adds reviewed canonical EstimationUnits, exact effort/role arithmetic, capacity-based schedules and dated milestones, configurable rates/currency/contingency, deterministic confidence and inspectable ledgers. The Phase 0/1/2 storage, provider, source and review boundaries are retained.

## Run locally

Use **Node.js 24.x** with its bundled npm (validated with Node 24.21.0). No global packages, credentials, model installation, database, Docker, or external runtime services are needed. Dependency versions are pinned in one package and lockfile. Run commands from the repository root.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Vite forwards `/api` to the local Express server at port 3001. Both servers bind to loopback; those two ports must be free.

For the production build and single server:

```sh
npm run build
npm run start
```

Open http://127.0.0.1:3001. Stop with Ctrl+C. Production serves the built frontend and API from the same origin. Keep `seeds/` alongside the application; mock fixtures load from this repository directory.

In Requirements, select a scenario and **Start seed session**, then **Analyze with MOCK**. Inspect a requirement to see its exact customer quote, original section, provenance and basis. Review each requirement, assumption and question, then **Approve reviewed scope**. Open questions may be reviewed as unresolved and remain visible after approval. Continue through PRD & Scope, Architecture, and Data / Integration / AI. Generate proposals, inspect their grounding, and accept sections individually in displayed dependency order. In Estimate, accept delivery workstreams, prepare the estimation proposals, inspect drivers/configuration, accept the reviewed estimation basis, then calculate. Open Quality / Final Package to inspect change impact and run the quality gate. The final package/export portion is explicitly reserved for Phase 5.

Alternatively, create an empty session with customer/opportunity names and paste text or Markdown. Saving always preserves the exact input; arbitrary input outside the four recorded fixtures returns an honest unsupported-MOCK message on analysis. Starting a seed creates a separate session and preserves your earlier work. Copy a session ID to load it later. Reloading restores the last loaded session using its ID in browser localStorage.

### Reviewer walkthrough

1. Start **Salesforce order synchronization** and analyze.
2. Inspect `INT_01`: the quote is exactly “Existing CRM is Salesforce.”, labeled CUSTOMER_STATED / DIRECT.
3. Inspect the AI_INFERRED retry requirement, the PROVISIONAL assumption and the HIGH / OPEN API-readiness question.
4. Review every active item. Review accepts a provisional assumption for planning; it does not confirm the fact. A confirmed assumption needs a nonempty confirmation note, with optional exact source evidence.
5. Approve the reviewed scope. In PRD & Scope, generate proposals, inspect capability → requirement → source, and accept the sections. Coverage counts accepted capabilities only.
6. Generate AWS architecture. Inspect the diagram/table, service rationale and technology findings. Accept components before sections that depend on them.
7. Generate data/integration/AI strategy. Inspect Salesforce and Warehouse API authentication, retry, reconciliation and grounding. Accept sections individually.
8. In Estimate, propose and accept delivery workstreams. Prepare estimation proposals, review the explicit inventory and assumptions, add migration packages if applicable, accept the estimation basis and calculate. Expand a workstream, unit, drivers and ledger. Change a role rate or contingency and verify effort stays unchanged. Clearing a rate or changing currency makes the affected ROM unavailable.
9. Edit a requirement priority and save. Its ID stays stable, revision advances, review becomes DRAFT and approval is invalidated. New generation and obsolete proposal acceptance are blocked; historical accepted content is retained.

Descriptions labeled CUSTOMER_STATED use normalized exact direct quotations. A semantic paraphrase or unsupported addition must be explicitly reclassified as AI_INFERRED or ASSUMED with a basis; its original quote becomes CONTEXT. ASSUMED requirements also require an assumption link. This conservative rule does not claim general automated semantic truth detection.

Type correction allocates an ID in the new type namespace, links `supersedesId`, and retires the old record. Dependencies on a retired item remain visible and must be explicitly corrected before approval. Exclusion requires a reason. Answering a question does not rewrite requirements or resolve their measures automatically. Structured measure/technology edits require explicit reclassification; new customer-stated facts come from re-analysis of customer evidence. Changing a confirmed assumption clears its old confirmation and requires deliberate validation of the new claim.

## Validation

```sh
npm run typecheck
npm test
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

The Chromium download is a one-time browser test prerequisite and requires internet access. No AI connection is involved. Playwright starts the production server directly, checks the original six-area/session smoke flow and the complete Phase 1 review/approval/edit-invalidation journey, plus Phase 2 source navigation, individual acceptance, architecture rendering, integration review, delivery persistence, rejected-component fallback and negative approval tests, including narrow-screen overflow. Phase 3 browser tests cover driver/ledger inspection, rate/contingency edits, missing rates, currency invalidation, persistence and responsive estimates. It uses `.data/smoke/`; stop other servers on port 3001 before running it.

If Chrome or Microsoft Edge is already installed, you can skip that download by setting `PLAYWRIGHT_CHANNEL=chrome` or `PLAYWRIGHT_CHANNEL=msedge`. In PowerShell: `$env:PLAYWRIGHT_CHANNEL='msedge'`, then `npm run test:e2e`. Without this optional setting, tests use Playwright's downloaded Chromium.

Vitest includes all 22 original Phase 0 tests plus source sectioning/UTF-16 offsets, immutable replacements, canonical ID counters, source/provenance validation, edits and retirement, assumption/question lifecycle, approval eligibility, persistence integrity and stale analysis rejection. Semantic goldens check structured source facts and classifications, unresolved concurrency/questions and forbidden inventions across all four seeds. Shape-valid HubSpot substitutions, wrong provenance/links and invented concurrency fail the goldens. Malformed provider fixtures fail before canonicalization. Phase 2 tests additionally cover strict operation schemas, AWS keys, requirement/assumption grounding, compatibility, deterministic diagrams, concurrency, section preservation, structured controls and delivery suggestions. Semantic mutations reject missing/unsupported capabilities, unrelated integration/AI recommendations, PostgreSQL violations, absent mandatory human review and invented scale. Phase 3 executes the deterministic estimation formulas using reviewed, visible configuration.

## Structure and boundaries

| Directory | Responsibility |
|---|---|
| `src/ui/` | Six-area shell, scope and artifact review, source inspection and local Mermaid rendering |
| `src/server/`, `src/application/` | HTTP boundary, errors and session commands |
| `src/domain/` | Closed Zod contracts and inferred types, including all eleven artifact payload variants |
| `src/persistence/` | Repository interface and versioned JSON adapter |
| `src/ai/`, `src/validation/` | Provider interface, local fixture adapter and shared validation hooks |
| `src/ingestion/` | Exact source sections, immutable versions and anchor resolution |
| `src/seeds/`, `seeds/` | Shared manifest schema, four recorded scope fixtures and semantic expectations |
| `src/generators/` | Parameterized Phase 2 seed proposals; no direct state mutation |
| `src/architecture/`, `src/traceability/` | AWS catalog, compatibility, deterministic diagram source and scope coverage |
| `src/estimation/` | Canonical reconciliation, exact arithmetic, configuration, scheduling, confidence and calculation ledgers |
| `src/impact/`, `src/quality/` | Field diffs, reverse dependency traversal, freshness, stage coverage and deterministic quality gate |
| `src/export/` | Type-only Phase 5 boundary; no package or export implementation |
| `tests/` | Unit, API/persistence/provider integration, semantic goldens and browser journeys |

Domain schemas have no filesystem, UI or provider dependencies. Routes call application commands. Providers return `unknown`, never mutate sessions, and expose provider/mode metadata. `validateProposal` validates structure before source/reference hooks; only then does application code canonicalize draft scope. The existing analysis Narrative payload has optional typed facts for finite golden selectors; requirements have an explicit basis, and questions have optional subject/basis/source context. These extend the existing records without a parallel fact store.

The original `analyze` / `foundation` validation fixture still works. The new `analyze` / `scope` operation matches the exact source fingerprint to one of four checked-in analysis recordings. Fixture candidate positions are temporary references; canonical counters independently allocate BR/FR/NFR/INT/DATA/SEC, ASM and Q IDs. Fixtures contain no canonical scope snapshots. Source sections and final offsets belong to the application, not the provider. Unsupported operations/input fail with ProviderError; malformed output reports field paths through ValidationError. No live provider is available or configurable.

Re-analysis is an explicit whole-scope replacement: existing records are retained as retired, fresh candidates receive new IDs, and no semantic matching or renumbering occurs. The UI requires an explicit replacement selection before re-analysis. `seeds/build-phase1.mjs` regenerates the compact recordings and manifests for maintainers; normal startup does not run it.

Source offsets are zero-based, half-open UTF-16 positions into the original string. SHA-256 hashes its UTF-8 serialization. Line sections preserve CRLF, blank lines and trailing whitespace. Quotes must resolve uniquely within the declared section. Persistence validates source hashes, offsets, links and counter integrity and rejects mutation/removal of stored source documents or sections.

`canGenerateDownstream(session)` in `src/application/scope-review.ts` requires a nonempty included scope, current-source analysis, current review stamps, eligible dependencies and assumptions, reviewed questions and a matching approval fingerprint. All active scope decisions, including exclusions, require review. The fingerprint binds source membership and scope content/revisions/inclusion/question state. Relevant writes clear it. Open reviewed questions and provisional reviewed assumptions are visible warnings, not invented facts or automatic blanket blockers. Later operations must impose their own input-specific requirements.

Content edits advance entity revision and require re-review. Review records the content revision and advances only the session revision. One bounded before-edit snapshot per pending record is retained, alongside the repository’s previous valid session. Eligibility changes alone never erase downstream records or change their freshness. Phase 4 separately compares the substantive fields consumed by each downstream section.

Estimation schemas retain atomic 0/1 quantities, canonical `(unitType, source identity)` uniqueness, separate workstream ownership, separate baseline/multiplier references, one current estimate per unit, typed ranges and explicit unavailable values. The Phase 3 pure engines now calculate effort, roles, schedules, confidence, contingency and ROM from these records. Application commands enforce source eligibility, schema validation and optimistic concurrency. Structural validation and finite semantic fixtures complement human review.

## API and local data

- `GET /api/health`
- `POST /api/sessions` with `{ "customerName": "Example", "opportunityName": "Foundation" }`
- `GET /api/sessions/:id`
- `DELETE /api/sessions/:id` with `{ "expectedRevision": 1 }`
- `GET /api/seeds`; `POST /api/sessions/seed` with `{ "seedId": "integration-heavy" }`
- `POST /api/sessions/:id/input` with `{ "expectedRevision": 1, "title": "Discovery", "text": "Exact customer input", "inputKind": "PASTED_TEXT" }`
- `POST /api/sessions/:id/analyze` with `{ "expectedRevision": 2 }`
- `GET /api/sessions/:id/scope` for authoritative readiness, approval and eligibility reasons
- `PATCH /api/sessions/:id/requirements/:itemId` or `/assumptions/:itemId` with `{ "expectedRevision": 3, "patch": { ...allowedFields } }`
- `POST /api/sessions/:id/questions/:itemId/answer` with expected revision and `{ "answer": { "text": "...", "basis": "...", "evidence": [] } }`
- `POST /api/sessions/:id/{requirements|assumptions|questions}/:itemId/review` with expected revision
- `POST /api/sessions/:id/approve` with expected revision

Create returns revision 1. Domain writes require the current expected revision and advance it once; generation-run bookkeeping and rejection are serialized operational writes with a separate operational revision, preserving the captured domain revision. Both counters protect against lost updates; conflicts return a typed error and preserve storage. Analysis captures the input snapshot, performs provider validation without holding the save lock, then compare-and-saves against the captured revision. A stale or invalid response cannot replace reviewed work. Browser errors retain the current draft so the user can reconcile explicitly.

Each session is stored as `.data/<lowercase-uuid>.json`, validated on write and load. Writes are serialized per session inside the single server, use temporary-file replacement, and retain the prior validated snapshot as `<uuid>.previous.json`. A failed write does not replace the current snapshot. Invalid/corrupt state is reported safely without overwriting evidence or silently loading a backup. For manual recovery, stop the server, preserve the damaged file, then restore the previous snapshot to the main filename and restart. This is local single-process persistence, not a multi-process transaction service or a full history system.

`.data/` is ignored by Git. Deletion through the API removes the session and its previous snapshot; alternatively stop the server and remove that session's two files. The server-only `DATA_DIR` environment variable can override the data directory, primarily for tests. No environment configuration is required.

Storage is plaintext under your OS account. The app has no authentication and is intended for local single-user use. It rejects unexpected origins/hosts and unsafe identifiers, limits JSON requests to 128 KB, does not render raw untrusted HTML, sends no telemetry, and does not log customer/provider bodies. No secrets or provider adapters are bundled into the browser.


## Phase 2 connected artifacts

Artifacts are containers; typed ArtifactSections are canonical. PRD paragraphs, Capability, ArchitectureComponent, DataDomain, Integration, AIUseCase and Workstream payloads remain structured. Rendered text and Mermaid are views. Stable IDs are allocated by application counters; regeneration reuses existing section identity by artifact kind and template key. Provider-local keys cannot create canonical IDs.

The existing AIProvider operation convention is extended with `prd-scope`, `architecture`, `strategies` and `delivery`, each with a strict operation-specific schema. Internal generators include generatePRD, generateFunctionalScope, generateArchitecture, generateDataIntegrationStrategy, generateAIStrategy and generateDeliveryPlan. All four seed families use parameterized MOCK templates in `src/generators/`; their manifests list these recordings and their structured semantic expectations. No accepted artifacts are injected by fixtures.

Every operation requires a current approved scope fingerprint, reviewed requirements/assumptions and eligible source state. Generation captures a snapshot, validates unknown provider output, checks references/catalog/grounding, and stores a pending run. It never overwrites accepted sections. Acceptance rechecks the captured inputs and current session revision, validates technology constraints, and commits one section. Accept dependencies first. Other sections remain byte-identical. Only acceptance of siblings in the same run advances that run's acceptance cursor; any unrelated domain change makes its remaining proposals obsolete. Rejection does not erase an older accepted version.

Capabilities, integrations and AI use cases require reviewed Requirement grounding. Architecture components can instead use reviewed Assumption grounding; this path never creates a fake requirement or contributes to requirement coverage. Scope coverage lists covered/uncovered/excluded requirements, supporting capability IDs, functional/NFR rows and high-priority counts. Empty denominators display N/A. This projection is not the final quality gate. Input eligibility checks reject obsolete new use. Phase 4 separately traverses consumed fields to invalidate freshness and explain affected versus preserved sections.

Architecture is **AWS only**, with a compact application-owned catalog of the services used by the seed templates. The app runs locally without an AWS account. Providers return catalog keys and structured connections. Code produces deterministic Mermaid, rendered by the locally bundled library with strict security, HTML labels disabled and links disabled/removed. Component/connection tables remain available if rendering fails or a proposal dependency is rejected. The customer solution diagram is distinct from the submission diagram in docs/design.md.

Technology compatibility uses a small versioned table, not web research or model judgment. PostgreSQL → RDS for PostgreSQL is COMPATIBLE; JVM-only → Python/FastAPI is CONFLICT; unmodeled customer products/versions are UNKNOWN. Every relevant choice is checked; absent choices also remain UNKNOWN. MUST conflicts block acceptance; preference conflicts and UNKNOWN are visible for human review. Human acceptance does not turn UNKNOWN into COMPATIBLE.

Data policies preserve unresolved ownership, retention and recovery targets. Integration endpoints explicitly reference architecture adapters and data domains. The AI seed includes approved-article retrieval, deterministic validation, identifier removal, evaluation and mandatory agent approval; other seeds explicitly recommend deterministic processing. Framework/service rationale lives within the grounded use case or technology narrative. Workstream scope/roles/complexity are marked **advisory**; canonical unit membership and computed roles are supplied by the deterministic Phase 3 engine.

Artifact cards expose Why? → linked Requirement/Assumption → exact canonical source evidence. Existing customer quotes are not copied into separate authoritative artifact evidence stores. Paragraph origin labels preserve customer-stated versus inferred content.

### Supported MOCK boundary

Phase 2 recognizes the four exact seed source recordings and their reviewed scope. It parameterizes review, priorities and inclusion/exclusion while preserving recorded requirement/assumption meaning and structured facts. Confirming an assumption retains its explicit validation status. Free-form meaning, measure or technology changes need a new supported fixture; they produce an actionable error and preserve existing work. This is not a general-purpose semantic reasoner. Automated semantic goldens exercise the finite seed predicates; human review remains essential.

Additional application routes:

- `POST /api/sessions/:id/generate`: expectedRevision plus operation.
- `POST /api/sessions/:id/runs/:runId/sections/:sectionId/review`: expectedRevision and ACCEPTED/REJECTED decision.
- `GET /api/sessions/:id/artifacts`: structured artifacts, input eligibility, compatibility, coverage and diagram projection.
- `GET /api/sessions/:id/coverage` and `GET /api/sessions/:id/diagram`: read-only projections.

There is no generic save-generated-document endpoint, live AI, authentication, Azure or GCP implementation. See docs/phase-2-validation.md for the exact verification record.

## Phase 3 deterministic estimation

AI supplies semantic proposals and advisory complexity only. The pure modules in `src/estimation/` never call MockAIProvider. Canonical EstimationUnit and EstimateItem sections extend the existing ArtifactSection model. Identity is `(unitType, source identity)`; workstream names, display groups, phase assignment and requirement count do not define calculation identity. Distinct migration packages may share a data domain; named environments have separate immutable keys. Discovery/handover are solution activities; testing targets implementation units, with a single infrastructure-only fallback when appropriate.

Prepare creates **proposals**, including explicit demo assumptions for three environments, a solution security package, drivers, zero waits and the displayed inventory. No migration labor is inferred merely from DataDomain records. Add any required migration/transformation boundaries before confirming completeness. Unknown inputs remain visible. Review is human acceptance of a planning basis, not factual confirmation or baseline calibration. Source eligibility and current scope approval are checked before new operations; existing historical results are retained during review-only ineligibility.

Three visible Boolean flags produce LOW (0 true), MEDIUM (1) or HIGH (2–3). Discovery/handover use FIXED_LOW and still consume the configured LOW multiplier. All testing units consume the shared HIGH integration/data/AI predicate: an unknown upstream band or inventory is unresolved unless an included HIGH unit already makes the predicate true. AI advisory labels never override these rules.

For each unit and bound: **quantity × unadjusted baseline × selected complexity multiplier ÷ productivity**, in person-days. Configured role shares sum exactly to one. BigInt rational arithmetic interprets decimal inputs exactly; persisted fractions and original configuration/ledger inputs make results reproducible. Aggregates sum distinct canonical rows. Person-weeks are presentation conversion only. No group-level complexity, second role allocation or management surcharge is applied.

The schedule pools role workloads by accepted phase, divides by net role capacity, applies the reviewed phase minimum and rounds up to working days. Phases are sequential; waits are added once at each barrier and add no labor. Same-phase true predecessors, backward dependencies and cycles are rejected. ISO date-only calendar arithmetic maps working-day offsets to phase/milestone and final dates, with configurable weekdays, holidays and start date. A missing calendar preserves working duration while dated outputs are unavailable. Deadlines classify INFEASIBLE, AT_RISK or WITHIN_RANGE without compressing effort or promising delivery.

Commercials multiply exact role days by integer minor-unit daily rates, round each low role cost down and high role cost up, sum the canonical unit base, then round that unit's contingency outward and add it once. Solution/workstream totals sum those authoritative unit rows. Currency changes invalidate old rates until explicitly replaced/confirmed; no FX is performed. Headlines round outward to the configured 0.1 person-week, whole calendar-week and 1,000 major-currency quanta. Exact audit values remain available and never consume headline rounding.

Missing drivers/baselines/multipliers/productivity/allocation block affected effort. Missing rates or incompatible currency block affected ROM while preserving effort. Missing capacities/minima/waits block the affected schedule. Incomplete inventories suppress full totals and retain explicitly labeled known subtotals. Ordered confidence uses LOW for unavailable or materially unresolved inputs, critical open questions/readiness/deadline/calibration-limit conditions; otherwise MEDIUM for provisional/noncritical/demo limitations; otherwise HIGH. Metric confidence remains separate and overall confidence takes the weakest material result. Uncalibrated demo baselines remain capped at MEDIUM after review.

All configuration is versioned, inspectable and editable through the Estimate workspace. The main controls cover role rates, contingency and currency; unit controls expose drivers, while advanced configuration exposes baselines, productivity, capacity, calendar, phase minimums/waits and completeness. Configuration aliases resolve reviewed owners and reject cycles. The missing-information seed intentionally leaves the engineering rate unresolved. Design-to-work coverage and unit source drill-down retain assumption-only architecture without adding synthetic requirements or customer coverage.

**DEMO CONFIGURATION / HEURISTIC DEFAULTS:** all supplied baselines, role rates, capacities, flags and dates are illustrative planning assumptions, not market benchmarks. ROM excludes taxes, margin, travel, licenses, AI consumption and cloud operating cost. No cloud pricing, automatic currency conversion, statistical forecast, staffing optimizer or delivery guarantee is included.

Application routes (all writes include `expectedRevision`):

- `POST /api/sessions/:id/estimate/prepare`, `/reconcile`, `/calculate`.
- `POST /api/sessions/:id/estimate/review` with `confirmed: true` after reviewing displayed inputs.
- `PATCH /api/sessions/:id/estimate/configuration` with `confirmed: true`, `updates: [{key, value, basis}]`; use JSON null for an unresolved value. Reviewed configuration edits recalculate existing estimates.
- `POST /api/sessions/:id/estimate/boundaries` with `unitType: DATA|CLOUD`, `name`, `boundary`, `scopeRefs`.
- `PATCH /api/sessions/:id/estimate/units/:unitId` for reviewed ownership/named-boundary/applicability changes; source inclusion stays authoritative.
- `GET /api/sessions/:id/estimate` and `/estimate/ledger` for stored results, exact audit basis, workstream projection and design-to-estimation coverage.

Direct reconciliation/recalculation preserves unchanged canonical results/revisions. Phase 4 adds reverse traversal and actual selective numerical execution around these existing formulas. See [Phase 3 validation](docs/phase-3-validation.md) for actual commands and numerical evidence.

## Phase 4 controlled changes and quality

`deriveDependencyIndex` rebuilds upstream → consumer edges from canonical grounding, InputRefs, source anchors, relationship references, unit sources, ledgers, aggregate membership and versioned resources. There is no editable graph database. `diffSessions` records typed old/new values and changed FieldPaths for requirements, assumptions and configuration. Traversal is deterministic, cycle-safe and retains direct/transitive paths. Missing declarations or broken references produce UNKNOWN impact rather than a guessed unaffected classification.

Review state, input eligibility and content freshness are separate. Changing a priority does not stale an architecture component whose manifest consumes only requirement meaning, existence and inclusion. Changing a consumed value marks its direct accepted consumer STALE while preserving its ID, payload, evidence and review stamp. Transitive consumers remain potential impacts until their actual upstream values change. Each accepted proposal rebuilds the graph and traverses again. Unaffected reviewed sections are explicitly listed with hashes; they are not inferred from a total count.

In **Quality / Final Package**, inspect changed values, affected/preserved areas and **Why is this affected?** paths. Review and reapprove changed scope, then **Regenerate affected content**. Each bounded run receives only allowed targets and declared inputs; writes outside the target set fail validation. Expand **Previous accepted content**, compare the proposal and grounding, and accept or reject individually. Rejection retains the stale accepted version. Continue through dependent stages, then **Recalculate affected estimate**. Concurrent scope edits invalidate pending proposals and old execution requests.

The existing deterministic estimator skips unchanged numerical routines. A rate edit recomputes matching role costs and commercial aggregates, retaining effort and schedule; contingency reuses base pricing; currency makes unmatched rates unavailable without FX. An integration driver edit recomputes the affected unit and shared testing only if the relevant HIGH predicate changes. Reconciliation is explicit when membership actually changes. Independent FULL recalculation audits stored outputs without trusting caches.

For the flagship walkthrough, start **modernization**, complete the earlier review/generation/estimation steps, inspect the expected-users NFR and open **Change expected users**. Set 500000 and record a basis. This creates a provisional assumption and an ASSUMED requirement, preserving the original 5,000-user quote. Review both and reapprove. Scale-related PRD and architecture narratives update; persona and core workflow remain unchanged. The fixture does not invent concurrency, cloud operating prices or a numerical multiplier where none was declared.

The finite selective recordings cover scale 5000 → 500000, integration retry/reconciliation complexity through deterministic drivers, the AI supervisor-approval variant, and the missing-information 100-concurrent-users variant. Arbitrary generative changes remain unsupported. Priority/inclusion edits also use declared bounded consumers.

The quality gate consolidates scope/design/delivery coverage (N/A for an empty denominator), grounding and unsupported additions, AWS/catalog/compatibility, diagram integrity, delivery representation, AI safeguards, estimation gaps and reproducibility, questions, human-validation assumptions, freshness, references and pending proposal snapshots. **PASS** means no findings; **REVIEW_REQUIRED** means warnings only; **BLOCKED** means at least one integrity error. Provisional assumptions, missing inputs with honest unavailable outputs, open questions and UNKNOWN technology stay visible as warnings. Invented values, MUST conflicts and stale required content block. The browser also renders the accepted diagram before evaluation and records a rendering failure as blocking; API-only evaluation checks diagram structure.

Quality results bind to the current domain revision and rule version. Domain changes discard obsolete gates; evaluation is an operational write. No export acknowledgment, export receipt or package is generated.

Additional API routes (writes include `expectedRevision`):

- `GET /api/sessions/:id/impact`; `POST /impact/regenerate`; `POST /impact/recalculate`.
- `GET /api/sessions/:id/quality`; `POST /quality/evaluate` (browser also reports `diagramRendered`).
- `POST /api/sessions/:id/requirements/:itemId/expected-users` with `value` and `basis`.

See [Phase 4 validation](docs/phase-4-validation.md) for exact regression evidence, preservation checks and command results.

## Not implemented

Final package assembly, Markdown export, export receipt, other export formats and demo video are not implemented. There is no upload/OCR/PDF/DOCX path or live AI. MOCK analysis supports exact seed source fingerprints; selective regeneration supports the recorded change variants. Arbitrary unsupported edits are saved for review but cannot invoke arbitrary generative AI.

## Approved contracts

Authority order:

1. [Official challenge requirements](docs/challenge-requirements.md)
2. [Scoring-to-feature matrix](docs/scoring-to-feature-matrix.md)
3. [Design and submission architecture diagram](docs/design.md)
4. [Data model](docs/data-model.md)
5. [Deterministic estimation rules](docs/deterministic-estimation-rules.md)

The official requirements file is an unchanged local copy of the supplied challenge document. Phases 0–4 implement the approved source, review, connected-artifact, deterministic-estimation and controlled-change contracts. Final submission/export work remains.
