<script>
  import { mapStore } from "$lib/stores/mapStore.svelte.js";

  let activeMap = $derived(mapStore.activeMap);
  let catalog = $derived(mapStore.catalog);
  let activeTool = $derived(mapStore.activeTool);
  let lightingPreview = $derived(mapStore.lightingPreview);
  let manifest = $derived(activeMap?.manifest);

  let selectedItemIds = $derived(mapStore.selectedItemIds);
  let selectedItems = $derived(
    selectedItemIds
      .map((id) => {
        let item = manifest?.geometry?.walls?.find((w) => w.id === id);
        if (item) return { ...item, category: "wall" };

        item = manifest?.geometry?.portals?.find((p) => p.id === id);
        if (item) return { ...item, category: "portal" };

        item = manifest?.geometry?.overhead?.find((r) => r.id === id);
        if (item) return { ...item, category: "roof" };

        item = manifest?.entities?.lights?.find((l) => l.id === id);
        if (item) return { ...item, category: "light" };

        item = manifest?.entities?.events?.find((e) => e.id === id);
        if (item) return { ...item, category: "event" };

        item = manifest?.entities?.audio?.zones?.find((a) => a.id === id);
        if (item) return { ...item, category: "audio" };

        item = manifest?.entities?.emitters?.find((em) => em.id === id);
        if (item) return { ...item, category: "emitter" };

        item = manifest?.entities?.landing_zones?.find((lz) => lz.id === id);
        if (item) return { ...item, category: "spawn" };

        return null;
      })
      .filter(Boolean),
  );
  function selectTool(tool) {
    mapStore.setTool(tool);
  }

  function updateProperty(key, val) {
    if (selectedItems.length === 0 || val === "") return;
    selectedItems.forEach((item) => {
      mapStore.updateItemProperty(item.id, key, val);
    });
  }
</script>

