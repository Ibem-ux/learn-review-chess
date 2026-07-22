import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawnSync } from "child_process";

function createFixtureDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stockfish-test-"));
  const packageDir = path.join(root, "node_modules", "stockfish", "src");
  fs.mkdirSync(packageDir, { recursive: true });

  const jsContent = Buffer.alloc(100, "a");
  const wasmContent = Buffer.alloc(200, "b");

  fs.writeFileSync(path.join(packageDir, "stockfish-18-lite-single.js"), jsContent);
  fs.writeFileSync(path.join(packageDir, "stockfish-18-lite-single.wasm"), wasmContent);

  const jsHash = crypto.createHash("sha256").update(jsContent).digest("hex");
  const wasmHash = crypto.createHash("sha256").update(wasmContent).digest("hex");

  return { root, packageDir, jsContent, wasmContent, jsHash, wasmHash };
}

function writeDescriptorScript(root, descriptor) {
  const scriptPath = path.join(root, "scripts", "prepare-stockfish-assets.mjs");
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });

  const script = `
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUTPUT_DIR = path.join("public", "engines", "stockfish", "18.0.0");

const DESCRIPTORS = [
  {
    sourceRelative: path.join("src", "stockfish-18-lite-single.js"),
    outputFilename: "stockfish-18-lite-single.js",
    expectedSize: ${descriptor.jsContent.length},
    expectedHash: "${descriptor.jsHash}",
  },
  {
    sourceRelative: path.join("src", "stockfish-18-lite-single.wasm"),
    outputFilename: "stockfish-18-lite-single.wasm",
    expectedSize: ${descriptor.wasmContent.length},
    expectedHash: "${descriptor.wasmHash}",
  },
];

function computeHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function validateSource(sourcePath, descriptor) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error("Missing source file: " + sourcePath);
  }
  const stats = fs.statSync(sourcePath);
  if (!stats.isFile()) {
    throw new Error("Source path is not a regular file: " + sourcePath);
  }
  if (stats.size !== descriptor.expectedSize) {
    throw new Error("Size mismatch for " + descriptor.outputFilename + ": expected " + descriptor.expectedSize + ", got " + stats.size);
  }
  const actualHash = computeHash(sourcePath);
  if (actualHash !== descriptor.expectedHash) {
    throw new Error("Hash mismatch for " + descriptor.outputFilename + ": expected " + descriptor.expectedHash + ", got " + actualHash);
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

    console.log("Prepared Stockfish 18.0.0 assets to " + OUTPUT_DIR);
    for (const descriptor of DESCRIPTORS) {
      console.log("  " + descriptor.outputFilename);
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
  console.error("Failed to prepare Stockfish assets: " + error.message);
  process.exit(1);
}
`;

  fs.writeFileSync(scriptPath, script);
  return scriptPath;
}

function execScript(scriptPath, cwd) {
  const result = spawnSync("node", [scriptPath], { cwd, encoding: "utf-8" });
  return result;
}

