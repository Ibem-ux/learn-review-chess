# Learn Review Chess — Project Context

> **Warning:** `PROJECT_CONTEXT.md` is a maintained project guide, not a substitute for inspecting current code and Git state.

*Snapshot Last Verified:* Working tree includes full-game quick-pass analysis, ReviewBoard integration, depth-10 / MultiPV-3 configuration, and verified Playwright smoke coverage.

---

## Purpose
Learn Review Chess is a modern, open-source web application designed to help chess players review completed games, understand tactical and positional mistakes, and systematically improve their chess skills. The application aims to provide accessible, deep game insights without requiring paid subscriptions or locked proprietary platforms.

## Core User Journey
1. **Game Import & Selection**: A player imports a completed game by either pasting raw PGN text or fetching recent completed games via their Chess.com username.
2. **Interactive Game Review**: The player navigates through the imported game step-by-step using a read-only board (`ReviewBoard`) with an interactive timeline, ply counter, move status indicator, and move history summary.
3. **Freeform Study & Practice**: In the absence of an imported game (or when exploring variations), the player uses `StudyBoard` for freeform move experimentation with full legal move validation, move history (SAN pairs), undo, position reset, and board flipping.
4. **Future Learning Journey**: In upcoming iterations, automated Stockfish evaluation will annotate moves with classification labels (e.g. Brilliant, Blunder), provide explanations, and generate personalized interactive puzzle drills from the user's mistakes.

## Technology Stack
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Library & Language**: React 19, React DOM 19, TypeScript 5
- **Styling**: Tailwind CSS v4 with dark mode support
- **Chess Domain Engine**: `chess.js` v1.4.0 (handles move rules, validation, PGN parsing, FEN generation)
- **Board Component**: `react-chessboard` v5.10.0
- **Testing**: Vitest v4.1 with React Testing Library (`@testing-library/react`), `@testing-library/jest-dom`, and JSDOM environment
- **Code Quality**: ESLint 9 with `eslint-config-next`

## Architecture
The application follows a modular, feature-based layout with strict client/server boundaries:

```
src/
├── app/
│   ├── api/chesscom/          # Next.js Server Route Handlers proxying Chess.com PubAPI
│   │   └── [username]/
│   │       ├── archives/      # GET player archive URLs
│   │       └── games/[year]/[month]/ # GET monthly player games
│   ├── globals.css            # Tailwind & global styles
│   ├── layout.tsx             # Root HTML/font layout
│   └── page.tsx               # Main application shell with header & navigation
└── features/
    ├── chess/                 # Core chess domain logic & UI components
    │   ├── engine.ts          # Engine types, score normalization, and analysis limits
    │   ├── engine-controller.ts # State-machine-based Stockfish controller
    │   ├── engine-worker-factory.ts # Browser Worker factory for Stockfish
    │   ├── use-engine-analysis.ts # Hook for EngineController lifecycle and single-position request correlation
    │   ├── uci.ts             # UCI command builders and message parser
    │   ├── game.ts            # chess.js wrapper (createGame, move, undo, history)
    │   ├── pgn.ts             # Robust PGN parser (parsePgn, normalizeHeader)
    │   ├── timeline.ts        # Review timeline builder (buildTimeline, getTimelineStep)
    │   ├── quick-pass-planner.ts  # Full-game quick-pass job planner
    │   ├── quick-pass-runner.ts   # Sequential full-game quick-pass runner
    │   ├── use-quick-pass-analysis.ts # Hook owning Worker/controller lifecycle for full-game analysis
    │   ├── full-game-analysis-panel.tsx # Full-game analysis panel integrated into ReviewBoard
    │   ├── StudyBoard.tsx     # Interactive freeform chess board component
    │   ├── ReviewBoard.tsx    # Read-only timeline review board component
    │   ├── analysis-panel.tsx # Manual, structurally gated single-position analysis UI
    │   ├── ReviewWorkspace.tsx# Combined workspace managing imports, state & active board
    │   └── __mocks__/         # Mock implementation for react-chessboard in UI tests
    └── game-import/           # External game import module
        ├── chesscom.ts        # Typed client for Chess.com PubAPI
        └── ChesscomGamePicker.tsx # UI component for picking games via username
```

