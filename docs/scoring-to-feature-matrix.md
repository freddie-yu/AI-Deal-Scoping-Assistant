# Scoring-to-feature implementation contract

## Authority and priorities

Source: `C:\Users\一帆\Downloads\challenge-requirements.md`, read in full. References below use official section names: **F1–F6** = Functional Requirements 1–6; **D1–D7** = Deliverables 1–7; **AI** = AI and Model Usage; **Tech** = Technology Expectations; **Depth** = Solution Depth Requirement; **Grounding** = Grounding and Information Hierarchy. **R1–R8** label the eight rubric categories in order; R8 corrects only the specification's repeated numbering, not its meaning.

**P0:** compliance or direct scoring coverage. **P1:** additional reliability, usability, or reviewer polish beyond that baseline. **P2:** optional work after P0/P1. Approaches and test assertions below are proposed implementation choices, not additional official requirements. Recommended/applicable content remains conditional on customer scope; examples are not mandatory technologies or formulas. No application, database schema, or estimation formula is designed here.

## Rubric → feature matrix

Weights apply once per category, total **100%**. Grouped criteria retain every official scoring dimension. Acceptance includes the content and invariants below. Test IDs refer to the test matrix.

| Evaluation category / weight | Scoring criteria | Source requirements | Required capability / implementation approach | Acceptance criteria | Demo evidence | Automated-test evidence | Priority |
|---|---|---|---|---|---|---|---|
| R1 Requirements Analysis and Scope Model — 20% | Extraction accuracy; source traceability; stated/inferred/assumed classification; missing information; questions; review/update; reusable structure | F1, Grounding, Depth | Analyze input into shared structured items; preserve source references, provenance, review controls | Required fields and source links valid; per-seed semantic facts/classifications and missing-information assertions pass; review precedes generation | Inspect source, classification, gap, and reviewed edit | T1–T2, T11 | P0 |
| R2 PRD and Functional Scope — 15% | PRD completeness; scope organization; capability traceability; requested/recommended separation; functional/NFR coverage; unsupported additions | F2 | Generate PRD and grouped capabilities from reviewed scope; compute coverage | Every major capability references reviewed IDs; missing coverage and unsupported additions surfaced automatically | PRD, capability links, uncovered requirement | T2–T4, T10 | P0 |
| R3 Cloud Solution Architecture — 15% | Cloud services; end-to-end completeness; component traceability; security/scalability/observability/deployment; rationale/trade-offs; visualization | F3 | One supported provider; grounded service mappings and rendered diagram | Applicable layers covered; major components justified; readable diagram agrees with components and selected cloud | Select provider; inspect component rationale and source | T2, T4, T10 | P0 |
| R4 Data, Integration, and AI Strategy — 15% | Data-strategy quality; integration completeness; suitable AI use cases; framework/service recommendation quality; AI/deterministic separation; responsible AI/privacy/evaluation/human review | F4 | Coordinated inventories and flows; requirement-linked AI recommendations with solution-specific reasoning | Applicable content and relevant reviewed links present; per-seed recommendation/compatibility expectations pass; rationale, evaluation, privacy and human decisions explicit | Follow data flow; inspect integration and AI rationale | T2–T4, T10 | P0 |
| R5 Effort, Timeline, and ROM Estimation — 15% | Phases/workstreams; scope/complexity drivers; reproducibility; commercial configuration; rates/contingency/currency; confidence; risks/dependencies/exclusions/assumptions | F5, Grounding | Deterministic calculations from visible, documented factors; configurable commercials | Effort, timeline, milestones and ROM reproducible; uncertainty visible; missing inputs affect confidence/calculation | Inspect basis, adjust rate/contingency, inspect gaps | T5–T8 | P0 |
| R6 Change Impact and Quality Validation — 10% | Affected outputs; unchanged reviewed content; coverage; consistency; unresolved questions/unsupported recommendations; export gate | F6, Depth | Dependency-based impact; selective regeneration/recalculation; deterministic checks | Important reviewed requirement/assumption edit identifies affected artifacts; unaffected reviewed content preserved; current gate exposes issues | Before/after change, retained content, quality summary | T3–T4, T8–T11 | P0 |
| R7 UX and Visual Design — 5% | End-to-end clarity; scope review; output readability; diagrams/traceability; responsive professional design | Core User Journey, Tech, Success Definition | Focused staged workspace with review, generation, impact, and export states | Reviewer completes canonical path; outputs and links readable on narrow/wide screens | Complete journey and responsive view | T11; visual review supplements automation | P0 |
| R8 Code Quality and Documentation — 5% | Maintainability; structured validation; errors; secure configuration; local setup; tests; mock support; README/architecture docs | AI, Tech, D2–D7 | Separate responsibilities; validate provider outputs; actionable failures; documented configuration and data handling | Clean setup and tests succeed; no required paid access; mock parity; seed/docs/video present | Local startup, mock label, failure recovery, README | T1, T11–T12; clean-run verification | P0 |

