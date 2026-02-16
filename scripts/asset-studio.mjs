/**
 * Asset Studio — Playwright-based asset creation/compositing tool.
 *
 * Provides a headless browser canvas environment for pixel-art sprite
 * generation and compositing. Generation scripts import these helpers
 * and focus on the creative drawing code.
 *
 * Usage:
 *   import { openStudio, saveCanvas, savePreview, closeStudio } from '../scripts/asset-studio.mjs';
 *   const { page, browser } = await openStudio();
 *   // ... draw on canvases via page.evaluate() ...
 *   await saveCanvas(page, '#output', 'path/to/output.png');
 *   await savePreview(page, ['#output'], '/tmp/preview.png');
 *   await closeStudio(browser);
 */

import { chromium } from "playwright";
import { createServer } from "http";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join, extname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, "../apps/client/public/assets");

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".json": "application/json",
  ".html": "text/html",
};

/**
 * Start a minimal static file server for the assets directory.
 * Returns { server, port }.
 */
function startAssetServer() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      // Serve /assets/* from the client public assets dir
      const urlPath = decodeURIComponent(req.url);
      if (urlPath.startsWith("/assets/")) {
        const filePath = join(ASSETS_DIR, urlPath.replace("/assets/", ""));
        try {
          const data = readFileSync(filePath);
          const ext = extname(filePath).toLowerCase();
          res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
          res.end(data);
        } catch {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }
      // Serve root as a blank canvas page
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html>
<html><head><title>Asset Studio</title></head>
<body style="margin:0;background:#222;"></body></html>`);
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
    server.on("error", reject);
  });
}

/**
 * Launch Playwright, serve assets directory, set up canvas page
 * with browser-side utility functions.
 *
 * @param {object} [options]
 * @param {number} [options.width=1200] - Viewport width
 * @param {number} [options.height=800] - Viewport height
 * @returns {{ page: Page, browser: Browser, cleanup: () => Promise<void> }}
 */
export async function openStudio(options = {}) {
  const { width = 1200, height = 800 } = options;

  const { server, port } = await startAssetServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });
  const page = await browser.newPage({ viewport: { width, height } });

  // Forward browser logs
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`  [studio error] ${msg.text()}`);
    }
    if (msg.type() === "warning") {
      console.log(`  [studio warn] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`  [studio exception] ${err.message}`);
  });

  await page.goto(baseUrl, { waitUntil: "load" });

  // Inject browser-side utilities
  await page.evaluate(() => {
    /** Load an image from the served assets directory */
    window.loadImg = function (url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load: ${url}`));
        img.src = url;
      });
    };

    /** Sample a pixel color from an image at (x, y) */
    window.getPixel = function (img, x, y) {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
      return { r, g, b, a };
    };

    /** Extract pixel colors and their counts from a region of an image */
    window.getPalette = function (img, x, y, w, h) {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(x, y, w, h).data;
      const colors = {};
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // skip transparent
        const key = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
        colors[key] = (colors[key] || 0) + 1;
      }
      return Object.entries(colors)
        .map(([key, count]) => {
          const [r, g, b, a] = key.split(",").map(Number);
          return { r, g, b, a, count };
        })
        .sort((a, b) => b.count - a.count);
    };

    /** Get all pixel data from an image as ImageData */
    window.getImageData = function (img) {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height);
    };

    /** Create a canvas element with given dimensions and add to the page */
    window.createCanvas = function (id, width, height) {
      const c = document.createElement("canvas");
      c.id = id;
      c.width = width;
      c.height = height;
      c.style.imageRendering = "pixelated";
      document.body.appendChild(c);
      return c;
    };

    /**
     * Find the bounding box of non-transparent pixels in one frame of a sprite sheet.
     * @param {ImageData} imgData - Full sheet ImageData
     * @param {number} fx - X offset of the frame (frameIndex * frameW)
     * @param {number} fw - Frame width
     * @param {number} fh - Frame height
     * @returns {{ minX, maxX, minY, maxY }}
     */
    window.findFrameBounds = function (imgData, fx, fw, fh) {
      let minX = fw, maxX = 0, minY = fh, maxY = 0;
      for (let y = 0; y < fh; y++) {
        for (let lx = 0; lx < fw; lx++) {
          const i = (y * imgData.width + fx + lx) * 4;
          if (imgData.data[i + 3] > 0) {
            minX = Math.min(minX, lx);
            maxX = Math.max(maxX, lx);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      return { minX, maxX, minY, maxY };
    };

    /**
     * Measure where a reference sprite sits within its frame (average foot Y across frames).
     * Use this to compute the Y shift needed to align a base body to a reference sprite.
     *
     * @param {HTMLImageElement} img - Sprite sheet image
     * @param {number} frameW - Width of one frame
     * @param {number} frameH - Height of one frame
     * @param {number} frameCount - Number of frames in the sheet
     * @returns {{ avgFootY: number, avgHeadY: number, avgWidth: number }}
     */
    window.measureSpriteMetrics = function (img, frameW, frameH, frameCount) {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);

      let totalFootY = 0, totalHeadY = 0, totalWidth = 0;
      for (let f = 0; f < frameCount; f++) {
        const b = findFrameBounds(data, f * frameW, frameW, frameH);
        totalFootY += b.maxY;
        totalHeadY += b.minY;
        totalWidth += (b.maxX - b.minX + 1);
      }
      return {
        avgFootY: Math.round(totalFootY / frameCount),
        avgHeadY: Math.round(totalHeadY / frameCount),
        avgWidth: Math.round(totalWidth / frameCount),
      };
    };

    /**
     * Shift sprite pixels vertically so they align to a reference sprite's foot position,
     * then expand the silhouette outward to add equipment bulk.
     *
     * IMPORTANT: Uses separate read/write buffers per expansion pass to prevent
     * cascade flood-fill artifacts. Never read and write the same buffer during expansion.
     *
     * @param {HTMLImageElement} srcImg - Source sprite sheet (e.g. Body_A)
     * @param {object} opts
     * @param {number} opts.yShift - Pixels to shift down (positive = move toward bottom of frame)
     * @param {number} opts.bulkPasses - Number of silhouette expansion passes (default 2)
     * @param {number[][]} opts.fillColors - Array of [r,g,b] colors, one per pass.
     *   Pass 0 typically uses an outline color, pass 1+ uses a fill color.
     * @param {number} opts.sheetW - Total sheet width in pixels
     * @param {number} opts.frameW - Single frame width
     * @param {number} opts.frameH - Single frame height
     * @param {number} opts.frameCount - Number of frames
     * @returns {ImageData} - Shifted and expanded pixel data
     */
    window.shiftAndExpand = function (srcImg, opts) {
      const { yShift, bulkPasses = 2, fillColors, sheetW, frameW, frameH, frameCount } = opts;

      // Read source pixels
      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = sheetW; srcCanvas.height = frameH;
      const srcCtx = srcCanvas.getContext("2d");
      srcCtx.drawImage(srcImg, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, sheetW, frameH);

      // Create output with shifted pixels
      const outCanvas = document.createElement("canvas");
      outCanvas.width = sheetW; outCanvas.height = frameH;
      const outCtx = outCanvas.getContext("2d");
      const outData = outCtx.getImageData(0, 0, sheetW, frameH);

      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < sheetW; x++) {
          const srcY = y - yShift;
          if (srcY < 0 || srcY >= frameH) continue;
          const si = (srcY * sheetW + x) * 4;
          const di = (y * sheetW + x) * 4;
          if (srcData.data[si + 3] === 0) continue;
          outData.data[di]     = srcData.data[si];
          outData.data[di + 1] = srcData.data[si + 1];
          outData.data[di + 2] = srcData.data[si + 2];
          outData.data[di + 3] = srcData.data[si + 3];
        }
      }

      // Expand silhouette — separate read/write buffers per pass to prevent cascade
      let current = new Uint8ClampedArray(outData.data);
      for (let pass = 0; pass < bulkPasses; pass++) {
        const readBuf = current;
        const writeBuf = new Uint8ClampedArray(readBuf);
        const color = fillColors[Math.min(pass, fillColors.length - 1)];

        for (let frame = 0; frame < frameCount; frame++) {
          const fx = frame * frameW;
          for (let y = 0; y < frameH; y++) {
            for (let lx = 0; lx < frameW; lx++) {
              const x = fx + lx;
              const i = (y * sheetW + x) * 4;
              if (readBuf[i + 3] > 0) continue;

              let hasNeighbor = false;
              for (let dy = -1; dy <= 1 && !hasNeighbor; dy++) {
                for (let dx = -1; dx <= 1 && !hasNeighbor; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  const nx = lx + dx, ny = y + dy;
                  if (nx < 0 || nx >= frameW || ny < 0 || ny >= frameH) continue;
                  if (readBuf[(ny * sheetW + fx + nx) * 4 + 3] > 0) hasNeighbor = true;
                }
              }

              if (hasNeighbor) {
                writeBuf[i] = color[0]; writeBuf[i+1] = color[1];
                writeBuf[i+2] = color[2]; writeBuf[i+3] = 255;
              }
            }
          }
        }
        current = writeBuf;
      }

      for (let j = 0; j < outData.data.length; j++) outData.data[j] = current[j];
      return outData;
    };

    /**
     * Compare color palettes between a reference sprite and a target sprite to detect
     * missing visual features. Categorizes colors into coarse hue/luminance groups
     * and reports which groups exist in one sprite but not the other.
     *
     * @param {HTMLImageElement} refImg - Reference sprite sheet (e.g. NPC side-view)
     * @param {HTMLImageElement} targetImg - Target sprite sheet (e.g. generated output or Body_A)
     * @param {number} frameW - Frame width
     * @param {number} frameH - Frame height
     * @param {number} frameCount - Number of frames to sample
     * @returns {{ onlyInRef: string[], onlyInTarget: string[], shared: string[], summary: string }}
     */
    window.compareFeaturePalettes = function (refImg, targetImg, frameW, frameH, frameCount) {
      // Categorize an RGB color into a coarse group name
      function categorize(r, g, b) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;

        // Near-black / outline
        if (lum < 30) return "black/outline";
        // Near-white / highlight
        if (lum > 230 && sat < 0.15) return "white/near-white";
        // Low saturation grays
        if (sat < 0.15) {
          if (lum < 100) return "dark-gray";
          if (lum < 180) return "mid-gray";
          return "light-gray";
        }

        // Chromatic — classify by dominant hue range
        const hue = rgbToHue(r, g, b);
        if (hue < 15 || hue >= 345) return "red";
        if (hue < 45) return "warm-orange";
        if (hue < 70) return "yellow";
        if (hue < 160) return "green";
        if (hue < 200) return "cyan/teal";
        if (hue < 260) return "blue";
        if (hue < 310) return "purple/violet";
        return "pink/magenta";
      }

      function rgbToHue(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        if (d === 0) return 0;
        let h;
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = Math.round(h * 60);
        return h < 0 ? h + 360 : h;
      }

      function extractGroups(img) {
        const c = document.createElement("canvas");
        const sheetW = frameW * frameCount;
        c.width = sheetW; c.height = frameH;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, sheetW, frameH);
        const data = ctx.getImageData(0, 0, sheetW, frameH).data;

        const groups = {};
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;
          const group = categorize(data[i], data[i + 1], data[i + 2]);
          groups[group] = (groups[group] || 0) + 1;
        }
        return groups;
      }

      const refGroups = extractGroups(refImg);
      const targetGroups = extractGroups(targetImg);

      const allGroups = new Set([...Object.keys(refGroups), ...Object.keys(targetGroups)]);
      const onlyInRef = [];
      const onlyInTarget = [];
      const shared = [];

      for (const g of allGroups) {
        const inRef = (refGroups[g] || 0) > 5;    // threshold: at least 5 pixels
        const inTgt = (targetGroups[g] || 0) > 5;
        if (inRef && inTgt) shared.push(g);
        else if (inRef) onlyInRef.push(g);
        else if (inTgt) onlyInTarget.push(g);
      }

      const lines = ["=== Feature Palette Comparison ==="];
      lines.push(`Shared groups: ${shared.join(", ") || "(none)"}`);
      if (onlyInRef.length) {
        lines.push(`ONLY in reference (may be missing features): ${onlyInRef.join(", ")}`);
      }
      if (onlyInTarget.length) {
        lines.push(`ONLY in target (extra colors): ${onlyInTarget.join(", ")}`);
      }
      if (!onlyInRef.length && !onlyInTarget.length) {
        lines.push("All color groups present in both sprites.");
      }

      return {
        onlyInRef,
        onlyInTarget,
        shared,
        summary: lines.join("\n"),
      };
    };

    /**
     * Convenience wrapper: compare palettes and log a formatted summary via console.warn.
     *
     * @param {HTMLImageElement} refImg - Reference sprite sheet
     * @param {HTMLImageElement} targetImg - Target sprite sheet
     * @param {number} frameW - Frame width
     * @param {number} frameH - Frame height
     * @param {number} frameCount - Number of frames
     * @returns {{ onlyInRef: string[], onlyInTarget: string[], shared: string[], summary: string }}
     */
    window.auditFeatures = function (refImg, targetImg, frameW, frameH, frameCount) {
      const result = compareFeaturePalettes(refImg, targetImg, frameW, frameH, frameCount);
      console.warn(result.summary);
      if (result.onlyInRef.length > 0) {
        console.warn(
          `⚠ WARNING: ${result.onlyInRef.length} color group(s) in reference but missing from target: ${result.onlyInRef.join(", ")}\n` +
          "These may represent features (beard, staff, hat, etc.) not yet drawn."
        );
      }
      return result;
    };
  });

  const cleanup = async () => {
    await browser.close();
    server.close();
  };

  return { page, browser, baseUrl, cleanup };
}

/**
 * Save a canvas element to a PNG file.
 *
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector for the canvas element
 * @param {string} outputPath - Absolute or relative path for the output PNG
 */
export async function saveCanvas(page, selector, outputPath) {
  const dataUrl = await page.evaluate((sel) => {
    const canvas = document.querySelector(sel);
    if (!canvas) throw new Error(`Canvas not found: ${sel}`);
    return canvas.toDataURL("image/png");
  }, selector);

  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const absPath = resolve(outputPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, buffer);
  console.log(`[asset-studio] Saved ${absPath} (${buffer.length} bytes)`);
}

/**
 * Generate a multi-scale preview image for visual inspection.
 * Renders each canvas at 1x, 4x, 8x zoom side-by-side.
 *
 * @param {Page} page - Playwright page
 * @param {string[]} canvasSelectors - CSS selectors for canvases to preview
 * @param {string} outputPath - Path for the preview PNG (usually /tmp/)
 */
export async function savePreview(page, canvasSelectors, outputPath) {
  await page.evaluate((selectors) => {
    const scales = [1, 4, 8];
    const padding = 8;
    const labelHeight = 16;

    // Collect source canvases
    const sources = selectors.map((sel) => {
      const c = document.querySelector(sel);
      if (!c) throw new Error(`Canvas not found: ${sel}`);
      return { canvas: c, label: sel.replace("#", "") };
    });

    // Calculate total dimensions
    let totalW = padding;
    let totalH = 0;
    for (const src of sources) {
      let rowW = padding;
      let rowH = 0;
      for (const scale of scales) {
        rowW += src.canvas.width * scale + padding;
        rowH = Math.max(rowH, src.canvas.height * scale);
      }
      totalW = Math.max(totalW, rowW);
      totalH += rowH + labelHeight + padding * 2;
    }

    // Create preview canvas
    let existing = document.querySelector("#__preview");
    if (existing) existing.remove();
    const preview = document.createElement("canvas");
    preview.id = "__preview";
    preview.width = totalW;
    preview.height = totalH;
    document.body.appendChild(preview);
    const ctx = preview.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // Dark background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, totalW, totalH);

    let yOff = padding;
    for (const src of sources) {
      // Label
      ctx.fillStyle = "#aaa";
      ctx.font = "12px monospace";
      ctx.fillText(src.label, padding, yOff + 12);
      yOff += labelHeight;

      let xOff = padding;
      let maxH = 0;
      for (const scale of scales) {
        const sw = src.canvas.width * scale;
        const sh = src.canvas.height * scale;

        // Scale label
        ctx.fillStyle = "#666";
        ctx.font = "10px monospace";
        ctx.fillText(`${scale}x`, xOff, yOff - 2);

        // Draw scaled
        ctx.drawImage(src.canvas, xOff, yOff, sw, sh);

        // Border
        ctx.strokeStyle = "#444";
        ctx.strokeRect(xOff - 0.5, yOff - 0.5, sw + 1, sh + 1);

        xOff += sw + padding;
        maxH = Math.max(maxH, sh);
      }
      yOff += maxH + padding;
    }
  }, canvasSelectors);

  await saveCanvas(page, "#__preview", outputPath);
}

/**
 * Clean up browser and asset server.
 *
 * @param {Browser} browser - Playwright browser instance
 * @deprecated Use cleanup() returned from openStudio() instead
 */
export async function closeStudio(browser) {
  await browser.close();
}
