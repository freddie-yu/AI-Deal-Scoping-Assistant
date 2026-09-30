# Deterministic estimation rules

## 1. Contract and principles

Authority: official challenge specification > [scoring contract](scoring-to-feature-matrix.md) > [design](design.md) > [data model](data-model.md). This document defines the calculation contract; it contains no application implementation. Rule version: `demo-rom-v1`.

The engine consumes reviewed scope, explicit assumptions and validated configuration. AI proposes classifications and workstreams; code computes complexity, effort, capacity-constrained duration, commercials and confidence. Every output carries input references, versions, units, intermediate values and limitations. Identical inputs/rule versions produce identical outputs, including mock mode.

Ranges are planning bounds, not statistical confidence intervals. Missing values never become zero. Reviewed defaults require recorded acceptance and remain labeled assumptions. Calculation detail preserves reproducibility; headline rounding avoids implying that heuristic estimates are precise quotations.

All constants below are **DEMO CONFIGURATION / HEURISTIC DEFAULTS**, not industry benchmarks or recommended market rates. Their values, thresholds, role allocations and phase settings are configurable and versioned.

## 2. Inputs and ownership

| Input | Required basis / use |
|---|---|
| Included capabilities and FR/NFR links | Reviewed, current scope; unique estimation ownership; priorities affect coverage, not automatic effort discounts |
| Integration inventory | Interface IDs, authentication/pattern/transformation drivers; separate readiness and delivery dependencies |
| Data packages | Migration/transformation boundaries, quality/governance/volume drivers; explicit absence permits zero |
| Architecture | Cloud/platform flags per stable environment key, reviewed boundaries, scalability, availability, recovery needs |
| AI use cases | Reviewed use-case IDs, retrieval/orchestration/evaluation/safety needs; explicit absence permits zero |
| Security/testing | Identity/privacy/compliance and verification needs; unknown is different from not applicable |
| Estimation units | Stable unit IDs/types, scoped sources, reviewed inclusion/grounding, per-unit driver refs and configuration refs; data-model §6.1 |
| Workstreams | Unit ownership/grouping, phase, predecessors and milestones; no numerical complexity or baseline override |
| Numerical assumptions | Unadjusted baseline ranges, configured band multipliers, productivity, role shares, minimum phase durations, dependency waits |
| Team/calendar | Role capacities, workweek, start date for dates/calendar duration, holiday list |
| Commercial | Positive role-day rates, one currency/minor-unit scale, explicit contingency |
| Optional | Delivery deadline, explanatory risks/exclusions; no cloud operating-cost input in this version |

User-supplied inputs retain source/configuration provenance. Reviewed assumptions retain assumption IDs and PROVISIONAL/CONFIRMED status. AI-suggested drivers remain proposals until reviewed; its band label is advisory. Quantities from accepted item IDs, flag scores, bands and final results are deterministically derived and engine-owned.

## 3. Work units, complexity and boundaries

