/**
 * sync-map.mjs — Convert Tiled .tmx/.tmj → game-ready town.json
 *
 * Handles infinite (chunk-based) maps, resolves external .tsx tilesets,
 * maps image paths to web paths, and only includes used tilesets.
 * Supports both TMX (XML) and TMJ (JSON) Tiled formats.
 *
 * Usage:  node scripts/sync-map.mjs [path-to-tmx-or-tmj]
 * Default: apps/client/public/assets/maps/town.tmj
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_DIR = resolve(ROOT, "apps/client/public");
const OUT_PATH = resolve(PUBLIC_DIR, "assets/maps/town.json");

const TMX_PATH = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, "tiled/The Fan-tasy Tileset (Premium)/Tiled/Tilesets/island.tmx");

const tmx = readFileSync(TMX_PATH, "utf-8");
const tmxDir = dirname(TMX_PATH);

// ── GID → tile type resolver ─────────────────────────────────────────────
// Reads tile type attributes from .tsx files to map GIDs to semantic types
// (e.g. "npc", "route", "wander", "spawn").
// For route/wander tiles, localId (0–9) doubles as the color index so
// up to 10 distinct route colors can coexist on object layers.
function buildGidTypeMap(tilesetRefs, baseDir) {
  const gidTypeMap = new Map(); // gid → { type, npcType, localId, pauseChance?, pauseMinMs?, pauseMaxMs? }
  const NPC_TYPE_BY_TILE_ID = { 3: "guard", 4: "elder", 5: "merchant", 6: "villager", 47: "dog", 48: "captain" };

  for (const ref of tilesetRefs) {
    const firstgid = ref.firstgid;
    const tsxPath = resolve(baseDir, ref.source);
    let tsx;
    try { tsx = readFileSync(tsxPath, "utf-8"); } catch { continue; }

    // Parse full <tile>...</tile> blocks (and self-closing <tile ... />)
    const tileBlockRegex = /<tile\s+id="(\d+)"(?:\s+type="([^"]*)")?[^>]*(?:\/>|>([\s\S]*?)<\/tile>)/g;
    let m;
    while ((m = tileBlockRegex.exec(tsx)) !== null) {
      const localId = parseInt(m[1]);
      const type = m[2] || null;
      if (!type) continue;

      const entry = {
        type,
        localId,
        npcType: NPC_TYPE_BY_TILE_ID[localId] || null,
      };

      // For NPC tiles, extract pause properties from <property> elements
      const inner = m[3] || "";
      if (type === "npc" && inner) {
        const propRegex = /<property\s+name="([^"]+)"(?:\s+type="([^"]+)")?\s+value="([^"]*)"\s*\/>/g;
        let pm;
        while ((pm = propRegex.exec(inner)) !== null) {
          const pName = pm[1], pType = pm[2], pValue = pm[3];
          if (pName === "pauseChance") entry.pauseChance = parseFloat(pValue);
          else if (pName === "pauseMinMs") entry.pauseMinMs = parseInt(pValue);
          else if (pName === "pauseMaxMs") entry.pauseMaxMs = parseInt(pValue);
          else if (pName === "dialogKey") entry.dialogKey = pValue;
        }
      }

      gidTypeMap.set(firstgid + localId, entry);
    }
  }
  return gidTypeMap;
}

// ── NPC extraction ────────────────────────────────────────────────────────
// NPCs come from object layers (by GID type "npc").
// Route waypoints also come from object layers (GID type "route" or "wander").
// Each route tile's localId (0–9) is its color index. Using object layers
// (not tile layers) allows multiple colors to occupy the same tile position,
// enabling route crossings.
// Flood-fill only connects adjacent waypoints of the SAME color, so up to
// 10 independent routes can coexist without mixing.
function extractNpcData(objectLayers, gidTypeMap, tileW, tileH) {
  const allNpcs = [];
  const allWaypoints = []; // { tileX, tileY, colorIdx }

  // NPCs and route waypoints from object layers
  for (const ol of objectLayers) {
    for (const obj of ol.objects) {
      if (!obj.gid) continue;
      const gid = (obj.gid & 0x1fffffff) >>> 0;
      const info = gidTypeMap.get(gid);
      if (!info) continue;

      const tileX = Math.floor(obj.x / tileW);
      const tileY = Math.floor((obj.y - tileH) / tileH);

      if (info.type === "npc") {
        // Support object-level property overrides for pause config
        const pauseOverrides = {};
        if (obj.properties) {
          for (const p of obj.properties) {
            if (p.name === "pauseChance") pauseOverrides.pauseChance = Number(p.value);
            else if (p.name === "pauseMinMs") pauseOverrides.pauseMinMs = Number(p.value);
            else if (p.name === "pauseMaxMs") pauseOverrides.pauseMaxMs = Number(p.value);
            else if (p.name === "dialogKey") pauseOverrides.dialogKey = String(p.value);
          }
        }
        allNpcs.push({
          name: obj.name || "NPC",
          npcType: info.npcType || "villager",
          tileX, tileY,
          // Merge: object overrides > tile defaults
          ...(info.pauseChance !== undefined && { pauseChance: info.pauseChance }),
          ...(info.pauseMinMs !== undefined && { pauseMinMs: info.pauseMinMs }),
          ...(info.pauseMaxMs !== undefined && { pauseMaxMs: info.pauseMaxMs }),
          ...(info.dialogKey !== undefined && { dialogKey: info.dialogKey }),
          ...pauseOverrides,
        });
      } else if (info.type === "route" || info.type === "wander") {
        const colorIdx = Math.floor((info.localId - 7) / 4);
        allWaypoints.push({ tileX, tileY, colorIdx });
      }
    }
  }

  // Also add NPC positions as waypoints — inherit color from the route tile
  // they stand on, or default to 0
  for (const npc of allNpcs) {
    const existing = allWaypoints.find(wp => wp.tileX === npc.tileX && wp.tileY === npc.tileY);
    if (!existing) {
      allWaypoints.push({ tileX: npc.tileX, tileY: npc.tileY, colorIdx: 0 });
    }
  }

  // Flood-fill connected components — only connect same-color neighbors.
  // Key includes colorIdx so overlapping routes (different colors at the
  // same tile) are treated as separate nodes.
  const wpMap = new Map(); // "x,y,colorIdx" → waypoint
  for (const wp of allWaypoints) wpMap.set(`${wp.tileX},${wp.tileY},${wp.colorIdx}`, wp);

  const visited = new Set();
  const components = [];
  for (const wp of allWaypoints) {
    const k = `${wp.tileX},${wp.tileY},${wp.colorIdx}`;
    if (visited.has(k)) continue;
    const comp = [];
    const queue = [wp];
    visited.add(k);
    while (queue.length > 0) {
      const cur = queue.shift();
      comp.push(cur);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nk = `${cur.tileX + dx},${cur.tileY + dy},${cur.colorIdx}`;
        if (visited.has(nk)) continue;
        const neighbor = wpMap.get(nk);
        if (neighbor) {
          visited.add(nk);
          queue.push(neighbor);
        }
      }
    }
    components.push(comp);
  }

  // Assign NPCs to their connected path
  const npcDefs = [];
  const routesByName = {};
  const compRouteNames = new Map();

  for (const npc of allNpcs) {
    const ci = components.findIndex(c => c.some(t => t.tileX === npc.tileX && t.tileY === npc.tileY));
    if (ci === -1) continue;

    let routeName = compRouteNames.get(ci);
    if (!routeName) {
      routeName = `route-${compRouteNames.size}`;
      compRouteNames.set(ci, routeName);
      routesByName[routeName] = components[ci].map(t => ({
        tileX: t.tileX, tileY: t.tileY,
      }));
    }

    npcDefs.push({
      id: `npc-${npc.npcType}-${npcDefs.length}`, name: npc.name, npcType: npc.npcType, route: routeName,
      ...(npc.dialogKey !== undefined && { dialogKey: npc.dialogKey }),
      ...(npc.pauseChance !== undefined && { pauseChance: npc.pauseChance }),
      ...(npc.pauseMinMs !== undefined && { pauseMinMs: npc.pauseMinMs }),
      ...(npc.pauseMaxMs !== undefined && { pauseMaxMs: npc.pauseMaxMs }),
    });
  }

  return { npcDefs, routesByName };
}

// ── TMJ (JSON) support ───────────────────────────────────────────────────
if (TMX_PATH.endsWith(".tmj") || tmx.trimStart().startsWith("{")) {
  processTmj(JSON.parse(tmx));
  process.exit(0);
}

function processTmj(tmj) {
  const mapW = tmj.width;
  const mapH = tmj.height;
  const tileW = tmj.tilewidth;
  const tileH = tmj.tileheight;
  console.log(`Map: ${mapW}x${mapH} (TMJ)`);

  // Resolve tilesets (same .tsx resolution as TMX path)
  const usedGids = new Set();
  const outputLayers = [];

  // Recursively collect layers (handles groups)
  const allLayerData = [];
  const allObjectLayers = []; // { name, parentGroup, objects }
  function walkTmjLayers(layers, parentGroup) {
    for (const layer of layers) {
      if (layer.type === "group" && layer.layers) {
        walkTmjLayers(layer.layers, layer.name);
      } else if (layer.type === "tilelayer" && layer.data) {
        allLayerData.push({ name: layer.name, data: layer.data });
        for (const gid of layer.data) {
          if (gid !== 0) usedGids.add((gid & 0x1fffffff) >>> 0);
        }
      } else if (layer.type === "objectgroup" && layer.objects) {
        for (const obj of layer.objects) {
          if (obj.gid) usedGids.add((obj.gid & 0x1fffffff) >>> 0);
        }
        allObjectLayers.push({ name: layer.name, parentGroup, objects: layer.objects });
      }
    }
  }
  walkTmjLayers(tmj.layers, null);
  console.log(`  ${usedGids.size} unique tile GIDs used`);

  // Resolve external tilesets from .tsx refs
  const tilesets = [];
  let skipped = 0;
  for (const tsRef of (tmj.tilesets || [])) {
    if (!tsRef.source) { skipped++; continue; }
    const firstgid = tsRef.firstgid;
    const tsxPath = resolve(tmxDir, tsRef.source);

    let tsx;
    try { tsx = readFileSync(tsxPath, "utf-8"); } catch {
      console.warn(`  SKIP (not found): ${tsRef.source}`);
      skipped++;
      continue;
    }

    const nameMatch = tsx.match(/name="([^"]+)"/);
    const twMatch = tsx.match(/tilewidth="(\d+)"/);
    const thMatch = tsx.match(/tileheight="(\d+)"/);
    const tcMatch = tsx.match(/tilecount="(\d+)"/);
    const colsMatch = tsx.match(/columns="(\d+)"/);

    const name = nameMatch?.[1] ?? "unknown";
    const tilewidth = parseInt(twMatch?.[1] ?? "16");
    const tileheight = parseInt(thMatch?.[1] ?? "16");
    const tilecount = parseInt(tcMatch?.[1] ?? "0");
    const columns = parseInt(colsMatch?.[1] ?? "0");

    const tileIds = [...tsx.matchAll(/<tile id="(\d+)"/g)].map((m) => parseInt(m[1]));
    const maxTileId = tileIds.length > 0 ? Math.max(...tileIds) + 1 : tilecount;
    const maxGid = firstgid + Math.max(tilecount, maxTileId);
    const isUsed = [...usedGids].some((g) => g >= firstgid && g < maxGid);
    if (!isUsed) { skipped++; continue; }

    const imgMatch = tsx.match(/<image source="([^"]+)" width="(\d+)" height="(\d+)"\/>/);

    if (imgMatch && columns > 0) {
      const imgAbsPath = resolve(dirname(tsxPath), imgMatch[1]);
      let webPath;
      if (imgAbsPath.startsWith(PUBLIC_DIR)) {
        webPath = "/" + imgAbsPath.slice(PUBLIC_DIR.length + 1);
      } else {
        const artRelPath = imgMatch[1].replace(/^(\.\.\/)*/, "");
        const publicCopy = resolve(PUBLIC_DIR, "assets", artRelPath);
        try { readFileSync(publicCopy); webPath = "/assets/" + artRelPath; } catch {
          console.warn(`  SKIP (image not in public): ${name} → ${imgAbsPath}`);
          skipped++;
          continue;
        }
      }

      const tilesetObj = { firstgid, name, image: webPath, imagewidth: parseInt(imgMatch[2]), imageheight: parseInt(imgMatch[3]), tilewidth, tileheight, tilecount, columns };
      const animations = parseAnimations(tsx, columns, tilewidth, tileheight, name);
      if (Object.keys(animations).length > 0) tilesetObj.animations = animations;
      tilesets.push(tilesetObj);
      const animCount = Object.keys(animations).length;
      console.log(`  Atlas: ${name} (gid=${firstgid}, ${webPath}${animCount ? `, ${animCount} animated` : ""})`);
    } else {
      const tileMatches = [...tsx.matchAll(/<tile id="(\d+)">\s*<image ([^>]+)\/>/g)];
      if (tileMatches.length === 0) { skipped++; continue; }
      const tiles = [];
      for (const [, id, attrs] of tileMatches) {
        const src = attrs.match(/source="([^"]+)"/)?.[1];
        const w = attrs.match(/width="(\d+)"/)?.[1];
        const h = attrs.match(/height="(\d+)"/)?.[1];
        if (!src || !w || !h) continue;
        const tileGid = firstgid + parseInt(id);
        if (!usedGids.has(tileGid)) continue;
        const imgAbsPath = resolve(dirname(tsxPath), src);
        let webPath;
        if (imgAbsPath.startsWith(PUBLIC_DIR)) { webPath = "/" + imgAbsPath.slice(PUBLIC_DIR.length + 1); }
        else { webPath = "/assets/" + src.replace(/^(\.\.\/)*/, ""); }
        tiles.push({ id: parseInt(id), image: webPath, imagewidth: parseInt(w), imageheight: parseInt(h) });
      }
      if (tiles.length === 0) { skipped++; continue; }
      tilesets.push({ firstgid, name, tilewidth, tileheight, tilecount, columns, tiles });
      console.log(`  Collection: ${name} (gid=${firstgid}, ${tiles.length} tiles)`);
    }
  }

  // Build output layers — collision merge + tile layers + object layers
  const collisionLayers = allLayerData.filter((ld) => ld.name.toLowerCase() === "collision");
  let mergedCollision = null;
  if (collisionLayers.length > 0) {
    mergedCollision = new Array(mapW * mapH).fill(0);
    for (const cl of collisionLayers) {
      for (let i = 0; i < cl.data.length; i++) { if (cl.data[i] !== 0) mergedCollision[i] = 1; }
    }
    for (let x = 0; x < mapW; x++) { mergedCollision[x] = 1; mergedCollision[(mapH - 1) * mapW + x] = 1; }
    for (let y = 0; y < mapH; y++) { mergedCollision[y * mapW] = 1; mergedCollision[y * mapW + (mapW - 1)] = 1; }
    const blocked = mergedCollision.filter((v) => v === 1).length;
    console.log(`  Layer: collision (${mapW}x${mapH}, ${blocked} blocked, merged from ${collisionLayers.length} layers)`);
  }

  for (const ld of allLayerData) {
    if (ld.name.toLowerCase() === "collision") continue;
    console.log(`  Layer: ${ld.name} (${mapW}x${mapH})`);
    outputLayers.push({ name: ld.name, type: "tilelayer", width: mapW, height: mapH, visible: true, data: ld.data });
  }
  if (mergedCollision) {
    outputLayers.push({ name: "collision", type: "tilelayer", width: mapW, height: mapH, visible: false, data: mergedCollision });
  }

  // Object layers (pass through to output, including properties)
  for (const ol of allObjectLayers) {
    const objects = ol.objects.map((obj) => {
      const out = { x: obj.x, y: obj.y };
      if (obj.gid) { out.gid = obj.gid; out.width = obj.width || 0; out.height = obj.height || 0; }
      if (obj.point) out.point = true;
      if (obj.name) out.name = obj.name;
      if (obj.type) out.type = obj.type;
      if (obj.properties) out.properties = obj.properties;
      return out;
    });
    outputLayers.push({ name: ol.name, type: "objectgroup", width: mapW, height: mapH, visible: true, objects });
    console.log(`  ObjectGroup: ${ol.name} (${objects.length} objects${ol.parentGroup ? `, group: ${ol.parentGroup}` : ""})`);
  }

  // Ensure collision layer
  if (!outputLayers.some((l) => l.name.toLowerCase() === "collision")) {
    console.log("  Generating collision layer (border walls)");
    const data = new Array(mapW * mapH).fill(0);
    for (let x = 0; x < mapW; x++) { data[x] = 1; data[(mapH - 1) * mapW + x] = 1; }
    for (let y = 0; y < mapH; y++) { data[y * mapW] = 1; data[y * mapW + (mapW - 1)] = 1; }
    outputLayers.push({ name: "collision", type: "tilelayer", width: mapW, height: mapH, visible: false, data });
  }

  // Extract NPC definitions and routes using GID type resolution
  const gidTypeMap = buildGidTypeMap(tmj.tilesets || [], tmxDir);
  const { npcDefs, routesByName } = extractNpcData(allObjectLayers, gidTypeMap, tileW, tileH);

  if (npcDefs.length > 0) {
    console.log(`  NPCs: ${npcDefs.length} defined`);
    for (const npc of npcDefs) {
      console.log(`    ${npc.id}: "${npc.name}" (${npc.npcType}) route="${npc.route}"`);
    }
  }
  const routeCount = Object.keys(routesByName).length;
  if (routeCount > 0) {
    console.log(`  Routes: ${routeCount} defined`);
    for (const [rname, wps] of Object.entries(routesByName)) {
      console.log(`    ${rname}: ${wps.length} waypoints`);
    }
  }

  const output = {
    width: mapW, height: mapH, tilewidth: tileW, tileheight: tileH,
    orientation: "orthogonal", renderorder: "right-down",
    tilesets, layers: outputLayers,
    ...(npcDefs.length > 0 ? { npcs: npcDefs } : {}),
    ...(routeCount > 0 ? { routes: routesByName } : {}),
  };

  writeFileSync(OUT_PATH, JSON.stringify(output));
  console.log(`\nWrote ${OUT_PATH}\n  ${tilesets.length} tilesets (${skipped} skipped), ${outputLayers.length} layers`);
}