### Architectural Decisions
- **Separation of Concerns**: Pure domain logic (`game.ts`, `pgn.ts`, `timeline.ts`, `chesscom.ts`) is completely decoupled from React and tested independently.
- **Client Components**: Interactive UI components (`StudyBoard`, `ReviewBoard`, `ReviewWorkspace`, `ChesscomGamePicker`) use `"use client"`.
- **Backend API Proxies**: External requests to `api.chess.com` are proxied through internal Next.js Server API routes (`src/app/api/chesscom/...`) to prevent browser CORS issues, apply HTTP caching, and enforce consistent error responses.
- **Engine Infrastructure**: Stockfish runtime assets, UCI command/parsing utilities, engine types, EngineController, Worker integration, quick-pass planner/runner, and full-game analysis panel are implemented. Analysis is structurally gated for eligible ReviewBoard timelines. The existing manual AnalysisPanel remains available as reusable single-position infrastructure.

## Implemented Features
All features listed below have been verified in the codebase:
- **Interactive StudyBoard**: Freeform interactive chess board powered by `createGame()` in `src/features/chess/game.ts`.
- **Legal and illegal move handling**: Legal moves update position FEN and history; illegal moves return detailed error result objects (`ChessMoveFailure`) without corrupting state.
- **Undo, Reset, Flip, and SAN history**: `StudyBoard` controls allow undoing plies, resetting to initial position FEN, flipping board orientation (White/Black), and displaying move history formatted as numbered SAN pairs (e.g., `1. e4 e5`).
- **PGN parsing**: `parsePgn()` in `src/features/chess/pgn.ts` parses raw PGN text into structured headers, verbose SAN move sequences with before/after position FENs, and half-move counts. Handles empty strings and invalid notation safely.
- **Review timeline**: `buildTimeline()` in `src/features/chess/timeline.ts` converts parsed PGNs into an indexed timeline array starting at ply 0 (initial FEN) through final game FEN. `getTimelineStep()` enables O(1) step access with bounds checking.
- **Read-only ReviewBoard navigation**: Controlled board component (`ReviewBoard.tsx`) with `allowDragging: false`, step navigation buttons (Start, Previous, Next, End, Flip board), ply counter (`ply / totalPlies`), and current SAN move status indicator. Automatically resets to ply 0 when a new game timeline is loaded.
- **Paste-PGN review**: `ReviewWorkspace` form allowing users to paste PGN strings (validated up to 20,000 chars), display parsed game metadata (White, Black, Result, half-moves, source), and launch `ReviewBoard`. Includes a "Clear imported game" action to return to `StudyBoard`.
- **Chess.com PubAPI client**: Typed TypeScript client in `src/features/game-import/chesscom.ts` supporting `getArchives()` and `getMonthlyGames()`. Enforces HTTPS on `api.chess.com`, parses ISO month/year paths, sends custom `User-Agent`, handles HTTP status codes (200, 404, 429, 5xx), respects `Retry-After` headers, and uses schema validation without needing user credentials.
- **Internal Chess.com routes**: Next.js Server Route Handlers:
  - `GET /api/chesscom/[username]/archives`
  - `GET /api/chesscom/[username]/games/[year]/[month]`
  Proxy requests to Chess.com, apply `Cache-Control` headers (max-age=3600 for archives, max-age=1800 for monthly games), and return sanitized JSON error shapes.
