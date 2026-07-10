<script>
  import { mapStore } from "../stores/mapStore.js";
  import { UvttMigrationEngine } from "../utils/migrationEngine.js";
  import JSZip from "jszip";

  let targetVersion = "2.0.0";
  let isExporting = false;
  let packageAsCompound = false;

  function slugify(text) {
    if (!text) return "map-layer";
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  }

  async function handleExport() {
    if (!$mapStore.manifest) return;
    isExporting = true;

    try {
      if (targetVersion === "2.0.0") {
        await exportV2();
      } else if (targetVersion === "1.0.0") {
        await exportV1();
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Check console for details.");
    } finally {
      isExporting = false;
    }
  }

  async function exportV2() {
    const zip = new JSZip();

    const currentCatalog = [...$mapStore.catalog];
    if ($mapStore.activeMapIndex >= 0) {
      currentCatalog[$mapStore.activeMapIndex].manifest = JSON.parse(
        JSON.stringify($mapStore.manifest),
      );
      currentCatalog[$mapStore.activeMapIndex].audioBlobs = {
        ...$mapStore.audioBlobs,
      };
    }

    if (packageAsCompound && currentCatalog.length > 1) {
      const masterManifest = {
        format_version: "2.0.0",
        type: "compound_archive",
        maps: [],
      };

      const mapsFolder = zip.folder("maps");

      for (let i = 0; i < currentCatalog.length; i++) {
        const catalogMap = currentCatalog[i];
        const cleanSlug = slugify(catalogMap.filename.replace(".uvtt2z", ""));
        const mapFolder = mapsFolder.folder(cleanSlug);

        masterManifest.maps.push(`internal://${cleanSlug}`);

        const manifest = JSON.parse(JSON.stringify(catalogMap.manifest));

        if (manifest.events) {
          manifest.events.forEach((event) => {
            if (
              event.destination?.type === "inter_map" &&
              event.destination.uri
            ) {
              const uriParts = event.destination.uri
                .replace("relative://", "")
                .split("#");
              const targetFilename = uriParts[0];
              const targetZone = uriParts[1] ? `#${uriParts[1]}` : "";

              const isInternal = currentCatalog.some(
                (m) => m.filename === targetFilename,
              );
              if (isInternal) {
                const targetSlug = slugify(
                  targetFilename.replace(".uvtt2z", ""),
                );
                event.destination.uri = `internal://${targetSlug}${targetZone}`;
              }
            }
          });
        }

        const geometry = {
          walls: manifest.geometry?.walls || [],
          portals: manifest.geometry?.portals || [],
          overhead: manifest.geometry?.overhead || [],
        };

        const entities = {
          music: manifest.music || {},
          ambience: manifest.ambience || {},
          lights: manifest.lights || [],
          events: manifest.events || [],
          audio: manifest.audio || [],
          landing_zones: manifest.landing_zones || [],
          emitters: manifest.emitters || [], // NEW: Added Emitters to entities
        };

        delete manifest.geometry;
        delete manifest.music;
        delete manifest.ambience;
        delete manifest.lights;
        delete manifest.events;
        delete manifest.audio;
        delete manifest.landing_zones;
        delete manifest.emitters; // NEW: Clean up from manifest

        manifest.image = { uri: `assets/${cleanSlug}.webp` };

        mapFolder.file("manifest.json", JSON.stringify(manifest, null, 2));
        mapFolder.file("geometry.json", JSON.stringify(geometry, null, 2));
        mapFolder.file("entities.json", JSON.stringify(entities, null, 2));

        const assetsFolder = mapFolder.folder("assets");
        assetsFolder.file(`${cleanSlug}.webp`, catalogMap.imageBlob);

        if (catalogMap.audioBlobs) {
          Object.entries(catalogMap.audioBlobs).forEach(
            ([filename, audioBlob]) => {
              assetsFolder.file(filename, audioBlob);
            },
          );
        }
      }

      zip.file("manifest.json", JSON.stringify(masterManifest, null, 2));

      const content = await zip.generateAsync({ type: "blob" });
      triggerDownload(content, "compound_mega_dungeon.uvtt2z");
    } else {
      const activeMap = currentCatalog[$mapStore.activeMapIndex];
      const manifest = JSON.parse(JSON.stringify(activeMap.manifest));

      const geometry = {
        walls: manifest.geometry?.walls || [],
        portals: manifest.geometry?.portals || [],
        overhead: manifest.geometry?.overhead || [],
      };
      const entities = {
        music: manifest.music || {},
        ambience: manifest.ambience || {},
        lights: manifest.lights || [],
        events: manifest.events || [],
        audio: manifest.audio || [],
        landing_zones: manifest.landing_zones || [],
        emitters: manifest.emitters || [], // NEW
      };

      delete manifest.geometry;
      delete manifest.music;
      delete manifest.ambience;
      delete manifest.lights;
      delete manifest.events;
      delete manifest.audio;
      delete manifest.landing_zones;
      delete manifest.emitters; // NEW

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      zip.file("geometry.json", JSON.stringify(geometry, null, 2));
      zip.file("entities.json", JSON.stringify(entities, null, 2));

      const assetsFolder = zip.folder("assets");
      assetsFolder.file("base_map.webp", activeMap.imageBlob);

      if ($mapStore.audioBlobs) {
        Object.entries($mapStore.audioBlobs).forEach(
          ([filename, audioBlob]) => {
            assetsFolder.file(filename, audioBlob);
          },
        );
      }

      const content = await zip.generateAsync({ type: "blob" });
      triggerDownload(content, activeMap.filename);
    }
  }

  async function exportV1() {
    const v1Manifest = UvttMigrationEngine.compileToTarget(
      $mapStore.manifest,
      "1.0.0",
    );
    const base64Image = await blobToBase64($mapStore.imageBlob);
    v1Manifest.image = base64Image;

    const jsonString = JSON.stringify(v1Manifest);
    const blob = new Blob([jsonString], { type: "application/json" });

    const activeMap = $mapStore.catalog[$mapStore.activeMapIndex];
    const filename =
      activeMap?.filename.replace(".uvtt2z", ".dd2vtt") ||
      "map_export_legacy.dd2vtt";

    triggerDownload(blob, filename);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        const base64Data = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="export-menu">
  <h3>EXPORT MAP</h3>
  <div class="input-group">
    <label
      >Target Engine Profile
      <select bind:value={targetVersion}>
        <option value="2.0.0">UVTT v2.0 (Modern Archive)</option>
        <option value="1.0.0">Legacy v1.0 (.dd2vtt)</option>
      </select>
    </label>
  </div>

  {#if targetVersion === "2.0.0" && $mapStore.catalog.length > 1}
    <div class="checkbox-group">
      <label>
        <input type="checkbox" bind:checked={packageAsCompound} />
        📦 Package Catalog as Single Compound Dungeon
      </label>
    </div>
  {/if}

  <p class="info-text">
    {#if targetVersion === "2.0.0"}
      {#if packageAsCompound}
        Bundles all {$mapStore.catalog.length} maps into a single mega-dungeon archive.
        Inter-map teleports will be automatically rewritten to internal paths.
      {:else}
        Compiles the active map as a Federated File utilizing detached assets
        and SVG vectors. Other maps must be exported separately.
      {/if}
    {:else}
      Executes Graceful Degradation to legacy format. Bézier curves will be
      flattened, and advanced properties will be cleanly pruned.
    {/if}
  </p>

  <button
    class="export-btn"
    on:click={handleExport}
    disabled={isExporting || !$mapStore.manifest}
  >
    {isExporting ? "Packaging Engine..." : "Download Export"}
  </button>
</div>

<style>
  .export-menu {
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 100;
    background-color: #252526;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    border: 1px solid #3c3c3c;
    color: #e0e0e0;
    width: 260px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  }
  .export-menu h3 {
    margin: 0;
    font-size: 13px;
    letter-spacing: 1px;
    color: #aaaaaa;
    border-bottom: 1px solid #444;
    padding-bottom: 6px;
  }
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  label {
    font-size: 12px;
    color: #cccccc;
    font-weight: bold;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  select {
    background-color: #1e1e1e;
    color: white;
    border: 1px solid #555;
    padding: 8px;
    border-radius: 4px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    margin-top: 4px;
    font-family: monospace;
  }
  select:focus {
    border-color: #007acc;
  }

  .checkbox-group {
    margin-top: 4px;
    background-color: #1e1e1e;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #555;
  }
  .checkbox-group label {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: normal;
    color: #4caf50;
    font-weight: bold;
  }

  .info-text {
    font-size: 11px;
    color: #ff9800;
    font-style: italic;
    margin: 0;
    line-height: 1.4;
  }

  .export-btn {
    background-color: #4caf50;
    color: white;
    border: none;
    padding: 10px;
    width: 100%;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .export-btn:hover {
    background-color: #388e3c;
  }
  .export-btn:disabled {
    background-color: #555;
    color: #888;
    cursor: not-allowed;
  }
</style>
