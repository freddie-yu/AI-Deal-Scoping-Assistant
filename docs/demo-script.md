# Reviewer demo script — 3–5 minutes

Primary seed: **Application Modernization** (modernization). Use Node 24.x, `npm ci`, `npm run build`, `npm start`; open http://127.0.0.1:3001 at **1280 × 900**, 100% zoom. No credentials or external runtime service. Stop that server before running Playwright.

The UI stays on /; the six workspace buttons choose the area. Sessions persist locally and the last ID reloads. Start a fresh seed for each take. Do not overwrite an evaluator's existing session.

| Time | Route / actions | Concise narration / visible evidence |
|---|---|---|
| 0:00–0:20 | Requirements → Start seed session → Analyze with MOCK | “This is a recorded MockAI scenario. Review, changes, estimates, quality and export are real application logic.” Show the input and customer context. |
| 0:20–0:50 | Inspect FR_01 and scale NFR; inspect source panel, provisional assumption and open concurrency question | “Every item keeps its exact source and provenance. Unknown concurrency is not inferred from registered users.” Show source offsets, CUSTOMER_STATED and provisional status. |
| 0:50–1:15 | Review requirements, ASM_01 and Q_01 → Approve reviewed scope | “Review approves the interpretation and use of assumptions. It does not confirm missing customer facts.” |
| 1:15–1:45 | PRD & Scope → Generate → accept individual proposals; Architecture → Generate → accept in displayed dependency order | Show one capability's Why / linked source, coverage and AWS component rationale. “The proposed design stays connected to reviewed requirements.” |
| 1:45–2:10 | Data / Integration / AI → Generate → accept; Estimate → Propose delivery workstreams → accept | Show data governance/integration controls and deterministic processing where AI is inapplicable. “We do not add an AI use case without a requirement.” |
| 2:10–2:40 | Prepare estimation proposals → inspect assumptions/inventory → check acknowledgment → Accept reviewed estimation basis → Calculate | Show person-days, person-weeks, role rates, contingency, milestone and unit ledger. “Demo heuristics produce reproducible planning ranges, not a quote.” |
| 2:40–3:00 | Quality / Final Package → Run quality gate → Package section: Traceability | Show requirement → capability → design → unit/workstream mapping and exact excerpts. |
| 3:00–3:40 | Requirements → scale NFR → Change expected users → 500000 → Record scale change → review requirement and new assumption → approve → Review change impact | “The new target is a planning assumption. Only declared consumers are affected; personas and unrelated workflows remain unchanged.” Expand a reason path. |
| 3:40–4:15 | Regenerate affected content → accept proposals; repeat until complete → Recalculate affected estimate → Run quality gate | Show before/after and preserved items. “No user-count multiplier or invented cloud operating cost is applied.” |
| 4:15–4:50 | Final package → select Change-Impact Summary / ROM / Quality Findings → acknowledge current warnings → Download Markdown | Show 23 sections, current findings, required disclaimer and receipt hash. “Warnings remain visible. A stale revision or blocking error cannot export.” |

Practice the individually reviewed acceptance clicks once. For a concise video, use clearly labeled cuts/time compression during repetitive acceptance; never imply the whole inventory was approved by one click. Target 4:30 with that editing. No in-app tutorial or recording subsystem is required.

## Backup evidence

Run `npm run build` then `npm run test:e2e` (or set PLAYWRIGHT_CHANNEL=msedge for an installed Edge). The flagship test performs all steps through actual download, compares bytes against the preview and checks persisted SHA-256. Screenshots under test-results include:

- phase5-package-desktop.png — exact Markdown source, snapshot hash, disclaimer and export receipt.
- phase5-package-mobile.png — 390px package view and internal table scrolling.
- phase5-findings-mobile.png — narrow quality findings.
- Existing phase4 impact screenshots — changed values, affected/unaffected and reason paths.

Screenshots and downloads may contain customer information. Use supplied seeds for public evidence. They are local generated files, not committed customer data.

If recording fails, retain the screenshots, downloaded Markdown, receipt ID/hash and phase-5-validation.md as backup evidence. A final narrated demo-video file is a submission action; this implementation prepares the script and deterministic sequence but does not fabricate a recording.

## Other seeded evidence

Integration-heavy: named Salesforce/Warehouse interfaces, authentication, retry and synchronization; change one integration's transformation/reconciliation driver and inspect unaffected interfaces.

AI-enabled: support-reply drafting, deterministic alternative, structured output, privacy/evaluation and mandatory human approval; recorded agent-plus-supervisor variant keeps both approvals explicit.

Missing information: absent concurrency/API readiness/rate gives LOW confidence and unavailable ROM; reviewed concurrency 100 and supplied engineering rate update only those inputs. Remaining discovery questions can legitimately keep REVIEW_REQUIRED.