All baseline rows are P0 because they directly protect scores. P1 examples: stronger error recovery and clearer navigation among already-required source links. P2 examples: extra export formats and extra providers. Neither substitutes for incomplete P0 coverage.

## Content acceptance checklist

Use these compact inventories when assessing completeness; mark genuinely inapplicable areas with a reason rather than inventing customer needs.

| Area | Content to cover |
|---|---|
| F1 analysis | Objectives, personas, functional/non-functional requirements, existing systems, integrations, data, security/compliance, technology preferences, delivery constraints, dependencies, risks, missing information, assumptions, questions. Items: ID, type, description, priority, source text/section, stated/inferred/assumed classification, dependencies/questions. |
| F2 PRD/scope | Overview, problem, objectives, personas, journeys, functional/NFR scope, integrations, dependencies, assumptions, risks, exclusions, questions, traceability. Organize capabilities/modules/workstreams/packages; distinguish requested scope, interpretation, enhancements, unconfirmed assumptions, and exclusions. |
| F3 architecture | Applicable frontend/backend/APIs, storage, identity, messaging, integrations, AI, observability, security, deployment/runtime, dev/test/production, availability/scalability, backup/disaster recovery. Components: name, cloud service, supported IDs, purpose, rationale, trade-offs, dependencies, security. |
| F4 strategy | Data domains/sources/ownership, ingestion, transactional/analytical storage, quality, metadata/governance, retention, privacy/security, reporting, backup/recovery. Integrations: internal/external systems, APIs/events/batch/files, authentication, errors/retries, monitoring, synchronization, information flows. AI: use cases/requirements, deterministic alternatives, pattern, model/provider options, retrieval/orchestration where applicable, prompts/structured outputs, evaluation, safety, monitoring/feedback, human review, privacy, justified framework/services. |
| F5 estimate | Phases, workstreams, roles, effort/timeline ranges, milestones, dependencies, assumptions, risks, ROM range, confidence and exclusions. Applicable drivers: capabilities/integrations and complexity, cloud, migration/transformation, AI, security/compliance, testing, environments, team, rates, productivity, contingency, dependencies, currency. |
| F6 package | Executive summary, objectives, requirement summary, PRD/scope, architecture and diagram, data/integration/AI strategy, technologies/frameworks, delivery phases/workstreams, effort/timeline/ROM, assumptions/risks/dependencies/questions, coverage and traceability. Include quality findings and required disclaimer. |

## Non-negotiable product invariants