// ── TMX (XML) path below ─────────────────────────────────────────────────

// ── Parse map attributes ───────────────────────────────────────────────────
const isInfinite = /infinite="1"/.test(tmx);
const declaredW = parseInt(tmx.match(/\bwidth="(\d+)"/)?.[1] ?? "40");
const declaredH = parseInt(tmx.match(/\bheight="(\d+)"/)?.[1] ?? "40");
const tileW = parseInt(tmx.match(/tilewidth="(\d+)"/)?.[1] ?? "16");
const tileH = parseInt(tmx.match(/tileheight="(\d+)"/)?.[1] ?? "16");

// ── Parse tilesets ─────────────────────────────────────────────────────────
const tilesetRefs = [...tmx.matchAll(/<tileset firstgid="(\d+)" source="([^"]+)"\/>/g)];

// ── Parse animations from .tsx ────────────────────────────────────────
function parseAnimations(tsx, columns, tilewidth, tileheight, name) {
  const animations = {};
  const tileRegex = /<tile id="(\d+)">([\s\S]*?)<\/tile>/g;
  let match;
  while ((match = tileRegex.exec(tsx)) !== null) {
    const localTileId = parseInt(match[1]);
    const inner = match[2];

    const animMatch = inner.match(/<animation>([\s\S]*?)<\/animation>/);
    if (!animMatch) continue;

    const frames = [...animMatch[1].matchAll(/<frame tileid="(\d+)" duration="(\d+)"\/>/g)];
    if (frames.length < 2) continue;

    const frameIds = frames.map((f) => parseInt(f[1]));
    const duration = parseInt(frames[0][2]);

    // Compute pixel positions of each frame in the atlas
    const positions = frameIds.map((id) => ({
      x: (id % columns) * tilewidth,
      y: Math.floor(id / columns) * tileheight,
    }));

    // Delta between consecutive frames
    const dx = positions[1].x - positions[0].x;
    const dy = positions[1].y - positions[0].y;

    // Verify uniform spacing
    let uniform = true;
    for (let i = 2; i < positions.length; i++) {
      const expectedX = positions[0].x + i * dx;
      const expectedY = positions[0].y + i * dy;
      if (positions[i].x !== expectedX || positions[i].y !== expectedY) {
        uniform = false;
        break;
      }
    }

    if (!uniform) {
      console.warn(`  WARN: Non-uniform animation for tile ${localTileId} in ${name}, skipping`);
      continue;
    }

    animations[localTileId] = { animX: dx, animY: dy, animCountX: frames.length, animDivisor: duration };
  }
  return animations;
}

