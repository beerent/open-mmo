/**
 * Test 4-directional sprites in-game by walking in each direction
 * and taking screenshots.
 */
import { chromium } from "playwright";

const CLIENT_URL = "http://localhost:4001";
const TIMEOUT = 15000;

async function main() {
  console.log("[test] Launching browser...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  [browser error] ${msg.text()}`);
  });

  try {
    await page.goto(CLIENT_URL, { waitUntil: "networkidle", timeout: TIMEOUT });
    await page.waitForSelector("#login-screen", { state: "visible", timeout: TIMEOUT });

    // Join as warrior
    await page.fill("#player-name", "TestWalker");
    await page.click("#join-btn");
    await page.waitForSelector("#login-screen", { state: "detached", timeout: TIMEOUT });
    await page.waitForTimeout(1500);

    // Take a screenshot facing down (default direction)
    console.log("[test] Screenshot: facing down...");
    await page.screenshot({ path: "/tmp/test-dir-down.png" });

    // Walk right
    console.log("[test] Walking right...");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(600);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(200);
    await page.screenshot({ path: "/tmp/test-dir-right.png" });

    // Walk up
    console.log("[test] Walking up...");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(600);
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(200);
    await page.screenshot({ path: "/tmp/test-dir-up.png" });

    // Walk left
    console.log("[test] Walking left...");
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(600);
    await page.keyboard.up("ArrowLeft");
    await page.waitForTimeout(200);
    await page.screenshot({ path: "/tmp/test-dir-left.png" });

    // Walk down
    console.log("[test] Walking down again...");
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(600);
    await page.keyboard.up("ArrowDown");
    await page.waitForTimeout(200);
    await page.screenshot({ path: "/tmp/test-dir-down2.png" });

    console.log("[test] Done! Screenshots at /tmp/test-dir-*.png");
  } catch (err) {
    console.error("[test] Error:", err.message);
    await page.screenshot({ path: "/tmp/test-dir-error.png" });
  } finally {
    await browser.close();
  }
}

main();
