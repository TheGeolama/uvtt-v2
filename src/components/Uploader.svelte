<script>
  import { mapActions } from "../stores/mapStore.js";
  import { upgradeLegacyMap } from "../utils/legacyParser.js";

  let isDragging = false;
  let isProcessing = false;
  let errorMessage = "";

  function onDragOver(event) {
    event.preventDefault();
    isDragging = true;
  }

  function onDragLeave(event) {
    event.preventDefault();
    isDragging = false;
  }

  async function onDrop(event) {
    event.preventDefault();
    isDragging = false;
    errorMessage = "";

    const file = event.dataTransfer.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (
      !fileName.endsWith(".dd2vtt") &&
      !fileName.endsWith(".df2vtt") &&
      !fileName.endsWith(".uvtt") &&
      !fileName.endsWith(".json")
    ) {
      errorMessage =
        "Please upload a valid legacy v1 (.dd2vtt, .df2vtt, or .uvtt) map file.";
      return;
    }

    isProcessing = true;

    try {
      const upgradedData = await upgradeLegacyMap(file);
      mapActions.setImage(
        upgradedData.imageUrl,
        upgradedData.imageBlob,
        upgradedData.manifest,
      );
    } catch (error) {
      console.error("Error parsing legacy map file:", error);
      errorMessage =
        "Failed to parse the map file. Ensure it is a valid v1 JSON structure.";
    } finally {
      isProcessing = false;
    }
  }
</script>

<div
  class="uploader-container"
  class:dragging={isDragging}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:drop={onDrop}
>
  <div class="uploader-content">
    <svg
      viewBox="0 0 24 24"
      width="64"
      height="64"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>

    <h2>{isProcessing ? "Upgrading Map Data..." : "Drag & Drop Legacy Map"}</h2>
    <p>
      {isProcessing
        ? "Flattening curves and optimizing WebGL textures. Please wait."
        : "Supports .dd2vtt, .df2vtt, and .uvtt formats"}
    </p>

    {#if errorMessage}
      <div class="error-banner">{errorMessage}</div>
    {/if}
  </div>
</div>

<style>
  .uploader-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    background-color: #1e1e1e;
    border: 4px dashed #444;
    transition: all 0.2s ease-in-out;
    box-sizing: border-box;
  }

  .uploader-container.dragging {
    border-color: #3a76cd;
    background-color: rgba(58, 118, 205, 0.08);
  }

  .uploader-content {
    text-align: center;
    color: #b3b3b3;
    font-family: sans-serif;
    pointer-events: none;
  }

  .uploader-content svg {
    margin-bottom: 20px;
    color: #3a76cd;
    transition: transform 0.2s ease;
  }

  .uploader-container.dragging .uploader-content svg {
    transform: translateY(-10px);
  }

  .uploader-content h2 {
    color: #ffffff;
    font-size: 28px;
    margin: 0 0 12px 0;
    font-weight: 600;
  }

  .uploader-content p {
    margin: 0;
    font-size: 15px;
  }

  .error-banner {
    margin-top: 24px;
    padding: 12px 16px;
    background-color: rgba(255, 60, 60, 0.1);
    color: #ff5555;
    border: 1px solid #ff5555;
    border-radius: 6px;
    font-size: 14px;
  }
</style>
