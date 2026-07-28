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

Stockfish is licensed under the GNU General Public License v3.0 (GPLv3). Distributing the compiled WASM and JavaScript binaries triggers GPLv3 source-availability obligations. Before public deployment, you must:

- Provide the exact corresponding source code used to produce the distributed binaries.
- Include copyright notices and the GPLv3 license text.
- Ensure recipients can obtain the source code along with the binary or via a written offer.

This file documents the third-party component for future review. It does not constitute legal advice or a claim that GPLv3 compliance is complete.
