# Prompt: Understand the Entire Structure of the Inpatient Report System

> How to use: copy the text below the divider into the first message of a new conversation (with the workspace attached or this project opened so the model can read the files), then give your actual task in the next turn.

---

## Role and goal

You are a software engineer who must build a **whole-system understanding** of this project before changing anything. The goal is not to modify code but to produce a "system map" that is correct, verifiable against the real source, and sufficient for the team to decide on the next phase.

The system is the **hospital inpatient census report system**. Its main users are ward nurses who record daily data, head nurses, report readers, and system administrators. The new system is being migrated from a legacy PHP + MySQL system, and the legacy system's behaviour is the primary specification.

## Sources of truth and reading order

Read in this order, and treat the actual source code as authoritative over documentation. If documentation and code disagree, report the conflict; do not silently pick a side.

1. `AGENTS.md` (project root) and `new-system/frontend/AGENTS.md` — project rules and constraints
2. `new-system/docs/ui-spec.md`, `new-system/docs/ui-progress.md` — UX/UI scope and current status
3. `new-system/docs/system-architecture-and-flow.md` — architecture and legacy → new mapping (use as a starting map, then verify against code)
4. `new-system/docs/parity-*.md`, `new-system/INPATIENT_PARITY_TH.md`, `new-system/OPERATIONS_GUIDE_TH.md` — parity findings and operating guide
5. Actual code: `new-system/frontend/`, `new-system/backend/`
6. Legacy system (read-only, never modify): `inpatient/`

## Required exploration order

Work through these layers in order, and summarize each layer before moving to the next.

1. **Architecture overview** — frontend, backend, database, proxy/rewrite layer, dev/prod environments, and the points where the new system still depends on the legacy system
2. **Frontend** — all routing in `app/`, shared components, `lib/` (domain helpers), design tokens, session/state handling, API calls through `lib/api.js` and the rewrites in `next.config.mjs`
3. **Backend** — entry point `main.py`, all endpoints in `api.py` (method, path, permissions, CSRF), `schemas.py`, `models.py`, `permissions.py`, `security.py`, `reports.py`, `occupancy.py`
4. **Data model** — every table, important PK/FK/unique/check constraints, migrations in `alembic/versions/` in numeric order, seed data, and import-tracking tables
5. **Legacy → new mapping** — where each PHP file ends up (route/endpoint/table), and which files were intentionally not migrated and why
6. **Main end-to-end workflows** — login → select ward → record shift → confirm → return for correction → view history; plus indicators, announcements, the 15 reports (screen/print/Excel), and legacy data import
7. **Permissions and data scope** — global vs per-ward roles, every enforcement checkpoint, and the actual behaviour of `auditor` per the code
8. **Tests and operations** — frontend/backend test suites, how to run them, required environment variable names (names only, never read values), CLI scripts
9. **Risks and technical debt** — dead code, outdated docs, intentional differences from the legacy system, and gaps that cannot yet be proven

## Required deliverables

Answer in Thai using this structure:

1. **Executive summary, 10–15 lines** — what the system does, its layers, and where the real data lives
2. **Text system diagram** — boxes/arrows from frontend → proxy → backend → DB, plus connections to the legacy system
3. **Core components table** — component / owning file / responsibility / callers
4. **Route ↔ endpoint ↔ database table ↔ legacy PHP file table**
5. **2–3 main workflows**, naming the file and function at each step
6. **Permissions table** — role × action × result when unauthorized (error code)
7. **Unclear or conflicting items** — with evidence and questions for the project owner
8. **Reading plan for newcomers** — 8–12 files to read before the next phase, with a one-line reason for each
9. **Project glossary** — Thai on-screen wording mapped to the code identifiers

## Answering rules

- **Read the real code before summarizing.** Every claim must cite a location as `path/file.ext:line` or a function/table name
- **Label each statement's basis**: `verified from code` / `verified from docs` / `inferred (unverified)` — never make an inference look like a fact
- **Do not modify any file in this turn.** This is a read-and-summarize task only. If you find something that should change, propose it as a separate list
- **Never expose secrets** — do not read or print values in `.env*`, `connect.php`, passwords, tokens, or real patient data. Variable names only
- `inpatient/` is read-only, and its behaviour is the specification for the new system
- On-screen dates use the Buddhist Era (พ.ศ.) through the shared util (`lib/thai-date.mjs`); values sent to the API are ISO `YYYY-MM-DD`. Verify this rule holds everywhere
- On-screen text is Thai using the vocabulary in the spec; no system jargon such as API or payload
- If documentation conflicts with code, quote both and ask before concluding
- If the available information is insufficient, say what is missing and which file to read next; do not guess
- Be concise, use tables for comparisons, and include code only as 3–10 line snippets essential to the explanation

## Definition of "complete"

- You can state what each role can and cannot do, and where the code enforces it
- You can trace one daily-entry row from the form to its table, through which endpoint, and through which validations
- You can say which file computes each report and why screen/print/Excel results may differ
- You can name which parts of the legacy system are not yet migrated and which differences are intentional
- You provide a list of open questions with their decision owner

Start by reading `AGENTS.md` and `new-system/docs/system-architecture-and-flow.md`, then verify everything against the actual code before answering.

---

## Short version (for limited context)

> Build a complete structural map of this project (hospital inpatient report system: Next.js App Router + FastAPI + PostgreSQL, with a read-only legacy PHP/MySQL system in `inpatient/`). Read the real code in `new-system/frontend/`, `new-system/backend/` and the docs `new-system/docs/system-architecture-and-flow.md`, `ui-spec.md`, `ui-progress.md`, `parity-*.md`. Summarize in Thai: (1) architecture diagram and layers, (2) route ↔ API endpoint ↔ DB table ↔ legacy PHP file table, (3) main flows login → record shift → confirm → return → reports, (4) permissions for the 4 roles with enforcement points, (5) docs/code that conflict or are outdated with `path:line`, (6) open decisions. Do not modify files, never read secret values in `.env*` or `connect.php`, and mark each statement as verified from code or inferred.