// ── Parse layers (handles both flat and chunk-based) ───────────────────────
function parseTileLayers() {
  const layers = [];
  // Match tile layers
  const layerRegex = /<layer[^>]*?\bid="(\d+)"[^>]*?\bname="([^"]+)"[^>]*?>([\s\S]*?)<\/layer>/g;
  let match;
  while ((match = layerRegex.exec(tmx)) !== null) {
    const [, , name, body] = match;
    layers.push({ name, type: "tilelayer", body });
  }
  return layers;
}

function parseObjectProperties(inner) {
  const props = [];
  const propsBlock = inner.match(/<properties>([\s\S]*?)<\/properties>/);
  if (!propsBlock) return props;
  const propRegex = /<property\s+([^>]*?)\/>/g;
  let pm;
  while ((pm = propRegex.exec(propsBlock[1])) !== null) {
    const pAttrs = pm[1];
    const pName = pAttrs.match(/\bname="([^"]+)"/)?.[1];
    const pType = pAttrs.match(/\btype="([^"]+)"/)?.[1];
    const pValue = pAttrs.match(/\bvalue="([^"]*)"/)?.[1];
    if (!pName || pValue === undefined) continue;
    let val;
    if (pType === "int" || pType === "float") val = Number(pValue);
    else if (pType === "bool") val = pValue === "true";
    else val = pValue;
    props.push({ name: pName, ...(pType ? { type: pType } : {}), value: val });
  }
  return props;
}

