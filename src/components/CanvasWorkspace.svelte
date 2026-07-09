<script>
  import { onMount, onDestroy } from "svelte";
  import * as PIXI from "pixi.js";
  import { mapStore, mapActions } from "../stores/mapStore.js";

  let canvasContainer;
  let app;
  let mapSprite;
  let mapContainer;
  let vectorContainer;

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  const ZOOM_SPEED = 1.1;

  // Isolate Map Texture Reactivity
  let currentImageUrl = null;
  $: if (app && $mapStore.imageUrl && $mapStore.imageUrl !== currentImageUrl) {
    currentImageUrl = $mapStore.imageUrl;
    renderMapTexture(currentImageUrl);
  }

  // Bulletproof Reactivity Block
  $: {
    const walls = $mapStore.manifest?.geometry?.walls || [];
    const portals = $mapStore.manifest?.geometry?.portals || [];

    // Upgraded to handle the Multi-Select array
    const selectedIds = $mapStore.selectedItemIds || [];

    if (vectorContainer) {
      drawGeometry(walls, portals, selectedIds);
    }
  }

  // Dynamic cursor based on tool
  $: if (canvasContainer) {
    canvasContainer.style.cursor =
      $mapStore.activeTool === "pan" ? "grab" : "crosshair";
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

    // Use pointertap on the background to deselect items cleanly
    interactionLayer.on("pointertap", (e) => {
      if ($mapStore.activeTool === "select" && e.target === interactionLayer) {
        mapActions.clearSelection();
      }
    });

    // Keep pointerdown ONLY for camera panning
    interactionLayer.on("pointerdown", (e) => {
      if ($mapStore.activeTool === "pan") onDragStart(e);
    });

    interactionLayer.on("pointerup", onDragEnd);
    interactionLayer.on("pointerupoutside", onDragEnd);
    interactionLayer.on("pointermove", onDragMove);

    app.stage.addChild(interactionLayer);

    mapContainer = new PIXI.Container();
    app.stage.addChild(mapContainer);

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
  }

  function drawGeometry(walls, portals, selectedIds) {
    // Safely destroy all previous children
    vectorContainer
      .removeChildren()
      .forEach((child) => child.destroy({ children: true }));

    const gridScaleX = $mapStore.manifest.resolution.grid_size.x || 70;
    const gridScaleY = $mapStore.manifest.resolution.grid_size.y || 70;

    const createClickablePath = (item, baseColor, width = 4) => {
      const vectorGroup = new PIXI.Container();

      // Check if this specific item's ID is inside our multi-select array
      const isSelected = selectedIds.includes(item.id);

      // 1. The Visual Line (No interaction, just pure styling)
      const visibleLine = new PIXI.Graphics();
      const strokeColor = isSelected ? 0xffffff : baseColor;
      const strokeWidth = isSelected ? width + 6 : width;

      visibleLine.lineStyle(strokeWidth, strokeColor, 1);
      tracePath(visibleLine, item.path, gridScaleX, gridScaleY);

      // --- Draw Directional Pointers ---
      visibleLine.lineStyle(2, strokeColor, 1);
      traceDirectionalPointers(visibleLine, item.path, gridScaleX, gridScaleY);

      // 2. The Hit Nodes (PixiJS requires FILLS to register clicks)
      const hitArea = new PIXI.Graphics();
      hitArea.beginFill(0x000000, 0.001); // Magic 1% Fill

      item.path.forEach((node, index) => {
        const px = node.x * gridScaleX;
        const py = node.y * gridScaleY;

        // Draw a fat, filled circle at every point
        hitArea.drawCircle(px, py, 20);

        // If it is a line segment, draw a filled circle in the dead center
        if (node.type === "line" && index > 0) {
          const prev = item.path[index - 1];
          const midX = (prev.x * gridScaleX + px) / 2;
          const midY = (prev.y * gridScaleY + py) / 2;
          hitArea.drawCircle(midX, midY, 20);
        }
        // If it's a Bezier, make the control curves clickable
        else if (node.type === "bezier") {
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

          // Detect Shift key for multi-select arrays
          const isMulti = event.nativeEvent.shiftKey;
          mapActions.toggleSelection(item.id, isMulti);
        }
      });

      hitArea.on("pointerover", () => {
        if ($mapStore.activeTool === "select" && !isSelected) {
          visibleLine.alpha = 0.5;
        }
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
      createClickablePath(wall, strokeColor, 4);
    });

    portals.forEach((portal) => {
      let strokeColor = 0xff9800;
      if (portal.type === "window") strokeColor = 0x00bcd4;
      if (portal.type === "secret") strokeColor = 0x9c27b0;

      createClickablePath(portal, strokeColor, 6);
    });
  }

  function tracePath(graphics, pathArray, scaleX, scaleY) {
    pathArray.forEach((node, index) => {
      const px = node.x * scaleX;
      const py = node.y * scaleY;

      if (node.type === "move" || index === 0) {
        graphics.moveTo(px, py);
      } else if (node.type === "line") {
        graphics.lineTo(px, py);
      } else if (node.type === "bezier") {
        graphics.bezierCurveTo(
          node.cp1.x * scaleX,
          node.cp1.y * scaleY,
          node.cp2.x * scaleX,
          node.cp2.y * scaleY,
          px,
          py,
        );
      }
    });
  }

  function traceDirectionalPointers(graphics, pathArray, scaleX, scaleY) {
    const POINTER_LENGTH = 15; // Fixed pixel length for the pointer tick

    for (let i = 1; i < pathArray.length; i++) {
      const prev = pathArray[i - 1];
      const curr = pathArray[i];

      // For now, we calculate normal vectors for straight lines
      if (curr.type === "line") {
        const p1x = prev.x * scaleX;
        const p1y = prev.y * scaleY;
        const p2x = curr.x * scaleX;
        const p2y = curr.y * scaleY;

        // 1. Find the exact midpoint
        const midX = p1x + (p2x - p1x) / 2;
        const midY = p1y + (p2y - p1y) / 2;

        // 2. Calculate the Right-Hand Normal Vector
        const dx = p2x - p1x;
        const dy = p2y - p1y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0) {
          // Normalize and apply 90-degree clockwise rotation (-dy, dx)
          const normalX = (-dy / length) * POINTER_LENGTH;
          const normalY = (dx / length) * POINTER_LENGTH;

          // 3. Draw the tick mark
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
