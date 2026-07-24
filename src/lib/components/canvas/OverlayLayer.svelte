<script>
  import { onMount, onDestroy } from "svelte";
  import * as PIXI from "pixi.js";
  import { mapStore } from "$lib/stores/mapStore.svelte.js";

  let {
    parentContainer,
    isBoxSelecting,
    boxSelectStart,
    boxSelectEnd,
    isGridAligning,
    alignBoxStart,
    alignBoxEnd,
    draftingPath,
    draftingPreview,
  } = $props();

  let layerContainer = new PIXI.Container();
  let isReady = $state(false);

  onMount(() => {
    parentContainer.addChild(layerContainer);
    isReady = true;
  });

  onDestroy(() => {
    if (layerContainer) {
      layerContainer.destroy({ children: true });
    }
  });

  $effect(() => {
    let _ = mapStore.redrawTick; // Tie into master refresh cycle

    // We bind to these props so Svelte natively re-runs this effect
    // the exact millisecond the mouse moves and updates draftingPreview
    let _preview = draftingPreview;
    let _path = draftingPath;

    if (!isReady || !mapStore.activeMap) return;

    // Clear all previous overlay graphics
    layerContainer.removeChildren().forEach((c) => c.destroy());

    const manifest = mapStore.activeMap.manifest;
    const res = manifest.resolution;
    const gridX = Number(res.pixels_per_grid) || 70;
    const gridY = Number(res.pixels_per_grid_y) || gridX;
    const originX = Number(res.map_origin[0]) || 0;
    const originY = Number(res.map_origin[1]) || 0;

    // 1. Draw Selection Box
    if (isBoxSelecting && boxSelectStart && boxSelectEnd) {
      const selectGfx = new PIXI.Graphics();
      layerContainer.addChild(selectGfx);

      const minX = Math.min(boxSelectStart.x, boxSelectEnd.x);
      const minY = Math.min(boxSelectStart.y, boxSelectEnd.y);
      const w = Math.abs(boxSelectEnd.x - boxSelectStart.x);
      const h = Math.abs(boxSelectEnd.y - boxSelectStart.y);

      selectGfx.rect(
        (minX - originX) * gridX,
        (minY - originY) * gridY,
        w * gridX,
        h * gridY,
      );
      selectGfx.fill({ color: 0x38bdf8, alpha: 0.1 });
      selectGfx.stroke({ width: 1, color: 0x38bdf8, alpha: 0.8 });
    }

    // 2. Draw Grid Alignment Box
    if (isGridAligning && alignBoxStart && alignBoxEnd) {
      const alignGfx = new PIXI.Graphics();
      layerContainer.addChild(alignGfx);

      alignGfx.rect(
        Math.min(alignBoxStart.x, alignBoxEnd.x),
        Math.min(alignBoxStart.y, alignBoxEnd.y),
        Math.abs(alignBoxEnd.x - alignBoxStart.x),
        Math.abs(alignBoxEnd.y - alignBoxStart.y),
      );
      alignGfx.fill({ color: 0xeab308, alpha: 0.3 });
      alignGfx.stroke({
        width: 2,
        color: 0xeab308,
        alpha: 0.9,
        dash: [5, 5],
      });
    }

    // 3. Draw Drafting Lines (Walls, Portals, Roofs in progress)
    if (draftingPath.length > 0 || draftingPreview) {
      const draftGfx = new PIXI.Graphics();
      layerContainer.addChild(draftGfx);

      const activeTool = mapStore.activeTool;

      // Determine UX Color based on active tool
      let dColor = 0x38bdf8; // Blue for Walls
      if (activeTool === "portal") dColor = 0x22c55e; // Green for Portals
      if (activeTool === "roof" || activeTool === "overhead") dColor = 0xeab308; // Yellow for Roofs

      // --- Draw the committed points ---
      if (draftingPath.length > 0) {
        draftGfx.moveTo(
          (Number(draftingPath[0].x) - originX) * gridX,
          (Number(draftingPath[0].y) - originY) * gridY,
        );

        for (let i = 1; i < draftingPath.length; i++) {
          draftGfx.lineTo(
            (Number(draftingPath[i].x) - originX) * gridX,
            (Number(draftingPath[i].y) - originY) * gridY,
          );
        }

        draftGfx.stroke({ width: 3, color: dColor, alpha: 1.0 });

        // Draw hard white dots for committed vertices
        for (let i = 0; i < draftingPath.length; i++) {
          draftGfx
            .circle(
              (Number(draftingPath[i].x) - originX) * gridX,
              (Number(draftingPath[i].y) - originY) * gridY,
              4,
            )
            .fill({ color: 0xffffff, alpha: 1.0 });
        }
      }

      // --- Draw the Live Rubber-Band Line ---
      if (draftingPath.length > 0 && draftingPreview) {
        const lastPt = draftingPath[draftingPath.length - 1];
        const startX = (Number(lastPt.x) - originX) * gridX;
        const startY = (Number(lastPt.y) - originY) * gridY;
        const endX = (Number(draftingPreview.x) - originX) * gridX;
        const endY = (Number(draftingPreview.y) - originY) * gridY;

        const rbGfx = new PIXI.Graphics();
        rbGfx.moveTo(startX, startY).lineTo(endX, endY);
        // Dashed line to indicate it is pending/uncommitted
        rbGfx.stroke({ width: 2.5, color: dColor, alpha: 0.7, dash: [8, 8] });
        layerContainer.addChild(rbGfx);
      }

      // --- Draw the Snap Halo at the Cursor ---
      if (draftingPreview) {
        const px = (Number(draftingPreview.x) - originX) * gridX;
        const py = (Number(draftingPreview.y) - originY) * gridY;

        // The targeting outer ring (Halo)
        draftGfx
          .circle(px, py, 14)
          .stroke({ width: 2, color: dColor, alpha: 0.6 });

        // The core focal point
        draftGfx.circle(px, py, 5).fill({ color: dColor, alpha: 1.0 });
      }
    }
  });
</script>
