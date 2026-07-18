<script>
  import { uiStore } from "$lib/stores/uiStore.svelte.js";
  import { fade } from "svelte/transition";
</script>

{#if uiStore.isLoading}
  <div class="overlay" transition:fade={{ duration: 200 }}>
    <div class="modal">
      <div class="spinner"></div>
      <h2 class="message">{uiStore.loadingMessage}</h2>
      <p class="sub-message">Please do not close the browser.</p>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(11, 19, 41, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    pointer-events: auto; /* Blocks clicks to elements below */
  }

  .modal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    background: #0f172a;
    padding: 40px 60px;
    border: 1px solid #1e293b;
    border-radius: 12px;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.5),
      0 8px 10px -6px rgba(0, 0, 0, 0.5);
  }

  .spinner {
    width: 60px;
    height: 60px;
    border: 4px solid rgba(0, 240, 255, 0.1);
    border-top: 4px solid #00f0ff;
    border-radius: 50%;
    animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .message {
    color: #f8fafc;
    font-size: 18px;
    font-weight: 600;
    font-family: system-ui, sans-serif;
    margin: 0;
    letter-spacing: 0.5px;
  }

  .sub-message {
    color: #64748b;
    font-size: 13px;
    margin: 0;
    font-family: system-ui, sans-serif;
  }
</style>
