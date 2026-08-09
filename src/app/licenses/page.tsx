import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Third-Party Licenses - Learn Review Chess",
  description: "Third-party open-source component licenses and engine source information.",
};

export default function LicensesPage() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-black/[.08] bg-white px-4 py-6 dark:border-white/[.145] dark:bg-black sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Third-Party Notices
          </h1>
          <p className="mt-2 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            This project incorporates third-party components subject to their respective licenses.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 text-black dark:text-zinc-50">
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Stockfish</h2>

          <div className="space-y-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            <p>
              Component: Stockfish (npm package: <code>stockfish@18.0.0</code>)
            </p>
            <p>
              Modification status: Unmodified. Runtime files are copied byte for byte from the npm package and their SHA-256 digests are verified on every build.
            </p>
            <p>
              Engine version: Stockfish 18 (upstream tag: <code>sf_18</code>)
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <h3 className="font-medium text-black dark:text-zinc-100">GPLv3 Obligations &amp; Resources</h3>
            <ul className="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
              <li>
                <a
                  href="/licenses/stockfish/18.0.0/COPYING.txt"
                  className="underline hover:text-foreground"
                >
                  GPLv3 license text (/licenses/stockfish/18.0.0/COPYING.txt)
                </a>
              </li>
              <li>
                <a
                  href="/licenses/stockfish/18.0.0/SOURCE.txt"
                  className="underline hover:text-foreground"
                >
                  Source provenance (/licenses/stockfish/18.0.0/SOURCE.txt)
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/nmrugg/stockfish.js"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  stockfish.js repository
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/official-stockfish/Stockfish"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  official Stockfish repository
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            <div>
              <h3 className="font-semibold text-black dark:text-zinc-100 mb-1">GPLv3 obligations</h3>
              <p>
                Stockfish is licensed under the GNU General Public License v3.0 (GPLv3). Serving the compiled WebAssembly and JavaScript files to a browser conveys GPLv3 object code, so the source-availability obligations of GPLv3 section 6 apply. Because the engine is conveyed over a network rather than on a physical medium, the written offer route in section 6(b) is not available. This project relies on section 6(d) and offers equivalent access to the corresponding source, at no charge, from the locations named above.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-black dark:text-zinc-100 mb-1">Neural network training data</h3>
              <p>
                Stockfish&apos;s NNUE evaluation networks are trained on data provided by the Leela Chess Zero project, made available under the Open Database License (ODbL): <a href="https://opendatacommons.org/licenses/odbl/odbl-10.txt" target="_blank" rel="noreferrer" className="underline">https://opendatacommons.org/licenses/odbl/odbl-10.txt</a>. The network used by this build is embedded in the distributed WASM binary and is not shipped as a separate asset.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-black dark:text-zinc-100 mb-1">Relationship to this project&apos;s own licence</h3>
              <p>
                This project&apos;s own source code is licensed under MIT, as declared in <code>package.json</code>. That declaration covers only code authored by this project. The Stockfish runtime assets served from <code>public/engines/stockfish/</code> remain under GPLv3 and are not relicensed by it. The engine runs as a separate program inside a Web Worker, communicating over the UCI text protocol.
              </p>
            </div>

            <p className="text-xs text-zinc-500 pt-4">
              This file documents third-party components. It does not constitute legal advice.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