- **Chess.com game picker**: Interactive UI component `ChesscomGamePicker.tsx` with username entry, archive month dropdown, monthly games list (displaying opponent, game result, date, time control), loading states, and error alerts.
- **Chess.com integration with ReviewWorkspace**: Seamless tabbed toggle ("Paste PGN" / "Chess.com") in `ReviewWorkspace`, feeding selected Chess.com game PGN into the timeline review pipeline.
- **Production-owned chessboard accessibility wrappers**: Production components (`StudyBoard`, `ReviewBoard`) wrap `<Chessboard>` inside accessible semantic elements (`<section aria-label="...">`, `<div role="status" aria-live="polite">`, `<div role="group" aria-label="...">`) for screen-reader accessibility.
- **Mock-based component tests**: Comprehensive Vitest test suite using a lightweight `react-chessboard` mock (`src/features/chess/__mocks__/react-chessboard.tsx`) for fast, reliable component state and interaction tests.
- **Non-mocked react-chessboard contract test**: Contract smoke test (`src/features/chess/react-chessboard.contract.test.tsx`) verifying real `react-chessboard` rendering in JSDOM, confirming DOM element structure, controlled position updates, and disabled drag attributes.
- **Stockfish runtime asset pipeline**: Verified, hash-verified preparation script (`scripts/prepare-stockfish-assets.mjs`) copies the lite single-threaded Stockfish 18.0.0 WASM/JS runtime from `node_modules/stockfish/src/` into `public/engines/stockfish/18.0.0/`. Assets are versioned, adjacent, and Git-ignored.
- **Stockfish license and source notices**: Deployment-accessible files under `public/licenses/stockfish/18.0.0/` (`COPYING.txt` and `SOURCE.txt`) document GPLv3 obligations and provenance. Legal review remains required before public deployment.
- **UCI infrastructure**: UCI command builders (`setoption`, `position fen`, `go depth/nodes/movetime`) and a line parser (`parseUciLine`) are implemented and tested in `src/features/chess/uci.ts`.
- **Engine types and controller**: Engine score types, configuration, analysis limits, and `EngineController` state machine are implemented and unit-tested in `src/features/chess/engine.ts` and `src/features/chess/engine-controller.ts`.
- **Stockfish Browser Worker**: Classic browser Worker factory constructed in `src/features/chess/engine-worker-factory.ts` using adjacent versioned public WASM assets.
- **Engine Analysis Hook**: `useEngineAnalysis` owns the Worker and controller lifecycle, and exposes request IDs for correlation.
- **Analysis Eligibility**: PGN parsing extracts timeline analysis eligibility. Only timelines with normalized terminal results (1-0, 0-1, 1/2-1/2) are eligible.
- **Analysis UI and Integration**: A gated, manual `AnalysisPanel` matches request IDs and FENs to suppress stale-position output, integrated into `ReviewBoard` for single-position analysis with a fixed depth-14 limit.
- **Full-game quick-pass analysis**: `ReviewBoard` renders `FullGameAnalysisPanel`, which uses `useQuickPassAnalysis` to analyze every timeline position sequentially at depth 10 with MultiPV 3. One click starts the full-game pass; navigation selects the matching completed result without restarting analysis. Incomplete timelines remain reviewable but ineligible for engine analysis. `StudyBoard` remains engine-free.

## Partially Verified Features
- **Browser Drag-and-Drop Interaction**: Controlled position rendering and `allowDragging: false` attributes are verified via unit and contract tests in JSDOM. However, actual browser pointer/touch drag mechanics rely on `@dnd-kit/core` sensors which cannot be fully verified in JSDOM environments. Real drag interaction must be verified manually in a browser or via end-to-end browser tests.

## Planned Features
- Move classification and annotation system (Brilliant, Blunder, Mistake, Inaccuracy, etc.).
- Position evaluation bar and advantage graph across game plies.
- Interactive explanation system for why a move was a mistake or blunder.
- Personalized blunder prevention drills and tactical practice mode.
- Additional import providers (Lichess API, raw PGN file uploads).
- Dark mode theme toggle & visual polish.

## Stockfish Analysis Roadmap
*Status: Full-game quick-pass analysis implemented; graph, explanations, and drills planned*

- **Engine Version**: Stockfish 18 WebAssembly (WASM), npm package `stockfish@18.0.0`.
- **Runtime Assets**: Hash-verified lite single-threaded runtime files are prepared under `public/engines/stockfish/18.0.0/` by `scripts/prepare-stockfish-assets.mjs`.
- **Execution Environment**: Web Worker in the browser for background calculation without blocking the main UI thread (implemented).
- **Analysis Workflow**:
  1. *Quick full-game pass*: Fast evaluation across all game plies at depth 10 with MultiPV 3 to compute candidate lines for each position. (Implemented in `FullGameAnalysisPanel` via `useQuickPassAnalysis`.)
  2. *Deeper critical-position pass*: Higher-depth evaluation focused on turning points, mistakes, blunders, and candidate brilliant moves. (Planned)
- **Optional Native Fallback**: Optional native server-side Stockfish analysis engine for low-power mobile devices or batch analysis. (Planned)
- **Metrics Recorded**: Single-position metrics (depth, nodes, time, score, PV) and ranked candidate lines (MultiPV 1–3) are displayed when supplied by the engine (implemented). Full-game metric collection and graphing remain planned.
- **Fair-Play Rule**: Stockfish engine analysis is strictly restricted to completed games. Live or ongoing game evaluation is strictly forbidden.
- **Single-position Analysis**: ReviewBoard provides manual depth-14 Stockfish analysis of the currently displayed timeline position via AnalysisPanel (implemented).
- **Full-game Analysis**: ReviewBoard provides one-click sequential full-game analysis at depth 10 with MultiPV 3 via FullGameAnalysisPanel. Analysis begins only after explicit user activation. StudyBoard exposes no engine assets or controls.

