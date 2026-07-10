<script>
  import { onMount, onDestroy } from "svelte";
  import * as PIXI from "pixi.js";
  import { mapStore, mapActions } from "../stores/mapStore.js";

  let canvasContainer;
  let app;
  let mapSprite;
  let mapContainer;
  let vectorContainer;
  let gridLayer;
  let lightsContainer;
  let eventsContainer;
  let audioContainer;
  let overheadContainer;
  let spawnContainer;
  let emittersContainer; // NEW: Container for Emitter zones

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  const ZOOM_SPEED = 1.1;

  let currentImageUrl = null;
  $: if (app && $mapStore.imageUrl && $mapStore.imageUrl !== currentImageUrl) {
    currentImageUrl = $mapStore.imageUrl;
    renderMapTexture(currentImageUrl);
  }

  $: {
    const walls = $mapStore.manifest?.geometry?.walls || [];
    const portals = $mapStore.manifest?.geometry?.portals || [];
    const overhead = $mapStore.manifest?.geometry?.overhead || [];
    const lights = $mapStore.manifest?.lights || [];
    const events = $mapStore.manifest?.events || [];
    const audio = $mapStore.manifest?.audio || [];
    const spawns = $mapStore.manifest?.landing_zones || [];
    const emitters = $mapStore.manifest?.emitters || []; // NEW
    const selectedIds = $mapStore.selectedItemIds || [];

    if (vectorContainer) drawGeometry(walls, portals, selectedIds);
    if (lightsContainer && $mapStore.manifest?.resolution)
      drawLights(lights, $mapStore.manifest.resolution, selectedIds);
    if (eventsContainer && $mapStore.manifest?.resolution)
      drawBoundaryZones(
        eventsContainer,
        events,
        "event",
        0x9c27b0,
        $mapStore.manifest.resolution,
        selectedIds,
      );
    if (audioContainer && $mapStore.manifest?.resolution)
      drawBoundaryZones(
        audioContainer,
        audio,
        "audio",
        0x2196f3,
        $mapStore.manifest.resolution,
        selectedIds,
      );
    if (overheadContainer && $mapStore.manifest?.resolution)
      drawBoundaryZones(
        overheadContainer,
        overhead,
        "overhead",
        0x4caf50,
        $mapStore.manifest.resolution,
        selectedIds,
      );
    if (emittersContainer && $mapStore.manifest?.resolution)
      drawBoundaryZones(
        emittersContainer,
        emitters,
        "emitter",
        0x00bcd4,
        $mapStore.manifest.resolution,
        selectedIds,
      ); // NEW
    if (spawnContainer && $mapStore.manifest?.resolution)
      drawSpawns(spawns, $mapStore.manifest.resolution, selectedIds);
    if (gridLayer && mapSprite)
      drawGrid($mapStore.showGrid, $mapStore.manifest?.resolution);
  }

  $: if (canvasContainer) {
    const t = $mapStore.activeTool;
    canvasContainer.style.cursor =
      t === "pan"
        ? "grab"
        : t === "light" ||
            t === "event" ||
            t === "audio" ||
            t === "overhead" ||
            t === "spawn" ||
            t === "emitter"
          ? "cell"
          : "crosshair";
  }

  onMount(async () => {
    app = new PIXI.Application({
      resizeTo: canvasContainer,
      backgroundColor: 0x1e1e1e,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
    });

    canvasContainer.appendChild(app.view);

    const interactionLayer = new PIXI.Graphics();
    interactionLayer.beginFill(0x000000, 0.001);
    interactionLayer.drawRect(0, 0, 10000, 10000);
    interactionLayer.endFill();

    interactionLayer.eventMode = "static";

    interactionLayer.on("pointertap", (e) => {
      const t = $mapStore.activeTool;
      if (t === "select" && e.target === interactionLayer) {
        mapActions.clearSelection();
      } else if (
        (t === "light" ||
          t === "event" ||
          t === "audio" ||
          t === "overhead" ||
          t === "spawn" ||
          t === "emitter") &&
        e.target === interactionLayer
      ) {
        const localPt = mapContainer.toLocal(e.global);
        const gridScaleX = $mapStore.manifest.resolution.grid_size.x || 70;
        const gridScaleY = $mapStore.manifest.resolution.grid_size.y || 70;

        if (t === "light")
          mapActions.addLight(localPt.x / gridScaleX, localPt.y / gridScaleY);
        if (t === "event")
          mapActions.addEvent(localPt.x / gridScaleX, localPt.y / gridScaleY);
        if (t === "audio")
          mapActions.addAudio(localPt.x / gridScaleX, localPt.y / gridScaleY);
        if (t === "overhead")
          mapActions.addOverhead(
            localPt.x / gridScaleX,
            localPt.y / gridScaleY,
          );
        if (t === "spawn")
          mapActions.addSpawn(localPt.x / gridScaleX, localPt.y / gridScaleY);
        if (t === "emitter")
          mapActions.addEmitter(localPt.x / gridScaleX, localPt.y / gridScaleY); // NEW
      }
    });

    interactionLayer.on("pointerdown", (e) => {
      if ($mapStore.activeTool === "pan") onDragStart(e);
    });

    interactionLayer.on("pointerup", onDragEnd);
    interactionLayer.on("pointerupoutside", onDragEnd);
    interactionLayer.on("pointermove", onDragMove);

    app.stage.addChild(interactionLayer);

    mapContainer = new PIXI.Container();
    app.stage.addChild(mapContainer);

    gridLayer = new PIXI.Graphics();
    mapContainer.addChild(gridLayer);

    overheadContainer = new PIXI.Container();
    mapContainer.addChild(overheadContainer);

    audioContainer = new PIXI.Container();
    mapContainer.addChild(audioContainer);

    eventsContainer = new PIXI.Container();
    mapContainer.addChild(eventsContainer);

    emittersContainer = new PIXI.Container(); // NEW
    mapContainer.addChild(emittersContainer);

    spawnContainer = new PIXI.Container();
    mapContainer.addChild(spawnContainer);

    lightsContainer = new PIXI.Container();
    mapContainer.addChild(lightsContainer);

    vectorContainer = new PIXI.Container();
    mapContainer.addChild(vectorContainer);

    app.view.addEventListener("wheel", onWheel, { passive: false });
  });

  async function renderMapTexture(blobUrl) {
    if (mapSprite) mapSprite.destroy({ texture: true, baseTexture: true });

    const image = new Image();
    image.src = blobUrl;
    await new Promise((resolve) => {
      image.onload = resolve;
    });

    const texture = PIXI.Texture.from(image);
    mapSprite = new PIXI.Sprite(texture);

    mapContainer.x = (app.screen.width - mapSprite.width) / 2;
    mapContainer.y = (app.screen.height - mapSprite.height) / 2;

    mapContainer.addChildAt(mapSprite, 0);
    drawGrid($mapStore.showGrid, $mapStore.manifest?.resolution);
  }

  function drawGrid(showGrid, resolution) {
    gridLayer.clear();
    if (!showGrid || !resolution || !mapSprite) return;

    const width = mapSprite.width;
    const height = mapSprite.height;
    const gridX = resolution.grid_size?.x || 70;
    const gridY = resolution.grid_size?.y || 70;
    const units = resolution.units_per_grid || 5;

    const topType = resolution.topology?.type || "square";

    if (topType === "square") {
      const subGridX = gridX / units;
      const subGridY = gridY / units;
      gridLayer.lineStyle(1, 0xffffff, 0.1);
      for (let x = 0; x <= width; x += subGridX) {
        gridLayer.moveTo(x, 0);
        gridLayer.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += subGridY) {
        gridLayer.moveTo(0, y);
        gridLayer.lineTo(width, y);
      }
    }

    gridLayer.lineStyle(2, 0xffffff, 0.35);

    if (topType === "square") {
      for (let x = 0; x <= width; x += gridX) {
        gridLayer.moveTo(x, 0);
        gridLayer.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridY) {
        gridLayer.moveTo(0, y);
        gridLayer.lineTo(width, y);
      }
    } else if (topType === "isometric") {
      const ratio = resolution.topology?.isometric_ratio || 0.5;
      const stepX = gridX;
      const stepY = gridX * ratio;

      for (let x = -height / ratio; x <= width; x += stepX) {
        gridLayer.moveTo(x, 0);
        gridLayer.lineTo(x + height / ratio, height);
      }
      for (let x = 0; x <= width + height / ratio; x += stepX) {
        gridLayer.moveTo(x, 0);
        gridLayer.lineTo(x - height / ratio, height);
      }
    } else if (topType === "hex") {
      const orientation = resolution.topology?.orientation || "flat_top";
      const offsetRule = resolution.topology?.offset || "odd_row";

      if (orientation === "flat_top") {
        const hexRadius = gridX / 2;
        const rowHeight = hexRadius * Math.sqrt(3);
        const colWidth = hexRadius * 1.5;

        for (let r = -1; r <= height / rowHeight + 1; r++) {
          for (let c = -1; c <= width / colWidth + 1; c++) {
            const isOffsetCol =
              (offsetRule === "odd_col" && c % 2 !== 0) ||
              (offsetRule === "even_col" && c % 2 === 0);
            const cx = c * colWidth;
            const cy = r * rowHeight + (isOffsetCol ? rowHeight / 2 : 0);

            gridLayer.moveTo(cx + hexRadius, cy);
            gridLayer.lineTo(cx + hexRadius * 0.5, cy + rowHeight / 2);
            gridLayer.lineTo(cx - hexRadius * 0.5, cy + rowHeight / 2);
            gridLayer.lineTo(cx - hexRadius, cy);
            gridLayer.lineTo(cx - hexRadius * 0.5, cy - rowHeight / 2);
            gridLayer.lineTo(cx + hexRadius * 0.5, cy - rowHeight / 2);
            gridLayer.lineTo(cx + hexRadius, cy);
          }
        }
      } else {
        const hexRadius = gridY / 2;
        const colWidth = hexRadius * Math.sqrt(3);
        const rowHeight = hexRadius * 1.5;

        for (let r = -1; r <= height / rowHeight + 1; r++) {
          for (let c = -1; c <= width / colWidth + 1; c++) {
            const isOffsetRow =
              (offsetRule === "odd_row" && r % 2 !== 0) ||
              (offsetRule === "even_row" && r % 2 === 0);
            const cx = c * colWidth + (isOffsetRow ? colWidth / 2 : 0);
            const cy = r * rowHeight;

            gridLayer.moveTo(cx, cy - hexRadius);
            gridLayer.lineTo(cx + colWidth / 2, cy - hexRadius * 0.5);
            gridLayer.lineTo(cx + colWidth / 2, cy + hexRadius * 0.5);
            gridLayer.lineTo(cx, cy + hexRadius);
            gridLayer.lineTo(cx - colWidth / 2, cy + hexRadius * 0.5);
            gridLayer.lineTo(cx - colWidth / 2, cy - hexRadius * 0.5);
            gridLayer.lineTo(cx, cy - hexRadius);
          }
        }
      }
    }
  }

  function drawSpawns(spawns, resolution, selectedIds) {
    spawnContainer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));

    const gridScaleX = resolution.grid_size.x || 70;
    const gridScaleY = resolution.grid_size.y || 70;

    spawns.forEach((spawn) => {
      const group = new PIXI.Container();
      const isSelected = selectedIds.includes(spawn.id);
      const color = 0xffd700;

      const px = spawn.position.x * gridScaleX;
      const py = spawn.position.y * gridScaleY;
      const pr = 0.4 * gridScaleX;

      const graphics = new PIXI.Graphics();
      graphics.lineStyle(2, color, isSelected ? 1.0 : 0.6);
      graphics.beginFill(color, isSelected ? 0.4 : 0.15);
      graphics.drawCircle(px, py, pr);

      const fx = spawn.facing?.x || 0;
      const fy = spawn.facing?.y || 1;
      const mag = Math.sqrt(fx * fx + fy * fy) || 1;

      const dirX = (fx / mag) * pr * 1.5;
      const dirY = (fy / mag) * pr * 1.5;

      graphics.moveTo(px, py);
      graphics.lineTo(px + dirX, py + dirY);
      graphics.beginFill(color, isSelected ? 1.0 : 0.8);
      graphics.drawCircle(px + dirX, py + dirY, 4);
      graphics.endFill();

      const hitArea = new PIXI.Graphics();
      hitArea.beginFill(0x000000, 0.001);
      hitArea.drawCircle(px, py, pr * 1.5);
      hitArea.endFill();

      hitArea.eventMode = "static";
      hitArea.cursor = "pointer";
      hitArea.on("pointertap", (e) => {
        if ($mapStore.activeTool === "select") {
          e.stopPropagation();
          const isMulti = e.nativeEvent.shiftKey;
          mapActions.toggleSelection(spawn.id, isMulti);
        }
      });

      group.addChild(graphics);
      group.addChild(hitArea);
      spawnContainer.addChild(group);
    });
  }

  function drawBoundaryZones(
    container,
    items,
    typeStr,
    baseColor,
    resolution,
    selectedIds,
  ) {
    container
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));

    const gridScaleX = resolution.grid_size.x || 70;
    const gridScaleY = resolution.grid_size.y || 70;

    items.forEach((item) => {
      const group = new PIXI.Container();
      const isSelected = selectedIds.includes(item.id);

      let color = baseColor;
      if (typeStr === "event" && item.type === "trap") color = 0xe91e63;

      const graphics = new PIXI.Graphics();
      graphics.lineStyle(2, color, isSelected ? 1.0 : 0.6);

      // Emitters get a much lighter fill to distinguish them from heavy Audio/Event zones
      const fillAlpha =
        typeStr === "emitter"
          ? isSelected
            ? 0.2
            : 0.05
          : isSelected
            ? 0.4
            : 0.15;
      graphics.beginFill(color, fillAlpha);

      const bounds = typeStr === "event" ? item.trigger_bounds : item.bounds;
      const hitArea = new PIXI.Graphics();
      hitArea.beginFill(0x000000, 0.001);

      if (bounds.shape === "circle") {
        const px = bounds.center.x * gridScaleX;
        const py = bounds.center.y * gridScaleY;
        const pr = (bounds.radius || 0.5) * gridScaleX;
        graphics.drawCircle(px, py, pr);
        hitArea.drawCircle(px, py, pr);

        if (typeStr === "audio" && item.fade_distance > 0) {
          const fadeR = (bounds.radius + item.fade_distance) * gridScaleX;
          graphics.lineStyle(1, color, isSelected ? 0.6 : 0.3);
          graphics.drawCircle(px, py, fadeR);
        }
      } else if (bounds.shape === "rectangle") {
        const w = (bounds.width || 1.0) * gridScaleX;
        const h = (bounds.height || 1.0) * gridScaleY;
        const px = bounds.center.x * gridScaleX - w / 2;
        const py = bounds.center.y * gridScaleY - h / 2;
        graphics.drawRect(px, py, w, h);
        hitArea.drawRect(px, py, w, h);

        if (typeStr === "audio" && item.fade_distance > 0) {
          const fadeDistX = item.fade_distance * gridScaleX;
          const fadeDistY = item.fade_distance * gridScaleY;
          graphics.lineStyle(1, color, isSelected ? 0.6 : 0.3);
          graphics.drawRect(
            px - fadeDistX,
            py - fadeDistY,
            w + fadeDistX * 2,
            h + fadeDistY * 2,
          );
        }
      } else if (bounds.shape === "polygon" && bounds.points) {
        const path = [];
        bounds.points.forEach((pt) => {
          path.push(pt.x * gridScaleX, pt.y * gridScaleY);
        });
        graphics.drawPolygon(path);
        hitArea.drawPolygon(path);
      }

      graphics.endFill();
      hitArea.endFill();

      hitArea.eventMode = "static";
      hitArea.cursor = "pointer";
      hitArea.on("pointertap", (e) => {
        if ($mapStore.activeTool === "select") {
          e.stopPropagation();
          const isMulti = e.nativeEvent.shiftKey;
          mapActions.toggleSelection(item.id, isMulti);
        }
      });

      group.addChild(graphics);
      group.addChild(hitArea);
      container.addChild(group);
    });
  }

  function drawLights(lights, resolution, selectedIds) {
    lightsContainer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));

    const gridScaleX = resolution.grid_size.x || 70;
    const gridScaleY = resolution.grid_size.y || 70;
    const unitsPerGrid = resolution.units_per_grid || 5;
    const pixelsPerUnit = gridScaleX / unitsPerGrid;

    lights.forEach((light) => {
      const lightGroup = new PIXI.Container();
      const isSelected = selectedIds.includes(light.id);

      const px = light.position.x * gridScaleX;
      const py = light.position.y * gridScaleY;
      const color = parseInt(light.color.replace("#", "0x"), 16);

      const brightPixels = (light.radius?.bright || 0) * pixelsPerUnit;
      const dimPixels = (light.radius?.dim || 0) * pixelsPerUnit;

      const graphics = new PIXI.Graphics();
      graphics.lineStyle(1, color, isSelected ? 0.6 : 0.2);
      if (dimPixels > 0) graphics.drawCircle(px, py, dimPixels);

      graphics.lineStyle(2, color, isSelected ? 0.8 : 0.4);
      if (brightPixels > 0) graphics.drawCircle(px, py, brightPixels);

      graphics.beginFill(color, 1.0);
      graphics.drawCircle(px, py, isSelected ? 12 : 8);
      if (isSelected) {
        graphics.lineStyle(3, 0xffffff, 1);
        graphics.drawCircle(px, py, 16);
      }
      graphics.endFill();

      const hitArea = new PIXI.Graphics();
      hitArea.beginFill(0x000000, 0.001);
      hitArea.drawCircle(px, py, 30);
      hitArea.endFill();

      hitArea.eventMode = "static";
      hitArea.cursor = "pointer";

      hitArea.on("pointertap", (e) => {
        if ($mapStore.activeTool === "select") {
          e.stopPropagation();
          const isMulti = e.nativeEvent.shiftKey;
          mapActions.toggleSelection(light.id, isMulti);
        }
      });

      lightGroup.addChild(graphics);
      lightGroup.addChild(hitArea);
      lightsContainer.addChild(lightGroup);
    });
  }

  function drawGeometry(walls, portals, selectedIds) {
    vectorContainer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));
    const gridScaleX = $mapStore.manifest.resolution.grid_size.x || 70;
    const gridScaleY = $mapStore.manifest.resolution.grid_size.y || 70;

    const createClickablePath = (item, baseColor, width, category) => {
      const vectorGroup = new PIXI.Container();
      const isSelected = selectedIds.includes(item.id);

      const visibleLine = new PIXI.Graphics();
      const strokeColor = isSelected ? 0xffffff : baseColor;
      const strokeWidth = isSelected ? width + 6 : width;

      visibleLine.lineStyle(strokeWidth, strokeColor, 1);
      tracePath(visibleLine, item.path, gridScaleX, gridScaleY);

      visibleLine.lineStyle(2, strokeColor, 1);
      traceDirectionalPointers(visibleLine, item.path, gridScaleX, gridScaleY);

      const hitArea = new PIXI.Graphics();
      hitArea.beginFill(0x000000, 0.001);

      item.path.forEach((node, index) => {
        const px = node.x * gridScaleX;
        const py = node.y * gridScaleY;
        hitArea.drawCircle(px, py, 20);

        if (node.type === "line" && index > 0) {
          const prev = item.path[index - 1];
          const midX = (prev.x * gridScaleX + px) / 2;
          const midY = (prev.y * gridScaleY + py) / 2;
          hitArea.drawCircle(midX, midY, 20);
        } else if (node.type === "bezier") {
          hitArea.drawCircle(
            node.cp1.x * gridScaleX,
            node.cp1.y * gridScaleY,
            20,
          );
          hitArea.drawCircle(
            node.cp2.x * gridScaleX,
            node.cp2.y * gridScaleY,
            20,
          );
        }
      });
      hitArea.endFill();

      hitArea.eventMode = "static";
      hitArea.cursor = "pointer";

      hitArea.on("pointertap", (event) => {
        if ($mapStore.activeTool === "select") {
          event.stopPropagation();
          const restricted = [
            "light",
            "event",
            "audio",
            "overhead",
            "spawn",
            "emitter",
          ];
          if (
            event.nativeEvent.altKey &&
            isSelected &&
            !restricted.includes(category)
          ) {
            const localPt = vectorContainer.toLocal(event.global);
            const clickX = localPt.x / gridScaleX;
            const clickY = localPt.y / gridScaleY;
            mapActions.splitVector(item.id, category, clickX, clickY);
            return;
          }
          const isMulti = event.nativeEvent.shiftKey;
          mapActions.toggleSelection(item.id, isMulti);
        }
      });

      hitArea.on("pointerover", () => {
        if ($mapStore.activeTool === "select" && !isSelected)
          visibleLine.alpha = 0.5;
      });
      hitArea.on("pointerout", () => {
        visibleLine.alpha = 1.0;
      });

      vectorGroup.addChild(visibleLine);
      vectorGroup.addChild(hitArea);
      vectorContainer.addChild(vectorGroup);
    };

    walls.forEach((wall) => {
      const strokeColor = wall.type === "terrain" ? 0x4caf50 : 0x3a76cd;
      createClickablePath(wall, strokeColor, 4, "wall");
    });

    portals.forEach((portal) => {
      let strokeColor = 0xff9800;
      if (portal.type === "window") strokeColor = 0x00bcd4;
      if (portal.type === "secret") strokeColor = 0x9c27b0;
      createClickablePath(portal, strokeColor, 6, "portal");
    });
  }

  function tracePath(graphics, pathArray, scaleX, scaleY) {
    pathArray.forEach((node, index) => {
      const px = node.x * scaleX;
      const py = node.y * scaleY;
      if (node.type === "move" || index === 0) graphics.moveTo(px, py);
      else if (node.type === "line") graphics.lineTo(px, py);
      else if (node.type === "bezier")
        graphics.bezierCurveTo(
          node.cp1.x * scaleX,
          node.cp1.y * scaleY,
          node.cp2.x * scaleX,
          node.cp2.y * scaleY,
          px,
          py,
        );
    });
  }

  function traceDirectionalPointers(graphics, pathArray, scaleX, scaleY) {
    const POINTER_LENGTH = 15;
    for (let i = 1; i < pathArray.length; i++) {
      const prev = pathArray[i - 1];
      const curr = pathArray[i];
      if (curr.type === "line") {
        const p1x = prev.x * scaleX;
        const p1y = prev.y * scaleY;
        const p2x = curr.x * scaleX;
        const p2y = curr.y * scaleY;

        const midX = p1x + (p2x - p1x) / 2;
        const midY = p1y + (p2y - p1y) / 2;
        const dx = p2x - p1x;
        const dy = p2y - p1y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0) {
          const normalX = (-dy / length) * POINTER_LENGTH;
          const normalY = (dx / length) * POINTER_LENGTH;
          graphics.moveTo(midX, midY);
          graphics.lineTo(midX + normalX, midY + normalY);
        }
      }
    }
  }

  function onDragStart(event) {
    if ($mapStore.activeTool !== "pan") return;
    isDragging = true;
    dragStart = { x: event.global.x, y: event.global.y };
    canvasContainer.style.cursor = "grabbing";
  }

  function onDragEnd() {
    isDragging = false;
    if ($mapStore.activeTool === "pan") canvasContainer.style.cursor = "grab";
  }

  function onDragMove(event) {
    if (!isDragging || $mapStore.activeTool !== "pan") return;
    const dx = event.global.x - dragStart.x;
    const dy = event.global.y - dragStart.y;
    mapContainer.x += dx;
    mapContainer.y += dy;
    dragStart = { x: event.global.x, y: event.global.y };
  }

  function onWheel(event) {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? ZOOM_SPEED : 1 / ZOOM_SPEED;
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;
    const localPoint = {
      x: (mouseX - mapContainer.x) / mapContainer.scale.x,
      y: (mouseY - mapContainer.y) / mapContainer.scale.y,
    };
    mapContainer.scale.x *= zoomFactor;
    mapContainer.scale.y *= zoomFactor;
    mapContainer.x = mouseX - localPoint.x * mapContainer.scale.x;
    mapContainer.y = mouseY - localPoint.y * mapContainer.scale.y;
  }

  onDestroy(() => {
    if (app) {
      app.view.removeEventListener("wheel", onWheel);
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    }
  });
</script>

<div bind:this={canvasContainer} class="pixi-workspace" tabindex="0"></div>

<style>
  .pixi-workspace {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }
  :global(.pixi-workspace canvas) {
    display: block;
    width: 100%;
    height: 100%;
    outline: none;
  }
</style>