1. **Grounding:** customer requirements lead; reviewed assumptions/configuration supplement them; AI recommendations remain explicitly labeled and justified. Missing critical information creates questions, reviewable assumptions, reduced confidence, and validation flags (Grounding, F1).
2. **Source continuity:** each extracted requirement retains its originating customer-text reference and stated/inferred/assumed classification through review and downstream use (F1).
3. **Review boundary:** downstream generation uses a reviewed, shared scope model; disconnected prompts or a single generated report do not qualify (Depth).
4. **Connected outputs:** major capabilities, integrations, and AI use cases reference reviewed requirements. Major architecture components reference justifying requirements/security needs or reviewed assumptions; derived delivery/estimation preserves that grounding, including assumption-only paths without fabricated requirements. Coverage exposes unsupported additions and omissions (F2–F4).
5. **Reproducibility:** final effort, timeline, and ROM derive from visible factors/documented rules, never unsupported model numbers. Missing inputs identify affected components and reduce confidence or block calculation; avoid unsupported precision (F5).
6. **Controlled change:** at least one important reviewed requirement or major assumption is editable; consumed-field changes drive impact. Temporary upstream review ineligibility blocks new use but preserves unaffected REVIEWED + CURRENT content; new generation/recalculation still requires eligible inputs (F6).
7. **Pre-export review:** current quality findings identify coverage gaps, unresolved questions, unsupported recommendations, estimation gaps, inconsistencies, and human-validation items. The specification requires visibility/status, not an unconditional prohibition on exporting unresolved issues (F6).
8. **Runnable review:** P0 requires AIProvider + MockAIProvider with shared validation, no live adapter, model installation, credentials or paid AI access. Mock mode preserves substantive analysis/generation, traceability, estimates, changes, checks, and package generation; live providers are P2 (AI, Tech).
9. **Planning-only export:** every export includes this exact statement (F6):

> This document is an AI-assisted internal planning output based on customer requirements and stated assumptions. It requires review and validation by qualified sales, architecture, delivery, security, and commercial stakeholders. It is not a final quote, contractual commitment, or delivery guarantee.

## Minimum competitive submission and scope reductions

Minimum: one focused local browser workspace implementing every P0 row, supported-provider architecture, editable reviewed scope, connected artifacts, deterministic estimates/checks, complete mock flow, and all submission materials. A static report is insufficient.

| Reduction | Decision | Specification basis / boundary |
|---|---|---|
| Pasted text; no document ingestion | SAFE | F1 explicitly makes upload recommended, not mandatory. Preserve source text/sections. |
| One fully implemented cloud provider | SAFE | F3 says at least one. Offer the supported selection honestly; Success Definition's AWS/Azure/GCP wording does not require all three. |
| Markdown-only export | SAFE | F6 permits at least one readable format. Include complete content/disclaimer and an architecture representation readable in the documented viewing workflow. |
| Mock AI provider without live dependency | SAFE | AI explicitly permits mocks/recordings. Must demonstrate substantive structured analysis/generation and full seeded behavior, not a canned report; clearly disclose input limitations. |
| Deterministic rule engines | SAFE | F5 requires reproducible values; rules also support checks/impact. Replacing all meaningful AI functionality with unrelated static rules is NOT ALLOWED under AI. |
| Mermaid or similar rendering | SAFE | F3 requires a diagram or clear visual, not an editable canvas; validate actual rendering. |
| Local/session storage or lightweight persistence | SAFE | Tech prescribes no database or retention duration. Preserve the complete working session and reviewed state; document storage/protection and reset behavior. |
| No authentication | SAFE | Explicitly optional in Tech. Still handle customer data/configuration securely. |
| Single AI orchestrator | SAFE | Challenge Type explicitly allows a single service/custom lightweight workflow. Shared reviewable scope remains mandatory. |
| Only rate edits for change demonstration | RISKY | F6 examples include rates, but its constraint and Success Definition require a reviewed requirement or major assumption change. Demonstrate that stronger case. |

## Canonical reviewer success path

Run this journey in labeled mock mode with no credentials; the recommended 3–5 minute video follows it. Provide seed coverage for modernization, data/integration-heavy, AI-enabled, and important-missing-information scenarios; these need not be four unrelated implementations.