/** Parse objects from a single objectgroup body XML */
function parseObjectsFromBody(body) {
  const objects = [];
  const objRegex = /<object\b([^>]*?)(?:\/>|>([\s\S]*?)<\/object>)/g;
  let om;
  while ((om = objRegex.exec(body)) !== null) {
    const attrs = om[1];
    const inner = om[2] || "";
    const x = attrs.match(/\bx="([^"]+)"/);
    const y = attrs.match(/\by="([^"]+)"/);
    if (!x || !y) continue;

    const gidMatch = attrs.match(/\bgid="(\d+)"/);
    const nameMatch = attrs.match(/\bname="([^"]+)"/);
    const typeMatch = attrs.match(/\btype="([^"]+)"/);
    const isPoint = /<point\s*\/>/.test(inner);
    const properties = parseObjectProperties(inner);

    if (gidMatch) {
      const wMatch = attrs.match(/\bwidth="([^"]+)"/);
      const hMatch = attrs.match(/\bheight="([^"]+)"/);
      const obj = {
        gid: parseInt(gidMatch[1]),
        x: parseFloat(x[1]),
        y: parseFloat(y[1]),
        width: parseFloat(wMatch?.[1] ?? "0"),
        height: parseFloat(hMatch?.[1] ?? "0"),
      };
      if (nameMatch) obj.name = nameMatch[1];
      if (typeMatch) obj.type = typeMatch[1];
      if (properties.length > 0) obj.properties = properties;
      objects.push(obj);
    } else if (isPoint) {
      const obj = {
        x: parseFloat(x[1]),
        y: parseFloat(y[1]),
        point: true,
      };
      if (nameMatch) obj.name = nameMatch[1];
      if (typeMatch) obj.type = typeMatch[1];
      if (properties.length > 0) obj.properties = properties;
      objects.push(obj);
    }
  }
  return objects;
}

