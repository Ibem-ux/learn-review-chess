This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Context

Features and setup instructions are below. Architecture and roadmap notes are maintained locally by the project owner and are not tracked in this repository.

## Features

- **Game Import & Selection**: Paste raw PGN text, fetch completed games via Chess.com username, fetch games via Lichess username, or upload PGN files from disk. The UI offers four tabbed import methods in order: Paste PGN, Chess.com, Lichess, and Upload file.
- **Stockfish Full-Game Quick-Pass Analysis**: Sequential Stockfish 18.0.0 analysis across all game positions at depth 10 with MultiPV 3.
- **Deep Critical-Position Pass**: Automatic detection of critical turning points (blunders, mistakes, sharp score shifts) with deeper re-analysis (depth 14+) to refine evaluations and brilliancy detection.
- **Objective Move Classification**: Moves categorized as Brilliant (`!!`), Great (`!`), Best (`★`), Excellent, Good, Inaccuracy (`?!`), Mistake (`?`), Blunder (`??`), or Missed Win using transparent centipawn loss and sacrifice evaluation rules.
- **Natural Language Move Explanations**: Explanatory text detailing tactical threats, move quality, and positional mistakes for selected positions.
- **Interactive SVG Evaluation Graph & Bar**: Interactive advantage timeline graph with hover tooltips and real-time evaluation bar.
- **Game Performance Summary**: Per-player move category counts, move accuracy %, average centipawn loss (ACPL), estimated performance ratings, and game phase breakdowns (Opening, Middlegame, Endgame).
- **Interactive Position Explorer**: Drag pieces on any reviewed position to explore alternative variations with position stack breadcrumbs and instant Return to Game navigation.
- **ECO Opening Book**: Local ECO lookup matching SAN move-sequence prefixes against a small starter set of 28 lines at most 6 plies deep. Transpositions are not resolved.
- **PGN File Upload**: Upload a .pgn file from disk as one of four import methods. A file may contain one or more games. If it contains multiple games, they are split and presented as a chooser listing White, Black, and the result for each (capped at 50 rows with the total stated), and selecting a game loads it while keeping the list available.
- **Third-Party Licences**: A /licenses page names Stockfish, confirms the engine is distributed unmodified, and links to the GPLv3 licence text and source provenance served with the app.
- **Best-Move Engine Arrows**: On-board arrow overlays displaying top engine candidate moves.
- **Freeform StudyBoard**: Interactive study board with legal move validation, move history, undo, reset, and board flipping.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

This project uses [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) and a jsdom environment.

Run the test suite once (CI mode):

```bash
npm run test:run
```

Run the tests in watch mode during development:

```bash
npm test
```

Run the Playwright browser smoke suite once (requires Chromium to be installed first):

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright smoke suite verifies the real-browser Stockfish path: StudyBoard exposes no engine assets, an eligible completed game loads the Worker JavaScript and WASM from versioned public paths, one-click full-game analysis produces ranked candidate lines and best-move output, navigation selects the matching ply result without another click, and incomplete PGNs remain reviewable but expose no engine controls or assets.

## Continuous Integration

GitHub Actions (`.github/workflows/ci.yml`) runs `npm run lint`, `npm run test:run`, `npm run build`, and `npm run test:e2e` on every push and pull request. The workflow uses Node 22 with npm caching, installs Playwright Chromium and required system dependencies, and uploads Playwright failure artifacts only when the browser smoke tests fail.

## Chess rules

Legal chess-game state and move validation are handled by [chess.js](https://github.com/jhlywa/chess.js). The wrapper lives in `src/features/chess`.

Completed games can be parsed into structured review data (headers, per-move SAN, color, source/destination squares, before/after positions, final FEN, and half-move count) using `parsePgn` from `src/features/chess/pgn.ts`. This supports future game-import and review features.

## Stockfish full-game analysis

Eligible completed games can be analyzed sequentially using Stockfish 18.0.0. In `ReviewBoard`, clicking **Analyze full game** starts a quick-pass that evaluates every timeline position at depth 10 with MultiPV 3. The panel shows progress, cancellation, and ranked candidate lines for the currently selected ply. Navigation updates the displayed ply without restarting analysis. Incomplete games remain reviewable but do not expose engine analysis. `StudyBoard` remains engine-free.

## Internal API routes

Internal Next.js server routes proxy external chess provider APIs while keeping browser code off the public APIs:

- `GET /api/chesscom/[username]/archives` – returns archive URLs for a player
- `GET /api/chesscom/[username]/games/[year]/[month]` – returns monthly games for a player
- `GET /api/lichess/[username]/games` – fetches PGN text from Lichess user endpoint (GET https://lichess.org/api/games/user/{username} with clocks=false, evals=false, literate=false, Accept application/x-chess-pgn, max capped at 20) with headers `public, max-age=60, s-maxage=120, stale-while-revalidate=600`

Responses include conservative `Cache-Control` headers and sanitized error shapes. Rate-limited responses preserve `Retry-After` when available.

## Game import

External game importing lives under `src/features/game-import`. Chess.com importing uses the official public [Chess.com PubAPI](https://www.chess.com/news/view/published-chess-api-announcement). Lichess importing uses the public Lichess user games endpoint (`GET https://lichess.org/api/games/user/{username}`). Both typed clients provide game retrieval with runtime response validation, controlled failures, and no credentials.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
