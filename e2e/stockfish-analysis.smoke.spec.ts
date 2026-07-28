import { test, expect } from "@playwright/test";

const COMPLETED_PGN = `[Event "Browser smoke test"]
[White "White"]
[Black "Black"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`;

const INCOMPLETE_PGN = `[Event "Incomplete browser smoke test"]
[Result "*"]

1. e4 e5 *`;

test.describe("Stockfish browser smoke test", () => {
  test("initial StudyBoard exposes no engine analysis", async ({ page }) => {
    const stockfishUrls: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/engines/stockfish/")) {
        stockfishUrls.push(request.url());
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        const text = msg.text();
        if (
          text.includes("Worker") ||
          text.includes("worker") ||
          text.includes("WASM") ||
          text.includes("wasm") ||
          text.includes("Content Security Policy") ||
          text.includes("MIME") ||
          text.includes("cross-origin") ||
          text.includes("Cross-Origin") ||
          text.includes("fetch") ||
          text.includes("uncaught")
        ) {
          consoleErrors.push(`[${msg.type()}] ${text}`);
        }
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Learn Review Chess" })).toBeVisible();
    await expect(page.getByTestId("side-to-move")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo move" })).toBeVisible();
    await expect(page.getByLabel("Full-game analysis")).not.toBeVisible();

    await page.waitForTimeout(3000);

    expect(stockfishUrls, `Unexpected engine requests: ${stockfishUrls.join(", ")}`).toEqual([]);
    expect(consoleErrors, `Material console issues: ${consoleErrors.join(", ")}`).toEqual([]);
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(", ")}`).toEqual([]);
  });

  test("completed game loads Worker and WASM, Analyze full game produces real engine output", async ({ page }) => {
    const stockfishResponses: { url: string; status: number }[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/engines/stockfish/")) {
        stockfishResponses.push({ url: request.url(), status: 0 });
      }
    });
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/engines/stockfish/")) {
        const entry = stockfishResponses.find((r) => r.url === url);
        if (entry) {
          entry.status = response.status();
        }
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        const text = msg.text();
        if (
          text.includes("Worker") ||
          text.includes("worker") ||
          text.includes("WASM") ||
          text.includes("wasm") ||
          text.includes("Content Security Policy") ||
          text.includes("MIME") ||
          text.includes("cross-origin") ||
          text.includes("Cross-Origin") ||
          text.includes("fetch") ||
          text.includes("uncaught")
        ) {
          consoleErrors.push(`[${msg.type()}] ${text}`);
        }
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/");

    await page.getByLabel("Paste a completed PGN game").fill(COMPLETED_PGN);
    await page.getByRole("button", { name: "Load game" }).click();

    await expect(page.getByTestId("review-ply-status")).toBeVisible();
    await expect(page.getByLabel("Full-game analysis")).toBeVisible();

    const analysisStatus = page.getByLabel("Full-game analysis").getByRole("status");
    const analyzeButton = page.getByRole("button", { name: "Analyze full game" });
    await expect(analyzeButton).toBeEnabled({ timeout: 60000 });

    await expect(page.getByText("Position not yet analyzed.")).toBeVisible();

    await analyzeButton.click();

    await expect(analysisStatus).toHaveText(/Analyzing position/);

    const results = page.getByTestId("current-ply-result");
    await expect(results).toContainText(/Depth:|Nodes:|Time:|Score:|Engine line:/);

    await expect(page.getByText("Best move:")).toBeVisible({ timeout: 120000 });

    const jsAsset = stockfishResponses.find((r) => r.url.endsWith(".js"));
    const wasmAsset = stockfishResponses.find((r) => r.url.endsWith(".wasm"));
    expect(jsAsset).toBeTruthy();
    expect(wasmAsset).toBeTruthy();
    expect(jsAsset!.status).toBeGreaterThanOrEqual(200);
    expect(jsAsset!.status).toBeLessThan(300);
    expect(wasmAsset!.status).toBeGreaterThanOrEqual(200);
    expect(wasmAsset!.status).toBeLessThan(300);
    expect(jsAsset!.url).toContain("/engines/stockfish/18.0.0/stockfish-18-lite-single.js");
    expect(wasmAsset!.url).toContain("/engines/stockfish/18.0.0/stockfish-18-lite-single.wasm");
    expect(consoleErrors, `Material console issues: ${consoleErrors.join(", ")}`).toEqual([]);
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(", ")}`).toEqual([]);
  });

  test("navigation changes which ply result is displayed without another Analyze click", async ({ page }) => {
    const stockfishResponses: { url: string; status: number }[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/engines/stockfish/")) {
        stockfishResponses.push({ url: request.url(), status: 0 });
      }
    });
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/engines/stockfish/")) {
        const entry = stockfishResponses.find((r) => r.url === url);
        if (entry) {
          entry.status = response.status();
        }
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        const text = msg.text();
        if (
          text.includes("Worker") ||
          text.includes("worker") ||
          text.includes("WASM") ||
          text.includes("wasm") ||
          text.includes("Content Security Policy") ||
          text.includes("MIME") ||
          text.includes("cross-origin") ||
          text.includes("Cross-Origin") ||
          text.includes("fetch") ||
          text.includes("uncaught")
        ) {
          consoleErrors.push(`[${msg.type()}] ${text}`);
        }
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/");

    await page.getByLabel("Paste a completed PGN game").fill(COMPLETED_PGN);
    await page.getByRole("button", { name: "Load game" }).click();

    await expect(page.getByTestId("review-ply-status")).toBeVisible();
    await expect(page.getByLabel("Full-game analysis")).toBeVisible();

    const analysisStatus = page.getByLabel("Full-game analysis").getByRole("status");
    const analyzeButton = page.getByRole("button", { name: "Analyze full game" });
    await expect(analyzeButton).toBeEnabled({ timeout: 60000 });

    await analyzeButton.click();

    await expect(analysisStatus).toHaveText(/Analyzing position/);

    const results = page.getByTestId("current-ply-result");
    await expect(results).toContainText(/Depth:|Nodes:|Time:|Score:|Engine line:/);
    await expect(page.getByText("Best move:")).toBeVisible({ timeout: 120000 });

    await expect(analysisStatus).toHaveText("Analysis complete.");

    await page.getByRole("button", { name: "Next", exact: true }).click();

    await expect(page.getByTestId("review-ply-count")).toHaveText("(1 / 7)");
    await expect(results).toContainText("Ply: 1");

    const jsAsset = stockfishResponses.find((r) => r.url.endsWith(".js"));
    const wasmAsset = stockfishResponses.find((r) => r.url.endsWith(".wasm"));
    expect(jsAsset).toBeTruthy();
    expect(wasmAsset).toBeTruthy();
    expect(jsAsset!.status).toBeGreaterThanOrEqual(200);
    expect(jsAsset!.status).toBeLessThan(300);
    expect(wasmAsset!.status).toBeGreaterThanOrEqual(200);
    expect(wasmAsset!.status).toBeLessThan(300);
    expect(jsAsset!.url).toContain("/engines/stockfish/18.0.0/stockfish-18-lite-single.js");
    expect(wasmAsset!.url).toContain("/engines/stockfish/18.0.0/stockfish-18-lite-single.wasm");
    expect(consoleErrors, `Material console issues: ${consoleErrors.join(", ")}`).toEqual([]);
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(", ")}`).toEqual([]);
  });

  test("incomplete PGN remains reviewable but exposes no engine controls or assets", async ({ page }) => {
    const stockfishUrls: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/engines/stockfish/")) {
        stockfishUrls.push(request.url());
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        const text = msg.text();
        if (
          text.includes("Worker") ||
          text.includes("worker") ||
          text.includes("WASM") ||
          text.includes("wasm") ||
          text.includes("Content Security Policy") ||
          text.includes("MIME") ||
          text.includes("cross-origin") ||
          text.includes("Cross-Origin") ||
          text.includes("fetch") ||
          text.includes("uncaught")
        ) {
          consoleErrors.push(`[${msg.type()}] ${text}`);
        }
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/");

    await page.getByLabel("Paste a completed PGN game").fill(INCOMPLETE_PGN);
    await page.getByRole("button", { name: "Load game" }).click();

    await expect(page.getByTestId("review-ply-status")).toBeVisible();

    await expect(page.getByText("Full-game analysis is available only for completed games.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze full game" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).not.toBeVisible();

    await page.waitForTimeout(2000);

    expect(stockfishUrls, `Unexpected engine requests: ${stockfishUrls.join(", ")}`).toEqual([]);
    expect(consoleErrors, `Material console issues: ${consoleErrors.join(", ")}`).toEqual([]);
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(", ")}`).toEqual([]);
  });

  test("completed analysis renders classification icons in the move list", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Paste a completed PGN game").fill(COMPLETED_PGN);
    await page.getByRole("button", { name: "Load game" }).click();

    await expect(page.getByTestId("review-ply-status")).toBeVisible();
    await expect(page.getByLabel("Full-game analysis")).toBeVisible();

    const analysisStatus = page.getByLabel("Full-game analysis").getByRole("status");
    const analyzeButton = page.getByRole("button", { name: "Analyze full game" });
    await expect(analyzeButton).toBeEnabled({ timeout: 60000 });

    await analyzeButton.click();

    await expect(analysisStatus).toHaveText(/Analyzing position/);

    const results = page.getByTestId("current-ply-result");
    await expect(results).toContainText(/Depth:|Nodes:|Time:|Score:|Engine line:/);
    await expect(page.getByText("Best move:")).toBeVisible({ timeout: 120000 });
    await expect(analysisStatus).toHaveText("Analysis complete.");

    const moveList = page.getByRole("list", { name: "Move list" });
    const classifiedIcon = moveList.locator("[data-classification]").first();
    await expect(classifiedIcon).toBeVisible();

    const classificationButton = moveList.locator("button:has([data-classification])").first();
    await expect(classificationButton).toBeVisible();

    const accessibleName = await classificationButton.textContent();
    expect(accessibleName).toBeTruthy();
    expect(accessibleName).toMatch(/Best move|Excellent move|Good move|Inaccuracy|Mistake|Blunder/);

    const initialPlyCount = await page.getByTestId("review-ply-count").textContent();
    await classificationButton.click();
    const newPlyCount = await page.getByTestId("review-ply-count").textContent();
    expect(newPlyCount).not.toBe(initialPlyCount);
  });
});
