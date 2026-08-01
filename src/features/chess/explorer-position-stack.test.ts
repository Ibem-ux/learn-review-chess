import { describe, expect, it } from 'vitest';
import {
  createExplorerStack,
  pushExplorerPosition,
  popExplorerPosition,
  currentExplorerFen,
  explorerBreadcrumb,
  explorerDepth,
  resetExplorerStack,
} from './explorer-position-stack';

const rootFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const afterBc4Fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
const afterBc5Fen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

describe('explorer-position-stack', () => {
  it('a new stack has depth 0, an empty breadcrumb, and its current fen equals the root fen', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    expect(explorerDepth(stack)).toBe(0);
    expect(explorerBreadcrumb(stack)).toEqual([]);
    expect(currentExplorerFen(stack)).toBe(rootFen);
  });

  it('a new stack records the ply it was given', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    expect(stack.ply).toBe(4);
  });

  it('pushing once gives depth 1 and the pushed fen as current', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const newStack = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    expect(explorerDepth(newStack)).toBe(1);
    expect(currentExplorerFen(newStack)).toBe(afterBc4Fen);
  });

  it('pushing once puts exactly that san in the breadcrumb', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const newStack = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    expect(explorerBreadcrumb(newStack)).toEqual(['Bc4']);
  });

  it('pushing twice gives depth 2 and the second fen as current', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const once = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    const twice = pushExplorerPosition(once, { fen: afterBc5Fen, san: 'Bc5' });
    expect(explorerDepth(twice)).toBe(2);
    expect(currentExplorerFen(twice)).toBe(afterBc5Fen);
  });

  it('pushing twice gives both sans in visit order', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const once = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    const twice = pushExplorerPosition(once, { fen: afterBc5Fen, san: 'Bc5' });
    expect(explorerBreadcrumb(twice)).toEqual(['Bc4', 'Bc5']);
  });

  it('pushing does not mutate the input stack - assert the original still has its previous depth and current fen', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const originalDepth = explorerDepth(stack);
    const originalFen = currentExplorerFen(stack);
    const newStack = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    expect(explorerDepth(stack)).toBe(originalDepth);
    expect(currentExplorerFen(stack)).toBe(originalFen);
    // Also ensure the new stack is different
    expect(newStack).not.toBe(stack);
    expect(explorerDepth(newStack)).toBe(1);
  });

  it('popping after two pushes gives depth 1 and the first fen as current', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const once = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    const twice = pushExplorerPosition(once, { fen: afterBc5Fen, san: 'Bc5' });
    const onceAgain = popExplorerPosition(twice);
    expect(explorerDepth(onceAgain)).toBe(1);
    expect(currentExplorerFen(onceAgain)).toBe(afterBc4Fen);
  });

  it('popping down to empty returns the root fen as current', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const once = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    const twice = pushExplorerPosition(once, { fen: afterBc5Fen, san: 'Bc5' });
    const onceAgain = popExplorerPosition(twice);
    const empty = popExplorerPosition(onceAgain);
    expect(explorerDepth(empty)).toBe(0);
    expect(currentExplorerFen(empty)).toBe(rootFen);
  });

  it('popping an empty stack does not throw and leaves depth 0', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const empty = popExplorerPosition(stack);
    expect(explorerDepth(empty)).toBe(0);
    expect(currentExplorerFen(empty)).toBe(rootFen);
    // Ensure it's a new stack (not mutated)
    expect(empty).not.toBe(stack);
  });

  it('popping does not mutate the input stack', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const once = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    const twice = pushExplorerPosition(once, { fen: afterBc5Fen, san: 'Bc5' });
    const originalDepthTwice = explorerDepth(twice);
    const originalFenTwice = currentExplorerFen(twice);
    const popped = popExplorerPosition(twice);
    expect(explorerDepth(twice)).toBe(originalDepthTwice);
    expect(currentExplorerFen(twice)).toBe(originalFenTwice);
    expect(popped).not.toBe(twice);
  });

  it('reset after two pushes gives depth 0 and the root fen as current', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const once = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    const twice = pushExplorerPosition(once, { fen: afterBc5Fen, san: 'Bc5' });
    const reset = resetExplorerStack(twice);
    expect(explorerDepth(reset)).toBe(0);
    expect(currentExplorerFen(reset)).toBe(rootFen);
  });

  it('reset preserves the ply and the root fen', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const once = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    const twice = pushExplorerPosition(once, { fen: afterBc5Fen, san: 'Bc5' });
    const reset = resetExplorerStack(twice);
    expect(reset.ply).toBe(4);
    expect(reset.rootFen).toBe(rootFen);
  });

  it('reset does not mutate the input stack', () => {
    const stack = createExplorerStack({ ply: 4, fen: rootFen });
    const once = pushExplorerPosition(stack, { fen: afterBc4Fen, san: 'Bc4' });
    const twice = pushExplorerPosition(once, { fen: afterBc5Fen, san: 'Bc5' });
    const originalDepthTwice = explorerDepth(twice);
    const originalFenTwice = currentExplorerFen(twice);
    const reset = resetExplorerStack(twice);
    expect(explorerDepth(twice)).toBe(originalDepthTwice);
    expect(currentExplorerFen(twice)).toBe(originalFenTwice);
    expect(reset).not.toBe(twice);
  });
});