| Step | User action | System behavior | Scored | Visible evidence |
|---|---|---|---|---|
| 1 | Start locally; choose seed and paste requirements | Show context, input and mock status | R7–R8 | Working browser, no paid access |
| 2 | Analyze; inspect sources and gaps | Extract classified structured scope | R1 | Source excerpts, assumptions/questions |
| 3 | Update or approve scope | Record review before generation | R1–R2 | Reviewed requirements |
| 4 | Generate PRD/scope | Produce connected capabilities and coverage | R2 | Requested/recommended separation, links |
| 5 | Select supported cloud; generate architecture | Map justified services and render diagram | R3 | Security/deployment, rationale/trade-offs |
| 6 | Review data/integration/AI strategy | Explain flows and suitable approaches | R4 | Linked integrations, evaluation/privacy/human review |
| 7 | Review estimate; change rate/contingency | Recalculate from visible factors | R5 | Ranges, currency, milestones, confidence/gaps |
| 8 | Inspect coverage; change major assumption or requirement | Identify impacted outputs; selectively update | R6 | Changed estimate/artifacts, unaffected content retained |
| 9 | Run final checks | Surface current issues and export status | R6–R7 | Quality findings with affected items |
| 10 | Preview and export | Assemble complete current package | R2–R8 | Readable download, diagram, traceability, disclaimer |

## Automated-test contract

D4 names applicable test areas; all listed areas apply to this proposed minimum. Assertions below operationalize them without selecting formulas. T11–T12 add workflow/submission safeguards. Every seed/variant has lightweight semantic golden expectations defined in design §12: `mustExtract`, `mustClassify`, `mustIdentifyMissing`, `mustNotInvent`, `expectedCapabilities`, `expectedRecommendationConstraints`. Check structured facts, provenance, relevant links and declared constraints; these are not exact-prose snapshots or a general semantic evaluator. Tests complement human assessment of generated quality and visual clarity.

| ID / area | Required evidence | Rubric protected |
|---|---|---|
| T1 Structured AI validation + semantic goldens | Every seed passes shape and scenario facts/classifications/gaps. Salesforce source with shape-valid HubSpot CRM substitution fails; absent concurrency cannot become an invented fact. Malformed fields/references fail with actionable errors | R1, R8 |
| T2 Source traceability | References resolve and facts match their source/provenance; specific expected requirement links matter, not merely existing IDs. Reviewed assumption → architecture → unit → estimate retains assumption origin without creating a requirement; capability/integration/AI still require reviewed requirements | R1–R4 |
| T3 Coverage | Covered/uncovered functional and NFR fixtures yield expected counts; high-priority gaps visible | R2, R6 |
| T4 Unsupported recommendations | Inject unjustified scope/component/recommendation; flag it without misclassifying grounded recommendations. Seed AI recommendations must satisfy scenario-specific grounding/rationale/evaluation/privacy/human-review expectations; unrelated requirement links fail | R2–R4, R6 |
| T5 Effort/timeline | Known fixture matches documented rules and visible drivers; repeated inputs reproduce ranges and schedule basis | R5 |
| T6 ROM/currency | Known configuration reproduces commercial range; units/currency remain consistent across views/export | R5–R6 |
| T7 Rates/contingency | Change each separately; commercials match rules and dependent outputs refresh; unrelated reviewed content preserved | R5–R6 |
| T8 Missing inputs | Missing rate/complexity/dependency information exposes gaps and affected components; confidence falls or calculation blocks | R5–R6 |
| T9 Change impact | INT_B complexity change preserves INT_A/C and unrelated unit ledgers. Priority-only FR_04 change leaves ARCH_02 REVIEWED + CURRENT when it does not consume priority; explicit priority consumer becomes STALE. Re-review restores eligibility without regenerating unaffected content; substantive changes still invalidate actual consumers | R6 |
| T10 Cross-document checks | Detect existing cloud, delivery, grounding, AI-control, commercial and unresolved-input issues. Required PostgreSQL → RDS PostgreSQL = COMPATIBLE; accepted JVM-only → Python/FastAPI = CONFLICT/BLOCKED; unknown customer-product relation = UNKNOWN/human-validation warning. Store reasons/rule versions; acknowledgment cannot manufacture compatibility | R3–R6 |
| T11 Complete mock flow/export | All four seeded journeys enforce review, run semantic goldens, preserve changes/traceability and export current findings/disclaimer with visible MOCK labels, without any live model service | R1, R6–R8 |
| T12 Delivery/configuration | Fresh checkout with ordinary Node dependencies, no Ollama/model installation or live settings/credentials runs T11. Seeds/schemas/document structures load; malformed/unsupported mock fixtures fail safely; documented setup/test commands work; no shipped client secrets | R8 |