function parseObjectLayers() {
  const layers = [];

  // Parse groups first — find objectgroups inside <group> elements
  const groupRegex = /<group[^>]*?\bname="([^"]+)"[^>]*?>([\s\S]*?)<\/group>/g;
  let gm;
  while ((gm = groupRegex.exec(tmx)) !== null) {
    const groupName = gm[1];
    const groupBody = gm[2];
    // Find objectgroups within this group
    const ogRegex = /<objectgroup[^>]*?\bname="([^"]+)"[^>]*?>([\s\S]*?)<\/objectgroup>/g;
    let ogm;
    while ((ogm = ogRegex.exec(groupBody)) !== null) {
      const name = ogm[1];
      const objects = parseObjectsFromBody(ogm[2]);
      layers.push({ name, type: "objectgroup", objects, parentGroup: groupName });
    }
  }

  // Parse top-level objectgroups (not inside a group)
  // Remove group blocks first to avoid double-matching
  const tmxNoGroups = tmx.replace(/<group[^>]*?>[\s\S]*?<\/group>/g, "");
  const topRegex = /<objectgroup[^>]*?\bname="([^"]+)"[^>]*?>([\s\S]*?)<\/objectgroup>/g;
  let tm;
  while ((tm = topRegex.exec(tmxNoGroups)) !== null) {
    const name = tm[1];
    const objects = parseObjectsFromBody(tm[2]);
    layers.push({ name, type: "objectgroup", objects, parentGroup: null });
  }

  return layers;
}

