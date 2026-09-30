# Phase 3 validation

Validated locally on 2026-09-24. The pre-implementation baseline passed all 94 Vitest tests; Phase 0–2 code and six existing browser tests were retained.

## Verification record

The final sequence completed in the required order against the current code:

| Command | Result |
|---|---|
| npm run typecheck | PASS, exit 0 |
| npm run test | 233/233 tests, 24/24 files; 30.08s, exit 0 |
| npm run build | PASS: TypeScript, Vite client and server compilation, exit 0 |
| npm run test after build | 233/233 tests, 24/24 files; 36.03s, exit 0 |
| npm run test:e2e, PLAYWRIGHT_CHANNEL=msedge | 8/8 passed; 43.6s, exit 0 |

All 94 original unit/integration tests and all six original browser tests remain green. Phase 3 adds 139 unit/integration tests and two browser tests. No live AI, AWS account or external rate/pricing service is used.

An earlier post-build attempt hit one original Phase 2 test's 5-second timeout (232 passed, one timeout). Its isolated 18-test file passed without changes; the fresh complete sequence above also passed with original timeouts unchanged. The production build retains the existing warning for a Mermaid-related chunk over 500 kB; no build error occurred. A supplemental tsx evidence-print attempt hit a Windows uv_os_get_passwd environment error; the same numerical evidence was successfully printed using the compiled production modules instead. Neither issue required a product change.

## Implemented path

Accepted Phase 2 artifacts feed canonical EstimationUnit sections, reviewed visible configuration, deterministic complexity/effort/role calculations, pooled sequential phase schedules, dated milestones, minor-unit ROM and confidence. EstimateItem/EstimateSummary remain existing ArtifactSection variants. Application commands enforce current scope approval, reviewed source eligibility, optimistic concurrency and validated persistence. The Estimate workspace exposes summary, workstream projection, unit drivers, sources, missing inputs and the calculation ledger.

## Numerical evidence

These values were verified by automated regressions and independently printed from the compiled production engine using the rules §9 fixture. Monetary figures below are major USD units; stored ledger rows use integer minor units.

| Scenario | Effort | Working duration | ROM ledger |
|---|---|---|---|
| §9, 24 canonical units | 85–140 person-days | 61–99 days | USD 80,500–131,502.50 |
| INT_B MEDIUM → HIGH | 91–151.5 person-days | 65–107 days | USD 85,226.50–140,484 |
| Engineering rate 800 → 900 USD/day | unchanged 85–140 | unchanged 61–99 | USD 84,536.50–137,919.50 |
| Contingency 15% → 20% | unchanged 85–140 | unchanged 61–99 | USD 84,000–137,220 |
| Currency USD → EUR, no replacement rates | unchanged 85–140 | unchanged 61–99 | unavailable; no FX |
| Missing selected MEDIUM multiplier | full total unavailable; known 7–11 subtotal | unavailable | full total unavailable |

Single-complexity checks price raw [4,6] baselines with 1.25/1.75/2.25 multipliers as [5,7.5]/[7,10.5]/[9,13.5]. An integration is 4.5–7.5 days at MEDIUM and 6–10 at HIGH. INT_A and INT_C retain byte-identical item results when INT_B changes; the nine testing units consume the changed shared predicate. An unchanged predicate preserves testing results.

Baseline role totals A/E/D/C/Q are 9.3–14.6 / 35.1–55.8 / 16.2–27 / 13.6–21 / 10.8–21.6 days. Base cost is USD 70,000–114,350; per-unit contingency totals USD 10,500–17,152.50. The headline rounds outward to USD 80,000–132,000. Dates are 2026-12-28–2027-02-18 from the reviewed illustrative 2026-10-05 start, five-day week and no holidays. Confidence is MEDIUM because the demo baselines are uncalibrated.

## Boundary coverage

- Exact decimal rational arithmetic; selected multiplier once; allocation sums exactly one; no grouping/count/role/contingency double application; per-canonical-unit outward monetary rounding.
- Stable identity, multiple migration boundaries sharing a domain, named environments, duplicate owner/result rejection, target testing, infrastructure fallback, exclusions/retirement and unknown inventory.
- Source and own-unit review withdrawal retain historical results while blocking new use. Shared testing cannot consume ineligible upstream bands. Retiring every primary activity removes discovery/handover labor. Per-unit parameter references remain authoritative.
- Missing baseline/multiplier/productivity/allocation/driver blocks affected effort; missing rate/currency/contingency blocks ROM; missing capacity/minimum/wait/calendar blocks only its relevant schedule outputs. Known partial subtotals are labeled separately.
- Pooled bottleneck capacity, zero and fractional capacity, minima/waits, chronological phases, inactive phases, predecessor validation, holidays/weekends, milestone dates and deadline confidence without effort compression.
- Metric confidence for critical/open questions, provisional assumptions, readiness, calibration, supported-volume thresholds and high contingency. Configuration aliases require reviewed owners; cycles and invalid domains are rejected.
- Assumption-only architecture grounds CLOUD units and estimates without creating requirements or changing requirement coverage. Input manifests include rule/config values, source identity, linked confidence inputs, ownership and membership consumed by scheduling.
- Real command/API flows through accepted Phase 2 proposals, config review/edit, persistence round-trip/reproduction, currency invalidation, concurrency conflict and invalid/scope-gated mutations.
- Browser flows inspect drivers/ledger, change rates/contingency, clear rates, change currency, reload persisted sessions and verify narrow-screen overflow. Desktop and 390px screenshots are captured under test-results/.

## Review and boundaries

Independent read-only review identified retirement ordering, unit review retention, missing schedule ownership inputs and shared-testing eligibility issues. Each was reproduced with a failing regression and fixed; targeted boundary tests passed 25/25 afterward.

MOCK provides semantic proposals only. Numerical modules have no AI-provider import or call. Demo defaults are visible proposals and require explicit review; unknown values never become false/zero. No new dependency or external service was added. Existing source/provenance, section acceptance, AWS-only architecture, MOCK-only behavior and review/persistence boundaries remain in place.

Phase 4 reverse traversal, affected/unaffected classification, field-specific invalidation, selective regeneration/recalculation orchestration, cross-document consistency checks and final quality gate are deliberately deferred. No package/export or live AI functionality was added. The existing repository was untracked on entry and was preserved in place without committing or discarding baseline files.
