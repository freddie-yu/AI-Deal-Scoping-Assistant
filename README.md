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

For full implementation, validation, architecture and controlled-change details, see the repository documentation under `docs/`.