// Parse chunks from a layer body → flat data array
function flattenChunks(body, mapW, mapH, originX, originY) {
  const data = new Array(mapW * mapH).fill(0);
  const chunkRegex = /<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">\s*([\s\S]*?)\s*<\/chunk>/g;
  let cm;
  while ((cm = chunkRegex.exec(body)) !== null) {
    const cx = parseInt(cm[1]) - originX;
    const cy = parseInt(cm[2]) - originY;
    const cw = parseInt(cm[3]);
    const csv = cm[5];
    const values = csv.split(",").map((s) => parseInt(s.trim())).filter((v) => !isNaN(v));
    for (let i = 0; i < values.length; i++) {
      const lx = cx + (i % cw);
      const ly = cy + Math.floor(i / cw);
      if (lx >= 0 && lx < mapW && ly >= 0 && ly < mapH) {
        data[ly * mapW + lx] = values[i];
      }
    }
  }
  return data;
}

// Parse flat CSV data
function parseFlatData(body) {
  const dataMatch = body.match(/<data encoding="csv">\s*([\s\S]*?)\s*<\/data>/);
  if (!dataMatch) return [];
  return dataMatch[1].split(",").map((s) => parseInt(s.trim())).filter((v) => !isNaN(v));
}

// ── Determine map bounds for infinite maps ─────────────────────────────────
let mapW, mapH, originX, originY;

