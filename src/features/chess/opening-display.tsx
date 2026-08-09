import type { OpeningMatch } from "@/features/chess/opening-book";

export function OpeningDisplay({
  opening,
}: {
  readonly opening: OpeningMatch | null;
}) {
  if (opening === null) {
    return null;
  }

  return (
    <div
      data-testid="opening-display"
      className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
    >
      <span data-testid="opening-eco">{opening.eco}</span>
      <span aria-hidden="true">•</span>
      <span data-testid="opening-name">{opening.name}</span>
    </div>
  );
}
