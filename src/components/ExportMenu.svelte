<script>
  import JSZip from "jszip";
  import { mapStore } from "../stores/mapStore.js";

  let isExporting = false;

  // Helper: Generates a tiny, compressed thumbnail for the VTT file browser
  async function generateThumbnail(imageBlob) {
    const bitmap = await createImageBitmap(imageBlob);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Scale down to a max width of 512px
    const scale = 512 / bitmap.width;
    canvas.width = 512;
    canvas.height = bitmap.height * scale;

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.8);
    });
  }

  async function exportUVTT2() {
    if (!$mapStore.manifest || !$mapStore.imageBlob) return;
    isExporting = true;

    try {
      const zip = new JSZip();

      // 1. Compile the Root Manifest
      const rootManifest = {
        format_version: "2.0.0",
        description: "Compiled via UVTT v2 Upgrader",
        files: {
          metadata: "map.json",
          assets: ["assets/map.png"],
        },
      };
      zip.file("manifest.json", JSON.stringify(rootManifest, null, 4));

      // 2. Compile the Map Payload (Geometry, Events, Lighting)
      const mapData = JSON.parse(JSON.stringify($mapStore.manifest));

      // Swap out Base64 data for the modern local URI routing
      mapData.image = { uri: "assets/map.png" };

      zip.file("map.json", JSON.stringify(mapData, null, 4));

      // 3. Package the Raw Binary Asset
      zip.folder("assets").file("map.png", $mapStore.imageBlob);

      // 4. Generate and Package the lightweight preview thumbnail
      const previewBlob = await generateThumbnail($mapStore.imageBlob);
      zip.file("preview.webp", previewBlob);

      // 5. Generate the ZIP Archive and trigger the browser download
      const zipContent = await zip.generateAsync({ type: "blob" });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipContent);
      link.download = "upgraded_campaign_map.uvtt2";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to compile .uvtt2 package:", error);
      alert("Export failed. Check the console for details.");
    } finally {
      isExporting = false;
    }
  }
</script>

<div class="export-container">
  <button on:click={exportUVTT2} disabled={isExporting}>
    {isExporting ? "📦 Compiling Archive..." : "💾 Export .uvtt2"}
  </button>
</div>

<style>
  .export-container {
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 100;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  }

  button {
    background-color: #4caf50;
    border: none;
    color: white;
    padding: 14px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    font-size: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    transition: all 0.2s;
  }

  button:hover:not(:disabled) {
    background-color: #45a049;
    transform: translateY(-2px);
  }

  button:disabled {
    background-color: #555555;
    color: #aaaaaa;
    cursor: wait;
  }
</style>