if (isInfinite) {
  const allChunks = [...tmx.matchAll(/<chunk x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)">/g)];
  const xs = allChunks.map((c) => parseInt(c[1]));
  const ys = allChunks.map((c) => parseInt(c[2]));
  const ws = allChunks.map((c) => parseInt(c[3]));
  const hs = allChunks.map((c) => parseInt(c[4]));
  originX = Math.min(...xs);
  originY = Math.min(...ys);
  mapW = Math.max(...xs.map((x, i) => x + ws[i])) - originX;
  mapH = Math.max(...ys.map((y, i) => y + hs[i])) - originY;
  console.log(`Map: ${mapW}x${mapH} (infinite, origin=${originX},${originY})`);
} else {
  mapW = declaredW;
  mapH = declaredH;
  originX = 0;
  originY = 0;
  console.log(`Map: ${mapW}x${mapH}`);
}

// ── Build layer data ───────────────────────────────────────────────────────
const tileLayers = parseTileLayers();
const objectLayers = parseObjectLayers();

const allLayerData = []; // { name, data[] } for finding used GIDs
const outputLayers = [];

for (const tl of tileLayers) {
  const data = isInfinite
    ? flattenChunks(tl.body, mapW, mapH, originX, originY)
    : parseFlatData(tl.body);

  allLayerData.push({ name: tl.name, data });
}

// Collect used GIDs
const usedGids = new Set();
for (const ld of allLayerData) {
  for (const gid of ld.data) {
    if (gid !== 0) usedGids.add((gid & 0x1fffffff) >>> 0);
  }
}
for (const ol of objectLayers) {
  for (const obj of ol.objects) {
    if (obj.gid) usedGids.add((obj.gid & 0x1fffffff) >>> 0);
  }
}
console.log(`  ${usedGids.size} unique tile GIDs used`);

// ── Resolve tilesets ───────────────────────────────────────────────────────
const tilesets = [];
let skipped = 0;

for (const [, firstgidStr, tsxRelPath] of tilesetRefs) {
  const firstgid = parseInt(firstgidStr);
  const tsxPath = resolve(tmxDir, tsxRelPath);

  let tsx;
  try {
    tsx = readFileSync(tsxPath, "utf-8");
  } catch {
    console.warn(`  SKIP (not found): ${tsxRelPath}`);
    skipped++;
    continue;
  }

  const nameMatch = tsx.match(/name="([^"]+)"/);
  const twMatch = tsx.match(/tilewidth="(\d+)"/);
  const thMatch = tsx.match(/tileheight="(\d+)"/);
  const tcMatch = tsx.match(/tilecount="(\d+)"/);
  const colsMatch = tsx.match(/columns="(\d+)"/);

  const name = nameMatch?.[1] ?? "unknown";
  const tilewidth = parseInt(twMatch?.[1] ?? "16");
  const tileheight = parseInt(thMatch?.[1] ?? "16");
  const tilecount = parseInt(tcMatch?.[1] ?? "0");
  const columns = parseInt(colsMatch?.[1] ?? "0");

  // Skip unused tilesets
  // For collection tilesets, tilecount in header may be less than max tile id
  const tileIds = [...tsx.matchAll(/<tile id="(\d+)"/g)].map((m) => parseInt(m[1]));
  const maxTileId = tileIds.length > 0 ? Math.max(...tileIds) + 1 : tilecount;
  const maxGid = firstgid + Math.max(tilecount, maxTileId);
  const isUsed = [...usedGids].some((g) => g >= firstgid && g < maxGid);
  if (!isUsed) {
    skipped++;
    continue;
  }

  const imgMatch = tsx.match(/<image source="([^"]+)" width="(\d+)" height="(\d+)"\/>/);

  if (imgMatch && columns > 0) {
    // Atlas tileset
    const imgAbsPath = resolve(dirname(tsxPath), imgMatch[1]);

    // Map to web path: try public dir first, then copy location
    let webPath;
    if (imgAbsPath.startsWith(PUBLIC_DIR)) {
      webPath = "/" + imgAbsPath.slice(PUBLIC_DIR.length + 1);
    } else {
      // Image is outside public dir — check if it was copied to assets/Art
      const artRelPath = imgMatch[1].replace(/^(\.\.\/)*/, "");
      const publicCopy = resolve(PUBLIC_DIR, "assets", artRelPath);
      try {
        readFileSync(publicCopy);
        webPath = "/assets/" + artRelPath;
      } catch {
        console.warn(`  SKIP (image not in public): ${name} → ${imgAbsPath}`);
        skipped++;
        continue;
      }
    }

    const tilesetObj = {
      firstgid,
      name,
      image: webPath,
      imagewidth: parseInt(imgMatch[2]),
      imageheight: parseInt(imgMatch[3]),
      tilewidth,
      tileheight,
      tilecount,
      columns,
    };

    // Parse tile animations
    const animations = parseAnimations(tsx, columns, tilewidth, tileheight, name);
    if (Object.keys(animations).length > 0) {
      tilesetObj.animations = animations;
    }

    tilesets.push(tilesetObj);
    const animCount = Object.keys(animations).length;
    console.log(`  Atlas: ${name} (gid=${firstgid}, ${webPath}${animCount ? `, ${animCount} animated` : ""})`);
  } else {
    // Collection tileset
    const tileMatches = [
      ...tsx.matchAll(/<tile id="(\d+)">\s*<image ([^>]+)\/>/g),
    ];
    if (tileMatches.length === 0) { skipped++; continue; }

    const tiles = [];
    for (const [, id, attrs] of tileMatches) {
      const src = attrs.match(/source="([^"]+)"/)?.[1];
      const w = attrs.match(/width="(\d+)"/)?.[1];
      const h = attrs.match(/height="(\d+)"/)?.[1];
      if (!src || !w || !h) continue;
      const tileGid = firstgid + parseInt(id);
      if (!usedGids.has(tileGid)) continue;
      const imgAbsPath = resolve(dirname(tsxPath), src);
      let webPath;
      if (imgAbsPath.startsWith(PUBLIC_DIR)) {
        webPath = "/" + imgAbsPath.slice(PUBLIC_DIR.length + 1);
      } else {
        const artRelPath = src.replace(/^(\.\.\/)*/, "");
        webPath = "/assets/" + artRelPath;
      }
      tiles.push({ id: parseInt(id), image: webPath, imagewidth: parseInt(w), imageheight: parseInt(h) });
    }
    if (tiles.length === 0) { skipped++; continue; }

    tilesets.push({ firstgid, name, tilewidth, tileheight, tilecount, columns, tiles });
    console.log(`  Collection: ${name} (gid=${firstgid}, ${tiles.length} tiles)`);
  }
}