## Move Classification Roadmap
*Status: Planned (Not Implemented)*

Planned move classification labels:
- **Brilliant** (`!!`)
- **Great** (`!`)
- **Best** (`★`)
- **Excellent**
- **Good**
- **Inaccuracy** (`?!`)
- **Mistake** (`?`)
- **Blunder** (`??`)
- **Missed Win**

## Brilliant Move Criteria
*Status: Planned (Not Implemented)*

Brilliant move classification must use transparent, open, objective criteria (independent of proprietary platforms):
- **Top Engine Choice**: Must be the best move or virtually tied with the best engine move in evaluation.
- **Material Sacrifice**: Must involve a meaningful material sacrifice (piece, rook, exchange, or queen sacrifice).
- **Sound Continuation**: Must remain tactically sound after opponent's best response (not a hope chess blunder).
- **Sufficient Compensation**: Must yield decisive tactical or positional compensation (mating attack, material recovery, or overwhelming positional dominance).
- **Non-Trivial**: Must NOT be a trivial recapture (e.g. taking back a piece that was just captured).
- **Not Forced**: Must NOT be the only legal move or an obvious forced response.
- **Instructive & Non-Obvious**: Represents a difficult, non-obvious move that provides high instructional value for human learning.

## Learning System Roadmap
*Status: Planned (Not Implemented)*

- Automated detection of recurring player weaknesses (e.g. tactical themes like pins, forks, skewers, back-rank issues, or opening mistakes).
- Personalized interactive practice drills generated directly from the user's reviewed games ("Replay your mistake and find the best move").
- Spaced repetition practice for opening repertoire mistakes and endgame patterns.

