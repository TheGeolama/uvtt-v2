<script>
  import { mapStore } from "./stores/mapStore.js";
  import Uploader from "./components/Uploader.svelte";
  import CanvasWorkspace from "./components/CanvasWorkspace.svelte";
  import Toolbar from "./components/Toolbar.svelte";
  import ExportMenu from "./components/ExportMenu.svelte";
</script>

<main>
  {#if !$mapStore.imageUrl}
    <Uploader />
  {:else}
    <Toolbar />
    <ExportMenu />
    <CanvasWorkspace />
  {/if}
</main>

<style>
  /* Global resets to ensure the canvas and uploader take up the exact full screen */
  :global(body, html) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #111111;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    color: #ffffff;
  }

  main {
    width: 100vw;
    height: 100vh;
    position: relative;
  }
</style>
