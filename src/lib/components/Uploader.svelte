<script>
  import { mapStore } from "$lib/stores/mapStore.svelte.js";
  import { upgradeLegacyMap } from "$lib/utils/legacyParser.js";

  let fileInput;

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const parsedMaps = [];

    for (const file of files) {
      const text = await file.text();
      const parsedMap = upgradeLegacyMap(text, file.name);
      if (parsedMap) parsedMaps.push(parsedMap);
    }

    if (parsedMaps.length > 0) {
      mapStore.setCatalog(parsedMaps);
    } else {
      alert("Failed to parse map files.");
    }

    fileInput.value = "";
  }
</script>

<div class="uploader-panel">
  <label class="upload-btn">
    <span>📁 Upload Maps (.dd2vtt / .uvtt)</span>
    <input
      type="file"
      multiple
      accept=".dd2vtt,.uvtt,.json,.txt"
      onchange={handleFileUpload}
      bind:this={fileInput}
      hidden
    />
  </label>
</div>

<style>
  .uploader-panel {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 20;
  }
  .upload-btn {
    background: #00f0ff22;
    border: 1px solid #00f0ff;
    color: #00f0ff;
    padding: 10px 15px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s;
    display: inline-block;
  }
  .upload-btn:hover {
    background: #00f0ff44;
    box-shadow: 0 0 10px #00f0ff44;
  }
</style>
