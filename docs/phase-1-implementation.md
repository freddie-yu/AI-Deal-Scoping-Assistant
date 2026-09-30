# Phase 1 implementation record

The approved design and user-provided Phase 1 sequence govern this change. Baseline: 22/22 Vitest tests pass. Work stays in the existing checkout, whose Phase 0 files are untracked.

1. Preserve exact UTF-16 source offsets and immutable UTF-8 hashes; allocate document/section IDs from session counters. Test whitespace, CRLF, Unicode, replacement and invalid evidence.
2. Extend the shared provider pipeline with closed analysis candidate schemas, source and temporary-reference validation, and application-owned canonicalization. Keep the foundation fixture working. Reject unsupported input without losing it.
3. Add revision-checked application commands for ingestion, analysis, requirement edits/type replacement, assumption validation, question answers and review. Retain a bounded before-edit change record; do not traverse downstream invalidation.
4. Derive review readiness and bind approval to a deterministic scope fingerprint. Reviewed open questions are visible warnings; unreviewed items and unvalidated assumptions block approval.
5. Implement the Requirements workspace and source inspection, retaining the six-area shell. Downstream areas expose eligibility but cannot generate artifacts.
6. Add four compact analysis fixtures and structured semantic expectations; verify positive cases and shape-valid semantic mutations. Add a browser evaluator journey and regression checks.
7. Update README and run typecheck, tests, build, tests and Playwright.

Review focus: stale provider completion, unsupported direct assertions/edits, source replacement without retargeting, ID reuse/type correction, and approvals surviving changes incorrectly. Each receives automated regression coverage.

Independent review additionally identified structured fact edits retaining direct provenance and changed assumptions inheriting confirmation. Both paths now have regression tests and explicit validation/reclassification requirements. The React assumption editor clears old confirmation when the claim changes; UNVALIDATED remains a deliberate choice.

Compatible schema extensions: optional requirement basis; question subject/basis/source anchors; typed facts embedded in existing analysis Narrative sections for finite semantic selectors. No new top-level fact store or downstream generator was introduced.

Browser test setup owns a direct Node server process and stops that exact child, avoiding Windows taskkill tree teardown restrictions. The original smoke test remains intact.
