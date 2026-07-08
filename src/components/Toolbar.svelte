<script>
  import { mapStore, mapActions } from "../stores/mapStore.js";

  // Reactive selection locator
  $: selectedItem =
    $mapStore.selectedItemId && $mapStore.manifest
      ? findSelectedItem($mapStore.selectedItemId)
      : null;

  function findSelectedItem(id) {
    if (!id) return null;
    const wall = $mapStore.manifest.geometry.walls.find((w) => w.id === id);
    if (wall) return { category: "wall", data: wall };

    const portal = $mapStore.manifest.geometry.portals.find((p) => p.id === id);
    if (portal) return { category: "portal", data: portal };

    return null;
  }

  function toggleTool(tool) {
    mapActions.setTool(tool);
  }

  // --- NEW: Universal Input Handler ---
  function handleEdit(propertyPath, event) {
    if (!selectedItem) return;

    let value = event.target.value;

    // Ensure proper data types based on the HTML input type
    if (event.target.type === "checkbox") value = event.target.checked;
    if (event.target.type === "number") value = parseFloat(value) || 0;

    mapActions.updateItemProperty(
      selectedItem.data.id,
      selectedItem.category,
      propertyPath,
      value,
    );
  }
</script>

<div class="toolbar-container">
  <div class="tool-group">
    <button
      class:active={$mapStore.activeTool === "pan"}
      on:click={() => toggleTool("pan")}
      title="Pan Camera"
    >
      ✋ Pan
    </button>
    <button
      class:active={$mapStore.activeTool === "select"}
      on:click={() => toggleTool("select")}
      title="Select & Edit Elements"
    >
      ↖️ Select
    </button>
  </div>

  {#if selectedItem}
    <div class="edit-menu">
      <h3>{selectedItem.category.toUpperCase()} PROPERTIES</h3>
      <p class="id-label">ID: {selectedItem.data.id}</p>

      {#if selectedItem.category === "portal"}
        <div class="input-group">
          <label>Portal Type</label>
          <select
            value={selectedItem.data.type}
            on:change={(e) => handleEdit("type", e)}
          >
            <option value="door">Door</option>
            <option value="window">Window</option>
            <option value="secret">Secret Door</option>
          </select>
        </div>
      {/if}

      {#if selectedItem.category === "wall"}
        <div class="input-group">
          <label>Wall Type</label>
          <select
            value={selectedItem.data.type}
            on:change={(e) => handleEdit("type", e)}
          >
            <option value="standard">Standard Wall</option>
            <option value="terrain"
              >Terrain (Blocks Sight, Allows Movement)</option
            >
            <option value="illusory">Illusory</option>
          </select>
        </div>

        <div class="split-group">
          <div class="input-group">
            <label>Top Height (ft)</label>
            <input
              type="number"
              step="0.5"
              value={selectedItem.data.height?.top ?? 10}
              on:change={(e) => handleEdit("height.top", e)}
            />
          </div>
          <div class="input-group">
            <label>Bottom Height (ft)</label>
            <input
              type="number"
              step="0.5"
              value={selectedItem.data.height?.bottom ?? 0}
              on:change={(e) => handleEdit("height.bottom", e)}
            />
          </div>
        </div>

        <div class="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={selectedItem.data.states?.ethereal ?? false}
              on:change={(e) => handleEdit("states.ethereal", e)}
            />
            Ethereal Phase (Bypass)
          </label>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .toolbar-container {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 15px;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  }

  .tool-group {
    display: flex;
    background-color: #252526;
    border-radius: 8px;
    padding: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    border: 1px solid #3c3c3c;
  }

  button {
    background: transparent;
    border: none;
    color: #cccccc;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s;
  }

  button:hover {
    background-color: #333333;
    color: white;
  }

  button.active {
    background-color: #007acc;
    color: white;
  }

  .edit-menu {
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
  }

  .edit-menu h3 {
    margin: 0;
    font-size: 13px;
    letter-spacing: 1px;
    color: #aaaaaa;
    border-bottom: 1px solid #444;
    padding-bottom: 6px;
  }

  .id-label {
    font-size: 11px;
    font-family: monospace;
    color: #007acc;
    margin: 0;
    word-break: break-all;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .split-group {
    display: flex;
    gap: 12px;
  }

  .split-group .input-group {
    flex: 1;
  }

  label {
    font-size: 12px;
    color: #cccccc;
    font-weight: bold;
  }

  select,
  input[type="number"] {
    background-color: #1e1e1e;
    color: white;
    border: 1px solid #555;
    padding: 8px;
    border-radius: 4px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }

  select:focus,
  input[type="number"]:focus {
    border-color: #007acc;
  }

  .checkbox-group {
    margin-top: 8px;
    background-color: #1e1e1e;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #555;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: normal;
  }
</style>
