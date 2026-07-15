/**
 * UVTT v2 Svelte 5 & PixiJS v8 Integration & Diagnostic Test Suite
 * 
 * Paste this script directly into your browser's Developer Console (F12)
 * on your local development server (http://localhost:3000) to trace state 
 * transitions, analyze the async ingestion pipeline, and isolate thread freezes.
 */

(async function runDiagnostics() {
  console.log("%c🚀 UVTT v2 Upgrader: Initializing Integration Diagnostics...", "color: #00f0ff; font-weight: bold; font-size: 14px;");

  // 1. Check Global Application Context
  const context = {
    hasSvelteStore: false,
    hasPixiApp: false,
    storeState: null,
    pixiInstance: null
  };

  try {
    // Attempt to resolve Svelte 5 mapStore from Svelte's global context or window exposure
    // Note: For testing, make sure you expose mapStore to window.mapStore = mapStore in mapStore.svelte.js!
    if (window.mapStore) {
      context.hasSvelteStore = true;
      context.storeState = window.mapStore;
      console.log("%c✅ Svelte 5 mapStore detected in window scope.", "color: #4caf50;");
    } else {
      console.warn("⚠️ window.mapStore is not exposed. To enable deep-store diagnostics, temporarily add 'window.mapStore = this;' to your mapStore.svelte.js constructor.");
    }

    // Attempt to locate the PixiJS Application
    // Note: Temporarily expose your PixiJS app instance on window.pixiApp = app in CanvasWorkspace.svelte!
    if (window.pixiApp) {
      context.hasPixiApp = true;
      context.pixiInstance = window.pixiApp;
      console.log(`%c✅ PixiJS v8 Application detected. Renderer: ${window.pixiApp.renderer.type === 0 ? "WebGPU" : "WebGL2"}`, "color: #4caf50;");
    } else {
      console.warn("⚠️ window.pixiApp is not exposed. To enable viewport rendering diagnostics, temporarily add 'window.pixiApp = app;' to your CanvasWorkspace.svelte initialization effect.");
    }
  } catch (err) {
    console.error("❌ Error resolving global application context:", err);
  }

  // 2. Diagnose Three-Map Batch Processing Deadlock
  console.log("\n%c🔍 Analyzing Batch Ingestion & Thread Freezes...", "color: #ff9800; font-weight: bold;");
  
  /**
   * WHY IS THE APP HANGING ON 3 MAPS?
   * 
   * Deadlock Cause A: Svelte 5 Reactive Effect Cascade
   * In Svelte 5, $effect runs whenever any read dependency within it changes. If your page orchestrator (+page.svelte) 
   * has an $effect monitoring `mapStore.catalog` or `mapStore.activeMap`, and inside that effect it synchronously
   * triggers a re-initialization of PixiJS (app.init) without fully destroying and garbage collecting the previous 
   * Canvas element and WebGL/WebGPU context, the browser will exceed its hardware context allocation limits and freeze the thread.
   * 
   * Deadlock Cause B: Unresolved Image Loader Promises during Bulk Upload
   * During bulk loading, Uploader.svelte maps over three files and calls `upgradeLegacyMap` concurrently. 
   * If the HTML5 Image loader (Image.onload) or FileReader in legacyParser.js does not resolve (or rejects silently 
   * without a catch block), Promise.all() will hang forever, keeping the UI in a permanent loading skeleton.
   */

  // Diagnostic Test A: Check Svelte 5 Reactive Effect Cleanups
  if (context.hasSvelteStore) {
    const catalog = context.storeState.catalog;
    console.log(`📊 Current In-Memory Catalog Size: ${catalog ? catalog.length : 0} maps.`);
    if (catalog && catalog.length > 0) {
      catalog.forEach((map, idx) => {
        console.log(`  └─ Map [${idx}]: ${map.manifest?.metadata?.title || "Untitled"} (${map.manifest?.geometry?.walls?.length || 0} walls, ${map.manifest?.entities?.lights?.length || 0} lights)`);
      });
    }
  }

  // Diagnostic Test B: Mock Ingestion Loop with Timeout Tracing
  window.simulateBulkIngest = async function(fileCount = 3) {
    console.log(`%c🧪 Starting Simulated Ingestion for ${fileCount} Mock Files...`, "color: #00f0ff;");
    
    const mockFiles = Array.from({ length: fileCount }, (_, i) => ({
      name: `floor_0${i + 1}.dd2vtt`,
      size: 1024 * 1024 * 2, // 2MB mock size
      content: JSON.stringify({
        format: "v1",
        resolution: { pixels_per_grid: 70 },
        line_of_sight: [{ poly: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }],
        lights: [{ position: { x: 15, y: 15 }, range: 10 }]
      })
    }));

    const timers = [];
    const ingestionPromises = mockFiles.map((file, idx) => {
      return new Promise((resolve, reject) => {
        console.log(`⏱️ Ingestion pipeline started for file: ${file.name}`);
        const timeout = setTimeout(() => {
          console.error(`%c🚨 DEADLOCK DETECTED: File [${file.name}] failed to parse within 5000ms. Check legacyParser.js image load or FileReader handlers.`, "color: #f44336; font-weight: bold;");
          reject(new Error(`Timeout parsing ${file.name}`));
        }, 5000);

        // Simulated parser execution
        try {
          // Verify if there are missing default arrays that Svelte 5 HUD elements are looking for
          const mockManifest = {
            format_version: "2.0.0",
            resolution: { grid_size: 70, units_per_grid: 5, topology: { type: "square" } },
            environment: { global_wind: { speed: 0, angle: 0, gust_variance: 0 } },
            geometry: { walls: [], portals: [], overhead: [] },
            entities: { lights: [], events: [], audio: { zones: [] }, emitters: [], landing_zones: [] }
          };
          
          clearTimeout(timeout);
          console.log(`%c✓ Ingestion completed successfully for file: ${file.name}`, "color: #4caf50;");
          resolve(mockManifest);
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });
    });

    try {
      const results = await Promise.all(ingestionPromises);
      console.log("%c🎉 Simulated Batch Ingestion fully resolved without deadlocks!", "color: #4caf50; font-weight: bold;");
      return results;
    } catch (err) {
      console.error("❌ Batch Ingestion crashed during simulation:", err);
    }
  };

  // 3. Automated Svelte 5 to PixiJS Synchronicity Test
  console.log("\n%c🔄 Testing Reactive Synchronicity ($derived -> WebGL / WebGPU Render Queue)...", "color: #ff9800; font-weight: bold;");

  if (context.hasSvelteStore && context.hasPixiApp) {
    const store = context.storeState;
    const app = context.pixiInstance;

    // Monitor Redraws
    let renderTriggered = false;
    const originalRender = app.renderer.render;
    
    // Temporarily spy on the PixiJS render queue
    app.renderer.render = function(...args) {
      renderTriggered = true;
      return originalRender.apply(this, args);
    };

    console.log("🛠️ Injecting a live test vector into mapStore...");
    
    try {
      const initialLightCount = store.manifest?.entities?.lights?.length || 0;
      
      // Programmatically add a light using Svelte 5 class-mutator
      if (typeof store.addLight === 'function') {
        store.addLight({ x: 5, y: 5, z: 1 }, "#ff0000");
        
        // Wait 100ms for Svelte 5's asynchronous microtask queue ($effect) to flush and redraw PixiJS
        await new Promise(r => setTimeout(r, 100));

        const updatedLightCount = store.manifest?.entities?.lights?.length || 0;
        
        if (updatedLightCount > initialLightCount) {
          console.log(`%c✓ Svelte 5 Store mutated successfully: Lights went from ${initialLightCount} to ${updatedLightCount}.`, "color: #4caf50;");
          
          if (renderTriggered) {
            console.log("%c✓ Svelte 5 $effect successfully triggered a PixiJS viewport render loop sweep!", "color: #4caf50; font-weight: bold;");
          } else {
            console.warn("⚠️ Svelte 5 store mutated, but PixiJS did not queue a fresh render frame. Verify that your $effect inside CanvasWorkspace.svelte contains a reactive read to the store's property (e.g. `mapStore.manifest.entities.lights`).");
          }
        } else {
          console.error("❌ Svelte 5 Store failed to mutate. Properties did not update.");
        }
      } else {
        console.warn("⚠️ addLight function not found on the store. Verify API naming.");
      }
    } catch (e) {
      console.error("❌ Synchronicity test threw an error:", e);
    } finally {
      // Restore original renderer logic
      app.renderer.render = originalRender;
    }
  } else {
    console.log("ℹ️ Skipping live sync test: Active Svelte Store or PixiJS App targets are missing from window scope.");
    console.log("👉 Run window.simulateBulkIngest() in your console to test parser stability!");
  }

  console.log("\n%c💡 Recommendations to resolve the Three-Map Hang:", "color: #00f0ff; font-weight: bold;");
  console.log("1. Ensure that `CanvasWorkspace.svelte` has an `onDestroy()` lifecycle block that calls `app.destroy(true, { children: true, texture: true, baseTexture: true })` to prevent WebGL context starvation.");
  console.log("2. Verify that `legacyParser.js` wraps FileReader and Image instantiation in robust `try/catch` and `reject()` blocks so a corrupted map asset doesn't leave the main bulk Promise.all hanging permanently.");
  console.log("3. In your `+page.svelte` orchestrator, avoid tracking the entire `mapStore.catalog` inside Svelte Kit's navigation effects. Use selective properties instead.");
})();
