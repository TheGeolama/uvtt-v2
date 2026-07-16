<script>
  import { mapStore } from "$lib/stores/mapStore.svelte.js";

  let activeMap = $derived(mapStore.activeMap);
  let history = $derived(activeMap?.history || []);
  let historyIndex = $derived(activeMap?.historyIndex ?? -1);
</script>

{#if activeMap && history.length > 0}
  <div class="history-panel">
    <div class="header">
      <span class="icon">🕒</span> ACTION HISTORY
    </div>
    <div class="history-list">
      {#each history as item, i}
        <button
          class="history-item"
          class:active={i === historyIndex}
          class:undone={i > historyIndex}
          onclick={() => mapStore.jumpToHistory(i)}
        >
          <span class="bullet"></span>
          {item.actionName}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .history-panel {
    position: absolute;
    top: 80px;
    right: 20px;
    width: 220px;
    background: #0b1329ee;
    border: 1px solid #1e293b;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    max-height: 400px;
    pointer-events: auto;
    z-index: 10;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
    font-family: system-ui, sans-serif;
  }
  .header {
    font-size: 11px;
    font-weight: bold;
    color: #00f0ff;
    letter-spacing: 0.5px;
    padding: 10px 12px;
    border-bottom: 1px solid #1e293b;
    background: rgba(0, 0, 0, 0.2);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .history-list {
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .history-item {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 12px;
    padding: 6px 8px;
    text-align: left;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.1s;
  }
  .history-item:hover {
    background: #1e293b;
    color: #e2e8f0;
  }
  .history-item.active {
    background: #00f0ff22;
    color: #00f0ff;
    font-weight: bold;
  }
  .history-item.active .bullet {
    background: #00f0ff;
    box-shadow: 0 0 4px #00f0ff;
  }
  .history-item.undone {
    opacity: 0.4;
  }
  .bullet {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #475569;
  }

  /* Scrollbar styling */
  .history-list::-webkit-scrollbar {
    width: 6px;
  }
  .history-list::-webkit-scrollbar-track {
    background: transparent;
  }
  .history-list::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 3px;
  }
</style>
