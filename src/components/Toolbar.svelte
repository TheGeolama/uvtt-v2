<script>
  import { mapStore, mapActions } from "../stores/mapStore.js";

  // Reactive selection locator handling multiple items
  $: selectedItems = $mapStore.manifest
    ? getSelectedItems($mapStore.selectedItemIds)
    : [];

  // Check if we have multiple items and if they are specifically walls (we shouldn't merge doors)
  $: canMerge =
    selectedItems.length > 1 &&
    selectedItems.every((item) => item.category === "wall");

  function getSelectedItems(ids) {
    if (!ids || ids.length === 0) return [];
    const items = [];

    ids.forEach((id) => {
      const wall = $mapStore.manifest.geometry.walls.find((w) => w.id === id);
      if (wall) {
        items.push({ category: "wall", data: wall });
        return;
      }
      const portal = $mapStore.manifest.geometry.portals.find(
        (p) => p.id === id,
      );
      if (portal) items.push({ category: "portal", data: portal });
    });

    return items;
  }

  function toggleTool(tool) {
    mapActions.setTool(tool);
  }

  function handleEdit(propertyPath, event) {
    if (selectedItems.length !== 1) return;
    const singleItem = selectedItems[0];

    let value = event.target.value;
    if (event.target.type === "checkbox") value = event.target.checked;
    if (event.target.type === "number") value = parseFloat(value) || 0;

    mapActions.updateItemProperty(
      singleItem.data.id,
      singleItem.category,
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
      title="Select & Edit Elements (Shift+Click for Multi)"
    >
      ↖️ Select
    </button>
  </div>

  {#if selectedItems.length === 1}
    <div class="edit-menu">
      <h3>{selectedItems[0].category.toUpperCase()} PROPERTIES</h3>
      <p class="id-label">ID: {selectedItems[0].data.id}</p>

      {#if selectedItems[0].category === "portal"}
        <div class="input-group">
          <label>
            Portal Type
            <select
              value={selectedItems[0].data.type}
              on:change={(e) => handleEdit("type", e)}
            >
              <option value="door">Door</option>
              <option value="window">Window</option>
              <option value="secret">Secret Door</option>
            </select>
          </label>
        </div>
      {/if}

      {#if selectedItems[0].category === "wall"}
        <div class="input-group">
          <label>
            Wall Type
            <select
              value={selectedItems[0].data.type}
              on:change={(e) => handleEdit("type", e)}
            >
              <option value="standard">Standard Wall</option>
              <option value="terrain"
                >Terrain (Blocks Sight, Allows Movement)</option
              >
              <option value="illusory">Illusory</option>
            </select>
          </label>
        </div>

        <div class="split-group">
          <div class="input-group">
            <label>
              Top Height (ft)
              <input
                type="number"
                step="0.5"
                value={selectedItems[0].data.height?.top ?? 10}
                on:change={(e) => handleEdit("height.top", e)}
              />
            </label>
          </div>
          <div class="input-group">
            <label>
              Bottom Height (ft)
              <input
                type="number"
                step="0.5"
                value={selectedItems[0].data.height?.bottom ?? 0}
                on:change={(e) => handleEdit("height.bottom", e)}
              />
            </label>
          </div>
        </div>

        <div class="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={selectedItems[0].data.states?.ethereal ?? false}
              on:change={(e) => handleEdit("states.ethereal", e)}
            />
            Ethereal Phase (Bypass)
          </label>
        </div>
      {/if}
    </div>
  {:else if selectedItems.length > 1}
    <div class="edit-menu">
      <h3>MULTI-SELECT</h3>
      <p class="info-text">{selectedItems.length} items selected</p>

      {#if canMerge}
        <button
          class="action-btn merge-btn"
          on:click={mapActions.mergeSelectedWalls}
        >
          🔗 Merge Selected Walls
        </button>
      {:else}
        <p class="warning-text">
          Cannot merge mixed categories (walls & portals).
        </p>
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
  .info-text {
    font-size: 13px;
    color: #4caf50;
    margin: 0;
  }
  .warning-text {
    font-size: 12px;
    color: #ff9800;
    font-style: italic;
    margin: 0;
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
    display: flex;
    flex-direction: column;
    gap: 4px;
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
    margin-top: 4px;
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
    flex-direction: row;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: normal;
  }

  .action-btn {
    background-color: #007acc;
    color: white;
    padding: 10px;
    width: 100%;
    border-radius: 4px;
    margin-top: 8px;
  }
  .action-btn:hover {
    background-color: #005f9e;
  }
  .merge-btn {
    background-color: #9c27b0;
  }
  .merge-btn:hover {
    background-color: #7b1fa2;
  }
</style>