{#if activeMap}
  <div class="toolbar-wrapper">
    <div class="tool-selector">
      <div class="tool-group">
        <span class="group-label">📐 ARCHITECTURE</span>
        <button
          class:active={activeTool === "select"}
          onclick={() => selectTool("select")}
          aria-label="Selection Tool"><span>🔍</span> Select</button
        >
        <button
          class:active={activeTool === "wall"}
          onclick={() => selectTool("wall")}
          aria-label="Draw Walls"><span>🧱</span> Wall</button
        >
        <button
          class:active={activeTool === "portal"}
          onclick={() => selectTool("portal")}
          aria-label="Draw Portals"><span>🚪</span> Portal</button
        >
        <button
          class:active={activeTool === "roof"}
          onclick={() => selectTool("roof")}
          aria-label="Draw Roofs"><span>🌳</span> Roof</button
        >
      </div>

      <div class="tool-group">
        <span class="group-label">💡 ENTITIES</span>
        <button
          class:active={activeTool === "light"}
          onclick={() => selectTool("light")}
          aria-label="Place Lights"><span>💡</span> Light</button
        >
        <button
          class:active={activeTool === "audio"}
          onclick={() => selectTool("audio")}
          aria-label="Place Audio"><span>🎵</span> Audio</button
        >
        <button
          class:active={activeTool === "event"}
          onclick={() => selectTool("event")}
          aria-label="Place Event"><span>⚡</span> Event</button
        >
        <button
          class:active={activeTool === "spawn"}
          onclick={() => selectTool("spawn")}
          aria-label="Place Spawn"><span>🚩</span> Spawn</button
        >
        <button
          class:active={activeTool === "emitter"}
          onclick={() => selectTool("emitter")}
          aria-label="Place Emitter"><span>🌧️</span> Emitter</button
        >
      </div>

      <div class="tool-group">
        <span class="group-label">🌍 ENVIRONMENT</span>
        <button
          class:active={lightingPreview}
          onclick={() => mapStore.toggleLightingPreview()}
          aria-label="Toggle Lighting Preview"
        >
          <span>🌓</span> Preview
        </button>
      </div>
    </div>

    <div class="properties-panel">
      {#if selectedItems.length === 0}
        <div class="panel-section">
          <h3>🌍 ENVIRONMENT CONFIG</h3>
          <p class="helper-text">Global parameters for this VTT level.</p>
        </div>

        {#if catalog.length > 1}
          <div class="panel-section">
            <label>
              <span>📍 Level Switcher:</span>
              <select
                value={activeMap.id}
                onchange={(e) => mapStore.switchMap(e.target.value)}
              >
                {#each catalog as map}
                  <option value={map.id}>{map.filename}</option>
                {/each}
              </select>
            </label>
          </div>
        {/if}

        <div class="panel-section">
          <label>
            <span>Grid Size (Pixels):</span>
            <input
              type="number"
              value={manifest.resolution?.pixels_per_grid}
              onchange={(e) =>
                mapStore.updateItemProperty(
                  activeMap.id,
                  "resolution.pixels_per_grid",
                  parseFloat(e.target.value),
                )}
            />
          </label>
          <label>
            <span>Image X Offset:</span>
            <input
              type="number"
              value={manifest.resolution?.map_offset_x}
              onchange={(e) =>
                mapStore.updateItemProperty(
                  activeMap.id,
                  "resolution.map_offset_x",
                  parseFloat(e.target.value),
                )}
            />
          </label>
          <label>
            <span>Image Y Offset:</span>
            <input
              type="number"
              value={manifest.resolution?.map_offset_y}
              onchange={(e) =>
                mapStore.updateItemProperty(
                  activeMap.id,
                  "resolution.map_offset_y",
                  parseFloat(e.target.value),
                )}
            />
          </label>
        </div>

        {#if activeTool === "select"}
          <div class="panel-section drafting-mode">
            <p class="helper-text">
              Select an item on the canvas to configure its specific properties.
            </p>
          </div>
        {/if}
      {:else}
        {@const item = selectedItems[0]}
        <div class="panel-section">
          <h3>📝 {item.category.toUpperCase()} CONFIG</h3>

          {#if item.category === "wall"}
            <label>
              <span>Wall Collision Presets:</span>
              <select
                value={item.properties?.type || "standard"}
                onchange={(e) =>
                  updateProperty("properties.type", e.target.value)}
              >
                <option value="standard">Standard Solid Wall</option>
                <option value="terrain">Terrain Ridge</option>
                <option value="invisible">Invisible Block (Sight Only)</option>
              </select>
            </label>
          {:else if item.category === "portal"}
            <label>
              <span>Portal Architecture:</span>
              <select
                value={item.properties?.type || "door"}
                onchange={(e) =>
                  updateProperty("properties.type", e.target.value)}
              >
                <option value="door">Solid Door</option>
                <option value="window">Transparent Window</option>
                <option value="secret">Secret Door (Hidden)</option>
              </select>
            </label>
            <label>
              <span>Initial Door State:</span>
              <select
                value={item.properties?.state || "closed"}
                onchange={(e) =>
                  updateProperty("properties.state", e.target.value)}
              >
                <option value="closed">Closed (Blocks Movement)</option>
                <option value="open">Open (Passable)</option>
                <option value="locked">Locked</option>
              </select>
            </label>
          {:else if item.category === "light"}
            <label>
              <span>Lighting Projection Type:</span>
              <select
                value={item.type || "point"}
                onchange={(e) => updateProperty("type", e.target.value)}
              >
                <option value="point">Omni-directional Source</option>
                <option value="directional">Directional Beam/Cone</option>
              </select>
            </label>
            <label>
              <span>Hex Color:</span>
              <input
                type="color"
                value={item.color || "#ffffff"}
                onchange={(e) => updateProperty("color", e.target.value)}
              />
            </label>
            <label>
              <span>Bright Radius:</span>
              <input
                type="number"
                step="0.5"
                value={item.bright_radius}
                onchange={(e) =>
                  updateProperty("bright_radius", parseFloat(e.target.value))}
              />
            </label>
            <label>
              <span>Dim Radius:</span>
              <input
                type="number"
                step="0.5"
                value={item.dim_radius}
                onchange={(e) =>
                  updateProperty("dim_radius", parseFloat(e.target.value))}
              />
            </label>

            {#if item.type === "directional"}
              <label>
                <span>Beam Rotation (Degrees):</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={item.rotation || 0}
                  oninput={(e) =>
                    updateProperty("rotation", parseFloat(e.target.value))}
                />
              </label>
              <label>
                <span>Beam Angle (Cone Width):</span>
                <input
                  type="range"
                  min="10"
                  max="360"
                  value={item.cone_angle || 60}
                  oninput={(e) =>
                    updateProperty("cone_angle", parseFloat(e.target.value))}
                />
              </label>
            {/if}
          {:else if item.category === "spawn"}
            <label>
              <span>Spawn Point Name:</span>
              <input
                type="text"
                value={item.name || "New Spawn"}
                oninput={(e) => updateProperty("name", e.target.value)}
              />
            </label>
            <label>
              <span>Footprint Shape:</span>
              <select
                value={item.shape || "circle"}
                onchange={(e) => updateProperty("shape", e.target.value)}
              >
                <option value="circle">Circle (1 Grid Tile)</option>
                <option value="rectangle">Square (1 Grid Tile)</option>
              </select>
            </label>
            <label class="checkbox-row">
              <input
                type="checkbox"
                checked={item.is_default || false}
                onchange={(e) => updateProperty("is_default", e.target.checked)}
              />
              <span>Set as Default Landing Zone</span>
            </label>
          {:else if item.category === "event"}
            <label>
              <span>Event Name:</span>
              <input
                type="text"
                value={item.name || "New Event"}
                oninput={(e) => updateProperty("name", e.target.value)}
              />
            </label>
            <label>
              <span>Trigger Radius (Grid Tiles):</span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={item.trigger_bounds?.radius || 0.5}
                onchange={(e) =>
                  updateProperty(
                    "trigger_bounds.radius",
                    parseFloat(e.target.value),
                  )}
              />
            </label>
            <label>
              <span>Event Type:</span>
              <select
                value={item.eventType || "Trap/Door Trigger"}
                onchange={(e) => updateProperty("eventType", e.target.value)}
              >
                <option value="Trap/Door Trigger">Trap/Door Trigger</option>
                <option value="Teleport">Teleport</option>
                <option value="Stairs/Ladder">Stairs/Ladder</option>
              </select>
            </label>
            {#if item.eventType === "Teleport" || item.eventType === "Stairs/Ladder"}
              <label>
                <span>Destination (Spawn Point):</span>
                <select
                  value={item.targetSpawnId || ""}
                  onchange={(e) =>
                    updateProperty("targetSpawnId", e.target.value)}
                >
                  <option value="">-- Select Destination --</option>
                  {#each catalog as mapLevel}
                    {#each mapLevel.manifest?.entities?.landing_zones || [] as spawn}
                      <option value={spawn.id}
                        >[{mapLevel.name || mapLevel.filename.split(".")[0]}] {spawn.name ||
                          "Unnamed Spawn"}</option
                      >
                    {/each}
                  {/each}
                </select>
              </label>
            {/if}
          {:else}
            <p class="helper-text">
              Basic clone/translate capabilities active. Specific properties
              coming soon.
            </p>
          {/if}

          <div style="display: flex; gap: 8px; margin-top: 10px;">
            {#if item.category === "wall" || item.category === "portal"}
              <button
                class="action-btn"
                onclick={() => mapStore.convertCategory(item.id)}
                >🔄 Convert</button
              >
            {/if}
            <button
              class="action-btn wave"
              onclick={() => mapStore.duplicateSelected()}>📋 Clone</button
            >
            <button
              class="action-btn positive"
              onclick={() => mapStore.deleteSelected()}>🗑️ Delete</button
            >
          </div>
        </div>
      {/if}

      {#if activeTool === "wall" || activeTool === "portal" || activeTool === "roof"}
        <div class="panel-section drafting-mode">
          <p class="helper-text">
            <b>Left-Click</b> points to draw.<br />Hold <b>Shift</b> to bypass
            grid snap.<br /><b>Right-Click</b> or <b>Enter</b> to finish.
          </p>
        </div>
      {/if}
      {#if activeTool === "select"}
        <div class="panel-section drafting-mode">
          <p class="helper-text">
            Use <b>Ctrl+C</b> to copy, <b>Ctrl+V</b> to paste at cursor, or
            <b>Ctrl+D</b> to clone.
          </p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .toolbar-wrapper {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 10;
    pointer-events: none;
    display: flex;
    gap: 15px;
  }
  .tool-selector,
  .properties-panel {
    background: #0b1329ee;
    border: 1px solid #1e293b;
    padding: 15px;
    border-radius: 8px;
    pointer-events: auto;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
  }

  .tool-selector {
    width: 110px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  .tool-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .group-label {
    font-size: 10px;
    font-weight: bold;
    color: #64748b;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #1e293b;
    padding-bottom: 4px;
    margin-bottom: 2px;
  }

  .properties-panel {
    width: 280px;
  }
  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-bottom: 1px solid #1e293b;
    padding-bottom: 10px;
    margin-bottom: 10px;
  }
  .panel-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .drafting-mode {
    background: rgba(0, 240, 255, 0.05);
    padding: 10px;
    border: 1px dashed rgba(0, 240, 255, 0.2);
    border-radius: 6px;
  }
  .helper-text {
    font-size: 11px;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  h3 {
    margin: 0;
    font-size: 14px;
    color: #00f0ff;
    text-transform: uppercase;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #94a3b8;
  }
  .checkbox-row {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    margin-top: 5px;
    cursor: pointer;
  }

  input,
  select {
    background: #05080e;
    border: 1px solid #1e293b;
    color: #fff;
    padding: 6px;
    border-radius: 4px;
  }
  input[type="checkbox"] {
    cursor: pointer;
    width: 14px;
    height: 14px;
    accent-color: #00f0ff;
  }

  button {
    background: #1e293b;
    border: 1px solid #334155;
    color: #e2e8f0;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    display: flex;
    justify-content: flex-start;
    gap: 8px;
    transition: all 0.2s;
    font-size: 13px;
  }
  button:hover {
    background: #334155;
  }
  button.active {
    background: #00f0ff22;
    border-color: #00f0ff;
    color: #00f0ff;
  }

  .action-btn {
    flex: 1;
    font-size: 12px;
    padding: 8px;
    justify-content: center;
  }
  .action-btn.positive {
    background: #ef444422;
    border-color: #ef4444;
    color: #fca5a5;
  }
  .action-btn.wave {
    background: #3b82f622;
    border-color: #3b82f6;
    color: #93c5fd;
  }
</style>