## High-ROI implementation primitives

| Primitive | Multiple scoring benefits |
|---|---|
| Shared structured scope and review state | Reusable extraction, grounded PRD/architecture/strategy, consistent exports: R1–R4, R6, R8 |
| Traceability relationships | Source inspection, capability/component justification, unsupported additions and coverage: R1–R4, R6–R7 |
| Dependency relationships | Explain impacts, update selectively, preserve reviewed content, refresh estimates: R3–R6 |
| Deterministic quality checks | Reuse findings in coverage views, issue summaries, tests and export gate: R2–R4, R6, R8 |
| Deterministic estimation rules | One reproducible basis for effort/timeline/commercials, change handling and exports: R5–R6, R8 |
| Schema-compatible mock provider | Credential-free demonstration, validation fixtures and reliable reviewer journey: R1–R8 |

## Scope traps

Avoid authentication/enterprise tenancy (Tech: optional authentication); extra providers before one complete design (F3); PDF/DOCX ingestion and OCR (F1: paste allowed); diagram editors (F3: visual sufficient); vector databases and heavyweight multi-agent orchestration (Tech/Challenge Type: optional); multiple export formats (F6); historical-project estimation systems (F5: context only). These are optional expansions, never reasons to drop required strategy content, traceability, or validation.

## P0 Definition of Done

- [ ] All eight rubric rows and applicable content inventories pass; weights remain 20/15/15/15/15/10/5/5.
- [ ] Local responsive browser app accepts requirements, preserves sources/classification, surfaces gaps, and requires scope review before connected generation.
- [ ] PRD, functional scope, supported-cloud architecture/visual, data/integration/AI strategy and justified frameworks are complete and traceable.
- [ ] Effort/timeline/ROM ranges reproduce from visible documented factors; rates, contingency, currency, confidence and missing inputs work.
- [ ] Important reviewed requirement/assumption change identifies impacts and updates affected outputs while preserving unaffected reviewed content.
- [ ] Pre-export checks cover every F6 check, including high-priority coverage, ungrounded architecture, missing delivery integrations and AI safeguards; package preview/export contains current findings and exact disclaimer.
- [ ] Complete labeled mock journey runs without model installation, live-provider configuration or paid AI; all four seed scenario types, customer/opportunity context, configurable assumptions, role rates, commercial examples, mock responses, output schemas and document structures are included.
- [ ] T1–T12 pass, including per-seed semantic goldens and negative mutations; generated quality, diagrams and responsive reviewer journey are manually checked.
- [ ] Modular source handles errors and configuration securely. README covers local setup, honest optional-provider availability/configuration (mock-only P0; future live extension is P2), mock behavior, input processing, scope/review, traceability, generation, strategies, estimation/ROM, impact, checks, data storage/protection, architecture, assumptions and limitations.
- [ ] Submission architecture diagram shows browser, ingestion, orchestration, shared scope, PRD/cloud/data-integration/AI generators, estimation, traceability, impact, validation, export and mock provider; distinct from generated customer architecture.
- [ ] Demo video demonstrates the canonical journey, change and updated estimate, quality check/export and mock mode; recommended duration 3–5 minutes.
