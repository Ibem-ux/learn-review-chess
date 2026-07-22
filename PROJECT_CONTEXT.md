# Learn Review Chess — Project Context

> **Warning:** `PROJECT_CONTEXT.md` is a maintained project guide, not a substitute for inspecting current code and Git state.

*Snapshot Last Verified:* Commit `ec680fa` (Accessibility alignment for chessboard contract)

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
    │   ├── game.ts            # chess.js wrapper (createGame, move, undo, history)
    │   ├── pgn.ts             # Robust PGN parser (parsePgn, normalizeHeader)
    │   ├── timeline.ts        # Review timeline builder (buildTimeline, getTimelineStep)
    │   ├── StudyBoard.tsx     # Interactive freeform chess board component
    │   ├── ReviewBoard.tsx    # Read-only timeline review board component
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

## Partially Verified Features
- **Browser Drag-and-Drop Interaction**: Controlled position rendering and `allowDragging: false` attributes are verified via unit and contract tests in JSDOM. However, actual browser pointer/touch drag mechanics rely on `@dnd-kit/core` sensors which cannot be fully verified in JSDOM environments. Real drag interaction must be verified manually in a browser or via end-to-end browser tests.

## Planned Features
- Stockfish 18 WebAssembly integration for automated game evaluation.
- Move classification and annotation system (Brilliant, Blunder, Mistake, Inaccuracy, etc.).
- Position evaluation bar and advantage graph across game plies.
- Interactive explanation system for why a move was a mistake or blunder.
- Personalized blunder prevention drills and tactical practice mode.
- Additional import providers (Lichess API, raw PGN file uploads).
- Dark mode theme toggle & visual polish.

## Stockfish Analysis Roadmap
*Status: Planned (Not Implemented)*

- **Engine Version**: Stockfish 18 WebAssembly (WASM).
- **Execution Environment**: Web Worker in the browser for background calculation without blocking the main UI thread.
- **Analysis Workflow**:
  1. *Quick full-game pass*: Fast evaluation across all game plies at lower depth to compute position evaluation graph and detect major eval swings.
  2. *Deeper critical-position pass*: Higher-depth evaluation focused on turning points, mistakes, blunders, and candidate brilliant moves.
- **Optional Native Fallback**: Optional native server-side Stockfish analysis engine for low-power mobile devices or batch analysis.
- **Metrics Recorded**: Engine version, search depth, node count, evaluation score (centipawns or mate count), and principal variation (PV line).
- **Fair-Play Rule**: Stockfish engine analysis is strictly restricted to completed games. Live or ongoing game evaluation is strictly forbidden.

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
- `src/features/game-import/chesscom.ts`: Client for Chess.com PubAPI (`getArchives`, `getMonthlyGames`).
- `src/features/game-import/ChesscomGamePicker.tsx`: Game selection UI component for Chess.com.
- `src/app/api/chesscom/[username]/archives/route.ts`: Server proxy route for player archives.
- `src/app/api/chesscom/[username]/games/[year]/[month]/route.ts`: Server proxy route for monthly player games.
- `src/features/chess/react-chessboard.contract.test.tsx`: Contract test for `react-chessboard` behavior in JSDOM.

## Client and Server Boundaries
- **Browser (Client)**:
  - React Client Components (`"use client"`): `StudyBoard`, `ReviewBoard`, `ReviewWorkspace`, `ChesscomGamePicker`.
  - Client-side chess rules engine (`chess.js`) and timeline position state.
  - Planned client-side Stockfish Web Worker WASM analysis.
- **Server (Next.js Node.js)**:
  - Server Route Handlers (`src/app/api/chesscom/...`).
  - Proxies requests to `api.chess.com` to prevent client CORS issues, protect client IP rate-limiting, and enforce server response caching.
  - Never handles, accepts, or stores user credentials.

## Security and Fair-Play Rules
- **Completed Games Only**: The application exclusively imports and reviews completed games. Live or ongoing game review is strictly prohibited.
- **No Live Assistance**: No engine analysis, move recommendations, or tactical hints while a game is active.
- **No External Move Automation**: The application will never automate move input or interface with live games on third-party platforms (Chess.com, Lichess, etc.).
- **Official Public APIs Only**: All external data access uses official public APIs. Scraping third-party web pages is strictly forbidden.
- **Zero Credentials**: No requesting, storing, or handling of user passwords, private keys, or API tokens.

## Licensing Considerations
- **Stockfish License (GPLv3)**: Stockfish is licensed under the GNU General Public License v3 (GPLv3). Integrating Stockfish WASM or native binaries requires full compliance with GPLv3 source availability and copyright notice obligations.
- **Original Content & Algorithms**: Do NOT copy proprietary lessons, annotations, icons, UI elements, or classification algorithms from Chess.com, Lichess, or other commercial services. All feature implementations (such as Brilliant move criteria) must be independently designed using transparent, open criteria.

## Testing and Verification
- **Test Command**: `npm run test:run` (runs unit, integration, and contract tests once in Vitest).
- **Lint Command**: `npm run lint` (runs ESLint).
- **Build Command**: `npm run build` (executes Next.js production build).
- **Testing Architecture**:
  - Unit tests for pure domain functions (`game.test.ts`, `pgn.test.ts`, `timeline.test.ts`, `chesscom.test.ts`).
  - API route integration tests testing server handlers and error mapping.
  - Component unit and integration tests using `react-chessboard` mocks.
  - Contract smoke test (`react-chessboard.contract.test.tsx`) testing unmocked `react-chessboard` in JSDOM.

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
