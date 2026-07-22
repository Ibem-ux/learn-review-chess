# Third-Party Notices

This project incorporates third-party components subject to their respective licenses.

## Stockfish

- **Component:** Stockfish
- **Engine version:** Stockfish 18
- **npm package:** `stockfish@18.0.8`
- **Package license:** GPL-3.0
- **Package repository:** https://github.com/nmrugg/stockfish.js
- **Distributed build:** `stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm`
- **Local license file:** `licenses/stockfish/COPYING.txt`

### Confirmed source/build information

- The `stockfish@18.0.8` npm package is published by Nathan Rugg and is associated with the repository at https://github.com/nmrugg/stockfish.js.
- The package README identifies the distributed WASM builds as Stockfish 18.
- The stockfish.js repository release `v18.0.0` identifies upstream official Stockfish source commit `cb3d4ee9b47d0c5aae855b12379378ea1439675c` (tag `sf_18` in https://github.com/official-stockfish/Stockfish).
- The npm package version `18.0.8` does not have a directly corresponding published GitHub tag in the stockfish.js repository; the repository release tag is `v18.0.0`.
- The distributed lite single-threaded build uses Emscripten-generated JavaScript glue and a WASM binary. NNUE weights are embedded in the WASM; no separate `.nnue` asset is distributed for this build.

### Corresponding source

The corresponding source for the distributed WASM build is the official Stockfish source code at https://github.com/official-stockfish/Stockfish, tag `sf_18` (or commit `cb3d4ee9b47d0c5aae855b12379378ea1439675c`), compiled with Emscripten using the build scripts available at https://github.com/nmrugg/stockfish.js.

### GPLv3 obligations

Stockfish is licensed under the GNU General Public License v3.0 (GPLv3). Distributing the compiled WASM and JavaScript binaries triggers GPLv3 source-availability obligations. Before public deployment, you must:

- Provide the exact corresponding source code used to produce the distributed binaries.
- Include copyright notices and the GPLv3 license text.
- Ensure recipients can obtain the source code along with the binary or via a written offer.

This file documents the third-party component for future review. It does not constitute legal advice or a claim that GPLv3 compliance is complete.
