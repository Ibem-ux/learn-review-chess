import ReviewWorkspace from "@/features/chess/ReviewWorkspace";

const NAV_ITEMS = [
  { label: "Review", selected: true },
  { label: "Learn", selected: false },
  { label: "Analysis", selected: false },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-black/[.08] bg-white px-4 py-6 dark:border-white/[.145] dark:bg-black sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Learn Review Chess
          </h1>
          <p className="mt-2 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Review your games, understand your mistakes, and improve your chess.
          </p>
        </div>
      </header>

      <nav aria-label="Primary" className="border-b border-black/[.08] bg-white dark:border-white/[.145] dark:bg-black">
        <ul className="mx-auto flex w-full max-w-6xl gap-2 px-4 sm:px-8">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <a
                href="#"
                aria-current={item.selected ? "page" : undefined}
                className={
                  item.selected
                    ? "inline-block border-b-2 border-foreground px-3 py-3 text-sm font-semibold text-foreground"
                    : "inline-block border-b-2 border-transparent px-3 py-3 text-sm font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
                }
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
        <ReviewWorkspace />
      </main>
    </div>
  );
}
