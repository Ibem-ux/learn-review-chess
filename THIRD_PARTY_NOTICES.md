# Third-Party Notices

This project incorporates third-party components subject to their respective licenses.

## Stockfish

- **Component:** Stockfish
- **Engine version:** Stockfish 18
- **npm package:** `stockfish@18.0.0`
- **Package license:** GPL-3.0
- **Package repository:** https://github.com/nmrugg/stockfish.js
- **Published release:** https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0
- **Tagged source archive:** https://github.com/nmrugg/stockfish.js/archive/refs/tags/v18.0.0.tar.gz
- **Distributed build:** `stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm`
- **Modification status:** Unmodified. Runtime files are copied byte for byte from the npm package and their SHA-256 digests are verified on every build.
- **Deployed license URL:** `/licenses/stockfish/18.0.0/COPYING.txt`
- **Deployed source-information URL:** `/licenses/stockfish/18.0.0/SOURCE.txt`
- **Local license file:** `public/licenses/stockfish/18.0.0/COPYING.txt`

### Confirmed source/build information

- The `stockfish@18.0.0` npm package corresponds to the published `v18.0.0` release in the repository at https://github.com/nmrugg/stockfish.js.
- The package README identifies the distributed WASM builds as Stockfish 18.
- The stockfish.js repository release `v18.0.0` identifies upstream official Stockfish source commit `cb3d4ee9b47d0c5aae855b12379378ea1439675c` (tag `sf_18` in https://github.com/official-stockfish/Stockfish).
- The distributed lite single-threaded build uses Emscripten-generated JavaScript glue and a WASM binary. NNUE weights are embedded in the WASM; no separate `.nnue` asset is distributed for this build.

### Corresponding source

The corresponding source for the distributed WASM build is the official Stockfish source code at https://github.com/official-stockfish/Stockfish, tag `sf_18` (or commit `cb3d4ee9b47d0c5aae855b12379378ea1439675c`), compiled with Emscripten using the build scripts available at https://github.com/nmrugg/stockfish.js.

### GPLv3 obligations

Stockfish is licensed under the GNU General Public License v3.0 (GPLv3). Serving the compiled WebAssembly and JavaScript files to a browser conveys GPLv3 object code, so the source-availability obligations of GPLv3 section 6 apply. Because the engine is conveyed over a network rather than on a physical medium, the written offer route in section 6(b) is not available. This project relies on section 6(d) and offers equivalent access to the corresponding source, at no charge, from the locations named above.

How this project complies:

- The complete GPLv3 licence text is served at `/licenses/stockfish/18.0.0/COPYING.txt`.
- Source provenance, including the exact upstream tag and the SHA-256 digest of every distributed runtime file, is served at `/licenses/stockfish/18.0.0/SOURCE.txt`.
- The engine is distributed unmodified, so the corresponding source is the upstream release named above.

### Neural network training data

Stockfish's NNUE evaluation networks are trained on data provided by the Leela Chess Zero project, made available under the Open Database License (ODbL): <https://opendatacommons.org/licenses/odbl/odbl-10.txt>. The network used by this build is embedded in the distributed WASM binary and is not shipped as a separate asset.

### Relationship to this project's own licence

This project's own source code is licensed under MIT, as declared in `package.json`. That declaration covers only code authored by this project. The Stockfish runtime assets served from `public/engines/stockfish/` remain under GPLv3 and are not relicensed by it. The engine runs as a separate program inside a Web Worker, communicating over the UCI text protocol.

This file documents third-party components. It does not constitute legal advice.
