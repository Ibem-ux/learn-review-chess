This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Chess rules

Legal chess-game state and move validation are handled by [chess.js](https://github.com/jhlywa/chess.js). The wrapper lives in `src/features/chess`.

Completed games can be parsed into structured review data (headers, per-move SAN, color, source/destination squares, before/after positions, final FEN, and half-move count) using `parsePgn` from `src/features/chess/pgn.ts`. This supports future game-import and review features.

## Internal API routes

Internal Next.js server routes proxy Chess.com data through the existing PubAPI client while keeping browser code off the public API:

- `GET /api/chesscom/[username]/archives` — returns archive URLs for a player
- `GET /api/chesscom/[username]/games/[year]/[month]` — returns monthly games for a player

Responses include conservative `Cache-Control` headers and sanitized error shapes. Rate-limited responses preserve `Retry-After` when available.

## Game import

Chess.com importing uses the official public [Chess.com PubAPI](https://www.chess.com/news/view/published-chess-api-announcement) and lives under `src/features/game-import`. The typed client provides archive listing and monthly game retrieval with runtime response validation, controlled failures, and no credentials.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
