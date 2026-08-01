export type VisitedPosition = {
  readonly fen: string;
  readonly san: string;
};

export type ExplorerStack = {
  readonly ply: number;
  readonly rootFen: string;
  readonly visited: readonly VisitedPosition[];
};

export const createExplorerStack = ({ ply, fen }: { ply: number; fen: string }): ExplorerStack => ({
  ply,
  rootFen: fen,
  visited: [],
});

export const pushExplorerPosition = (stack: ExplorerStack, { fen, san }: { fen: string; san: string }): ExplorerStack => ({
  ...stack,
  visited: [...stack.visited, { fen, san }],
});

export const popExplorerPosition = (stack: ExplorerStack): ExplorerStack => ({
  ...stack,
  visited: stack.visited.slice(0, -1),
});

export const currentExplorerFen = (stack: ExplorerStack): string =>
  stack.visited.length > 0 ? stack.visited[stack.visited.length - 1].fen : stack.rootFen;

export const explorerBreadcrumb = (stack: ExplorerStack): readonly string[] =>
  stack.visited.map(pos => pos.san);

export const explorerDepth = (stack: ExplorerStack): number =>
  stack.visited.length;

export const resetExplorerStack = (stack: ExplorerStack): ExplorerStack => ({
  ply: stack.ply,
  rootFen: stack.rootFen,
  visited: [],
});