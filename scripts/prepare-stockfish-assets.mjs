import fs from "fs";
import path from "path";
import crypto from "crypto";

const VERSION = "18.0.0";
const OUTPUT_DIR = path.join("public", "engines", "stockfish", VERSION);

const DESCRIPTORS = [
  {
    sourceRelative: path.join("src", "stockfish-18-lite-single.js"),
    outputFilename: "stockfish-18-lite-single.js",
    expectedSize: 20670,
    expectedHash: "2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe",
  },
  {
    sourceRelative: path.join("src", "stockfish-18-lite-single.wasm"),
    outputFilename: "stockfish-18-lite-single.wasm",
    expectedSize: 7295411,
    expectedHash: "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
  },
];

function computeHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function validateSource(sourcePath, descriptor) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourcePath}`);
  }
  const stats = fs.statSync(sourcePath);
  if (!stats.isFile()) {
    throw new Error(`Source path is not a regular file: ${sourcePath}`);
  }
  if (stats.size !== descriptor.expectedSize) {
    throw new Error(
      `Size mismatch for ${descriptor.outputFilename}: expected ${descriptor.expectedSize}, got ${stats.size}`
    );
  }
  const actualHash = computeHash(sourcePath);
  if (actualHash !== descriptor.expectedHash) {
    throw new Error(
      `Hash mismatch for ${descriptor.outputFilename}: expected ${descriptor.expectedHash}, got ${actualHash}`
    );
  }
}

function prepareStockfishAssets() {
  const root = process.cwd();
  const packageDir = path.join(root, "node_modules", "stockfish");
  if (!fs.existsSync(packageDir)) {
    throw new Error("node_modules/stockfish not found. Run npm install first.");
  }

  for (const descriptor of DESCRIPTORS) {
    validateSource(path.join(packageDir, descriptor.sourceRelative), descriptor);
  }

  const tempDir = path.join(root, "tmp-stockfish-assets");
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    for (const descriptor of DESCRIPTORS) {
      const sourcePath = path.join(packageDir, descriptor.sourceRelative);
      const tempPath = path.join(tempDir, descriptor.outputFilename);
      fs.copyFileSync(sourcePath, tempPath);
    }

    for (const descriptor of DESCRIPTORS) {
      const tempPath = path.join(tempDir, descriptor.outputFilename);
      validateSource(tempPath, descriptor);
    }

    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const descriptor of DESCRIPTORS) {
      const tempPath = path.join(tempDir, descriptor.outputFilename);
      const finalPath = path.join(OUTPUT_DIR, descriptor.outputFilename);
      fs.renameSync(tempPath, finalPath);
    }

    console.log(`Prepared Stockfish ${VERSION} assets to ${OUTPUT_DIR}`);
    for (const descriptor of DESCRIPTORS) {
      console.log(`  ${descriptor.outputFilename}`);
    }
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

try {
  prepareStockfishAssets();
} catch (error) {
  console.error(`Failed to prepare Stockfish assets: ${error.message}`);
  process.exit(1);
}