Use the nine UnitTypes in §4 and the canonical `EstimationUnitPayload` in [data-model §6.1](data-model.md#61-canonical-estimation-units). Each unit is an independently reviewed ArtifactSection with a stable `AS_n` ID, one workstream owner and exactly one current EstimateItem result. The deduplication key is `(unitType, source identity)`, not the workstream ID or number of requirement links. A domain entity describes the solution, a unit describes one priced activity, and a workstream groups units for planning/presentation; these identities are distinct. Application units exclude connector implementation, migration, AI implementation, infrastructure, specialist security and formal system testing; those have their own units. Development baselines include local unit checks and routine coordination. No extra percentage management, architecture, testing or security surcharge.

A capability unit references one bounded Capability workflow; an integration unit references one Integration interface contract; an AI unit references one AIUseCase. Each migration package/environment uses an immutable application-assigned key plus reviewed boundary and data-domain/architecture references; multiple packages may share a domain, and dev/test/production remain separate units. Security is one solution-wide controls package in this rule version. Discovery/handover each use the session as source. No separate units are automatically created for requirements, personas, data domains or architecture nodes.

Testing uses one TEST_TARGET unit for each included APPLICATION/INTEGRATION/DATA/AI unit, keyed by that target's unit ID. If that set is confirmed empty but the reviewed solution is nonempty, use one solution-scoped fallback testing unit; never include both the fallback and ordinary test units. `inventoryComplete[primary UnitType]` markers in the data model distinguish reviewed empty scope from incomplete inventory; false/unresolved markers suppress full totals, not known unit results/subtotals. Nonempty means at least one included APPLICATION/INTEGRATION/DATA/CLOUD/AI/SECURITY unit, excluding these fixed/test activities themselves. Every active atomic unit has `q_i = 1`; excluded/retired units have 0. Counts in tables are sums of canonical quantities, not editable batch quantities. Unknown applicability blocks the affected quantity; missing review blocks calculation rather than making work disappear. Unit sources, inclusion, driver refs, parameter refs and inherited reviewed requirement/assumption grounding follow data-model §6.1.

Renaming, reordering and display regrouping preserve unit IDs/keys, inputs and ledgers. Split/merge changes require explicit scope review and retired/replacement units; they are not grouping operations. Unit inputs resolve unadjusted base effort, productivity and role shares by configuration reference. Default parameter families use UnitType; group names never select parameters. Parent ownership only locates the workstream and scheduling phase. Each solution total sums distinct canonical unit IDs once, regardless of how many display groups reference them.

Use three visible binary drivers per unit's dimension. Each DriverRef resolves a true/false fact with evidence or reviewed assumption; the testing predicate is the explicit derived exception below. Unknown blocks the affected band unless a human supplies a reviewed value. Score `s = count(true)`: LOW for 0, MEDIUM for 1, HIGH for 2–3. Discovery/handover use the FIXED_LOW band policy without Boolean flags. For every type, select `m_i = configuration.complexityMultipliers[band_i]` exactly once. LOW/MEDIUM/HIGH seed values are 1/1.5/2, explicitly demo heuristics, not formula constants or market standards. A missing/unvalidated selected entry blocks affected effort; even FIXED_LOW must resolve the configured LOW entry. Quantity does not increase the band again.

| Dimension | Three driver flags, in order |
|---|---|
| Functional capability | Branching workflow beyond basic CRUD; offline/realtime behavior; complex permission rules |
| Integration | Custom/federated authentication; asynchronous/event/batch processing; nontrivial transformation or reconciliation |
| Data | Legacy cleanup; nontrivial mapping/transformation; special volume/governance handling |
| Cloud/platform | Explicit autoscaling/performance design; enhanced availability; custom disaster-recovery design |
| AI | Retrieval; multi-step/tool orchestration; enhanced evaluation/safety beyond baseline human review |
| Security | Federated/multi-tenant identity; sensitive-data/privacy controls; formal compliance evidence |
| Testing | Cross-system end-to-end verification; any HIGH integration/data/AI unit; dedicated performance/security verification |

Boolean judgments remain inspectable; arithmetic does not prove them correct. Basic backup, baseline AI evaluation and human review are included in the relevant baseline, even when an enhancement flag is false. Readiness is an uncertainty input, not an extra complexity multiplier. User count alone never proves concurrency, database size or a cloud-cost amount; reviewed architecture translates scale requirements into explicit flags.

Testing's HIGH predicate is true if any included INTEGRATION/DATA/AI unit band is HIGH, unresolved if none is HIGH but a band/inventory is unknown, otherwise false. All testing units explicitly consume this predicate and the same two reviewed solution-level testing flags. Register substantive watches on source bands, consumed inclusion/lifecycle and collection membership; check reviewed-input eligibility separately before NEW calculation. Propagate numerical changes only when the resolved predicate/driver values change; review-status transitions alone do not stale existing results. Thus a MEDIUM→HIGH integration may reprice every shared testing unit, while an edit leaving the predicate unchanged does not. Changing a band multiplier alone does not change a band or this predicate. Shared flags are intentional dependencies, not accidental workstream-wide invalidation.

## 4. Demo baselines, roles and configuration

Baseline units are **person-days per unit**. `baseEffort[UnitType]` stores the unadjusted low/high range, independent of complexity. `complexityMultipliers = { LOW: 1, MEDIUM: 1.5, HIGH: 2 }` is the explicitly reviewed, versioned demo configuration; edits change that table, never the raw baseline. Define `d = 5 person-days/person-week`; presentation converts totals to person-weeks. All example productivity factors are `p = 1`; larger p means proportionately less labor. Baselines are before complexity/productivity adjustments.

| Default workstream / UnitType | Canonical units (each included quantity 1) | Unadjusted base low–high days | Band source | Role percentages | Phase |
|---|---|---:|---|---|---:|
| Discovery & architecture / DISCOVERY | One solution unit | 5–8 | Fixed LOW | A 100 | 1 |
| Application / APPLICATION | One per included capability | 4–6 | Functional, individually | A 10, E 90 | 3 |
| Integration / INTEGRATION | One per included interface | 3–5 | Integration, individually | E 80, D 20 | 3 |
| Data / DATA | One per included migration/transformation package | 4–7 | Data, individually | D 100 | 3 |
| Cloud/deployment / CLOUD | One per named environment | 2–3 | Cloud, individually | C 100 | 2 |
| AI / AI | One per included AI use case | 5–8 | AI, individually | D 100 | 4 |
| Security / SECURITY | One solution package when reviewed controls apply | 3–5 | Security | A 20, C 80 | 2 |
| Testing & hardening / TESTING | One per application/integration/data/AI unit; solution fallback when required | 1–2 | Shared testing flags | E 20, Q 80 | 5 |
| Handover / HANDOVER | One solution unit | 2–3 | Fixed LOW | A 50, C 50 | 6 |

Cloud/deployment includes environment provisioning and release preparation; final release/handover follows validation. Shared regression testing uses a solution-wide band, so one changed integration can affect that shared activity. This is deliberate, visible coupling.

| Role | Included responsibilities | USD/person-day | Capacity: person-days/working-day |
|---|---|---:|---:|
| A | Architect/business analysis | 1,000 | 0.5 |
| E | Application/integration engineering | 800 | 2 |
| D | Data/AI engineering | 900 | 1 |
| C | Cloud/security engineering | 850 | 1 |
| Q | QA | 600 | 1 |

Shares must total exactly 100% per unit's referenced allocation template; absent roles have zero shares. Workstreams sum allocated unit effort without allocating it again. Role-day rates apply to allocated effort, not elapsed attendance. Capacity is already net availability; do not multiply it by productivity again. Combined role labels are a demo staffing simplification, not a claim that one person supplies every specialty.

Other reviewed defaults: USD with 2 minor-unit digits; contingency 15%; minimum active phase duration 2 working days; no external waits; Monday–Friday calendar; no holidays; start 2026-10-05. No taxes, margin, travel, licenses, AI consumption or cloud operating costs are included. The calendar and rates are illustrative; no real deadline commitment follows.

## 5. Effort, role allocation and range propagation

For canonical unit ID i and bound b ∈ {L,H}, derived quantity `q_i`, unadjusted baseline `B_i,b`, configured multiplier `m_i = complexityMultipliers[band_i]`, productivity `p_i` and role share `a_i,r`:

`E_i,b = q_i × B_i,b × m_i / p_i` person-days.

`E_i,r,b = E_i,b × a_i,r`; workstream/role/solution effort is the sum of applicable item results. `PW_b = Σ_i E_i,b / d`.

Use one EstimateItem per canonical unit ID; batch identical inputs for display only, preserving individual monetary rounding and member IDs. There is exactly one complexity adjustment, inside `E_i,b`; role allocation, workstream aggregation, scheduling and commercials consume that result without another multiplier. There is no multiplication by linked requirement count. Testing/security activities are distinct development work. Fixed discovery/handover units are zero when the reviewed solution is empty; an empty scope is not a valid final solution package. A nonempty infrastructure-only solution still has one portfolio-testing unit.

Keep exact decimal/rational intermediates; never feed rounded presentation values into subsequent calculations. Nonnegative quantities/shares and positive active baselines/multipliers/productivity make operations monotone. Reject reversed input ranges rather than swapping endpoints. Missing items make the relevant full total null; separately show the known subtotal and missing IDs. Interpret validated decimal inputs as exact base-10 values and reconstruct calculations from the versioned input ledger, not rounded serialized results.

## 6. Timeline and milestones

Follow design.md: sequential phases, parallelizable work within a phase. Phase names: discovery approved → foundation ready → application/data integrated → AI ready → validation complete → handover complete. Inactive phases are skipped. If a true predecessor is inside the same phase, split/reassign phases before calculation; reject backward/cyclic dependencies. No staffing optimizer is introduced.

For each phase k, sum distinct canonical unit role effort first: `W_k,r,b = Σ_(i in k) E_i,r,b`, resolving the phase through each unit's workstream owner. Display grouping supplies no extra work or allocation. With capacity `c_r` and minimum duration `f_k`, active execution duration is:

`D_k,b = ceil(max(f_k, max_(r: W>0)(W_k,r,b / c_r)))` working days.

This pools shared-role demand instead of pretending simultaneous workstreams each have the entire team. Independent role tasks may proceed concurrently; divisible work and no unmodeled intra-phase handoffs are explicit assumptions. Insufficient information requires more phases or a limitation.

Phase start `S_k,b = F_previous,b + w_k,b`; finish/milestone `F_k,b = S_k,b + D_k,b`, starting from zero. Wait `w_k` is a nonnegative reviewed integer working-day range at the phase barrier, counted once. Multiple independent prerequisites combine by maximum wait; sequential prerequisites must use separate phases. Waits add duration, not paid labor. The critical path is the chain of active phase barriers; show the capacity-limiting role per phase. This intentionally conservative schedule does not overlap phases.

Map the final working-day count onto the configured calendar. Start must be a working date; the first execution day counts as day 1. Finish is the Nth working date; elapsed calendar days include start and finish. Holidays/weekends affect duration/dates, not effort. Without a start/calendar, report working days but block dated/calendar outputs. Deadline classification: before earliest finish = INFEASIBLE; before latest finish = AT_RISK; otherwise WITHIN_RANGE. Never compress effort to satisfy a deadline.

Use ISO date-only calendar arithmetic, not timezone-sensitive elapsed hours. Validate at least one working weekday, valid holiday dates, positive person-week length and nonnegative integer phase minima/waits. Unknown waits suppress the full schedule; a known execution subtotal is not a finish-date forecast.

## 7. Commercials and precision

For each canonical unit ID/role, multiply its already complexity-adjusted, unrounded person-days by the configured integer minor-unit daily rate; there is no commercial complexity factor. Round low cost down and high cost up to one minor unit. Sum role costs into unit subtotal, then compute unit contingency at c% with the same outward rounding; unit ROM is subtotal plus contingency. Workstream and solution subtotal/contingency/ROM sum those unit amounts by distinct unit ID, never rounded display-group values. Do not apply contingency again to the total. Per-unit rounding can differ from rounding a global percentage by a few minor units; the ledger is authoritative. Regrouping must preserve all ledger rows and exact effort/ROM totals.

All active rates must match the selected currency. Currency change invalidates rates until explicitly replaced/confirmed in that currency; there is no FX conversion or automatic relabeling. Zero/negative rates are invalid in this minimal paid-labor model. No numeric cloud-cost estimate is invented.

Headlines round outward: effort to 0.1 person-week; elapsed calendar time to whole weeks; ROM to 1,000 major currency units. Audit views show exact ledger cents and working days, explicitly labeled arithmetic detail. These display quanta are configurable; they never alter calculations.

## 8. Confidence and missing inputs

Compute per-unit and per-output confidence using these ordered rules; each workstream reports its lowest included unit confidence, and overall is the lowest across included units, timeline and ROM:

1. **LOW** if any relevant calculation is unavailable, critical question remains open, assumptions conflict, external readiness is unconfirmed, security needs/scale/data volume are materially unknown, a requested deadline is unknown/INFEASIBLE/AT_RISK, or solution interface count exceeds the reviewed calibration limit (demo 20).
2. Otherwise **MEDIUM** if any relevant noncritical question, provisional assumption or uncalibrated demo baseline remains, or contingency exceeds the demo review threshold of 50%.
3. Otherwise **HIGH**. High means fewer identified limitations, not guaranteed accuracy.

Do not average away weak inputs. Excluded/inapplicable scope does not lower confidence. Rates missing only lower ROM/overall confidence; they do not erase effort. Demo baselines stay MEDIUM even after approval because approval is not calibration evidence.

“Relevant” means a consumed input or a linked open question affecting an included unit/output. Material unknown scale/data/security means an UNRESOLVED value consumed by an included unit, or a linked HIGH-priority question; it is not an LLM confidence judgment. Store each triggered rule and related input in limitations.

| Missing/uncertain input | Policy / affected output |
|---|---|
| Unreviewed/stale scope, ownership, quantity, unresolved conflicting values | BLOCK new affected calculations; no silent selection. Review-only ineligibility retains existing CURRENT results/basis; substantive changes still stale affected results |
| Required driver | BLOCK its band/effort, or USE_REVIEWED_DEFAULT from an explicit assumption; never default false |
| Baseline/multiplier/productivity/allocation | USE_REVIEWED_DEFAULT from visible seed configuration; otherwise BLOCK affected effort |
| Rate/currency | BLOCK affected ROM/full ROM; retain effort/timeline and labeled priced subtotal |
| Contingency | USE_REVIEWED_DEFAULT (15% demo) or BLOCK ROM; explicit 0% is valid |
| Capacity/minimum duration/calendar | USE_REVIEWED_DEFAULT or BLOCK affected schedule; effort remains |
| External readiness | DEGRADE_CONFIDENCE to LOW; unknown delay BLOCKS full schedule unless a reviewed wait range is supplied |
| Scale, data volume/migration, security details | DEGRADE_CONFIDENCE to LOW; if needed to decide a driver, BLOCK that band until a reviewed assumption supplies it |
| Deadline | Optional absence has no penalty; a required but unknown deadline lowers confidence, not computed duration |

BLOCK means unavailable calculation, not necessarily blocked document export. A complete package can show null results, gaps and warnings under REVIEW_REQUIRED; invalid/fabricated totals, stale artifacts or structural errors trigger the design's BLOCKED gate. Unknown readiness does not secretly widen labor or add contingency. A human may explicitly revise a baseline/wait range; record that new assumption.

## 9. Worked example

Reviewed scope: four capabilities, three interfaces, one migration package, three environments, one AI use case and applicable security controls. Every dimension has flags `[1,0,0]` except data `[0,1,0]` and security `[0,1,0]`; therefore all variable dimensions are MEDIUM. No HIGH integration/data/AI exists, so testing's second flag is false. Readiness is confirmed, no questions remain, waits are zero, and all §4 configuration is explicitly accepted. Baselines remain uncalibrated demo assumptions.

All six primary `inventoryComplete` markers are explicitly validated true for this example. This inventory has 24 canonical units: 4 application, 3 integration, 1 data, 3 cloud, 1 AI, 1 security, 9 testing, 1 discovery and 1 handover. Each has quantity 1 and a separate result/rounding boundary. Multiplications by counts below abbreviate sums for display; they do not create batch calculation identities.

| Workstream | Calculation in person-days | Role effort low–high |
|---|---|---|
| Discovery | 1 × [5,8] × 1 = [5,8] | A 5–8 |
| Application | 4 × [4,6] × 1.5 = [24,36] | A 2.4–3.6; E 21.6–32.4 |
| Integration | 3 × [3,5] × 1.5 = [13.5,22.5] | E 10.8–18; D 2.7–4.5 |
| Data | 1 × [4,7] × 1.5 = [6,10.5] | D 6–10.5 |
| Cloud | 3 × [2,3] × 1.5 = [9,13.5] | C 9–13.5 |
| AI | 1 × [5,8] × 1.5 = [7.5,12] | D 7.5–12 |
| Security | 1 × [3,5] × 1.5 = [4.5,7.5] | A 0.9–1.5; C 3.6–6 |
| Testing | 9 × [1,2] × 1.5 = [13.5,27] | E 2.7–5.4; Q 10.8–21.6 |
| Handover | 1 × [2,3] × 1 = [2,3] | A 1–1.5; C 1–1.5 |
| Total | **85–140 person-days = 17–28 person-weeks** | Shares sum to the same total |

| Role | Total days | Rate USD/day | Cost USD low–high |
|---|---:|---:|---:|
| A | 9.3–14.6 | 1,000 | 9,300–14,600 |
| E | 35.1–55.8 | 800 | 28,080–44,640 |
| D | 16.2–27 | 900 | 14,580–24,300 |
| C | 13.6–21 | 850 | 11,560–17,850 |
| Q | 10.8–21.6 | 600 | 6,480–12,960 |
| Subtotal | | | **70,000–114,350** |
| Contingency, 15% | | | **10,500–17,152.50** |
| ROM ledger | | | **80,500–131,502.50** |

Each item contingency is an exact cent amount here, so summing item contingency equals 15% of the solution subtotal. Headline ROM is **USD 80,000–132,000**, with exact arithmetic available in the ledger.

For one MEDIUM interface, E receives 3.6–6 days and D 0.9–1.5 days: subtotal `3.6×800 + 0.9×900 = 3,690` to `6×800 + 1.5×900 = 6,150`; contingency 553.50–922.50; ROM 4,243.50–7,072.50. The grouped integration row comprises three identical canonical items.

| Phase | Limiting role workload ÷ capacity | Days after ceiling/minimum | Cumulative milestone offsets |
|---|---|---|---|
| 1 | A [5,8] / 0.5 | 10–16 | 10–16 |
| 2 | C [12.6,19.5] / 1 | 13–20 | 23–36 |
| 3 | E [32.4,50.4] / 2 | 17–26 | 40–62 |
| 4 | D [7.5,12] / 1 | 8–12 | 48–74 |
| 5 | Q [10.8,21.6] / 1 | 11–22 | 59–96 |
| 6 | A [1,1.5] / 0.5 | 2–3 | **61–99** |

For example, phase 3 also has A [2.4,3.6]/0.5 and D [8.7,15]/1; both are below E's bottleneck. Starting Monday 2026-10-05 with the illustrative no-holidays calendar, finish dates are **2026-12-28–2027-02-18**, or **85–137 elapsed calendar days**. Headline duration: **12–20 calendar weeks**. Confidence: **MEDIUM**, because demo baselines are uncalibrated; no hidden contingency or probabilistic guarantee is implied.

## 10. One changed assumption

Label the three interface sources INT_A, INT_B and INT_C (fixture aliases, not extracted requirement IDs), with unit IDs AS_101, AS_102 and AS_103. For INT_B / AS_102 only, the reviewer changes “no reconciliation” to “reconciliation required.” Its flags become `[1,0,1]`, hence HIGH; INT_A and INT_C remain MEDIUM with their unit/result IDs, input hashes, effort and priced ledger rows unchanged. Readiness remains confirmed. All nine testing units explicitly consume the shared HIGH predicate, so their flags become `[1,1,0]` and their band becomes HIGH. No quantities, rates or allocations change; no management surcharge is introduced.

| Changed calculation | New result |
|---|---|
| INT_B / AS_102 | [3,5] × configured HIGH 2 = 6–10 days, previously 4.5–7.5 |
| Integration total | Two MEDIUM plus one HIGH = 15–25 days |
| Shared testing | 9 × [1,2] × 2 = 18–36 days |
| Solution effort | 85–140 + [1.5,2.5] + [4.5,9] = **91–151.5 days = 18.2–30.3 person-weeks** |
| Role totals A/E/D/C/Q | 9.3–14.6 / 37.2–59.6 / 16.5–27.5 / 13.6–21 / 14.4–28.8 days |
| Role costs A/E/D/C/Q | 9,300–14,600 / 29,760–47,680 / 14,850–24,750 / 11,560–17,850 / 8,640–17,280 USD |
| Subtotal; contingency | **74,110–122,160**; **11,116.50–18,324** USD |
| ROM ledger; headline | **85,226.50–140,484**; **USD 85,000–141,000** |
| Phase 3 | ceil([33.6,52.4]/2) = 17–27 working days |
| Phase 5 | ceil([14.4,28.8]/1) = 15–29 working days |
| Total schedule | 10–16 + 13–20 + 17–27 + 8–12 + 15–29 + 2–3 = **65–107 working days** |

New finish dates: **2027-01-01–2027-03-02**, 89–149 elapsed calendar days, headline **12–22 weeks** under the same illustrative calendar. Confidence remains **MEDIUM**: more known work does not itself create uncertainty. Unchanged: discovery, application, data, cloud, AI, security, handover effort/cost and the other two integration items. Later milestone offsets move even where phase execution durations stay unchanged.

## 11. Recalculation and edge cases

All changes invalidate the gate/export snapshot. Dirty means a pending edit; accepting consumed-input changes marks the affected unit/result slices stale. Numerical recalculation uses field-level InputRefs keyed by unit ID; it does not rerun AI or replace unrelated reviewed units/sections. Recompute driver predicates before propagating numerical changes and stop when their values are unchanged. A derived workstream total has no reverse dependency into its other units.

| Change | Dirty numerical inputs/results | Preserved |
|---|---|---|
| Priority | Coverage/confidence; schedule only after an explicit phase-order edit | Effort/cost based on unchanged scope |
| Inclusion | Owned quantities, testing count, active phases, role/ROM totals | Unrelated unit calculations |
| Users | Reviewed scale flags/assumptions; linked cloud/testing/delivery | No automatic user-count multiplier; unrelated units |
| Integration complexity | Its reviewed flags/item and testing HIGH predicate; role/schedule/ROM aggregates | Other interfaces/application |
| Complexity multiplier entry | Units currently selecting that band, their role/cost/schedule totals | Raw baselines, driver flags/bands, quantities and units selecting other bands |
| Display grouping/name/order | Group projections only | All canonical unit IDs, numerical inputs, effort and ROM ledgers |
| Security need | Security flags and linked implementation/testing scope | Unrelated functionality |
| Deadline | Feasibility/confidence only | Computed effort, duration, cost |
| Rate | Matching role cost lines and commercials/confidence | Effort, allocations, timeline |
| Contingency | Contingency/ROM only | Base costs, effort, timeline |
| Currency | Rate compatibility, all commercial output | Physical effort/timeline |

Zero integrations/no AI produce zero applicable unit effort without asking irrelevant drivers/rates; skip inactive phases. Unknown inventory is not zero. Missing rate card blocks ROM, not labor. Missing security information cannot silently disable security: require reviewed flags/assumptions and show LOW confidence while materially unknown. More than 20 interfaces remains linearly calculated but LOW confidence; no hidden cap/discount.

Reject negative quantities, duplicate owners, noninteger unit counts, nonfinite values, nonpositive active baselines, reversed ranges, missing allocation shares, shares not summing to one, nonpositive productivity, negative capacity and nonpositive used-role rates. Zero capacity for a used role makes its schedule unavailable; unused roles need no capacity/rate. Reject contingency outside 0–100%; above 50% requires review warning and MEDIUM cap. These configurable guardrails are demo policy. Conflicting assumptions block affected outputs; impossible deadlines remain visible without changing estimates. Missing required flags never resolve through the AI's band label.

## 12. Cross-document audit

EstimationUnit owns canonical source identity, inclusion/quantity, driver refs/derived band and parameter references under data-model §6.1. EstimateItem references one unit and stores its effort, role allocation results, monetary ledger and standalone capacity-duration; do not sum standalone durations. Workstream owns planning fields and projects membership/totals from units, with no calculation identity or complexity override. EstimateSummary owns pooled phase duration/milestone/calendar outputs. InputRef watches consumed configuration fields (including only the selected multiplier entry), substantive membership/grounding and rule versions; current review eligibility is a separate preflight/acceptance guard, not a freshness input. Confidence limitations and missingInputs retain related node IDs; null results remain distinguishable from valid zero.

The data model names the required unit, calendar, phase-policy, calibration and monetary-ledger fields. Existing provenance/review records remain inputs; narrative/context records are not counted as extra labor. The design's sequential phase policy and minor-unit accounting remain intact. The two numerical examples retain their prior totals under the unchanged demo values. T5–T9 must cover the following specification acceptance cases; these are requirements for future implementation tests, not a claim that application tests already exist.

### Targeted acceptance cases

| Case / test contract | Required assertion |
|---|---|
| U1 — identity and membership (T2/T5/T9) | Distinct migration packages sharing one DataDomain and three named environments receive distinct stable unit IDs. Rename/reorder/move display groups without changing IDs, inputs or results; reject duplicate `(unitType, source identity)` owners and duplicate current results. Repeated requirement links never add quantity. |
| U2 — selective change (T5/T6/T9) | Reproduce §10 with INT_A/B/C initially MEDIUM. Only INT_B and the nine explicitly dependent testing units change numerical ledgers; INT_A/C and all other units retain results/revisions. Integration effort moves [13.5,22.5]→[15,25], solution effort [85,140]→[91,151.5], ROM USD 80,500–131,502.50→85,226.50–140,484. Recompute aggregate sums without regenerating/repricing unaffected units. |
| U3 — grouping and rounding (T5/T6) | Focused two-unit fixture: each quantity 1, unadjusted effort [1,1], LOW multiplier 1, productivity 1, one role at 100%, rate 1 minor unit/day, contingency 15%, all explicitly reviewed. Summed effort is [2,2] and ROM [2,4] minor units after per-unit rounding. One group, two groups and reordered/overlapping views all yield the same unique-unit total, never [2,3] from batch contingency rounding. |
| C1 — configured multipliers (T5/T6/T9) | Independently edit LOW 1→1.25, MEDIUM 1.5→1.75 and HIGH 2→2.25 in a fixture containing all bands. A selected unit with base [4,6], quantity/productivity 1 yields [5,7.5], [7,10.5] or [9,13.5] respectively. Other-band units retain results; raw baseline records/hashes and driver bands stay unchanged. FIXED_LOW discovery/handover also use the configured LOW value. |
| C2 — one band transition (T5/T9) | With default multipliers, INT_B's unchanged raw base [3,5] transitions MEDIUM→HIGH: [4.5,7.5]→[6,10], never [9,15]. Verify the ledger contains one selected multiplier and one effort adjustment. |
| C3 — aggregation and commercials (T5/T6) | Two MEDIUM integrations plus INT_B HIGH sum to [15,25] days; no group multiplier or second role allocation. INT_B role days E [4.8,8], D [1.2,2], subtotal USD 4,920–8,200, contingency USD 738–1,230, ROM USD 5,658–9,430. Commercials multiply these allocated days by rates only, not by complexity again. |
| C4 — missing inputs and ordered bounds (T5/T8) | A missing/unvalidated selected multiplier yields null affected effort/ROM with the entry identified, never a hidden 1/1.5/2. Missing other-band entries do not erase known unit results. Reject nonpositive/nonfinite multipliers and reversed baselines; positive factors preserve low≤high, and per-unit role days sum to unit effort. |
| U4 — dependency boundaries (T8/T9) | Excluding a source excludes its implementation/test units; unknown inventory cannot become zero; an infrastructure-only solution gets exactly one fallback test unit. A fact edit that leaves the shared testing predicate unchanged does not reprice testing. Reassigning a phase may change schedule, but display regrouping and phase edits never change labor/ROM. |

## Formula summary

For each bound b independently, use exact decimal/rational arithmetic until stated rounding. Seed values are those in §§3–4; user changes are versioned, validated and reviewed.

```text
Let i be a canonical EstimationUnit ArtifactSection ID, never a display-group ID.
Require eligible scope, unique (unitType, source identity) units and reviewed inputs.
Resolve configuration aliases; reject conflicts/cycles; never infer missing values.
Inactive unit: effort/cost = 0; skip its driver/rate requirements.
Active unit: missing mandatory value => null affected metric + missingInputs.

s_i = sum(three resolved Boolean flags) for THREE_FLAGS units
band_i = LOW if s_i=0; MEDIUM if s_i=1; HIGH if s_i=2 or 3
FIXED_LOW discovery/handover: band_i = LOW (no score required)
m_i = resolveValidated(configuration.complexityMultipliers[band_i])
baseline_i,b = resolveValidated(unit_i.baseEffortRef)[b] // unadjusted
q_i = 1 for each included eligible atomic unit; 0 if excluded/retired
testing targets = included APPLICATION/INTEGRATION/DATA/AI unit IDs
Create/reuse one TESTING unit per target, or the single solution fallback per §3.
testing.flag2 = ANY_INCLUDED_HIGH with the unresolved semantics in §3
E_i,b = q_i * baseline_i,b * m_i / productivity_i
roleDays_i,r,b = E_i,b * share_i,r; sum_r share_i,r = 1
E_workstream,b = sum_distinct_member_ids(E_i,b)
PW_total,b = sum_distinct_included_ids(E_i,b) / daysPerPersonWeek
Never multiply workstream/solution aggregates or commercial rows by complexity.
All monetary rounding uses canonical unit IDs; display grouping never changes results.

W_phase,r,b = sum(roleDays_i,r,b for items in phase)
standalone_i,b = ceil(max_r(roleDays_i,r,b / capacity_r))
D_phase,b = ceil(max(minPhaseDays, max_r(W_phase,r,b / capacity_r)))
Skip phases with no included work; use only roles with positive work.
start_phase,b = previousFinish_b + reviewedWait_phase,b
finish_phase,b = start_phase,b + D_phase,b; initial previousFinish=0
milestone_phase,b = finish_phase,b; N_b = final finish_phase,b
finishDate_b = N_b-th working date, counting configured start as day 1
calendarDays_b = finishDate_b - startDate + 1 (date difference in calendar days)
Empty solution: zero labor/cost/duration, no finish date; final-package gate blocks empty scope.
Deadline < earliestFinish => INFEASIBLE; < latestFinish => AT_RISK; else WITHIN_RANGE

round_L(x)=floor(x); round_H(x)=ceil(x)
cost_i,r,b = round_b(roleDays_i,r,b * rate_r_minorUnitsPerDay)
base_i,b = sum_r cost_i,r,b
cont_i,b = round_b(base_i,b * contingencyPercent / 100)
rom_i,b = base_i,b + cont_i,b
base_total,b = sum_i base_i,b; cont_total,b = sum_i cont_i,b
rom_total,b = base_total,b + cont_total,b
Any missing included contribution or incomplete primary inventory => full total null;
show known subtotal separately and identify missing inventory/input refs.

confidence = LOW if any relevant LOW trigger in §8;
             else MEDIUM if any relevant provisional/noncritical/demo limitation
                  or contingency > configured review threshold (demo 50%);
             else HIGH
overallConfidence = minimum of included unit/timeline/ROM confidence
headline_L(x,quantum)=floor(x/quantum)*quantum
headline_H(x,quantum)=ceil(x/quantum)*quantum
Use quanta 0.1 person-week, 1 calendar-week, 1000 major currency units.

On change: traverse consumed-field dependencies; recalculate affected metric slices;
merge with unchanged results; recompute summaries/confidence/gate for current revision.
Never accept final effort, duration, confidence, rates or ROM from AI output.
```