// ── Build output layers ────────────────────────────────────────────────────
// Merge all collision layers into a single layer (OR together)
const collisionLayers = allLayerData.filter((ld) => ld.name.toLowerCase() === "collision");
let mergedCollision = null;
if (collisionLayers.length > 0) {
  mergedCollision = new Array(mapW * mapH).fill(0);
  for (const cl of collisionLayers) {
    for (let i = 0; i < cl.data.length; i++) {
      if (cl.data[i] !== 0) mergedCollision[i] = 1;
    }
  }
  // Border walls
  for (let x = 0; x < mapW; x++) {
    mergedCollision[x] = 1;
    mergedCollision[(mapH - 1) * mapW + x] = 1;
  }
  for (let y = 0; y < mapH; y++) {
    mergedCollision[y * mapW] = 1;
    mergedCollision[y * mapW + (mapW - 1)] = 1;
  }
  const blocked = mergedCollision.filter((v) => v === 1).length;
  console.log(`  Layer: collision (${mapW}x${mapH}, ${blocked} blocked, merged from ${collisionLayers.length} layers)`);
}

for (const ld of allLayerData) {
  if (ld.name.toLowerCase() === "collision") continue; // skip individual collision layers

  console.log(`  Layer: ${ld.name} (${mapW}x${mapH})`);
  outputLayers.push({
    name: ld.name,
    type: "tilelayer",
    width: mapW,
    height: mapH,
    visible: true,
    data: ld.data,
  });
}

// Add the single merged collision layer
if (mergedCollision) {
  outputLayers.push({
    name: "collision",
    type: "tilelayer",
    width: mapW,
    height: mapH,
    visible: false,
    data: mergedCollision,
  });
}

// Offset for object positions (infinite maps use negative coords)
const pixelOffsetX = originX * tileW;
const pixelOffsetY = originY * tileH;

// Apply offsets once and use for both output and NPC extraction
const offsetObjectLayers = objectLayers.map((ol) => ({
  ...ol,
  objects: ol.objects.map((obj) => ({
    ...obj,
    x: obj.x - pixelOffsetX,
    y: obj.y - pixelOffsetY,
  })),
}));

for (const ol of offsetObjectLayers) {
  outputLayers.push({
    name: ol.name,
    type: "objectgroup",
    width: mapW,
    height: mapH,
    visible: true,
    objects: ol.objects,
  });
  console.log(`  ObjectGroup: ${ol.name} (${ol.objects.length} objects${ol.parentGroup ? `, group: ${ol.parentGroup}` : ""})`);
}

// Ensure collision layer
if (!outputLayers.some((l) => l.name.toLowerCase() === "collision")) {
  console.log("  Generating collision layer (border walls)");
  const data = new Array(mapW * mapH).fill(0);
  for (let x = 0; x < mapW; x++) {
    data[x] = 1;
    data[(mapH - 1) * mapW + x] = 1;
  }
  for (let y = 0; y < mapH; y++) {
    data[y * mapW] = 1;
    data[y * mapW + (mapW - 1)] = 1;
  }
  outputLayers.push({ name: "collision", type: "tilelayer", width: mapW, height: mapH, visible: false, data });
}

// ── Extract NPC definitions and routes from object layers ──────────────────
// Build GID→type map from tileset refs, then extract NPC data
const tmxTilesetRefObjs = tilesetRefs.map(([, gidStr, src]) => ({
  firstgid: parseInt(gidStr),
  source: src,
}));
const gidTypeMap = buildGidTypeMap(tmxTilesetRefObjs, tmxDir);
const { npcDefs, routesByName } = extractNpcData(offsetObjectLayers, gidTypeMap, tileW, tileH);

if (npcDefs.length > 0) {
  console.log(`  NPCs: ${npcDefs.length} defined`);
  for (const npc of npcDefs) {
    console.log(`    ${npc.id}: "${npc.name}" (${npc.npcType}) route="${npc.route}"`);
  }
}
const routeCount = Object.keys(routesByName).length;
if (routeCount > 0) {
  console.log(`  Routes: ${routeCount} defined`);
  for (const [name, wps] of Object.entries(routesByName)) {
    console.log(`    ${name}: ${wps.length} waypoints`);
  }
}

// ── Write output ───────────────────────────────────────────────────────────
const output = {
  width: mapW,
  height: mapH,
  tilewidth: tileW,
  tileheight: tileH,
  orientation: "orthogonal",
  renderorder: "right-down",
  tilesets,
  layers: outputLayers,
  ...(npcDefs.length > 0 ? { npcs: npcDefs } : {}),
  ...(routeCount > 0 ? { routes: routesByName } : {}),
};

writeFileSync(OUT_PATH, JSON.stringify(output));
console.log(
  `\nWrote ${OUT_PATH}\n  ${tilesets.length} tilesets (${skipped} skipped), ${outputLayers.length} layers`
);
