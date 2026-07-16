<script>
  import { onMount, onDestroy } from "svelte";
  import { mapStore } from "$lib/stores/mapStore.svelte.js";
  import * as PIXI from "pixi.js";

  let canvasContainer;
  let pixiApp;
  let viewportContainer;
  let mapSprite;
  let gridContainer;
  let geometryContainer;
  let entitiesContainer;
  let shadowContainer;

  let scale = 1;
  let panX = 0;
  let panY = 0;

  let currentMapId = null;
  let isPanning = false;
  let dragStart = { x: 0, y: 0 };
  let originalPan = { x: 0, y: 0 };

  let draggedItemId = null;
  let lastDragGrid = null;

  let currentGridX = 0;
  let currentGridY = 0;

  let activeMap = $derived(mapStore.activeMap);
  let activeTool = $derived(mapStore.activeTool);
  let lightingPreview = $derived(mapStore.lightingPreview);

  let isPixiReady = $state(false);

  let draftingPath = $state([]);
  let draftingPreview = $state(null);

  onMount(async () => {
    if (!canvasContainer) return;

    pixiApp = new PIXI.Application();
    await pixiApp.init({
      resizeTo: window,
      backgroundColor: 0x05080e,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    pixiApp.canvas.style.position = "absolute";
    pixiApp.canvas.style.top = "0";
    pixiApp.canvas.style.left = "0";
    pixiApp.canvas.style.zIndex = "1";
    canvasContainer.appendChild(pixiApp.canvas);

    viewportContainer = new PIXI.Container();
    pixiApp.stage.addChild(viewportContainer);

    mapSprite = new PIXI.Sprite();
    viewportContainer.addChild(mapSprite);

    gridContainer = new PIXI.Container();
    viewportContainer.addChild(gridContainer);

    entitiesContainer = new PIXI.Container();
    viewportContainer.addChild(entitiesContainer);

    shadowContainer = new PIXI.Container();
    viewportContainer.addChild(shadowContainer);

    geometryContainer = new PIXI.Container();
    viewportContainer.addChild(geometryContainer);

    isPixiReady = true;
  });

  onDestroy(() => {
    if (pixiApp) pixiApp.destroy(true);
  });

  $effect(() => {
    const tick = mapStore.redrawTick;
    if (!isPixiReady || !activeMap) return;

    const safeManifest = JSON.parse(JSON.stringify(activeMap.manifest));

    if (currentMapId !== activeMap.id) {
      currentMapId = activeMap.id;
      loadMapImage(activeMap.imageUrl, safeManifest);
      centerMap(safeManifest);
    }

    applyOffsetsAndScale(safeManifest);
    drawCanvas(safeManifest);
  });

  async function loadMapImage(url, manifest) {
    if (!url) {
      mapSprite.texture = PIXI.Texture.EMPTY;
      return;
    }
    try {
      const texture = await PIXI.Assets.load(url);
      mapSprite.texture = texture;
      applyOffsetsAndScale(manifest);
    } catch (err) {
      console.error("Failed to load texture", err);
    }
  }

  function applyOffsetsAndScale(manifest) {
    if (!mapSprite || mapSprite.texture === PIXI.Texture.EMPTY) return;
    const res = manifest.resolution;
    const mapWidth = res.map_size[0] * res.pixels_per_grid;
    const mapHeight = res.map_size[1] * res.pixels_per_grid;

    mapSprite.width = mapWidth;
    mapSprite.height = mapHeight;
    mapSprite.position.set(
      Number(res.map_offset_x) || 0,
      Number(res.map_offset_y) || 0,
    );
  }

  function centerMap(manifest) {
    if (!viewportContainer) return;
    const res = manifest.resolution;
    const mapWidth = res.map_size[0] * res.pixels_per_grid;
    const mapHeight = res.map_size[1] * res.pixels_per_grid;

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    scale = Math.min((cw - 100) / mapWidth, (ch - 100) / mapHeight, 1);
    panX = (cw - mapWidth * scale) / 2;
    panY = (ch - mapHeight * scale) / 2;

    updateViewport();
  }

  function updateViewport() {
    if (viewportContainer) {
      viewportContainer.scale.set(scale);
      viewportContainer.position.set(panX, panY);
    }
  }

  function drawCanvas(manifest) {
    if (
      !gridContainer ||
      !geometryContainer ||
      !entitiesContainer ||
      !shadowContainer
    )
      return;

    gridContainer.removeChildren().forEach((c) => c.destroy());
    geometryContainer.removeChildren().forEach((c) => c.destroy());
    entitiesContainer.removeChildren().forEach((c) => c.destroy());
    shadowContainer.removeChildren().forEach((c) => c.destroy());

    const res = manifest.resolution;
    const gridSize = Number(res.pixels_per_grid) || 70;
    const unitsPerGrid = Math.max(1, Number(res.units_per_grid) || 5);
    const originX = Number(res.map_origin[0]) || 0;
    const originY = Number(res.map_origin[1]) || 0;
    const mapWidth = res.map_size[0] * gridSize;
    const mapHeight = res.map_size[1] * gridSize;

    // Dynamic Grid Properties
    const mainGridWidth = Number(res.grid_line_width) ?? 1.5;
    const subGridWidth = Number(res.subgrid_line_width) ?? 1.0;
    const gridColor = res.grid_color || "#ffffff";

    const subGridGfx = new PIXI.Graphics();
    gridContainer.addChild(subGridGfx);
    const subGridSize = gridSize / unitsPerGrid;
    for (let x = 0; x <= mapWidth; x += subGridSize) {
      subGridGfx.moveTo(x, 0);
      subGridGfx.lineTo(x, mapHeight);
    }
    for (let y = 0; y <= mapHeight; y += subGridSize) {
      subGridGfx.moveTo(0, y);
      subGridGfx.lineTo(mapWidth, y);
    }
    subGridGfx.stroke({ width: subGridWidth, color: gridColor, alpha: 0.05 });

    const mainGridGfx = new PIXI.Graphics();
    gridContainer.addChild(mainGridGfx);
    for (let x = 0; x <= mapWidth; x += gridSize) {
      mainGridGfx.moveTo(x, 0);
      mainGridGfx.lineTo(x, mapHeight);
    }
    for (let y = 0; y <= mapHeight; y += gridSize) {
      mainGridGfx.moveTo(0, y);
      mainGridGfx.lineTo(mapWidth, y);
    }
    mainGridGfx.stroke({ width: mainGridWidth, color: gridColor, alpha: 0.2 });

    const selectedIds = new Set(mapStore.selectedItemIds);
    const entGfx = new PIXI.Graphics();
    entitiesContainer.addChild(entGfx);

    (manifest.entities?.lights || []).forEach((light) => {
      const px = (Number(light.position?.x) - originX) * gridSize;
      const py = (Number(light.position?.y) - originY) * gridSize;
      if (isNaN(px) || isNaN(py)) return;

      const bRad = (Number(light.properties?.radius?.bright) || 5) * gridSize;
      const dRad = (Number(light.properties?.radius?.dim) || 10) * gridSize;
      const colorStr = light.properties?.color || "#ffffff";
      const isDir = light.type === "directional";

      if (isDir) {
        const rot = Number(light.properties?.rotation) || 0;
        const cone = Number(light.properties?.cone_angle) || 60;
        const startAngle = (rot - cone / 2) * (Math.PI / 180);
        const endAngle = (rot + cone / 2) * (Math.PI / 180);

        entGfx
          .moveTo(px, py)
          .arc(px, py, dRad, startAngle, endAngle)
          .closePath()
          .fill({ color: colorStr, alpha: 0.05 })
          .stroke({ width: 1, color: colorStr, alpha: 0.2 });
        entGfx
          .moveTo(px, py)
          .arc(px, py, bRad, startAngle, endAngle)
          .closePath()
          .fill({ color: colorStr, alpha: 0.1 })
          .stroke({ width: 1.5, color: colorStr, alpha: 0.4 });
      } else {
        entGfx
          .circle(px, py, dRad)
          .fill({ color: colorStr, alpha: 0.05 })
          .stroke({ width: 1, color: colorStr, alpha: 0.2 });
        entGfx
          .circle(px, py, bRad)
          .fill({ color: colorStr, alpha: 0.1 })
          .stroke({ width: 1.5, color: colorStr, alpha: 0.4 });
      }

      entGfx.circle(px, py, 4).fill({ color: "#ffffff", alpha: 0.9 });
      if (selectedIds.has(light.id))
        entGfx
          .circle(px, py, 8)
          .stroke({ width: 3, color: "#00f0ff", alpha: 1 });
    });

    (manifest.entities?.audio?.zones || []).forEach((az) => {
      const px = (Number(az.center?.x) - originX) * gridSize;
      const py = (Number(az.center?.y) - originY) * gridSize;
      if (isNaN(px) || isNaN(py)) return;

      const rad = (Number(az.radius) || 5) * gridSize;
      entGfx
        .circle(px, py, rad)
        .fill({ color: 0x3b82f6, alpha: 0.05 })
        .stroke({ width: 2, color: 0x3b82f6, alpha: 0.4 });
      entGfx.circle(px, py, 4).fill({ color: "#ffffff", alpha: 0.9 });
      if (selectedIds.has(az.id))
        entGfx
          .circle(px, py, 8)
          .stroke({ width: 3, color: "#00f0ff", alpha: 1 });
    });

    (manifest.entities?.events || []).forEach((ev) => {
      const px = (Number(ev.trigger_bounds?.center?.x) - originX) * gridSize;
      const py = (Number(ev.trigger_bounds?.center?.y) - originY) * gridSize;
      if (isNaN(px) || isNaN(py)) return;

      const rad = (Number(ev.trigger_bounds?.radius) || 2) * gridSize;
      entGfx
        .rect(px - rad, py - rad, rad * 2, rad * 2)
        .fill({ color: 0xa855f7, alpha: 0.1 })
        .stroke({ width: 2, color: 0xa855f7, alpha: 0.6 });
      entGfx.circle(px, py, 4).fill({ color: "#ffffff", alpha: 0.9 });
      if (selectedIds.has(ev.id))
        entGfx
          .circle(px, py, 8)
          .stroke({ width: 3, color: "#00f0ff", alpha: 1 });
    });

    (manifest.entities?.landing_zones || []).forEach((lz) => {
      const px = (Number(lz.coordinates?.[0]) - originX) * gridSize;
      const py = (Number(lz.coordinates?.[1]) - originY) * gridSize;
      if (isNaN(px) || isNaN(py)) return;

      const shape = lz.shape || "circle";
      const size = gridSize;
      const half = size / 2;
      const fillColor = lz.is_default ? 0x22c55e : 0xeab308;

      if (shape === "circle") {
        entGfx
          .circle(px, py, half)
          .fill({ color: fillColor, alpha: 0.2 })
          .stroke({ width: 2, color: fillColor, alpha: 0.8 });
      } else {
        entGfx
          .rect(px - half, py - half, size, size)
          .fill({ color: fillColor, alpha: 0.2 })
          .stroke({ width: 2, color: fillColor, alpha: 0.8 });
      }

      entGfx.circle(px, py, 4).fill({ color: "#ffffff", alpha: 0.9 });
      if (selectedIds.has(lz.id)) {
        entGfx
          .circle(px, py, 8)
          .stroke({ width: 3, color: "#00f0ff", alpha: 1 });
      }
    });

    (manifest.entities?.emitters || []).forEach((em) => {
      const px = (Number(em.position?.x) - originX) * gridSize;
      const py = (Number(em.position?.y) - originY) * gridSize;
      if (isNaN(px) || isNaN(py)) return;

      entGfx.moveTo(px - 10, py).lineTo(px + 10, py);
      entGfx.moveTo(px, py - 10).lineTo(px, py + 10);
      entGfx.stroke({ width: 3, color: 0x06b6d4, alpha: 0.9 });
      if (selectedIds.has(em.id))
        entGfx
          .circle(px, py, 8)
          .stroke({ width: 3, color: "#00f0ff", alpha: 1 });
    });

    (manifest.geometry.walls || []).forEach((wall) => {
      const gfx = new PIXI.Graphics();
      geometryContainer.addChild(gfx);
      if (selectedIds.has(wall.id)) {
        tracePath(gfx, wall.path, gridSize, originX, originY);
        gfx.stroke({
          width: 12,
          color: 0xffffff,
          alpha: 0.5,
          join: "round",
          cap: "round",
        });
      }
      tracePath(gfx, wall.path, gridSize, originX, originY);
      gfx.stroke({
        width: 5,
        color: 0x00f0ff,
        alpha: 0.9,
        join: "round",
        cap: "round",
      });
    });

    (manifest.geometry.portals || []).forEach((portal) => {
      const gfx = new PIXI.Graphics();
      geometryContainer.addChild(gfx);

      let pColor = 0xffa500;
      if (portal.properties?.type === "window") pColor = 0x3b82f6;
      else if (portal.properties?.type === "secret") pColor = 0xa855f7;

      if (selectedIds.has(portal.id)) {
        tracePath(gfx, portal.path, gridSize, originX, originY);
        gfx.stroke({
          width: 12,
          color: 0xffffff,
          alpha: 0.5,
          join: "round",
          cap: "round",
        });
      }
      tracePath(gfx, portal.path, gridSize, originX, originY);
      gfx.stroke({
        width: 5,
        color: pColor,
        alpha: 0.9,
        join: "round",
        cap: "round",
      });
    });

    drawDraftingLayer();

    if (lightingPreview) {
      drawDynamicLighting(
        manifest,
        originX,
        originY,
        gridSize,
        mapWidth,
        mapHeight,
      );
    }
  }

  function drawDynamicLighting(
    manifest,
    originX,
    originY,
    gridSize,
    mapWidth,
    mapHeight,
  ) {
    const shadowGfx = new PIXI.Graphics();
    shadowContainer.addChild(shadowGfx);

    const segments = [];
    segments.push({ p1: { x: 0, y: 0 }, p2: { x: mapWidth, y: 0 } });
    segments.push({
      p1: { x: mapWidth, y: 0 },
      p2: { x: mapWidth, y: mapHeight },
    });
    segments.push({
      p1: { x: mapWidth, y: mapHeight },
      p2: { x: 0, y: mapHeight },
    });
    segments.push({ p1: { x: 0, y: mapHeight }, p2: { x: 0, y: 0 } });

    (manifest.geometry?.walls || []).forEach((w) => {
      if (!w.path || w.path.length < 2 || w.properties?.type === "invisible")
        return;
      for (let i = 0; i < w.path.length - 1; i++) {
        segments.push({
          p1: {
            x: (w.path[i].x - originX) * gridSize,
            y: (w.path[i].y - originY) * gridSize,
          },
          p2: {
            x: (w.path[i + 1].x - originX) * gridSize,
            y: (w.path[i + 1].y - originY) * gridSize,
          },
        });
      }
    });

    (manifest.geometry?.portals || []).forEach((p) => {
      if (!p.path || p.path.length < 2 || p.properties?.state === "open")
        return;
      for (let i = 0; i < p.path.length - 1; i++) {
        segments.push({
          p1: {
            x: (p.path[i].x - originX) * gridSize,
            y: (p.path[i].y - originY) * gridSize,
          },
          p2: {
            x: (p.path[i + 1].x - originX) * gridSize,
            y: (p.path[i + 1].y - originY) * gridSize,
          },
        });
      }
    });

    shadowGfx
      .moveTo(0, 0)
      .lineTo(mapWidth, 0)
      .lineTo(mapWidth, mapHeight)
      .lineTo(0, mapHeight)
      .closePath();

    (manifest.entities?.lights || []).forEach((light) => {
      const lx = (Number(light.position?.x) - originX) * gridSize;
      const ly = (Number(light.position?.y) - originY) * gridSize;
      if (isNaN(lx) || isNaN(ly)) return;

      const radius = (Number(light.properties?.radius?.dim) || 10) * gridSize;

      const angles = [];
      for (const seg of segments) {
        const minX = Math.min(seg.p1.x, seg.p2.x),
          maxX = Math.max(seg.p1.x, seg.p2.x);
        const minY = Math.min(seg.p1.y, seg.p2.y),
          maxY = Math.max(seg.p1.y, seg.p2.y);
        if (
          maxX < lx - radius ||
          minX > lx + radius ||
          maxY < ly - radius ||
          minY > ly + radius
        )
          continue;

        const a1 = Math.atan2(seg.p1.y - ly, seg.p1.x - lx);
        const a2 = Math.atan2(seg.p2.y - ly, seg.p2.x - lx);
        angles.push(a1 - 0.0001, a1, a1 + 0.0001);
        angles.push(a2 - 0.0001, a2, a2 + 0.0001);
      }

      const intersects = [];
      for (let a of angles) {
        const normA = Math.atan2(Math.sin(a), Math.cos(a));
        const dx = Math.cos(normA),
          dy = Math.sin(normA);
        const r_px = lx,
          r_py = ly;
        const r_dx = dx * radius,
          r_dy = dy * radius;
        let minT1 = 1;
        let intersectPt = { x: lx + r_dx, y: ly + r_dy, angle: normA };
        for (const seg of segments) {
          const s_px = seg.p1.x,
            s_py = seg.p1.y;
          const s_dx = seg.p2.x - seg.p1.x,
            s_dy = seg.p2.y - seg.p1.y;
          const T2 = r_dx * s_dy - r_dy * s_dx;
          if (T2 === 0) continue;
          const T1 = (s_px - r_px) * s_dy - (s_py - r_py) * s_dx;
          const t1 = T1 / T2;
          const t2 = ((s_px - r_px) * r_dy - (s_py - r_py) * r_dx) / T2;
          if (t1 > 0 && t1 < minT1 && t2 >= 0 && t2 <= 1) {
            minT1 = t1;
            intersectPt = {
              x: r_px + r_dx * t1,
              y: r_py + r_dy * t1,
              angle: normA,
            };
          }
        }
        intersects.push(intersectPt);
      }

      intersects.sort((a, b) => a.angle - b.angle);
      if (intersects.length > 0) {
        if (light.type === "directional") {
          const rot =
            (Number(light.properties?.rotation) || 0) * (Math.PI / 180);
          const cone =
            (Number(light.properties?.cone_angle) || 60) * (Math.PI / 180);
          const startAngle = rot - cone / 2;
          const endAngle = rot + cone / 2;

          shadowGfx.moveTo(lx, ly);
          for (let i = intersects.length - 1; i >= 0; i--) {
            let diff = Math.atan2(
              Math.sin(intersects[i].angle - rot),
              Math.cos(intersects[i].angle - rot),
            );
            if (Math.abs(diff) <= cone / 2 + 0.001) {
              shadowGfx.lineTo(intersects[i].x, intersects[i].y);
            }
          }
          shadowGfx.lineTo(lx, ly);
        } else {
          shadowGfx.moveTo(
            intersects[intersects.length - 1].x,
            intersects[intersects.length - 1].y,
          );
          for (let i = intersects.length - 2; i >= 0; i--) {
            shadowGfx.lineTo(intersects[i].x, intersects[i].y);
          }
        }
      }
    });
    shadowGfx.fill({ color: 0x000000, alpha: 0.85 });
  }

  let draftingLayerGfx = null;
  function drawDraftingLayer() {
    if (!geometryContainer || !activeMap) return;

    if (draftingLayerGfx) {
      draftingLayerGfx.destroy();
      draftingLayerGfx = null;
    }

    if (draftingPath.length > 0 && draftingPreview) {
      draftingLayerGfx = new PIXI.Graphics();
      geometryContainer.addChild(draftingLayerGfx);

      const res = activeMap.manifest.resolution;
      const gridSize = Number(res.pixels_per_grid) || 70;
      const originX = Number(res.map_origin[0]) || 0;
      const originY = Number(res.map_origin[1]) || 0;

      const pts = [...draftingPath, draftingPreview];
      const dColor = activeTool === "wall" ? 0x00f0ff : 0xffa500;

      tracePath(draftingLayerGfx, pts, gridSize, originX, originY);
      draftingLayerGfx.stroke({
        width: 4,
        color: dColor,
        alpha: 0.6,
        join: "round",
        cap: "round",
      });
    }
  }

  function tracePath(gfx, path, gridSize, originX, originY) {
    if (!path || path.length < 2) return;
    for (let i = 0; i < path.length; i++) {
      const px = (Number(path[i].x) - originX) * gridSize;
      const py = (Number(path[i].y) - originY) * gridSize;
      if (isNaN(px) || isNaN(py)) continue;
      if (i === 0) gfx.moveTo(px, py);
      else gfx.lineTo(px, py);
    }
  }

  // --- INTERACTION LOGIC ---

  function getVectorSnapPoint(px, py, walls, snapDistance) {
    let closestDist = snapDistance * snapDistance;
    let snapPoint = null;
    for (const wall of walls) {
      if (!wall.path || wall.path.length < 2) continue;
      for (let i = 0; i < wall.path.length - 1; i++) {
        const x1 = Number(wall.path[i].x);
        const y1 = Number(wall.path[i].y);
        const x2 = Number(wall.path[i + 1].x);
        const y2 = Number(wall.path[i + 1].y);
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) continue;
        let t = Math.max(
          0,
          Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2),
        );
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        const distSq = (px - projX) ** 2 + (py - projY) ** 2;
        if (distSq < closestDist) {
          closestDist = distSq;
          snapPoint = { x: projX, y: projY };
        }
      }
    }
    return snapPoint;
  }

  function getGridCoordinates(clientX, clientY, e_shiftKey) {
    if (!activeMap)
      return { exactX: 0, exactY: 0, snapX: 0, snapY: 0, gridSize: 70 };
    const rect = canvasContainer.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    const manifest = activeMap.manifest;
    const gridSize = Number(manifest.resolution?.pixels_per_grid) || 70;
    const unitsPerGrid = Math.max(
      1,
      Number(manifest.resolution?.units_per_grid) || 5,
    );
    const originX = Number(manifest.resolution?.map_origin?.[0]) || 0;
    const originY = Number(manifest.resolution?.map_origin?.[1]) || 0;
    const exactX = (rawX - panX) / scale / gridSize + originX;
    const exactY = (rawY - panY) / scale / gridSize + originY;

    let snapX = exactX;
    let snapY = exactY;
    let isVectorSnapped = false;

    // Detect if we are using or dragging a free-place tool
    let isFreeTool = ["light", "audio", "emitter"].includes(activeTool);
    if (activeTool === "select" && draggedItemId) {
      const m = manifest;
      const isFreeEntity =
        m.entities?.lights?.some((i) => i.id === draggedItemId) ||
        m.entities?.audio?.zones?.some((i) => i.id === draggedItemId) ||
        m.entities?.emitters?.some((i) => i.id === draggedItemId);
      if (isFreeEntity) isFreeTool = true;
    }

    // Free tools default to NO snap. Shift key ENABLES snap.
    // Structural tools default to snap. Shift key DISABLES snap.
    const shouldSnap = isFreeTool ? e_shiftKey : !e_shiftKey;

    if (activeTool === "spawn" && shouldSnap) {
      snapX = Math.floor(exactX) + 0.5;
      snapY = Math.floor(exactY) + 0.5;
      isVectorSnapped = true;
    } else if (activeTool === "portal" && shouldSnap) {
      const snapDist = 0.5 / unitsPerGrid;
      const edgeSnap = getVectorSnapPoint(
        exactX,
        exactY,
        manifest.geometry?.walls || [],
        snapDist,
      );
      if (edgeSnap) {
        snapX = edgeSnap.x;
        snapY = edgeSnap.y;
        isVectorSnapped = true;
      }
    }

    if (shouldSnap && !isVectorSnapped) {
      snapX = Math.round(exactX * unitsPerGrid) / unitsPerGrid;
      snapY = Math.round(exactY * unitsPerGrid) / unitsPerGrid;
    }

    return { exactX, exactY, snapX, snapY, gridSize };
  }

  function handlePointerDown(e) {
    if (!viewportContainer || !activeMap) return;
    if (e.button === 1 || (e.button === 2 && draftingPath.length === 0)) {
      isPanning = true;
      dragStart = { x: e.clientX, y: e.clientY };
      originalPan = { x: panX, y: panY };
      return;
    }

    if (e.button === 2 && draftingPath.length > 1) {
      mapStore.addGeometry(activeTool, [...draftingPath]);
      draftingPath = [];
      draftingPreview = null;
      drawDraftingLayer();
      return;
    }

    if (e.button === 0) {
      const coords = getGridCoordinates(e.clientX, e.clientY, e.shiftKey);
      currentGridX = coords.snapX;
      currentGridY = coords.snapY;

      if (e.altKey && activeTool === "select") {
        let splitOccurred = false;
        ["walls", "portals"].forEach((cat) => {
          activeMap.manifest.geometry[cat]?.forEach((item) => {
            if (splitOccurred || !item.path) return;
            for (let i = 0; i < item.path.length - 1; i++) {
              const x1 = Number(item.path[i].x);
              const y1 = Number(item.path[i].y);
              const x2 = Number(item.path[i + 1].x);
              const y2 = Number(item.path[i + 1].y);
              const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
              if (l2 === 0) continue;
              let t = Math.max(
                0,
                Math.min(
                  1,
                  ((coords.exactX - x1) * (x2 - x1) +
                    (coords.exactY - y1) * (y2 - y1)) /
                    l2,
                ),
              );
              const projX = x1 + t * (x2 - x1);
              const projY = y1 + t * (y2 - y1);
              const distSq =
                (coords.exactX - projX) ** 2 + (coords.exactY - projY) ** 2;
              if (distSq < (15 / scale / coords.gridSize) ** 2) {
                item.path.splice(i + 1, 0, {
                  x: coords.exactX,
                  y: coords.exactY,
                });
                splitOccurred = true;
                mapStore.pushHistory("Split Vector");
                return;
              }
            }
          });
        });
        if (splitOccurred) return;
      }

      if (activeTool === "wall" || activeTool === "portal") {
        draftingPath = [...draftingPath, { x: currentGridX, y: currentGridY }];
        drawDraftingLayer();
        return;
      }

      if (activeTool === "light") {
        mapStore.addLight(currentGridX, currentGridY);
        return;
      }
      if (activeTool === "audio") {
        mapStore.addAudio(currentGridX, currentGridY);
        return;
      }
      if (activeTool === "event") {
        mapStore.addEvent(currentGridX, currentGridY);
        return;
      }
      if (activeTool === "emitter") {
        mapStore.addEmitter(currentGridX, currentGridY);
        return;
      }
      if (activeTool === "spawn") {
        mapStore.addSpawn(currentGridX, currentGridY);
        return;
      }

      if (activeTool === "select") {
        const manifest = activeMap.manifest;
        let closestItem = null;
        let minGridDistSq = (15 / scale / coords.gridSize) ** 2;
        const checkEntityCollision = (items, getPos) => {
          for (const item of items) {
            const pos = getPos(item);
            if (!pos || isNaN(pos.x) || isNaN(pos.y)) continue;
            const distSq =
              (coords.exactX - pos.x) ** 2 + (coords.exactY - pos.y) ** 2;
            if (distSq < minGridDistSq) {
              minGridDistSq = distSq;
              closestItem = item;
            }
          }
        };
        const checkGeometryCollision = (items) => {
          for (const item of items) {
            const path = item.path || [];
            if (path.length < 2) continue;
            for (let i = 0; i < path.length - 1; i++) {
              const x1 = Number(path[i].x);
              const y1 = Number(path[i].y);
              const x2 = Number(path[i + 1].x);
              const y2 = Number(path[i + 1].y);
              const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
              if (l2 === 0) continue;
              let t = Math.max(
                0,
                Math.min(
                  1,
                  ((coords.exactX - x1) * (x2 - x1) +
                    (coords.exactY - y1) * (y2 - y1)) /
                    l2,
                ),
              );
              const projX = x1 + t * (x2 - x1);
              const projY = y1 + t * (y2 - y1);
              const distSq =
                (coords.exactX - projX) ** 2 + (coords.exactY - projY) ** 2;
              if (distSq < minGridDistSq) {
                minGridDistSq = distSq;
                closestItem = item;
              }
            }
          }
        };
        checkEntityCollision(manifest.entities?.lights || [], (i) => ({
          x: Number(i.position?.x),
          y: Number(i.position?.y),
        }));
        checkEntityCollision(manifest.entities?.audio?.zones || [], (i) => ({
          x: Number(i.center?.x),
          y: Number(i.center?.y),
        }));
        checkEntityCollision(manifest.entities?.events || [], (i) => ({
          x: Number(i.trigger_bounds?.center?.x),
          y: Number(i.trigger_bounds?.center?.y),
        }));
        checkEntityCollision(manifest.entities?.landing_zones || [], (i) => ({
          x: Number(i.coordinates?.[0]),
          y: Number(i.coordinates?.[1]),
        }));
        checkEntityCollision(manifest.entities?.emitters || [], (i) => ({
          x: Number(i.position?.x),
          y: Number(i.position?.y),
        }));
        checkGeometryCollision(manifest.geometry?.walls || []);
        checkGeometryCollision(manifest.geometry?.portals || []);

        if (closestItem) {
          mapStore.selectItem(
            closestItem.id,
            e.shiftKey || e.ctrlKey || e.metaKey,
          );
          draggedItemId = closestItem.id;
          lastDragGrid = { x: currentGridX, y: currentGridY };
        } else {
          mapStore.clearSelection();
        }
      }
    }
  }

  function handlePointerMove(e) {
    if (isPanning) {
      panX = originalPan.x + (e.clientX - dragStart.x);
      panY = originalPan.y + (e.clientY - dragStart.y);
      updateViewport();
      return;
    }

    if (!activeMap) return;
    const coords = getGridCoordinates(e.clientX, e.clientY, e.shiftKey);
    currentGridX = coords.snapX;
    currentGridY = coords.snapY;
    if (activeTool === "wall" || activeTool === "portal") {
      draftingPreview = { x: currentGridX, y: currentGridY };
      drawDraftingLayer();
    }

    if (draggedItemId && activeTool === "select" && lastDragGrid) {
      const dx = currentGridX - lastDragGrid.x;
      const dy = currentGridY - lastDragGrid.y;
      mapStore.updateNodePosition(
        draggedItemId,
        currentGridX,
        currentGridY,
        dx,
        dy,
      );
      lastDragGrid = { x: currentGridX, y: currentGridY };
    }
  }

  function handlePointerUp() {
    isPanning = false;
    draggedItemId = null;
    lastDragGrid = null;
  }

  function handleWheel(e) {
    e.preventDefault();
    const pointerX = e.clientX;
    const pointerY = e.clientY;
    const zoom = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = scale * zoom;
    panX = pointerX - (pointerX - panX) * (newScale / scale);
    panY = pointerY - (pointerY - panY) * (newScale / scale);
    scale = newScale;
    updateViewport();
  }

  function handleKeyDown(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) mapStore.redo();
      else mapStore.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      mapStore.redo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      mapStore.copySelected();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
      mapStore.pasteClipboard(currentGridX, currentGridY);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      mapStore.duplicateSelected();
    }

    if (e.key === "Escape") {
      if (draftingPath.length > 0) {
        draftingPath = [];
        draftingPreview = null;
        drawDraftingLayer();
      } else {
        mapStore.clearSelection();
      }
    }
    if (e.key === "Enter" && draftingPath.length > 1) {
      mapStore.addGeometry(activeTool, [...draftingPath]);
      draftingPath = [];
      draftingPreview = null;
      drawDraftingLayer();
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      mapStore.deleteSelected();
    }
  }
</script>

<svelte:window
  onkeydown={handleKeyDown}
  oncontextmenu={(e) => e.preventDefault()}
/>

<div
  bind:this={canvasContainer}
  class="pixi-workspace"
  onwheel={handleWheel}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
></div>

<style>
  .pixi-workspace {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: absolute;
    top: 0;
    left: 0;
    background: #05080e;
    cursor: crosshair;
  }
  .pixi-workspace:active {
    cursor: grabbing;
  }
</style>
