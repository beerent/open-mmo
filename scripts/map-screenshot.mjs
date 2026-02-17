/**
 * Take a screenshot of the rendered Shireland map using Playwright.
 * Usage: node scripts/map-screenshot.mjs [output-path]
 * Default output: /tmp/shireland-map.png
 */
import { chromium } from "playwright";

const zoomOut = process.argv.includes("--zoom-out");
const OUTPUT = process.argv.filter(a => !a.startsWith("--"))[2] || "/tmp/shireland-map.png";
const CLIENT_URL = "http://localhost:4001";
const TIMEOUT = 20000;
// Zoom-out uses a 2x viewport so the camera shows the full map
const VIEWPORT_W = zoomOut ? 1920 : 960;
const VIEWPORT_H = zoomOut ? 1920 : 720;

async function main() {
  console.log("[map-screenshot] Launching browser...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });
  const page = await browser.newPage({ viewport: { width: VIEWPORT_W, height: VIEWPORT_H } });

  // Forward browser console to Node for debugging
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`  [browser error] ${msg.text()}`);
    } else {
      console.log(`  [browser] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`  [browser exception] ${err.message}`);
  });

  try {
    console.log("[map-screenshot] Navigating to " + CLIENT_URL);
    await page.goto(CLIENT_URL, { waitUntil: "networkidle", timeout: TIMEOUT });

    // Wait for the login screen to appear
    console.log("[map-screenshot] Waiting for login screen...");
    await page.waitForSelector("#login-screen", { state: "visible", timeout: TIMEOUT });

    // Click "Play Now" (guest login)
    console.log("[map-screenshot] Logging in as guest...");
    await page.click("#play-now-btn");

    // Character creation screen — fill name and enter
    console.log("[map-screenshot] Creating character...");
    await page.waitForSelector("#player-name", { state: "visible", timeout: TIMEOUT }).catch(() => {});
    const nameInput = await page.$("#player-name");
    if (nameInput) {
      await page.fill("#player-name", "MapViewer");
      await page.click("#join-btn");
    } else {
      // Existing character — click Enter Shireland
      const enterBtn = await page.$("#enter-btn");
      if (enterBtn) await enterBtn.click();
    }

    // Wait for login screen to disappear (game has loaded)
    await page.waitForSelector("#login-screen", {
      state: "detached",
      timeout: TIMEOUT,
    });

    // Extra wait for tilemap textures to load and render
    console.log("[map-screenshot] Waiting for map to render...");
    await page.waitForTimeout(2000);

    // Take screenshot
    console.log("[map-screenshot] Capturing screenshot → " + OUTPUT);
    await page.screenshot({ path: OUTPUT, fullPage: false });

    console.log("[map-screenshot] Done!");
  } catch (err) {
    console.error("[map-screenshot] Error:", err.message);
    // Take a screenshot anyway to see what happened
    try {
      await page.screenshot({ path: "/tmp/shireland-map-error.png" });
      console.log("[map-screenshot] Error screenshot saved to /tmp/shireland-map-error.png");
    } catch {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
