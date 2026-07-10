<script>
  import { upgradeLegacyMap } from "../utils/legacyParser.js";
  import { mapActions } from "../stores/mapStore.js";

  let isDragging = false;
  let isProcessing = false;
  let statusMessage = "Drop legacy .dd2vtt, .df2vtt, or folder here";

  function handleDragEnter(e) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  async function handleDrop(e) {
    e.preventDefault();
    isDragging = false;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  }

  async function handleFileInput(e) {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  }

  async function processFiles(files) {
    isProcessing = true;
    const parsedMaps = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      statusMessage = `Parsing ${file.name} (${i + 1}/${files.length})...`;

      try {
        const { imageUrl, imageBlob, manifest } = await upgradeLegacyMap(file);

        // Establish UVTT v2 filename
        const extIndex = file.name.lastIndexOf(".");
        const baseName =
          extIndex !== -1 ? file.name.substring(0, extIndex) : file.name;
        const v2Filename = `${baseName}.uvtt2z`;

        parsedMaps.push({
          filename: v2Filename,
          originalName: file.name,
          imageUrl,
          imageBlob,
          manifest,
        });
      } catch (err) {
        console.error(`Error parsing ${file.name}:`, err);
      }
    }

    if (parsedMaps.length > 0) {
      statusMessage = "Compiling Catalog...";
      mapActions.setCatalog(parsedMaps);
    } else {
      statusMessage = "No valid maps processed. Please try again.";
      isProcessing = false;
    }
  }
</script>

<div
  class="upload-container"
  class:dragging={isDragging}
  on:dragenter={handleDragEnter}
  on:dragover={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  {#if isProcessing}
    <div class="loader">
      <div class="spinner"></div>
      <h2>{statusMessage}</h2>
      <p>Bypassing Base64 memory limits and normalizing vectors...</p>
    </div>
  {:else}
    <div class="upload-box">
      <h2>{statusMessage}</h2>
      <p>
        Upload a single map, or drop an entire folder to build a Multi-Level
        Campaign Network.
      </p>
      <input
        type="file"
        id="fileElem"
        multiple
        accept=".dd2vtt,.df2vtt"
        on:change={handleFileInput}
        style="display:none;"
      />
      <button on:click={() => document.getElementById("fileElem").click()}
        >Browse Files</button
      >
    </div>
  {/if}
</div>

<style>
  .upload-container {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #1e1e1e;
    color: #e0e0e0;
    transition: background-color 0.2s ease;
  }
  .upload-container.dragging {
    background-color: #2d2d30;
  }
  .upload-box {
    border: 2px dashed #555;
    border-radius: 12px;
    padding: 60px;
    text-align: center;
    background-color: #252526;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  .upload-box.dragging {
    border-color: #007acc;
    background-color: #1e1e1e;
  }
  button {
    background-color: #007acc;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 4px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    margin-top: 20px;
    transition: background-color 0.2s;
  }
  button:hover {
    background-color: #005f9e;
  }
  h2 {
    margin-bottom: 8px;
    color: #ffffff;
  }
  p {
    color: #aaaaaa;
  }

  .loader {
    text-align: center;
  }
  .spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #333;
    border-top-color: #007acc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px auto;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