## Chess.com Integration
- Built using the official public [Chess.com PubAPI](https://www.chess.com/news/view/published-chess-api-announcement).
- Public endpoint access only (`api.chess.com/pub/player/...`).
- Typed client implementation in `src/features/game-import/chesscom.ts`.
- Proxy routes in `src/app/api/chesscom/`.
- No user credentials, passwords, or authentication required.
- Rate-limiting aware (429 handling with `Retry-After`).

## Important Files
- `AGENTS.md`: Mandatory instructions for AI agents working in this repository.
- `CLAUDE.md`: Claude/AI entrypoint instructions.
- `PROJECT_CONTEXT.md`: This maintained project guide and context reference.
- `README.md`: Project overview, setup, and testing documentation.
- `package.json`: Project metadata, scripts, and dependency definitions.
- `src/app/page.tsx`: Root page component holding header, primary navigation, and workspace.
- `src/features/chess/game.ts`: Domain wrapper for `chess.js` (`createGame`, `move`, `undo`, `history`).
- `src/features/chess/pgn.ts`: PGN parsing logic (`parsePgn`, `normalizeHeader`).
- `src/features/chess/timeline.ts`: Review timeline data structure and step retriever (`buildTimeline`, `getTimelineStep`).
- `src/features/chess/StudyBoard.tsx`: Interactive freeform board component.
- `src/features/chess/ReviewBoard.tsx`: Read-only review board component with timeline navigation.
- `src/features/chess/ReviewWorkspace.tsx`: Top-level workspace component integrating board views and import forms.
- `scripts/prepare-stockfish-assets.mjs`: Reproducible, hash-verified Stockfish 18.0.0 runtime asset preparation script.
- `public/engines/stockfish/18.0.0/stockfish-18-lite-single.js` and `.wasm`: Generated lite single-threaded Stockfish runtime (Git-ignored, versioned output).
- `public/licenses/stockfish/18.0.0/COPYING.txt`: Verbatim GPLv3 license text for deployment.
- `public/licenses/stockfish/18.0.0/SOURCE.txt`: Stockfish provenance, hashes, and source-availability notice.
- `src/features/chess/engine.ts`: Engine type definitions and score normalization.
- `src/features/chess/engine-controller.ts`: State-machine-based engine controller with worker abstraction (integrated via useEngineAnalysis hook).
- `src/features/chess/uci.ts`: UCI command builders and message parser.
- `src/features/chess/react-chessboard.contract.test.tsx`: Contract test for `react-chessboard` behavior in JSDOM.
- `src/features/chess/engine-worker-factory.ts`: Browser Worker factory for Stockfish.
- `src/features/chess/use-engine-analysis.ts`: Hook for EngineController lifecycle and request correlation.
  - `src/features/chess/analysis-panel.tsx`: Manual, structurally gated single-position analysis UI.
  - `src/features/chess/quick-pass-planner.ts`: Full-game quick-pass job planner.
  - `src/features/chess/quick-pass-runner.ts`: Sequential full-game quick-pass runner with MultiPV candidate tracking.
  - `src/features/chess/use-quick-pass-analysis.ts`: Hook owning Worker/controller lifecycle for full-game analysis.
  - `src/features/chess/full-game-analysis-panel.tsx`: Full-game analysis panel integrated into ReviewBoard.
- `src/features/chess/engine-controller.test.ts`: Unit tests for `EngineController`.
- `src/features/chess/uci.test.ts`: Unit tests for UCI command builders and parser.
- `src/features/chess/engine-worker-factory.test.ts`: Tests for Worker factory logic.
- `src/features/chess/use-engine-analysis.test.ts`: Tests for hook lifecycle and request correlation.
 - `src/features/chess/analysis-panel.test.tsx`: Tests for analysis UI and eligibility structural gating.
 - `src/features/chess/engine-controller.test.ts`: Unit tests for `EngineController`.
 - `src/features/chess/uci.test.ts`: Unit tests for UCI command builders and parser.
 - `src/features/chess/engine-worker-factory.test.ts`: Tests for Worker factory logic.
 - `src/features/chess/use-engine-analysis.test.ts`: Tests for hook lifecycle and request correlation.
 - `scripts/prepare-stockfish-assets.test.mjs`: Unit tests for the Stockfish asset preparation pipeline.
 - `playwright.config.ts`: Playwright configuration for the Chromium real-browser smoke suite.
 - `e2e/stockfish-analysis.smoke.spec.ts`: End-to-end Playwright smoke tests covering StudyBoard isolation, completed-game Worker/WASM loading, manual depth-14 analysis output, navigation stale-result suppression, and incomplete-PGN eligibility gating.
 - `.github/workflows/ci.yml`: GitHub Actions workflow running lint, Vitest, build, and Playwright smoke tests on push and pull request.

## Client and Server Boundaries
- **Browser (Client)**:
  - React Client Components (`"use client"`): `StudyBoard`, `ReviewBoard`, `ReviewWorkspace`, `ChesscomGamePicker`.
  - Client-side chess rules engine (`chess.js`) and timeline position state.
  - Stockfish WASM runtime assets are prepared for client-side use under `public/engines/stockfish/18.0.0/`. A classic browser Worker runs the Stockfish engine, initialized when the eligible `FullGameAnalysisPanel` lifecycle mounts. No full-game analysis request begins until explicit user activation. No Stockfish analysis runs on the Next.js server.
- **Server (Next.js Node.js)**:
  - Server Route Handlers (`src/app/api/chesscom/...`).
  - Proxies requests to `api.chess.com` to prevent client CORS issues, protect client IP rate-limiting, and enforce server response caching.
  - Never handles, accepts, or stores user credentials.

## Security and Fair-Play Rules
- **Post-Game Review**: The application exclusively supports post-game review, prohibiting live or ongoing game assistance. Syntactically valid incomplete PGNs remain reviewable but are strictly ineligible for Stockfish analysis. Only timelines with normalized terminal results (1-0, 0-1, 1/2-1/2) are eligible for analysis. StudyBoard exposes no analysis. (Note: This is a client-side product guard, not tamper-proof authoritative verification.)
- **No Live Assistance**: No engine analysis, move recommendations, or tactical hints while a game is active.
- **No External Move Automation**: The application will never automate move input or interface with live games on third-party platforms (Chess.com, Lichess, etc.).
- **Official Public APIs Only**: All external data access uses official public APIs. Scraping third-party web pages is strictly forbidden.
- **Zero Credentials**: No requesting, storing, or handling of user passwords, private keys, or API tokens.

## Licensing Considerations
- **Stockfish License (GPLv3)**: Stockfish is licensed under the GNU General Public License v3 (GPLv3). The project deploys the GPLv3 license text at `public/licenses/stockfish/18.0.0/COPYING.txt` and a source-provenance notice at `public/licenses/stockfish/18.0.0/SOURCE.txt`. Distributing the compiled WASM and JavaScript binaries triggers GPLv3 source-availability obligations. Legal review is required before public deployment to confirm that external source links and notices satisfy corresponding-source requirements.
- **Original Content & Algorithms**: Do NOT copy proprietary lessons, annotations, icons, UI elements, or classification algorithms from Chess.com, Lichess, or other commercial services. All feature implementations (such as Brilliant move criteria) must be independently designed using transparent, open criteria.

## Testing and Verification
- **Test Command**: `npm run test:run` (runs unit, integration, and contract tests once in Vitest).
- **Lint Command**: `npm run lint` (runs ESLint).
- **Build Command**: `npm run build` (executes Next.js production build).
- **E2E Command**: `npm run test:e2e` (runs the Playwright Chromium smoke suite against the real application).
- **Current Validation Baseline**:
  - Vitest: 22 test files / 514 tests passing.
  - Playwright: 4 Chromium smoke tests passing, covering StudyBoard isolation, eligible ReviewBoard Worker/WASM loading, one-click full-game analysis output, navigation result selection, and incomplete-PGN eligibility gating.
  - Clean lint and production build.
- **Testing Architecture**:
  - Unit tests for pure domain functions (`game.test.ts`, `pgn.test.ts`, `timeline.test.ts`, `chesscom.test.ts`).
  - API route integration tests testing server handlers and error mapping.
  - Component unit and integration tests using `react-chessboard` mocks (includes `AnalysisPanel` and `FullGameAnalysisPanel` integration with `ReviewBoard`).
  - Contract smoke test (`react-chessboard.contract.test.tsx`) testing unmocked `react-chessboard` in JSDOM.
  - Engine infrastructure tests: `engine-controller.test.ts`, `uci.test.ts`, `engine-worker-factory.test.ts`, and `use-engine-analysis.test.ts` thoroughly cover the Stockfish lifecycle, correlation, and UCI layers.
  - Asset pipeline tests: `scripts/prepare-stockfish-assets.test.mjs` verifies hash-verified preparation, idempotency, and failure handling.
  - Real-browser smoke tests: `e2e/stockfish-analysis.smoke.spec.ts` verifies the complete production browser path, including successful loading of `/engines/stockfish/18.0.0/stockfish-18-lite-single.js` and `.wasm`, one-click full-game analysis with real engine information fields and ranked candidate lines (depth, nodes, time, score, engine line, best move), navigation result selection without another click, and correct eligibility gating. These tests require Playwright Chromium to be installed locally (`npx playwright install chromium`).
- **CI Workflow**: `.github/workflows/ci.yml` runs on push and pull request events. It uses Node 20 with npm caching, installs dependencies via `npm ci`, installs Playwright Chromium with system dependencies (`npx playwright install --with-deps chromium`), and executes `npm run lint`, `npm run test:run`, `npm run build`, and `npm run test:e2e` with `CI: true`. The workflow uses read-only permissions, cancels superseded runs on the same ref, and uploads Playwright failure artifacts from `test-results/` with 7-day retention only on failure. The CI commands have been verified locally, but a remote GitHub Actions run has not yet been observed in this thread.

## Development Rules
- **Immutability**: Domain helper functions must return new immutable objects rather than mutating parameters.
- **Client/Server Separation**: Keep network proxy logic on server route handlers.
- **Test-Driven Discipline**: Write or update tests when adding features or fixing bugs. Maintain coverage.
- **Mandatory Verification**: Always verify changes by running `npm run lint`, `npm run test:run`, and `npm run build` before claiming completion.

## Session Startup Checklist
Before starting work in any new AI session on Learn Review Chess:
1. Read `AGENTS.md`.
2. Read `CLAUDE.md`.
3. Read `PROJECT_CONTEXT.md`.
4. Inspect current Git status and active branch (`git status`).
5. Inspect recent Git history (`git log -n 5 --oneline`).
6. Verify `PROJECT_CONTEXT.md` claims against the current codebase.
7. Read files relevant to the requested task before editing.
8. Avoid modifying unrelated application or test code.
9. Run tests (`npm run test:run`), type check / build (`npm run build`), and ESLint (`npm run lint`) before claiming success.

## Context Maintenance Rules
- Update `PROJECT_CONTEXT.md` whenever new features are added, updated, or transitioned from planned to implemented status.
- Avoid volatile hardcoded details (e.g. temporary branch names or static test count totals). Label last-verified commits or dates as snapshots.
- Never include credentials, secrets, API keys, tokens, emails, or machine-specific file paths.
- `PROJECT_CONTEXT.md` is a maintained project guide, not a substitute for inspecting current code and Git state.
