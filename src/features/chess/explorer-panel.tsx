import type { ExplorerStack } from "./explorer-position-stack";
import { explorerBreadcrumb, explorerDepth } from "./explorer-position-stack";
import { Fragment } from "react";

export type ExplorerPanelProps = {
  readonly stack: ExplorerStack;
  readonly onBack: () => void;
  readonly onReset: () => void;
  readonly disabled?: boolean;
};

export function ExplorerPanel({ stack, onBack, onReset, disabled }: ExplorerPanelProps) {
  const depth = explorerDepth(stack);
  const isDisabled = depth === 0 || disabled === true;

  return (
    <section data-testid="explorer-panel" className="mt-4 space-y-3">
      <div data-testid="explorer-breadcrumb" className="text-sm text-zinc-700 dark:text-zinc-300">
        {depth === 0 ? (
          "Exploring from the game position"
        ) : (
          <>
            {explorerBreadcrumb(stack).map((san, index) => (
              <Fragment key={index}>
                {index > 0 && " "}
                <span data-testid="explorer-crumb">{san}</span>
              </Fragment>
            ))}
          </>
        )}
      </div>

      <div data-testid="explorer-depth" className="text-sm text-zinc-700 dark:text-zinc-300">
        {depth}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          data-testid="explorer-back"
          disabled={isDisabled}
          onClick={onBack}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Back
        </button>

        <button
          type="button"
          data-testid="explorer-reset"
          disabled={isDisabled}
          onClick={onReset}
          className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Return to game
        </button>
      </div>
    </section>
  );
}