describe("prepare-stockfish-assets", () => {
  it("prepares assets successfully", () => {
    const fixture = createFixtureDir();
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Prepared Stockfish 18.0.0 assets");
    expect(result.stdout).toContain("stockfish-18-lite-single.js");
    expect(result.stdout).toContain("stockfish-18-lite-single.wasm");

    const outputDir = path.join(fixture.root, "public", "engines", "stockfish", "18.0.0");
    expect(fs.existsSync(outputDir)).toBe(true);
    expect(fs.statSync(path.join(outputDir, "stockfish-18-lite-single.js")).size).toBe(fixture.jsContent.length);
    expect(fs.statSync(path.join(outputDir, "stockfish-18-lite-single.wasm")).size).toBe(fixture.wasmContent.length);

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("is idempotent on repeat execution", () => {
    const fixture = createFixtureDir();
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result1 = execScript(scriptPath, fixture.root);
    expect(result1.status).toBe(0);

    const result2 = execScript(scriptPath, fixture.root);
    expect(result2.status).toBe(0);

    const outputDir = path.join(fixture.root, "public", "engines", "stockfish", "18.0.0");
    expect(fs.statSync(path.join(outputDir, "stockfish-18-lite-single.js")).size).toBe(fixture.jsContent.length);

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("fails when node_modules/stockfish is missing", () => {
    const fixture = createFixtureDir();
    fs.rmSync(path.join(fixture.root, "node_modules", "stockfish"), { recursive: true, force: true });
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("node_modules/stockfish not found");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("fails when JS source is missing", () => {
    const fixture = createFixtureDir();
    fs.unlinkSync(path.join(fixture.packageDir, "stockfish-18-lite-single.js"));
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing source file");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("fails when WASM source is missing", () => {
    const fixture = createFixtureDir();
    fs.unlinkSync(path.join(fixture.packageDir, "stockfish-18-lite-single.wasm"));
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing source file");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("fails on JS size mismatch", () => {
    const fixture = createFixtureDir();
    fs.writeFileSync(path.join(fixture.packageDir, "stockfish-18-lite-single.js"), Buffer.alloc(50, "a"));
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Size mismatch");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("fails on WASM size mismatch", () => {
    const fixture = createFixtureDir();
    fs.writeFileSync(path.join(fixture.packageDir, "stockfish-18-lite-single.wasm"), Buffer.alloc(50, "b"));
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Size mismatch");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("fails on JS hash mismatch", () => {
    const fixture = createFixtureDir();
    fs.writeFileSync(path.join(fixture.packageDir, "stockfish-18-lite-single.js"), Buffer.alloc(100, "x"));
    const badHash = "f" + "f".repeat(63);
    const scriptPath = writeDescriptorScript(fixture.root, { ...fixture, jsHash: badHash });

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Hash mismatch");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("fails on WASM hash mismatch", () => {
    const fixture = createFixtureDir();
    fs.writeFileSync(path.join(fixture.packageDir, "stockfish-18-lite-single.wasm"), Buffer.alloc(200, "y"));
    const badHash = "e" + "e".repeat(63);
    const scriptPath = writeDescriptorScript(fixture.root, { ...fixture, wasmHash: badHash });

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Hash mismatch");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("fails when source path is not a regular file", () => {
    const fixture = createFixtureDir();
    fs.rmSync(path.join(fixture.packageDir, "stockfish-18-lite-single.js"));
    fs.mkdirSync(path.join(fixture.packageDir, "stockfish-18-lite-single.js"));
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("not a regular file");

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("does not create output when validation fails", () => {
    const fixture = createFixtureDir();
    fs.unlinkSync(path.join(fixture.packageDir, "stockfish-18-lite-single.wasm"));
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);

    const outputDir = path.join(fixture.root, "public", "engines", "stockfish", "18.0.0");
    expect(fs.existsSync(outputDir)).toBe(false);

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("removes stale destination files on replacement", () => {
    const fixture = createFixtureDir();
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const outputDir = path.join(fixture.root, "public", "engines", "stockfish", "18.0.0");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "stale.txt"), "stale");

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).toBe(0);

    expect(fs.existsSync(path.join(outputDir, "stockfish-18-lite-single.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "stale.txt"))).toBe(false);

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("removes temp directory after success", () => {
    const fixture = createFixtureDir();
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).toBe(0);

    const tempDir = path.join(fixture.root, "tmp-stockfish-assets");
    expect(fs.existsSync(tempDir)).toBe(false);

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });

  it("removes temp directory after failure", () => {
    const fixture = createFixtureDir();
    fs.unlinkSync(path.join(fixture.packageDir, "stockfish-18-lite-single.wasm"));
    const scriptPath = writeDescriptorScript(fixture.root, fixture);

    const result = execScript(scriptPath, fixture.root);
    expect(result.status).not.toBe(0);

    const tempDir = path.join(fixture.root, "tmp-stockfish-assets");
    expect(fs.existsSync(tempDir)).toBe(false);

    fs.rmSync(fixture.root, { recursive: true, force: true });
  });
});
